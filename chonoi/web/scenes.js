import { shore, river, riverScenery, deck, dockArt, plant, school, crocodile, diveShot,
  utSen, utSenOnWater, stoveArt, tableArt, mealArt, coverArt } from "./art.js";
import { spriteReady } from "./assets/sprites.js";

const tau = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function nearest(pos, items, radius) {
  let best;
  let limit = radius;
  for (const item of items) {
    const gap = distance(pos, item.pos);
    if (gap <= limit && (!best || gap < limit)) {
      best = item;
      limit = gap;
    }
  }
  return best;
}

// Gợi ý hiển thị dựa trên snapshot. Sim chọn mục tiêu và xử lý hành động.
export function findAction(state) {
  const { player, meta } = state;
  const here = player.pos;
  if (state.mode === "gather") {
    if (distance(here, meta.dock_pos) <= meta.dock_radius) {
      return { key: "E", text: "Cập bến", pos: meta.dock_pos, radius: meta.dock_radius };
    }
    if (player.at_surface) {
      const node = nearest(here, state.nodes.filter((item) => item.ready), meta.interact_radius);
      if (node) return { key: "E", text: "Hái rau", pos: node.pos, radius: .9 };
    } else {
      const fish = nearest(here, state.fish, meta.catch_radius);
      if (fish) return { key: "Space", text: player.catch_cd_ticks ? "Đang hồi chiêu" : "Bắt đàn cá", pos: fish.pos, radius: 1.35 };
    }
    return null;
  }

  const options = [];
  const hasOrder = state.customers.some((customer) => customer.order_status === "reserved");
  for (const stove of state.stoves) {
    if (stove.state === "idle" && hasOrder) options.push({ pos: stove.pos, label: "Nấu món" });
    if (stove.state === "ready" && !state.hand) options.push({ pos: stove.pos, label: "Bưng món" });
  }
  if (state.hand) {
    const customer = state.customers.find((candidate) => candidate.id === state.hand.order_id && candidate.state === "waiting");
    const table = customer && state.tables.find(({ id }) => id === customer.table_id);
    if (table) options.push({ pos: table.pos, label: "Phục vụ bàn " + table.id });
  }
  const item = nearest(here, options, meta.interact_radius);
  return item ? { key: "E", text: item.label, pos: item.pos, radius: .85 } : null;
}

function fit(canvas) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (!w || !h) return null;
  const ratio = Math.min(devicePixelRatio || 1, 2);
  const width = Math.round(w * ratio);
  const height = Math.round(h * ratio);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { ctx, w, h };
}

function label(ctx, name, x, y, options = {}) {
  const size = options.size ?? 11;
  const height = size + 7;
  ctx.font = "700 " + size + "px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const width = ctx.measureText(name).width + 12;
  ctx.fillStyle = options.background ?? "#192c24e8";
  ctx.beginPath();
  ctx.roundRect(x - width / 2, y - height / 2, width, height, 5);
  ctx.fill();
  ctx.fillStyle = options.color ?? "#fff0d4";
  ctx.fillText(name, x, y);
}

function ring(ctx, x, y, radius, color, dashed = false) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.7;
  ctx.setLineDash(dashed ? [5, 4] : []);
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, tau);
  ctx.stroke();
  ctx.setLineDash([]);
}

function progressRing(ctx, x, y, size, fraction) {
  ring(ctx, x, y, size, "#213b36");
  ctx.strokeStyle = "#ffd390";
  ctx.beginPath();
  ctx.arc(x, y, size, -Math.PI / 2, -Math.PI / 2 + clamp(fraction, 0, 1) * tau);
  ctx.stroke();
}

function highlight(ctx, action, x, y, scale, w, h, v2) {
  if (!action) return;
  const ax = x(action.pos[0]);
  const ay = y(action.pos[1]);
  ring(ctx, ax, ay, Math.max(13, action.radius * scale), "#ffdc8d", true);
  label(ctx, action.key, clamp(ax, 24, w - 24), clamp(ay - Math.max(25, action.radius * scale + 12), 13, h - 15),
    { color: "#302419", background: "#f4bd70", size: v2 ? 18 : 11 });
}

