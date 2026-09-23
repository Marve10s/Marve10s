import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { extname } from "node:path";
import { fileURLToPath } from "node:url";

const OWNER = "Marve10s";

const REPOS = [
  { owner: "Marve10s", repo: "Better-Fullstack", logo: "better-fullstack.svg", accent: "#C6E853" },
  {
    owner: "Marve10s",
    repo: "awesome-effect",
    logo: "effect.png",
    accent: "#E8612D",
    featured: "Featured in This Week in Effect #133",
  },
];

// Without a logo, a contribution card shows the owner's GitHub avatar.
const CONTRIBUTIONS = [
  { owner: "pingdotgg", repo: "t3code", logo: "t3code.svg" },
  { owner: "Effect-TS", repo: "effect", logo: "effect.png" },
  { owner: "Emanuele-web04", repo: "synara", logo: "synara.png" },
];

const THEME = {
  bg: "#211E1E",
  title: "#CFCECD",
  body: "#8F8B8A",
  text: "#656363",
  border: "#3A3535",
  pill: "#2C2828",
};

const FONT = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
const LINE_CHARS = 62;

const LANG_COLORS = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Rust: "#dea584",
  Python: "#3572A5",
  Go: "#00ADD8",
  Java: "#b07219",
  Shell: "#89e051",
  HTML: "#e34c26",
  CSS: "#563d7c",
};

const STAR_PATH = "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z";
const FORK_PATHS = `<circle cx="12" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9"/><path d="M12 12v3"/>`;
const MERGE_PATHS = `<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/>`;

const escapeXml = (s) =>
  s.replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]
  );

function wrapDescription(text) {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    if ((line + " " + word).trim().length > LINE_CHARS) {
      if (line) lines.push(line.trim());
      line = word;
      if (lines.length === 2) break;
    } else {
      line = (line + " " + word).trim();
    }
  }
  if (lines.length < 2 && line) lines.push(line.trim());
  if (lines.length === 2) {
    const joined = lines.join(" ");
    if (joined.length > text.length) return lines;
    if (words.join(" ").length > joined.length) lines[1] = lines[1] + "…";
  }
  return lines.slice(0, 2);
}

function formatCount(n) {
  if (n >= 1000) {
    const k = n / 1000;
    return (k >= 10 ? Math.round(k) : Math.round(k * 10) / 10) + "k";
  }
  return String(n);
}

const MIME = { ".svg": "image/svg+xml", ".png": "image/png" };

function logoDataUri(file) {
  const path = fileURLToPath(new URL(`../assets/logos/${file}`, import.meta.url));
  return `data:${MIME[extname(file)]};base64,${readFileSync(path).toString("base64")}`;
}

// Pill with an icon and a fixed-width label; textLength keeps the label inside the pill in any font.
function pill({ x, y, label, icon, color, fill = THEME.pill, stroke = "none" }) {
  const textWidth = label.length * 6.3;
  const width = textWidth + (icon ? 38 : 24);
  const textX = x + (icon ? 28 : 12);
  const svg = `<rect x="${x}" y="${y}" width="${width}" height="24" rx="12" fill="${fill}" stroke="${stroke}"/>
  ${icon ? `<g transform="translate(${x + 10},${y + 5}) scale(0.58)" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${icon}</g>` : ""}
  <text x="${textX}" y="${y + 16}" font-size="12" font-weight="600" fill="${color}" textLength="${textWidth}" lengthAdjust="spacing">${escapeXml(label)}</text>`;
  return { svg, width };
}

