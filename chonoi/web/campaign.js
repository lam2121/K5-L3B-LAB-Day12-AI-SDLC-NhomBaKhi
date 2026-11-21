import { availableCounts, inventoryHasItems, receivedInventory } from "./inventory-view.js";

const noticeNames = {
  oxygen: ["Bình oxy", "oxygen_max_s", "giây"],
  hp: ["Áo phao", "hp_max", "máu"],
};
const gearNames = { launcher: "Súng lặn", ammo: "Đạn bong bóng" };
const blockedOffer = {
  funds: "Chưa đủ tiền", owned: "Đã có súng", ammo_limit: "Túi đạn gần đầy",
  requires_launcher: "Cần có súng", max_level: "Đã đạt cấp tối đa",
};

export const upgradeName = (id) => noticeNames[id]?.[0] ?? id;

export function plannedDishes(snapshot, tuning) {
  if (snapshot.mode !== "day") return Object.keys(tuning.menu);
  const plan = snapshot.day_plan?.dishes ?? [];
  return (Array.isArray(plan) ? plan : Object.keys(plan)).filter((id) => Object.hasOwn(tuning.menu, id));
}

export function hasRecipe(stock, recipe) {
  return Object.entries(recipe).every(([kind, quantity]) => (stock[kind] ?? 0) >= quantity);
}

// Bắt cạnh ở client, giữ lệnh mua đúng một frame. Adapter live nhận frame theo thứ tự.
export class CampaignInput {
  constructor(send) {
    this.send = send;
    this.keys = new Set();
    this.blocked = new Set();
    this.queue = [];
    this.move = [0, 0];
    this.generation = 0;
  }

  start(hz) {
    clearInterval(this.timer);
    this.timer = setInterval(() => this.flush(), 1000 / hz);
  }

  reset() {
    for (const key of this.keys) this.blocked.add(key);
    this.keys.clear();
    this.queue.length = 0;
    this.move = [0, 0];
    this.previous = null;
    this.pulsed = false;
    this.generation++;
  }

  press(event) {
    if (event.repeat || this.keys.has(event.code) || this.blocked.has(event.code)) return false;
    this.keys.add(event.code);
    return true;
  }

  release(code) {
    this.blocked.delete(code);
    return this.keys.delete(code);
  }

  command(frame) { this.queue.push(frame); }

  flush() {
    if (!this.enabled) return;
    const pulse = this.pulsed ? undefined : this.queue.shift();
    this.pulsed = Boolean(pulse);
    const frame = { move: this.move, interact: false, catch: false, pause: false, shop_done: false, ...pulse };
    if (this.shootEnabled) frame.shoot = pulse?.shoot ?? false;
    const signature = JSON.stringify(frame);
    if (signature === this.previous) return;
    this.previous = signature;
    const generation = this.generation;
    this.send(frame, () => this.generation === generation);
  }
}

class ShiftLog {
  constructor() {
    this.days = new Map();
    this.seen = new Set();
    this.dishes = new Map();
  }

  day(number) {
    if (!this.days.has(number)) this.days.set(number, {
      orders: new Map(), paid: new Set(), left: new Set(), base: 0, tip: 0,
    });
    return this.days.get(number);
  }

  observe(snapshot) {
    const current = this.day(snapshot.day);
    current.before ??= snapshot.reputation;
    current.after = snapshot.reputation;
    for (const event of snapshot.events ?? []) {
      const number = event.day ?? snapshot.day;
      const signature = JSON.stringify([number, event.tick, event.phase, event.name, event.data]);
      if (this.seen.has(signature)) continue;
      this.seen.add(signature);
      const day = this.day(number);
      const data = event.data;
      if (event.name === "gather_end") day.gather = data;
      if (event.name === "served") day.orders.set(data.order_id, data.dish_id);
      if (event.name === "customer_left") day.left.add(data.order_id);
      if (event.name === "quan_end") day.after = data.reputation;
      if (event.name !== "paid" || day.paid.has(data.order_id)) continue;
      day.paid.add(data.order_id);
      day.base += data.base_price ?? 0;
      day.tip += data.tip ?? 0;
      const id = data.dish_id ?? day.orders.get(data.order_id);
      if (id) this.dishes.set(id, (this.dishes.get(id) ?? 0) + 1);
    }
  }

