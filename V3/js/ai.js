// ai.js — greedy per-nation AI with animated turn (so player sees attacks happen)
import { state, isAtWar } from './state.js';
import { reachableTerritories, moveUnit, startBuild, getDef } from './unit.js';
import { canFight } from './combat.js';
import { aiPickTech, isUnitUnlocked } from './tech.js';
import { aiPickSkill } from './skill.js';
import { aiDiploTick } from './diplomacy.js';
import { resolveTerritoryConflict, occupyTerritory } from './turn.js';
import { draw as drawMap, setHighlight, spawnMoveArrow, focusTerritory } from './map.js';
import { setHint, refreshAll, setAITurnBanner } from './hud.js';

// Pacing constants — slow enough that player can read what's happening
const STEP_MS = 800;             // base pause between idle AI actions
const ATTACK_PRE_MS = 1100;      // delay before AI attacks (showing arrow + warning)
const ATTACK_POST_MS = 1700;     // delay after AI attack hits player (let FX play)
const sleep = ms => new Promise(r => setTimeout(r, Math.max(50, ms / (window.__v3_speed || 1))));

export async function runAITurn(aiId) {
  if (state.nations[aiId].defeated) return;
  aiPickTech(aiId);
  if (state.turn % 2 === 0) aiPickSkill(aiId);
  if (state.turn % 5 === 0) aiDiploTick(aiId);
  aiBuild(aiId);
  await aiMove(aiId);
}

function aiBuild(aiId) {
  const n = state.nations[aiId];
  const myCities = state.territories.filter(t => t.owner === aiId);
  if (myCities.length === 0) return;

  const atWar = [...state.wars].some(w => w.split(':').includes(aiId));
  const opts = state.unitDefs.filter(d => isUnitUnlocked(aiId, d) && !d.spawnOnly);
  const wantTypes = atWar
    ? ['armor', 'infantry', 'air', 'navy']
    : ['infantry', 'infantry', 'navy'];
  for (const cat of wantTypes) {
    const candidates = opts.filter(d => d.category === cat && d.gold <= n.gold && d.food <= n.food && d.oil <= n.oil);
    if (candidates.length === 0) continue;
    candidates.sort((a, b) => a.gold - b.gold);
    const pick = candidates[Math.floor(Math.random() * Math.min(3, candidates.length))];
    const where = state.territoriesById[n.capital]?.owner === aiId
      ? n.capital
      : myCities[0].id;
    if (!canBuildHere(pick, state.territoriesById[where])) continue;
    n.gold -= pick.gold;
    n.food -= pick.food;
    n.oil  = Math.max(0, n.oil - pick.oil);
    startBuild(pick.id, pick.level, aiId, where);
    if (Math.random() < 0.4) break;
  }
}

function canBuildHere(def, terr) {
  if (!terr) return false;
  if (def.domain === 'sea') return terr.terrain === 'coast' || terr.terrain === 'sea';
  if (def.domain === 'air') return terr.isCapital;
  return true;
}

async function aiMove(aiId) {
  const n = state.nations[aiId];
  const myUnits = state.units.filter(u => u.owner === aiId && u.buildTurnsLeft === 0 && !u.moved);
  const enemyCaps = Object.values(state.nations)
    .filter(x => x.id !== aiId && !x.defeated && isAtWar(aiId, x.id))
    .map(x => x.capital);

  for (const u of myUnits) {
    const def = getDef(u);
    if (def.mov === 0) continue;
    const reach = reachableTerritories(u);
    if (reach.size === 0) continue;
    let best = null; let bestScore = -Infinity;
    for (const tid of reach) {
      const t = state.territoriesById[tid];
      const garrison = state.units.filter(x => x.location === tid && x.owner !== aiId && x.buildTurnsLeft === 0);
      let score = 0;
      if (t.owner !== aiId && (isAtWar(aiId, t.owner) || !state.nations[t.owner])) {
        score += 30;
        if (t.isCapital) score += 50;
        // bonus for attacking the human player (so AI is more aggressive vs player)
        if (t.owner === state.player) score += 15;
        score -= garrison.length * 10;
      }
      if (enemyCaps.length) {
        const ec = state.territoriesById[enemyCaps[0]];
        if (ec) {
          const me = state.territoriesById[u.location];
          const dCur = dist(me.center, ec.center);
          const dNew = dist(t.center, ec.center);
          score += (dCur - dNew) * 0.05;
        }
      }
      score += Math.random() * 5;
      if (score > bestScore) { bestScore = score; best = tid; }
    }
    if (!best || bestScore <= -10) continue;

    const target = state.territoriesById[best];
    const hostile = state.units.filter(x => x.location === best && canFight(aiId, x.owner) && x.buildTurnsLeft === 0);
    const willHitPlayer = (hostile.some(x => x.owner === state.player)) || (target.owner === state.player);

    // If AI is hitting the player, give a clear visual cue first
    if (willHitPlayer) {
      setHint(`⚠ ${n.name} is moving on ${target.name}!`, true);
      setHighlight({ [best]: 'attack' });
      // animated arrow from source to target (in attacker color)
      spawnMoveArrow(u.location, best, n.color, 1100);
      focusTerritory(best);
      drawMap();
      await sleep(ATTACK_PRE_MS);
    } else {
      // Even neutral moves show a brief arrow so player understands AI is acting
      spawnMoveArrow(u.location, best, n.color, 700);
      await sleep(STEP_MS * 0.5);
    }

    if (hostile.length > 0) {
      moveUnit(u, best);
      resolveTerritoryConflict(best, aiId);
      drawMap();
      await sleep(willHitPlayer ? ATTACK_POST_MS : STEP_MS);
    } else if (target.owner !== aiId && (isAtWar(aiId, target.owner) || target.owner == null)) {
      moveUnit(u, best);
      occupyTerritory(target, aiId);
      drawMap();
      if (willHitPlayer) await sleep(ATTACK_POST_MS * 0.7);
      else await sleep(STEP_MS * 0.5);
    } else {
      moveUnit(u, best);
      drawMap();
      await sleep(STEP_MS * 0.4);
    }

    if (willHitPlayer) {
      setHighlight([]);
      refreshAll();
    }
  }
}

function dist(a, b) { return Math.hypot(a[0]-b[0], a[1]-b[1]); }
