import { liveAdapter } from "./adapter.js";
import { createRenderer, findAction } from "./scenes.js";
import { CampaignInput, createCampaignView, hasRecipe, plannedDishes, upgradeName } from "./campaign.js";
import { availableCounts, countKinds, freshnessTone, groupedInventory, inventoryHasItems,
  itemKind, receivedInventory, reservedIdSet, uiConfig } from "./inventory-view.js";

const $ = (id) => document.getElementById(id);
const pageOptions = new URLSearchParams(location.search);
const previewVersion = pageOptions.get("preview");
const benchSignal = pageOptions.get("benchmark") === "1" && typeof window.chonoiBenchFrame === "function"
  ? window.chonoiBenchFrame : null;
const preview = previewVersion === "1";
const previewCampaign = ["2", "3"].includes(previewVersion);
const mockVersion = previewVersion === "2" ? "2" : "3";
const baseAdapter = preview ? new (await import("./preview.js")).PreviewAdapter() : liveAdapter;
let adapter = baseAdapter;
const controls = [...document.querySelectorAll("button:not(#dive-fire)")];
const number = new Intl.NumberFormat("vi-VN");
const decimal = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });
const freshnessNumber = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2, roundingMode: "trunc" });
const ingredients = {
  ca_loc: ["Cá lóc", "#a4be7a"],
  ca_linh: ["Cá linh", "#c6e6de"],
  ca_keo: ["Cá kèo", "#acb3d2"],
  bong_dien_dien: ["Bông điên điển", "#f2c16b"],
  bong_sung: ["Bông súng", "#ee9aa7"],
  keo_neo: ["Kèo nèo", "#99cc85"],
};
const dishNames = {
  ca_loc_nuong_trui: "Cá lóc nướng trui",
  goi_bong_sung: "Gỏi bông súng",
  lau_ca_linh_dien_dien: "Lẩu cá linh bông điên điển",
  ca_keo_kho_to: "Cá kèo kho tộ",
  canh_chua_ca_keo: "Canh chua cá kèo",
  keo_neo_xao_ca_linh: "Kèo nèo xào cá linh",
  canh_chua_ca_loc: "Canh chua cá lóc",
  ca_keo_nuong: "Cá kèo nướng",
  lau_mam: "Lẩu mắm",
};
const movement = {
  KeyW: "north", ArrowUp: "north", KeyS: "south", ArrowDown: "south",
  KeyA: "west", ArrowLeft: "west", KeyD: "east", ArrowRight: "east",
};
const actionKeys = { KeyE: "interact", Space: "catch" };
const down = new Set();
const memo = new Map();
const money = (amount) => number.format(amount) + "k";
const ingredient = (kind) => ingredients[kind]?.[0] ?? kind;
const dishName = (id) => dishNames[id] ?? id;
const percent = (part, total) => Math.min(100, Math.max(0, (100 * part / total) || 0));

let tuning;
let baseTuning;
let liveCampaign = false;
let liveV12 = false;
let campaign = false;
let mockAdapter;
let mockTuning;
let phaseGate;
let screen = "menu";
let choice;
let snapshot;
let busy = false;
let revision = 0;
let lastTick = -1;
let sessionId;
let toasts = [];
let damageTimer;
let input = Promise.resolve();
const renderer = createRenderer($("cover"), $("world"), benchSignal ? () => benchSignal("frame") : undefined);
if (!benchSignal) {
  const poster = $("river-cover");
  poster.addEventListener("load", () => poster.classList.add("loaded"), { once: true });
  poster.src = new URL("./river-cover.webp", import.meta.url).href;
}
const phaseInput = new CampaignInput(send);
const campaignView = createCampaignView({ $, write, update, element, inventoryList, money, decimal, dishName, time,
  proceed, action: campaignCommand, prepare: prepareGear });

async function loadMock() {
  if (mockTuning) return;
  if (mockVersion === "2") {
    const { MockSimV11Adapter } = await import("./phase2-preview.js");
    mockAdapter = new MockSimV11Adapter();
  } else {
    const { MockSimV12Adapter } = await import("./phase3-preview.js");
    mockAdapter = new MockSimV12Adapter();
  }
  mockTuning = uiConfig(await mockAdapter.config());
}

function tell(message = "") {
  write("notice", message);
  $("notice").hidden = !message;
}

const contrastButtons = [$("contrast-toggle"), $("pause-contrast")];

function setContrast(enabled, save = false) {
  document.documentElement.classList.toggle("high-contrast", enabled);
  renderer.contrast(enabled);
  for (const button of contrastButtons) button.setAttribute("aria-pressed", String(enabled));
  if (save) {
    try { localStorage.setItem("chonoi.highContrast", String(enabled)); } catch { /* dùng cho phiên hiện tại */ }
  }
}