function cachedShore() {
  const buffer = document.createElement("canvas");
  const scenery = buffer.getContext("2d");
  let previousKey;
  return (ctx, w, h, horizon, drift) => {
    const ratio = ctx.getTransform().a;
    const key = [w, h, horizon, drift, ratio, spriteReady("dawn_sky")].join("/");
    if (key !== previousKey) {
      const width = Math.round(w * ratio);
      const height = Math.round(h * ratio);
      if (buffer.width !== width || buffer.height !== height) {
        buffer.width = width;
        buffer.height = height;
      }
      scenery.setTransform(ratio, 0, 0, ratio, 0, 0);
      shore(scenery, w, h, horizon, drift);
      previousKey = key;
    }
    ctx.drawImage(buffer, 0, 0, w, h);
  };
}

function worldGather(ctx, w, h, state, action, t, hz, v2, floodSeason, drawShore, contrast) {
  const { meta, player } = state;
  const [[left, right], [surface, bottom]] = [meta.bounds.x, meta.bounds.d];
  const depth = bottom - surface;
  const preferredHorizon = h * .29;
  // Vùng nhìn ngang hẹp hơn lòng sông và bám player.x khi rời rìa.
  const scale = Math.max(w / Math.min(65, right - left), (h - preferredHorizon - 24) / depth);
  const span = w / scale;
  const viewX = clamp(player.pos[0] - span / 2, left - 3, right + 3 - span);
  const minHorizon = h - 23 - depth * scale;
  const horizon = Math.min(preferredHorizon, Math.max(minHorizon, h - 30 - (player.pos[1] - surface) * scale));
  const x = (pos) => (pos - viewX) * scale;
  const y = (pos) => horizon + (pos - surface) * scale;

  drawShore(ctx, w, h, horizon, viewX * scale);
  const dangerDepth = meta.danger_depth ?? meta.monsters?.species?.ca_sau?.depths?.[0];
  const deepDepth = meta.deep_depth ?? bottom - (dangerDepth - surface);
  const tiers = v2 && Number.isFinite(dangerDepth) && dangerDepth < deepDepth && deepDepth < bottom
    ? [y(dangerDepth), y(deepDepth)] : undefined;
  river(ctx, w, h, horizon, y(bottom), viewX * scale, t, tiers, floodSeason);
  riverScenery(ctx, w, horizon, viewX * scale, scale, t);
  if (contrast) {
    ctx.fillStyle = "#07131ba8";
    ctx.fillRect(0, 0, w, h);
  }
  const tag = { size: 18, background: contrast ? "#000" : undefined, color: contrast ? "#fff" : undefined };
  if (tiers) {
    ctx.strokeStyle = "#e1b1e9b8";
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(0, tiers[0]);
    ctx.lineTo(w, tiers[0]);
    ctx.stroke();
    ctx.setLineDash([]);
    if (tiers[0] > 55 && tiers[0] < h - 25) label(ctx, dangerDepth + " m · Vùng nguy hiểm", 112, tiers[0], tag);
  }
  ctx.fillStyle = "#b8e3a063";
  ctx.fillRect(0, horizon, w, meta.surface_depth * scale);
  ctx.fillStyle = contrast ? "#fff08a" : "#d7dcb2";
  ctx.fillRect(0, horizon - 1, w, 1.5);
  if (y(bottom) < h) {
    ctx.fillStyle = "#12312e";
    ctx.fillRect(0, y(bottom), w, h - y(bottom));
  }

  const [dockX, dockD] = meta.dock_pos;
  ring(ctx, x(dockX), y(dockD), scale * meta.dock_radius, "#ffdfa7b5", true);
  const platformHalfWidth = dockArt(ctx, x(dockX), y(dockD), scale);
  if (x(dockX) >= 0 && x(dockX) < w) label(ctx, "Bến", Math.max(25, x(dockX)), y(dockD) + 28, tag);

  for (const node of state.nodes) {
    const nx = x(node.pos[0]);
    if (nx < -35 || nx > w + 35) continue;
    const ny = y(node.pos[1]);
    plant(ctx, nx, ny, node.kind, node.ready, scale);
    label(ctx, node.id, nx, ny + (v2 ? 19 : 15), tag);
    if (!node.ready) {
      const seconds = Math.ceil(node.regrow_ticks / hz);
      progressRing(ctx, nx, ny - (v2 ? 25 : 20), v2 ? 15 : 10, 1 - node.regrow_ticks / (meta.regrow_s * hz));
      ctx.font = "700 " + (v2 ? 18 : 9) + "px system-ui, sans-serif";
      ctx.fillStyle = "#fff2d7";
      ctx.fillText(String(seconds), nx, ny - (v2 ? 25 : 20));
    }
  }
  for (const fish of state.fish) {
    const fx = x(fish.pos[0]);
    const fy = y(fish.pos[1]);
    if (fx < -45 || fx > w + 45) continue;
    school(ctx, fx, fy, fish, scale, t);
    if (fx > 10 && fx < w - 10 && fy > 0 && fy < h) {
      label(ctx, fish.id, clamp(fx, 22, w - 22), clamp(fy + (v2 ? 21 : 16), 14, h - 14), tag);
    }
  }
  for (const monster of state.monsters ?? []) {
    const mx = x(monster.pos[0]);
    const my = y(monster.pos[1]);
    if (mx < -72 || mx > w + 72) continue;
    crocodile(ctx, mx, my, scale, monster, t);
    const condition = { patrol: "Tuần tra", chase: "Đuổi", recoil: "Choáng" }[monster.state];
    label(ctx, monster.id + (condition ? " · " + condition : ""), clamp(mx, 65, w - 65), my - 23, tag);
  }
  highlight(ctx, action, x, y, scale, w, h, v2);
  const [px, pd] = player.pos;
  const p = [x(px), y(pd)];
  if (!player.at_surface) {
    if (player.catch_cd_ticks === 0) ring(ctx, ...p, scale * meta.catch_radius, "#e4eeba49");
    const motion = Math.hypot(...(player.vel ?? [0, 0]));
    if (motion > .1) {
      for (let i = 0; i < 4; i++) {
        const life = (t + i / 4) % 1;
        ring(ctx, p[0] + Math.sin(i + t * 5) * 7, p[1] - 7 - life * 31, 2 + life * 3, floodSeason ? "#ffe1a591" : "#dcf3de8a");
      }
    }
  }
  ctx.save();
  if (v2 && player.invuln_ticks > 0 && Math.floor(t * 9) % 2 === 0) ctx.globalAlpha = .32;
  const heading = player.heading_deg * Math.PI / 180;
  const onDock = pd === dockD && Math.abs(p[0] - x(dockX)) <= platformHalfWidth;
  if (player.at_surface && !onDock) utSenOnWater(ctx, p[0], horizon, scale, heading, t);
  else utSen(ctx, p[0], onDock ? p[1] - 3 : p[1], scale, heading, player.vel, t, true, !player.at_surface);
  ctx.restore();
  const shot = state.dive_gear && state.events?.findLast((event) => event.name === "crocodile_defeated" && event.day === state.day);
  if (shot && state.tick - shot.tick < hz * .4) {
    const { from, to } = shot.data;
    const progress = t === 0 ? .3 : (state.tick - shot.tick) / (hz * .4);
    diveShot(ctx, x(from[0]), y(from[1]), x(to[0]), y(to[1]), progress);
  }
}