function repoCardSvg({ fullName, description, language, stars, forks, logo, accent, featured }) {
  const [, name] = fullName.split("/");
  const width = 496;
  const height = 168;
  const descSvg = wrapDescription(description)
    .map((line, i) => `<text x="20" y="${98 + i * 20}" font-size="13.5" fill="${THEME.body}">${escapeXml(line)}</text>`)
    .join("\n  ");

  const starPill = pill({ x: 20, y: 132, label: formatCount(stars), icon: `<path d="${STAR_PATH}" fill="${accent}"/>`, color: THEME.title });
  const forkPill = pill({ x: 28 + starPill.width, y: 132, label: formatCount(forks), icon: FORK_PATHS, color: THEME.title });
  let featuredSvg = "";
  if (featured) {
    const probe = pill({ x: 0, y: 0, label: featured, color: accent });
    featuredSvg = pill({ x: width - 20 - probe.width, y: 132, label: featured, color: accent, fill: "none", stroke: accent }).svg;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(fullName)}: ${escapeXml(description)}">
  <style>text { font-family: ${FONT}; }</style>
  <defs>
    <radialGradient id="glow" cx="1" cy="0" r="0.75">
      <stop offset="0" stop-color="${accent}" stop-opacity="0.16"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="logo"><rect x="20" y="20" width="48" height="48" rx="12"/></clipPath>
  </defs>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="12" fill="${THEME.bg}" stroke="${THEME.border}"/>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="12" fill="url(#glow)"/>
  <image href="${logoDataUri(logo)}" x="20" y="20" width="48" height="48" clip-path="url(#logo)"/>
  <text x="82" y="41" font-size="20" font-weight="600" fill="${THEME.title}">${escapeXml(name)}</text>
  ${language ? `<circle cx="86" cy="58" r="4" fill="${LANG_COLORS[language] ?? "#8b949e"}"/>
  <text x="96" y="62" font-size="12" fill="${THEME.text}">${escapeXml(language)}</text>` : ""}
  ${descSvg}
  ${starPill.svg}
  ${forkPill.svg}
  ${featuredSvg}
</svg>
`;
}

async function gh(path) {
  const headers = { Accept: "application/vnd.github+json", "User-Agent": "pin-card-generator" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(`https://api.github.com/${path}`, { headers });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.status === 202 ? null : res.json();
}

async function fetchRepo({ owner, repo, ...card }) {
  const data = await gh(`repos/${owner}/${repo}`);
  return {
    ...card,
    fullName: data.full_name,
    description: data.description ?? "",
    language: data.language ?? "",
    stars: data.stargazers_count,
    forks: data.forks_count,
  };
}

/* ---------- Compact contribution cards ---------- */
const CONTRIB_ACCENT = "#E8612D";