try { setContrast(localStorage.getItem("chonoi.highContrast") === "true"); } catch { setContrast(false); }
for (const button of contrastButtons) {
  button.addEventListener("click", () => setContrast(button.getAttribute("aria-pressed") !== "true", true));
}

function write(id, value) {
  const target = $(id);
  const label = String(value);
  if (target.textContent !== label) target.textContent = label;
}

function element(tag, text = "", className = "") {
  const node = document.createElement(tag);
  node.textContent = text;
  node.className = className;
  return node;
}

function update(id, value, draw) {
  const signature = JSON.stringify(value);
  if (memo.get(id) === signature) return;
  memo.set(id, signature);
  draw($(id));
}

function ticks(seconds) {
  return Math.round(seconds * tuning.tick_hz);
}

function seconds(count) {
  return Math.ceil(count / tuning.tick_hz);
}

function time(count) {
  const left = seconds(count);
  return String(Math.floor(left / 60)).padStart(2, "0") + ":" + String(left % 60).padStart(2, "0");
}

function meter(id, fill, alert = false) {
  const bar = $(id);
  bar.style.width = fill + "%";
  bar.parentElement.classList.toggle("alert", alert);
}

function itemMark(kind) {
  const mark = element("i", "", "ingredient-marker");
  mark.style.setProperty("--ingredient", ingredients[kind]?.[1] ?? "#bfd1be");
  mark.setAttribute("aria-hidden", "true");
  return mark;
}

function itemList(id, counts) {
  update(id, ["counts", counts], (list) => {
    list.classList.remove("fresh-inventory");
    const rows = Object.entries(counts).map(([kind, count]) => {
      const title = element("dt");
      title.append(itemMark(kind), ingredient(kind));
      const row = element("div", "", count === 0 ? "empty" : "");
      row.append(title, element("dd", typeof count === "number" ? number.format(count) : count));
      return row;
    });
    list.replaceChildren(...rows);
  });
}

function inventoryList(id, stock, { reserved, allKinds = false, average = false } = {}) {
  if (!Array.isArray(stock)) {
    itemList(id, stock ?? {});
    return;
  }
  const groups = groupedInventory(stock, reserved ?? new Set(), tuning.freshness);
  const rows = Object.entries(allKinds ? { ...emptyCounts(), ...groups } : groups);
  update(id, ["items", rows, Boolean(reserved), average], (list) => {
    list.classList.add("fresh-inventory");
    list.dataset.held = Boolean(reserved);
    const guide = element("div", "", "fresh-guide");
    const labels = element("dd");
    labels.append(element("span", "Tươi"));
    if (reserved) labels.append(element("span", "Giữ"));
    labels.append(element("span", average ? "TB tươi" : "Thấp nhất"), element("span", "Ươn"));
    guide.append(element("dt", "Nguyên liệu"), labels);
    list.replaceChildren(guide, ...rows.map(([kind, group]) => {
      const row = element("div", "", "fresh-row");
      const title = element("dt");
      title.append(itemMark(kind), ingredient(kind));
      const values = element("dd");
      const fresh = (average ? group.average : group.min) ?? null;
      values.append(element("span", String(group.count ?? 0), "fresh-qty"));
      if (reserved) values.append(element("span", String(group.held ?? 0), "held-qty"));
      const value = element("span", fresh === null ? "—" : freshnessNumber.format(fresh) + "%",
        "fresh-value " + (fresh === null ? "" : freshnessTone({ fresh }, tuning.freshness)));
      if (fresh !== null) value.title = (average ? "Trung bình hàng còn tươi" : "Thấp nhất trong hàng còn tươi") + " · " + fresh + "%";
      const spoiled = element("span", group.spoiled ? "Ươn ×" + group.spoiled : "—", group.spoiled ? "spoiled-badge" : "");
      spoiled.title = group.spoiled ? "Hàng ươn vẫn chiếm ô và không dùng để nấu" : "Không có hàng ươn";
      values.append(value, spoiled);
      row.append(title, values);
      return row;
    }));
  });
}

function listedDish(dish) {
  const name = dishName(dish.dish_id);
  return typeof dish.base_price === "number" ? name + " · " + money(dish.base_price) : name;
}

function show(next) {
  const changed = screen !== next;
  if (screen === "game" && changed) down.clear();
  screen = next;
  for (const page of ["menu", "game", "result", "journey", "exit-screen"]) $(page).hidden = page !== next;
  const playing = next === "game" || (next === "journey" && $("journey").dataset.screen === "shop");
  $("pause").hidden = !campaign || !playing;
  $("to-menu").hidden = !playing;
  $("restart").hidden = campaign || next !== "game";
  if (changed) {
    const focus = { menu: "menu-title", game: "world", result: "result-title", journey: "journey-title", "exit-screen": "exit-title" };
    if (next === "result") $("result-reason").after($("toasts"));
    if (next === "game") $("prompt").before($("toasts"));
    if (next === "journey") $("journey-toast-anchor").after($("toasts"));
    $(focus[next]).focus({ preventScroll: true });
  }
}

