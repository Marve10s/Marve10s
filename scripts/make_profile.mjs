import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';
import sharp from 'sharp';
import { seeded } from './poster/paint.mjs';
import { paintArt } from './poster/art.mjs';
import { W, H, MARGIN, DAWN, ECLIPSE, dawnRadius, dawnY, domeY, bowlY } from './poster/layout.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const CACHE = path.join(HERE, '.cache');
fs.mkdirSync(CACHE, { recursive: true });
fs.mkdirSync(path.join(ROOT, 'assets', 'profile'), { recursive: true });

const OWNER = 'Marve10s';
const ICONS = JSON.parse(fs.readFileSync(path.join(HERE, 'icons.json'), 'utf8'));
const contributions = JSON.parse(fs.readFileSync(path.join(ROOT, 'profile', 'contrib', 'contributions.json'), 'utf8')).map((repo) => ({ ...repo, name: repo.fullName.split('/')[1] }));
const ai = JSON.parse(fs.readFileSync(path.join(ROOT, 'profile', 'ai-stats.json'), 'utf8'));
const PACKAGES = ['effect', '@mui/material', 'react-native', 'react-hook-form', '@trpc/server', 'cheerio', '@floating-ui/dom'];

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

async function loadData() {
  const calendar = 'contributionCalendar { totalContributions weeks { contributionDays { date contributionCount contributionLevel } } }';
  const [bfs, awesome, downloads, { user }] = await Promise.all([
    github(`repos/${OWNER}/Better-Fullstack`),
    github(`repos/${OWNER}/awesome-effect`),
    Promise.all(PACKAGES.map(weeklyDownloads)),
    graphql(`query($login: String!) { user(login: $login) { createdAt pullRequests(states: MERGED) { totalCount } repositories(first: 100, ownerAffiliations: OWNER, isFork: false) { nodes { stargazerCount } } contributionsCollection { ${calendar} } } }`, { login: OWNER }),
  ]);
  const now = new Date();
  const firstYear = new Date(user.createdAt).getUTCFullYear();
  const years = Array.from({ length: now.getUTCFullYear() - firstYear + 1 }, (_, i) => firstYear + i);
  const history = await Promise.all(years.map(async (year) => {
    const from = new Date(Date.UTC(year, 0, 1)).toISOString();
    const to = year === now.getUTCFullYear() ? now.toISOString() : new Date(Date.UTC(year, 11, 31, 23, 59, 59)).toISOString();
    const result = await graphql(`query($login: String!, $from: DateTime!, $to: DateTime!) { user(login: $login) { contributionsCollection(from: $from, to: $to) { ${calendar} } } }`, { login: OWNER, from, to });
    return result.user.contributionsCollection.contributionCalendar;
  }));
  return {
    stars: { betterFullstack: bfs.stargazers_count, awesomeEffect: awesome.stargazers_count },
    downloads,
    mergedPullRequests: user.pullRequests.totalCount,
    starsEarned: user.repositories.nodes.reduce((sum, repo) => sum + repo.stargazerCount, 0),
    weeks: user.contributionsCollection.contributionCalendar.weeks.map((week) => week.contributionDays),
    totalContributions: history.reduce((sum, year) => sum + year.totalContributions, 0),
    days: history.flatMap(({ weeks }) => weeks.flatMap((week) => week.contributionDays)).sort((a, b) => a.date.localeCompare(b.date)).map(({ date, contributionCount }) => ({ date, count: contributionCount })),
  };
}
const data = await loadData();

const T = { title: '#F4F2EC', soft: '#A8A59D', dim: '#6D6A64', border: '#232323', chip: '#111111' };
const RIGHT = W - MARGIN, SPAN = W - MARGIN * 2;
const font = (file) => {
  const b = fs.readFileSync(path.join(HERE, 'node_modules', '@fontsource', 'geist-sans', 'files', file));
  return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
};
const REG = font('geist-sans-latin-400-normal.woff'), SANS = font('geist-sans-latin-500-normal.woff'), BOLD = font('geist-sans-latin-600-normal.woff');
const width = (f, s, size, track = 0) => f.getAdvanceWidth(s, size) + track * (s.length - 1);
const text = (f, s, x, y, size, fill, { anchor = 'start', track = 0 } = {}) => {
  const w = width(f, s, size, track);
  const x0 = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x;
  return `<path fill="${fill}" d="${f.getPath(s, x0, y, size, { letterSpacing: track / size }).toPathData(2)}"/>`;
};
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const compact = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '')}k` : String(n));
const millions = (n) => `${(n / 1e6).toFixed(1)}M`;
const billions = (n) => `${(n / 1e9).toFixed(1)}B`;
const plural = (n, word) => `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`;
const mix = (from, to, amount) => {
  const channel = (hex, i) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2].map((i) => Math.round(channel(from, i) + (channel(to, i) - channel(from, i)) * amount).toString(16).padStart(2, '0')).join('')}`;
};
function icon(name, x, y, size, fill) {
  const { viewBox: [vx, vy, vw, vh], body } = ICONS[name];
  const scale = size / Math.max(vw, vh);
  return `<g transform="translate(${(x + (size - vw * scale) / 2 - vx * scale).toFixed(2)} ${(y + (size - vh * scale) / 2 - vy * scale).toFixed(2)}) scale(${scale.toFixed(4)})" fill="${fill}">${body}</g>`;
}
const star = (x, y, r, fill) => `<polygon points="${Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * 0.45 : r; return `${(x + q * Math.cos(a)).toFixed(2)},${(y + q * Math.sin(a)).toFixed(2)}`; }).join(' ')}" fill="${fill}"/>`;
const spark = (x, y, s, fill) => `<path d="M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}Z" fill="${fill}"/>`;
const rise = (step, inner) => `<g class="in" style="animation-delay:${(step * 0.05).toFixed(2)}s">${inner}</g>`;
const mime = (file) => (file.endsWith('.png') ? 'image/png' : file.endsWith('.webp') ? 'image/webp' : 'image/svg+xml');
const dataUri = (file, bytes) => `data:${mime(file)};base64,${Buffer.from(bytes).toString('base64')}`;
const artwork = await paintArt();
const art = (name) => dataUri('art.webp', artwork[name]);
const asset = (file) => dataUri(file, fs.readFileSync(path.join(ROOT, 'assets', file)));
const tinted = (file, fill) => dataUri(file, fs.readFileSync(path.join(ROOT, 'assets', file), 'utf8').replaceAll('#8F8B8A', fill));
const png = async (file) => `data:image/png;base64,${(await sharp(path.join(ROOT, 'assets', file)).resize(96, 96).png().toBuffer()).toString('base64')}`;
const SWAY = 'calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1"';
const picture = (href, x, y, w, h, extra = '') => `<image href="${href}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="none"${extra}/>`;

