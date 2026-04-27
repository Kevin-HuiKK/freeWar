// diplomacy.js — relation management + UI hook
import { state, declareWar, makePeace, isAtWar } from './state.js';
import { logEvent } from './hud.js';

export function relation(a, b) {
  return state.diplomacy[a]?.[b] ?? 50;
}

export function adjustRelation(a, b, delta) {
  if (!state.diplomacy[a]) state.diplomacy[a] = {};
  if (!state.diplomacy[b]) state.diplomacy[b] = {};
  state.diplomacy[a][b] = clamp((state.diplomacy[a][b] ?? 50) + delta);
  state.diplomacy[b][a] = clamp((state.diplomacy[b][a] ?? 50) + delta);
}

function clamp(x) { return Math.max(0, Math.min(100, x)); }

export function diploActionDeclareWar(initiator, target) {
  declareWar(initiator, target);
  if (initiator === state.player) {
    logEvent('war', '⚔', `我方向${state.nations[target].name}宣战！`);
  } else if (target === state.player) {
    logEvent('war', '⚔', `${state.nations[initiator].name}向我方宣战！`);
  }
}

export function diploActionPeace(a, b) {
  if (!isAtWar(a, b)) return false;
  // peace requires both willing — if AI low on stability/army, accept
  makePeace(a, b);
  if (a === state.player || b === state.player) {
    const other = a === state.player ? b : a;
    logEvent('diplo', '🕊', `与${state.nations[other].name}缔结和平`);
  }
  return true;
}

export function diploActionGift(a, b, amount) {
  const an = state.nations[a]; const bn = state.nations[b];
  if (an.gold < amount) return false;
  an.gold -= amount;
  bn.gold += amount;
  adjustRelation(a, b, Math.min(20, Math.floor(amount / 20)));
  if (a === state.player) logEvent('diplo', '💰', `送礼 ${amount} 金币给${bn.name}`);
  return true;
}

// AI diplomacy tick: every few turns reassess
export function aiDiploTick(aiId) {
  const me = state.nations[aiId];
  for (const otherId of Object.keys(state.nations)) {
    if (otherId === aiId) continue;
    const other = state.nations[otherId];
    if (other.defeated) continue;
    const rel = relation(aiId, otherId);
    // If at war and we're losing badly, sue for peace
    if (isAtWar(aiId, otherId)) {
      const myArmy = nationStrength(aiId);
      const enemyArmy = nationStrength(otherId);
      if (myArmy < enemyArmy * 0.5 && me.stability < 50) {
        makePeace(aiId, otherId);
        if (otherId === state.player) logEvent('diplo', '🕊', `${me.name}向我方求和`);
      }
      continue;
    }
    // If aggressive AI + neighbor + we're stronger -> declare war
    if (me.aggression && me.aggression > 0.6 && rel < 35) {
      const myArmy = nationStrength(aiId);
      const enemyArmy = nationStrength(otherId);
      if (myArmy > enemyArmy * 1.3 && Math.random() < 0.3) {
        declareWar(aiId, otherId);
        if (otherId === state.player) logEvent('war', '⚔', `${me.name}向我方宣战！`);
        else if (state.player !== aiId) logEvent('war', '⚔', `${me.name}向${other.name}宣战`);
      }
    }
    // Friendly drift toward neutral over time
    if (rel > 50) adjustRelation(aiId, otherId, -1);
  }
}

function nationStrength(id) {
  let s = 0;
  for (const u of state.units) {
    if (u.owner !== id || u.buildTurnsLeft > 0) continue;
    const d = state.unitDefById[`${u.id}_${u.level}`];
    s += d.atk + d.hp * 0.3 + d.def * 0.5;
  }
  return s;
}
