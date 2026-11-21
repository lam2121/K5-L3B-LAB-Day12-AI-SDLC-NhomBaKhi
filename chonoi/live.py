"""Cửa sổ chơi trực tiếp bằng TRÌNH DUYỆT, chỉ dùng thư viện chuẩn Python.

    python3 -m chonoi.live --mode gather|quan [--seed N] [--port 8000]

Máy chủ HTTP nhỏ phục vụ client và các API live:
    GET  /config -> tuning và thông tin phiên bản đọc từ game.contract.json
    GET  /state  -> snapshot JSON hiện tại (cùng trường như dòng snapshot của headless) + `meta` + `events`
    POST /input  -> {"move": [a, b], "interact": bool, "catch": bool}   (trạng thái phím đang giữ)
    POST /restart -> chơi lại từ đầu (cùng seed, cùng scenario)
    POST /play -> chọn day, gather, quan hoặc menu; POST /continue -> bàn giao kho sáng sang tối

Mô phỏng chạy 60 tick/s trong một luồng nền, dùng CÙNG lớp sim như headless (qua `runner.Session`).
Client chỉ ĐỌC snapshot và tự bỏ qua trường chưa có, nên luật do nhóm viết thêm trường nào cũng không vỡ.
Ngẫu nhiên vẫn đi qua `Streams` (seed); chỉ nhịp chạy theo đồng hồ thật, không đi vào luật.
"""

import argparse
import json
import os
import re
import sys
import threading
import time
import traceback
from collections import deque
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from .contract import DEFAULT_PATH, load_contract
from .errors import BadInput
from .inputs import BUTTONS_V10, CAMPAIGN_BUTTONS, InputState, normalize
from .inventory import read_inventory
from .live_dive import LiveDiveCampaign
from .runner import Session
from .scenario import load_scenario

WEB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web")
SAMPLE_INVENTORY = os.path.join(os.path.dirname(DEFAULT_PATH), "docs", "contracts", "inventory.sample.json")
SAMPLE_INVENTORY_V12 = os.path.join(os.path.dirname(SAMPLE_INVENTORY), "inventory.v12.sample.json")
WEB_FILES = {"index.html": "text/html", "styles.css": "text/css", "phase2.preview.json": "application/json",
             "phase3.preview.json": "application/json",
             "river-cover.webp": "image/webp",
             **dict.fromkeys(("app.js", "adapter.js", "scenes.js", "art.js", "preview.js",
                              "campaign.js", "phase2-preview.js", "phase3-preview.js", "inventory-view.js",
                              "assets/sprites.js"), "text/javascript")}
WEB_ATLAS = re.compile(r"assets/[a-z0-9_-]+\.webp")
LIVE_CAMPAIGN_BUTTONS = (*CAMPAIGN_BUTTONS, "shoot")
MAX_BODY = 4096
RECENT_EVENTS = 40


class _TickInputs:
    """Nhận trạng thái phím từ HTTP và cấp một xung cho mỗi cạnh lên ở tick live."""

    def __init__(self, buttons=BUTTONS_V10):
        self.move = (0.0, 0.0)
        self.down = dict.fromkeys(buttons, False)
        self.pending = dict.fromkeys(buttons, 0)
        self.pulses = set()
        self.purchases = deque()

    def set(self, move, **buttons):
        if move is not None:
            self.move = normalize(move)
        for name, down in buttons.items():
            if down and not self.down[name]:
                self.pending[name] += 1
            self.down[name] = down

    def advance(self):
        # Kể cả hai cú bấm đến giữa cùng hai tick, mỗi xung vẫn có một tick nhả sau nó.
        self.pulses = {name for name in self.pending if self.pending[name] and name not in self.pulses}
        for name in self.pulses:
            self.pending[name] -= 1
        buy = self.purchases.popleft() if self.purchases else None
        return InputState(self.move, {name: name in self.pulses for name in self.down}, self.pulses, buy=buy)