function emptyCounts() {
  const kinds = tuning.ingredients ?? [...new Set(Object.values(tuning.menu).flatMap((dish) => Object.keys(dish.recipe)))];
  return Object.fromEntries(kinds.map((kind) => [kind, 0]));
}

function drawGather(state) {
  const p = state.player;
  const config = state.meta;
  const oxy = percent(p.oxygen_ticks, p.oxygen_max_ticks);
  const empty = p.oxygen_ticks === 0 && !p.at_surface;
  const low = p.oxygen_max_ticks > 0 && oxy < 25;
  write("world-label", (p.at_surface ? "Mặt nước" : "Độ sâu") + " · " + decimal.format(p.pos[1]) + " m");
  write("oxygen-value", seconds(p.oxygen_ticks) + " giây");
  meter("oxygen-bar", oxy, low);
  write("health", campaign ? "♥ " + p.hp + " / " + p.hp_max : "♥".repeat(p.hp) + "♡".repeat(p.hp_max - p.hp));
  $("health").setAttribute("aria-label", p.hp + "/" + p.hp_max + " máu");
  $("oxygen-alert").hidden = !low;
  if (empty) {
    const remaining = config.choke_interval_ticks - p.zero_oxy_ticks % config.choke_interval_ticks;
    const countdown = Math.ceil(remaining * 10 / tuning.tick_hz) / 10;
    write("oxygen-alert-text", "Hết hơi! Ngoi lên thở cái Út ơi! Còn " + decimal.format(countdown) + " giây trước lần mất máu kế.");
  } else if (low) {
    write("oxygen-alert-text", p.at_surface ? "Oxy thấp. Ở trên mặt nước thêm chút nghen." : "Oxy thấp! Ngoi lên thở nghen Út.");
  }

  const hold = state.hold ?? [];
  const capacity = state.hold_capacity;
  const itemized = typeof hold[0] === "object" || (hold.length === 0 && Boolean(tuning.freshness));
  write("bag-capacity", state.hold_count + " / " + capacity);
  $("bag-freshness-note").hidden = !itemized;
  update("slots", [hold, capacity], (slots) => {
    slots.replaceChildren(...Array.from({ length: capacity }, (_, i) => {
      const item = hold[i];
      const kind = itemKind(item);
      const cell = element("li", "", kind ? "filled" : "");
      cell.setAttribute("aria-label", kind ? ingredient(kind) : "Ô trống");
      if (kind) {
        cell.title = ingredient(kind);
        if (itemized) {
          const tone = freshnessTone(item, tuning.freshness);
          cell.dataset.freshness = tone;
          cell.style.setProperty("--fresh-fill", Math.max(0, Math.min(100, item.fresh)) + "%");
          cell.title += " · " + freshnessNumber.format(item.fresh) + "%" + (tone === "spoiled" ? " · Ươn" : "");
          cell.setAttribute("aria-label", cell.title);
        }
        cell.append(itemMark(kind));
      }
      return cell;
    }));
  });
  const counts = itemized ? availableCounts({ stock: hold }, tuning.freshness) : countKinds(hold);
  inventoryList("bag-items", itemized ? hold : { ...emptyCounts(), ...counts }, { allKinds: true });
  const goal = campaign && snapshot.mode === "day" ? snapshot.day_plan?.ingredients : null;
  $("harvest-plan").hidden = !goal;
  write("harvest-progress-label", itemized ? "Tươi / cần" : "Đã lấy / cần");
  if (goal) itemList("goal-items", Object.fromEntries(Object.entries(goal).map(([kind, amount]) => [kind, (counts[kind] ?? 0) + " / " + amount])));
  const crocodile = config.monsters?.species?.ca_sau;
  const alertRadius = config.monster_alert_radius ?? crocodile?.detect_radius;
  const dangerDepth = config.danger_depth ?? crocodile?.depths?.[0];
  const danger = (state.monsters ?? []).some((monster) => monster.state === "chase" ||
    (p.pos[1] >= dangerDepth && Math.hypot(monster.pos[0] - p.pos[0], monster.pos[1] - p.pos[1]) <= alertRadius));
  $("monster-alert").hidden = !danger;
  $("stage").classList.toggle("monster-near", danger);

  const cooldown = ticks(config.catch_cooldown_s);
  meter("catch-bar", cooldown ? 100 - percent(p.catch_cd_ticks, cooldown) : 100);
  write("catch-status", p.catch_cd_ticks > 0 ? "Hồi " + decimal.format(p.catch_cd_ticks / tuning.tick_hz) + " giây" : "Sẵn sàng");
  const gear = state.dive_gear;
  $("dive-tool").hidden = !gear;
  if (gear) {
    write("dive-balance", money(state.money));
    write("dive-ammo", gear.launcher ? gear.ammo + " viên đạn" : "Chưa có súng lặn");
    const status = !gear.launcher ? "Mua trước khi ra sông" : gear.ammo === 0 ? "Hết đạn" :
      p.at_surface ? "Lặn xuống để bắn" : "Cá sấu trong tầm " + gear.shot_range + " m";
    write("dive-status", status);
    $("dive-fire").disabled = !gear.launcher || !gear.ammo || p.at_surface;
  }
}

