// Rectangles in pixels in the WebP atlases.
const atlases = {
  characters: {
    ut_sen_shore: [54, 12, 83, 168],
    ut_sen_swim: [198, 54, 180, 84],
    ut_sen_deck: [438, 12, 84, 168],
    guest_fisher: [41, 208, 109, 160],
    guest_woman: [238, 208, 100, 160],
    guest_vendor: [425, 208, 110, 160],
  },
  objects: {
    bong_sung: [15, 25, 150, 129],
    bong_dien_dien: [195, 16, 150, 147],
    keo_neo: [375, 20, 150, 140],
    ca_loc: [11, 241, 158, 58],
    ca_linh: [195, 238, 150, 63],
    ca_keo: [371, 248, 158, 44],
    ca_sau: [6, 414, 168, 72],
    table: [192, 399, 155, 102],
    stove: [379, 375, 141, 150],
  },
  motion: {
    swim_reach: [4, 4, 156, 88],
    swim_pull: [164, 4, 156, 88],
    swim_kick: [324, 4, 156, 88],
    walk_left_step: [4, 96, 98, 150],
    walk_pass: [164, 96, 98, 150],
    walk_right_step: [324, 96, 98, 150],
  },
  scenery: {
    river_boat: [4, 4, 166, 47],
    water_hyacinth: [184, 4, 166, 139],
    river_reeds: [364, 4, 155, 166],
    hanging_lantern: [4, 184, 94, 166],
    woven_basket: [184, 184, 166, 126],
    clay_jars: [364, 184, 166, 165],
  },
  landscape: {
    dawn_sky: [4, 4, 792, 259],
    house_terracotta: [4, 271, 178, 137],
    house_tin: [198, 271, 170, 138],
    house_thatch: [392, 271, 162, 138],
  },
  crocodile: {
    crocodile_patrol_up: [4, 4, 192, 84],
    crocodile_patrol_mid: [200, 4, 192, 84],
    crocodile_patrol_down: [396, 4, 192, 84],
    crocodile_chase_up: [4, 92, 192, 84],
    crocodile_chase_mid: [200, 92, 192, 84],
    crocodile_chase_down: [396, 92, 192, 84],
  },
  dive_gear: {
    dive_launcher: [0, 0, 160, 160],
  },
};

const sprites = new Map(Object.entries(atlases).flatMap(([atlas, regions]) =>
  Object.entries(regions).map(([id, region]) => [id, { atlas, region }])));
const images = new Map();

function loadedAtlas(atlas) {
  if (typeof Image === "undefined") return null;
  let image = images.get(atlas);
  if (!image) {
    image = new Image();
    image.src = new URL("./" + atlas + ".webp", import.meta.url).href;
    images.set(atlas, image);
  }
  return image.complete && image.naturalWidth ? image : null;
}

export function spriteReady(id) {
  const sprite = sprites.get(id);
  return Boolean(sprite && loadedAtlas(sprite.atlas));
}

export function drawBackdrop(ctx, id, width, height) {
  const sprite = sprites.get(id);
  const image = sprite && loadedAtlas(sprite.atlas);
  if (!image) return false;

  const [sx, sy, sw, sh] = sprite.region;
  const ratio = Math.max(width / sw, height / sh);
  const drawnWidth = sw * ratio;
  const drawnHeight = sh * ratio;
  ctx.drawImage(image, sx, sy, sw, sh, (width - drawnWidth) / 2, height - drawnHeight, drawnWidth, drawnHeight);
  return true;
}

export function drawSprite(ctx, id, x, y, extent, anchorY = .5, tailBend = 0) {
  const sprite = sprites.get(id);
  const image = sprite && loadedAtlas(sprite.atlas);
  if (!image) return false;

  const [sx, sy, sw, sh] = sprite.region;
  const ratio = extent / Math.max(sw, sh);
  const width = sw * ratio;
  const height = sh * ratio;
  const left = x - width / 2;
  const top = y - height * anchorY;
  if (!tailBend) {
    ctx.drawImage(image, sx, sy, sw, sh, left, top, width, height);
    return true;
  }

  // Fish face right. Shear the tail around the seam with the stable body.
  const tailPixels = Math.round(sw * .28);
  const tailWidth = tailPixels * ratio;
  ctx.save();
  ctx.translate(left + tailWidth, top);
  ctx.transform(1, tailBend, 0, 1, 0, 0);
  ctx.drawImage(image, sx, sy, tailPixels, sh, -tailWidth, 0, tailWidth, height);
  ctx.restore();
  ctx.drawImage(image, sx + tailPixels, sy, sw - tailPixels, sh, left + tailWidth, top, width - tailWidth, height);
  return true;
}
