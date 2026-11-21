"""Test suite cho Quán (Phase 3 / Test Contract v1.2).

Bao quát:
  - Kho cá thể {id, kind, fresh}.
  - Hao tươi kho quán 0.25/s (1 đơn vị / tick với thang 240).
  - Ngưỡng ươn fresh < 30: phát event `spoiled` theo id.
  - Giữ chỗ theo id cá thể tươi nhất (fresh cao nhất, hòa id nhỏ).
  - Giữ chỗ bị ươn: nhả và thử giữ lại đúng 1 lần; thiếu chuyển sang unfulfillable.
  - Chốt giá lúc cook_started: base_price = floor(listed * avg_fresh / 100).
  - Mảng items trong cook_started sắp theo kind rồi id.
  - Tính boa floor(base_price * 0.2) trên giá đã chốt theo fresh.
  - Từ chối file kho đếm ở contract v1.2 (BadInput -> mã 2).
"""

import json
import math
import os
import unittest

from chonoi.contract import load_contract
from chonoi.errors import BadInput
from chonoi.ids import IdAllocator
from chonoi.inputs import InputState
from chonoi.inventory import read_inventory, write_inventory
from chonoi.rng import Streams
from chonoi.runner import run
from chonoi.sim.quan import QuanSim
from helpers import Workdir, read_jsonl, run_headless, snapshots, write_json


def make_input(move=(0, 0), interact=False, catch=False):
    held = {"interact": bool(interact), "catch": bool(catch)}
    edges = {name for name, pressed in held.items() if pressed}
    return InputState(list(move), held, edges)


