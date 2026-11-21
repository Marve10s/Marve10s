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

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const CELL = 3, DOT_PIXELS = 4, CELL_PIXELS = 6;
const rgb = (hex) => [0, 1, 2].map((i) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16));
const ramp = (stops) => {
  const points = stops.map(([at, hex, level]) => [at, [...rgb(hex), level]]);
  return (at) => {
    const next = points.findIndex(([edge]) => edge >= at);
    if (next <= 0) return points.at(next)[1];
    const [from, low] = points[next - 1], [to, high] = points[next];
    return low.map((value, i) => value + (high[i] - value) * (at - from) / (to - from));
  };
};
async function dither(x, y, w, h, shade, opacity = 0.9) {
  const left = Math.floor(x / CELL), top = Math.floor(y / CELL);
  const columns = Math.ceil((x + w) / CELL) - left, rows = Math.ceil((y + h) / CELL) - top;
  const stride = columns * CELL_PIXELS, inset = (CELL_PIXELS - DOT_PIXELS) / 2;
  const pixels = Buffer.alloc(stride * rows * CELL_PIXELS * 4);
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const cellX = left + column, cellY = top + row;
      const [red, green, blue, level] = shade((cellX + 0.5) * CELL, (cellY + 0.5) * CELL);
      if (level * 16 <= BAYER[(cellY & 3) * 4 + (cellX & 3)] + 0.5) continue;
      for (let dotY = 0; dotY < DOT_PIXELS; dotY++) {
        for (let dotX = 0; dotX < DOT_PIXELS; dotX++) {
          pixels.set([red, green, blue, 255], ((row * CELL_PIXELS + inset + dotY) * stride + column * CELL_PIXELS + inset + dotX) * 4);
        }
      }
    }
  }
  const png = await sharp(pixels, { raw: { width: stride, height: rows * CELL_PIXELS, channels: 4 } }).png({ palette: true, colours: 32, dither: 0, compressionLevel: 9, effort: 10 }).toBuffer();
  return `<image href="data:image/png;base64,${png.toString('base64')}" x="${left * CELL}" y="${top * CELL}" width="${columns * CELL}" height="${rows * CELL}" opacity="${opacity}" style="image-rendering:pixelated"/>`;
}

const HAZE = ramp([[-15, '#4A3CB0', 0], [-10, '#5A4CB8', 0.2], [-6, '#9A93D8', 0.45], [-3, '#C4BEE2', 0.75], [0, '#F6E9E6', 1], [3, '#F0C2A4', 0.75], [6, '#D8905E', 0.45], [10, '#B4562E', 0.2], [16, '#8A2A10', 0]]);
const SUN_CYCLE = 86, SUN_CROSSING = 0.96;

