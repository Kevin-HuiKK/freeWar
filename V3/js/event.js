// event.js — random events drawn at end of turn
import { state } from './state.js';
import { logEvent } from './hud.js';
import { startBuild } from './unit.js';

export function drawEvent() {
  // 60% chance per turn there's an event
  if (Math.random() > 0.6) return;
  const total = state.eventDefs.reduce((s, e) => s + e.weight, 0);
  let r = Math.random() * total;
  for (const e of state.eventDefs) {
    r -= e.weight;
    if (r <= 0) { applyEvent(e); return; }
  }
}

function applyEvent(e) {
  const targetId = e.target === 'self'
    ? state.player
    : pickRandomLivingNation();
  const n = state.nations[targetId];
  if (!n) return;

  const eff = e.effect || {};
  if (eff.gold) n.gold = Math.max(0, n.gold + eff.gold);
  if (eff.food) n.food = Math.max(0, n.food + eff.food);
  if (eff.oil)  n.oil  = Math.max(0, n.oil + eff.oil);
  if (eff.tech) n.tech = Math.max(0, n.tech + eff.tech);
  if (eff.stability) n.stability = Math.max(0, Math.min(100, n.stability + eff.stability));

  if (e.spawnUnit && targetId === state.player) {
    const u = startBuild(e.spawnUnit, 1, state.player, n.capital);
    u.buildTurnsLeft = 0;
  }
  if (e.spawnRebels) {
    // spawn rebels in a random territory of the unstable nation
    const candidates = state.territories.filter(t => t.owner === targetId);
    if (candidates.length) {
      const tt = candidates[Math.floor(Math.random() * candidates.length)];
      // rebels are a "neutral hostile" (use targetId so they hold the territory but lower stability)
      // simpler: spawn as 'rebels' faction = same nation but with stability hit, and units left lower morale
      // We'll just do stability already -15 above; skip actual rebel spawn for MVP
    }
  }

  const title = e.desc.replace('{nation}', n.name);
  if (targetId === state.player) {
    logEvent('event', e.icon, title.startsWith(n.name) ? title.replace(n.name, '我方') : title);
  } else {
    logEvent('event', e.icon, title);
  }
}

function pickRandomLivingNation() {
  const alive = Object.keys(state.nations).filter(id => !state.nations[id].defeated);
  return alive[Math.floor(Math.random() * alive.length)];
}
