/**
 * Waypoint-following pathing for v2.0.
 * Units walk from their start (flag) along a predefined path to the opponent flag.
 * Ally units walk path[0] → path[N-1].
 * Enemy units walk path[N-1] → path[0] (reversed).
 */

export function buildPath(path, owner) {
  return owner === 'enemy' ? [...path].reverse() : [...path];
}

/**
 * Advance a unit along its waypoint list.
 * Returns 'walking' | 'reached'.
 * Mutates unit.x, unit.y, unit.waypointIdx, unit.facing.
 */
export function advanceAlongPath(unit, dt) {
  if (unit.waypointIdx >= unit.path.length - 1) return 'reached';
  const [tx, ty] = unit.path[unit.waypointIdx + 1];
  const dx = tx - unit.x;
  const dy = ty - unit.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.001) {
    unit.waypointIdx += 1;
    return unit.waypointIdx >= unit.path.length - 1 ? 'reached' : 'walking';
  }
  unit.facing = Math.atan2(dy, dx);
  const step = unit.speed * dt;
  if (step >= dist) {
    unit.x = tx;
    unit.y = ty;
    unit.waypointIdx += 1;
    if (unit.waypointIdx >= unit.path.length - 1) return 'reached';
  } else {
    unit.x += (dx / dist) * step;
    unit.y += (dy / dist) * step;
  }
  return 'walking';
}