function heading(label, y, step = 0) {
  const end = MARGIN + 24 + width(BOLD, label, 25, -0.5);
  return rise(step, `${spark(MARGIN + 7, y - 8.5, 8, T.title)}${text(BOLD, label, MARGIN + 24, y, 25, T.title, { track: -0.5 })}<rect x="${(end + 18).toFixed(1)}" y="${y - 9}" width="${(RIGHT - end - 18).toFixed(1)}" height="1" fill="url(#rule)"/>`);
}

function arcText(label, { cx, cy, r, size, fill, bowl = false, track = 0.6 }) {
  const total = [...label].reduce((sum, ch) => sum + REG.getAdvanceWidth(ch, size) + track, 0);
  let travelled = -total / 2;
  return [...label].map((ch) => {
    const advance = REG.getAdvanceWidth(ch, size) + track;
    const angle = (travelled + advance / 2) / r;
    travelled += advance;
    if (ch === ' ') return '';
    const x = cx + r * Math.sin(angle), y = bowl ? cy + r * Math.cos(angle) : cy - r * Math.cos(angle);
    const turn = (bowl ? -angle : angle) * 180 / Math.PI;
    return `<path fill="${fill}" transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${turn.toFixed(2)})" d="${REG.getPath(ch, -(advance - track) / 2, 0, size).toPathData(2)}"/>`;
  }).join('');
}

const defs = [], css = [], layers = [];

