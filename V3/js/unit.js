// unit.js — unit instance helpers
import { state, nextUid } from './state.js';

export function spawnUnit(defId, level, owner, location) {
  const def = state.unitDefById[`${defId}_${level}`];
  if (!def) throw new Error(`No unit def ${defId}_${level}`);
  const u = {
    uid: nextUid(),
    id: defId,
    level,
    owner,
    hp: def.hp,
    maxHp: def.hp,
    location,
    moved: false,
    attacked: false,
    buildTurnsLeft: 0,
  };
  state.units.push(u);
  return u;
}

export function unitsAt(territoryId) {
  return state.units.filter(u => u.location === territoryId && u.buildTurnsLeft === 0);
}

export function unitsInProduction(territoryId) {
  return state.units.filter(u => u.location === territoryId && u.buildTurnsLeft > 0);
}

export function ownerUnitsAt(territoryId, owner) {
  return state.units.filter(u => u.location === territoryId && u.owner === owner && u.buildTurnsLeft === 0);
}

export function getDef(u) { return state.unitDefById[`${u.id}_${u.level}`]; }

export function moveUnit(unit, toTerritoryId) {
  unit.location = toTerritoryId;
  unit.moved = true;
}

export function destroyUnit(uid) {
  const i = state.units.findIndex(u => u.uid === uid);
  if (i >= 0) state.units.splice(i, 1);
}

export function startBuild(defId, level, owner, territoryId) {
  const def = state.unitDefById[`${defId}_${level}`];
  const u = {
    uid: nextUid(),
    id: defId,
    level,
    owner,
    hp: def.hp,
    maxHp: def.hp,
    location: territoryId,
    moved: false,
    attacked: false,
    buildTurnsLeft: def.build,
  };
  state.units.push(u);
  return u;
}

export function tickBuilds(owner) {
  // decrement build queues for this nation, return ones that just finished
  const finished = [];
  for (const u of state.units) {
    if (u.owner === owner && u.buildTurnsLeft > 0) {
      u.buildTurnsLeft -= 1;
      if (u.buildTurnsLeft === 0) finished.push(u);
    }
  }
  return finished;
}

// Compute MOV reach (BFS through neighbors, MOV steps deep).
// Considers domain: land/sea/air. Air ignores land/sea distinction.
export function reachableTerritories(unit) {
  const def = getDef(unit);
  const start = state.territoriesById[unit.location];
  if (!start || def.mov === 0) return new Set();
  const visited = new Set([start.id]);
  let frontier = [start];
  for (let step = 0; step < def.mov; step++) {
    const next = [];
    for (const t of frontier) {
      const links = (def.domain === 'sea')
        ? [...t.seaLinks, ...neighborsThatAreCoast(t)]
        : (def.domain === 'air')
          ? [...t.neighbors, ...t.seaLinks]
          // 陆军可走 seaLinks (简化：视为隐式船只运输，每次海跳额外消耗 1 移动)
          : [...t.neighbors, ...(t.seaLinks || [])];
      for (const nid of links) {
        if (visited.has(nid)) continue;
        visited.add(nid);
        next.push(state.territoriesById[nid]);
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }
  visited.delete(start.id);
  return visited;
}

function neighborsThatAreCoast(t) {
  // sea units can sail along sea links and along coast neighbors that are also coast/sea
  return t.neighbors.filter(nid => {
    const n = state.territoriesById[nid];
    return n && (n.terrain === 'coast' || n.terrain === 'sea');
  });
}

export function nationArmyStrength(owner) {
  let total = 0;
  for (const u of state.units) {
    if (u.owner !== owner || u.buildTurnsLeft > 0) continue;
    const d = getDef(u);
    total += d.atk + d.hp * 0.3 + d.def * 0.5;
  }
  return Math.round(total);
}
