"""Buổi tối — Mở Quán (Phase 3 / Test Contract v1.2).

Luật chơi Quán (TICKET-02 & TICKET-03):
  - Bếp: B1 [2,8], B2 [5,8].
  - Bàn: T1 [9,2], T2 [13,2], T3 [9,6], T4 [13,6].
  - Kho cá thể: mảng {id, kind, fresh}.
  - Hao tươi: kho giảm 0.25/s (1 đơn vị / tick với thang 240 đơn vị / điểm). Kẹp đáy 0.
  - Ươn: fresh < 30, vẫn chiếm ô, không dùng nấu. Phát spoiled theo id đúng một lần khi vượt ngưỡng.
  - Giữ theo id: lấy cá thể chưa ươn tươi nhất (fresh cao nhất, hòa id nhỏ).
    Nếu phần giữ có cá thể vừa ươn: nhả và thử giữ lại đúng một lần (theo order_tick rồi id bàn).
    Không đủ thì chuyển sang unfulfillable, khách chờ tới hạn.
  - Giá theo tươi: lúc cook_started, chốt base_price = floor(giá niêm yết * trung bình fresh / 100).
    cook_started.data.items là mảng cá thể sắp theo kind rồi id.
  - Phục vụ & Boa: nếu còn >= 50% kiên nhẫn lúc giao, boa = floor(base_price * 0.2). Thu boa dương: uy tín +0.2.
  - Đóng ca: khách ăn trả ngay (paid, closing), khách chờ rời không phạt (customer_left, closing). Dọn bếp & tay.
"""

import math

from ..ids import id_key, sort_by_id
from .ramp import ramp_velocity

TICK = 60.0
SCALE = 240  # 240 đơn vị mỗi điểm tươi, 1 đơn vị / tick tương ứng 0.25 điểm / s


