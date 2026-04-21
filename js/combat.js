export function pickTarget(unit, enemies) {
  const tile = unit.tile ?? 1;
  const maxDist = unit.range * tile;
  let best = null;
  let bestDist = Infinity;
  for (const e of enemies) {
    if (e.hp <= 0) continue;
    const dx = e.x - unit.x;
    const dy = e.y - unit.y;
    const d = Math.hypot(dx, dy);
    if (d > maxDist) continue;
    if (d < bestDist) {
      bestDist = d;
      best = e;
    }
  }
  return best;
}

export function applyDamage(enemy, dmg) {
  enemy.hp = Math.max(0, enemy.hp - dmg);
  return { killed: enemy.hp <= 0 };
}
