import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [source] = process.argv.slice(2);
if (!source) throw new Error('Usage: node scripts/sync_ai_stats.mjs <path to the portfolio ai-stats.json>');

const stats = JSON.parse(fs.readFileSync(source, 'utf8'));
const agentTotals = new Map();
for (const day of stats.ai.days) {
  for (const [agent, tokens] of Object.entries(day.agentTokens ?? {})) agentTotals.set(agent, (agentTotals.get(agent) ?? 0) + tokens);
}

const snapshot = {
  generatedAt: stats.generatedAt,
  period: { from: stats.period.from, through: stats.period.through, days: stats.period.days },
  totalTokens: stats.totals.tokens,
  agentCount: stats.totals.agentCount,
  topAgents: [...agentTotals].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([agent]) => agent),
  activeDays: stats.ai.activeDays,
  last7Days: stats.recent.last7Days,
  last30Days: stats.recent.last30Days,
  days: stats.ai.days.map(({ date, value, inferredFromGitHub }) => ({ date, value, inferred: Boolean(inferredFromGitHub) })),
};

const target = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'profile', 'ai-stats.json');
fs.writeFileSync(target, `${JSON.stringify(snapshot)}\n`);
console.log(`Saved ${snapshot.days.length} days through ${snapshot.period.through}`);