function worldQuan(ctx, w, h, state, action, t, v2, contrast) {
  const [[left, right], [south, north]] = [state.meta.bounds.x, state.meta.bounds.z];
  const pad = Math.min(w, h) * .15;
  const scale = Math.min((w - 2 * pad) / (right - left), (h - 1.5 * pad) / (north - south));
  const width = (right - left) * scale;
  const height = (north - south) * scale;
  const ox = (w - width) / 2 - (Array.isArray(state.stock) && w > 640 ? 34 : 0);
  const oy = (h - height) / 2;
  const x = (pos) => ox + (pos - left) * scale;
  const y = (pos) => oy + (north - pos) * scale;
  deck(ctx, w, h, ox, oy, width, height, t);
  if (contrast) {
    ctx.fillStyle = "#07131b96";
    ctx.fillRect(0, 0, w, h);
  }
  const tag = { size: 18, background: contrast ? "#000" : undefined, color: contrast ? "#fff" : undefined };
  for (const stove of state.stoves) {
    const sx = x(stove.pos[0]);
    const sy = y(stove.pos[1]);
    stoveArt(ctx, sx, sy, scale, stove.state, t);
    label(ctx, v2 ? stove.id : "Bếp " + stove.id, sx, sy + .63 * scale + 11, tag);
  }
  for (const table of state.tables) {
    const customer = state.customers.find((item) => item.id === table.customer_id);
    const tx = x(table.pos[0]);
    const ty = y(table.pos[1]);
    tableArt(ctx, tx, ty, scale, customer);
    label(ctx, "Bàn " + table.id, tx, ty + .65 * scale + 12, tag);
    if (v2 && customer?.state === "eating") label(ctx, "Ngon quá!", tx, ty - 37, { ...tag, background: "#754b33" });
    if (Array.isArray(state.stock) && customer?.order_status === "unfulfillable") {
      label(ctx, "Hết hàng tươi!", clamp(tx, 76, w - 76), ty - 38, { ...tag, size: 18, background: "#613732" });
    }
  }

  highlight(ctx, action, x, y, scale, w, h, v2);
  const p = state.player;
  const px = x(p.pos[0]);
  const py = y(p.pos[1]);
  const [vx, vz] = p.vel ?? [0, 0];
  const heading = vx || vz ? Math.atan2(-vz, vx) : -Math.PI / 2;
  utSen(ctx, px, py, scale * .48, heading, p.vel, t, false, false);
  if (state.hand) mealArt(ctx, px, py - 22, 8);
}

