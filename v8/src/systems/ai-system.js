import { FACTION_IDS, UNIT_TYPES } from '../data/map-data.js';
import { armyPower, cityById, ownedCities } from '../core/game-state.js';
import { attackCity, canTrainUnit, forecastAttack, moveArmy, trainUnit } from './combat-system.js';
import { buildRoute, canBuildRoute, canUpgradeRoute, routeCandidatesFrom, upgradeRoute } from './route-system.js';

// Strongest affordable offense first, so richer factions field tanks/rockets
// while poorer ones still build infantry — natural catch-up pressure.
const OFFENSE_PRIORITY = ['tank', 'rocket', 'siege', 'apc', 'cavalry', 'charger', 'infantry'];
const MAX_ATTACKS_PER_TURN = 2;
const MAX_TRAINS_PER_TURN = 5;

export function playAITurn(state, factionId) {
  const faction = state.factions[factionId];
  if (!faction?.alive) return;
  const cities = ownedCities(state, factionId);
  if (!cities.length) return;

  const plan = bestAttackPlan(state, factionId, cities);
  // Mass the army where it can actually strike, and pull reserves forward.
  if (plan) reinforceFront(state, factionId, plan.from);
  trainArmies(state, factionId, cities, plan);
  let acted = aiAttack(state, factionId, cities);
  if (!acted) acted = tryExpand(state, factionId, cities);
  if (!acted) tryUpgradeRoute(state, factionId);
}

// Best (from, target) opportunity by forecast: prefer captures, then soft, hurt targets.
function bestAttackPlan(state, factionId, cities) {
  let best = null;
  for (const city of cities) {
    for (const target of enemyNeighbors(state, factionId, city)) {
      const forecast = forecastAttack(state, factionId, city.id, target.id);
      if (!forecast) continue;
      const score = (forecast.willCapture ? 1000 : 0) + forecast.damage - target.defense;
      if (!best || score > best.score) best = { from: city.id, to: target.id, score };
    }
  }
  return best;
}

// Pour units from connected interior cities into the frontline attack city.
function reinforceFront(state, factionId, frontCityId) {
  for (const route of Object.values(state.routes)) {
    if (route.status !== 'active' || route.owner !== factionId) continue;
    const other = route.from === frontCityId ? route.to : route.to === frontCityId ? route.from : null;
    if (!other) continue;
    const src = cityById(state, other);
    if (!src || src.owner !== factionId) continue;
    if (enemyNeighbors(state, factionId, src).length > 0) continue; // keep frontline cities armed
    if (armyPower(src.garrison, 'attack') > 0) moveArmy(state, factionId, src.id, frontCityId);
  }
}

function enemyNeighbors(state, factionId, city) {
  const out = [];
  for (const option of routeCandidatesFrom(state, city.id)) {
    const target = cityById(state, option.other);
    if (target && target.owner && target.owner !== factionId) out.push(target);
  }
  return out;
}

function frontierCities(state, factionId, cities) {
  return cities.filter(city => enemyNeighbors(state, factionId, city).length > 0);
}

function productionCity(state, factionId, cities) {
  const front = frontierCities(state, factionId, cities)
    .filter(city => city.tags.includes('barracks') || city.type === 'capital');
  return front[0]
    || cities.find(city => city.type === 'capital')
    || cities.find(city => city.tags.includes('barracks'))
    || cities[0];
}

// Keep gold in reserve so the AI can still afford roads/expansion; only mass an
// army once it is actually in contact with an enemy. Pre-contact factions spend
// on expansion and grow toward each other.
const GOLD_RESERVE = 50;

function trainArmies(state, factionId, cities, plan) {
  const res = state.factions[factionId].resources;
  const front = frontierCities(state, factionId, cities);
  let trains = 0;
  // Shore up the defense of exposed frontier cities first.
  for (const city of front) {
    if (trains >= 2 || res.gold <= GOLD_RESERVE) break;
    if (armyPower(city.garrison, 'defense') < 4 && trainUnit(state, factionId, city.id, 'guard').ok) trains += 1;
  }
  // Build offense AT the attack city so the stack can actually strike next turn.
  // Spend hoarded gold faster when rich.
  const maxOffense = front.length ? (res.gold > 300 ? 9 : MAX_TRAINS_PER_TURN) : 0;
  const buildCity = plan ? cityById(state, plan.from) : productionCity(state, factionId, cities);
  while (trains < maxOffense && res.gold > GOLD_RESERVE) {
    const unit = OFFENSE_PRIORITY.find(id => canTrainUnit(state, factionId, buildCity.id, id).ok
      && res.gold - (UNIT_TYPES[id].cost.gold || 0) >= GOLD_RESERVE);
    if (!unit || !trainUnit(state, factionId, buildCity.id, unit).ok) break;
    trains += 1;
  }
}

function factionPower(state, factionId) {
  const cities = ownedCities(state, factionId);
  return cities.length * 10 + cities.reduce((sum, city) => sum + city.level + armyPower(city.garrison, 'attack'), 0);
}

function leadingFaction(state) {
  let best = null;
  let bestPower = -1;
  for (const fid of FACTION_IDS) {
    if (!state.factions[fid]?.alive) continue;
    const power = factionPower(state, fid);
    if (power > bestPower) {
      bestPower = power;
      best = fid;
    }
  }
  return best;
}

function aiAttack(state, factionId, cities) {
  const leader = leadingFaction(state);
  const options = [];
  for (const city of cities) {
    for (const target of enemyNeighbors(state, factionId, city)) {
      const forecast = forecastAttack(state, factionId, city.id, target.id);
      if (!forecast || forecast.damage <= 0) continue; // never attack into a wall
      let score = forecast.damage;
      if (forecast.willCapture) score += 50;
      if (target.type === 'capital') score += 30;
      if (target.owner === leader && leader !== factionId) score += 25; // gang up on the leader
      score -= target.defense; // prefer soft targets
      options.push({ from: city.id, to: target.id, score });
    }
  }
  options.sort((a, b) => b.score - a.score);
  let attacks = 0;
  let acted = false;
  for (const option of options) {
    if (attacks >= MAX_ATTACKS_PER_TURN) break;
    const result = attackCity(state, factionId, option.from, option.to);
    if (result.ok) {
      acted = true;
      attacks += 1;
    }
  }
  return acted;
}

function tryExpand(state, factionId, cities) {
  const candidates = [];
  for (const city of cities) {
    for (const option of routeCandidatesFrom(state, city.id)) {
      const target = cityById(state, option.other);
      if (!target || target.owner) continue;
      if (canBuildRoute(state, factionId, city.id, target.id).ok) {
        candidates.push({ from: city.id, to: target.id, score: target.level * 10 - option.distance / 50 });
      }
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const pick = candidates[0];
  return pick ? buildRoute(state, factionId, pick.from, pick.to).ok : false;
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
  return false;
}
