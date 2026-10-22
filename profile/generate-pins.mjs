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
    hideForks: true,
  },
];

// Without a logo, a contribution shows the owner's GitHub avatar.
const CONTRIBUTIONS = [
  { owner: "pingdotgg", repo: "t3code", logo: "t3code.svg", takenOver: [13257] },
  { owner: "Effect-TS", repo: "effect", logo: "effect.png", takenOver: [8470] },
  { owner: "Emanuele-web04", repo: "synara", logo: "synara.png" },
  // React Native lands PRs through Meta's tooling, which closes them instead of merging, so count landed commits.
  { owner: "react", repo: "react-native", logo: "react-native.svg", countCommits: true },
  { owner: "react-hook-form", repo: "react-hook-form" },
  { owner: "trpc", repo: "trpc" },
  { owner: "ianstormtaylor", repo: "slate", logo: "slate.png" },
  { owner: "immerjs", repo: "immer" },
  { owner: "floating-ui", repo: "floating-ui" },
  { owner: "alchemy-run", repo: "distilled" },
  { owner: "oxc-project", repo: "oxc", takenOver: [26926] },
  { owner: "tester-army", repo: "e2e", takenOver: [873] },
  { owner: "nicklockwood", repo: "SwiftFormat", logo: "swift.svg" },
  { owner: "voidzero-dev", repo: "vite-plus", logo: "vite-plus.svg" },
  { owner: "react-hook-form", repo: "resolvers" },
  { owner: "ryansolid", repo: "dom-expressions", logo: "solid.svg" },
  { owner: "modevol-com", repo: "gqloom" },
  { owner: "Effect-TS", repo: "tsgo", logo: "effect.png" },
  { owner: "lucas-barake", repo: "effect-form", logo: "effect.png" },
  { owner: "nounder", repo: "effect-start", logo: "effect.png" },
  { owner: "lloydrichards", repo: "effect-boxes", logo: "effect.png" },
  { owner: "rjdellecese", repo: "effect-units", logo: "effect.png" },
  { owner: "tobimori", repo: "effect-attio", logo: "effect.png" },
  { owner: "jarrednorrisdev", repo: "effect-atom-svelte", logo: "effect-svelte.svg" },
  { owner: "leonitousconforti", repo: "eftar", logo: "effect.png" },
];

const EXPERIENCE = [
  {
    slug: "listening",
    company: "Listening.com",
    role: "Full Stack TypeScript Developer",
    dates: "Jan 2025 – Now",
    logo: "listening.svg",
    description:
      "Building Listening across its web app, Chromium extension, React Native mobile app, and Electron desktop app.",
  },
  {
    slug: "upwork",
    company: "Upwork",
    role: "Full Stack TypeScript Developer",
    dates: "Jun 2024 – Now",
    logo: "upwork.png",
    description:
      "Delivered 10+ full-stack projects for international clients, from React and Astro frontends to TypeScript backends.",
  },
];

const SKILLS = {
  react: { name: "React", icon: "react.svg" },
  tanstack: { name: "TanStack", icon: "tanstack.png" },
  astro: { name: "Astro", icon: "astro.svg" },
  next: { name: "Next.js", icon: "nextjs.svg" },
  expo: { name: "Expo", icon: "expo.png" },
  hono: { name: "Hono", icon: "hono.svg" },
  effect: { name: "Effect-TS", icon: "effect.svg" },
};

// Mirrors the portfolio hero row.
const FEATURED_STACK = ["tanstack", "astro", "next", "expo", "hono", "react", "effect"];

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

function assetDataUri(file) {
  const path = fileURLToPath(new URL(`../assets/${file}`, import.meta.url));
  return `data:${MIME[extname(file)]};base64,${readFileSync(path).toString("base64")}`;
}

const logoDataUri = (file) => assetDataUri(`logos/${file}`);

// Stat pill; sized from a generous per-character width so bold digits never overlap.
function pill({ x, y, label, icon }) {
  const width = 38 + label.length * 7.6;
  const svg = `<rect x="${x}" y="${y}" width="${width}" height="24" rx="12" fill="${THEME.pill}"/>
  <g transform="translate(${x + 10},${y + 5}) scale(0.58)" fill="none" stroke="${THEME.title}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${icon}</g>
  <text x="${x + 29}" y="${y + 16}" font-size="12" font-weight="600" fill="${THEME.title}">${escapeXml(label)}</text>`;
  return { svg, width };
}

