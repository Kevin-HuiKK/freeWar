import {
  ACTIONS_PER_TURN,
  CITY_DEFS,
  CITY_TYPES,
  FACTIONS,
  FACTION_IDS,
  INITIAL_ROUTES,
  STARTING_RESOURCES,
  TALENTS,
  UNIT_TYPES,
  candidateId,
} from '../data/map-data.js';

export function createNewGame(talentUpgrades = {}, profileBoosts = {}) {
  const talents = normalizeTalents(talentUpgrades);
  const boosts = normalizeProfileBoosts(profileBoosts);
  const cities = {};
  const factions = {};
  const routes = {};
  const armies = {};

  for (const fid of FACTION_IDS) {
    factions[fid] = {
      ...FACTIONS[fid],
      alive: true,
      resources: fid === 'player' ? startingResourcesWithTalents(talents, boosts) : { ...STARTING_RESOURCES },
      talents: [],
    };
  }

  for (const def of CITY_DEFS) {
    const type = CITY_TYPES[def.type];
    cities[def.id] = {
      ...def,
      owner: def.owner || null,
      level: def.level || 1,
      growth: 0,
      defense: type.defense + (def.level || 1) * 2,
      siege: false,
      isolated: false,
      garrison: startingGarrison(def),
    };
    if (def.owner === 'player') applyCityTalentBonuses(cities[def.id], talents, boosts);
  }

  for (const [from, to, owner, kind] of INITIAL_ROUTES) {
    const id = candidateId(from, to, kind);
    routes[id] = {
      id,
      from,
      to,
      owner,
      kind,
      level: 1,
      status: 'active',
      trade: true,
      military: kind === 'road',
      progress: 0,
    };
  }

  annexBonusCities(cities, routes, talents, boosts);

  for (const fid of FACTION_IDS) {
    armies[`army_${fid}_main`] = {
      id: `army_${fid}_main`,
      owner: fid,
      location: { kind: 'city', id: FACTIONS[fid].capitalId },
      units: { infantry: 4, cavalry: 1, engineer: 1, siege: 0, guard: 1, fleet: 0 },
      order: null,
    };
  }

  return {
    turn: 1,
    phase: 'player',
    actionsRemaining: actionLimit(talents),
    selected: { kind: 'city', id: FACTIONS.player.capitalId },
    hover: null,
    winner: null,
    rewardClaimed: false,
    profileRecorded: false,
    profileBoosts: boosts,
    talents,
    factions,
    cities,
    routes,
    armies,
    log: ['新战局开始：连接城市，保护贸易线，夺取敌方首都。'],
  };
}

function normalizeTalents(input = {}) {
  const out = {};
  for (const id of Object.keys(TALENTS)) {
    const level = Number(input[id] || 0);
    out[id] = Math.max(0, Math.min(TALENTS[id].max, Number.isFinite(level) ? level : 0));
  }
  return out;
}

function normalizeProfileBoosts(input = {}) {
  return {
    retrofit: Math.max(0, Number(input.retrofit || 0)),
    extraCity: Math.max(0, Number(input.extraCity || 0)),
  };
}

function startingResourcesWithTalents(talents, boosts) {
  const harbor = talents.harborWorks || 0;
  const merchants = talents.merchantGuild || 0;
  return {
    ...STARTING_RESOURCES,
    gold: STARTING_RESOURCES.gold + harbor * 28 + merchants * 20,
    food: STARTING_RESOURCES.food,
    labor: STARTING_RESOURCES.labor + harbor * 12,
  };
}

// Cities granted (with a road to their partner) by the "加一座初始城池" shop boost,
// in priority order. Each entry is [cityToAnnex, alreadyOwnedPartner].
const PLAYER_BONUS_CITIES = [
  ['c_oldport', 'c_southgate'],
  ['c_pineford', 'c_westmill'],
];

function annexBonusCities(cities, routes, talents, boosts) {
  const count = Math.min(boosts.extraCity || 0, PLAYER_BONUS_CITIES.length);
  for (let i = 0; i < count; i += 1) {
    const [cityId, partnerId] = PLAYER_BONUS_CITIES[i];
    const city = cities[cityId];
    const partner = cities[partnerId];
    if (!city || city.owner || !partner || partner.owner !== 'player') continue;
    city.owner = 'player';
    city.garrison.infantry = Math.max(1, city.garrison.infantry);
    applyCityTalentBonuses(city, talents, boosts);
    const id = candidateId(cityId, partnerId, 'road');
    routes[id] = {
      id,
      from: [cityId, partnerId].sort()[0],
      to: [cityId, partnerId].sort()[1],
      owner: 'player',
      kind: 'road',
      level: 1,
      status: 'active',
      trade: true,
      military: true,
      progress: 0,
    };
  }
}