function stationCard(title, status, dishId, timer, { ready = false, price, shortage = false } = {}) {
  const card = element("article", "", "station");
  card.classList.toggle("ready", ready);
  card.classList.toggle("fresh-shortage", shortage);
  const heading = element("div", "", "station-title");
  heading.append(element("strong", title), element("span", status));
  card.append(heading);
  if (dishId) card.append(element("p", listedDish({ dish_id: dishId, base_price: price })));
  if (timer) {
    const caption = element("p", "", "station-timer");
    if (timer.alert) {
      const icon = element("span", "!", "warning-icon");
      icon.setAttribute("aria-hidden", "true");
      caption.classList.add("warning-text");
      caption.append(icon, document.createTextNode(" "));
    }
    caption.append(element("b", timer.alert ? "Khách sắp bỏ đi" : timer.label), document.createTextNode(" · " + seconds(timer.left) + " giây"));
    const track = element("div", "", timer.alert ? "meter alert" : "meter");
    const fill = element("i");
    fill.style.width = timer.fill + "%";
    track.append(fill);
    if (timer.threshold !== undefined) {
      const mark = element("span", "", "threshold");
      mark.style.left = timer.threshold * 100 + "%";
      mark.title = "Mốc kiên nhẫn để nhận boa";
      track.append(mark);
    }
    card.append(caption, track);
  }
  return card;
}

function drawQuan(state) {
  const itemized = Array.isArray(state.stock);
  $("stage").classList.remove("monster-near");
  write("money", money(state.money));
  $("shift-stat").hidden = !campaign;
  if (campaign) write("shift-money", money(state.shift_earned ?? 0));
  write("reputation", decimal.format(state.reputation) + " / " + state.meta.reputation_max.toFixed(1));
  write("score", number.format(state.score));
  write("hand", state.hand ? (itemized ? listedDish(state.hand) : dishName(state.hand.dish_id)) : "Tay trống");

  const counts = { ...emptyCounts(), ...availableCounts(state, tuning.freshness) };
  if (itemized) inventoryList("stock", state.stock, { reserved: reservedIdSet(state), allKinds: true });
  else itemList("stock", counts);
  const dishes = plannedDishes(campaign ? snapshot : state, tuning);
  update("dishes", [counts, dishes, campaign, itemized], (list) => {
    const expanded = new Set([...list.querySelectorAll("details[open]")].map((details) => details.dataset.dish));
    list.replaceChildren(...dishes.map((id) => {
      const recipe = tuning.menu[id];
      const available = hasRecipe(counts, recipe.recipe);
      const row = element("li", "", available ? "available" : "");
      const desc = element("div");
      const title = element("strong", dishName(id));
      if (!campaign && !itemized) {
        const details = element("details", "", "recipe-details");
        details.dataset.dish = id;
        details.open = expanded.has(id);
        const summary = element("summary");
        summary.append(title);
        const requires = Object.entries(recipe.recipe).map(([kind, amount]) => amount + " " + ingredient(kind).toLowerCase()).join(" + ");
        details.append(summary, element("small", requires + " · " + money(recipe.price)));
        desc.append(details);
      } else desc.append(title);
      row.append(desc, element("span", available ? "Đủ kho" : "Thiếu kho", "eligibility"));
      return row;
    }));
  });

  update("stations", [state.stoves, state.tables, state.customers, campaign, itemized], (strip) => {
    const stoveLabels = { idle: "Bếp trống", cooking: "Đang nấu", ready: "Món sẵn sàng" };
    const stoves = state.stoves.map((stove) => {
      const dishId = stove.dish?.dish_id;
      const recipe = tuning.menu[dishId];
      const timer = stove.state === "cooking" && recipe ? {
        label: "Còn nấu", left: stove.cook_ticks_left,
        fill: 100 - percent(stove.cook_ticks_left, ticks(recipe.cook_s)),
      } : null;
      return stationCard("Bếp " + stove.id, stoveLabels[stove.state], dishId, timer, {
        ready: campaign && stove.state === "ready", price: itemized ? stove.dish?.base_price : undefined,
      });
    });
    const tables = state.tables.map((table) => {
      const c = state.customers.find((customer) => customer.id === table.customer_id);
      if (!c) return stationCard("Bàn " + table.id, "Bàn trống");
      const eating = c.state === "eating";
      const timer = eating ? {
        label: "Đang ăn", left: c.eat_ticks_left, fill: 100 - percent(c.eat_ticks_left, ticks(state.meta.eat_s)),
      } : {
        label: "Kiên nhẫn", left: c.patience_ticks_left, fill: percent(c.patience_ticks_left, ticks(state.meta.patience_s)),
        threshold: state.meta.tip_min_patience_ratio,
        alert: c.patience_ticks_left < ticks(state.meta.patience_s) / 4,
      };
      const shortage = itemized && c.order_status === "unfulfillable";
      return stationCard("Bàn " + table.id, shortage ? "Hết hàng tươi!" : eating ? "Đã lên món" : "Đang đợi món", c.dish_id, timer, {
        shortage, price: itemized && eating ? c.base_price : undefined,
      });
    });
    strip.replaceChildren(...stoves, ...tables);
  });
}