async function avatarDataUri(owner) {
  const res = await fetch(`https://github.com/${owner}.png?size=80`);
  if (!res.ok) throw new Error(`${owner} avatar: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return `data:${res.headers.get("content-type")};base64,${buf.toString("base64")}`;
}

async function fetchContribution({ owner, repo, logo }) {
  const [data, prs, image] = await Promise.all([
    gh(`repos/${owner}/${repo}`),
    gh(`search/issues?q=${encodeURIComponent(`repo:${owner}/${repo} author:${OWNER} is:pr is:merged`)}`),
    logo ? logoDataUri(logo) : avatarDataUri(owner),
  ]);
  return { fullName: data.full_name, stars: data.stargazers_count, merged: prs.total_count, image };
}

function contributionCardSvg({ fullName, stars, merged, image }) {
  const [owner, repo] = fullName.split("/");
  const width = 320;
  const height = 72;
  const prLabel = `${merged} merged PR${merged === 1 ? "" : "s"}`;
  const starsX = 84 + prLabel.length * 6.6 + 14;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(fullName)}: ${prLabel}">
  <style>text { font-family: ${FONT}; }</style>
  <defs><clipPath id="logo"><rect x="16" y="16" width="40" height="40" rx="8"/></clipPath></defs>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="10" fill="${THEME.bg}" stroke="${THEME.border}"/>
  <rect x="0.5" y="18" width="3" height="${height - 36}" rx="1.5" fill="${CONTRIB_ACCENT}"/>
  <image href="${image}" x="16" y="16" width="40" height="40" clip-path="url(#logo)"/>
  <text x="68" y="33" font-size="15"><tspan fill="${THEME.text}">${escapeXml(owner)}/</tspan><tspan font-weight="600" fill="${THEME.title}">${escapeXml(repo)}</tspan></text>
  <g transform="translate(68,43) scale(0.5)" fill="none" stroke="${CONTRIB_ACCENT}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${MERGE_PATHS}</g>
  <text x="84" y="53" font-size="12" fill="${THEME.title}">${prLabel}</text>
  <text x="${starsX}" y="53" font-size="12" fill="${THEME.text}">★ ${formatCount(stars)}</text>
</svg>
`;
}

const results = await Promise.all(REPOS.map(fetchRepo));
const pinsDir = fileURLToPath(new URL("./pins/", import.meta.url));
mkdirSync(pinsDir, { recursive: true });
for (const data of results) {
  const svg = repoCardSvg(data);
  const filename = data.fullName.toLowerCase().replace("/", "-") + ".svg";
  writeFileSync(pinsDir + filename, svg);
}
console.log(`Generated ${results.length} pin cards`);

const contributions = await Promise.all(CONTRIBUTIONS.map(fetchContribution));
const contribDir = fileURLToPath(new URL("./contrib/", import.meta.url));
rmSync(contribDir, { recursive: true, force: true });
mkdirSync(contribDir, { recursive: true });
for (const data of contributions) {
  writeFileSync(contribDir + data.fullName.toLowerCase().replace("/", "-") + ".svg", contributionCardSvg(data));
}
console.log(`Generated ${contributions.length} contribution cards`);

/* ---------- Better-Fullstack commit heatmap ---------- */
const theme = { bg: "#211E1E", title: "#CFCECD", text: "#656363", accent: "#E8612D" };
const font = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

// GitHub answers 202 while it computes repo stats; retry briefly, then keep the last heatmap.
let weeks = null;
for (let attempt = 0; attempt < 5 && !weeks; attempt++) {
  if (attempt) await new Promise((resolve) => setTimeout(resolve, 3000));
  weeks = await gh(`repos/${OWNER}/Better-Fullstack/stats/commit_activity`);
}
if (weeks) {
  const totals = weeks.map((w) => w.total);
  const total = totals.reduce((a, b) => a + b, 0);
  const scale = ["#2b2828", "#5a3a22", "#a04e24", "#d3652c", theme.accent];
  const cell = 7, gap = 2;
  const heat = totals
    .map((t, w) => {
      const level = t === 0 ? 0 : t < 10 ? 1 : t < 25 ? 2 : t < 60 ? 3 : 4;
      return Array.from({ length: 7 }, (_, d) =>
        `<rect x="${16 + w * (cell + gap)}" y="${44 + d * (cell + gap)}" width="${cell}" height="${cell}" rx="1.5" fill="${scale[level]}"/>`
      ).join("");
    })
    .join("");

  writeFileSync(
    fileURLToPath(new URL("./heatmap.svg", import.meta.url)),
    `<svg xmlns="http://www.w3.org/2000/svg" width="496" height="168" viewBox="0 0 496 168" role="img" aria-label="Better-Fullstack commit heatmap">
    <style>text { font-family: ${font}; }</style>
    <rect width="496" height="168" rx="6" fill="${theme.bg}"/>
    <text x="16" y="26" font-size="11" font-weight="600" letter-spacing="2" fill="${theme.text}">BETTER-FULLSTACK · LAST 52 WEEKS</text>
    <text x="480" y="26" text-anchor="end" font-size="12" font-weight="700" fill="${theme.title}">${total.toLocaleString()} commits</text>
    ${heat}
    <text x="16" y="152" font-size="10" fill="${theme.text}">Less</text>
    ${scale.map((c, i) => `<rect x="${44 + i * 14}" y="${144}" width="9" height="9" rx="1.5" fill="${c}"/>`).join("")}
    <text x="122" y="152" font-size="10" fill="${theme.text}">More</text>
  </svg>
  `
  );
  console.log("Generated heatmap");
} else {
  console.log("Commit stats still computing; kept the previous heatmap");
}

/* ---------- Community quotes ---------- */
function quote(x, text, author) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    if ((line + " " + word).trim().length > 66) {
      lines.push(line.trim());
      line = word;
    } else line = (line + " " + word).trim();
  }
  lines.push(line.trim());
  return `
  <text x="${x + 16}" y="66" font-size="24" fill="${theme.accent}" opacity="0.8">"</text>
  ${lines.map((l, i) => `<text x="${x + 44}" y="${62 + i * 18}" font-size="12" font-style="italic" fill="${theme.title}">${escapeXml(l)}</text>`).join("")}
  <text x="${x + 44}" y="${62 + lines.length * 18 + 14}" font-size="11" fill="${theme.text}">— ${escapeXml(author)}, Better-Fullstack community</text>`;
}

writeFileSync(
  fileURLToPath(new URL("./quotes.svg", import.meta.url)),
  `<svg xmlns="http://www.w3.org/2000/svg" width="992" height="168" viewBox="0 0 992 168" role="img" aria-label="Community quotes">
  <style>text { font-family: ${font}; }</style>
  <rect width="992" height="168" rx="6" fill="${theme.bg}"/>
  <text x="16" y="30" font-size="11" font-weight="600" letter-spacing="2" fill="${theme.text}">WHAT USERS SAY</text>
  <line x1="496" y1="44" x2="496" y2="148" stroke="#313131" stroke-width="1"/>
  ${quote(0, "Its really big project for a one man team, to also cover such wide range of technologies.", "moreorover")}
  ${quote(496, "I hope your library will grow and get more attention.", "m-t-a97")}
</svg>
`
);
console.log("Generated quotes");