async function horizon({ W, H, crest, sag, from, span, startAt = 0.143 }) {
  const half = W / 2, R = (half * half + sag * sag) / (2 * sag), cx = half, cy = crest + R;
  const follow = uid('h'), reveal = uid('h');
  const xAt = (fraction) => W * (0.05 + 0.9 * fraction);
  const startFraction = (startAt - 0.05) / 0.9;
  const begin = `-${(startFraction * SUN_CROSSING * SUN_CYCLE).toFixed(2)}s`;
  const travel = `keyTimes="0;${SUN_CROSSING};1" dur="${SUN_CYCLE}s" begin="${begin}" repeatCount="indefinite"`;
  const dim = [[0, 0.5], [0.2, 0.4], [0.3, 0.26], [0.4, 0.1], [0.5, 0], [0.6, 0.1], [0.7, 0.26], [0.8, 0.4], [1, 0.5]];
  const dots = await dither(from, 0, span, H, (x, y) => HAZE(R - Math.hypot(x - cx, y - cy)));
  return `<defs><linearGradient id="${follow}" gradientUnits="userSpaceOnUse" x1="${-1.5 * W}" x2="${1.5 * W}">${dim.map(([at, alpha]) => `<stop offset="${at}" stop-color="#000" stop-opacity="${alpha}"/>`).join('')}</linearGradient>
<linearGradient id="${reveal}" gradientUnits="userSpaceOnUse" x1="${-1.5 * W}" x2="${1.5 * W}"><stop offset="0" stop-color="#000" stop-opacity=".86"/><stop offset=".2" stop-color="#000" stop-opacity="0"/><stop offset=".8" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".86"/></linearGradient></defs>
<g opacity="0"><animate attributeName="opacity" values="0;1" begin="0.15s" dur="1.15s" calcMode="spline" keySplines=".4 0 .6 1" fill="freeze"/>${dots}</g>
<g><animateTransform attributeName="transform" type="translate" values="${xAt(0).toFixed(1)} 0;${xAt(1).toFixed(1)} 0;${xAt(1).toFixed(1)} 0" ${travel}/><rect x="${-3 * W}" y="0" width="${6 * W}" height="${H}" fill="url(#${follow})"/></g>
<g transform="translate(${xAt(startFraction).toFixed(1)} 0)"><set attributeName="display" to="none" begin="3.4s"/><g transform="scale(0.02 1)"><animateTransform attributeName="transform" type="scale" values="0.02 1;1 1" begin="0.45s" dur="2.1s" calcMode="spline" keySplines=".2 .65 .35 1" fill="freeze"/><rect x="${-40 * W}" y="0" width="${80 * W}" height="${H}" fill="url(#${reveal})"/></g></g>`;
}