function sky() {
  const next = seeded(404);
  const twinkles = [];
  while (twinkles.length < 70) {
    const x = next() * W, y = next() * H;
    const inDisk = y > domeY(x) - 8 && y < bowlY(x) + 8;
    const onPlanet = y > dawnY(x) - 50 && y < dawnY(x) + 230;
    if (inDisk || onPlanet) continue;
    const r = 0.6 + next() ** 2 * 1.3, dur = (2.4 + next() * 4.6).toFixed(1);
    twinkles.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="#fff" opacity=".25"><animate attributeName="opacity" values=".08;.95;.08" dur="${dur}s" begin="-${(next() * 5).toFixed(1)}s" repeatCount="indefinite"/></circle>`);
  }
  defs.push('<linearGradient id="trail" x1="0" x2="1"><stop offset="0" stop-color="#B9A8FF" stop-opacity="0"/><stop offset=".75" stop-color="#E9DEFF" stop-opacity=".55"/><stop offset="1" stop-color="#fff"/></linearGradient><radialGradient id="meteor"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="#C9B8FF" stop-opacity=".55"/><stop offset="1" stop-color="#C9B8FF" stop-opacity="0"/></radialGradient>');
  const streak = (d, travel, pause, length, begin) => `<g opacity="0"><animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;${(0.08 * travel / (travel + pause)).toFixed(3)};${(0.8 * travel / (travel + pause)).toFixed(3)};${(travel / (travel + pause)).toFixed(3)};1" dur="${travel + pause}s" begin="${begin}s" repeatCount="indefinite"/><g><animateMotion path="${d}" rotate="auto" keyPoints="0;1;1" keyTimes="0;${(travel / (travel + pause)).toFixed(3)};1" calcMode="linear" dur="${travel + pause}s" begin="${begin}s" repeatCount="indefinite"/><rect x="${-length}" y="-1" width="${length}" height="2" rx="1" fill="url(#trail)"/><circle r="9" fill="url(#meteor)"/><circle r="1.6" fill="#fff"/></g></g>`;
  layers.push(`${picture(art('sky'), 0, 0, W, H)}${twinkles.join('')}${streak('M-80 560Q380 640 920 900', 1.7, 9.3, 150, 2)}${streak('M920 470Q560 560 -80 820', 2.1, 16.9, 120, 8)}${streak('M300 940Q560 1010 930 1130', 1.4, 22.6, 110, 14)}`);
}

function dawn() {
  const bandTop = DAWN.crest - 60, bandHeight = DAWN.sag + 120;
  const cx = W / 2, cy = DAWN.crest + dawnRadius, cycle = 86, crossing = 0.96, reach = 88;
  const xAt = (fraction) => W * (0.05 + 0.9 * fraction);
  const angle = (fraction) => (Math.asin((xAt(fraction) - cx) / dawnRadius) * 180 / Math.PI).toFixed(3);
  const start = (0.143 - 0.05) / 0.9, begin = `-${(start * crossing * cycle).toFixed(2)}s`;
  const travel = `keyTimes="0;${crossing};1" dur="${cycle}s" begin="${begin}" repeatCount="indefinite"`;
  const dim = [[0, 0.5], [0.2, 0.4], [0.3, 0.25], [0.4, 0.1], [0.5, 0], [0.6, 0.1], [0.7, 0.25], [0.8, 0.4], [1, 0.5]];
  defs.push(`<linearGradient id="follow" gradientUnits="userSpaceOnUse" x1="${-1.5 * W}" x2="${1.5 * W}">${dim.map(([at, alpha]) => `<stop offset="${at}" stop-color="#000" stop-opacity="${alpha}"/>`).join('')}</linearGradient><clipPath id="band"><path clip-rule="evenodd" d="M${cx - dawnRadius - 40} ${cy}a${dawnRadius + 40} ${dawnRadius + 40} 0 1 0 ${2 * dawnRadius + 80} 0a${dawnRadius + 40} ${dawnRadius + 40} 0 1 0 ${-2 * dawnRadius - 80} 0ZM${cx - dawnRadius + 36} ${cy}a${dawnRadius - 36} ${dawnRadius - 36} 0 1 0 ${2 * dawnRadius - 72} 0a${dawnRadius - 36} ${dawnRadius - 36} 0 1 0 ${-2 * dawnRadius + 72} 0Z"/></clipPath>`);
  const rays = (name, lead, turn) => `<g opacity=".5"><animate attributeName="opacity" values="${lead ? '1;0;1' : '0;1;0'}" dur="7.85s" ${SWAY} repeatCount="indefinite"/><g><animateTransform attributeName="transform" type="rotate" values="${-turn};${turn};${-turn}" dur="29.9s" ${SWAY} repeatCount="indefinite"/>${picture(art(name), -reach, -reach, reach * 2, reach * 2)}</g></g>`;
  const flare = `<g><animateTransform attributeName="transform" type="scale" values="1;1.045;0.97;1.02;1" dur="12.1s" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1;.45 0 .55 1;.45 0 .55 1" repeatCount="indefinite"/>${picture(art('sun-glow'), -reach, -reach, reach * 2, reach * 2)}<g opacity="0"><animate attributeName="opacity" values="0;1" begin="1.2s" dur="1.6s" calcMode="spline" keySplines=".4 0 .6 1" fill="freeze"/>${rays('sun-rays-a', false, 2.9)}${rays('sun-rays-b', true, -2.9)}</g></g>`;
  layers.push(`<g opacity="0"><animate attributeName="opacity" values="0;1" begin="0.1s" dur="1.3s" calcMode="spline" keySplines=".4 0 .6 1" fill="freeze"/>${picture(art('limb'), 0, bandTop, W, bandHeight)}</g>
<g clip-path="url(#band)"><g><animateTransform attributeName="transform" type="translate" values="${xAt(0).toFixed(1)} 0;${xAt(1).toFixed(1)} 0;${xAt(1).toFixed(1)} 0" ${travel}/><rect x="${-3 * W}" y="${bandTop}" width="${6 * W}" height="${bandHeight}" fill="url(#follow)"/></g></g>
<g><animateTransform attributeName="transform" type="rotate" values="${angle(0)} ${cx} ${cy.toFixed(1)};${angle(1)} ${cx} ${cy.toFixed(1)};${angle(1)} ${cx} ${cy.toFixed(1)}" ${travel}/><g transform="translate(${cx} ${DAWN.crest})"><g><animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;0.056;0.904;${crossing};1" dur="${cycle}s" begin="${begin}" repeatCount="indefinite"/><g transform="scale(0)"><animateTransform attributeName="transform" type="scale" values="0;1" begin="0.3s" dur="2.7s" calcMode="spline" keySplines=".12 .7 .2 1" fill="freeze"/>${flare}</g></g></g></g>`);
}

function eclipse() {
  const { top, bottom, radius, reach, inside } = ECLIPSE;
  const sag = radius - Math.sqrt(radius ** 2 - (W / 2) ** 2);
  const height = Math.ceil(reach + sag + inside);
  const domeTop = top - reach, bowlTop = bottom - (height - reach);
  const cx = W / 2, domeCentre = top + radius, bowlCentre = bottom - radius;
  const plume = (name, y, centre, lead, turn, dur) => `<g opacity=".5"><animate attributeName="opacity" values="${lead ? '1;.15;1' : '.15;1;.15'}" dur="${dur}s" ${SWAY} repeatCount="indefinite"/><g><animateTransform attributeName="transform" type="rotate" values="${-turn} ${cx} ${centre};${turn} ${cx} ${centre};${-turn} ${cx} ${centre}" dur="${dur * 3.1}s" ${SWAY} repeatCount="indefinite"/>${picture(art(name), 0, y, W, height)}</g></g>`;
  const bead = `<g><animateTransform attributeName="transform" type="rotate" values="-25.5 ${cx} ${domeCentre};-20 ${cx} ${domeCentre};-25.5 ${cx} ${domeCentre}" dur="44s" ${SWAY} repeatCount="indefinite"/><g transform="translate(${cx} ${top})"><g><animateTransform attributeName="transform" type="scale" values=".85;1.12;.85" dur="6.4s" ${SWAY} repeatCount="indefinite"/>${picture(art('sun-glow'), -34, -30, 68, 60)}</g></g></g>`;
  layers.push(`${plume('dome-streamers-a', domeTop, domeCentre, false, 0.5, 13)}${plume('dome-streamers-b', domeTop, domeCentre, true, -0.5, 13)}${picture(art('dome-rim'), 0, domeTop, W, height)}${bead}${plume('bowl-streamers', bowlTop, bowlCentre, false, 0.4, 17)}${picture(art('bowl-rim'), 0, bowlTop, W, height)}`);
  layers.push(rise(10, arcText(`${plural(contributions.reduce((sum, repo) => sum + repo.prs, 0), 'pull request')} merged  ·  ${contributions.length} repositories  ·  ${Math.floor(data.downloads.reduce((sum, n) => sum + n, 0) / 1e6)}M npm downloads a week`, { cx, cy: domeCentre, r: radius - 34, size: 12.5, fill: T.soft, track: 1.3 })));
  layers.push(arcText('elkamali.dev', { cx, cy: bowlCentre, r: radius - 20, size: 13, fill: T.soft, bowl: true, track: 2.2 }));
}

async function experience() {
  const top = 104, logoSize = 38, columnWidth = (SPAN - 26) / 2;
  const role = (x, { logo, headline, caption, header, columns, name, desc, dates, sub }, step) => {
    const id = `role${step}`, end = x + columnWidth, row = top + 62;
    const sepX = x + Math.max(width(BOLD, headline, 28, -0.7), width(REG, caption, 12.5)) + 18;
    let cursor = sepX + 20;
    const stats = columns.map(([value, label]) => {
      const out = `${text(BOLD, value, cursor, row + 31, 20, T.title, { track: -0.4 })}${text(REG, label, cursor, row + 48, 11.5, T.soft)}`;
      cursor += Math.max(width(BOLD, value, 20, -0.4), width(REG, label, 11.5)) + 18;
      return out;
    }).join('');
    return rise(step, `<clipPath id="${id}"><rect x="${x}" y="${top}" width="${logoSize}" height="${logoSize}" rx="10"/></clipPath><image href="${logo}" x="${x}" y="${top}" width="${logoSize}" height="${logoSize}" clip-path="url(#${id})"/>${text(BOLD, name, x + 50, top + 17, 21, T.title, { track: -0.35 })}${text(REG, desc, x + 50, top + 36, 13.5, T.soft)}${text(REG, dates, end, top + 16, 13.5, T.soft, { anchor: 'end' })}${sub ? text(REG, sub, end, top + 36, 13, T.dim, { anchor: 'end' }) : ''}`)
      + rise(step + 2, `${text(BOLD, headline, x, row + 25, 28, T.title, { track: -0.7 })}${text(REG, caption, x, row + 43, 12.5, T.soft)}<path d="M${sepX + 0.5} ${row - 4}V${row + 52}" stroke="#3A3A40"/>${header(sepX + 20, row + 4)}${stats}`);
  };
  const platforms = ['web', 'apple', 'android', 'electron', 'googlechrome'].map((name) => tinted(`icons/platforms/${name}.svg`, '#8E8A84'));
  const giftsong = await png('logos/giftsong.png');
  layers.push(heading('Experience', 60));
  layers.push(role(MARGIN, { logo: asset('logos/listening.svg'), headline: '20k+', caption: 'audio hours a month', header: (x, y) => platforms.map((image, i) => `<image href="${image}" x="${x + i * 22}" y="${y - 12}" width="15" height="15"/>`).join(''), columns: [['11k+', 'monthly users'], ['600k+', 'lines of code']], name: 'Listening.com', desc: 'Senior Full Stack Engineer', dates: 'Dec 2024 – now', sub: 'listening.com' }, 1));
  layers.push(role(MARGIN + columnWidth + 26, { logo: await png('logos/upwork.png'), headline: '10+', caption: 'client projects', header: (x, y) => `<image href="${giftsong}" x="${x}" y="${y - 13}" width="17" height="17"/>${text(REG, 'GiftSong.ai', x + 22, y, 12, T.soft)}`, columns: [['650k+', 'songs'], ['148k', 'users'], ['38k+', 'audio hours']], name: 'Upwork', desc: 'Full Stack TypeScript Developer', dates: 'Jun 2024 – now' }, 2));
}

const SKILLS = [
  ['Languages & frameworks', [['TypeScript', 'typescript'], ['JavaScript', 'javascript'], ['React', 'react'], ['TanStack', 'tanstack'], ['Astro', 'astro'], ['Next.js', 'nextdotjs'], ['Effect-TS', 'effect'], ['Python', 'python'], ['Rust', 'rust']]],
  ['Apps & interfaces', [['React Native', 'react'], ['Expo', 'expo'], ['Electron', 'electron'], ['WXT', 'wxt'], ['Tailwind CSS', 'tailwindcss'], ['shadcn/ui', 'shadcnui'], ['Motion', 'motion']]],
  ['Backend & data', [['TanStack Start', 'tanstack'], ['HonoJS', 'hono'], ['Supabase', 'supabase'], ['PostgreSQL', 'postgresql'], ['Drizzle ORM', 'drizzle'], ['Convex', 'convex'], ['Bun', 'bun']]],
  ['Infrastructure & tools', [['Kubernetes', 'kubernetes'], ['GitHub Actions', 'githubactions'], ['RunPod', 'runpod'], ['Modal', 'modal'], ['AWS', 'amazonwebservices'], ['GitHub', 'github'], ['Codex', 'openai'], ['Claude Code', 'claude'], ['Vercel', 'vercel'], ['Railway', 'railway'], ['Render', 'render'], ['Netlify', 'netlify']]],
];

function stack(top) {
  layers.push(heading('Tech stack', top, 4));
  const left = MARGIN + 176, chipHeight = 30, gap = 6, rowPad = 12;
  let y = top + 22, out = '';
  SKILLS.forEach(([label, skills], row) => {
    if (row > 0) out += `<rect x="${MARGIN}" y="${y}" width="${SPAN}" height="1" fill="#fff" opacity=".07"/>`;
    let x = left, lineTop = y + rowPad, chips = '';
    for (const [name, glyph] of skills) {
      const chipWidth = 9 + 15 + 7 + width(REG, name, 13.5) + 11;
      if (x + chipWidth > RIGHT) { x = left; lineTop += chipHeight + gap; }
      chips += `<rect x="${x.toFixed(1)}" y="${lineTop}" width="${chipWidth.toFixed(1)}" height="${chipHeight}" rx="8" fill="#07070B" fill-opacity=".72" stroke="#fff" stroke-opacity=".09"/>${icon(glyph, x + 9, lineTop + 7.5, 15, T.title)}${text(REG, name, x + 31, lineTop + 20, 13.5, T.title)}`;
      x += chipWidth + gap;
    }
    out += rise(5 + row, `${text(REG, label, MARGIN, y + rowPad + 20, 13.5, T.soft)}${chips}`);
    y = lineTop + chipHeight + rowPad;
  });
  layers.push(out);
  return y;
}

async function cached(url) {
  const file = path.join(CACHE, url.replace(/[^a-z0-9.]+/gi, '_').slice(-80));
  if (!fs.existsSync(file)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  return fs.readFileSync(file);
}

async function projects(top) {
  layers.push(heading('Projects', top, 8));
  const RAW = `https://raw.githubusercontent.com/${OWNER}`;
  const panelWidth = (SPAN - 26) / 2, panelHeight = 150, panelTop = top + 26;
  const frames = await Promise.all(['typescript', 'react-native', 'rust', 'python', 'go'].map(async (stack) => {
    const shot = sharp(await cached(`${RAW}/Better-Fullstack/main/apps/web/public/og/stack-${stack}-1200x630.png`)).extract({ left: 60, top: 140, width: 1080, height: 430 }).resize(Math.round(panelWidth * 2), panelHeight * 2, { fit: 'cover', position: 'left' });
    return `data:image/webp;base64,${(await shot.webp({ quality: 78 }).toBuffer()).toString('base64')}`;
  }));
  const hold = 2.4, fade = 0.7, loop = (hold + fade) * frames.length;
  const pct = (seconds) => +(seconds / loop * 100).toFixed(3);
  const slideshow = (x) => frames.map((frame, i) => {
    if (i > 0) {
      const at = i * (hold + fade), last = i === frames.length - 1;
      css.push(`@keyframes sl${i}{0%,${pct(at - fade)}%{opacity:0}${pct(at)}%,${pct(at + hold)}%{opacity:1}${last ? '' : `${pct(at + hold + fade)}%,`}100%{opacity:${last ? 1 : 0}}}.sl${i}{animation:sl${i} ${loop}s linear infinite}`);
    }
    return `<image href="${frame}" x="${x}" y="${panelTop}" width="${panelWidth}" height="${panelHeight}" preserveAspectRatio="xMidYMid slice"${i ? ` class="sl${i}" opacity="0"` : ''}/>`;
  }).join('');

  const readme = (await cached(`${RAW}/awesome-effect/main/README.md`)).toString();
  const names = [...readme.matchAll(/^- <img[^>]*> \[([^\]]+)\]\(/gm)].map((match) => match[1]).filter((name) => name.length <= 17 && /^[@a-z][\w./-]*$/.test(name)).filter((_, i) => i % 2 === 0).slice(0, 39);
  const mono = fs.readFileSync(path.join(HERE, 'node_modules', '@fontsource', 'geist-mono', 'files', 'geist-mono-latin-500-normal.woff2')).toString('base64');
  const lead = 18, perColumn = Math.ceil(names.length / 3), block = perColumn * lead;
  css.push(`@font-face{font-family:GM;src:url(data:font/woff2;base64,${mono}) format('woff2')}.pk{font-family:GM,ui-monospace,Menlo,monospace;font-size:11.5px;white-space:pre}.lo{fill:#5E5B66}.hi{fill:${T.title}}${[0, 1, 2].map((c) => `@keyframes pk${c}{from{transform:translateY(${-block * (c / 3)}px)}to{transform:translateY(${-block * (1 + c / 3)}px)}}.pk${c}{animation:pk${c} ${block / (9 + c * 2)}s linear infinite}`).join('')}`);
  const packages = (x) => [0, 1, 2].map((c) => {
    const column = names.slice(c * perColumn, (c + 1) * perColumn).map((name, i) => `<text x="${x + 18 + c * (panelWidth / 3)}" y="${panelTop + 18 + i * lead}" class="pk ${(i + c) % 5 === 2 ? 'hi' : 'lo'}">${esc(name)}</text>`).join('');
    return `<g class="pk${c}">${column}<g transform="translate(0 ${block})">${column}</g></g>`;
  }).join('');
  defs.push('<radialGradient id="scrim"><stop offset="0" stop-color="#000" stop-opacity=".72"/><stop offset=".6" stop-color="#000" stop-opacity=".5"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>');
  defs.push(`<linearGradient id="veil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050507"/><stop offset=".24" stop-color="#050507" stop-opacity="0"/><stop offset=".72" stop-color="#050507" stop-opacity="0"/><stop offset="1" stop-color="#050507"/></linearGradient><linearGradient id="glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".34"/><stop offset=".35" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#B9A8FF" stop-opacity=".26"/></linearGradient>`);

  const panel = (x, id, inside, { name, desc, stars, link }, step) => {
    const frame = `x="${x}" y="${panelTop}" width="${panelWidth}" height="${panelHeight}" rx="13"`, end = x + panelWidth, count = compact(stars);
    const line = panelTop + panelHeight;
    return `<ellipse cx="${x + panelWidth / 2}" cy="${line + 36}" rx="${panelWidth * 0.62}" ry="44" fill="url(#scrim)"/>` + rise(step, `<clipPath id="${id}"><rect ${frame}/></clipPath><rect ${frame} fill="#050507"/><g clip-path="url(#${id})">${inside}</g><rect x="${x + 0.5}" y="${panelTop + 0.5}" width="${panelWidth - 1}" height="${panelHeight - 1}" rx="12.5" fill="none" stroke="url(#glass)"/>${text(BOLD, name, x, line + 30, 20, T.title, { track: -0.3 })}${text(REG, desc, x, line + 50, 13.5, T.soft)}${text(BOLD, count, end, line + 29.5, 16, T.title, { anchor: 'end' })}${star(end - width(BOLD, count, 16) - 10, line + 24, 6, T.title)}${text(REG, link, end, line + 50, 13.5, T.dim, { anchor: 'end' })}`);
  };
  layers.push(panel(MARGIN, 'demo0', slideshow(MARGIN), { name: 'Better Fullstack', desc: 'Full-stack apps in one command', stars: data.stars.betterFullstack, link: 'better-fullstack.dev' }, 9));
  const second = MARGIN + panelWidth + 26;
  layers.push(panel(second, 'demo1', `${packages(second)}<rect x="${second}" y="${panelTop}" width="${panelWidth}" height="${panelHeight}" fill="url(#veil)"/>`, { name: 'awesome-effect', desc: 'The Effect ecosystem, curated', stars: data.stars.awesomeEffect, link: 'This Week in Effect #133' }, 10));
  return panelTop + panelHeight + 56;
}

const LIBRARIES = [
  { name: 'Effect', icon: 'effect', users: ['Cloudflare', 'OpenRouter', 'OpenCode', 'T3 Code'] },
  { name: 'Material UI', icon: 'mui', brand: '#007FFF', users: ['Netflix', 'NASA', 'Spotify', 'Amazon'] },
  { name: 'React Native', icon: 'react', brand: '#149ECA', users: ['Meta', 'Microsoft', 'Amazon', 'Shopify'] },
  { name: 'React Hook Form', icon: 'reacthookform', brand: '#EC5990', users: ['Grafana', 'Supabase'] },
  { name: 'tRPC', icon: 'trpc', brand: '#398CCB', users: ['Netflix'] },
  { name: 'Cheerio', icon: 'cheerio', brand: '#E88C1F', users: ['Google'] },
  { name: 'Floating UI', image: 'logos/used-by/floating-ui.png', users: ['Palantir'] },
];
const COMPANIES = [['Netflix', 'netflix', '#E50914'], ['Meta', 'meta', '#0081FB'], ['Google', 'google', '#4285F4'], ['Microsoft', 'microsoft'], ['Amazon', 'amazon', '#FF9900'], ['Cloudflare', 'cloudflare', '#F38020'], ['Spotify', 'spotify', '#1DB954'], ['NASA', 'nasa', '#E03C31'], ['Shopify', 'shopify', '#7AB55C'], ['Palantir', 'palantir'], ['Grafana', 'grafana', '#F46800'], ['Supabase', 'supabase', '#3FCF8E'], ['OpenRouter', 'openrouter'], ['OpenCode', 'opencode'], ['T3 Code', 't3']];

function wall(top) {
  const slots = LIBRARIES.length, hold = 2.2, fade = 0.5, total = +(slots * hold).toFixed(2);
  const pct = (t) => `${(t / total * 100).toFixed(3)}%`;
  const frames = new Map();
  const cycle = (prefix, active, on, off) => {
    const name = `${prefix}${active.join('')}`;
    if (!frames.has(name)) {
      const value = (slot) => (active.includes((slot + slots) % slots) ? on : off);
      frames.set(name, `@keyframes ${name}{${Array.from({ length: slots }, (_, slot) => `${pct(slot * hold)}{opacity:${value(slot - 1)}}${pct(slot * hold + fade)}{opacity:${value(slot)}}`).join('')}100%{opacity:${value(slots - 1)}}}.${name}{animation:${name} ${total}s ease-in-out infinite}`);
    }
    return name;
  };
  const glows = new Map();
  const glow = (color = '#CFCBC2') => { if (!glows.has(color)) glows.set(color, `glow${glows.size}`); return glows.get(color); };
  const listWidth = 270, rowHeight = 40, gap = 8, columns = 5;
  const wallX = MARGIN + listWidth + 26;
  const tileWidth = (RIGHT - wallX - gap * (columns - 1)) / columns, tileHeight = (slots * rowHeight - gap * 2) / 3;
  const list = LIBRARIES.map((lib, i) => {
    const y = top + i * rowHeight;
    const mark = lib.image ? `<clipPath id="lib${i}"><rect x="${MARGIN + 12}" y="${y + 11}" width="18" height="18" rx="4"/></clipPath><image href="${asset(lib.image)}" x="${MARGIN + 12}" y="${y + 11}" width="18" height="18" clip-path="url(#lib${i})"/>` : icon(lib.icon, MARGIN + 12, y + 11, 18, lib.brand ?? T.title);
    return rise(12 + i, `<rect class="${cycle('h', [i], 1, 0)}" opacity="0" x="${MARGIN}" y="${y}" width="${listWidth}" height="${rowHeight}" rx="9" fill="${T.chip}"/><clipPath id="wr${i}"><rect x="${MARGIN}" y="${y}" width="${listWidth}" height="${rowHeight}" rx="9"/></clipPath><g clip-path="url(#wr${i})"><ellipse class="${cycle('q', [i], 0.5, 0)}" opacity="0" cx="${MARGIN}" cy="${y + rowHeight / 2}" rx="${listWidth * 0.7}" ry="${rowHeight * 1.8}" fill="url(#${glow(lib.brand)})"/></g>${mark}${text(BOLD, lib.name, MARGIN + 41, y + 25, 15, T.title, { track: -0.18 })}${text(REG, millions(data.downloads[i]), MARGIN + listWidth - 12, y + 24.5, 13, T.soft, { anchor: 'end' })}`);
  }).join('');
  const tiles = COMPANIES.map(([company, glyph, brand], i) => {
    const x = wallX + (i % columns) * (tileWidth + gap), y = top + Math.floor(i / columns) * (tileHeight + gap);
    const active = LIBRARIES.flatMap((lib, slot) => (lib.users.includes(company) ? [slot] : []));
    const frame = `x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${tileWidth.toFixed(1)}" height="${tileHeight.toFixed(1)}" rx="10"`;
    return rise(13 + i, `<g class="${cycle('t', active, 1, 0.5)}"><clipPath id="wt${i}"><rect ${frame}/></clipPath><g clip-path="url(#wt${i})"><rect ${frame} fill="${T.chip}"/><ellipse class="${cycle('g', active, 1, 0)}" opacity="0" cx="${(x + tileWidth / 2).toFixed(1)}" cy="${(y + tileHeight * 1.25).toFixed(1)}" rx="${(tileWidth * 1.5).toFixed(1)}" ry="${(tileHeight * 1.2).toFixed(1)}" fill="url(#${glow(brand)})"/><rect class="${cycle('n', active, 0.9, 0)}" opacity="0" ${frame} fill="url(#grain)"/></g><rect class="${cycle('r', active, 1, 0)}" opacity="0" x="${(x + 0.75).toFixed(2)}" y="${(y + 0.75).toFixed(2)}" width="${(tileWidth - 1.5).toFixed(1)}" height="${(tileHeight - 1.5).toFixed(1)}" rx="9.25" fill="none" stroke="${T.title}" stroke-width="1.5"/>${icon(glyph, x + tileWidth / 2 - 12, y + 20, 24, brand ?? T.title)}${text(REG, company, x + tileWidth / 2, y + 65, 13, T.title, { anchor: 'middle' })}</g>`);
  }).join('');
  defs.push([...glows].map(([color, name]) => `<radialGradient id="${name}"><stop offset="0" stop-color="${color}"/><stop offset=".12" stop-color="${color}"/><stop offset=".72" stop-color="${color}" stop-opacity="0"/></radialGradient>`).join(''));
  css.push([...frames.values()].join(''));
  layers.push(rise(11, `${text(REG, 'Libraries I contribute to, and who uses them', MARGIN, top - 22, 15, T.soft)}`) + list + tiles);
  return top + slots * rowHeight;
}

function bento(top) {
  const byName = new Map(contributions.map((repo) => [repo.name, repo]));
  const cell = 45, rowHeight = 38, gap = 4;
  const PLACED = [['effect', 1, 5, 1, 3, 'hero'], ['react-native', 6, 4, 1, 3, 'hero'], ['material-ui', 10, 2, 1, 2, 'named'], ['bat', 12, 2, 1, 2, 'named'], ['t3code', 14, 2, 1, 2, 'named'], ['e2e', 10, 2, 3, 1, 'strip'], ['SwiftFormat', 12, 3, 3, 1, 'strip'], ['virtual', 15, 2, 3, 1, 'strip'], ['react-hook-form', 1, 3, 4, 2, 'named'], ['trpc', 4, 2, 4, 2, 'named'], ['floating-ui', 6, 2, 4, 2, 'named'], ['slate', 8, 2, 4, 2, 'named'], ['cheerio', 10, 2, 4, 2, 'named'], ['immer', 12, 2, 4, 2, 'named'], ['oxc', 14, 2, 4, 2, 'named'], ['synara', 1, 3, 6, 1, 'strip'], ['vite-plus', 4, 2, 6, 1, 'strip']].filter(([name]) => byName.has(name));
  const placed = new Set(PLACED.map(([name]) => name));
  const rest = contributions.filter((repo) => !placed.has(repo.name)).sort((a, b) => b.stars - a.stars);
  const slots = [[16, 1], [16, 2], [16, 4], [16, 5], ...Array.from({ length: 11 }, (_, i) => [6 + i, 6])];
  const span = (count, unit) => count * unit + (count - 1) * gap;
  const tiles = [...PLACED.map(([name, col, cols, row, rows, kind]) => ({ repo: byName.get(name), col, cols, row, rows, kind })), ...rest.map((repo, i) => ({ repo, col: slots[i][0], cols: 1, row: slots[i][1], rows: 1, kind: 'logo' }))]
    .map((tile, i) => ({ ...tile, i, x: MARGIN + (tile.col - 1) * (cell + gap), y: top + (tile.row - 1) * (rowHeight + gap), w: span(tile.cols, cell), h: span(tile.rows, rowHeight) }));
  const maxPrs = Math.max(...contributions.map((repo) => repo.prs));
  const heat = (repo) => Math.log(1 + repo.prs) / Math.log(1 + maxPrs);
  const clouds = new Map();
  const cloud = (color, opacity) => { const key = `${color}${opacity.toFixed(2)}`; if (!clouds.has(key)) clouds.set(key, { name: `cloud${clouds.size}`, color, opacity: opacity.toFixed(2) }); return clouds.get(key).name; };
  const twinkle = (tile, count) => { const next = seeded(11 + tile.i * 7); return Array.from({ length: count }, () => `<circle cx="${(tile.x + next() * tile.w).toFixed(1)}" cy="${(tile.y + next() * tile.h).toFixed(1)}" r="${(0.45 + next() * 0.6).toFixed(2)}" fill="#fff" opacity=".35"><animate attributeName="opacity" values=".1;.7;.1" dur="${(2.5 + next() * 4).toFixed(1)}s" begin="-${(next() * 4).toFixed(1)}s" repeatCount="indefinite"/></circle>`).join(''); };
  const nebula = (tile) => {
    if (tile.kind === 'logo') return twinkle(tile, 1);
    const level = 0.3 + 0.7 * heat(tile.repo), reach = tile.kind === 'hero' ? 1 : tile.kind === 'named' ? 0.6 : 0.42;
    const vx = tile.x + tile.w * 0.78, ay = tile.y + tile.h * 0.45;
    return `<ellipse cx="${vx.toFixed(1)}" cy="${(tile.y + tile.h * 0.12).toFixed(1)}" rx="${110 * reach}" ry="${70 * reach}" fill="url(#${cloud('#7B5CFF', level * 0.85)})"><animate attributeName="cx" values="${vx.toFixed(1)};${(vx - 14 * reach).toFixed(1)};${vx.toFixed(1)}" dur="${14 + (tile.i % 6)}s" ${SWAY} repeatCount="indefinite"/></ellipse><ellipse cx="${tile.x + tile.w}" cy="${ay.toFixed(1)}" rx="${80 * reach}" ry="${52 * reach}" fill="url(#${cloud('#FF8A3C', level * 0.7)})"><animate attributeName="cy" values="${ay.toFixed(1)};${(ay - 12 * reach).toFixed(1)};${ay.toFixed(1)}" dur="${17 + (tile.i % 5)}s" ${SWAY} repeatCount="indefinite"/></ellipse>${twinkle(tile, tile.kind === 'hero' ? 7 : 3)}`;
  };
  const frame = (tile) => `x="${tile.x}" y="${tile.y}" width="${tile.w}" height="${tile.h}" rx="9"`;
  const backs = tiles.map((tile) => `<clipPath id="bt${tile.i}"><rect ${frame(tile)}/></clipPath><rect ${frame(tile)} fill="#0C0C0F"/><g clip-path="url(#bt${tile.i})">${nebula(tile)}<rect ${frame(tile)} fill="url(#grain)"/></g><rect x="${tile.x + 0.5}" y="${tile.y + 0.5}" width="${tile.w - 1}" height="${tile.h - 1}" rx="8.5" fill="none" stroke="#19191C"/>`).join('');
  const mark = (tile, x, y, size) => `<clipPath id="bl${tile.i}"><rect x="${x}" y="${y}" width="${size}" height="${size}" rx="5"/></clipPath><image href="${tile.repo.image}" x="${x}" y="${y}" width="${size}" height="${size}" clip-path="url(#bl${tile.i})"/>`;
  const starred = (x, baseline, size, stars) => { const label = compact(stars), radius = size * 0.37; return { svg: `${star(x + radius, baseline - size * 0.33, radius, T.soft)}${text(REG, label, x + radius * 2 + 4, baseline, size, T.soft)}`, end: x + radius * 2 + 4 + width(REG, label, size) }; };
  const fitted = (name, room, size) => Math.min(size, size * room / width(BOLD, name, size, -0.15));
  const severities = [['High', '#FF9E9E'], ['Moderate', '#F2C879'], ['Low', '#9CC7F0']];
  const fronts = tiles.map((tile) => {
    const { repo, x, y, w, h, kind } = tile, bottom = y + h;
    if (kind === 'logo') return rise(22 + tile.i, mark(tile, x + (w - 15) / 2, y + (h - 15) / 2, 15));
    if (kind === 'strip') {
      const size = fitted(repo.name, w - 38, 12);
      return rise(20 + tile.i, `${mark(tile, x + 8, y + 11, 16)}${text(BOLD, repo.name, x + 30, y + 23.5, size, T.title, { track: -0.15 })}${repo.prs > 2 ? text(REG, plural(repo.prs, 'PR'), x + 30 + width(BOLD, repo.name, size, -0.15) + 7, y + 23.5, 11, T.soft) : ''}`);
    }
    if (kind === 'named') return rise(18 + tile.i, `${mark(tile, x + 9, y + 8, 20)}${text(BOLD, repo.name, x + 9, bottom - 26, fitted(repo.name, w - 18, 12.5), T.title, { track: -0.15 })}${starred(x + 9, bottom - 10, 11, repo.stars).svg}${text(REG, plural(repo.prs, 'PR'), x + w - 9, bottom - 10, 11, T.soft, { anchor: 'end' })}`);
    const reports = repo.name === 'effect', statsLine = bottom - (reports ? 57 : 14), titleLine = statsLine - 22;
    const stars = starred(x + 14, statsLine, 13, repo.stars);
    let cursor = x + 14;
    const marks = severities.map(([label, color]) => { const out = `<circle cx="${(cursor + 3).toFixed(1)}" cy="${bottom - 17}" r="3" fill="${color}"/>${text(REG, label, cursor + 11, bottom - 13, 11.5, T.soft)}`; cursor += 22 + width(REG, label, 11.5); return out; }).join('');
    return rise(16 + tile.i, `${mark(tile, x + 14, titleLine - 18, 24)}${text(BOLD, repo.name, x + 47, titleLine, 17, T.title, { track: -0.25 })}${stars.svg}<circle cx="${(stars.end + 8.5).toFixed(1)}" cy="${statsLine - 4.5}" r="1.5" fill="${T.soft}" opacity=".6"/>${text(REG, `${plural(repo.prs, 'PR')} merged`, stars.end + 17, statsLine, 13, T.soft)}${reports ? `<path d="M${x + 14} ${bottom - 46.5}H${x + w - 14}" stroke="#2A2A2E"/>${text(SANS, '3 vulnerabilities reported', x + 14, bottom - 30, 12.5, T.title)}${marks}` : ''}`);
  }).join('');
  defs.push([...clouds.values()].map(({ name, color, opacity }) => `<radialGradient id="${name}"><stop offset="0" stop-color="${color}" stop-opacity="${opacity}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`).join(''));
  layers.push(rise(15, text(REG, 'Merged pull requests', MARGIN, top - 20, 15, T.soft)) + backs + fronts);
  return top + span(6, rowHeight);
}

function stats(top) {
  layers.push(`<g class="va">${heading('GitHub stats', top, 26)}</g><g class="vb" opacity="0">${heading('AI coding stats', top, 26)}</g>`);
  const streaks = [];
  let open = null;
  for (const day of data.days) {
    if (day.count > 0) open = open ? { ...open, end: day.date, length: open.length + 1 } : { start: day.date, end: day.date, length: 1 };
    else if (open) { streaks.push(open); open = null; }
  }
  if (open) streaks.push(open);
  const empty = { length: 0 };
  const longest = streaks.reduce((best, streak) => (streak.length > best.length ? streak : best), empty);
  const last = streaks.at(-1);
  const current = last && data.days.slice(-2).map((day) => day.date).includes(last.end) ? last : empty;
  const shortDate = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const monthYear = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  const range = (streak) => (streak.length ? `${shortDate(streak.start)} to ${shortDate(streak.end)}` : 'No streak yet');
  const between = ({ from, through }) => `${shortDate(from)} to ${shortDate(through)}`;
  const AGENTS = { claude: 'Claude Code', codex: 'Codex', opencode: 'OpenCode' };
  const github = [[data.totalContributions.toLocaleString('en-US'), 'Total contributions', `since ${monthYear(data.days.find((day) => day.count > 0).date)}`], [plural(current.length, 'day'), 'Current streak', range(current)], [plural(longest.length, 'day'), 'Longest streak', range(longest)], [data.mergedPullRequests.toLocaleString('en-US'), 'Pull requests merged', 'in public repositories'], [data.starsEarned.toLocaleString('en-US'), 'Stars earned', 'on my repositories']];
  const tokens = [[billions(ai.totalTokens), 'Total AI tokens', `since ${monthYear(ai.period.from)}`], [billions(ai.last30Days.tokens), 'Last 30 days', between(ai.last30Days)], [billions(ai.last7Days.tokens), 'Last 7 days', between(ai.last7Days)], [`${ai.activeDays} of ${ai.period.days}`, 'Active days', 'with coding agents'], [String(ai.agentCount), 'Coding agents', ai.topAgents.map((agent) => AGENTS[agent] ?? agent).join(' and ')]];
  const size = 12, mapTop = top + 124;
  const view = (figures, grid, cellWidth, fill, step) => {
    const pitch = (SPAN - cellWidth) / (grid.length - 1), figureWidth = SPAN / figures.length;
    const cells = figures.map(([value, label, note], i) => {
      const x = MARGIN + i * figureWidth + (i ? 18 : 0);
      return `${i ? `<path d="M${(MARGIN + i * figureWidth + 0.5).toFixed(1)} ${top + 24}V${top + 84}" stroke="#2A2A2E"/>` : ''}${text(BOLD, value, x, top + 46, 24, T.title, { track: -0.5 })}${text(REG, label, x, top + 66, 12.5, T.soft)}${text(REG, note, x, top + 83, 11.5, T.dim)}`;
    }).join('');
    let month = '';
    const map = grid.map((week, column) => {
      const x = MARGIN + column * pitch;
      const name = new Date(`${week[0].date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
      const label = name !== month && column < grid.length - 2 ? text(REG, name, x, mapTop - 9, 11, T.dim) : '';
      month = name;
      return `${label}${week.map((day) => `<rect x="${x.toFixed(2)}" y="${(mapTop + new Date(`${day.date}T00:00:00Z`).getUTCDay() * (size + 2.6)).toFixed(1)}" width="${cellWidth.toFixed(2)}" height="${size}" rx="3" fill="${fill(day)}"/>`).join('')}`;
    }).join('');
    return step === null ? `${cells}${map}` : rise(step, `${cells}${map}`);
  };
  const heat = (hue, steps) => ['#131316', ...steps.map((amount) => (amount <= 1 ? mix('#0A0A0F', hue, amount) : mix(hue, '#FFFFFF', amount - 1)))];
  const [none, first, second, third, fourth] = heat('#7B5CFF', [0.38, 0.62, 1.12, 1.55]);
  const LEVELS = { NONE: none, FIRST_QUARTILE: first, SECOND_QUARTILE: second, THIRD_QUARTILE: third, FOURTH_QUARTILE: fourth };
  const TOKEN = heat('#FF8A3C', [0.3, 0.48, 0.7, 1.1, 1.5]);
  const tokenWeeks = [];
  for (const day of ai.days) { if (!tokenWeeks.length || new Date(`${day.date}T00:00:00Z`).getUTCDay() === 0) tokenWeeks.push([]); tokenWeeks.at(-1).push(day); }
  const spent = ai.days.map((day) => day.value).filter((value) => value > 0).sort((a, b) => a - b);
  const thresholds = [0.25, 0.5, 0.75, 0.9].map((ratio) => spent[Math.floor((spent.length - 1) * ratio)] ?? 0);
  const level = (day) => { if (day.value === 0) return day.inferred ? 1 : 0; const index = thresholds.findIndex((threshold) => day.value <= threshold); return index === -1 ? 5 : index + 1; };
  css.push('@keyframes va{0%,42%{opacity:1}50%,92%{opacity:0}100%{opacity:1}}@keyframes vb{0%,42%{opacity:0}50%,92%{opacity:1}100%{opacity:0}}.va{animation:va 16s ease-in-out infinite}.vb{animation:vb 16s ease-in-out infinite}');
  layers.push(`<g class="va">${view(github, data.weeks, size, (day) => LEVELS[day.contributionLevel], null)}</g><g class="vb" opacity="0">${view(tokens, tokenWeeks, (SPAN - 2.6 * (tokenWeeks.length - 1)) / tokenWeeks.length, (day) => TOKEN[level(day)], null)}</g>`);
  return mapTop + 7 * (size + 2.6);
}

const grainNoise = seeded(23);
const grainPixels = Buffer.from(Array.from({ length: 128 * 128 }, () => [0, Math.max(0, Math.min(255, Math.round((0.2 + (grainNoise() + grainNoise() + grainNoise() - 1.5) * 0.5) * 255)))]).flat());
defs.push(`<pattern id="grain" width="128" height="128" patternUnits="userSpaceOnUse"><image href="data:image/png;base64,${(await sharp(grainPixels, { raw: { width: 128, height: 128, channels: 2 } }).png().toBuffer()).toString('base64')}" width="128" height="128"/></pattern><linearGradient id="rule" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><clipPath id="page"><rect width="${W}" height="${H}" rx="18"/></clipPath>`);

sky();
dawn();
eclipse();
await experience();
const stackEnd = stack(456);
const projectsEnd = await projects(stackEnd + 60);
layers.push(heading('Contributed to', ECLIPSE.top + 132, 11));
const wallEnd = wall(ECLIPSE.top + 196);
const bentoEnd = bento(wallEnd + 66);
const statsEnd = stats(bentoEnd + 62);
if (projectsEnd > ECLIPSE.top - 20) throw new Error(`Projects end at ${projectsEnd}, past the eclipse rim at ${ECLIPSE.top}`);
if (statsEnd > bowlY(MARGIN) - 20) throw new Error(`Stats end at ${statsEnd}, past the eclipse floor at ${Math.round(bowlY(MARGIN))}`);

const title = 'Experience, tech stack, projects, open-source contributions and GitHub stats of Ibrahim Elkamali.';
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title><defs>${defs.join('')}</defs>
<style>@keyframes in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}.in{animation:in .6s cubic-bezier(.2,.8,.2,1) both}${css.join('')}@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>
<g clip-path="url(#page)"><rect width="${W}" height="${H}" fill="#000"/>${layers.join('\n')}</g><rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="17.5" fill="none" stroke="#232323"/></svg>`;
fs.writeFileSync(path.join(ROOT, 'assets', 'profile', 'profile.svg'), svg);
console.log(`profile.svg ${(Buffer.byteLength(svg) / 1024 / 1024).toFixed(2)} MB`);
