import json
import unittest

from chonoi.contract import load_contract
from chonoi.inputs import InputState
from chonoi.live import LiveGame
from chonoi.live_dive import LiveDiveCampaign, RULES


class LiveDiveTest(unittest.TestCase):
    def test_buy_then_shoot_removes_one_crocodile_and_awards_money(self):
        contract = load_contract()
        gather = {"player": {"pos": [51, 12]}, "monsters": [
            {"id": "M1", "kind": "ca_sau", "pos": [58, 12], "waypoints": [[58, 12], [63, 12]]},
            {"id": "M2", "kind": "ca_sau", "pos": [80, 12], "waypoints": [[80, 12], [85, 12]]},
        ]}
        game = LiveGame("gather", contract["tuning"], gather, 42, contract=contract)
        self.assertNotIn("dive_gear", json.loads(game.state_json()))
        game.play("campaign")
        with self.assertRaises(ValueError):
            game.set_input({"prepare": "ammo"})
        game.set_input({"prepare": "launcher"})
        with self.assertRaises(ValueError):
            game.set_input({"prepare": "launcher"})
        game.continue_day("day_intro")
        with self.assertRaises(ValueError):
            game.set_input({"prepare": "ammo"})

        game.set_input({"shoot": True})
        game._tick_once()
        game._tick_once()
        state = json.loads(game.state_json())
        self.assertEqual([m["id"] for m in state["monsters"]], ["M2"])
        self.assertEqual(state["dive_gear"]["ammo"], RULES["launcher_ammo"] - 1)
        self.assertEqual(state["money"], RULES["starting_money"] - RULES["launcher_price"] + RULES["crocodile_reward"])
        self.assertEqual([e["name"] for e in state["events"]].count("crocodile_defeated"), 1)

        game.set_input({"shoot": False})
        game.set_input({"shoot": True})
        game._tick_once()
        state_after_miss = json.loads(game.state_json())
        self.assertEqual(state_after_miss["events"][-1]["data"]["reason"], "no_target")
        self.assertEqual(state_after_miss["dive_gear"]["ammo"], state["dive_gear"]["ammo"])
        self.assertEqual(state_after_miss["money"], state["money"])

    def test_upgrades_apply_before_diving_and_sales_fund_the_next_day(self):
        tuning = load_contract()["tuning"]
        fixture = {
            "day": {"money": 700},
            "gather": {"time_left_ticks": 1},
            "quan": {"time_left_ticks": 1, "random_customers": False, "customers": [
                {"id": "C1", "table_id": "T1", "dish_id": "ca_loc_nuong_trui", "state": "eating",
                 "eat_ticks_left": 1, "base_price": 80, "tip": 5},
            ]},
        }
        campaign = LiveDiveCampaign(tuning, fixture, 42)
        campaign.buy_preparation("launcher")
        campaign.buy_preparation("oxygen")
        campaign.buy_preparation("hp")
        campaign.buy_preparation("ammo")
        campaign.buy_preparation("ammo")
        with self.assertRaises(ValueError):
            campaign.buy_preparation("ammo")
        before = campaign.snapshot()
        self.assertEqual(before["dive_gear"]["ammo"], RULES["ammo_max"])
        self.assertEqual(before["player"]["oxygen_max_ticks"], 45 * tuning["tick_hz"])
        self.assertEqual(before["player"]["hp_max"], 4)
        self.assertEqual(before["active_upgrades"], {"oxygen": 1, "hp": 1})

        campaign.proceed("day_intro")
        campaign.step(InputState((0, 0), {}, set()))
        campaign.proceed("evening_intro")
        sales = campaign.step(InputState((0, 0), {}, set()))
        payment = next(event["data"] for event in sales if event["name"] == "paid")
        campaign.proceed("day_result")
        campaign.step(InputState((0, 0), {}, {"shop_done"}))
        state = campaign.snapshot()
        self.assertEqual(state["day"], 2)
        self.assertEqual(state["awaiting"], "day_intro")
        self.assertEqual(state["money"], before["money"] + payment["base_price"] + payment["tip"])
        self.assertEqual(state["dive_gear"]["ammo"], before["dive_gear"]["ammo"])
        self.assertEqual(state["player"]["hp_max"], 4)
