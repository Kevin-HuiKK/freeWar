import { ALL_ROUTE_CANDIDATES, candidateId } from '../data/map-data.js';
import { addLog, cityById, ownedCities } from '../core/game-state.js';
import { attackCity, raidRoute, trainUnit } from './combat-system.js';
import { buildRoute, canBuildRoute, canUpgradeRoute, routeCandidatesFrom, upgradeRoute } from './route-system.js';

export function playAITurn(state, factionId) {
  const faction = state.factions[factionId];
  if (!faction?.alive) return;
  const cities = ownedCities(state, factionId);
  if (!cities.length) return;

  trainIfPossible(state, factionId, cities);
  if (tryAttackWeakNeighbor(state, factionId, cities)) return;
  if (tryCutPlayerRoute(state, factionId, cities)) return;
  if (tryExpand(state, factionId, cities)) return;
  tryUpgradeRoute(state, factionId);
}

function trainIfPossible(state, factionId, cities) {
  const city = cities.find(c => c.tags.includes('barracks') || c.type === 'capital') || cities[0];
  const unit = city.tags.includes('port') ? 'fleet' : (city.tags.includes('barracks') ? 'cavalry' : 'infantry');
  trainUnit(state, factionId, city.id, unit);
}

function tryAttackWeakNeighbor(state, factionId, cities) {
  for (const city of cities) {
    const options = routeCandidatesFrom(state, city.id);
    for (const option of options) {
      const target = cityById(state, option.other);
      if (!target || target.owner === factionId || !target.owner) continue;
      if (target.level <= city.level || target.owner === 'player') {
        const result = attackCity(state, factionId, city.id, target.id);
        if (result.ok) return true;
      }
    }
  }
  return false;
}

function tryCutPlayerRoute(state, factionId, cities) {
  for (const route of Object.values(state.routes)) {
    if (route.owner !== 'player' || route.status !== 'active') continue;
    const near = cities.some(city => routeCandidatesFrom(state, city.id).some(option => option.other === route.from || option.other === route.to));
    if (!near) continue;
    const result = raidRoute(state, factionId, route.id);
    if (result.ok) return true;
  }
  return false;
}

function tryExpand(state, factionId, cities) {
  const candidates = [];
  for (const city of cities) {
    for (const option of routeCandidatesFrom(state, city.id)) {
      const target = cityById(state, option.other);
      if (!target || target.owner) continue;
      const check = canBuildRoute(state, factionId, city.id, target.id);
      if (check.ok) candidates.push({ from: city.id, to: target.id, score: target.level * 10 - option.distance / 50 });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const pick = candidates[0];
  if (!pick) return false;
  return buildRoute(state, factionId, pick.from, pick.to).ok;
}

function tryUpgradeRoute(state, factionId) {
  const owned = Object.values(state.routes)
    .filter(route => route.owner === factionId && route.status === 'active')
    .sort((a, b) => b.level - a.level);
  for (const route of owned) {
    if (canUpgradeRoute(state, factionId, route.id).ok) {
      upgradeRoute(state, factionId, route.id);
      return true;
    }
  }
  addLog(state, `${state.factions[factionId].shortName} 暂无可执行扩张。`);
  return false;
}