class TestQuanPhase3Freshness(unittest.TestCase):
    def setUp(self):
        self.tuning = load_contract()["tuning"]
        self.streams = Streams(1)
        self.ids = IdAllocator()

    def test_freshness_decay_and_spoiled_event(self):
        """Hao tươi kho quán 0.25/s. fresh bắt đầu từ 30.0 thì tick đầu tiên giảm xuống < 30 và phát spoiled."""
        scenario = {
            "player": {"pos": [8, 5]},
            "stock": [
                {"id": "I1", "kind": "ca_linh", "fresh": 30.0},
                {"id": "I2", "kind": "ca_loc", "fresh": 50.0},
            ],
            "customers": [],
            "time_left_ticks": 100,
        }
        sim = QuanSim(self.tuning, scenario, self.streams, self.ids)
        events = sim.step(make_input())

        # I1 từ 30.0 giảm xuống 29.9958 (< 30) -> phát spoiled
        spoiled_ev = [e for e in events if e[0] == "spoiled"]
        self.assertEqual(len(spoiled_ev), 1)
        self.assertEqual(spoiled_ev[0][1], {"item_id": "I1", "kind": "ca_linh", "location": "stock"})

        # Bước tiếp theo: I1 đã phát spoiled rồi thì không phát lại
        events2 = sim.step(make_input())
        spoiled_ev2 = [e for e in events2 if e[0] == "spoiled"]
        self.assertEqual(len(spoiled_ev2), 0)

    def test_multiple_spoiled_emitted_in_id_order(self):
        """Nếu nhiều cá thể cùng vượt ngưỡng, phát spoiled theo id."""
        scenario = {
            "player": {"pos": [8, 5]},
            "stock": [
                {"id": "I3", "kind": "ca_linh", "fresh": 30.0},
                {"id": "I1", "kind": "bong_dien_dien", "fresh": 30.0},
                {"id": "I2", "kind": "ca_loc", "fresh": 30.0},
            ],
            "customers": [],
            "time_left_ticks": 100,
        }
        sim = QuanSim(self.tuning, scenario, self.streams, self.ids)
        events = sim.step(make_input())

        spoiled_ev = [e for e in events if e[0] == "spoiled"]
        self.assertEqual(len(spoiled_ev), 3)
        self.assertEqual([e[1]["item_id"] for e in spoiled_ev], ["I1", "I2", "I3"])

    def test_reservation_by_freshest_items(self):
        """Mỗi loại trong công thức lấy các cá thể khả dụng tươi nhất, hòa theo id."""
        scenario = {
            "player": {"pos": [8, 5]},
            "stock": [
                {"id": "I1", "kind": "ca_loc", "fresh": 60.0},
                {"id": "I2", "kind": "ca_loc", "fresh": 95.0},
                {"id": "I3", "kind": "ca_loc", "fresh": 80.0},
            ],
            "customers": [
                {
                    "id": "C1",
                    "table_id": "T1",
                    "dish_id": "ca_loc_nuong_trui",  # recipe: ca_loc 1
                    "state": "waiting",
                    "order_status": "reserved",
                }
            ],
            "time_left_ticks": 100,
        }
        sim = QuanSim(self.tuning, scenario, self.streams, self.ids)
        c1 = sim.customers[0]
        # I2 tươi nhất (95.0) nên được chọn
        self.assertEqual(c1["reserved"], ["I2"])

    def test_reserved_item_spoils_triggers_re_reservation(self):
        """Nếu phần giữ có cá thể vừa ươn: nhả toàn bộ và thử giữ lại đúng 1 lần."""
        scenario = {
            "player": {"pos": [8, 5]},
            "stock": [
                {"id": "I1", "kind": "ca_loc", "fresh": 30.0},  # Sẽ ươn ở tick 1
                {"id": "I2", "kind": "ca_loc", "fresh": 85.0},  # Hàng dự phòng còn tươi
            ],
            "customers": [
                {
                    "id": "C1",
                    "table_id": "T1",
                    "dish_id": "ca_loc_nuong_trui",
                    "state": "waiting",
                    "order_status": "reserved",
                    "reserved": ["I1"],
                }
            ],
            "time_left_ticks": 100,
        }
        sim = QuanSim(self.tuning, scenario, self.streams, self.ids)
        events = sim.step(make_input())

        # I1 bị ươn
        self.assertTrue(any(e[0] == "spoiled" and e[1]["item_id"] == "I1" for e in events))
        c1 = sim.customers[0]
        # Đã re-reserve sang I2 thành công
        self.assertEqual(c1["order_status"], "reserved")
        self.assertEqual(c1["reserved"], ["I2"])

    def test_reserved_item_spoils_and_no_stock_becomes_unfulfillable(self):
        """Nếu cá thể vừa ươn mà kho không đủ để giữ lại: đơn chuyển unfulfillable."""
        scenario = {
            "player": {"pos": [8, 5]},
            "stock": [
                {"id": "I1", "kind": "ca_loc", "fresh": 30.0},
            ],
            "customers": [
                {
                    "id": "C1",
                    "table_id": "T1",
                    "dish_id": "ca_loc_nuong_trui",
                    "state": "waiting",
                    "order_status": "reserved",
                    "reserved": ["I1"],
                }
            ],
            "time_left_ticks": 100,
        }
        sim = QuanSim(self.tuning, scenario, self.streams, self.ids)
        sim.step(make_input())

        c1 = sim.customers[0]
        self.assertEqual(c1["order_status"], "unfulfillable")
        self.assertEqual(c1["reserved"], [])


