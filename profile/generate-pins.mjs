const OWNER = "Marve10s";

const REPOS = [
  { owner: "Marve10s", repo: "Better-Fullstack" },
  { owner: "Marve10s", repo: "awesome-effect" },
  { owner: "Emanuele-web04", repo: "synara" },
  { owner: "pingdotgg", repo: "t3code" },
];

const DESCRIPTIONS = {
  "pingdotgg/t3code":
    "Agent harness control surface — control Claude Code, Codex, Cursor, and more from a mobile, web, or desktop app",
};

const FEATURED = {
  "Marve10s/awesome-effect": "Featured in This Week in Effect #133 — the official Effect blog",
};

const THEME = {
  bg: "#211E1E",
  title: "#CFCECD",
  text: "#656363",
  icon: "#CFCECD",
};

const WIDTH = 496;
const HEIGHT = 168;
const RADIUS = 6;
const PADDING = 16;
const LINE_CHARS = 66;

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

function repoCardSvg({ fullName, description, language, stars, forks }) {
  const title = fullName.includes("/") ? fullName.split("/")[1] : fullName;
  const descLines = wrapDescription(DESCRIPTIONS[fullName] ?? description);
  const langColor = LANG_COLORS[language] ?? "#8b949e";

  let footerX = PADDING;
  let footer = "";
  if (language) {
    footer += `<circle cx="${footerX + 6}" cy="146" r="6" fill="${langColor}"/>`;
    footer += `<text x="${footerX + 18}" y="150" font-size="12" fill="${THEME.text}">${escapeXml(language)}</text>`;
    footerX += 18 + language.length * 7 + 16;
  }
  footer += `<g transform="translate(${footerX},140) scale(0.5)" fill="none" stroke="${THEME.text}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></g>`;
  footer += `<text x="${footerX + 16}" y="150" font-size="12" fill="${THEME.text}">${formatCount(stars)}</text>`;
  footerX += 16 + String(formatCount(stars)).length * 7 + 16;
  footer += `<g transform="translate(${footerX},140) scale(0.5)" fill="none" stroke="${THEME.text}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><path d="M6 9v2a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V9"/><path d="M12 12v3"/></g>`;
  footer += `<text x="${footerX + 16}" y="150" font-size="12" fill="${THEME.text}">${formatCount(forks)}</text>`;

  const descSvg = descLines
    .map(
      (line, i) =>
        `<text x="${PADDING + 32}" y="${72 + i * 20}" font-size="12" fill="${THEME.text}">${escapeXml(line)}</text>`
    )
    .join("");

  const featured = FEATURED[fullName];
  const featuredSvg = featured
    ? `<text x="${PADDING + 32}" y="122" font-size="11" fill="${THEME.title}">📰 ${escapeXml(featured)}</text>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${escapeXml(fullName)} repository card">
  <style>
    .title { font: 600 16px -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; fill: ${THEME.title}; }
    text { font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; }
  </style>
  <rect width="${WIDTH}" height="${HEIGHT}" rx="${RADIUS}" fill="${THEME.bg}"/>
  <g transform="translate(${PADDING},26) scale(0.667)" fill="none" stroke="${THEME.icon}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
  </g>
  <text class="title" x="${PADDING + 32}" y="40">${escapeXml(title)}</text>
  ${descSvg}
  ${featuredSvg}
  ${footer}
</svg>
`;
}

async function fetchRepo({ owner, repo }) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "pin-card-generator",
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  if (!res.ok) throw new Error(`Failed to fetch ${owner}/${repo}: ${res.status}`);
  const data = await res.json();
  return {
    fullName: data.full_name,
    description: data.description ?? "",
    language: data.language ?? "",
    stars: data.stargazers_count,
    forks: data.forks_count,
  };
}

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const results = await Promise.all(REPOS.map(fetchRepo));
const pinsDir = fileURLToPath(new URL("./pins/", import.meta.url));
mkdirSync(pinsDir, { recursive: true });
for (const data of results) {
  const svg = repoCardSvg(data);
  const filename = data.fullName.toLowerCase().replace("/", "-") + ".svg";
  writeFileSync(pinsDir + filename, svg);
}
console.log(`Generated ${results.length} pin cards`);

/* ---------- Better-Fullstack commit heatmap ---------- */
const theme = { bg: "#211E1E", title: "#CFCECD", text: "#656363", accent: "#E8612D" };
const font = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

async function gh(path) {
  const headers = { Accept: "application/vnd.github+json", "User-Agent": "pin-card-generator" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(`https://api.github.com/${path}`, { headers });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

const weeks = await gh(`repos/${OWNER}/Better-Fullstack/stats/commit_activity`);
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
