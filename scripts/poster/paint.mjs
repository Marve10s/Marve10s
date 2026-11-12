import sharp from 'sharp';

export const seeded = (seed) => {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const hash = (x, y, seed) => {
  let h = Math.imul(x | 0, 0x165667b1) ^ Math.imul(y | 0, 0x27d4eb2f) ^ Math.imul(seed | 0, 0x7fffffff);
  h = Math.imul(h ^ (h >>> 13), 0x4bf19f61);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
export const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const mixNumber = (a, b, t) => a + (b - a) * t;
export const smooth = (lo, hi, v) => { const t = clamp((v - lo) / (hi - lo)); return t * t * (3 - 2 * t); };

export function noise(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const u = fade(x - xi), v = fade(y - yi);
  return mixNumber(mixNumber(hash(xi, yi, seed), hash(xi + 1, yi, seed), u), mixNumber(hash(xi, yi + 1, seed), hash(xi + 1, yi + 1, seed), u), v);
}

export function fbm(x, y, seed = 0, octaves = 5, gain = 0.5, lacunarity = 2) {
  let sum = 0, amplitude = 0.5, total = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amplitude * noise(x, y, seed + i * 17);
    total += amplitude;
    x *= lacunarity; y *= lacunarity; amplitude *= gain;
  }
  return sum / total;
}

export const ridged = (x, y, seed, octaves = 5) => {
  let sum = 0, amplitude = 0.5, total = 0;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(noise(x, y, seed + i * 31) * 2 - 1);
    sum += amplitude * n * n;
    total += amplitude;
    x *= 2.03; y *= 2.03; amplitude *= 0.5;
  }
  return sum / total;
};

export const warped = (x, y, seed, strength = 1.6, octaves = 5) => {
  const qx = fbm(x + 1.7, y + 9.2, seed + 3, 4), qy = fbm(x + 8.3, y + 2.8, seed + 7, 4);
  const rx = fbm(x + strength * 4 * qx + 5.2, y + strength * 4 * qy + 1.3, seed + 11, 4);
  const ry = fbm(x + strength * 4 * qx + 3.1, y + strength * 4 * qy + 7.7, seed + 13, 4);
  return fbm(x + strength * 3 * rx, y + strength * 3 * ry, seed, octaves);
};

export const hex = (value) => [0, 1, 2].map((i) => parseInt(value.slice(1 + i * 2, 3 + i * 2), 16) / 255);
export const ramp = (stops) => {
  const table = stops.map(([at, color]) => [at, typeof color === 'string' ? hex(color) : color]);
  return (t) => {
    if (t <= table[0][0]) return table[0][1];
    for (let i = 1; i < table.length; i++) {
      if (t <= table[i][0]) {
        const [a, ca] = table[i - 1], [b, cb] = table[i];
        const k = (t - a) / (b - a);
        return [mixNumber(ca[0], cb[0], k), mixNumber(ca[1], cb[1], k), mixNumber(ca[2], cb[2], k)];
      }
    }
    return table.at(-1)[1];
  };
};

