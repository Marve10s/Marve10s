import { Canvas, stars, warped, ridged, fbm, noise, ramp, smooth, clamp, seeded, mixNumber } from './paint.mjs';
import { W, H, SCALE, DAWN, ECLIPSE, dawnRadius, dawnY, domeY, bowlY } from './layout.mjs';

export async function paintArt() {
  const art = {};
  const sky = new Canvas(W * SCALE, H * SCALE);

  const band = (px, py) => {
    const x = px / SCALE, y = py / SCALE;
    const centre = 410 + x * 0.6 + 46 * Math.sin(x / 190);
    return Math.exp(-(((y - centre) / 150) ** 2));
  };
  const open = (px, py) => {
    const x = px / SCALE, y = py / SCALE;
    const night = y > dawnY(x) ? smooth(dawnY(x) + 90, dawnY(x) + 190, y) : 1;
    const shadow = 1 - smooth(domeY(x) - 6, domeY(x) + 4, y) * (1 - smooth(bowlY(x) - 4, bowlY(x) + 6, y));
    return night * shadow;
  };

  const violet = ramp([[0, '#000000'], [0.3, '#07041A'], [0.6, '#1E1160'], [0.82, '#5A3FD0'], [1, '#C9BCFF']]);
  const ember = ramp([[0, '#000000'], [0.45, '#160500'], [0.7, '#6A2408'], [0.9, '#D0702E'], [1, '#FFD9B0']]);

  sky.each((px, py) => {
    const visible = open(px, py);
    if (visible <= 0.01) return null;
    const u = px / 760, v = py / 760;
    const b = band(px, py);
    const gas = warped(u, v, 5, 0.9, 5);
    const density = clamp((gas - 0.5) * 2.4) * (0.06 + 0.7 * b);
    const warm = clamp((warped(u * 0.7 + 20, v * 0.7 + 7, 23, 0.8, 4) - 0.56) * 3) * b * 0.55;
    const lanes = 1 - 0.7 * smooth(0.52, 0.8, ridged(u * 1.5 + 4, v * 1.5 + 2, 9, 4)) * b;
    const a = violet(density), e = ember(warm);
    const haze = 0.022 * b;
    const k = visible * lanes * 0.8;
    return [(a[0] + e[0] + haze * 0.6) * k, (a[1] + e[1] * 0.9 + haze * 0.55) * k, (a[2] + e[2] * 0.7 + haze * 0.9) * k];
  });

  stars(sky, { seed: 7, density: 0.00085, band, mask: open });
  stars(sky, { seed: 19, density: 0.0034, band, bright: 0.3, mask: open });

  sky.grain(3, 0.022);
  art.sky = await sky.webp({ exposure: 1.2, quality: 72 });

  const bandRamp = ramp([[-38, '#000000'], [-33, '#01010C'], [-29, '#05052A'], [-24, '#150E55'], [-19, '#3A2A9A'], [-14, '#6C5CC8'], [-9, '#A49CDD'], [-4, '#D2CBEA'], [0, '#FBEFEA'], [3, '#F3CDB6'], [7, '#D29A78'], [11, '#A85A34'], [15, '#6E1E08'], [20, '#330400'], [27, '#0C0000'], [34, '#000000']].map(([at, color]) => [(at + 38) / 72, color]));

  {
    const top = DAWN.crest - 60, height = DAWN.sag + 120;
    const limb = new Canvas(W * SCALE, height * SCALE);
    const cx = W / 2, cy = DAWN.crest + dawnRadius;
    limb.each((px, py) => {
      const x = (px + 0.5) / SCALE, y = top + (py + 0.5) / SCALE;
      let d = Math.hypot(x - cx, y - cy) - dawnRadius;
      d = -d;
      if (d < 0) d *= mixNumber(1, 1 / (0.82 + 0.42 * noise(x / 70 + 3, 0.5, 13) + 0.14 * noise(x / 17, 2.5, 17)), clamp(-d / 14));
      if (d < -38 || d > 34) return null;
      const color = bandRamp((d + 38) / 72);
      return color;
    });
    limb.grain(5, 0.085, 0);
    art.limb = await limb.webp({ transparent: true, display: true, quality: 88 });
  }

  const flareRamp = ramp([[0, '#FFFFFF'], [0.06, '#FFFBFA'], [0.12, '#F8E8E4'], [0.2, '#E3C2B6'], [0.28, '#CFA389'], [0.36, '#B8825C'], [0.44, '#9C5432'], [0.52, '#742A0C'], [0.62, '#4C0C00'], [0.75, '#280000'], [0.88, '#0C0000'], [1, '#000000']]);

  async function sunSprite(name, size, seed, mode) {
    const sprite = new Canvas(size, size);
    const next = seeded(seed);
    const spokes = Array.from({ length: 16 }, (_, i) => [((i + 0.15 + 0.7 * next()) / 16) * Math.PI * 2, 0.07 + 0.05 * next(), 0.5 + 0.5 * next()]);
    spokes.push([Math.PI / 2, 0.11, 1], [-Math.PI / 2, 0.12, 0.97]);
    const body = (r) => 0.74 + 0.1 * smooth(0.08, 0.3, r);
    sprite.each((px, py) => {
      const x = ((px + 0.5) / size) * 2 - 1, y = ((py + 0.5) / size) * 2 - 1;
      const squash = 1 + 0.5 * (1 - smooth(0.08, 0.5, Math.hypot(x, y)));
      const r = Math.hypot(x / squash, y);
      const plain = r / body(r);
      if (mode === 'glow') {
        if (plain >= 1) return null;
        return flareRamp(plain);
      }
      const angle = Math.atan2(-y, x), dist = Math.hypot(x, y);
      let spike = 0;
      for (const [at, spread, power] of spokes) {
        let delta = Math.abs(angle - at) % (Math.PI * 2);
        if (delta > Math.PI) delta = Math.PI * 2 - delta;
        spike = Math.max(spike, power * Math.exp(-((delta / spread) ** 2)));
      }
      const wobble = 0.94 + 0.12 * noise(7 * angle + 40, 3 * dist, seed);
      const rayed = dist / ((body(dist) + (1 - body(dist)) * spike) * wobble);
      if (rayed >= 1) return null;
      return flareRamp(rayed);
    });
    sprite.grain(seed + 1, 0.075, 0);
    art[name] = await sprite.webp({ transparent: true, display: true, quality: 88 });
  }
  {
    await sunSprite('sun-glow', 280, 5, 'glow');
    await sunSprite('sun-rays-a', 280, 71, 'rays');
    await sunSprite('sun-rays-b', 280, 113, 'rays');
  }

  const coronaRamp = ramp([[0, '#000000'], [0.12, '#0A0524'], [0.3, '#2B1A7A'], [0.5, '#7A5CD6'], [0.68, '#E6A77A'], [0.84, '#FFE4C6'], [1, '#FFFFFF']]);

  async function corona(name, { flip, seed, streamers }) {
    const { reach, inside } = ECLIPSE;
    const sag = ECLIPSE.radius - Math.sqrt(ECLIPSE.radius ** 2 - (W / 2) ** 2);
    const height = Math.ceil(reach + sag + inside);
    const canvas = new Canvas(W, height);
    const cx = W / 2, cy = reach + ECLIPSE.radius;
    canvas.each((px, py) => {
      const x = px + 0.5, yy = py + 0.5;
      const y = flip ? height - yy : yy;
      const dist = Math.hypot(x - cx, y - cy);
      const out = dist - ECLIPSE.radius;
      if (out < -2) return null;
      const edge = smooth(-2, 1.5, out);
      const angle = Math.atan2(x - cx, cy - y);
      const along = angle * ECLIPSE.radius;
      const rim = Math.exp(-out / 5) * 1.15 + Math.exp(-out / 22) * 0.34 + Math.exp(-out / 70) * 0.06;
      let value = streamers ? 0 : rim;
      if (streamers) {
        const lean = along / 60 + out / 420;
        const plume = fbm(lean, out / 190 + seed, seed, 4) * 0.6 + ridged(along / 23 + 5, out / 320, seed + 9, 4) * 0.55;
        const length = 60 + 150 * smooth(0.35, 0.75, noise(along / 150 + 2, 0.5, seed + 21));
        value = clamp((plume - 0.42) * 2.3) * Math.exp(-out / length) * 0.8 * smooth(0, 9, out) * (1 - smooth(reach * 0.5, reach * 0.97, out));
      }
      const centred = 1 - 0.35 * smooth(0.1, 0.47, Math.abs(x - cx) / W);
      const color = coronaRamp(clamp(value * centred));
      return [color[0] * edge, color[1] * edge, color[2] * edge];
    });
    canvas.grain(seed + 3, 0.08, 0);
    art[name] = await canvas.webp({ transparent: true, display: true, quality: 80 });
  }
  {
    await corona('dome-rim', { seed: 3 });
    await corona('dome-streamers-a', { seed: 11, streamers: true });
    await corona('dome-streamers-b', { seed: 29, streamers: true });
    await corona('bowl-rim', { seed: 5, flip: true });
    await corona('bowl-streamers', { seed: 37, streamers: true, flip: true });
  }
  return art;
}