function applyCityTalentBonuses(city, talents, boosts) {
  if (city.type === 'capital') {
    const level = talents.capitalExpansion || 0;
    city.level += level;
    city.defense += level * 4;
    city.garrison.guard += level;
    city.garrison.infantry += talents.openingInfantry || 0;
    city.garrison.cavalry += talents.openingCavalry || 0;
  }
  if (city.tags?.includes('port')) {
    city.garrison.fleet += talents.harborWorks || 0;
  }
  city.defense += talents.defenseMatrix || 0;
}

function startingGarrison(def) {
  const empty = { infantry: 0, cavalry: 0, engineer: 0, siege: 0, guard: 0, fleet: 0 };
  if (!def.owner) return empty;
  const base = def.type === 'capital' ? 4 : 1;
  return {
    ...empty,
    infantry: base,
    guard: def.type === 'capital' || def.type === 'fortress' ? 2 : 0,
    cavalry: def.type === 'barracks' ? 1 : 0,
    fleet: def.tags?.includes('port') ? 1 : 0,
  };
}

export function cityById(state, cityId) {
  return state.cities[cityId] || null;
}

export function routeById(state, routeId) {
  return state.routes[routeId] || null;
}

export function routesOfCity(state, cityId, activeOnly = true) {
  return Object.values(state.routes).filter(route => {
    if (activeOnly && route.status !== 'active') return false;
    return route.from === cityId || route.to === cityId;
  });
}

export function otherCityId(route, cityId) {
  if (route.from === cityId) return route.to;
  if (route.to === cityId) return route.from;
  return null;
}

export function ownedCities(state, factionId) {
  return Object.values(state.cities).filter(city => city.owner === factionId);
}

export function activeRoutes(state, factionId = null) {
  return Object.values(state.routes).filter(route => {
    if (route.status !== 'active') return false;
    return !factionId || route.owner === factionId;
  });
}

export function addLog(state, message) {
  state.log.push(message);
  if (state.log.length > 80) state.log = state.log.slice(-80);
}

export function resetActions(state) {
  state.actionsRemaining = actionLimit(state.talents);
}

export function consumeAction(state) {
  if ((state.actionsRemaining || 0) <= 0) return false;
  state.actionsRemaining -= 1;
  return true;
}

export function spendResources(faction, cost) {
  for (const [key, value] of Object.entries(cost)) {
    if ((faction.resources[key] || 0) < value) return false;
  }
  for (const [key, value] of Object.entries(cost)) {
    faction.resources[key] -= value;
  }
  return true;
}

export function canPay(faction, cost) {
  return Object.entries(cost).every(([key, value]) => (faction.resources[key] || 0) >= value);
}

export function totalUnits(units) {
  return Object.values(units).reduce((sum, value) => sum + (value || 0), 0);
}

export function armyPower(units, mode = 'field') {
  let total = 0;
  for (const [unitId, count] of Object.entries(units)) {
    const unit = UNIT_TYPES[unitId];
    if (!unit || !count) continue;
    total += unit.power * count;
    if (mode === 'siege') total += (unit.siege || 0) * count;
    if (mode === 'route') total += (unit.routeDamage || 0) * count;
    if (mode === 'naval') total += (unit.naval || 0) * count;
    if (mode === 'defense') total += (unit.defense || 0) * count;
  }
  return total;
}

export function transferAllUnits(from, to) {
  for (const unitId of Object.keys(from)) {
    to[unitId] = (to[unitId] || 0) + (from[unitId] || 0);
    from[unitId] = 0;
  }
}

export function resourceCities(state, factionId = null) {
  return Object.values(state.cities).filter(city => {
    const resource = city.type === 'resource' || city.tags?.includes('resource') || city.tags?.includes('trade') || city.tags?.includes('port');
    return resource && (!factionId || city.owner === factionId);
  });
}

export function actionLimit(talents = {}) {
  return ACTIONS_PER_TURN + (talents.extraAction || 0);
}
