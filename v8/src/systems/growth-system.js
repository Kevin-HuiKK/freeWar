import { CITY_TYPES } from '../data/map-data.js';
import { activeRoutes, addLog, cityById, otherCityId, ownedCities, routesOfCity } from '../core/game-state.js';
import { connectedToCapital } from './route-system.js';

export function calculateCityGrowth(state, cityId) {
  const city = cityById(state, cityId);
  if (!city || !city.owner) return 0;
  const type = CITY_TYPES[city.type];
  let growth = type.growth + city.level;
  const routes = routesOfCity(state, cityId).filter(route => route.owner === city.owner);
  for (const route of routes) {
    const other = cityById(state, otherCityId(route, cityId));
    if (!other || other.owner !== city.owner) continue;
    if (other.level > city.level) growth += (other.level - city.level) * 5;
    if (route.trade) growth += 2 + route.level;
    if (other.type === 'capital') growth += 3;
  }
  if (!connectedToCapital(state, city.owner, city.id)) growth = Math.floor(growth * 0.4);
  if (city.siege) growth = -8;
  return growth;
}

export function applyCityGrowth(state) {
  for (const city of Object.values(state.cities)) {
    city.isolated = false;
    city.siege = false;
    if (!city.owner) continue;
    const ownedConnections = routesOfCity(state, city.id).filter(route => route.owner === city.owner);
    city.isolated = city.type !== 'capital' && ownedConnections.length === 0;
    const enemyRoutes = activeRoutes(state).filter(route => {
      if (route.owner === city.owner) return false;
      return route.from === city.id || route.to === city.id;
    });
    city.siege = city.isolated && enemyRoutes.length > 0;
  }

  for (const city of Object.values(state.cities)) {
    if (!city.owner) continue;
    city.growth += calculateCityGrowth(state, city.id);
    if (city.growth < 0) city.growth = 0;
    const threshold = growthThreshold(city.level);
    if (city.level < 5 && city.growth >= threshold) {
      city.growth -= threshold;
      city.level += 1;
      city.defense += 3;
      city.maxHp += 2;
      city.hp = Math.min(city.maxHp, city.hp + 2);
      city.garrison.guard += 1;
      addLog(state, `${city.name} 升级为 Lv.${city.level}`);
    }
  }
}

export function calculateInfluenceRadius(city) {
  return 38 + city.level * 28 + (city.type === 'capital' ? 18 : 0) + (city.type === 'fortress' ? 10 : 0);
}

export function factionNetworkStrength(state, factionId) {
  const cities = ownedCities(state, factionId);
  const routes = activeRoutes(state, factionId);
  return cities.reduce((sum, city) => sum + city.level, 0) + routes.reduce((sum, route) => sum + route.level, 0);
}

function growthThreshold(level) {
  return 28 + level * 24;
}