  best() {
    const max = Math.max(0, ...this.dishes.values());
    return [...this.dishes].filter(([, count]) => count === max);
  }
}

export function createCampaignView({ $, write, update, element, inventoryList, money, decimal, dishName, time, proceed, action, prepare }) {
  let book = new ShiftLog();
  let introTimer;
  let screenKey;
  let pauseShown = false;

  function cancelIntro() {
    clearTimeout(introTimer);
    screenKey = undefined;
  }

  function pause(open, message) {
    if (pauseShown === open) return;
    pauseShown = open;
    $("pause-overlay").hidden = !open;
    $("main-content").inert = open;
    $("page-topbar").inert = open;
    if (open) {
      write("pause-phase", message);
      $("resume").focus();
    } else if ($("game").checkVisibility()) $("world").focus({ preventScroll: true });
    else if ($("journey").checkVisibility()) $("journey-title").focus({ preventScroll: true });
  }

  function nextButton(screen, label) {
    write("journey-next", label);
    $("journey-next").dataset.action = screen;
    $("journey-next").hidden = !label;
  }

  function list(id, lines) {
    update(id, lines, (container) => container.replaceChildren(...lines.map((line) => element("li", line))));
  }

  function inventory(items, average = false) {
    inventoryList("journey-items", items, { average });
    $("journey-empty").hidden = inventoryHasItems(items);
  }

  function stats(values) {
    update("journey-stats", values, (container) => container.replaceChildren(...values.map(([name, value]) => {
      const card = element("div");
      card.append(element("dt", name), element("dd", String(value)));
      return card;
    })));
  }

  function gearTitle(id, name) {
    const group = element("div", "", "gear-heading");
    const icon = element("span", "", "gear-icon");
    icon.dataset.item = id;
    icon.setAttribute("aria-hidden", "true");
    group.append(icon, element("h3", name));
    return group;
  }

  function preparationCards(gear) {
    const receipt = gear.purchase;
    $("dive-receipt").hidden = !receipt;
    if (receipt) write("dive-receipt", "Đã mua " + (gearNames[receipt.item] ?? upgradeName(receipt.item)).toLowerCase() + " · " + money(receipt.price));
    update("dive-offers", gear.offers, (container) => {
      container.replaceChildren(...Object.entries(gear.offers).filter(([id]) => gearNames[id] || noticeNames[id]).map(([id, offer]) => {
        const card = element("article", "", "panel dive-offer");
        const upgrade = noticeNames[id];
        let detail;
        if (id === "launcher") detail = "Kèm " + offer.quantity + " viên · Tầm " + gear.shot_range + " m";
        else if (id === "ammo") detail = offer.quantity + " viên mỗi gói";
        else if (offer.level) detail = "Cấp " + offer.level + " · " + offer[upgrade[1]] + " " + upgrade[2];
        else detail = "Đang dùng cấp tối đa";
        const button = element("button", offer.price ? "Mua · " + money(offer.price) : "Đã nâng tối đa", "button quiet");
        button.type = "button";
        button.dataset.prepare = id;
        button.disabled = Boolean(offer.block);
        button.setAttribute("aria-label", (gearNames[id] ?? upgrade[0]) + " · " + button.textContent +
          (offer.block ? " · " + blockedOffer[offer.block] : ""));
        card.append(gearTitle(id, gearNames[id] ?? upgrade[0]), element("p", detail, "upgrade-current"), button);
        if (offer.block) card.append(element("p", blockedOffer[offer.block], "upgrade-current"));
        return card;
      }));
    });
  }

  function shopCards(snapshot, tuning) {
    update("shop-upgrades", [snapshot.money, snapshot.upgrades, snapshot.active_upgrades, tuning.shop.upgrades], (container) => {
      const cards = Object.entries(tuning.shop.upgrades).filter(([id]) => noticeNames[id]).map(([id, levels]) => {
        const [name, valueKey, unit] = noticeNames[id];
        const level = snapshot.upgrades?.[id] ?? 0;
        const active = snapshot.active_upgrades?.[id] ?? 0;
        const next = levels.find((entry) => entry.level > level);
        const card = element("article", "", "panel upgrade-card");
        card.append(element("h2", name), element("p", "Đã mua cấp " + level + " · Đang dùng cấp " + active, "upgrade-current"));
        const list = element("ul", "", "journey-list");
        list.append(...levels.map((entry) => element("li", "Cấp " + entry.level + " · " + money(entry.price) + " → " + entry[valueKey] + " " + unit)));
        const button = element("button", next ? "Mua cấp " + next.level : "Đã đạt cấp tối đa", "button primary");
        button.type = "button";
        button.dataset.buy = id;
        button.disabled = !next || snapshot.money < next.price;
        card.append(list, button);
        if (next && snapshot.money < next.price) card.append(element("p", "Chưa đủ tiền", "upgrade-current"));
        return card;
      });
      container.replaceChildren(...cards);
    });
  }

  function render(snapshot, tuning) {
    book.observe(snapshot);
    const hasCampaign = snapshot.mode === "day";
    const day = book.day(snapshot.day);
    const totalDays = tuning.day_plan.length;
    const current = snapshot.finished || snapshot.state === "finished" ? "summary" : snapshot.awaiting ?? snapshot.phase;
    const preparing = current === "day_intro" && Boolean(snapshot.dive_gear?.offers);
    const key = snapshot.day + ":" + current;
    if (key !== screenKey) {
      cancelIntro();
      screenKey = key;
      if (current === "day_intro" && !preparing) introTimer = setTimeout(() => proceed("day_intro"), 4000);
    }
    pause(snapshot.state === "paused", current === "shop" ? "Cửa hàng" : current === "gather" ? "Sông Chín Khúc" : "Nhà bè Má Tư");
    if (current === "gather" || current === "quan") return false;

    $("journey").dataset.screen = current;
    write("journey-day", hasCampaign ? "Ngày " + snapshot.day + " / " + totalDays : snapshot.phase === "gather" ? "Buổi sáng" : "Buổi tối");
    const progress = $("journey-progress");
    progress.hidden = !hasCampaign;
    if (hasCampaign) {
      progress.max = totalDays;
      progress.value = snapshot.day;
    }
    $("journey-stock-panel").hidden = !["day_intro", "evening_intro", "shop"].includes(current);
    $("journey-menu-panel").hidden = !["day_intro", "evening_intro"].includes(current);
    const stock = snapshot.stock ?? receivedInventory(day.gather) ?? {};
    const itemized = Array.isArray(stock);
    $("shop-freshness-note").hidden = current !== "shop" || !itemized;
    $("shop-upgrades").hidden = current !== "shop";
    $("dive-preparation").hidden = !preparing;
    $("journey-stats").hidden = !preparing && !["day_result", "summary", "shop"].includes(current);
    $("journey-end").hidden = current !== "summary";
    $("journey-title").dataset.screen = current;
    const plan = snapshot.day_plan;

    if (current === "day_intro") {
      write("journey-title", preparing ? "Chuẩn bị ra sông" : "Má Tư dặn dò");
      write("journey-copy", preparing ? "Chọn trang bị và xem nguyên liệu cần tìm cho ca tối." : "Út ơi, coi thực đơn bữa nay rồi theo con nước kiếm nguyên liệu nghen!");
      write("journey-stock-title", "Nguyên liệu cần tìm");
      write("journey-menu-title", "Món dự kiến");
      inventory(plan?.ingredients ?? {});
      list("journey-menu", plannedDishes(snapshot, tuning).map((id) =>
        dishName(id) + (plan?.dishes?.[id] ? " ×" + plan.dishes[id] : "")));
      if (preparing) {
        stats([["Tiền hiện có", money(snapshot.money)], ["Đạn mang theo", snapshot.dive_gear.ammo]]);
        preparationCards(snapshot.dive_gear);
      }
      nextButton(current, "Ra sông");
    } else if (current === "evening_intro") {
      const usable = availableCounts({ stock }, tuning.freshness);
      const dishes = plannedDishes(snapshot, tuning).filter((id) => hasRecipe(usable, tuning.menu[id].recipe));
      write("journey-title", "Nhóm bếp trên nhà bè");
      write("journey-copy", inventoryHasItems(stock) ? "Mẻ thu hoạch đã nhập kho. Mình coi bữa nay nấu được món gì." : "Kho rỗng." + (day.gather?.reason === "fainted" ? " Út Sen bị ngất, giỏ đã rơi hết." : ""));
      write("journey-stock-title", "Nguyên liệu nhập kho");
      write("journey-menu-title", itemized ? "Món đủ nguyên liệu tươi" : "Món đủ nguyên liệu");
      inventory(stock, true);
      list("journey-menu", dishes.length ? dishes.map(dishName) : ["Chưa đủ nguyên liệu"]);
      nextButton(current, "Mở quán");
    } else if (current === "day_result") {
      const change = (day.after ?? snapshot.reputation) - day.before;
      write("journey-title", "Má Tư chốt sổ");
      write("journey-copy", "Kết quả ca tối hôm nay.");
      stats([["Đã phục vụ", day.orders.size], ["Bỏ đi", day.left.size], ["Tiền món", money(day.base)],
        ["Tiền boa", money(day.tip)], ["Đổi uy tín", (change > 0 ? "+" : "") + decimal.format(change)]]);
      nextButton(current, "Sang cửa hàng");
    } else if (current === "shop") {
      write("journey-title", "Cửa hàng nhà bè");
      write("journey-copy", "Hiệu lực từ ngày kế tiếp.");
      write("journey-stock-title", "Kho dư cuối ngày");
      inventory(snapshot.stock ?? {});
      stats([["Tiền hiện có", money(snapshot.money)], ["Thời gian", time(snapshot.time_left_ticks)]]);
      shopCards(snapshot, tuning);
      nextButton(current, snapshot.day === totalDays ? "Xem tổng kết" : "Qua ngày mới");
    } else {
      write("journey-title", hasCampaign ? "Năm ngày ở chợ nổi" : "Kết thúc ca");
      const best = book.best();
      write("journey-copy", "Món bán chạy nhất · " + (best.length ? best.map(([id]) => dishName(id)).join(", ") + " (" + best[0][1] + " phần)" : "Chưa có món đã thanh toán"));
      stats([["Tổng thu", money(snapshot.earned)], ["Còn lại", money(snapshot.money)],
        ["Uy tín cuối", decimal.format(snapshot.reputation)], ["Tổng điểm", snapshot.score]]);
      nextButton(current, "");
    }
    return true;
  }

  $("journey-next").addEventListener("click", () => {
    const screen = $("journey-next").dataset.action;
    if (screen === "shop") action({ shop_done: true });
    else proceed(screen);
  });
  $("shop-upgrades").addEventListener("click", (event) => {
    const button = event.target.closest("[data-buy]");
    if (button && !button.disabled) action({ buy: button.dataset.buy });
  });
  $("dive-offers").addEventListener("click", (event) => {
    const button = event.target.closest("[data-prepare]");
    if (button && !button.disabled) prepare(button.dataset.prepare);
  });
  return {
    render, pause, cancelIntro,
    reset() { book = new ShiftLog(); cancelIntro(); pause(false); },
  };
}