const gatherReason = {
  docked: "Về bến rồi! Mẻ thu hoạch đã chốt.",
  time: "Hết giờ. Giỏ hiện tại được chốt sang kho.",
  fainted: "Út Sen bị ngất và đánh rơi cả giỏ. Kho chuyển sang buổi tối rỗng.",
};

function endScreen(state) {
  const morning = state.mode === "gather";
  write("result-phase", morning ? "Hết buổi sáng" : "Hết ca tối");
  write("result-title", morning ? "Về lại bến" : choice === "day" ? "Một ngày trọn vẹn" : "Quán đóng cửa");
  write("result-reason", morning ? gatherReason[state.reason] ?? "Buổi sáng đã kết thúc." : "Má Tư chốt sổ ca tối.");
  $("transfer").hidden = !morning;
  $("totals").hidden = morning;
  $("continue").hidden = !morning || choice !== "day";
  if (morning) {
    const end = state.events.findLast((event) => event.name === "gather_end");
    const items = receivedInventory(end?.data) ?? {};
    write("inventory-title", inventoryHasItems(items) ? "Nguyên liệu bàn giao" : "Kho rỗng");
    inventoryList("transfer-items", items, { average: true });
    const saved = state.inventory_saved;
    let status = "Chưa ghi được kho.";
    if (preview) status = "Đã chốt kho mẫu cho ca tối.";
    else if (saved) status = "Đã ghi " + state.inventory_file + ".";
    else if (choice === "day") status += " Chọn Mở quán để thử ghi lại.";
    write("file-status", status);
    $("file-status").classList.toggle("warning", !preview && !saved);
  } else {
    write("end-earned", money(state.earned));
    write("end-reputation", decimal.format(state.reputation));
    write("end-score", number.format(state.score));
    const multiplier = tuning.score.reputation_multiplier;
    write("score-formula", "Điểm = doanh thu + " + multiplier + " × phần nguyên của uy tín (⌊" + decimal.format(state.reputation) + "⌋ = " + Math.floor(state.reputation) + ").");
  }
  show("result");
}