export class Canvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.rgb = new Float32Array(width * height * 3);
    this.alpha = null;
  }

  each(paint) {
    const { width, height, rgb } = this;
    for (let y = 0, i = 0; y < height; y++) {
      for (let x = 0; x < width; x++, i += 3) {
        const color = paint(x, y);
        if (!color) continue;
        rgb[i] += color[0]; rgb[i + 1] += color[1]; rgb[i + 2] += color[2];
      }
    }
    return this;
  }

  add(x, y, color, amount = 1) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = ((y | 0) * this.width + (x | 0)) * 3;
    this.rgb[i] += color[0] * amount; this.rgb[i + 1] += color[1] * amount; this.rgb[i + 2] += color[2] * amount;
  }

  splat(cx, cy, radius, color, amount = 1, falloff = 2.2) {
    const r = Math.ceil(radius);
    for (let y = Math.floor(cy - r); y <= cy + r; y++) {
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / radius;
        if (d < 1) this.add(x, y, color, amount * (1 - d) ** falloff);
      }
    }
  }

  grain(seed, amount = 0.06, floor = 0.03) {
    const next = seeded(seed);
    const { rgb } = this;
    for (let i = 0; i < rgb.length; i += 3) {
      const luma = rgb[i] * 0.3 + rgb[i + 1] * 0.5 + rgb[i + 2] * 0.2;
      const jitter = (next() + next() + next() - 1.5) * amount * (floor + 2.4 * Math.sqrt(clamp(luma)));
      rgb[i] += jitter; rgb[i + 1] += jitter; rgb[i + 2] += jitter;
    }
    return this;
  }

  bytes({ exposure = 1, transparent = false, display = false } = {}) {
    const { width, height, rgb } = this;
    const channels = transparent || this.alpha ? 4 : 3;
    const out = Buffer.alloc(width * height * channels);
    const tone = display ? (v) => clamp(v) ** 2.2 : (v) => 1 - Math.exp(-Math.max(0, v) * exposure);
    for (let p = 0, i = 0, o = 0; p < width * height; p++, i += 3, o += channels) {
      const r = tone(rgb[i]), g = tone(rgb[i + 1]), b = tone(rgb[i + 2]);
      if (this.alpha) {
        out[o] = Math.round(255 * r ** (1 / 2.2)); out[o + 1] = Math.round(255 * g ** (1 / 2.2)); out[o + 2] = Math.round(255 * b ** (1 / 2.2)); out[o + 3] = Math.round(255 * clamp(this.alpha[p]));
      } else if (transparent) {
        const gr = r ** (1 / 2.2), gg = g ** (1 / 2.2), gb = b ** (1 / 2.2);
        const peak = Math.max(gr, gg, gb, 1e-4);
        out[o] = Math.round(255 * gr / peak); out[o + 1] = Math.round(255 * gg / peak); out[o + 2] = Math.round(255 * gb / peak); out[o + 3] = Math.round(255 * peak);
      } else {
        out[o] = Math.round(255 * r ** (1 / 2.2)); out[o + 1] = Math.round(255 * g ** (1 / 2.2)); out[o + 2] = Math.round(255 * b ** (1 / 2.2));
      }
    }
    return { data: out, info: { raw: { width, height, channels } } };
  }

  webp(options = {}) {
    const { data, info } = this.bytes(options);
    return sharp(data, info).webp({ quality: options.quality ?? 82, alphaQuality: 90 }).toBuffer();
  }
}

const STAR_TINTS = [[0.62, 0.72, 1], [0.78, 0.85, 1], [1, 1, 1], [1, 0.95, 0.86], [1, 0.84, 0.66], [1, 0.72, 0.52]];

export function stars(canvas, { seed = 1, density = 0.0011, band, bright = 1, mask }) {
  const next = seeded(seed);
  const count = Math.round(canvas.width * canvas.height * density);
  for (let n = 0; n < count; n++) {
    const x = next() * canvas.width, y = next() * canvas.height;
    const inBand = band ? band(x, y) : 0;
    if (band && next() > 0.3 + inBand * 0.9) continue;
    const visible = mask ? mask(x, y) : 1;
    if (visible <= 0.02) continue;
    const magnitude = next() ** (5.5 - inBand * 1.5);
    const tint = STAR_TINTS[Math.min(STAR_TINTS.length - 1, Math.floor(next() ** 0.8 * STAR_TINTS.length))];
    const power = (0.1 + magnitude * 3.2) * bright * visible;
    canvas.splat(x, y, 0.8 + magnitude * magnitude * 1.9, tint, power * (1.2 - 0.5 * magnitude), 2.8);
    if (magnitude > 0.93) canvas.splat(x, y, 4 + magnitude * 9, tint, power * 0.012, 2.4);
  }
  return canvas;
}