function repoCardSvg({ fullName, description, language, stars, forks, logo, accent, featured, hideForks }) {
  const [, name] = fullName.split("/");
  const width = 496;
  const height = 168;
  const descSvg = wrapDescription(description)
    .map((line, i) => `<text x="20" y="${98 + i * 20}" font-size="13.5" fill="${THEME.body}">${escapeXml(line)}</text>`)
    .join("\n  ");

  const starPill = pill({ x: 20, y: 132, label: formatCount(stars), icon: `<path d="${STAR_PATH}" fill="${accent}" stroke="${accent}"/>` });
  const forkSvg = hideForks ? "" : pill({ x: 28 + starPill.width, y: 132, label: formatCount(forks), icon: FORK_PATHS }).svg;
  const featuredSvg = featured
    ? `<text x="${width - 20}" y="148" text-anchor="end" font-size="12" font-weight="600" fill="${accent}">${escapeXml(featured)}</text>`
    : "";

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
  ${forkSvg}
  ${featuredSvg}
</svg>
`;
}

function experienceCardSvg({ company, role, dates, logo, description }) {
  const width = 496;
  const height = 124;
  const descSvg = wrapDescription(description)
    .map((line, i) => `<text x="20" y="${92 + i * 19}" font-size="13" fill="${THEME.body}">${escapeXml(line)}</text>`)
    .join("\n  ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(`${role} at ${company}, ${dates}`)}">
  <style>text { font-family: ${FONT}; }</style>
  <defs><clipPath id="logo"><rect x="20" y="20" width="40" height="40" rx="10"/></clipPath></defs>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="12" fill="${THEME.bg}" stroke="${THEME.border}"/>
  <image href="${logoDataUri(logo)}" x="20" y="20" width="40" height="40" clip-path="url(#logo)"/>
  <text x="74" y="36" font-size="16" font-weight="600" fill="${THEME.title}">${escapeXml(company)}</text>
  <text x="476" y="36" text-anchor="end" font-size="12" fill="${THEME.text}">${escapeXml(dates)}</text>
  <text x="74" y="56" font-size="13" fill="${THEME.body}">${escapeXml(role)}</text>
  ${descSvg}
</svg>
`;
}

// Rough glyph widths for the UI font at 1px; textLength then pins the label to this width.
function textWidth(text, size) {
  let units = 0;
  for (const c of text) {
    if ("iljtf.,/' ".includes(c)) units += 0.3;
    else if ("rI".includes(c)) units += 0.38;
    else if (c >= "A" && c <= "Z") units += 0.66;
    else units += 0.56;
  }
  return Math.round(units * size);
}

function stackChip(x, y, key, { height, iconSize, fontSize }) {
  const { name, icon } = SKILLS[key];
  const pad = (height - iconSize) / 2 + 2;
  const labelWidth = textWidth(name, fontSize);
  const width = pad + iconSize + 8 + labelWidth + pad + 2;
  const svg = `<rect x="${x + 0.5}" y="${y + 0.5}" width="${width - 1}" height="${height - 1}" rx="8" fill="${THEME.bg}" stroke="${THEME.border}"/>
  <image href="${assetDataUri(`stack/${icon}`)}" x="${x + pad}" y="${y + (height - iconSize) / 2}" width="${iconSize}" height="${iconSize}"/>
  <text x="${x + pad + iconSize + 8}" y="${y + height / 2 + fontSize * 0.35}" font-size="${fontSize}" font-weight="500" fill="${THEME.title}" textLength="${labelWidth}" lengthAdjust="spacing">${escapeXml(name)}</text>`;
  return { svg, width };
}

function stackSvg(label, width, height, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(label)}">
  <style>text { font-family: ${FONT}; }</style>
  ${body}
</svg>
`;
}

function featuredStackSvg() {
  const size = { height: 40, iconSize: 20, fontSize: 14 };
  let x = 0;
  const chips = FEATURED_STACK.map((key) => {
    const chip = stackChip(x, 0, key, size);
    x += chip.width + 8;
    return chip.svg;
  });
  return stackSvg(`Main stack: ${FEATURED_STACK.map((key) => SKILLS[key].name).join(", ")}`, x - 8, size.height, chips.join("\n  "));
}

async function gh(path) {
  const headers = { Accept: "application/vnd.github+json", "User-Agent": "pin-card-generator" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(`https://api.github.com/${path}`, { headers });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

async function graphql(query, variables) {
  if (!process.env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN is required for the GraphQL API");
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, "User-Agent": "pin-card-generator" },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
  if (!res.ok || body.errors) throw new Error(`graphql: ${res.status} ${JSON.stringify(body.errors ?? body)}`);
  return body.data;
}

const MERGED_PRS_QUERY = `query($login: String!, $cursor: String) {
  user(login: $login) {
    pullRequests(first: 100, states: MERGED, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes { repository { nameWithOwner } }
    }
  }
}`;