function eventMessage(event) {
  const d = event.data;
  switch (event.name) {
    case "gather": return ["Hái được " + d.amount + " " + ingredient(d.kind).toLowerCase() + "!"];
    case "fish_caught": return ["Bắt được " + d.yield + " " + ingredient(d.kind).toLowerCase() + "!"];
    case "hold_full": return ["Giỏ đầy nhóc rồi! Cần " + d.required + " ô, còn " + d.free + ".", "danger"];
    case "oxygen_empty": return ["Ngoi lên thở cái Út ơi!", "danger"];
    case "choke": return ["Ngạt nước! Còn " + d.hp + " máu.", "danger"];
    case "cook_started": {
      const used = Object.entries(countKinds(d.items ?? [])).map(([kind, count]) => count + " " + ingredient(kind).toLowerCase());
      return ["Bắc bếp nấu " + dishName(d.dish_id).toLowerCase() + (used.length ? " · " + used.join(", ") : " rồi!")];
    }
    case "dish_ready": return ["Bếp chín rồi, bưng lẹ kẻo nguội!"];
    case "served": return ["Đã dọn " + dishName(d.dish_id).toLowerCase() + " cho bàn " + d.table_id + "."];
    case "paid": return ["Tiền món +" + money(d.base_price) + " · Boa +" + money(d.tip), d.tip > 0 ? "tip" : ""];
    case "customer_left": return [d.reason === "closing" ? "Khách rời bàn vì quán đóng cửa." : "Khách đợi lâu quá, về mất rồi!", "danger"];
    case "no_dish": return ["Kho chưa đủ nguyên liệu để lên món.", "danger"];
    case "monster_hit": {
      const lost = (d.lost ?? []).map(itemKind).filter(Boolean).map(ingredient);
      return ["Cá sấu quẫy mạnh!" + (lost.length ? " Rơi lần lượt " + lost.join(" → ") + "." : ""), "danger"];
    }
    case "crocodile_defeated": return ["Đã hạ cá sấu · Thưởng +" + money(d.reward), "tip"];
    case "dive_shot_failed": return [{
      no_launcher: "Chưa có súng lặn.", no_ammo: "Hết đạn lặn.", surface: "Lặn xuống rồi bắn nghen.",
      no_target: "Chưa có cá sấu trong tầm bắn.",
    }[d.reason], "danger"];
    case "faint": {
      const lost = (d.lost ?? []).map(itemKind).filter(Boolean).map(ingredient);
      const reason = ["choke", "oxygen"].includes(d.cause) ? "Út ngất vì hết hơi." : "Út bị cá sấu đánh ngất.";
      return [reason + (lost.length ? " Rơi lần lượt " + lost.join(" → ") + "." : ""), "danger"];
    }
    case "spoiled": {
      const kind = d.kind ?? itemKind(d.item);
      const place = d.location === "hold" ? "giỏ" : "kho quán";
      return ["Ôi không! " + (kind ? ingredient(kind) : "Nguyên liệu") + " trong " + place + " bị ươn rồi!", "danger"];
    }
    case "fish_spawned": return ["Kìa, có đàn " + ingredient(d.kind).toLowerCase() + " mới!"];
    case "bought": return ["Mua " + upgradeName(d.upgrade) + " cấp " + d.level + " rồi. Mai dùng nghen!", "tip"];
    case "buy_failed": return [d.reason === "funds" ? "Chưa đủ tiền mua món này." : "Món này đã đạt cấp tối đa.", "danger"];
    case "day_plan": return ["Má Tư đã lên thực đơn cho ngày " + (event.day ?? d.day) + "."];
    case "paused": return ["Nghỉ tay một chút nghen."];
    case "resumed": return ["Làm tiếp nghen Út!"];
    default: return null;
  }
}

function consumeEvents(state) {
  if (state.session_id !== sessionId || state.tick < lastTick) {
    sessionId = state.session_id;
    lastTick = -1;
    toasts = [];
    $("stage").classList.remove("damage");
  }
  const now = performance.now();
  if (state.state !== "paused") toasts = toasts.filter(({ expires }) => expires > now);
  for (const event of state.events) {
    if (event.tick <= lastTick) continue;
    const message = eventMessage(event);
    if (message) toasts.push({ message, expires: now + 2900 });
    if (event.name === "spoiled" && event.data.location === "hold") {
      const bag = $("bag-panel");
      bag.classList.remove("spoil-alert");
      void bag.offsetWidth;
      bag.classList.add("spoil-alert");
    }
    if (event.name === "choke" || event.name === "monster_hit") {
      clearTimeout(damageTimer);
      $("stage").classList.remove("damage");
      void $("stage").offsetWidth;
      $("stage").classList.add("damage");
      damageTimer = setTimeout(() => $("stage").classList.remove("damage"), 560);
    }
  }
  lastTick = state.tick;
  toasts = toasts.slice(-3);
  update("toasts", toasts, (list) => list.replaceChildren(...toasts.map(({ message }) => element("div", ...message))));
}

function display(state) {
  snapshot = campaign ? { ...state, day: state.day ?? 1, meta: { ...tuning[state.phase], ...state.meta } } : state;
  if (state.error) {
    tell("Mô phỏng gặp lỗi. Nhấn R để thử lại.");
    if (benchSignal) benchSignal("error:" + state.error);
    return;
  }
  const itemized = Boolean(tuning.freshness) || Array.isArray(state.stock) || typeof state.hold?.[0] === "object";
  document.body.classList.toggle("phase-three", itemized);
  const frozen = snapshot.state === "paused";
  document.body.classList.toggle("campaign-paused", frozen);
  renderer.freeze(frozen);
  consumeEvents(snapshot);
  if (campaign) {
    const gate = [snapshot.session_id, snapshot.day, snapshot.phase, snapshot.awaiting, snapshot.state].join("/");
    if (gate !== phaseGate) {
      phaseInput.reset();
      phaseGate = gate;
    }
    phaseInput.enabled = !snapshot.awaiting && !snapshot.finished && snapshot.state !== "finished";
    phaseInput.shootEnabled = Boolean(snapshot.dive_gear);
    if (campaignView.render(snapshot, tuning)) {
      show("journey");
      return;
    }
    state = { ...snapshot, mode: snapshot.phase };
  }
  if (state.finished) {
    if (benchSignal) benchSignal("finished");
    endScreen(state);
    return;
  }
  const morning = state.mode === "gather";
  $("game").dataset.mode = state.mode;
  $("game").dataset.standalone = String(snapshot.mode !== "day");
  write("scene-title", morning ? "Sông Chín Khúc" : "Nhà bè Má Tư");
  const day = campaign && snapshot.mode === "day" ? "Ngày " + snapshot.day + " / " + tuning.day_plan.length + " · " : "";
  write("phase-name", day + (morning ? "Buổi sáng · Lặn và hái" : "Buổi tối · Mở quán"));
  write("time", time(state.time_left_ticks));
  $("time").classList.toggle("time-low", campaign && state.time_left_ticks <= ticks(30));
  if (morning) drawGather(state);
  else drawQuan(state);
  const action = findAction(state);
  $("prompt").hidden = !action;
  if (action) {
    write("prompt-key", action.key);
    write("prompt-text", action.text);
  }
  renderer.state(state, action);
  show("game");
}

