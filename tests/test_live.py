"""Test cửa sổ chơi trực tiếp (chonoi.live). Chỉ dành cho starter Python: nhóm đổi ngôn ngữ thì xóa file này."""

import json
import tempfile
import time
import unittest
import urllib.error
import urllib.request
from pathlib import Path

from chonoi.contract import load_contract
from chonoi.live import LiveGame, LiveServer


def _get(url):
    with urllib.request.urlopen(url, timeout=5) as r:
        return r.status, r.read()


def _post(url, obj):
    req = urllib.request.Request(url, data=json.dumps(obj).encode(), method="POST",
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return r.status
    except urllib.error.HTTPError as e:
        e.close()
        return e.code


class LiveServerTest(unittest.TestCase):
    def test_webp_atlases_are_served_in_live_game(self):
        server = LiveServer(LiveGame("gather", load_contract()["tuning"], {}, 1), port=0)
        server.start()
        try:
            for name in ("landscape.webp", "crocodile.webp"):
                with self.subTest(name=name), urllib.request.urlopen(server.url + "assets/" + name, timeout=5) as response:
                    self.assertEqual(response.status, 200)
                    self.assertEqual(response.headers.get_content_type(), "image/webp")
                    header = response.read(12)
                    self.assertEqual(header[:4], b"RIFF")
                    self.assertEqual(header[8:], b"WEBP")
            for name in ("missing.webp", "../river-cover.webp", "README.md"):
                with self.subTest(name=name), self.assertRaises(urllib.error.HTTPError) as error:
                    urllib.request.urlopen(server.url + "assets/" + name, timeout=5)
                self.assertEqual(error.exception.code, 404)
                error.exception.close()
        finally:
            server.stop()

    def test_state_input_and_clean_stop(self):
        tuning = load_contract()["tuning"]
        server = LiveServer(LiveGame("gather", tuning, {}, 1), port=0)  # cổng ngẫu nhiên
        server.start()
        try:
            base = f"http://127.0.0.1:{server.port}"
            code, body = _get(base + "/state")
            self.assertEqual(code, 200)
            st = json.loads(body)
            self.assertIn("tick", st)
            self.assertEqual(st["mode"], "gather")
            self.assertEqual(st["player"]["pos"], [2, 0])
            self.assertEqual(_post(base + "/input", {"move": [1, 0], "interact": False, "catch": False}), 200)
            self.assertEqual(_post(base + "/input", {"move": [5, 0]}), 400)
            code, html = _get(base + "/")
            self.assertEqual(code, 200)
            self.assertIn(b"<canvas", html)
            deadline = time.time() + 3
            while time.time() < deadline:
                st2 = json.loads(_get(base + "/state")[1])
                if st2["tick"] > st["tick"] + 3 and st2["player"]["pos"][0] > st["player"]["pos"][0]:
                    break
                time.sleep(0.05)
            self.assertGreater(st2["tick"], st["tick"], "mô phỏng phải chạy nền")
            self.assertGreater(st2["player"]["pos"][0], st["player"]["pos"][0], "input phải tác động tới sim")
        finally:
            server.stop()
        self.assertFalse(server.game._thread.is_alive())
        self.assertFalse(server._thread.is_alive())


class BrowserSessionTest(unittest.TestCase):
    def test_button_edges_become_one_tick_pulses(self):
        game = LiveGame("gather", load_contract()["tuning"], {}, 1)
        game.set_input({"move": [1, 1], "interact": True, "catch": True})
        game.set_input({"interact": True})
        game.set_input({"interact": False})
        game.set_input({"interact": True})
        states = [game.inputs.advance() for _ in range(4)]
        self.assertEqual([state.held for state in states], [
            {"interact": True, "catch": True},
            {"interact": False, "catch": False},
            {"interact": True, "catch": False},
            {"interact": False, "catch": False},
        ])
        for state in states:
            self.assertAlmostEqual(sum(component ** 2 for component in state.move), 1)
            for name, held in state.held.items():
                self.assertEqual(state.pressed(name), held)

    def test_browser_day_hands_off_the_finalized_inventory(self):
        with tempfile.TemporaryDirectory() as directory:
            inventory = Path(directory) / "inventory.json"
            game = LiveGame("gather", load_contract()["tuning"], {"hold": ["ca_loc", "bong_sung", "bong_sung"]}, 42,
                            inventory_out=inventory, autoplay=False)
            game.play("day")
            with self.assertRaises(ValueError):
                game.continue_day()
            self.assertFalse(inventory.exists())

            game.set_input({"interact": True})
            game._tick_once()
            morning = json.loads(game.state_json())
            stored = json.loads(inventory.read_text(encoding="utf-8"))
            self.assertTrue(morning["inventory_saved"])
            self.assertEqual(morning["events"][-1]["data"]["inventory"], stored)
            game.continue_day()

            evening = json.loads(game.state_json())
            self.assertEqual(evening["mode"], "quan")
            self.assertEqual(evening["tick"], 0)
            if isinstance(evening["stock"], list):
                self.assertEqual(sorted([it["kind"] for it in evening["stock"]]), ["bong_sung", "bong_sung", "ca_loc"])
            else:
                self.assertEqual(evening["stock"], {"bong_sung": 2, "ca_loc": 1})
            self.assertGreater(evening["session_id"], morning["session_id"])
            game.restart()
            self.assertEqual(json.loads(game.state_json())["stock"], evening["stock"])


if __name__ == "__main__":
    unittest.main()