class QuanSim:
    mode = "quan"
    phase = "quan"

    def __init__(self, tuning, scenario, streams, ids, inventory=None, day_plan=None):
        t = tuning["quan"]
        self.t = t
        self.menu = tuning["menu"]
        self.rng = streams
        self.ids = ids

        fresh_cfg = tuning.get("freshness", {})
        self.initial_fresh = float(fresh_cfg.get("initial", 100))
        self.quan_decay_per_s = float(fresh_cfg.get("quan_decay_per_s", 0.25))
        self.spoiled_below = float(fresh_cfg.get("spoiled_below", 30))

        # Day plan
        dp = day_plan or scenario.get("day_plan")
        if isinstance(dp, list):
            day_num = scenario.get("day", 1)
            matched = next((d for d in dp if isinstance(d, dict) and d.get("day") == day_num), None)
            self.day_plan = matched if matched else (dp[0] if dp and isinstance(dp[0], dict) else None)
        elif isinstance(dp, dict):
            self.day_plan = dp
        else:
            self.day_plan = None

        p = scenario.get("player", {})
        self.pos = [float(c) for c in p.get("pos", t["start_pos"])]
        self.vel = [float(c) for c in p.get("vel", [0.0, 0.0])]
        self._tgt = None
        self._ramp_left = 0

        # Kho cá thể (stock)
        raw_stock = inventory if inventory is not None else scenario.get("stock", [])
        self.stock = []
        if isinstance(raw_stock, list):
            for it in raw_stock:
                f_val = float(it.get("fresh", self.initial_fresh))
                units = round(f_val * SCALE)
                self.stock.append({
                    "id": it["id"],
                    "kind": it["kind"],
                    "fresh": f_val,
                    "units": units,
                    "spoiled_emitted": (f_val < self.spoiled_below),
                })
        elif isinstance(raw_stock, dict):
            idx = 1
            for k in sorted(raw_stock.keys()):
                count = raw_stock[k]
                for _ in range(count):
                    self.stock.append({
                        "id": f"I{idx}",
                        "kind": k,
                        "fresh": 100.0,
                        "units": 100 * SCALE,
                        "spoiled_emitted": False,
                    })
                    idx += 1

        self.money = 0
        self.earned = 0
        h = scenario.get("hand")
        if h:
            d_id = h["dish_id"] if isinstance(h, dict) else h
            price = h.get("base_price", self.menu[d_id]["price"]) if isinstance(h, dict) else self.menu[d_id]["price"]
            self.hand = {"order_id": h.get("order_id", "c0") if isinstance(h, dict) else "c0",
                         "dish_id": d_id, "base_price": price}
        else:
            self.hand = None

        self.time_left_ticks = scenario.get("time_left_ticks", int(round(t["duration_s"] * TICK)))
        self.phase_tick = 0
        self.random_customers = scenario.get("random_customers", True)
        self.reputation = float(scenario.get("reputation", t["reputation_initial"]))

        # Bếp
        self.stoves = []
        for s in self._merge(t["stoves"], scenario.get("stoves", [])):
            st = dict(s)
            st.setdefault("state", "idle")
            st.setdefault("dish", None)
            st.setdefault("cook_ticks_left", 0)
            st.setdefault("ready_ticks", 0)
            if st["state"] == "cooking" and st["dish"] and not st["cook_ticks_left"]:
                d_id = st["dish"]["dish_id"] if isinstance(st["dish"], dict) else st["dish"]
                st["cook_ticks_left"] = int(round(self.menu[d_id]["cook_s"] * TICK))
            if st["dish"] and not isinstance(st["dish"], dict):
                d_id = st["dish"]
                st["dish"] = {"order_id": "c0", "dish_id": d_id, "base_price": self.menu[d_id]["price"]}
            self.stoves.append(st)
        self.stoves = sort_by_id(self.stoves)

        # Bàn
        self.tables = self._merge(t["tables"], scenario.get("tables", []))

        # Khách
        self.customers = []
        unassigned_res = []
        for c in scenario.get("customers", []):
            cust = dict(c)
            self.ids.reserve(cust["id"])
            cust.setdefault("state", "waiting")
            cust.setdefault("order_tick", 0)
            cust.setdefault("order_status", "reserved" if cust["state"] == "waiting" else "served")
            cust.setdefault("patience_ticks_left", int(round(t["patience_s"] * TICK)))
            cust.setdefault("eat_ticks_left", int(round(t["eat_s"] * TICK)))
            if "reserved" in cust:
                res = cust["reserved"]
                if isinstance(res, dict):
                    # Convert dict reserved to list of ids matching recipe
                    chosen = self._find_best_fresh_items_for_dish(cust["dish_id"])
                    cust["reserved"] = [it["id"] for it in chosen] if chosen else []
            else:
                if cust["state"] == "waiting" and cust["order_status"] == "reserved":
                    unassigned_res.append(cust)
                else:
                    cust["reserved"] = []
            self.customers.append(cust)

        # Cấp reserved cho các đơn chưa có reserved: theo order_tick rồi id bàn
        unassigned_res.sort(key=lambda c: (c.get("order_tick", 0), id_key(c.get("table_id", ""))))
        for c in unassigned_res:
            chosen = self._find_best_fresh_items_for_dish(c["dish_id"])
            if chosen is not None:
                c["reserved"] = [it["id"] for it in chosen]
            else:
                c["reserved"] = []
                c["order_status"] = "unfulfillable"

        self.done = False
        self.reason = None

    def _merge(self, defaults, custom):
        by_id = {e["id"]: dict(e) for e in defaults}
        for e in custom:
            by_id.setdefault(e["id"], {}).update(e)
        return sort_by_id(list(by_id.values()))

    def _find_best_fresh_items_for_dish(self, dish_id: str, exclude_reserved=True):
        recipe = self.menu[dish_id]["recipe"]
        reserved_ids = set()
        if exclude_reserved:
            for c in self.customers:
                res = c.get("reserved", [])
                if isinstance(res, list):
                    reserved_ids.update(res)

        chosen_items = []
        for kind, req_count in sorted(recipe.items()):
            candidates = [
                it for it in self.stock
                if it["kind"] == kind and it["units"] >= 30 * SCALE and it["id"] not in reserved_ids and it not in chosen_items
            ]
            # Sắp xếp: tươi nhất trước (-units), hòa theo id nhỏ (id_key(id))
            candidates.sort(key=lambda it: (-it["units"], id_key(it["id"])))
            if len(candidates) < req_count:
                return None
            chosen_items.extend(candidates[:req_count])
        return chosen_items

    def step(self, inp):
        if self.done:
            return []

        events = []

        # 1. Đồng hồ và timer
        self.time_left_ticks -= 1
        self.phase_tick += 1

        for s in self.stoves:
            if s["state"] == "cooking":
                s["cook_ticks_left"] -= 1
            elif s["state"] == "ready":
                s["ready_ticks"] += 1

        for c in self.customers:
            if c["state"] == "waiting":
                c["patience_ticks_left"] -= 1
            elif c["state"] == "eating":
                c["eat_ticks_left"] -= 1

        # 2. Hao tươi kho thô, phát hết spoiled theo id rồi mới xử lý giữ chỗ bị ươn
        spoiled_now = []
        for it in self.stock:
            prev_units = it["units"]
            if prev_units > 0:
                it["units"] = max(0, prev_units - 1)
                it["fresh"] = it["units"] / float(SCALE)
            if prev_units >= 30 * SCALE and it["units"] < 30 * SCALE:
                if not it.get("spoiled_emitted"):
                    it["spoiled_emitted"] = True
                    spoiled_now.append(it)

        # Phát hết spoiled theo id
        if spoiled_now:
            spoiled_now = sort_by_id(spoiled_now)
            for it in spoiled_now:
                events.append((
                    "spoiled",
                    {
                        "item_id": it["id"],
                        "kind": it["kind"],
                        "location": "stock"
                    }
                ))

        # Xử lý giữ chỗ bị ươn: nhả và thử giữ lại đúng 1 lần theo order_tick rồi id bàn
        spoiled_ids = {it["id"] for it in self.stock if it["units"] < 30 * SCALE}
        affected_custs = [
            c for c in self.customers
            if c["state"] == "waiting" and c.get("order_status") == "reserved" and any(i in spoiled_ids for i in c.get("reserved", []))
        ]
        affected_custs.sort(key=lambda c: (c.get("order_tick", 0), id_key(c.get("table_id", ""))))
        for c in affected_custs:
            c["reserved"] = []
            new_res = self._find_best_fresh_items_for_dish(c["dish_id"])
            if new_res is not None:
                c["reserved"] = [it["id"] for it in new_res]
            else:
                c["reserved"] = []
                c["order_status"] = "unfulfillable"

        # 3. Xét món chín/cháy theo id bếp
        sorted_stoves = sort_by_id(self.stoves)
        for s in sorted_stoves:
            if s["state"] == "cooking" and s["cook_ticks_left"] <= 0:
                s["state"] = "ready"
                s["ready_ticks"] = 0
                events.append((
                    "dish_ready",
                    {
                        "stove_id": s["id"],
                        "order_id": s["dish"]["order_id"],
                        "dish_id": s["dish"]["dish_id"],
                    }
                ))
            elif s["state"] == "ready" and self.t.get("burn_s") is not None:
                burn_limit = int(round(self.t["burn_s"] * TICK))
                if s["ready_ticks"] > burn_limit:
                    burnt_dish = s["dish"]
                    s["state"] = "idle"
                    s["dish"] = None
                    s["ready_ticks"] = 0
                    events.append((
                        "dish_burnt",
                        {
                            "stove_id": s["id"],
                            "order_id": burnt_dish["order_id"],
                            "dish_id": burnt_dish["dish_id"],
                        }
                    ))
                    cust = next((c for c in self.customers if c["id"] == burnt_dish["order_id"]), None)
                    if cust and cust["state"] == "waiting":
                        new_res = self._find_best_fresh_items_for_dish(cust["dish_id"])
                        if new_res is not None:
                            cust["order_status"] = "reserved"
                            cust["reserved"] = [it["id"] for it in new_res]
                        else:
                            cust["order_status"] = "unfulfillable"

        # 4. Di chuyển và tối đa một tương tác
        self._move(inp)
        if inp.pressed("interact"):
            self._interact(events)

        # 5. Thanh toán, kiên nhẫn / đóng ca
        # Thanh toán cho khách đang ăn xong
        paid_custs = [c for c in self.customers if c["state"] == "eating" and c["eat_ticks_left"] <= 0]
        paid_custs = sort_by_id(paid_custs)
        for c in paid_custs:
            tot = c["base_price"] + c["tip"]
            self.money += tot
            self.earned += tot
            events.append((
                "paid",
                {
                    "order_id": c["id"],
                    "table_id": c["table_id"],
                    "dish_id": c["dish_id"],
                    "base_price": c["base_price"],
                    "amount": tot,
                    "tip": c["tip"],
                    "reason": "served",
                }
            ))
            self.customers.remove(c)

        # Khách hết kiên nhẫn
        left_custs = [c for c in self.customers if c["state"] == "waiting" and c["patience_ticks_left"] <= 0
                      and self.time_left_ticks > 0]
        left_custs = sort_by_id(left_custs)
        for c in left_custs:
            self.reputation = max(float(self.t["reputation_min"]), self.reputation + float(self.t["left_reputation_delta"]))
            self._discard_order_dish(c["id"])
            events.append((
                "customer_left",
                {
                    "customer_id": c["id"],
                    "table_id": c["table_id"],
                    "order_id": c["id"],
                    "dish_id": c.get("dish_id"),
                    "reason": "patience",
                }
            ))
            self.customers.remove(c)

        # Đóng ca nếu hết giờ
        if self.time_left_ticks <= 0:
            for c in sort_by_id([c for c in self.customers if c["state"] == "eating"]):
                tot = c["base_price"] + c["tip"]
                self.money += tot
                self.earned += tot
                events.append((
                    "paid",
                    {
                        "order_id": c["id"],
                        "table_id": c["table_id"],
                        "dish_id": c["dish_id"],
                        "base_price": c["base_price"],
                        "amount": tot,
                        "tip": c["tip"],
                        "reason": "closing",
                    }
                ))
            for c in sort_by_id([c for c in self.customers if c["state"] == "waiting"]):
                c["reserved"] = []
                events.append((
                    "customer_left",
                    {
                        "customer_id": c["id"],
                        "table_id": c["table_id"],
                        "order_id": c["id"],
                        "dish_id": c.get("dish_id"),
                        "reason": "closing",
                    }
                ))
            for s in self.stoves:
                s["state"] = "idle"
                s["dish"] = None
                s["cook_ticks_left"] = 0
                s["ready_ticks"] = 0
            self.hand = None
            self.customers = []
            self.done = True
            self.reason = "time"
            events.append(("quan_end", {"reason": "time"}))
            return events

        # 6. Khách mới đến nếu còn giờ
        if self.random_customers:
            self._check_new_customer(events)

        return events

    def _discard_order_dish(self, order_id):
        if self.hand and self.hand["order_id"] == order_id:
            self.hand = None
        for stove in self.stoves:
            if stove["dish"] and stove["dish"]["order_id"] == order_id:
                stove.update(state="idle", dish=None, cook_ticks_left=0, ready_ticks=0)

    def _interact(self, events):
        radius = self.t["interact_radius"]
        candidates = []

        # Xét bếp
        for s in self.stoves:
            d = math.dist(self.pos, s["pos"])
            if d <= radius:
                has_reserved = any(c.get("order_status") == "reserved" for c in self.customers)
                if s["state"] == "idle" and has_reserved:
                    candidates.append((d, 0, id_key(s["id"]), "stove", s))
                elif s["state"] == "ready" and self.hand is None:
                    candidates.append((d, 0, id_key(s["id"]), "stove", s))

        # Xét bàn
        for tb in self.tables:
            d = math.dist(self.pos, tb["pos"])
            if d <= radius and self.hand is not None:
                cust = next(
                    (c for c in self.customers if c["table_id"] == tb["id"] and c["state"] == "waiting"),
                    None,
                )
                if cust and cust["id"] == self.hand["order_id"]:
                    candidates.append((d, 1, id_key(tb["id"]), "table", tb, cust))

        if not candidates:
            return

        candidates.sort(key=lambda c: (c[0], c[1], c[2]))
        chosen = candidates[0]

        if chosen[3] == "stove":
            s = chosen[4]
            if s["state"] == "idle":
                # Nhận đơn reserved cũ nhất theo order_tick rồi id bàn
                res_custs = [c for c in self.customers if c.get("order_status") == "reserved"]
                res_custs.sort(key=lambda c: (c.get("order_tick", 0), id_key(c.get("table_id", "")), id_key(c["id"])))
                target_cust = res_custs[0]

                d_id = target_cust["dish_id"]
                # Tiêu đúng các id đang giữ
                res_ids = set(target_cust.get("reserved", []))
                used_items = [it for it in self.stock if it["id"] in res_ids]
                # Xóa khỏi stock
                self.stock = [it for it in self.stock if it["id"] not in res_ids]

                # Chốt base_price = floor(giá niêm yết * trung bình fresh của các cá thể dùng / 100)
                listed_price = self.menu[d_id]["price"]
                if used_items:
                    avg_fresh = sum(it["fresh"] for it in used_items) / len(used_items)
                else:
                    avg_fresh = 100.0
                base_price = math.floor(listed_price * avg_fresh / 100.0)

                cook_ticks = int(round(self.menu[d_id]["cook_s"] * TICK))
                s["state"] = "cooking"
                s["dish"] = {
                    "order_id": target_cust["id"],
                    "dish_id": d_id,
                    "base_price": base_price,
                }
                s["cook_ticks_left"] = cook_ticks
                s["ready_ticks"] = 0
                target_cust["order_status"] = "assigned"
                target_cust["reserved"] = []
                target_cust["base_price"] = base_price

                # cook_started.data.items là mảng cá thể sắp theo kind rồi id
                sorted_items = sorted(used_items, key=lambda it: (it["kind"], id_key(it["id"])))
                events.append((
                    "cook_started",
                    {
                        "stove_id": s["id"],
                        "order_id": target_cust["id"],
                        "dish_id": d_id,
                        "base_price": base_price,
                        "items": [
                            {"id": it["id"], "kind": it["kind"], "fresh": round(it["fresh"], 4)}
                            for it in sorted_items
                        ],
                    }
                ))

            elif s["state"] == "ready":
                self.hand = dict(s["dish"])
                s["state"] = "idle"
                s["dish"] = None
                s["ready_ticks"] = 0
                events.append((
                    "dish_picked",
                    {
                        "stove_id": s["id"],
                        "order_id": self.hand["order_id"],
                        "dish_id": self.hand["dish_id"],
                    }
                ))

        elif chosen[3] == "table":
            tb, cust = chosen[4], chosen[5]
            patience_left = cust["patience_ticks_left"]
            max_pat = int(round(self.t["patience_s"] * TICK))
            ratio = patience_left / max_pat
            base_price = self.hand["base_price"]
            if ratio >= self.t.get("tip_min_patience_ratio", 0.5):
                tip = math.floor(base_price * self.t.get("tip_rate", 0.2))
                if tip > 0:
                    self.reputation = min(float(self.t["reputation_max"]), self.reputation + float(self.t["tip_reputation"]))
            else:
                tip = 0

            cust["state"] = "eating"
            cust["order_status"] = "served"
            cust["eat_ticks_left"] = int(round(self.t["eat_s"] * TICK))
            cust["base_price"] = base_price
            cust["tip"] = tip
            events.append((
                "served",
                {
                    "order_id": cust["id"],
                    "table_id": tb["id"],
                    "dish_id": self.hand["dish_id"],
                    "tip": tip,
                }
            ))
            self.hand = None

    def _check_new_customer(self, events):
        first = self.t["first_customer_tick"]
        interval = int(round(self.t["customer_interval_s"] * TICK))
        if self.phase_tick < first or (self.phase_tick - first) % interval != 0:
            return

        occupied_tables = {c["table_id"] for c in self.customers}
        empty_tables = [t for t in self.tables if t["id"] not in occupied_tables]
        if not empty_tables:
            return
        empty_tables = sort_by_id(empty_tables)
        chosen_table = empty_tables[0]

        # Lọc danh sách món: nếu có day_plan thì chỉ chọn từ món trong kế hoạch
        if self.day_plan and "dishes" in self.day_plan:
            pool = [d for d in sorted(self.day_plan["dishes"].keys()) if d in self.menu]
        else:
            pool = sorted(self.menu.keys())

        eligible = []
        for d_id in pool:
            chosen = self._find_best_fresh_items_for_dish(d_id)
            if chosen is not None:
                eligible.append(d_id)

        if not eligible:
            events.append(("no_dish", {}))
            return

        chosen_dish = self.rng.get("customer").choice(eligible)
        chosen_items = self._find_best_fresh_items_for_dish(chosen_dish)
        cust_id = self.ids.new("C")
        new_cust = {
            "id": cust_id,
            "table_id": chosen_table["id"],
            "dish_id": chosen_dish,
            "state": "waiting",
            "order_status": "reserved",
            "reserved": [it["id"] for it in chosen_items],
            "patience_ticks_left": int(round(self.t["patience_s"] * TICK)),
            "eat_ticks_left": int(round(self.t["eat_s"] * TICK)),
            "order_tick": self.phase_tick,
        }
        self.customers.append(new_cust)
        events.append((
            "customer_arrived",
            {
                "customer_id": cust_id,
                "table_id": chosen_table["id"],
                "dish_id": chosen_dish,
            }
        ))

    def _move(self, inp):
        target = [c * self.t["walk_speed"] for c in inp.move]
        self.vel = ramp_velocity(self, target, self.t["ramp_max_ticks"])
        self.pos[0] += self.vel[0] / TICK
        self.pos[1] += self.vel[1] / TICK

        bounds = self.t["bounds"]
        self.pos[0] = max(bounds["x"][0], min(bounds["x"][1], self.pos[0]))
        self.pos[1] = max(bounds["z"][0], min(bounds["z"][1], self.pos[1]))

    def snapshot(self) -> dict:
        occupied = {customer["table_id"]: customer["id"] for customer in self.customers}
        return {
            "player": {"pos": self.pos, "vel": self.vel},
            "hand": self.hand,
            "stoves": self.stoves,
            "tables": [{**table, "customer_id": occupied.get(table["id"])} for table in self.tables],
            "customers": self.customers,
            "stock": [
                {"id": it["id"], "kind": it["kind"], "fresh": round(it["fresh"], 4)}
                for it in self.stock
            ],
        }