class TestQuanPhase3PricingAndCooking(unittest.TestCase):
    def setUp(self):
        self.tuning = load_contract()["tuning"]
        self.streams = Streams(1)
        self.ids = IdAllocator()

    def test_cook_started_locks_price_by_average_freshness(self):
        """Bắt đầu nấu: tiêu đúng các id đang giữ và chốt base_price = floor(listed * avg_fresh / 100)."""
        # Món canh_chua_ca_loc: ca_loc 1, bong_dien_dien 1. Giá niêm yết = 90.
        scenario = {
            "player": {"pos": [2.0, 8.0]},  # Cạnh bếp B1 [2, 8]
            "stock": [
                {"id": "I1", "kind": "ca_loc", "fresh": 80.0},
                {"id": "I2", "kind": "bong_dien_dien", "fresh": 60.0},
            ],
            "customers": [
                {
                    "id": "C1",
                    "table_id": "T1",
                    "dish_id": "canh_chua_ca_loc",
                    "state": "waiting",
                    "order_status": "reserved",
                    "reserved": ["I1", "I2"],
                }
            ],
            "stoves": [{"id": "B1", "pos": [2, 8], "state": "idle"}],
            "time_left_ticks": 1000,
        }
        sim = QuanSim(self.tuning, scenario, self.streams, self.ids)
        events = sim.step(make_input(interact=True))

        cook_ev = [e for e in events if e[0] == "cook_started"]
        self.assertEqual(len(cook_ev), 1)
        c_data = cook_ev[0][1]

        # Sau 1 tick hao tươi (0.25/60 điểm mỗi nguyên liệu):
        # I1: 80 - 1/240 = 79.9958, I2: 60 - 1/240 = 59.9958
        # avg_fresh = 69.9958 -> base_price = floor(90 * 69.9958 / 100) = floor(62.996) = 62
        b1 = sim.stoves[0]
        self.assertEqual(b1["dish"]["base_price"], 62)
        self.assertEqual(sim.customers[0]["base_price"], 62)

        # Mảng items trong cook_started sắp theo kind rồi id
        # bong_dien_dien đứng trước ca_loc theo bảng chữ cái
        self.assertEqual([it["id"] for it in c_data["items"]], ["I2", "I1"])
        # Stock đã bị tiêu trừ
        self.assertEqual(len(sim.stock), 0)

    def test_tip_calculated_on_locked_base_price(self):
        """Boa floor(base_price * 0.2) trên giá đã chốt theo fresh."""
        scenario = {
            "player": {"pos": [9.0, 2.0]},  # Cạnh bàn T1 [9, 2]
            "hand": {"order_id": "C1", "dish_id": "canh_chua_ca_loc", "base_price": 63},
            "customers": [
                {
                    "id": "C1",
                    "table_id": "T1",
                    "dish_id": "canh_chua_ca_loc",
                    "state": "waiting",
                    "order_status": "assigned",
                    "patience_ticks_left": 3600,  # 100% kiên nhẫn >= 50%
                    "base_price": 63,
                }
            ],
            "time_left_ticks": 1000,
        }
        sim = QuanSim(self.tuning, scenario, self.streams, self.ids)
        init_rep = sim.reputation
        events = sim.step(make_input(interact=True))

        served_ev = [e for e in events if e[0] == "served"]
        self.assertEqual(len(served_ev), 1)
        # floor(63 * 0.2) = floor(12.6) = 12
        self.assertEqual(served_ev[0][1]["tip"], 12)
        # Thu boa dương: uy tín +0.2
        self.assertAlmostEqual(sim.reputation, init_rep + 0.2)


class TestQuanService(unittest.TestCase):
    def test_natural_arrival_through_cooking_and_payment(self):
        tuning = load_contract()["tuning"]
        sim = QuanSim(tuning, {
            "player": {"pos": tuning["quan"]["stoves"][0]["pos"]},
            "time_left_ticks": 2400,
            "stock": [{"id": "I1", "kind": "ca_loc", "fresh": 100}],
            "customers": [{"id": "C8", "table_id": "T2", "dish_id": "goi_bong_sung",
                           "order_status": "unfulfillable", "reserved": []}],
        }, Streams(42), IdAllocator())
        idle = make_input()
        interact = make_input(interact=True)
        first_arrival = tuning["quan"]["first_customer_tick"]

        for _ in range(first_arrival - 1):
            self.assertFalse(any(name == "customer_arrived" for name, _ in sim.step(idle)))
        self.assertIn(("customer_arrived", {"customer_id": "C9", "table_id": "T1",
                                           "dish_id": "ca_loc_nuong_trui"}), sim.step(idle))
        self.assertEqual(sim.snapshot()["tables"][0]["customer_id"], "C9")
        self.assertEqual(sim.customers[-1]["reserved"], ["I1"])

        cooked = dict(sim.step(interact))["cook_started"]
        self.assertEqual(cooked["order_id"], "C9")
        for _ in range(sim.stoves[0]["cook_ticks_left"]):
            sim.step(idle)
        self.assertIn("dish_picked", dict(sim.step(interact)))

        table_pos = sim.tables[0]["pos"]
        radius = tuning["quan"]["interact_radius"]
        for _ in range(240):
            distance = math.dist(sim.pos, table_pos)
            if distance <= radius / 2:
                break
            direction = [(target - current) / distance for target, current in zip(table_pos, sim.pos)]
            sim.step(make_input(move=direction))
        served = dict(sim.step(interact))["served"]
        self.assertEqual(served["table_id"], "T1")
        customer = next(c for c in sim.customers if c["id"] == "C9")
        for _ in range(customer["eat_ticks_left"] - 1):
            sim.step(idle)
        paid = dict(sim.step(idle))["paid"]
        self.assertEqual(paid["base_price"], cooked["base_price"])
        self.assertEqual(sim.earned, paid["base_price"] + paid["tip"])
        self.assertIsNone(sim.snapshot()["tables"][0]["customer_id"])

    def test_departure_clears_only_its_dish_and_closing_wins_ties(self):
        tuning = load_contract()["tuning"]
        dish = {"order_id": "C1", "dish_id": "ca_loc_nuong_trui", "base_price": 60}
        initial_reputation = tuning["quan"]["reputation_initial"]
        for ticks_left, reason in ((2, "patience"), (1, "closing")):
            for station in ({"hand": dish}, {"stoves": [{"id": "B1", "state": "ready", "dish": dish}]}):
                with self.subTest(ticks_left=ticks_left, station=station):
                    sim = QuanSim(tuning, {
                        "time_left_ticks": ticks_left, "random_customers": False,
                        "customers": [{"id": "C1", "table_id": "T1", "dish_id": dish["dish_id"],
                                       "order_status": "assigned", "patience_ticks_left": 1}],
                        **station,
                    }, Streams(42), IdAllocator())
                    result = dict(sim.step(make_input()))
                    loss = tuning["quan"]["left_reputation_delta"] if reason == "patience" else 0
                    self.assertEqual(sim.reputation, initial_reputation + loss)
                    self.assertEqual(result["customer_left"]["reason"], reason)
                    self.assertIsNone(sim.hand)
                    self.assertEqual(sim.stoves[0]["state"], "idle")
                    self.assertEqual(sim.stock, [])


