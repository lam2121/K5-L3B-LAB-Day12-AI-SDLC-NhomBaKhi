"""Trang bị lặn cho Hành trình chơi trên trình duyệt."""

import json
import math
from pathlib import Path

from .campaign import CampaignSession
from .ids import sort_by_id


RULES = json.loads((Path(__file__).with_name("data") / "dive_gear.json").read_text(encoding="utf-8"))


class LiveDiveCampaign(CampaignSession):
    def __init__(self, tuning, scenario, seed):
        super().__init__(tuning, scenario, seed, introductions=True)
        self.money = scenario.get("day", {}).get("money", RULES["starting_money"])
        self.launcher = False
        self.ammo = 0

    def _start_day(self):
        super()._start_day()
        self.preparation_purchase = None

    def _offers(self):
        offers = {
            "launcher": {"price": RULES["launcher_price"], "quantity": RULES["launcher_ammo"],
                         "block": "owned" if self.launcher else None},
            "ammo": {"price": RULES["ammo_price"], "quantity": RULES["ammo_pack"],
                     "block": "requires_launcher" if not self.launcher else
                              "ammo_limit" if self.ammo + RULES["ammo_pack"] > RULES["ammo_max"] else None},
        }
        for item, levels in self.tuning["shop"]["upgrades"].items():
            level = self.upgrades[item]
            next_level = levels[level] if level < len(levels) else None
            offers[item] = {**(next_level or {}), "block": None if next_level else "max_level"}
        for offer in offers.values():
            if not offer["block"] and self.money < offer["price"]:
                offer["block"] = "funds"
        return offers

    def snapshot(self):
        state = super().snapshot()
        gear = {"launcher": self.launcher, "ammo": self.ammo, "shot_range": RULES["shot_range"]}
        if self.awaiting == "day_intro":
            gear.update(offers=self._offers(), purchase=self.preparation_purchase)
        state["dive_gear"] = gear
        return state

    def buy_preparation(self, item):
        if self.awaiting != "day_intro" or self.done:
            raise ValueError("Chỉ mua trang bị trước khi ra sông.")
        offer = self._offers().get(item) if isinstance(item, str) else None
        if offer is None:
            raise ValueError("Trang bị không hợp lệ.")
        messages = {"funds": "Chưa đủ tiền.", "owned": "Đã có súng lặn.", "ammo_limit": "Túi đạn đã gần đầy.",
                    "requires_launcher": "Cần mua súng lặn trước.", "max_level": "Trang bị đã đạt cấp tối đa."}
        if offer["block"]:
            raise ValueError(messages[offer["block"]])

        if item in ("launcher", "ammo"):
            if item == "launcher":
                self.launcher = True
            self.ammo += offer["quantity"]
            self.money -= offer["price"]
        else:
            self._buy(item)
            self.active_upgrades[item] = self.upgrades[item]
            if item == "oxygen":
                maximum = int(round(offer["oxygen_max_s"] * self.tuning["tick_hz"]))
                self.sim.oxygen_ticks += maximum - self.sim.oxygen_max
                self.sim.oxygen_max = maximum
                self.sim.t["oxygen_max_s"] = offer["oxygen_max_s"]
            elif item == "hp":
                self.sim.hp += offer["hp_max"] - self.sim.t["hp_max"]
                self.sim.t["hp_max"] = offer["hp_max"]

        self.preparation_purchase = {"item": item, "price": offer["price"]}

    def step(self, inp):
        if (self.phase == "gather" and not (self.done or self.awaiting or self.paused)
                and inp.pressed("shoot") and not inp.pressed("pause")):
            shot = self._event(*self._shoot())
            shot["tick"] += 1
            return [shot, *super().step(inp)]
        return super().step(inp)

    def _shoot(self):
        sim = self.sim
        if not self.launcher:
            return "dive_shot_failed", {"reason": "no_launcher"}
        if not self.ammo:
            return "dive_shot_failed", {"reason": "no_ammo"}
        if sim.pos[1] <= sim.t["surface_depth"]:
            return "dive_shot_failed", {"reason": "surface"}
        target = min((monster for monster in sort_by_id(sim.monsters) if monster["kind"] == "ca_sau"),
                     key=lambda monster: math.dist(sim.pos, monster["pos"]), default=None)
        if target is None or math.dist(sim.pos, target["pos"]) > RULES["shot_range"]:
            return "dive_shot_failed", {"reason": "no_target"}

        sim.monsters.remove(target)
        self.ammo -= 1
        reward = RULES["crocodile_reward"]
        self.money += reward
        return "crocodile_defeated", {"monster_id": target["id"], "from": list(sim.pos), "to": list(target["pos"]),
                                      "reward": reward}