export function createRenderer(cover, canvas, onPresented) {
  let current;
  let action;
  let tuning;
  let frozen = false;
  let dirty = true;
  let previousMs;
  let time = 0;
  let contrast = false;
  let landscapeReady = false;
  let pendingPresentation = false;
  const drawShore = cachedShore();
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

  function drawCover() {
    const frame = fit(cover);
    if (frame) coverArt(frame.ctx, frame.w, frame.h);
  }

  function draw(ms) {
    // The next animation boundary follows the browser's paint of the preceding Canvas frame.
    if (pendingPresentation) {
      pendingPresentation = false;
      onPresented();
    }
    if (!frozen && previousMs !== undefined) time += Math.min(100, ms - previousMs) / 1000;
    previousMs = ms;
    if (!landscapeReady && spriteReady("dawn_sky")) {
      landscapeReady = true;
      dirty = true;
      drawCover();
    }
    if (current && tuning && (!frozen || dirty)) {
      const frame = fit(canvas);
      if (frame) {
        const { ctx, w, h } = frame;
        const t = reducedMotion.matches ? 0 : time;
        const floodSeason = Boolean(tuning.freshness) || Array.isArray(current.stock) || typeof current.hold?.[0] === "object";
        const v2 = Boolean(tuning.shop) || floodSeason;
        if (current.mode === "gather") {
          worldGather(ctx, w, h, current, action, t, tuning.tick_hz, v2, floodSeason, drawShore, contrast);
          pendingPresentation = Boolean(onPresented);
        } else worldQuan(ctx, w, h, current, action, t, v2, contrast);
        dirty = false;
      }
    }
    requestAnimationFrame(draw);
  }

  new ResizeObserver(drawCover).observe(cover);
  new ResizeObserver(() => { dirty = true; }).observe(canvas);
  requestAnimationFrame(draw);
  return {
    configure(config) { tuning = config; },
    freeze(value) { if (value !== frozen) dirty = true; frozen = value; },
    contrast(value) { if (value !== contrast) dirty = true; contrast = value; },
    state(snapshot, target) {
      action = target;
      const previous = current;
      current = snapshot;
      if (snapshot.monsters?.length && previous?.mode === snapshot.mode &&
          previous.session_id === snapshot.session_id && previous.tick <= snapshot.tick) {
        const monsters = snapshot.monsters.map((monster) => {
          const before = previous.monsters?.find(({ id }) => id === monster.id);
          if (!before) return monster;
          const dx = monster.pos[0] - before.pos[0];
          const facingLeft = dx !== 0 && monster.state !== "recoil" ? dx < 0 : before.facingLeft;
          return { ...monster, facingLeft };
        });
        current = { ...current, monsters };
      }
      // Starter quán chưa có vel. Khoảng dịch chuyển giữa hai snapshot chỉ dùng để vẽ bước chân.
      if (!snapshot.player.vel && previous && previous.session_id === snapshot.session_id) {
        const elapsed = (snapshot.tick - previous.tick) / tuning.tick_hz;
        const velocity = elapsed > 0
          ? snapshot.player.pos.map((pos, axis) => (pos - previous.player.pos[axis]) / elapsed)
          : previous.player.vel;
        current = { ...current, player: { ...snapshot.player, vel: velocity } };
      }
    },
  };
}