class TestQuanPhase3InventoryContract(unittest.TestCase):
    def test_read_inventory_v12_rejects_dict_count_returns_bad_input(self):
        """Contract v1.2 trả mã 2 cho file kho đếm [THAY THẾ]."""
        with Workdir() as w:
            dict_inv = write_json(w.path("old_inv.json"), {"items": {"bong_sung": 2, "ca_loc": 1}})
            with self.assertRaises(BadInput):
                read_inventory(dict_inv, contract_version="1.2")

    def test_read_and_write_inventory_v12_itemized(self):
        """Đọc và ghi kho cá thể v1.2: [{"id": ..., "kind": ..., "fresh": ...}]."""
        with Workdir() as w:
            items = [
                {"id": "I2", "kind": "ca_loc", "fresh": 95.0},
                {"id": "I1", "kind": "ca_linh", "fresh": 100.0},
            ]
            path = w.path("item_inv.json")
            write_inventory(path, items)

            read_back = read_inventory(path, contract_version="1.2")
            # Ghi sắp theo ID
            self.assertEqual(read_back[0]["id"], "I1")
            self.assertEqual(read_back[1]["id"], "I2")
            self.assertEqual(read_back[0]["fresh"], 100.0)

    def test_headless_quan_run_phase3_preset(self):
        """Headless Quán v1.2 nhận kho cá thể và xuất snapshot chuẩn."""
        with Workdir() as w:
            inv_path = write_json(w.path("inv.json"), {
                "items": [
                    {"id": "I1", "kind": "ca_loc", "fresh": 100.0},
                    {"id": "I2", "kind": "bong_sung", "fresh": 95.0},
                    {"id": "I3", "kind": "bong_sung", "fresh": 90.0},
                ]
            })
            out_path = w.path("out.jsonl")
            code, err = run_headless(
                "--mode", "quan", "--seed", "1", "--ticks", "50",
                "--inventory", inv_path, "--out", out_path
            )
            self.assertEqual(code, 0, err)
            rows = read_jsonl(out_path)
            snaps = snapshots(rows)
            self.assertGreater(len(snaps), 0)
            first_snap = snaps[0]
            self.assertEqual(first_snap["mode"], "quan")
            # Snapshot stock là mảng cá thể
            self.assertIsInstance(first_snap["stock"], list)
            self.assertEqual(len(first_snap["stock"]), 3)
            self.assertEqual(first_snap["stock"][0]["id"], "I1")


if __name__ == "__main__":
    unittest.main()