async function mergedPrCountsByRepo() {
  const counts = new Map();
  let cursor = null;
  do {
    const { pullRequests } = (await graphql(MERGED_PRS_QUERY, { login: OWNER, cursor })).user;
    for (const { repository } of pullRequests.nodes) {
      const key = repository.nameWithOwner.toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    cursor = pullRequests.pageInfo.hasNextPage ? pullRequests.pageInfo.endCursor : null;
  } while (cursor);
  return counts;
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

async function avatarDataUri(owner) {
  const res = await fetch(`https://github.com/${owner}.png?size=80`);
  if (!res.ok) throw new Error(`${owner} avatar: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return `data:${res.headers.get("content-type")};base64,${buf.toString("base64")}`;
}

async function fetchContribution({ owner, repo, logo, countCommits = false, takenOver = [] }, mergedCounts) {
  const [data, landed, image] = await Promise.all([
    gh(`repos/${owner}/${repo}`),
    countCommits
      ? gh(`repos/${owner}/${repo}/commits?author=${OWNER}&per_page=100`).then((commits) => commits.length)
      : (mergedCounts.get(`${owner}/${repo}`.toLowerCase()) ?? 0),
    logo ? logoDataUri(logo) : avatarDataUri(owner),
  ]);
  return { fullName: data.full_name, stars: data.stargazers_count, prs: landed + takenOver.length, image };
}

function contributionsPanelSvg(contributions) {
  const columns = 3;
  const columnWidth = 300;
  const rowHeight = 34;
  const padX = 18;
  const padY = 18;
  const rows = Math.ceil(contributions.length / columns);
  const width = columns * columnWidth + padX * 2 - 20;
  const height = padY * 2 + rows * rowHeight - 8;
  const label = contributions.map(({ fullName, prs }) => `${fullName} (${prs} PR${prs === 1 ? "" : "s"})`).join(", ");
  const dividers = Array.from({ length: columns - 1 }, (_, i) => {
    const x = padX + (i + 1) * columnWidth - 17;
    return `<line x1="${x}" y1="${padY}" x2="${x}" y2="${height - padY}" stroke="${THEME.border}"/>`;
  });
  const cells = contributions.map(({ fullName, stars, prs, image }, i) => {
    const x = padX + Math.floor(i / rows) * columnWidth;
    const y = padY + (i % rows) * rowHeight;
    const repo = fullName.split("/")[1];
    return `<clipPath id="logo${i}"><rect x="${x}" y="${y}" width="20" height="20" rx="5"/></clipPath>
  <image href="${image}" x="${x}" y="${y}" width="20" height="20" clip-path="url(#logo${i})"/>
  <text x="${x + 30}" y="${y + 15}" font-size="14" font-weight="600" fill="${THEME.title}">${escapeXml(repo)}</text>
  <text x="${x + columnWidth - 34}" y="${y + 15}" text-anchor="end" font-size="12" fill="${THEME.body}">${prs} PR${prs === 1 ? "" : "s"} <tspan fill="${THEME.text}">· ★ ${formatCount(stars)}</tspan></text>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Contributed to ${escapeXml(label)}">
  <style>text { font-family: ${FONT}; }</style>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="12" fill="${THEME.bg}" stroke="${THEME.border}"/>
  ${dividers.join("\n  ")}
  ${cells.join("\n  ")}
</svg>
`;
}

const stackDir = fileURLToPath(new URL("./stack/", import.meta.url));
mkdirSync(stackDir, { recursive: true });
writeFileSync(`${stackDir}featured.svg`, featuredStackSvg());
console.log("Generated stack row");

const experienceDir = fileURLToPath(new URL("./experience/", import.meta.url));
mkdirSync(experienceDir, { recursive: true });
for (const job of EXPERIENCE) writeFileSync(`${experienceDir}${job.slug}.svg`, experienceCardSvg(job));
console.log(`Generated ${EXPERIENCE.length} experience cards`);

const results = await Promise.all(REPOS.map(fetchRepo));
const pinsDir = fileURLToPath(new URL("./pins/", import.meta.url));
mkdirSync(pinsDir, { recursive: true });
for (const data of results) {
  const svg = repoCardSvg(data);
  const filename = data.fullName.toLowerCase().replace("/", "-") + ".svg";
  writeFileSync(pinsDir + filename, svg);
}
console.log(`Generated ${results.length} pin cards`);

const mergedCounts = await mergedPrCountsByRepo();
const contributions = await Promise.all(CONTRIBUTIONS.map((contribution) => fetchContribution(contribution, mergedCounts)));
contributions.sort((a, b) => b.prs - a.prs || b.stars - a.stars);
const contribDir = fileURLToPath(new URL("./contrib/", import.meta.url));
rmSync(contribDir, { recursive: true, force: true });
mkdirSync(contribDir, { recursive: true });
writeFileSync(`${contribDir}panel.svg`, contributionsPanelSvg(contributions));
console.log(`Generated contributions panel with ${contributions.length} repos`);
