import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';
import sharp from 'sharp';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const OUT = path.join(ROOT, 'assets', 'profile');
const CACHE = path.join(HERE, '.cache');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(CACHE, { recursive: true });

const OWNER = 'Marve10s';
const RAW = 'https://raw.githubusercontent.com';

const mix = (from, to, amount) => {
  const channel = (hex, i) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2].map((i) => Math.round(channel(from, i) + (channel(to, i) - channel(from, i)) * amount).toString(16).padStart(2, '0')).join('')}`;
};
const THEME = { bg: '#000000', title: '#F4F2EC', soft: '#A8A59D', dim: '#6D6A64', border: '#232323', chip: '#111111' };
const NEUTRAL_GLOW = '#CFCBC2';

const fontPath = (pkg, file) => path.join(HERE, 'node_modules', '@fontsource', pkg, 'files', file);
const parseFont = (file) => {
  const b = fs.readFileSync(file);
  return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
};
const font = (pkg, file) => parseFont(fontPath(pkg, file));
const PIXEL = parseFont(path.join(HERE, 'fonts', 'GeistPixel-Grid.ttf'));
const REG = font('geist-sans', 'geist-sans-latin-400-normal.woff');
const SANS = font('geist-sans', 'geist-sans-latin-500-normal.woff');
const BOLD = font('geist-sans', 'geist-sans-latin-600-normal.woff');
const monoWoff2 = fs.readFileSync(fontPath('geist-mono', 'geist-mono-latin-500-normal.woff2')).toString('base64');
const boldWoff2 = fs.readFileSync(fontPath('geist-sans', 'geist-sans-latin-600-normal.woff2')).toString('base64');
const ICONS = JSON.parse(fs.readFileSync(path.join(HERE, 'icons.json'), 'utf8'));

const width = (f, s, size, track = 0) => f.getAdvanceWidth(s, size) + track * (s.length - 1);
function outline(f, s, x, y, size, { anchor = 'start', track = 0 } = {}) {
  const w = width(f, s, size, track);
  const x0 = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x;
  return f.getPath(s, x0, y, size, { letterSpacing: track / size }).toPathData(size > 30 ? 1 : 2);
}
const text = (f, s, x, y, size, fill, o = {}) => `<path fill="${fill}" d="${outline(f, s, x, y, size, o)}"/>`;
const pixelText = (s, x, y, size, fill, { anchor = 'start' } = {}) => {
  const w = width(PIXEL, s, size);
  const x0 = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x;
  return `<path fill="${fill}" transform="translate(${x0.toFixed(2)} ${y}) scale(${size / PIXEL.unitsPerEm})" d="${PIXEL.getPath(s, 0, 0, PIXEL.unitsPerEm).toPathData(0)}"/>`;
};
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const compact = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '')}k` : String(n));
const millions = (n) => `${(n / 1e6).toFixed(1)}M`;
const billions = (n) => `${(n / 1e9).toFixed(1)}B`;
const plural = (n, word) => `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`;

function icon(name, x, y, size, fill) {
  const { viewBox: [vx, vy, vw, vh], body } = ICONS[name];
  const scale = size / Math.max(vw, vh);
  const dx = x + (size - vw * scale) / 2 - vx * scale;
  const dy = y + (size - vh * scale) / 2 - vy * scale;
  return `<g transform="translate(${dx.toFixed(2)} ${dy.toFixed(2)}) scale(${scale.toFixed(4)})" fill="${fill}">${body}</g>`;
}

