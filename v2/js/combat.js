/**
 * Pick the closest hostile target in range.
 * `candidates` = anything with x, y, hp, team.
 * `self` must have x, y, range, team.
 */
export function pickTarget(self, candidates) {
  let best = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    if (c.team === self.team) continue;
    if (c.hp <= 0) continue;
    const d = Math.hypot(c.x - self.x, c.y - self.y);
    if (d > self.range) continue;
    if (d < bestDist) {
      best = c;
      bestDist = d;
    }
  }
  return best;
}

export function applyDamage(entity, dmg) {
  entity.hp = Math.max(0, entity.hp - dmg);
  return { killed: entity.hp <= 0 };
}

/**
 * Area-of-effect damage centered on a point.
 * Returns list of killed entities.
 */
export function applyAoeDamage(cx, cy, radius, dmg, candidates, attackerTeam) {
  const killed = [];
  for (const c of candidates) {
    if (c.team === attackerTeam) continue;
    if (c.hp <= 0) continue;
    const d = Math.hypot(c.x - cx, c.y - cy);
    if (d <= radius) {
      c.hp = Math.max(0, c.hp - dmg);
      if (c.hp <= 0) killed.push(c);
    }
  }
  return killed;
}