function send(frame, valid = () => true) {
  const target = adapter;
  input = input.then(() => valid() ? target.input(frame) : undefined).catch(() => tell("Chưa gửi được phím đến máy chủ."));
}

function move(keys = down) {
  const directions = new Set([...keys].map((key) => movement[key]));
  const y = (campaign ? snapshot.phase : snapshot.mode) === "quan" ? -1 : 1;
  return [Number(directions.has("east")) - Number(directions.has("west")),
    (Number(directions.has("south")) - Number(directions.has("north"))) * y];
}

function clearKeys() {
  if (campaign) {
    phaseInput.reset();
    return;
  }
  if (!down.size) return;
  down.clear();
  send({ move: [0, 0], interact: false, catch: false });
}

async function transition(next, command) {
  if (busy || !tuning) return;
  busy = true;
  revision++;
  for (const control of controls) control.disabled = true;
  clearKeys();
  try {
    await input;
    await command();
    tell();
    if (next === "menu" || next === "exit-screen") show(next);
    else {
      display(await adapter.state());
      if (screen === "game" && snapshot.state !== "paused") $("world").focus({ preventScroll: true });
    }
  } catch (error) {
    if (benchSignal) benchSignal("error:" + error.message);
    tell(error.message);
  } finally {
    busy = false;
    for (const control of controls) control.disabled = false;
  }
}

const begin = (mode) => transition("game", async () => {
  const nextCampaign = mode === "campaign" || previewCampaign;
  const useMock = previewCampaign || (mode === "campaign" && !liveV12);
  if (useMock) await loadMock();
  const target = useMock ? mockAdapter : baseAdapter;
  await target.play(mode === "campaign" && useMock ? "day" : mode);
  adapter = target;
  campaign = nextCampaign;
  tuning = useMock ? mockTuning : baseTuning;
  choice = mode;
  phaseInput.enabled = false;
  phaseInput.reset();
  phaseGate = undefined;
  lastTick = -1;
  sessionId = undefined;
  toasts = [];
  renderer.configure(tuning);
  if (campaign) {
    campaignView.reset();
    phaseInput.start(tuning.tick_hz);
  }
  $("preview-label").hidden = !preview && !useMock;
  write("preview-label", useMock ? "Phase " + mockVersion + " · Snapshot mẫu" : "Đang xem snapshot mẫu");
  $("preview-help").hidden = !preview || campaign;
  $("campaign-help").hidden = !useMock;
});
function leave(next) {
  return transition(next, async () => {
    await adapter.play("menu");
    phaseInput.enabled = false;
    phaseInput.reset();
    campaignView.reset();
    campaign = false;
    renderer.freeze(false);
    document.body.classList.remove("campaign-paused", "phase-three");
    document.body.classList.add("phase-two");
    $("preview-label").hidden = !preview && !previewCampaign;
  });
}
const menu = () => leave("menu");
const restart = () => transition("game", () => adapter.restart());

function proceed(stage) {
  if (!campaign || snapshot?.awaiting !== stage) return;
  return transition("game", () => adapter.continueDay(stage));
}

async function prepareGear(item) {
  if (busy || snapshot?.awaiting !== "day_intro" || !snapshot.dive_gear?.offers?.[item]) return;
  await transition("game", () => adapter.input({ prepare: item }));
  const button = [...$("dive-offers").querySelectorAll("[data-prepare]:enabled")].find((option) => option.dataset.prepare === item);
  (button ?? $("dive-offers").querySelector("[data-prepare]:enabled") ?? $("journey-next")).focus();
}

function campaignCommand(frame) {
  if (!busy && campaign && phaseInput.enabled && (snapshot.state !== "paused" || frame.pause)) phaseInput.command(frame);
}