const headers = () => {
  const base = { accept: 'application/vnd.github+json', 'user-agent': 'profile-readme' };
  return process.env.GITHUB_TOKEN ? { ...base, authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : base;
};

async function github(endpoint) {
  const res = await fetch(`https://api.github.com/${endpoint}`, { headers: headers() });
  if (!res.ok) throw new Error(`${res.status} ${endpoint}`);
  return res.json();
}

async function graphql(query, variables) {
  if (!process.env.GITHUB_TOKEN) throw new Error('GITHUB_TOKEN is required for the GraphQL API');
  const res = await fetch('https://api.github.com/graphql', { method: 'POST', headers: headers(), body: JSON.stringify({ query, variables }) });
  const body = await res.json();
  if (!res.ok || body.errors) throw new Error(`graphql ${res.status} ${JSON.stringify(body.errors ?? body)}`);
  return body.data;
}

async function weeklyDownloads(pkg) {
  const res = await fetch(`https://api.npmjs.org/downloads/point/last-week/${pkg}`);
  if (!res.ok) throw new Error(`${res.status} npm downloads ${pkg}`);
  return (await res.json()).downloads;
}

async function raw(url) {
  const file = path.join(CACHE, url.replace(/[^a-z0-9.]+/gi, '_').slice(-80));
  if (!fs.existsSync(file)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  return fs.readFileSync(file);
}

const webp = async (img, quality = 70) => `data:image/webp;base64,${(await img.webp({ quality }).toBuffer()).toString('base64')}`;

async function still(src, w, h, quality = 70) {
  let img = sharp(await raw(src.url));
  if (src.crop) img = img.extract({ left: src.crop[0], top: src.crop[1], width: src.crop[2], height: src.crop[3] });
  return webp(img.resize(w * 2, h * 2, { fit: 'cover', position: src.pos ?? 'centre' }), quality);
}

function slideshow(images, w, h, { hold = 3, fade = 0.8 } = {}) {
  const n = images.length;
  const cycle = (hold + fade) * n;
  const pct = (s) => +(s / cycle * 100).toFixed(3);
  let css = '', out = '';
  images.forEach((img, i) => {
    if (i > 0) {
      const a = i * (hold + fade), start = a - fade, end = a + hold;
      const tail = i === n - 1 ? '' : `${pct(end + fade)}%,`;
      css += `@keyframes s${i}{0%,${pct(start)}%{opacity:0}${pct(a)}%,${pct(end)}%{opacity:1}${tail}100%{opacity:${i === n - 1 ? 1 : 0}}}.s${i}{animation:s${i} ${cycle}s linear infinite}`;
    }
    out += `<image href="${img}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"${i ? ` class="s${i}"` : ''}/>`;
  });
  return { css, art: () => out };
}

function star(x, y, r, fill) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * 0.45 : r;
    pts.push(`${(x + q * Math.cos(a)).toFixed(2)},${(y + q * Math.sin(a)).toFixed(2)}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="${fill}"/>`;
}

const ENTER = '@keyframes in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}.in{animation:in .45s cubic-bezier(.2,.8,.2,1) both}.gr{transform-box:view-box}';
const STILL = '@media (prefers-reduced-motion:reduce){*{animation:none!important}}';
const rise = (step, inner) => `<g class="in" style="animation-delay:${(step * 0.045).toFixed(3)}s">${inner}</g>`;

const seeded = (seed) => {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
};
let serial = 0;
const uid = (prefix) => `${prefix}${serial++}`;
const SWAY = 'calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1"';

const GRAIN_SIZE = 128;
const GRAIN_DENSITY = 2;
const grainPixels = (() => {
  const size = GRAIN_SIZE * GRAIN_DENSITY, random = seeded(23), radius = 1.1, reach = Math.ceil(radius * 3);
  const white = Float32Array.from({ length: size * size }, () => random() + random() + random() - 1.5);
  const kernel = Array.from({ length: reach * 2 + 1 }, (_, i) => Math.exp(-((i - reach) ** 2) / (2 * radius * radius)));
  const kernelSum = kernel.reduce((sum, weight) => sum + weight, 0);
  const blurAlong = (source, stepX, stepY) => Float32Array.from({ length: size * size }, (_, index) => {
    const x = index % size, y = (index - x) / size;
    return kernel.reduce((sum, weight, k) => sum + weight * source[((y + (k - reach) * stepY + size) % size) * size + ((x + (k - reach) * stepX + size) % size)], 0) / kernelSum;
  });
  const soft = blurAlong(blurAlong(white, 1, 0), 0, 1);
  const fine = white.map((value, index) => value - soft[index]);
  const deviation = Math.sqrt(fine.reduce((sum, value) => sum + value * value, 0) / fine.length);
  return Buffer.from(Array.from(fine, (value) => [0, Math.max(0, Math.min(255, Math.round((0.24 + (value / deviation) * 0.34) * 255)))]).flat());
})();
const GRAIN_IMAGE = `data:image/png;base64,${(await sharp(grainPixels, { raw: { width: GRAIN_SIZE * GRAIN_DENSITY, height: GRAIN_SIZE * GRAIN_DENSITY, channels: 2 } }).png({ palette: true, colours: 16, compressionLevel: 9, effort: 10 }).toBuffer()).toString('base64')}`;
const GRAIN_DEFS = `<pattern id="grain" width="${GRAIN_SIZE}" height="${GRAIN_SIZE}" patternUnits="userSpaceOnUse"><image href="${GRAIN_IMAGE}" width="${GRAIN_SIZE}" height="${GRAIN_SIZE}"/></pattern>`;
const GRAIN_FRAMES = 12;
const grainJump = seeded(41);
const GRAIN_CSS = `@keyframes gr{${Array.from({ length: GRAIN_FRAMES }, (_, i) => `${(i / GRAIN_FRAMES * 100).toFixed(2)}%{transform:translate(${-Math.floor(grainJump() * GRAIN_SIZE)}px,${-Math.floor(grainJump() * GRAIN_SIZE)}px)}`).join('')}}.gr{animation:gr .75s steps(1) infinite}`;
const grain = (x, y, w, h, strength = 0.9) => `<g opacity="${strength}"><rect class="gr" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(w + GRAIN_SIZE).toFixed(1)}" height="${(h + GRAIN_SIZE).toFixed(1)}" fill="url(#grain)"/></g>`;

const light = (hex) => {
  const channels = [0, 1, 2].map((i) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16));
  const peak = Math.max(...channels, 1);
  return `stop-color="#${channels.map((value) => Math.round(value * 255 / peak).toString(16).padStart(2, '0')).join('')}" stop-opacity="${(peak / 255).toFixed(3)}"`;
};
const BAND = [[30, '#000000'], [22, '#1E0000'], [16, '#5C1004'], [12, '#96492A'], [8, '#C68E6E'], [4, '#E8C4AE'], [0, '#F6E9E6'], [-5, '#C4BEE2'], [-10, '#9A93D8'], [-16, '#5A4CB8'], [-22, '#2A1A7A'], [-28, '#07072E'], [-34, '#000000']];
const FLARE = [[0, '#FFFFFF'], [0.06, '#FDF7F8'], [0.12, '#F3E2E0'], [0.2, '#DDBDB4'], [0.28, '#C99F86'], [0.36, '#B4805C'], [0.44, '#9A5332'], [0.52, '#74290C'], [0.62, '#4E0C00'], [0.75, '#2A0000'], [0.88, '#0E0000'], [1, '#000000']];
const SUN_CYCLE = 86, SUN_CROSSING = 0.96;

function sunRays(seed, reach, gradient) {
  const next = seeded(seed);
  const spokes = Array.from({ length: 16 }, (_, i) => [((i + 0.15 + 0.7 * next()) / 16) * 360, 0.075 + 0.05 * next(), 0.5 + 0.5 * next()]);
  spokes.push([90, 0.12, 1], [-90, 0.13, 0.97]);
  return spokes.map(([angle, spread, power]) => {
    const length = reach * (0.82 + 0.3 * power);
    return `<ellipse cx="${(length / 2).toFixed(1)}" cy="0" rx="${(length / 2).toFixed(1)}" ry="${(length * spread * 0.62).toFixed(1)}" fill="url(#${gradient})" opacity="${(0.45 + 0.5 * power).toFixed(2)}" transform="rotate(${angle.toFixed(1)})"/>`;
  }).join('');
}

function sun(reach) {
  const glow = uid('s'), ray = uid('s');
  const defs = `<radialGradient id="${glow}">${FLARE.map(([at, color]) => `<stop offset="${at}" ${light(color)}/>`).join('')}</radialGradient>
<radialGradient id="${ray}" cx=".5" cy=".5" r=".5" fx=".03" fy=".5"><stop offset="0" stop-color="#FFF1E2" stop-opacity=".95"/><stop offset=".22" stop-color="#D9A27C" stop-opacity=".6"/><stop offset=".55" stop-color="#8A3A14" stop-opacity=".3"/><stop offset="1" stop-color="#8A3A14" stop-opacity="0"/></radialGradient>`;
  const layer = (seed, lead, turn) => `<g opacity=".5"><animate attributeName="opacity" values="${lead ? '1;0;1' : '0;1;0'}" dur="7.85s" ${SWAY} repeatCount="indefinite"/><g><animateTransform attributeName="transform" type="rotate" values="${-turn};${turn};${-turn}" dur="29.9s" ${SWAY} repeatCount="indefinite"/>${sunRays(seed, reach, ray)}</g></g>`;
  const body = `<g><animateTransform attributeName="transform" type="scale" values="1;1.045;0.97;1.02;1" dur="12.1s" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1;.45 0 .55 1;.45 0 .55 1" repeatCount="indefinite"/><ellipse rx="${(reach * 0.92).toFixed(1)}" ry="${(reach * 0.8).toFixed(1)}" fill="url(#${glow})"/><g opacity="0"><animate attributeName="opacity" values="0;1" begin="1.2s" dur="1.6s" calcMode="spline" keySplines=".4 0 .6 1" fill="freeze"/>${layer(71, false, 2.9)}${layer(113, true, -2.9)}</g></g>`;
  return { defs, body };
}

function horizon({ W, H, crest, sag, startAt = 0.143, reach = 66 }) {
  const half = W / 2, R = (half * half + sag * sag) / (2 * sag), cx = half, cy = crest + R;
  const outer = R + 34;
  const ring = uid('h'), follow = uid('h'), reveal = uid('h');
  const xAt = (fraction) => W * (0.05 + 0.9 * fraction);
  const angle = (fraction) => (Math.asin((xAt(fraction) - cx) / R) * 180 / Math.PI).toFixed(3);
  const startFraction = (startAt - 0.05) / 0.9;
  const begin = `-${(startFraction * SUN_CROSSING * SUN_CYCLE).toFixed(2)}s`;
  const flare = sun(reach);
  const travel = `keyTimes="0;${SUN_CROSSING};1" dur="${SUN_CYCLE}s" begin="${begin}" repeatCount="indefinite"`;
  const dim = [[0, 0.42], [0.2, 0.33], [0.3, 0.21], [0.4, 0.08], [0.5, 0], [0.6, 0.08], [0.7, 0.21], [0.8, 0.33], [1, 0.42]];
  return `<defs><radialGradient id="${ring}" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy.toFixed(1)}" r="${outer.toFixed(1)}">${BAND.map(([offset, color]) => `<stop offset="${((R - offset) / outer).toFixed(5)}" stop-color="${color}"/>`).join('')}</radialGradient>
<linearGradient id="${follow}" gradientUnits="userSpaceOnUse" x1="${-1.5 * W}" x2="${1.5 * W}">${dim.map(([at, alpha]) => `<stop offset="${at}" stop-color="#000" stop-opacity="${alpha}"/>`).join('')}</linearGradient>
<linearGradient id="${reveal}" gradientUnits="userSpaceOnUse" x1="${-1.5 * W}" x2="${1.5 * W}"><stop offset="0" stop-color="#000" stop-opacity=".86"/><stop offset=".2" stop-color="#000" stop-opacity="0"/><stop offset=".8" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".86"/></linearGradient>${flare.defs}</defs>
<g opacity="0"><animate attributeName="opacity" values="0;1" begin="0.15s" dur="1.15s" calcMode="spline" keySplines=".4 0 .6 1" fill="freeze"/><circle cx="${cx}" cy="${cy.toFixed(1)}" r="${outer.toFixed(1)}" fill="url(#${ring})"/></g>
<g><animateTransform attributeName="transform" type="translate" values="${xAt(0).toFixed(1)} 0;${xAt(1).toFixed(1)} 0;${xAt(1).toFixed(1)} 0" ${travel}/><rect x="${-3 * W}" y="0" width="${6 * W}" height="${H}" fill="url(#${follow})"/></g>
<g transform="translate(${xAt(startFraction).toFixed(1)} 0)"><set attributeName="display" to="none" begin="3.4s"/><g transform="scale(0.02 1)"><animateTransform attributeName="transform" type="scale" values="0.02 1;1 1" begin="0.45s" dur="2.1s" calcMode="spline" keySplines=".2 .65 .35 1" fill="freeze"/><rect x="${-40 * W}" y="0" width="${80 * W}" height="${H}" fill="url(#${reveal})"/></g></g>
<g><animateTransform attributeName="transform" type="rotate" values="${angle(0)} ${cx} ${cy.toFixed(1)};${angle(1)} ${cx} ${cy.toFixed(1)};${angle(1)} ${cx} ${cy.toFixed(1)}" ${travel}/>
<g transform="translate(${cx} ${crest})"><g><animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;0.056;0.904;${SUN_CROSSING};1" dur="${SUN_CYCLE}s" begin="${begin}" repeatCount="indefinite"/>
<g transform="scale(0)"><animateTransform attributeName="transform" type="scale" values="0;1" begin="0.3s" dur="2.7s" calcMode="spline" keySplines=".12 .7 .2 1" fill="freeze"/>${flare.body}</g></g></g></g>
${grain(0, 0, W, H)}`;
}

function eclipse({ cx, cy, r, hues: [outerHue, innerHue] }) {
  const corona = uid('e'), streak = uid('e'), bead = uid('e');
  const outer = r * 2.5;
  const at = (radius) => (radius / outer).toFixed(4);
  const next = seeded(Math.round(cx + r));
  const streamers = (turn, lead) => `<g opacity=".5"><animate attributeName="opacity" values="${lead ? '.85;.25;.85' : '.25;.85;.25'}" dur="11s" ${SWAY} repeatCount="indefinite"/><g><animateTransform attributeName="transform" type="rotate" values="${-turn};${turn};${-turn}" dur="46s" ${SWAY} repeatCount="indefinite"/>${Array.from({ length: 11 }, (_, i) => {
    const length = r * (1.7 + 1.1 * next());
    return `<ellipse cx="${(length / 2).toFixed(1)}" cy="0" rx="${(length / 2).toFixed(1)}" ry="${(length * (0.05 + 0.05 * next())).toFixed(1)}" fill="url(#${streak})" transform="rotate(${((i + next() * 0.8) / 11 * 360).toFixed(1)})"/>`;
  }).join('')}</g></g>`;
  return `<defs><radialGradient id="${corona}" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${outer}"><stop offset="${at(r * 0.9)}" stop-color="#fff" stop-opacity="0"/><stop offset="${at(r * 0.99)}" stop-color="#fff"/><stop offset="${at(r * 1.08)}" stop-color="${mix(innerHue, '#FFFFFF', 0.55)}" stop-opacity=".95"/><stop offset="${at(r * 1.3)}" stop-color="${innerHue}" stop-opacity=".5"/><stop offset="${at(r * 1.75)}" stop-color="${outerHue}" stop-opacity=".22"/><stop offset="1" stop-color="${outerHue}" stop-opacity="0"/></radialGradient>
<radialGradient id="${streak}" cx=".5" cy=".5" r=".5" fx=".05" fy=".5"><stop offset="0" stop-color="${mix(innerHue, '#FFFFFF', 0.7)}" stop-opacity=".9"/><stop offset=".45" stop-color="${innerHue}" stop-opacity=".35"/><stop offset="1" stop-color="${outerHue}" stop-opacity="0"/></radialGradient>
<radialGradient id="${bead}"><stop offset="0" stop-color="#fff"/><stop offset=".25" stop-color="#fff" stop-opacity=".85"/><stop offset=".6" stop-color="${innerHue}" stop-opacity=".35"/><stop offset="1" stop-color="${innerHue}" stop-opacity="0"/></radialGradient></defs>
<g transform="translate(${cx} ${cy})">${streamers(5, false)}${streamers(-5, true)}</g>
<circle cx="${cx}" cy="${cy}" r="${outer}" fill="url(#${corona})"/><circle cx="${cx}" cy="${cy}" r="${(r * 0.985).toFixed(1)}" fill="#000"/>
<g><animateTransform attributeName="transform" type="rotate" values="-160 ${cx} ${cy};-110 ${cx} ${cy};-160 ${cx} ${cy}" dur="38s" ${SWAY} repeatCount="indefinite"/><g transform="translate(${cx} ${cy - r})"><circle r="${(r * 0.42).toFixed(1)}" fill="url(#${bead})"><animate attributeName="r" values="${(r * 0.36).toFixed(1)};${(r * 0.5).toFixed(1)};${(r * 0.36).toFixed(1)}" dur="6.5s" ${SWAY} repeatCount="indefinite"/></circle></g></g>`;
}

function tile({ w = 423, h = 196, plate = 62, theme, name, desc, right, sub, title, delay = 0, backdrop }) {
  return ({ css = '', art }) => {
    const gx = 5, tw = w - gx * 2, th = h - 4, ih = th - plate;
    const nameSize = 20, descSize = 13.5, pad = 16;
    const y1 = ih + 26, y2 = ih + 46;
    const rx = tw - pad;
    let side = '';
    if (right?.star) {
      const s = width(BOLD, right.star, nameSize - 3);
      side += text(BOLD, right.star, rx, y1 - 0.5, nameSize - 3, theme.title, { anchor: 'end' }) + star(rx - s - 9, y1 - 5.5, 5.6, theme.title);
    } else if (right?.label) {
      side += text(SANS, right.label, rx, y1 - 0.5, descSize, theme.soft, { anchor: 'end' });
    }
    if (sub) side += text(SANS, sub, rx, y2, descSize, theme.dim, { anchor: 'end' });
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title><defs><clipPath id="c"><rect width="${tw}" height="${th}" rx="12"/></clipPath><clipPath id="ia"><rect width="${tw}" height="${ih}"/></clipPath>${backdrop ? GRAIN_DEFS : ''}</defs>
<style>${ENTER}${backdrop ? GRAIN_CSS : ''}${css}.d{animation-delay:${delay}s}${STILL}</style>
<g transform="translate(${gx} 0)"><g clip-path="url(#c)"><rect width="${tw}" height="${th}" fill="${theme.bg}"/>${backdrop ?? ''}<g clip-path="url(#ia)"><g class="in d">${art(tw, ih)}</g></g>${backdrop ? '' : `<path d="M0 ${ih + 0.5}H${tw}" stroke="${theme.border}"/>`}
<g class="in d">${text(BOLD, name, pad, y1, nameSize, theme.title, { track: -0.2 })}${text(SANS, desc, pad, y2, descSize, theme.soft)}${side}</g></g>
<rect x=".5" y=".5" width="${tw - 1}" height="${th - 1}" rx="12" fill="none" stroke="${theme.border}"/></g>
</svg>`;
  };
}

function scrollingList(names, w, h, theme, { size = 11, lead = 17, speed = 10 } = {}) {
  const colW = w / 3, perCol = Math.ceil(names.length / 3);
  const columns = [0, 1, 2].map((c) => names.slice(c * perCol, (c + 1) * perCol));
  const block = perCol * lead;
  const defs = columns.map((list, c) => `<g id="col${c}">${list.map((n, i) => `<text x="${16 + c * colW}" y="${16 + i * lead}" class="${(i + c) % 5 === 2 ? 'hi' : 'lo'}">${esc(n)}</text>`).join('')}</g>`).join('');
  const body = columns.map((_, c) => `<g class="sc${c}"><use href="#col${c}"/><use href="#col${c}" y="${block}"/></g>`).join('');
  const css = `@font-face{font-family:GM;src:url(data:font/woff2;base64,${monoWoff2}) format('woff2')}text{font-family:GM,ui-monospace,Menlo,monospace;font-size:${size}px;white-space:pre}.lo{fill:${theme.dim}}.hi{fill:${theme.title}}`
    + [0, 1, 2].map((c) => `@keyframes sc${c}{from{transform:translateY(${-block * (c / 3)}px)}to{transform:translateY(${-block * (1 + c / 3)}px)}}.sc${c}{animation:sc${c} ${block / (speed + c * 2)}s linear infinite}`).join('');
  const fade = `<linearGradient id="fd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${theme.bg}"/><stop offset=".22" stop-color="${theme.bg}" stop-opacity="0"/><stop offset=".72" stop-color="${theme.bg}" stop-opacity="0"/><stop offset="1" stop-color="${theme.bg}"/></linearGradient>`;
  return { css, art: () => `<defs>${fade}${defs}</defs>${body}<rect width="${w}" height="${h}" fill="url(#fd)"/>` };
}

function statsArt({ logo, headline, caption, header, columns }, w, h, theme) {
  const size = 36, x = 20, cy = h / 2 - 9;
  const numX = x + size + 12;
  const leftEnd = numX + Math.max(width(BOLD, headline, 26, -0.6), width(SANS, caption, 12));
  const sepX = leftEnd + 16;
  const startX = sepX + 18, gap = 16;
  let cx = startX;
  const stats = columns.map(([value, label]) => {
    const out = `${text(BOLD, value, cx, cy + 8, 19, theme.title, { track: -0.4 })}${text(SANS, label, cx, cy + 26, 11.5, theme.soft)}`;
    cx += Math.max(width(BOLD, value, 19, -0.4), width(SANS, label, 11.5)) + gap;
    return out;
  }).join('');
  const art = () => `<clipPath id="sl"><rect x="${x}" y="${cy - size / 2}" width="${size}" height="${size}" rx="9"/></clipPath><image href="${logo}" x="${x}" y="${cy - size / 2}" width="${size}" height="${size}" clip-path="url(#sl)"/>${text(BOLD, headline, numX, cy + 5, 26, theme.title, { track: -0.6 })}${text(SANS, caption, numX, cy + 23, 12, theme.soft)}<path d="M${sepX + 0.5} ${cy - 30}V${cy + 30}" stroke="#3A3A3D"/>${header(startX, cy - 20)}${stats}`;
  return { art };
}

const write = (name, svg) => {
  const clean = svg.replace(/\n/g, '');
  fs.writeFileSync(path.join(OUT, name), clean);
  console.log(name.padEnd(28), `${(Buffer.byteLength(clean) / 1024).toFixed(0)} KB`);
};

const FULL = 846, GUTTER = 5, INNER = FULL - GUTTER * 2, PAD = 28;

function card(name, { height, theme, title, css = '', body, grainy = false }) {
  write(name, `<svg xmlns="http://www.w3.org/2000/svg" width="${FULL}" height="${height}" viewBox="0 0 ${FULL} ${height}" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title>${grainy ? `<defs>${GRAIN_DEFS}</defs>` : ''}<style>${ENTER}${grainy ? GRAIN_CSS : ''}${css}${STILL}</style>
<g transform="translate(${GUTTER} 0)"><rect x=".5" y=".5" width="${INNER - 1}" height="${height - 1}" rx="14" fill="${theme.bg}" stroke="${theme.border}"/>${body}</g>
</svg>`);
}

function tab(name, label, lead = 26) {
  const middle = FULL / 2, rise = 31, flare = 12, corner = 10;
  const half = (width(PIXEL, label, 15) + 44) / 2, height = lead + rise, top = lead + 0.5;
  const left = middle - half, right = middle + half;
  const outline = `M${(left - flare).toFixed(1)} ${height}Q${left.toFixed(1)} ${height} ${left.toFixed(1)} ${height - flare}V${top + corner}Q${left.toFixed(1)} ${top} ${(left + corner).toFixed(1)} ${top}H${(right - corner).toFixed(1)}Q${right.toFixed(1)} ${top} ${right.toFixed(1)} ${top + corner}V${height - flare}Q${right.toFixed(1)} ${height} ${(right + flare).toFixed(1)} ${height}`;
  write(name, `<svg xmlns="http://www.w3.org/2000/svg" width="${FULL}" height="${height}" viewBox="0 0 ${FULL} ${height}" role="img" aria-label="${esc(label)}">
<title>${esc(label)}</title><path d="${outline}Z" fill="${THEME.bg}"/><path d="${outline}" fill="none" stroke="${THEME.border}"/>${pixelText(label, middle, lead + 21, 15, THEME.title, { anchor: 'middle' })}
</svg>`);
}

const dataUri = (file, bytes) => `data:${file.endsWith('.png') ? 'image/png' : 'image/svg+xml'};base64,${Buffer.from(bytes).toString('base64')}`;
const asset = (file) => dataUri(file, fs.readFileSync(path.join(ROOT, 'assets', file)));
const tinted = (file, fill) => dataUri(file, fs.readFileSync(path.join(ROOT, 'assets', file), 'utf8').replaceAll('#8F8B8A', fill));
const IMG = [423 - 10, 196 - 4 - 62];

const LIBRARIES = [
  { name: 'Effect', icon: 'effect', pkg: 'effect', users: ['Cloudflare', 'OpenRouter', 'OpenCode', 'T3 Code'] },
  { name: 'Material UI', icon: 'mui', brand: '#007FFF', pkg: '@mui/material', users: ['Netflix', 'NASA', 'Spotify', 'Amazon'] },
  { name: 'React Native', icon: 'react', brand: '#149ECA', pkg: 'react-native', users: ['Meta', 'Microsoft', 'Amazon', 'Shopify'] },
  { name: 'React Hook Form', icon: 'reacthookform', brand: '#EC5990', pkg: 'react-hook-form', users: ['Grafana', 'Supabase'] },
  { name: 'tRPC', icon: 'trpc', brand: '#398CCB', pkg: '@trpc/server', users: ['Netflix'] },
  { name: 'Cheerio', icon: 'cheerio', brand: '#E88C1F', pkg: 'cheerio', users: ['Google'] },
  { name: 'Floating UI', image: 'logos/used-by/floating-ui.png', pkg: '@floating-ui/dom', users: ['Palantir'] },
];

const COMPANIES = [
  ['Netflix', 'netflix', '#E50914'], ['Meta', 'meta', '#0081FB'], ['Google', 'google', '#4285F4'], ['Microsoft', 'microsoft'], ['Amazon', 'amazon', '#FF9900'],
  ['Cloudflare', 'cloudflare', '#F38020'], ['Spotify', 'spotify', '#1DB954'], ['NASA', 'nasa', '#E03C31'], ['Shopify', 'shopify', '#7AB55C'], ['Palantir', 'palantir'],
  ['Grafana', 'grafana', '#F46800'], ['Supabase', 'supabase', '#3FCF8E'], ['OpenRouter', 'openrouter'], ['OpenCode', 'opencode'], ['T3 Code', 't3'],
];

const SKILLS = [
  ['Languages & frameworks', [['TypeScript', 'typescript'], ['JavaScript', 'javascript'], ['React', 'react'], ['TanStack', 'tanstack'], ['Astro', 'astro'], ['Next.js', 'nextdotjs'], ['Effect-TS', 'effect']]],
  ['Apps & interfaces', [['React Native', 'react'], ['Expo', 'expo'], ['Electron', 'electron'], ['WXT', 'wxt'], ['Tailwind CSS', 'tailwindcss'], ['shadcn/ui', 'shadcnui'], ['Motion', 'motion']]],
  ['Backend & data', [['TanStack Start', 'tanstack'], ['HonoJS', 'hono'], ['Supabase', 'supabase'], ['PostgreSQL', 'postgresql'], ['Drizzle ORM', 'drizzle'], ['Convex', 'convex'], ['Bun', 'bun']]],
  ['Infrastructure & tools', [['Kubernetes', 'kubernetes'], ['GitHub Actions', 'githubactions'], ['RunPod', 'runpod'], ['Modal', 'modal'], ['AWS', 'amazonwebservices'], ['GitHub', 'github'], ['Codex', 'openai'], ['Claude Code', 'claude'], ['Vercel', 'vercel'], ['Railway', 'railway'], ['Render', 'render'], ['Netlify', 'netlify']]],
];

let libraries;
const [bfs, awesome, downloads] = await Promise.all([
  github(`repos/${OWNER}/Better-Fullstack`),
  github(`repos/${OWNER}/awesome-effect`),
  Promise.all(LIBRARIES.map(({ pkg }) => weeklyDownloads(pkg))),
]);

{
  const theme = THEME;
  const row = { W: 836, H: 192, crest: 100, sag: 30 };
  const sky = (offset) => `<g transform="translate(${-offset} 0)">${horizon(row)}</g>`;
  const platforms = ['web', 'apple', 'android', 'electron', 'googlechrome'].map((name) => tinted(`icons/platforms/${name}.svg`, theme.dim));
  const header = (x, y) => platforms.map((image, i) => `<image href="${image}" x="${x + i * 22}" y="${y - 12}" width="15" height="15"/>`).join('');
  const art = statsArt({ logo: asset('logos/listening.svg'), headline: '20k+', caption: 'audio hours a month', header, columns: [['11k+', 'monthly users'], ['600k+', 'lines of code']] }, ...IMG, theme);
  write('tile-listening.svg', tile({ theme, backdrop: sky(0), name: 'Listening.com', desc: 'Senior Full Stack Engineer', right: { label: 'Dec 2024 – now' }, sub: 'listening.com', title: 'Listening.com: Senior Full Stack Engineer, December 2024 to now. 20k+ hours of audio a month and 11k+ monthly users across the web, iOS, Android, desktop and Chrome extension apps, on a 600k+ line codebase.' })(art));

  const png = async (file) => `data:image/png;base64,${(await sharp(path.join(ROOT, 'assets', file)).resize(96, 96).png().toBuffer()).toString('base64')}`;
  const giftsong = await png('logos/giftsong.png');
  const giftsongHeader = (x, y) => `<image href="${giftsong}" x="${x}" y="${y - 13}" width="17" height="17"/>${text(SANS, 'GiftSong.ai', x + 22, y, 12, theme.soft)}`;
  const upwork = statsArt({ logo: await png('logos/upwork.png'), headline: '10+', caption: 'client projects', header: giftsongHeader, columns: [['650k+', 'songs'], ['148k', 'users'], ['38k+', 'audio hours']] }, ...IMG, theme);
  write('tile-upwork.svg', tile({ theme, backdrop: sky(423), name: 'Upwork', desc: 'Full Stack TypeScript Developer', right: { label: 'Jun 2024 – now' }, title: 'Upwork: Full Stack TypeScript Developer, June 2024 to now. 10+ client projects, including GiftSong.ai, an AI song gift app with 650k+ songs, 148k users and 38k+ hours of audio.', delay: 0.08 })(upwork));
}

{
  const theme = THEME;
  const essentials = ['TypeScript', 'React', 'React Native', 'Effect-TS', 'Next.js', 'TanStack', 'Astro', 'HonoJS', 'PostgreSQL', 'Kubernetes', 'Expo', 'Electron', 'Tailwind CSS', 'Supabase', 'Bun', 'AWS', 'Drizzle ORM', 'GitHub Actions'];
  const all = SKILLS.flatMap(([, skills]) => skills);
  const edge = 18, chipHeight = 31, chipGap = 7, rows = 2, inset = 16;
  const height = inset * 2 + rows * chipHeight + (rows - 1) * chipGap;
  const cta = `View all ${all.length}`;
  const ctaWidth = 14 + width(BOLD, cta, 13.5) + 9 + 10 + 13;
  const ctaX = INNER - edge - ctaWidth;
  const rowTop = (row) => inset + row * (chipHeight + chipGap);
  const rowEnd = (row) => (row === rows - 1 ? ctaX - chipGap : INNER - edge);
  let x = edge, row = 0, chips = '';
  for (const name of essentials) {
    const glyph = all.find(([skill]) => skill === name)?.[1];
    const chipWidth = 9 + 15 + 7 + width(REG, name, 13.5) + 11;
    if (!glyph || row >= rows) continue;
    if (x + chipWidth > rowEnd(row)) {
      row += 1;
      x = edge;
      if (row >= rows || x + chipWidth > rowEnd(row)) continue;
    }
    chips += `<rect x="${x.toFixed(1)}" y="${rowTop(row)}" width="${chipWidth.toFixed(1)}" height="${chipHeight}" rx="8" fill="${theme.chip}"/>${icon(glyph, x + 9, rowTop(row) + 8, 15, theme.title)}${text(REG, name, x + 31, rowTop(row) + 20.5, 13.5, theme.title)}`;
    x += chipWidth + chipGap;
  }
  const top = rowTop(rows - 1);
  const arrowX = ctaX + ctaWidth - 13 - 10, arrowY = top + chipHeight / 2;
  const button = `<rect x="${ctaX.toFixed(1)}" y="${top}" width="${ctaWidth.toFixed(1)}" height="${chipHeight}" rx="8" fill="${theme.title}"/>${text(BOLD, cta, ctaX + 14, top + 20.5, 13.5, '#0B0B0B')}<path d="M${arrowX.toFixed(1)} ${arrowY}h10m-4 -4l4 4l-4 4" fill="none" stroke="#0B0B0B" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`;
  const title = `Tech stack. ${SKILLS.map(([label, skills]) => `${label}: ${skills.map(([name]) => name).join(', ')}`).join('. ')}. The full list is on elkamali.dev.`;
  card('skills.svg', { height, theme, title, body: `${rise(0, chips)}${rise(3, button)}` });
}

{
  const og = (s) => `${RAW}/${OWNER}/Better-Fullstack/main/apps/web/public/og/stack-${s}-1200x630.png`;
  const frames = await Promise.all(['typescript', 'react-native', 'rust', 'python', 'go'].map((s) => still({ url: og(s), crop: [60, 150, 1080, 340] }, ...IMG, 72)));
  const s = slideshow(frames, ...IMG, { hold: 2.2, fade: 0.6 });
  const stars = compact(bfs.stargazers_count);
  write('tile-better-fullstack.svg', tile({ theme: THEME, name: 'Better Fullstack', desc: 'Full-stack apps in one command', right: { star: stars }, sub: 'better-fullstack.dev', title: `Better Fullstack: scaffold full-stack apps in TypeScript, React Native, Rust, Python, Go and more. ${stars} stars. better-fullstack.dev` })(s));
}

{
  const readme = (await raw(`${RAW}/${OWNER}/awesome-effect/main/README.md`)).toString();
  const names = [...readme.matchAll(/^- <img[^>]*> \[([^\]]+)\]\(/gm)].map((m) => m[1]).filter((n) => n.length <= 17 && /^[@a-z][\w./-]*$/.test(n));
  const picks = names.filter((_, i) => i % 2 === 0).slice(0, 36);
  const stars = compact(awesome.stargazers_count);
  write('tile-awesome-effect.svg', tile({ theme: THEME, name: 'awesome-effect', desc: 'The Effect ecosystem, curated', right: { star: stars }, sub: 'This Week in Effect #133', title: `awesome-effect: libraries, tools and learning material for Effect. ${stars} stars. Featured in This Week in Effect #133.`, delay: 0.08 })(scrollingList(picks, ...IMG, THEME)));
}

{
  const theme = THEME;
  const slots = LIBRARIES.length, hold = 2.2, fade = 0.5, total = +(slots * hold).toFixed(2);
  const pct = (t) => `${(t / total * 100).toFixed(3)}%`;
  const keyframes = new Map();
  const cycle = (prefix, active, on, off) => {
    const name = `${prefix}${active.join('')}`;
    if (!keyframes.has(name)) {
      const value = (slot) => (active.includes((slot + slots) % slots) ? on : off);
      const frames = Array.from({ length: slots }, (_, slot) => `${pct(slot * hold)}{opacity:${value(slot - 1)}}${pct(slot * hold + fade)}{opacity:${value(slot)}}`).join('');
      keyframes.set(name, `@keyframes ${name}{${frames}100%{opacity:${value(slots - 1)}}}.${name}{animation:${name} ${total}s ease-in-out infinite}`);
    }
    return name;
  };
  const glows = new Map();
  const glow = (color = NEUTRAL_GLOW) => {
    if (!glows.has(color)) glows.set(color, `glow${glows.size}`);
    return glows.get(color);
  };
  const listWidth = 270, rowHeight = 40, top = 62, gap = 8, columns = 5;
  const wallX = PAD + listWidth + 26;
  const tileWidth = (INNER - PAD - wallX - gap * (columns - 1)) / columns;
  const tileHeight = (slots * rowHeight - gap * 2) / 3;
  const totalDownloads = `${Math.floor(downloads.reduce((sum, n) => sum + n, 0) / 1e6)}M npm downloads a week`;
  const heading = 'Libraries I contribute to, and who uses them';

  const list = LIBRARIES.map((lib, i) => {
    const y = top + i * rowHeight;
    const mark = lib.image
      ? `<clipPath id="lib${i}"><rect x="${PAD + 12}" y="${y + 11}" width="18" height="18" rx="4"/></clipPath><image href="${asset(lib.image)}" x="${PAD + 12}" y="${y + 11}" width="18" height="18" clip-path="url(#lib${i})"/>`
      : icon(lib.icon, PAD + 12, y + 11, 18, lib.brand ?? theme.title);
    const spot = `<clipPath id="row${i}"><rect x="${PAD}" y="${y}" width="${listWidth}" height="${rowHeight}" rx="9"/></clipPath><g clip-path="url(#row${i})"><ellipse class="${cycle('q', [i], 0.5, 0)}" opacity="0" cx="${PAD}" cy="${y + rowHeight / 2}" rx="${listWidth * 0.7}" ry="${rowHeight * 1.8}" fill="url(#${glow(lib.brand)})"/></g>`;
    return rise(i + 1, `<rect class="${cycle('h', [i], 1, 0)}" opacity="0" x="${PAD}" y="${y}" width="${listWidth}" height="${rowHeight}" rx="9" fill="${theme.chip}"/>${spot}${mark}${text(BOLD, lib.name, PAD + 41, y + 25, 15, theme.title, { track: -0.18 })}${text(REG, millions(downloads[i]), PAD + listWidth - 12, y + 24.5, 13, theme.soft, { anchor: 'end' })}`);
  }).join('');

  const wall = COMPANIES.map(([company, glyph, brand], i) => {
    const x = wallX + (i % columns) * (tileWidth + gap);
    const y = top + Math.floor(i / columns) * (tileHeight + gap);
    const active = LIBRARIES.flatMap((lib, slot) => (lib.users.includes(company) ? [slot] : []));
    const frame = `x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${tileWidth.toFixed(1)}" height="${tileHeight.toFixed(1)}" rx="10"`;
    const spot = `<clipPath id="tile${i}"><rect ${frame}/></clipPath><g clip-path="url(#tile${i})"><rect ${frame} fill="${theme.chip}"/><ellipse class="${cycle('g', active, 1, 0)}" opacity="0" cx="${(x + tileWidth / 2).toFixed(1)}" cy="${(y + tileHeight * 1.25).toFixed(1)}" rx="${(tileWidth * 1.5).toFixed(1)}" ry="${(tileHeight * 1.2).toFixed(1)}" fill="url(#${glow(brand)})"/><g class="${cycle('n', active, 0.9, 0)}" opacity="0"><rect class="gr" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(tileWidth + GRAIN_SIZE).toFixed(1)}" height="${(tileHeight + GRAIN_SIZE).toFixed(1)}" fill="url(#grain)"/></g></g>`;
    const inner = `${spot}<rect class="${cycle('r', active, 1, 0)}" opacity="0" x="${(x + 0.75).toFixed(2)}" y="${(y + 0.75).toFixed(2)}" width="${(tileWidth - 1.5).toFixed(1)}" height="${(tileHeight - 1.5).toFixed(1)}" rx="9.25" fill="none" stroke="${theme.title}" stroke-width="1.5"/>${icon(glyph, x + tileWidth / 2 - 12, y + 20, 24, brand ?? theme.title)}${text(REG, company, x + tileWidth / 2, y + 65, 13, theme.title, { anchor: 'middle' })}`;
    return rise(i + 2, `<g class="${cycle('t', active, 1, 0.5)}">${inner}</g>`);
  }).join('');

  const glowDefs = [...glows].map(([color, name]) => `<radialGradient id="${name}"><stop offset="0" stop-color="${color}"/><stop offset=".12" stop-color="${color}"/><stop offset=".72" stop-color="${color}" stop-opacity="0"/></radialGradient>`).join('');
  const body = `<defs>${glowDefs}</defs>${rise(0, `${text(REG, heading, PAD, 39, 15, theme.soft)}${text(SANS, totalDownloads, INNER - PAD, 39, 15, theme.title, { anchor: 'end' })}`)}${list}${wall}`;
  const title = `${heading}. ${totalDownloads} combined. ${LIBRARIES.map((lib, i) => `${lib.name}, ${millions(downloads[i])} a week, used by ${lib.users.join(', ')}`).join('. ')}.`;
  libraries = { bottom: top + slots * rowHeight, title, css: [...keyframes.values()].join(''), body };
}

{
  const theme = THEME;
  const DISPLAY = {
    'Effect-TS/effect': 'Effect', 'pingdotgg/t3code': 'T3 Code', 'mui/material-ui': 'Material UI', 'react/react-native': 'React Native', 'sharkdp/bat': 'bat',
    'Emanuele-web04/synara': 'Synara', 'ianstormtaylor/slate': 'Slate', 'react-hook-form/react-hook-form': 'React Hook Form', 'trpc/trpc': 'tRPC',
    'floating-ui/floating-ui': 'Floating UI', 'cheeriojs/cheerio': 'Cheerio', 'immerjs/immer': 'Immer', 'TanStack/virtual': 'TanStack Virtual',
    'voidzero-dev/vite-plus': 'Vite+', 'react-hook-form/resolvers': 'RHF Resolvers',
  };
  const contributions = JSON.parse(fs.readFileSync(path.join(ROOT, 'profile', 'contrib', 'contributions.json'), 'utf8')).map((repo) => ({ ...repo, name: DISPLAY[repo.fullName] ?? repo.fullName.split('/')[1] }));
  const reach = (repo) => Math.sqrt(repo.prs * repo.stars);
  const ranked = [...contributions].sort((a, b) => reach(b) - reach(a));
  const lead = ranked.slice(0, 5), rest = ranked.slice(5);
  const tones = ['#8B5CF6', '#FF8A3C', '#3D9BFF', '#FF6FB5', '#FFB86B'];
  const mergedIn = (repos) => repos.reduce((sum, { prs }) => sum + prs, 0);
  const merged = mergedIn(contributions);
  const starTotal = contributions.reduce((sum, { stars }) => sum + stars, 0);
  const room = INNER - PAD * 2, right = INNER - PAD;

  const headRoom = room - 12, headSize = 36, headTrack = -1.1, lineHeight = 41, lastBaseline = 148;
  const headWidth = (line) => width(BOLD, line, headSize, headTrack);
  const wrap = (title) => {
    if (headWidth(title) <= headRoom) return [title];
    const words = title.split(' ');
    const splits = words.slice(1).map((_, cut) => [words.slice(0, cut + 1).join(' '), words.slice(cut + 1).join(' ')]).filter((lines) => lines.every((line) => headWidth(line) <= headRoom));
    return splits.sort((a, b) => Math.abs(headWidth(a[0]) - headWidth(a[1])) - Math.abs(headWidth(b[0]) - headWidth(b[1])))[0];
  };
  const slides = ranked.flatMap((repo) => {
    const pull = (repo.pulls ?? []).find(({ title }) => title.length <= 72 && wrap(title));
    return pull ? [{ repo, pull, lines: wrap(pull.title) }] : [];
  }).slice(0, 8);
  const hold = 3.6, cycle = slides.length * hold, share = 100 / slides.length;
  const css = `@font-face{font-family:GS;src:url(data:font/woff2;base64,${boldWoff2}) format('woff2');font-weight:600}.hl{font:600 ${headSize}px GS,system-ui,sans-serif;letter-spacing:${headTrack}px;fill:${theme.title}}@keyframes reel{0%{opacity:0;transform:translateY(8px)}${(share * 0.13).toFixed(2)}%,${(share * 0.88).toFixed(2)}%{opacity:1;transform:none}${share.toFixed(2)}%,100%{opacity:0;transform:translateY(-6px)}}.reel{animation:reel ${cycle.toFixed(1)}s linear both infinite}`;
  const mergedOn = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const mergeGlyph = 'M5.45 5.154A4.25 4.25 0 0 0 9.25 7.5h1.378a2.251 2.251 0 1 1 0 1.5H9.25A5.734 5.734 0 0 1 5 7.123v3.505a2.25 2.25 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.95-.218ZM4.25 13.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm8.5-4.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM5 3.25a.75.75 0 1 0 0 .005V3.25Z';
  const mark = (id, image, x, y, size) => `<clipPath id="${id}"><rect x="${x.toFixed(1)}" y="${y}" width="${size}" height="${size}" rx="5"/></clipPath><image href="${image}" x="${x.toFixed(1)}" y="${y}" width="${size}" height="${size}" clip-path="url(#${id})"/>`;
  const stage = slides.map(({ repo, pull, lines }, i) => {
    const first = lastBaseline - (lines.length - 1) * lineHeight;
    const row = first - headSize - 18;
    const nameEnd = PAD + 31 + width(BOLD, repo.name, 15, -0.15);
    const stamp = `merged ${mergedOn.format(new Date(pull.mergedAt))}`;
    const pillX = nameEnd + 10, pillWidth = 8 + 12 + 5 + width(SANS, stamp, 12) + 10;
    const number = pull.number ? text(REG, `#${pull.number}`, pillX + pillWidth + 9, row + 15, 12, theme.dim) : '';
    const meta = `${mark(`reel${i}`, repo.image, PAD, row, 22)}${text(BOLD, repo.name, PAD + 31, row + 16.5, 15, theme.title, { track: -0.15 })}<rect x="${pillX.toFixed(1)}" y="${row + 0.5}" width="${pillWidth.toFixed(1)}" height="21" rx="10.5" fill="#8B5CF6"/><g transform="translate(${(pillX + 8).toFixed(1)} ${row + 5}) scale(.75)"><path d="${mergeGlyph}" fill="#fff"/></g>${text(SANS, stamp, pillX + 25, row + 15, 12, '#FFFFFF')}${number}`;
    const headline = lines.map((line, at) => `<text class="hl" x="${PAD}" y="${first + at * lineHeight}">${esc(line)}</text>`).join('');
    return `<g class="reel" opacity="${i ? 0 : 1}" style="animation-delay:${(i * hold).toFixed(1)}s">${meta}${headline}</g>`;
  }).join('');

  const rule = 174, summaryLine = 215;
  const count = String(merged);
  const context = `${plural(contributions.length, 'repository').replace('repositorys', 'repositories')}, ${compact(starTotal)} stars between them`;
  const severities = [['Low', '#9CC7F0'], ['Moderate', '#F2C879'], ['High', '#FF9E9E']];
  let cursor = right;
  const marks = severities.map(([label, color]) => {
    cursor -= width(REG, label, 13);
    const out = `${text(REG, label, cursor, summaryLine + 1, 13, theme.soft)}<circle cx="${(cursor - 8).toFixed(1)}" cy="${summaryLine - 3.5}" r="3" fill="${color}"/>`;
    cursor -= 22;
    return out;
  }).join('');
  const summary = `${text(BOLD, count, PAD, summaryLine, 40, theme.title, { track: -1.6 })}${text(SANS, 'merged pull requests', PAD + width(BOLD, count, 40, -1.6) + 11, summaryLine, 19, theme.title, { track: -0.2 })}${text(REG, context, right, summaryLine - 19, 13, theme.soft, { anchor: 'end' })}${marks}${text(REG, '3 vulnerabilities reported in Effect', cursor + 4, summaryLine + 1, 13, theme.soft, { anchor: 'end' })}`;

  const tallyTop = 240, gap = 10, column = (room - gap * 5) / 6.5;
  const starred = (end, baseline, stars) => {
    const label = compact(stars), start = end - width(REG, label, 12);
    return `${text(REG, label, start, baseline, 12, theme.soft)}${star(start - 8.5, baseline - 4, 4.4, theme.soft)}`;
  };
  const fitted = (name, space, size) => Math.min(size, size * space / width(BOLD, name, size, -0.15));
  const cell = (x, tone) => `<path d="M${(x + 0.75).toFixed(2)} ${tallyTop}V${tallyTop + 76}" stroke="${tone}" stroke-opacity=".55" stroke-width="1.5"/>`;
  const tally = lead.map((repo, i) => {
    const x = PAD + i * (column + gap);
    return rise(4 + i, `${cell(x, tones[i])}${mark(`lead${i}`, repo.image, x + 11, tallyTop, 20)}${starred(x + column, tallyTop + 14.5, repo.stars)}${text(BOLD, repo.name, x + 11, tallyTop + 41, fitted(repo.name, column - 11, 13.5), theme.title, { track: -0.15 })}${text(BOLD, String(repo.prs), x + 11, tallyTop + 74, 34, tones[i], { track: -1.2 })}`);
  }).join('');
  const moreX = PAD + 5 * (column + gap), restMerged = String(mergedIn(rest));
  const more = rise(9, `${cell(moreX, theme.soft)}${rest.slice(0, 4).map((repo, at) => mark(`more${at}`, repo.image, moreX + 11 + at * 16, tallyTop, 20)).join('')}${text(BOLD, `${rest.length} more repositories`, moreX + 11, tallyTop + 41, 13.5, theme.title, { track: -0.15 })}${text(BOLD, restMerged, moreX + 11, tallyTop + 74, 34, theme.soft, { track: -1.2 })}${text(REG, 'PRs merged', moreX + 11 + width(BOLD, restMerged, 34, -1.2) + 8, tallyTop + 74, 12.5, theme.soft)}`);

  const title = `${merged} merged pull requests across ${contributions.length} repositories with ${compact(starTotal)} stars between them: ${ranked.map(({ name, prs }) => `${name} (${plural(prs, 'PR')})`).join(', ')}. Recent: ${slides.map(({ repo, pull }) => `${repo.name}, ${pull.title}`).join('; ')}. Security: 3 vulnerabilities reported in Effect, one high, one moderate and one low severity.`;
  const seam = libraries.bottom + 20;
  const reel = `${stage}<path d="M${PAD} ${rule + 0.5}H${right}" stroke="${theme.border}"/>${rise(2, summary)}${tally}${more}`;
  card('contributed.svg', { height: seam + tallyTop + 76 + 26, theme, title: `${libraries.title} ${title}`, css: `${libraries.css}${css}`, body: `${libraries.body}<path d="M${PAD} ${seam + 0.5}H${right}" stroke="${theme.border}"/><g transform="translate(0 ${seam})">${reel}</g>`, grainy: true });
}

tab('tab-experience.svg', 'Experience', 8);
tab('tab-stack.svg', 'Tech stack');
tab('tab-projects.svg', 'Projects');
tab('tab-contributed.svg', 'Contributed to');
tab('tab-stats.svg', 'GitHub stats');

{
  const theme = THEME;
  const calendar = 'contributionCalendar { totalContributions weeks { contributionDays { date contributionCount contributionLevel } } }';
  const { user } = await graphql(`query($login: String!) { user(login: $login) { createdAt pullRequests(states: MERGED) { totalCount } repositories(first: 100, ownerAffiliations: OWNER, isFork: false) { nodes { stargazerCount } } contributionsCollection { ${calendar} } } }`, { login: OWNER });
  const now = new Date();
  const years = Array.from({ length: now.getUTCFullYear() - new Date(user.createdAt).getUTCFullYear() + 1 }, (_, i) => new Date(user.createdAt).getUTCFullYear() + i);
  const history = await Promise.all(years.map(async (year) => {
    const from = new Date(Date.UTC(year, 0, 1)).toISOString();
    const to = year === now.getUTCFullYear() ? now.toISOString() : new Date(Date.UTC(year, 11, 31, 23, 59, 59)).toISOString();
    const data = await graphql(`query($login: String!, $from: DateTime!, $to: DateTime!) { user(login: $login) { contributionsCollection(from: $from, to: $to) { ${calendar} } } }`, { login: OWNER, from, to });
    return data.user.contributionsCollection.contributionCalendar;
  }));
  const days = history.flatMap(({ weeks }) => weeks.flatMap((week) => week.contributionDays)).sort((a, b) => a.date.localeCompare(b.date));
  const totalContributions = history.reduce((sum, year) => sum + year.totalContributions, 0);
  const firstActive = days.find((day) => day.contributionCount > 0);

  const streaks = [];
  let open = null;
  for (const day of days) {
    if (day.contributionCount > 0) {
      open = open ? { ...open, end: day.date, length: open.length + 1 } : { start: day.date, end: day.date, length: 1 };
    } else if (open) {
      streaks.push(open);
      open = null;
    }
  }
  if (open) streaks.push(open);
  const empty = { length: 0 };
  const longest = streaks.reduce((best, streak) => (streak.length > best.length ? streak : best), empty);
  const last = streaks.at(-1);
  const recentDays = days.slice(-2).map((day) => day.date);
  const current = last && recentDays.includes(last.end) ? last : empty;

  const shortDate = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const range = (streak) => (streak.length ? `${shortDate(streak.start)} to ${shortDate(streak.end)}` : 'No streak yet');
  const since = new Date(`${firstActive.date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  const stars = user.repositories.nodes.reduce((sum, repo) => sum + repo.stargazerCount, 0);
  const stats = [
    [totalContributions.toLocaleString('en-US'), 'Total contributions', `since ${since}`],
    [plural(current.length, 'day'), 'Current streak', range(current)],
    [plural(longest.length, 'day'), 'Longest streak', range(longest)],
    [user.pullRequests.totalCount.toLocaleString('en-US'), 'Pull requests merged', 'in public repositories'],
    [stars.toLocaleString('en-US'), 'Stars earned', 'on my repositories'],
  ];

  const ai = JSON.parse(fs.readFileSync(path.join(ROOT, 'profile', 'ai-stats.json'), 'utf8'));
  const AGENTS = { claude: 'Claude Code', codex: 'Codex', opencode: 'OpenCode' };
  const monthYear = new Date(`${ai.period.from}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  const dateSpan = ({ from, through }) => `${shortDate(from)} to ${shortDate(through)}`;
  const aiStats = [
    [billions(ai.totalTokens), 'Total AI tokens', `since ${monthYear}`],
    [billions(ai.last30Days.tokens), 'Last 30 days', dateSpan(ai.last30Days)],
    [billions(ai.last7Days.tokens), 'Last 7 days', dateSpan(ai.last7Days)],
    [`${ai.activeDays} of ${ai.period.days}`, 'Active days', 'with coding agents'],
    [String(ai.agentCount), 'Coding agents', ai.topAgents.map((agent) => AGENTS[agent] ?? agent).join(' and ')],
  ];

  const weeks = user.contributionsCollection.contributionCalendar.weeks;
  const lastYear = user.contributionsCollection.contributionCalendar.totalContributions;
  const size = 12, mapTop = 136, span = INNER - PAD * 2;
  const height = mapTop + 7 * size + 6 * 2.6 + PAD - 2;

  const view = (shade, figures, grid, cellWidth, fill, entrance) => {
    const pitch = (span - cellWidth) / (grid.length - 1);
    const figureWidth = span / figures.length;
    const cells = figures.map(([value, label, note], i) => {
      const x = PAD + i * figureWidth + (i ? 18 : 0);
      const rule = i ? `<path d="M${(PAD + i * figureWidth + 0.5).toFixed(1)} 26V84" stroke="${shade.border}"/>` : '';
      const cell = `${rule}${text(BOLD, value, x, 46, 23, shade.title, { track: -0.5 })}${text(REG, label, x, 66, 12.5, shade.soft)}${text(REG, note, x, 83, 11.5, shade.dim)}`;
      return entrance ? rise(i, cell) : cell;
    }).join('');
    let month = '';
    const heatmap = grid.map((week, column) => {
      const x = PAD + column * pitch;
      const name = new Date(`${week[0].date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
      const label = name !== month && column < grid.length - 2 ? text(REG, name, x, mapTop - 9, 11, shade.dim) : '';
      month = name;
      const squares = week.map((day) => {
        const row = new Date(`${day.date}T00:00:00Z`).getUTCDay();
        return `<rect x="${x.toFixed(2)}" y="${(mapTop + row * (size + 2.6)).toFixed(1)}" width="${cellWidth.toFixed(2)}" height="${size}" rx="3" fill="${fill(day)}"/>`;
      }).join('');
      return entrance ? `<g class="in" style="animation-delay:${(0.25 + column * 0.012).toFixed(3)}s">${label}${squares}</g>` : `${label}${squares}`;
    }).join('');
    return `${cells}<path d="M${PAD} 104.5H${INNER - PAD}" stroke="${shade.border}"/>${heatmap}`;
  };

  const GITHUB_HUES = ['#3D7BFF', '#FF6FB5'], TOKEN_HUES = ['#8B5CF6', '#FFB86B'];
  const heat = ([hue], steps) => [theme.chip, ...steps.map((amount) => (amount <= 1 ? mix('#0A0A0F', hue, amount) : mix(hue, '#FFFFFF', amount - 1)))];
  const [none, first, second, third, fourth] = heat(GITHUB_HUES, [0.38, 0.62, 1.12, 1.55]);
  const CONTRIBUTION_FILL = { NONE: none, FIRST_QUARTILE: first, SECOND_QUARTILE: second, THIRD_QUARTILE: third, FOURTH_QUARTILE: fourth };
  const TOKEN_FILL = heat(TOKEN_HUES, [0.3, 0.48, 0.7, 1.1, 1.5]);
  const tokenWeeks = [];
  for (const day of ai.days) {
    if (tokenWeeks.length === 0 || new Date(`${day.date}T00:00:00Z`).getUTCDay() === 0) tokenWeeks.push([]);
    tokenWeeks.at(-1).push(day);
  }
  const weekGap = 2.6;
  const tokenCellWidth = (span - weekGap * (tokenWeeks.length - 1)) / tokenWeeks.length;
  const spent = ai.days.map((day) => day.value).filter((value) => value > 0).sort((a, b) => a - b);
  const thresholds = [0.25, 0.5, 0.75, 0.9].map((ratio) => spent[Math.floor((spent.length - 1) * ratio)] ?? 0);
  const tokenLevel = (day) => {
    if (day.value === 0) return day.inferred ? 1 : 0;
    const index = thresholds.findIndex((threshold) => day.value <= threshold);
    return index === -1 ? 5 : index + 1;
  };

  const corner = { cx: INNER - 6, cy: 4, r: 54 };
  const frame = `x=".5" y=".5" width="${INNER - 1}" height="${height - 1}" rx="14"`;
  const backdrop = (hues) => `<g clip-path="url(#frame)"><rect ${frame} fill="${theme.bg}"/>${eclipse({ ...corner, hues })}${grain(0, 0, INNER, height)}</g><rect ${frame} fill="none" stroke="${theme.border}"/>`;
  const github = view(theme, stats, weeks.map((week) => week.contributionDays), size, (day) => CONTRIBUTION_FILL[day.contributionLevel], true);
  const tokens = view(theme, aiStats, tokenWeeks, tokenCellWidth, (day) => TOKEN_FILL[tokenLevel(day)], false);
  const body = `<defs><clipPath id="frame"><rect ${frame}/></clipPath></defs>${backdrop(GITHUB_HUES)}${github}<g class="ai" opacity="0">${backdrop(TOKEN_HUES)}${tokens}</g>`;
  const css = '@keyframes ai{0%,40%{opacity:0}50%,90%{opacity:1}100%{opacity:0}}.ai{animation:ai 16s ease-in-out infinite}';
  const sentence = (figures) => figures.map(([value, label, note]) => `${label} ${value}, ${note}`).join('. ');
  const title = `GitHub stats: ${sentence(stats)}. ${lastYear.toLocaleString('en-US')} contributions in the last year. AI coding stats: ${sentence(aiStats)}.`;
  card('stats.svg', { height, theme, title, css, body, grainy: true });
}
