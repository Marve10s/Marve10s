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
const THEME = { bg: '#211E1E', border: '#3A3535', title: '#CFCECD', soft: '#8F8B8A', dim: '#656363', chip: '#2C2828' };

const fontPath = (pkg, file) => path.join(HERE, 'node_modules', '@fontsource', pkg, 'files', file);
const font = (pkg, file) => {
  const b = fs.readFileSync(fontPath(pkg, file));
  return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
};
const SANS = font('geist-sans', 'geist-sans-latin-500-normal.woff');
const BOLD = font('geist-sans', 'geist-sans-latin-600-normal.woff');
const monoWoff2 = fs.readFileSync(fontPath('geist-mono', 'geist-mono-latin-500-normal.woff2')).toString('base64');

const width = (f, s, size, track = 0) => f.getAdvanceWidth(s, size) + track * (s.length - 1);
function outline(f, s, x, y, size, { anchor = 'start', track = 0 } = {}) {
  const w = width(f, s, size, track);
  const x0 = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x;
  return f.getPath(s, x0, y, size, { letterSpacing: track / size }).toPathData(size > 30 ? 1 : 2);
}
const text = (f, s, x, y, size, fill, o = {}) => `<path fill="${fill}" d="${outline(f, s, x, y, size, o)}"${o.cls ? ` class="${o.cls}"` : ''}/>`;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const compact = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '')}k` : String(n));

async function github(endpoint) {
  const headers = { accept: 'application/vnd.github+json', 'user-agent': 'profile-readme' };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(`https://api.github.com/${endpoint}`, { headers });
  if (!res.ok) throw new Error(`${res.status} ${endpoint}`);
  return res.json();
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

const ENTER = '@keyframes in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}.in{animation:in .45s cubic-bezier(.2,.8,.2,1) both}';

