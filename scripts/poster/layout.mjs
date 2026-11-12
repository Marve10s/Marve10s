export const W = 846, H = 2535, MARGIN = 33, SCALE = 2;
export const DAWN = { crest: 300, sag: 34 };
export const ECLIPSE = { top: 1200, bottom: 2405, radius: 900, reach: 210, inside: 16 };

const arcRadius = (half, sag) => (half * half + sag * sag) / (2 * sag);
export const dawnRadius = arcRadius(W / 2, DAWN.sag);
export const dawnY = (x) => DAWN.crest + dawnRadius - Math.sqrt(dawnRadius * dawnRadius - (x - W / 2) ** 2);
const cap = (x) => ECLIPSE.radius - Math.sqrt(ECLIPSE.radius * ECLIPSE.radius - (x - W / 2) ** 2);
export const domeY = (x) => ECLIPSE.top + cap(x);
export const bowlY = (x) => ECLIPSE.bottom - cap(x);