function tile({ w = 423, h = 196, plate = 62, theme, name, desc, right, sub, title, delay = 0, backdrop, bridge }) {
  return ({ css = '', art }) => {
    const gx = 5, tw = w - gx * 2, th = h - 4, ih = th - plate;
    const frame = (inset) => {
      const x0 = inset, y0 = inset, x1 = tw - inset, y1 = th - inset, r = 12 - inset, span = 10;
      const topLeft = bridge === 'left' ? `M${-gx} ${y0}` : `M${x0} ${y0 + r}Q${x0} ${y0} ${x0 + r} ${y0}`;
      const topRight = bridge === 'right' ? `H${tw + gx}V${span}A${gx + inset} ${gx + inset} 0 0 0 ${x1} ${span + gx + inset}` : `H${x1 - r}Q${x1} ${y0} ${x1} ${y0 + r}`;
      const closing = bridge === 'left' ? `V${span + gx + inset}A${gx + inset} ${gx + inset} 0 0 0 ${-gx} ${span}Z` : 'Z';
      return `${topLeft}${topRight}V${y1 - r}Q${x1} ${y1} ${x1 - r} ${y1}H${x0 + r}Q${x0} ${y1} ${x0} ${y1 - r}${closing}`;
    };
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
<title>${esc(title)}</title><defs><clipPath id="c"><path d="${frame(0)}"/></clipPath><clipPath id="ia"><rect width="${tw}" height="${ih}"/></clipPath></defs>
<style>${ENTER}${css}.d{animation-delay:${delay}s}${STILL}</style>
<g transform="translate(${gx} 0)"><g clip-path="url(#c)"><rect x="${-gx}" width="${w}" height="${th}" fill="${theme.bg}"/>${backdrop ?? ''}<g clip-path="url(#ia)"><g class="in d">${art(tw, ih)}</g></g>${backdrop ? '' : `<path d="M0 ${ih + 0.5}H${tw}" stroke="${theme.border}"/>`}
<g class="in d">${text(BOLD, name, pad, y1, nameSize, theme.title, { track: -0.2 })}${text(SANS, desc, pad, y2, descSize, theme.soft)}${side}</g></g>
<path d="${frame(0.5)}" fill="none" stroke="${theme.border}"/></g>
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
  { name: 'Effect', icon: 'effect', pkg: 'effect', users: ['Cloudflare', 'Vercel', 'OpenRouter', 'OpenCode', 'T3 Code'] },
  { name: 'Material UI', icon: 'mui', brand: '#007FFF', pkg: '@mui/material', users: ['Netflix', 'NASA', 'Spotify', 'Amazon', 'Unity', 'Docker'] },
  { name: 'React Native', icon: 'react', brand: '#149ECA', pkg: 'react-native', users: ['Meta', 'Microsoft', 'Amazon', 'Shopify', 'Wix'] },
  { name: 'Astro', icon: 'astro', brand: '#BC52EE', pkg: 'astro', users: ['Cloudflare', 'Microsoft', 'Google', 'IKEA', 'Porsche', 'Visa', 'OpenCode'] },
  { name: 'Solid', icon: 'solid', brand: '#4F88C6', pkg: 'solid-js', users: ['OpenCode'] },
  { name: 'React Hook Form', icon: 'reacthookform', brand: '#EC5990', pkg: 'react-hook-form', users: ['Grafana', 'Supabase', 'Cal.com', 'Elastic'] },
  { name: 'tRPC', icon: 'trpc', brand: '#398CCB', pkg: '@trpc/server', users: ['Netflix', 'Google', 'PayPal', 'Cal.com'] },
  { name: 'Cheerio', icon: 'cheerio', brand: '#E88C1F', pkg: 'cheerio', users: ['Google', 'Microsoft', 'Elastic'] },
  { name: 'Floating UI', image: 'logos/used-by/floating-ui.png', pkg: '@floating-ui/dom', users: ['Palantir', 'Microsoft', 'Grafana'] },
];

const COMPANIES = [
  ['Netflix', 'netflix', '#E50914'], ['Meta', 'meta', '#0081FB'], ['Google', 'google', '#4285F4'], ['Microsoft', 'microsoft'], ['Amazon', 'amazon', '#FF9900'],
  ['Cloudflare', 'cloudflare', '#F38020'], ['Spotify', 'spotify', '#1DB954'], ['NASA', 'nasa', '#E03C31'], ['Shopify', 'shopify', '#7AB55C'], ['Palantir', 'palantir'],
  ['PayPal', 'paypal', '#009CDE'], ['Visa', 'visa'], ['IKEA', 'ikea', '#FFDA1A'], ['Porsche', 'porsche'], ['Vercel', 'vercel'],
  ['Docker', 'docker', '#2496ED'], ['Unity', 'unity'], ['Wix', 'wix'], ['Elastic', 'elastic', '#00BFB3'], ['Cal.com', 'caldotcom'],
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
  const row = { W: 836, H: 192, crest: 101, sag: 20 };
  const sky = async (offset) => `<g transform="translate(${-offset} 0)">${await horizon({ ...row, from: offset - 5, span: 423 })}</g>`;
  const platforms = ['web', 'apple', 'android', 'electron', 'googlechrome'].map((name) => tinted(`icons/platforms/${name}.svg`, theme.dim));
  const header = (x, y) => platforms.map((image, i) => `<image href="${image}" x="${x + i * 22}" y="${y - 12}" width="15" height="15"/>`).join('');
  const art = statsArt({ logo: asset('logos/listening.svg'), headline: '20k+', caption: 'audio hours a month', header, columns: [['11k+', 'monthly users'], ['600k+', 'lines of code']] }, ...IMG, theme);
  write('tile-listening.svg', tile({ theme, bridge: 'right', backdrop: await sky(0), name: 'Listening.com', desc: 'Senior Full Stack Engineer', right: { label: 'Dec 2024 – now' }, sub: 'listening.com', title: 'Listening.com: Senior Full Stack Engineer, December 2024 to now. 20k+ hours of audio a month and 11k+ monthly users across the web, iOS, Android, desktop and Chrome extension apps, on a 600k+ line codebase.' })(art));

  const png = async (file) => `data:image/png;base64,${(await sharp(path.join(ROOT, 'assets', file)).resize(96, 96).png().toBuffer()).toString('base64')}`;
  const giftsong = await png('logos/giftsong.png');
  const giftsongHeader = (x, y) => `<image href="${giftsong}" x="${x}" y="${y - 13}" width="17" height="17"/>${text(SANS, 'GiftSong.ai', x + 22, y, 12, theme.soft)}`;
  const upwork = statsArt({ logo: await png('logos/upwork.png'), headline: '10+', caption: 'client projects', header: giftsongHeader, columns: [['650k+', 'songs'], ['148k', 'users'], ['38k+', 'audio hours']] }, ...IMG, theme);
  write('tile-upwork.svg', tile({ theme, bridge: 'left', backdrop: await sky(423), name: 'Upwork', desc: 'Full Stack TypeScript Developer', right: { label: 'Jun 2024 – now' }, title: 'Upwork: Full Stack TypeScript Developer, June 2024 to now. 10+ client projects, including GiftSong.ai, an AI song gift app with 650k+ songs, 148k users and 38k+ hours of audio.', delay: 0.08 })(upwork));
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
  const theme = THEME, [w] = IMG, lime = '#C6E853', pad = 16;
  const hero = (await raw(`${RAW}/${OWNER}/Better-Fullstack/readme-assets/hero-dark.svg`)).toString();
  const names = [...hero.matchAll(/<text class="w[^"]*"[^>]*fill="([^"]+)">([^<]+)\.<\/text>/g)].map(([, tone, name]) => ({ tone, name }));
  const marks = [...hero.matchAll(/<g class="t"[^>]*><rect[^>]*\/><svg[^>]*(viewBox="[^"]+")>(.*?)<\/svg><\/g>/g)].map(([, viewBox, body]) => ({ viewBox, body }));
  const [pixelFace] = hero.match(/@font-face\{font-family:GP;[^}]+\}/) ?? [];
  if (!pixelFace || names.length === 0 || names.length !== marks.length) throw new Error('Better Fullstack hero languages not found');
  const count = names.length, step = 1.7, total = count * step, slot = 100 / count;
  const box = 26, pitch = (w - pad * 2 - box) / (count - 1), boxY = 82, markSize = 14;
  const css = `${pixelFace}.w{font:26px GP;opacity:0;animation:w ${total}s infinite}.w0{opacity:1}.t{opacity:.4;animation:t ${total}s infinite}`
    + `@keyframes w{0%{opacity:0;transform:translateY(6px)}${(slot * 0.1).toFixed(2)}%,${(slot * 0.86).toFixed(2)}%{opacity:1;transform:none}${slot.toFixed(2)}%{opacity:0;transform:translateY(-6px)}100%{opacity:0}}`
    + `@keyframes t{0%,${slot.toFixed(2)}%,100%{opacity:.4}${(slot * 0.1).toFixed(2)}%,${(slot * 0.86).toFixed(2)}%{opacity:1}}`
    + `@keyframes cur{${names.map((_, i) => `${(i * slot).toFixed(3)}%{transform:translateX(${(i * pitch).toFixed(1)}px)}`).join('')}100%{transform:translateX(${((count - 1) * pitch).toFixed(1)}px)}}.cur{animation:cur ${total}s steps(1,end) infinite}`
    + '@media (prefers-reduced-motion:reduce){.t{opacity:1}}';
  const words = names.map(({ tone, name }, i) => `<text class="w${i ? '' : ' w0'}" style="animation-delay:${(i * step).toFixed(2)}s" x="${pad}" y="63" fill="${tone}">${esc(name)}.</text>`).join('');
  const tiles = marks.map(({ viewBox, body }, i) => {
    const x = pad + i * pitch;
    return `<g class="t" style="animation-delay:${(i * step).toFixed(2)}s"><rect x="${(x + 0.5).toFixed(1)}" y="${boxY + 0.5}" width="${box - 1}" height="${box - 1}" fill="#141413" stroke="#2D2C29"/><svg x="${(x + (box - markSize) / 2).toFixed(1)}" y="${boxY + (box - markSize) / 2}" width="${markSize}" height="${markSize}" ${viewBox}>${body}</svg></g>`;
  }).join('');
  const reach = box + 6;
  const cursor = `<g class="cur"><path transform="translate(${pad - 3} ${boxY - 3})" d="M1 7V1H7M${reach - 7} 1H${reach - 1}V7M${reach - 1} ${reach - 7}V${reach - 1}H${reach - 7}M7 ${reach - 1}H1V${reach - 7}" fill="none" stroke="${lime}" stroke-width="2"/></g>`;
  const s = { css, art: () => `<text x="${pad}" y="33" style="font:17px GP" fill="${theme.title}">Start your next app in</text>${words}${tiles}${cursor}` };
  const stars = compact(bfs.stargazers_count);
  write('tile-better-fullstack.svg', tile({ theme: THEME, bridge: 'right', name: 'Better Fullstack', desc: 'Full-stack apps in one command', right: { star: stars }, sub: 'better-fullstack.dev', title: `Better Fullstack: scaffold full-stack apps in ${names.map(({ name }) => name).join(', ')}. ${stars} stars. better-fullstack.dev` })(s));
}

{
  const readme = (await raw(`${RAW}/${OWNER}/awesome-effect/main/README.md`)).toString();
  const names = [...readme.matchAll(/^- <img[^>]*> \[([^\]]+)\]\(/gm)].map((m) => m[1]).filter((n) => n.length <= 17 && /^[@a-z][\w./-]*$/.test(n));
  const picks = names.filter((_, i) => i % 2 === 0).slice(0, 36);
  const stars = compact(awesome.stargazers_count);
  write('tile-awesome-effect.svg', tile({ theme: THEME, bridge: 'left', name: 'awesome-effect', desc: 'The Effect ecosystem, curated', right: { star: stars }, sub: 'This Week in Effect #133', title: `awesome-effect: libraries, tools and learning material for Effect. ${stars} stars. Featured in This Week in Effect #133.`, delay: 0.08 })(scrollingList(picks, ...IMG, THEME)));
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
  const rows = Math.ceil(COMPANIES.length / columns);
  const tileHeight = (slots * rowHeight - gap * (rows - 1)) / rows;
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
    const inner = `${spot}<rect class="${cycle('r', active, 1, 0)}" opacity="0" x="${(x + 0.75).toFixed(2)}" y="${(y + 0.75).toFixed(2)}" width="${(tileWidth - 1.5).toFixed(1)}" height="${(tileHeight - 1.5).toFixed(1)}" rx="9.25" fill="none" stroke="${theme.title}" stroke-width="1.5"/>${icon(glyph, x + tileWidth / 2 - 10, y + tileHeight / 2 - 18, 20, brand ?? theme.title)}${text(REG, company, x + tileWidth / 2, y + tileHeight / 2 + 19, 12.5, theme.title, { anchor: 'middle' })}`;
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
    'voidzero-dev/vite-plus': 'Vite+', 'react-hook-form/resolvers': 'RHF Resolvers', 'withastro/astro': 'Astro', 'rolldown/rolldown': 'Rolldown', 'alchemy-run/alchemy': 'Alchemy', 'solidjs/solid': 'Solid',
  };
  const UNLISTED = ['Emanuele-web04/synara'], LOOKALIKE_LOGOS = ['ryansolid/dom-expressions'];
  const mergeRate = JSON.parse(fs.readFileSync(path.join(ROOT, 'profile', 'contrib', 'merge-rate.json'), 'utf8'));
  const contributions = JSON.parse(fs.readFileSync(path.join(ROOT, 'profile', 'contrib', 'contributions.json'), 'utf8')).map((repo) => ({ ...repo, name: DISPLAY[repo.fullName] ?? repo.fullName.split('/')[1] }));
  const merged = contributions.reduce((sum, { prs }) => sum + prs, 0);
  const room = INNER - PAD * 2, right = INNER - PAD, seam = libraries.bottom + 20;

  const listed = contributions.filter(({ fullName }) => !UNLISTED.includes(fullName)).sort((a, b) => b.prs - a.prs || b.stars - a.stars);
  const shown = listed.filter(({ stars }) => stars >= 2000).slice(0, 20);
  const shownLogos = new Set(shown.map(({ image }) => image));
  const teased = listed
    .filter((repo) => !shown.includes(repo) && !shownLogos.has(repo.image) && !LOOKALIKE_LOGOS.includes(repo.fullName))
    .filter((repo, at, rest) => rest.findIndex(({ image }) => image === repo.image) === at)
    .slice(0, 4);

  const statLine = seam + 52, statSize = 34, labelSize = 16.5;
  let cursor = PAD;
  const stats = [[String(merged), 'merged PRs'], [`${mergeRate.rate}%`, 'merge rate'], ['3', 'vulnerabilities reported in Effect']].map(([value, label], i) => {
    const rule = i ? `<path d="M${(cursor + 14.5).toFixed(1)} ${statLine - 25}V${statLine + 2}" stroke="${theme.border}"/>` : '';
    const x = cursor + (i ? 29 : 0), valueWidth = width(BOLD, value, statSize, -1.3);
    cursor = x + valueWidth + 9 + width(SANS, label, labelSize, -0.2);
    return `${rule}${text(BOLD, value, x, statLine, statSize, theme.title, { track: -1.3 })}${text(SANS, label, x + valueWidth + 9, statLine, labelSize, theme.title, { track: -0.2 })}`;
  }).join('');
  const shieldGlyph = 'M7.467.133a1.748 1.748 0 0 1 1.066 0l5.25 1.68A1.75 1.75 0 0 1 15 3.48V7c0 1.566-.32 3.182-1.303 4.682-.983 1.498-2.585 2.813-5.032 3.855a1.697 1.697 0 0 1-1.33 0c-2.447-1.042-4.049-2.357-5.032-3.855C1.32 10.182 1 8.566 1 7V3.48a1.75 1.75 0 0 1 1.217-1.667Z';
  const shieldSize = 24;
  const shields = [['H', '#FF9E9E'], ['M', '#F2C879'], ['L', '#9CC7F0']].map(([letter, color], i) => {
    const x = right - shieldSize - (2 - i) * 30, y = statLine - 22;
    return `<g transform="translate(${x} ${y}) scale(${shieldSize / 16})"><path d="${shieldGlyph}" fill="${color}"/></g>${text(BOLD, letter, x + shieldSize / 2, y + 16, 11, '#0B0B0B', { anchor: 'middle' })}`;
  }).join('');

  const sag = 20, half = INNER / 2, radius = (half * half + sag * sag) / (2 * sag);
  const arcs = [[seam + 81, 1], [seam + 93, 0.6], [seam + 105, 0.34]];
  const ripple = (x, y) => arcs
    .map(([crest, strength]) => {
      const [red, green, blue, level] = HAZE((radius - Math.hypot(x - half, y - crest - radius)) / 0.62);
      return [red, green, blue, level * strength];
    })
    .reduce((best, tone) => (tone[3] > best[3] ? tone : best));
  const band = await dither(1, seam + 69, INNER - 2, 68, ripple, 1);

  const gridTop = seam + 141, rowHeight = 38, rowGap = 6, laneGap = 8, lane = (room - laneGap * 2) / 3;
  const spot = (i) => [PAD + (i % 3) * (lane + laneGap), gridTop + Math.floor(i / 3) * (rowHeight + rowGap)];
  const mergeGlyph = 'M5.45 5.154A4.25 4.25 0 0 0 9.25 7.5h1.378a2.251 2.251 0 1 1 0 1.5H9.25A5.734 5.734 0 0 1 5 7.123v3.505a2.25 2.25 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.95-.218ZM4.25 13.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm8.5-4.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM5 3.25a.75.75 0 1 0 0 .005V3.25Z';
  const mark = (id, image, x, y) => `<clipPath id="${id}"><rect x="${x.toFixed(1)}" y="${y}" width="20" height="20" rx="5"/></clipPath><image href="${image}" x="${x.toFixed(1)}" y="${y}" width="20" height="20" clip-path="url(#${id})"/>`;
  const starred = (end, baseline, stars) => {
    const label = compact(stars), start = end - width(REG, label, 12);
    return `${text(REG, label, start, baseline, 12, theme.soft)}${star(start - 8.5, baseline - 4, 4.4, theme.soft)}`;
  };
  const fitted = (name, space, size) => Math.min(size, size * space / width(BOLD, name, size, -0.15));
  const cells = shown.map((repo, i) => {
    const [x, y] = spot(i), edge = x + lane - 8;
    return `<rect x="${x.toFixed(1)}" y="${y}" width="${lane.toFixed(1)}" height="${rowHeight}" rx="9" fill="${theme.chip}"/>${mark(`repo${i}`, repo.image, x + 9, y + 9)}${text(BOLD, repo.name, x + 38, y + 24, fitted(repo.name, lane - 135, 13.5), theme.title, { track: -0.15 })}${starred(edge - 42, y + 23.5, repo.stars)}<g transform="translate(${(edge - 32).toFixed(1)} ${y + 13}) scale(.75)"><path d="${mergeGlyph}" fill="#8B5CF6"/></g>${text(SANS, String(repo.prs), edge - 16, y + 23.5, 12.5, theme.title)}`;
  }).join('');

  const [moreX, moreY] = spot(shown.length);
  const stack = teased.map((repo, at) => {
    const x = moreX + 10 + at * 15, y = moreY + 9;
    return `<rect x="${(x - 1.5).toFixed(1)}" y="${y - 1.5}" width="23" height="23" rx="6.5" fill="${theme.title}"/>${mark(`more${at}`, repo.image, x, y)}`;
  }).join('');
  const arrowX = moreX + lane - 26, arrowY = moreY + rowHeight / 2;
  const more = `<rect x="${moreX.toFixed(1)}" y="${moreY}" width="${lane.toFixed(1)}" height="${rowHeight}" rx="9" fill="${theme.title}"/>${stack}${text(BOLD, `View all ${contributions.length}`, moreX + 10 + Math.max(0, teased.length - 1) * 15 + 32, moreY + 24, 13.5, '#0B0B0B', { track: -0.1 })}<path d="M${arrowX.toFixed(1)} ${arrowY}h10m-4 -4l4 4l-4 4" fill="none" stroke="#0B0B0B" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`;

  const rows = Math.ceil((shown.length + 1) / 3);
  const height = gridTop + rows * rowHeight + (rows - 1) * rowGap + PAD;
  const title = `${merged} merged pull requests across ${contributions.length} repositories. ${mergeRate.rate}% merge rate: ${mergeRate.landed} landed and ${mergeRate.declined} declined by maintainers. PRs I withdrew, PRs maintainers took over, and PRs closed in cleanups or rewrites are not counted as declined. Security: 3 vulnerabilities reported in Effect, one high, one moderate and one low severity. Repositories by merged pull requests: ${shown.map(({ name, prs, stars }) => `${name} (${plural(prs, 'PR')}, ${compact(stars)} stars)`).join(', ')}. The full list is on elkamali.dev.`;
  card('contributed.svg', { height, theme, title: `${libraries.title} ${title}`, css: libraries.css, body: `${libraries.body}<path d="M${PAD} ${seam + 0.5}H${right}" stroke="${theme.border}"/>${stats}${shields}${band}${cells}${more}`, grainy: true });
}

{
  const theme = THEME, height = 126, cellWidth = INNER / 4;
  const LINKS = [
    { file: 'email', label: 'Email', handle: 'ibrahimelkamali@gmail.com', glyph: `<g fill="none" stroke="${theme.title}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/></g>` },
    { file: 'telegram', label: 'Telegram', handle: '@TheCr1nge', glyph: `<path fill="${theme.title}" d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12a12 12 0 0 0 12-12A12 12 0 0 0 12 0zm4.962 7.224c.1-.002.321.023.465.14a.5.5 0 0 1 .171.325c.016.093.036.306.02.472c-.18 1.898-.962 6.502-1.36 8.627c-.168.9-.499 1.201-.82 1.23c-.696.065-1.225-.46-1.9-.902c-1.056-.693-1.653-1.124-2.678-1.8c-1.185-.78-.417-1.21.258-1.91c.177-.184 3.247-2.977 3.307-3.23c.007-.032.014-.15-.056-.212s-.174-.041-.249-.024q-.159.037-5.061 3.345q-.72.495-1.302.48c-.428-.008-1.252-.241-1.865-.44c-.752-.245-1.349-.374-1.297-.789q.04-.324.893-.663q5.247-2.286 6.998-3.014c3.332-1.386 4.025-1.627 4.476-1.635"/>` },
    { file: 'x', label: 'X', handle: '@IbrahimElkamali', glyph: `<path fill="${theme.title}" d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/>` },
    { file: 'linkedin', label: 'LinkedIn', handle: 'Ibrahim Elkamali', glyph: `<path fill="${theme.title}" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>` },
  ];
  const sag = 20, half = INNER / 2, radius = (half * half + sag * sag) / (2 * sag), dip = 30;
  const band = await dither(1, 2, INNER - 2, 52, (x, y) => HAZE((Math.hypot(x - half, y - dip + radius) - radius) / 1.2), 1);
  const cells = LINKS.map(({ label, handle, glyph }, i) => {
    const x = i * cellWidth;
    const rule = i ? `<path d="M${(x + 0.5).toFixed(1)} 62V110" stroke="${theme.border}"/>` : '';
    return `${rule}<g transform="translate(${(x + 24).toFixed(1)} 62) scale(${20 / 24})">${glyph}</g>${text(BOLD, label, x + 54, 78, 15.5, theme.title, { track: -0.15 })}${text(REG, handle, x + 24, 104, 12.5, theme.soft)}<path d="M${(x + cellWidth - 34).toFixed(1)} 76l8 -8m-6 0h6v6" fill="none" stroke="${theme.dim}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`;
  }).join('');
  const frame = `x=".5" y=".5" width="${INNER - 1}" height="${height - 1}" rx="14"`;
  const whole = `<defs><clipPath id="contact"><rect ${frame}/></clipPath></defs><g transform="translate(${GUTTER} 0)"><rect ${frame} fill="${theme.bg}"/><g clip-path="url(#contact)">${band}</g>${cells}<rect ${frame} fill="none" stroke="${theme.border}"/></g>`;
  const widths = [GUTTER + cellWidth, cellWidth, cellWidth, cellWidth + GUTTER];
  let offset = 0;
  LINKS.forEach(({ file, label, handle }, i) => {
    const title = esc(`${label}: ${handle}`);
    write(`contact-${file}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" width="${widths[i]}" height="${height}" viewBox="${offset} 0 ${widths[i]} ${height}" role="img" aria-label="${title}"><title>${title}</title>${whole}</svg>`);
    offset += widths[i];
  });
}

tab('tab-experience.svg', 'Experience', 8);
tab('tab-stack.svg', 'Tech stack');
tab('tab-projects.svg', 'Projects');
tab('tab-contributed.svg', 'Contributed to');
tab('tab-contact.svg', 'Contact');