class LiveGame:
    """Một lượt chơi + luồng nền bước 60 tick/s. Mọi truy cập trạng thái đi qua khóa."""

    def __init__(self, mode, tuning, scenario, seed, inventory=None, inventory_out=None, *, autoplay=True, contract=None):
        self.tuning = tuning
        self.web_config = {**tuning, **{key: contract[key] for key in ("contract_version", "extensions", "freshness") if contract and key in contract}}
        if self.web_config.get("contract_version") in ("1.2", "1.3") and tuning.get("day_plan") and tuning.get("shop"):
            self.web_config["capabilities"] = {"campaign_v12": True}
        self.seed = seed
        self._launch_mode = mode
        self._launch_scenario = scenario
        self._launch_inventory = inventory
        self._browser_inventory_path = inventory_out or "inventory.json"
        self._session_id = 0
        self._lock = threading.Lock()
        self._stop = threading.Event()
        self._thread = None
        self._begin(mode, mode, scenario, inventory, inventory_out)
        self.active = autoplay

    @property
    def mode(self):
        return self.session.mode

    def _begin(self, play_mode, mode, scenario, inventory, inventory_out):
        if mode == "campaign":
            self.session = LiveDiveCampaign(self.tuning, scenario, self.seed)
        else:
            self.session = Session(mode, self.tuning, scenario, self.seed, inventory)
        self._phase_args = (play_mode, mode, scenario, inventory, inventory_out)
        self.play_mode = play_mode
        self.inventory_out = inventory_out
        self.active = True
        self._session_id += 1
        self.inputs = _TickInputs(LIVE_CAMPAIGN_BUTTONS if mode == "campaign" else BUTTONS_V10)
        self.events = []
        self._saved = False
        self._inventory_error = None
        self.error = None

    # --- luồng nền ----------------------------------------------------------------
    def start(self):
        self._thread = threading.Thread(target=self._loop, name="chonoi-sim", daemon=True)
        self._thread.start()

    def stop(self):
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=2)

    def _loop(self):
        nxt = time.perf_counter()
        tick_s = 1.0 / self.tuning["tick_hz"]
        while not self._stop.is_set():
            nxt += tick_s
            with self._lock:
                try:
                    self._tick_once()
                except Exception:  # luật của nhóm lỗi: báo ra terminal + client, dừng bước (restart để chơi lại)
                    self.error = traceback.format_exc()
                    sys.stderr.write(self.error)
                    self.active = False
                    self.session.sim.done = True
                    self.session.sim.reason = "error"
            delay = nxt - time.perf_counter()
            if delay > 0:
                self._stop.wait(delay)
            elif delay < -0.25:  # chạy chậm quá thì bỏ bù, tránh chạy dồn
                nxt = time.perf_counter()

    def _tick_once(self):
        s = self.session
        if not self.active or s.done:
            return
        campaign = self.mode == "day"
        if campaign and s.awaiting:
            return
        for row in s.step(self.inputs.advance()):
            self.events.append(row)
        del self.events[:-RECENT_EVENTS]
        if campaign and s.awaiting:
            self.inputs = _TickInputs(LIVE_CAMPAIGN_BUTTONS)
        if self.mode == "gather" and s.done and self.inventory_out:
            self._save_inventory()

    def _save_inventory(self):
        try:
            self.session.write_inventory_if_done(self.inventory_out)
        except OSError as e:
            self._inventory_error = str(e)
            sys.stderr.write(f"lỗi ghi kho: {e}\n")
        else:
            self._saved = True
            self._inventory_error = None

    # --- API cho handler -----------------------------------------------------------
    def state_json(self) -> bytes:
        with self._lock:
            snap = self.session.snapshot()
            snap["meta"] = self.tuning[snap["phase"]]
            snap["events"] = list(self.events)
            snap["finished"] = self.session.done
            snap["reason"] = self.session.end_row()["reason"] if self.session.done else None
            snap["error"] = self.error
            snap["session_id"] = self._session_id
            snap["inventory_saved"] = self._saved
            snap["inventory_file"] = os.path.basename(self.inventory_out) if self.inventory_out else None
            return json.dumps(snap, ensure_ascii=False, separators=(",", ":")).encode("utf-8")

    def set_input(self, body: dict):
        move = body.get("move")
        if move is not None:
            ok = (isinstance(move, list) and len(move) == 2 and
                  all(isinstance(c, (int, float)) and not isinstance(c, bool) and abs(c) <= 1 for c in move))
            if not ok:
                raise ValueError("move phải là [a, b] trong [-1, 1]")
        with self._lock:
            if "prepare" in body:
                if self.mode != "day" or not self.active:
                    raise ValueError("Mua trang bị trong chế độ Hành trình.")
                self.session.buy_preparation(body["prepare"])
                return
            buttons = {}
            for b in self.inputs.down:
                if b in body:
                    if not isinstance(body[b], bool):
                        raise ValueError(f"{b} phải là boolean")
                    buttons[b] = body[b]
            if self.mode == "day":
                if self.session.awaiting or self.session.done:
                    return
                buy = body.get("buy")
                if buy is not None:
                    if not isinstance(buy, str) or buy not in self.tuning["shop"]["upgrades"]:
                        raise ValueError("mã nâng cấp không hợp lệ")
                    if self.session.phase == "shop" and not self.session.paused:
                        self.inputs.purchases.append(buy)
            self.inputs.set(move, **buttons)

    def restart(self):
        with self._lock:
            self._begin(*self._phase_args)

    def play(self, choice):
        if choice not in ("campaign", "day", "gather", "quan", "menu"):
            raise ValueError("Chế độ chơi không hợp lệ.")
        with self._lock:
            if choice == "menu":
                self.active = False
                return
            if choice == "campaign":
                if not (self.tuning.get("day_plan") and self.tuning.get("shop")):
                    raise ValueError("Thiếu cấu hình hành trình")
                fixture = {self._launch_mode: self._launch_scenario}
                self._begin(choice, choice, fixture, None, None)
                return
            mode = "gather" if choice == "day" else choice
            scenario = self._launch_scenario if mode == self._launch_mode else {}
            if mode == "gather":
                self._begin(choice, mode, scenario, None, self._browser_inventory_path)
            else:
                inventory = self._launch_inventory
                if inventory is None and "stock" not in scenario:
                    path = self._browser_inventory_path
                    sample = SAMPLE_INVENTORY_V12 if self.tuning.get("freshness") else SAMPLE_INVENTORY
                    inventory = read_inventory(path if os.path.exists(path) else sample)
                self._begin(choice, mode, scenario, inventory, None)

    def continue_day(self, stage=None):
        with self._lock:
            if self.mode == "day" and self.active:
                self.session.proceed(stage)
                return
            if (self.play_mode != "day" or not self.active or self.mode != "gather"
                    or not any(row["name"] == "gather_end" for row in self.events)):
                raise ValueError("Cần hoàn thành buổi sáng trong chế độ Chơi trọn ngày.")
            if not self._saved:
                self._save_inventory()
            if not self._saved:
                raise OSError(f"Chưa ghi được kho: {self._inventory_error}")
            inventory = read_inventory(self.inventory_out)
            if inventory != self.session.sim.inventory_items():
                raise BadInput("File kho đã thay đổi sau khi chốt buổi sáng.")
            self._begin("day", "quan", {}, inventory, None)