$("home-link").addEventListener("click", (event) => {
  event.preventDefault();
  if (screen !== "menu") menu();
});
for (const button of document.querySelectorAll("[data-play]")) {
  button.addEventListener("click", () => begin(button.dataset.play));
}
$("to-menu").addEventListener("click", menu);
$("result-menu").addEventListener("click", menu);
$("restart").addEventListener("click", restart);
$("play-again").addEventListener("click", () => begin(choice));
$("continue").addEventListener("click", () => transition("game", () => adapter.continueDay()));
$("journey-replay").addEventListener("click", () => begin(choice));
$("journey-menu-button").addEventListener("click", menu);
$("pause-menu").addEventListener("click", menu);
for (const id of ["pause", "resume"]) $(id).addEventListener("click", () => campaignCommand({ pause: true }));
$("dive-fire").addEventListener("click", () => campaignCommand({ shoot: true }));
$("exit").addEventListener("click", () => leave("exit-screen"));
$("exit-back").addEventListener("click", () => show("menu"));
$("bag-panel").addEventListener("animationend", (event) => {
  if (event.animationName === "spoil-flash") $("bag-panel").classList.remove("spoil-alert");
});
document.addEventListener("click", (event) => {
  if (screen === "journey" && snapshot?.awaiting === "day_intro" && !snapshot.dive_gear &&
      !event.target.closest("button, a")) proceed("day_intro");
});

addEventListener("keydown", (event) => {
  const { code } = event;
  if (campaign) {
    if ((code === "Enter" || code === "Space") && event.target instanceof HTMLButtonElement) return;
    const awaiting = snapshot?.awaiting;
    if (awaiting === "day_intro" && snapshot.dive_gear && code !== "Enter") return;
    const pause = code === "Escape" || code === "KeyP";
    const fire = code === "KeyF" && snapshot?.phase === "gather" && snapshot.dive_gear;
    const inputKey = movement[code] || actionKeys[code] || pause || fire;
    if (!inputKey && !(awaiting === "day_intro" || awaiting === "evening_intro")) return;
    event.preventDefault();
    if (!phaseInput.press(event) || busy) return;
    if (awaiting === "day_intro" || awaiting === "evening_intro") proceed(awaiting);
    else if (pause) campaignCommand({ pause: true });
    else if (screen === "game" && snapshot.state === "playing") {
      if (movement[code]) phaseInput.move = move(phaseInput.keys);
      else if (fire) campaignCommand({ shoot: true });
      else if (code !== "Space" || snapshot.phase === "gather") campaignCommand({ [actionKeys[code]]: true });
    }
    return;
  }
  if (busy || screen !== "game" || !(movement[code] || actionKeys[code] || code === "KeyR")) return;
  if (code === "Space" && event.target instanceof HTMLButtonElement) return;
  event.preventDefault();
  if (event.repeat || down.has(code)) return;
  if (code === "KeyR") {
    restart();
    return;
  }
  if (code === "Space" && snapshot.mode === "quan" && !preview) return;
  down.add(code);
  const action = actionKeys[code];
  send(action ? { [action]: true } : { move: move() });
});

addEventListener("keyup", (event) => {
  const { code } = event;
  const wasPressed = phaseInput.release(code);
  if (campaign) {
    if (wasPressed && movement[code] && phaseInput.enabled) phaseInput.move = move(phaseInput.keys);
    return;
  }
  if (!down.delete(code)) return;
  event.preventDefault();
  const action = actionKeys[code];
  send(action ? { [action]: false } : { move: move() });
});
addEventListener("blur", clearKeys);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) clearKeys();
});
async function poll() {
  if ((screen === "game" || (campaign && screen === "journey" && !snapshot?.finished && snapshot?.state !== "finished")) && !busy) {
    const check = revision;
    try {
      const state = await adapter.state();
      if (revision === check) {
        tell();
        display(state);
      }
    } catch {
      if (revision === check) tell("Mất kết nối đến máy chủ. Đang thử lại…");
    }
  }
  setTimeout(poll, 33);
}

try {
  if (previewCampaign) {
    await loadMock();
    baseTuning = mockTuning;
    adapter = mockAdapter;
  } else {
    const config = await baseAdapter.config();
    baseTuning = uiConfig(config);
    liveCampaign = ["1.1", "1.2", "1.3"].includes(config.contract_version) &&
      (config.capabilities?.campaign_v12 === true || config.capabilities?.campaign_v11 === true);
    liveV12 = liveCampaign && ["1.2", "1.3"].includes(config.contract_version);
  }
  tuning = baseTuning;
  write("campaign-note", liveV12 ? "Năm ngày ở chợ nổi" : "Bản xem trước · 5 ngày");
  $("phase-one-day").hidden = previewCampaign || liveV12;
  $("preview-label").hidden = !preview && !previewCampaign;
  if (previewCampaign) write("preview-label", "Phase " + mockVersion + " · Snapshot mẫu");
  document.body.classList.add("phase-two");
  renderer.configure(tuning);
  for (const control of controls) control.disabled = false;
  poll();
  if (benchSignal) await begin("gather");
} catch (error) {
  if (benchSignal) benchSignal("error:" + error.message);
  tell(error.message);
}
