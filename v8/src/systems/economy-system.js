import { CITY_TYPES } from '../data/map-data.js';
import { activeRoutes, addLog, cityById, ownedCities } from '../core/game-state.js';
import { connectedToCapital } from './route-system.js';

export function calculateIncome(state, factionId) {
  const income = { gold: 0, food: 0, labor: 0, influence: 0 };
  for (const city of ownedCities(state, factionId)) {
    const type = CITY_TYPES[city.type];
    const connected = connectedToCapital(state, factionId, city.id);
    const isolationMul = connected ? 1 : 0.45;
    income.gold += Math.round((type.tax + city.level * 4) * isolationMul);
    income.food += Math.round((4 + city.level * 2) * isolationMul);
    income.labor += Math.round((3 + city.level * 2 + (city.tags.includes('barracks') ? 2 : 0)) * isolationMul);
    income.influence += connected ? Math.max(1, Math.floor(city.level / 2)) : 0;
  }
  for (const route of activeRoutes(state, factionId)) {
    if (!route.trade) continue;
    const a = cityById(state, route.from);
    const b = cityById(state, route.to);
    if (!a || !b || a.owner !== factionId || b.owner !== factionId) continue;
    const tradeBonus = (a.tags.includes('trade') ? 4 : 0) + (b.tags.includes('trade') ? 4 : 0);
    const seaBonus = route.kind === 'sea' ? 8 : 0;
    income.gold += 6 + route.level * 5 + tradeBonus + seaBonus;
    income.influence += route.kind === 'sea' && route.level >= 2 ? 1 : 0;
  }
  return income;
}

export function applyIncome(state, factionId) {
  const income = calculateIncome(state, factionId);
  const faction = state.factions[factionId];
  for (const [key, value] of Object.entries(income)) {
    faction.resources[key] += value;
  }
  return income;
}

export function applyAllIncome(state) {
  for (const faction of Object.values(state.factions)) {
    if (!faction.alive) continue;
    const income = applyIncome(state, faction.id);
    if (faction.id === 'player') {
      addLog(state, `回合收入：金${income.gold} 粮${income.food} 工${income.labor} 势${income.influence}`);
    }
  }
}