class _Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    game: LiveGame = None  # gán trên lớp con trong make_server

    def log_message(self, fmt, *args):  # yên lặng
        pass

    def _send(self, code, body: bytes, ctype="application/json; charset=utf-8"):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/state":
            self._send(200, self.game.state_json())
        elif path == "/config":
            self._send(200, json.dumps(self.game.web_config, ensure_ascii=False).encode("utf-8"))
        else:
            name = "index.html" if path == "/" else path.removeprefix("/")
            content_type = "image/webp" if WEB_ATLAS.fullmatch(name) else WEB_FILES.get(name)
            if content_type:
                try:
                    with open(os.path.join(WEB_DIR, name), "rb") as f:
                        body = f.read()
                except OSError:
                    pass
                else:
                    if not content_type.startswith("image/"):
                        content_type += "; charset=utf-8"
                    self._send(200, body, content_type)
                    return
            self._send(404, b'{"error":"khong co"}')

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        try:
            n = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            n = -1
        if n < 0 or n > MAX_BODY:
            self._send(400, b'{"error":"body sai"}')
            return
        raw = self.rfile.read(n) if n else b""
        try:
            if path in ("/input", "/play"):
                body = json.loads(raw.decode("utf-8") or "{}")
                if not isinstance(body, dict):
                    raise ValueError("body phải là object")
                if path == "/input":
                    self.game.set_input(body)
                else:
                    self.game.play(body.get("mode"))
            elif path == "/continue":
                body = json.loads(raw.decode("utf-8") or "{}")
                if not isinstance(body, dict):
                    raise ValueError("body phải là object")
                self.game.continue_day(body.get("stage"))
            elif path == "/restart":
                self.game.restart()
            else:
                self._send(404, b'{"error":"khong co"}')
                return
        except (ValueError, BadInput) as e:
            self._send(400, json.dumps({"error": str(e)}).encode("utf-8"))
            return
        except OSError as e:
            self._send(500, json.dumps({"error": str(e)}).encode("utf-8"))
            return
        self._send(200, b'{"ok":true}')