function tile({ w = 423, h = 196, plate = 62, name, desc, right, sub, title, delay = 0 }) {
  return ({ css = '', art }) => {
    const gx = 5, tw = w - gx * 2, th = h - 4, ih = th - plate;
    const nameSize = 20, descSize = 13.5, pad = 16;
    const y1 = ih + 26, y2 = ih + 46;
    const rx = tw - pad;
    let side = '';
    if (right?.star) {
      const s = width(BOLD, right.star, nameSize - 3);
      side += text(BOLD, right.star, rx, y1 - 0.5, nameSize - 3, THEME.title, { anchor: 'end' }) + star(rx - s - 9, y1 - 5.5, 5.6, THEME.title);
    } else if (right?.label) {
      side += text(SANS, right.label, rx, y1 - 0.5, descSize, THEME.soft, { anchor: 'end' });
    }
    if (sub) side += text(SANS, sub, rx, y2, descSize, THEME.dim, { anchor: 'end' });
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title><defs><clipPath id="c"><rect width="${tw}" height="${th}" rx="12"/></clipPath><clipPath id="ia"><rect width="${tw}" height="${ih}"/></clipPath></defs>
<style>${ENTER}${css}.d{animation-delay:${delay}s}@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>
<g transform="translate(${gx} 0)"><g clip-path="url(#c)"><rect width="${tw}" height="${th}" fill="${THEME.bg}"/><g clip-path="url(#ia)"><g class="in d">${art(tw, ih)}</g></g><path d="M0 ${ih + 0.5}H${tw}" stroke="${THEME.border}"/>
<g class="in d">${text(BOLD, name, pad, y1, nameSize, THEME.title, { track: -0.2 })}${text(SANS, desc, pad, y2, descSize, THEME.soft)}${side}</g></g>
<rect x=".5" y=".5" width="${tw - 1}" height="${th - 1}" rx="12" fill="none" stroke="${THEME.border}"/></g>
</svg>`;
  };
}

function scrollingList(names, w, h, { size = 11, lead = 17, speed = 10 } = {}) {
  const colW = w / 3, perCol = Math.ceil(names.length / 3);
  const columns = [0, 1, 2].map((c) => names.slice(c * perCol, (c + 1) * perCol));
  const block = perCol * lead;
  const defs = columns.map((list, c) => `<g id="col${c}">${list.map((n, i) => `<text x="${16 + c * colW}" y="${16 + i * lead}" class="${(i + c) % 5 === 2 ? 'hi' : 'lo'}">${esc(n)}</text>`).join('')}</g>`).join('');
  const body = columns.map((_, c) => `<g class="sc${c}"><use href="#col${c}"/><use href="#col${c}" y="${block}"/></g>`).join('');
  const css = `@font-face{font-family:GM;src:url(data:font/woff2;base64,${monoWoff2}) format('woff2')}text{font-family:GM,ui-monospace,Menlo,monospace;font-size:${size}px;white-space:pre}.lo{fill:#5a5656}.hi{fill:${THEME.title}}`
    + [0, 1, 2].map((c) => `@keyframes sc${c}{from{transform:translateY(${-block * (c / 3)}px)}to{transform:translateY(${-block * (1 + c / 3)}px)}}.sc${c}{animation:sc${c} ${block / (speed + c * 2)}s linear infinite}`).join('');
  const fade = `<linearGradient id="fd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${THEME.bg}"/><stop offset=".22" stop-color="${THEME.bg}" stop-opacity="0"/><stop offset=".72" stop-color="${THEME.bg}" stop-opacity="0"/><stop offset="1" stop-color="${THEME.bg}"/></linearGradient>`;
  return { css, art: () => `<defs>${fade}${defs}</defs>${body}<rect width="${w}" height="${h}" fill="url(#fd)"/>` };
}

function statsArt({ logo, headline, caption, header, columns }, w, h) {
  const size = 36, x = 20, cy = h / 2;
  const numX = x + size + 12;
  const leftEnd = numX + Math.max(width(BOLD, headline, 26, -0.6), width(SANS, caption, 12));
  const sepX = leftEnd + 16;
  const startX = sepX + 18, gap = 16;
  let cx = startX;
  const stats = columns.map(([value, label]) => {
    const out = `${text(BOLD, value, cx, cy + 8, 19, THEME.title, { track: -0.4 })}${text(SANS, label, cx, cy + 26, 11.5, THEME.soft)}`;
    cx += Math.max(width(BOLD, value, 19, -0.4), width(SANS, label, 11.5)) + gap;
    return out;
  }).join('');
  const art = () => `<clipPath id="sl"><rect x="${x}" y="${cy - size / 2}" width="${size}" height="${size}" rx="9"/></clipPath><image href="${logo}" x="${x}" y="${cy - size / 2}" width="${size}" height="${size}" clip-path="url(#sl)"/>${text(BOLD, headline, numX, cy + 5, 26, THEME.title, { track: -0.6 })}${text(SANS, caption, numX, cy + 23, 12, THEME.soft)}<path d="M${sepX + 0.5} 28V${h - 28}" stroke="${THEME.border}"/>${header(startX, cy - 20)}${stats}`;
  return { art };
}

function contributionTile({ fullName, prs, stars, image }, { verb, art }, delay) {
  const w = 211, h = 140, plate = 56, gx = 5, tw = w - gx * 2, th = h - 4, ih = th - plate;
  const repo = fullName.split('/')[1];
  const pad = 12, logo = 18, nameX = pad + logo + 8;
  const starText = compact(stars);
  const sw = width(BOLD, starText, 12.5);
  const count = `${prs} PR${prs === 1 ? '' : 's'} ${verb}`;
  const title = `${fullName}: ${count}. ${starText} stars.`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title><defs><clipPath id="c"><rect width="${tw}" height="${th}" rx="12"/></clipPath><clipPath id="ia"><rect width="${tw}" height="${ih}"/></clipPath><clipPath id="lg"><rect x="${pad}" y="${ih + 11}" width="${logo}" height="${logo}" rx="5"/></clipPath></defs>
<style>${ENTER}.d{animation-delay:${delay}s}@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>
<g transform="translate(${gx} 0)"><g clip-path="url(#c)"><rect width="${tw}" height="${th}" fill="${THEME.bg}"/><g clip-path="url(#ia)"><g class="in d">${art(tw, ih)}</g></g><path d="M0 ${ih + 0.5}H${tw}" stroke="${THEME.border}"/>
<g class="in d"><image href="${image}" x="${pad}" y="${ih + 11}" width="${logo}" height="${logo}" clip-path="url(#lg)"/>${text(BOLD, repo, nameX, ih + 25, 15, THEME.title, { track: -0.2 })}${text(SANS, count, pad, ih + 46, 12.5, THEME.soft)}${text(SANS, starText, tw - pad, ih + 46, 12.5, THEME.soft, { anchor: 'end' })}${star(tw - pad - sw - 8, ih + 41.5, 4.6, THEME.soft)}</g></g>
<rect x=".5" y=".5" width="${tw - 1}" height="${th - 1}" rx="12" fill="none" stroke="${THEME.border}"/></g>
</svg>`;
}

const picture = (href) => (w, h) => `<image href="${href}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"/>`;

function effectLogo(w, h) {
  const logo = fs.readFileSync(path.join(ROOT, 'assets', 'stack', 'effect.svg'), 'utf8');
  const paths = [...logo.matchAll(/<path[^>]*\/>/g)].map((m) => m[0]).join('');
  const size = 50, word = 'Effect', ws = 30, gap = 12;
  const total = size + gap + width(BOLD, word, ws, -0.6);
  const x = (w - total) / 2, y = (h - size) / 2;
  return () => `<defs><radialGradient id="eg" cx=".5" cy=".5" r=".6"><stop offset="0" stop-color="#2a2a2a"/><stop offset="1" stop-color="#0c0c0c"/></radialGradient></defs><rect width="${w}" height="${h}" fill="url(#eg)"/><g transform="translate(${x} ${y}) scale(${size / 220})">${paths}</g>${text(BOLD, word, x + size + gap, h / 2 + 11, ws, '#ffffff', { track: -0.6 })}`;
}

async function sideEye(w, h) {
  const W = w * 2, H = h * 2;
  const thumb = await raw('https://i.ytimg.com/vi/xJaMTo2YgO8/maxresdefault.jpg');
  const fade = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${H}" height="${H}"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".3" stop-color="#fff"/></linearGradient></defs><rect width="${H}" height="${H}" fill="url(#g)"/></svg>`);
  const face = await sharp(await sharp(thumb).extract({ left: 840, top: 0, width: 440, height: 440 }).resize(H, H).ensureAlpha().png().toBuffer()).composite([{ input: fade, blend: 'dest-in' }]).png().toBuffer();
  const iconSize = Math.round(H * 0.6);
  const icon = await sharp(await raw('https://raw.githubusercontent.com/pingdotgg/t3code/main/apps/marketing/src/assets/icon.webp')).resize(iconSize, iconSize).png().toBuffer();
  const canvas = sharp({ create: { width: W, height: H, channels: 3, background: '#121214' } }).composite([{ input: icon, left: Math.round(W * 0.16), top: Math.round((H - iconSize) / 2) }, { input: face, left: W - H, top: 0 }]);
  return webp(sharp(await canvas.png().toBuffer()), 80);
}

function stackStrip(items) {
  const H = 44, iconSize = 22, size = 14.5, gap = 8;
  let x = 0;
  const chips = items.map(({ name, icon }, i) => {
    const pad = 12, cw = pad + iconSize + 9 + width(SANS, name, size) + pad;
    const chip = `<g class="in" style="animation-delay:${(i * 0.06).toFixed(2)}s"><rect x="${x + 0.5}" y=".5" width="${cw - 1}" height="${H - 1}" rx="9" fill="${THEME.bg}" stroke="${THEME.border}"/><image href="${icon}" x="${x + pad}" y="${(H - iconSize) / 2}" width="${iconSize}" height="${iconSize}"/>${text(SANS, name, x + pad + iconSize + 9, H / 2 + 5, size, THEME.title)}</g>`;
    const rect = `<rect x="${x}" y="0" width="${cw}" height="${H}" rx="9"/>`;
    x += cw + gap;
    return { chip, rect };
  });
  const W = x - gap;
  const shine = `<linearGradient id="sh" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".09"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`;
  const css = `${ENTER}@keyframes sw{0%,55%{transform:translateX(-160px)}100%{transform:translateX(${W + 40}px)}}.sw{animation:sw 6s cubic-bezier(.5,0,.5,1) 1s infinite both}@media (prefers-reduced-motion:reduce){*{animation:none!important}.sw{display:none}}`;
  const names = items.map((i) => i.name).join(', ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Main stack: ${esc(names)}"><title>Main stack: ${esc(names)}</title>
<defs>${shine}<clipPath id="chips">${chips.map((c) => c.rect).join('')}</clipPath></defs><style>${css}</style>
${chips.map((c) => c.chip).join('')}<g clip-path="url(#chips)"><rect class="sw" x="0" y="0" width="140" height="${H}" fill="url(#sh)"/></g></svg>`;
}

const write = (name, svg) => {
  const clean = svg.replace(/\n/g, '');
  fs.writeFileSync(path.join(OUT, name), clean);
  console.log(name.padEnd(28), `${(Buffer.byteLength(clean) / 1024).toFixed(0)} KB`);
};

const asset = (file) => `data:${file.endsWith('.png') ? 'image/png' : 'image/svg+xml'};base64,${fs.readFileSync(path.join(ROOT, 'assets', file)).toString('base64')}`;
const IMG = [423 - 10, 196 - 4 - 62];

const [bfs, awesome] = await Promise.all([github(`repos/${OWNER}/Better-Fullstack`), github(`repos/${OWNER}/awesome-effect`)]);

{
  const platforms = ['web', 'apple', 'android', 'electron', 'googlechrome'].map((name) => asset(`icons/platforms/${name}.svg`));
  const header = (x, y) => platforms.map((icon, i) => `<image href="${icon}" x="${x + i * 22}" y="${y - 12}" width="15" height="15"/>`).join('');
  const art = statsArt({ logo: asset('logos/listening.svg'), headline: '20k+', caption: 'audio hours a month', header, columns: [['11k+', 'monthly users'], ['600k+', 'lines of code']] }, ...IMG);
  write('tile-listening.svg', tile({ name: 'Listening.com', desc: 'Senior Full Stack Engineer', right: { label: 'Dec 2024 – now' }, sub: 'listening.com', title: 'Listening.com: Senior Full Stack Engineer, December 2024 to now. 20k+ hours of audio a month and 11k+ monthly users across the web, iOS, Android, desktop and Chrome extension apps, on a 600k+ line codebase.' })(art));
}

{
  const png = async (file) => `data:image/png;base64,${(await sharp(path.join(ROOT, 'assets', file)).resize(96, 96).png().toBuffer()).toString('base64')}`;
  const giftsong = await png('logos/giftsong.png');
  const header = (x, y) => `<image href="${giftsong}" x="${x}" y="${y - 13}" width="17" height="17"/>${text(SANS, 'GiftSong.ai', x + 22, y, 12, THEME.soft)}`;
  const art = statsArt({ logo: await png('logos/upwork.png'), headline: '10+', caption: 'client projects', header, columns: [['650k+', 'songs'], ['148k', 'users'], ['38k+', 'audio hours']] }, ...IMG);
  write('tile-upwork.svg', tile({ name: 'Upwork', desc: 'Full Stack TypeScript Developer', right: { label: 'Jun 2024 – now' }, title: 'Upwork: Full Stack TypeScript Developer, June 2024 to now. 10+ client projects, including GiftSong.ai, an AI song gift app with 650k+ songs, 148k users and 38k+ hours of audio.', delay: 0.08 })(art));
}

{
  const og = (s) => `${RAW}/${OWNER}/Better-Fullstack/main/apps/web/public/og/stack-${s}-1200x630.png`;
  const frames = await Promise.all(['typescript', 'react-native', 'rust', 'python', 'go'].map((s) => still({ url: og(s), crop: [60, 150, 1080, 340] }, ...IMG, 72)));
  const s = slideshow(frames, ...IMG, { hold: 2.2, fade: 0.6 });
  const stars = compact(bfs.stargazers_count);
  write('tile-better-fullstack.svg', tile({ name: 'Better Fullstack', desc: 'Full-stack apps in one command', right: { star: stars }, sub: 'better-fullstack.dev', title: `Better Fullstack: scaffold full-stack apps in TypeScript, React Native, Rust, Python, Go and more. ${stars} stars. better-fullstack.dev` })(s));
}

{
  const readme = (await raw(`${RAW}/${OWNER}/awesome-effect/main/README.md`)).toString();
  const names = [...readme.matchAll(/^- <img[^>]*> \[([^\]]+)\]\(/gm)].map((m) => m[1]).filter((n) => n.length <= 17 && /^[@a-z][\w./-]*$/.test(n));
  const picks = names.filter((_, i) => i % 2 === 0).slice(0, 36);
  const stars = compact(awesome.stargazers_count);
  write('tile-awesome-effect.svg', tile({ name: 'awesome-effect', desc: 'The Effect ecosystem, curated', right: { star: stars }, sub: 'This Week in Effect #133', title: `awesome-effect: libraries, tools and learning material for Effect. ${stars} stars. Featured in This Week in Effect #133.`, delay: 0.08 })(scrollingList(picks, ...IMG)));
}

{
  const w = 423, h = 76, gx = 5, tw = w - gx * 2, th = h - 4, pad = 16, logo = 40;
  const mark = fs.readFileSync(path.join(ROOT, 'assets', 'stack', 'effect.svg'), 'utf8');
  const paths = [...mark.matchAll(/<path[^>]*\/>/g)].map((m) => m[0]).join('');
  const nameX = pad + logo + 14;
  const title = 'Security: reported 3 vulnerabilities in Effect, the TypeScript library with 66M npm downloads a week: one high, one moderate and one low severity, all confirmed by the maintainers.';
  write('tile-security.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title><style>${ENTER}@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>
<g transform="translate(${gx} 0)"><rect width="${tw}" height="${th}" rx="12" fill="${THEME.bg}" stroke="${THEME.border}"/>
<g class="in"><rect x="${pad}" y="${(th - logo) / 2}" width="${logo}" height="${logo}" rx="10" fill="#0c0c0c"/><g transform="translate(${pad + 8} ${(th - logo) / 2 + 8}) scale(${(logo - 16) / 220})">${paths}</g>
${text(BOLD, '3 vulnerabilities reported to Effect', nameX, th / 2 - 3, 15.5, THEME.title, { track: -0.2 })}${text(SANS, 'High, moderate and low · confirmed by maintainers', nameX, th / 2 + 16, 12, THEME.soft)}</g></g>
</svg>`);
}

write('stack.svg', stackStrip([
  { name: 'TanStack', icon: asset('stack/tanstack.png') },
  { name: 'Astro', icon: asset('stack/astro.svg') },
  { name: 'Next.js', icon: asset('stack/nextjs.svg') },
  { name: 'Expo', icon: asset('stack/expo.png') },
  { name: 'Hono', icon: asset('stack/hono.svg') },
  { name: 'React', icon: asset('stack/react.svg') },
  { name: 'Effect-TS', icon: asset('stack/effect.svg') },
]));

{
  const featured = JSON.parse(fs.readFileSync(path.join(ROOT, 'profile', 'contrib', 'featured.json'), 'utf8'));
  const [w, h] = [211 - 10, 140 - 4 - 56];
  const ART = {
    'Effect-TS/effect': async () => ({ verb: 'merged', art: effectLogo(w, h) }),
    'pingdotgg/t3code': async () => ({ verb: 'merged', art: picture(await sideEye(w, h)) }),
    'react/react-native': async () => ({ verb: 'landed', art: picture(await still({ url: 'https://reactnative.dev/img/logo-share.png', crop: [0, 70, 1200, 490] }, w, h, 80)) }),
    'mui/material-ui': async () => ({ verb: 'merged', art: picture(await still({ url: 'https://mui.com/static/social-previews/home-preview.jpg', crop: [180, 120, 2200, 898] }, w, h, 80)) }),
  };
  for (const [i, repo] of featured.entries()) {
    const slug = repo.fullName.split('/')[1].toLowerCase();
    write(`contrib-${slug}.svg`, contributionTile(repo, await ART[repo.fullName](), i * 0.06));
  }
}