class LiveServer:
    """Máy chủ + mô phỏng. port=0 -> cổng ngẫu nhiên (đọc `.port`)."""

    def __init__(self, game: LiveGame, host="127.0.0.1", port=8000):
        handler = type("Handler", (_Handler,), {"game": game})
        self.game = game
        self.httpd = ThreadingHTTPServer((host, port), handler)
        self.httpd.daemon_threads = True
        self.host = host
        self.port = self.httpd.server_address[1]
        self._thread = None

    @property
    def url(self):
        return f"http://{self.host}:{self.port}/"

    def start(self):
        self.game.start()
        self._thread = threading.Thread(target=self.httpd.serve_forever, name="chonoi-http", daemon=True)
        self._thread.start()

    def stop(self):
        self.httpd.shutdown()
        self.httpd.server_close()
        if self._thread:
            self._thread.join(timeout=2)
        self.game.stop()


def main(argv=None) -> int:
    p = argparse.ArgumentParser(prog="chonoi.live", description="Chơi Quán Ăn Chợ Nổi trên trình duyệt.")
    p.add_argument("--mode", required=True, choices=["gather", "quan"])
    p.add_argument("--seed", type=int, default=1)
    p.add_argument("--port", type=int, default=8000, help="0 = cổng ngẫu nhiên")
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--scenario")
    p.add_argument("--inventory", help="chỉ với quan: nạp kho từ file")
    p.add_argument("--inventory-out", dest="inventory_out", help="chỉ với gather: ghi kho khi kết thúc buổi")
    a = p.parse_args(argv)
    try:
        if a.inventory and a.mode != "quan":
            raise BadInput("--inventory chỉ dùng với quan")
        if a.inventory_out and a.mode != "gather":
            raise BadInput("--inventory-out chỉ dùng với gather")
        contract = load_contract()
        tuning = contract["tuning"]
        inventory = read_inventory(a.inventory) if a.inventory else None
        scenario = load_scenario(a.scenario, a.mode, tuning, inventory=inventory)
        game = LiveGame(a.mode, tuning, scenario, a.seed, inventory, a.inventory_out, autoplay=False, contract=contract)
        server = LiveServer(game, a.host, a.port)
    except BadInput as e:
        sys.stderr.write(f"đầu vào sai: {e}\n")
        return 2
    except OSError as e:
        sys.stderr.write(f"không mở được cổng {a.port}: {e}\n")
        return 1
    server.start()
    print(f"Open {server.url} ({a.mode}, seed {a.seed}). Ctrl+C to stop.", flush=True)
    try:
        while True:
            time.sleep(0.5)
    except KeyboardInterrupt:
        pass
    finally:
        server.stop()
    return 0


if __name__ == "__main__":
    sys.exit(main())
