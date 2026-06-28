import { BUILDINGS, FACTION_IDS, UNIT_TYPES, VICTORY_RULES, candidateId } from '../data/map-data.js';
import {
  addLog,
  armyPower,
  canPay,
  cityById,
  routeById,
  spendResources,
  totalUnits,
} from '../core/game-state.js';
import { candidateBetween, cutRoute } from './route-system.js';

function meetsReq(city, req) {
  if (!req) return true;
  if (req === 'port') return city.tags.includes('port');
  if (req === 'barracks') return city.tags.includes('barracks') || city.type === 'capital';
  if (req === 'capital') return city.type === 'capital';
  return true;
}

const REQ_LABEL = { port: '港口', barracks: '军营或首都', capital: '首都' };

export function trainUnit(state, factionId, cityId, unitId) {
  const check = canTrainUnit(state, factionId, cityId, unitId);
  if (!check.ok) return check;
  const city = cityById(state, cityId);
  const unit = UNIT_TYPES[unitId];
  spendResources(state.factions[factionId], unit.cost);
  city.garrison[unitId] += 1;
  if (unit.oncePerGame) state.factions[factionId].builtOnce[unitId] = true;
  addLog(state, `${state.factions[factionId].shortName} 在 ${city.name} 训练 ${unit.name}`);
  return { ok: true, msg: '训练完成' };
}

export function canTrainUnit(state, factionId, cityId, unitId) {
  const city = cityById(state, cityId);
  const unit = UNIT_TYPES[unitId];
  if (!city || city.owner !== factionId) return { ok: false, msg: '只能在己方城市训练' };
  if (!unit) return { ok: false, msg: '兵种不存在' };
  if (city.building === 'nuclear') return { ok: false, msg: '核电站城市无法训练单位' };
  if (!meetsReq(city, unit.req)) return { ok: false, msg: `${unit.name}需要${REQ_LABEL[unit.req]}` };
  if (unit.oncePerGame && state.factions[factionId].builtOnce[unitId]) return { ok: false, msg: `${unit.name}每局只能建造一次` };
  if (!canPay(state.factions[factionId], unit.cost)) return { ok: false, msg: '资源不足' };
  return { ok: true, msg: '' };
}

export function canBuildBuilding(state, factionId, cityId, buildingId) {
  const city = cityById(state, cityId);
  const building = BUILDINGS[buildingId];
  if (!city || city.owner !== factionId) return { ok: false, msg: '只能在己方城市建造' };
  if (!building) return { ok: false, msg: '建筑不存在' };
  if (city.building) return { ok: false, msg: '该城已有特殊建筑' };
  if (!canPay(state.factions[factionId], building.cost)) return { ok: false, msg: '资源不足' };
  return { ok: true, msg: '' };
}

export function buildBuilding(state, factionId, cityId, buildingId) {
  const check = canBuildBuilding(state, factionId, cityId, buildingId);
  if (!check.ok) return check;
  const city = cityById(state, cityId);
  const building = BUILDINGS[buildingId];
  spendResources(state.factions[factionId], building.cost);
  city.building = buildingId;
  addLog(state, `${state.factions[factionId].shortName} 在 ${city.name} 建造 ${building.name}`);
  return { ok: true, msg: '建造完成' };
}

export function moveArmy(state, factionId, fromCityId, toCityId) {
  const from = cityById(state, fromCityId);
  const to = cityById(state, toCityId);
  if (!from || !to || from.owner !== factionId || to.owner !== factionId) return { ok: false, msg: '只能在己方城市间调兵' };
  const route = Object.values(state.routes).find(r => {
    if (r.status !== 'active' || r.owner !== factionId) return false;
    return (r.from === fromCityId && r.to === toCityId) || (r.from === toCityId && r.to === fromCityId);
  });
  if (!route) return { ok: false, msg: '两城之间没有己方连接' };
  const transferRate = factionId === 'player' && state.talents?.doubleLanes ? 0.75 : 0.5;
  for (const unitId of Object.keys(from.garrison)) {
    const moving = Math.floor(from.garrison[unitId] * transferRate);
    from.garrison[unitId] -= moving;
    to.garrison[unitId] += moving;
  }
  addLog(state, `${state.factions[factionId].shortName} 从 ${from.name} 调兵至 ${to.name}`);
  return { ok: true, msg: '部队已移动' };
}

// V1.0 combat: 1 防守 blocks 2 攻击, 攻城 ignores blocking, remaining damage hits
// 城市血量 (1:1). Blood to 0 -> captured. Strategic weapons, AAA interception,
// bomber+nuke combo and 喷火兵 burning all feed this single formula.
export function attackCity(state, factionId, fromCityId, targetCityId) {
  const from = cityById(state, fromCityId);
  const target = cityById(state, targetCityId);
  const faction = state.factions[factionId];
  if (!from || !target || from.owner !== factionId) return { ok: false, msg: '需要选择己方出发城市' };
  if (target.owner === factionId) return { ok: false, msg: '目标已经属于你' };

  const activeRoute = Object.values(state.routes).find(r => {
    if (r.status !== 'active') return false;
    return (r.from === fromCityId && r.to === targetCityId) || (r.from === targetCityId && r.to === fromCityId);
  });
  const candidate = activeRoute ? null : candidateBetween(fromCityId, targetCityId);
  if (!activeRoute && !candidate) return { ok: false, msg: '必须与相邻城市进攻（两城之间没有可用路线）' };
  const attackKind = activeRoute ? activeRoute.kind : candidate.kind;
  if (attackKind === 'sea' && (from.garrison.fleet || 0) <= 0) return { ok: false, msg: '跨海进攻需要舰队' };

  const attack = effectiveAttack(state, factionId, from.garrison, target.garrison);
  if (attack <= 0) return { ok: false, msg: '出发城市没有攻击单位' };

  const siegePen = armyPower(from.garrison, 'siege');
  const defenseValue = target.defense + armyPower(target.garrison, 'defense');
  const blocked = Math.max(0, defenseValue * 2 - siegePen);
  const damage = Math.round(attack - blocked);

  // 喷火兵：命中即点燃，未攻陷也持续掉血
  const flamers = from.garrison.flamer || 0;

  if (damage <= 0) {
    applyLosses(from.garrison, 0.5);
    applyLosses(target.garrison, 0.1);
    if (flamers > 0) igniteCity(state, target);
    addLog(state, `${faction.shortName} 进攻 ${target.name} 被防御挡下（攻 ${Math.round(attack)} ≤ 防 ${blocked}）`);
    return { ok: true, msg: '进攻被防御挡下' };
  }

  target.hp -= damage;
  if (target.hp <= 0) {
    const oldOwner = target.owner;
    captureCity(state, factionId, from, target, activeRoute, candidate, attackKind);
    applyLosses(from.garrison, 0.25);
    addLog(state, `${faction.shortName} 攻占 ${target.name}（造成 ${damage} 伤害）`);
    checkFactionDefeat(state, oldOwner);
    return { ok: true, msg: '城市已攻占' };
  }

  applyLosses(from.garrison, 0.3);
  applyLosses(target.garrison, 0.2);
  if (flamers > 0) igniteCity(state, target);
  addLog(state, `${faction.shortName} 进攻 ${target.name}，造成 ${damage} 伤害（血量 ${Math.max(0, target.hp)}/${target.maxHp}）`);
  return { ok: true, msg: `造成 ${damage} 伤害` };
}

function effectiveAttack(state, factionId, garrison, defenderGarrison) {
  let attack = armyPower(garrison, 'attack');
  // 轰炸机 × 核弹同队：轰炸机攻击 ×2（额外再加一份轰炸机攻击）
  if ((garrison.nuke || 0) > 0 && (garrison.bomber || 0) > 0) {
    attack += UNIT_TYPES.bomber.attack * garrison.bomber;
  }
  // 防空导弹：拦截来袭导弹/核弹/氢弹（每具约 50%，多具递增）
  const aaa = defenderGarrison.aaa || 0;
  if (aaa > 0) {
    const strategic = (garrison.missile || 0) * UNIT_TYPES.missile.attack
      + (garrison.nuke || 0) * UNIT_TYPES.nuke.attack
      + (garrison.hbomb || 0) * UNIT_TYPES.hbomb.attack;
    if (strategic > 0) {
      const interceptFrac = 1 - Math.pow(0.5, Math.min(aaa, 4));
      attack -= strategic * interceptFrac;
    }
  }
  const mul = factionId === 'player'
    ? 1 + (state.talents?.assaultDrill || 0) * 0.12 + (state.profileBoosts?.retrofit || 0) * 0.1
    : 1;
  return Math.max(0, attack) * mul;
}

// Predict an attack outcome without mutating state (AI decisions / UI preview).
export function forecastAttack(state, factionId, fromCityId, targetCityId) {
  const from = cityById(state, fromCityId);
  const target = cityById(state, targetCityId);
  if (!from || !target || from.owner !== factionId || target.owner === factionId) return null;
  const adjacent = Object.values(state.routes).some(r => r.status === 'active'
    && ((r.from === fromCityId && r.to === targetCityId) || (r.from === targetCityId && r.to === fromCityId)))
    || !!candidateBetween(fromCityId, targetCityId);
  if (!adjacent) return null;
  const attack = effectiveAttack(state, factionId, from.garrison, target.garrison);
  const siegePen = armyPower(from.garrison, 'siege');
  const blocked = Math.max(0, (target.defense + armyPower(target.garrison, 'defense')) * 2 - siegePen);
  const damage = Math.round(attack - blocked);
  return { attack: Math.round(attack), blocked, damage, hp: target.hp, maxHp: target.maxHp, willCapture: damage >= target.hp };
}

function captureCity(state, factionId, from, target, activeRoute, candidate, attackKind) {
  target.owner = factionId;
  target.siege = false;
  target.isolated = false;
  target.burning = 0;
  // buildings persist with the city; restore HP and leave an occupying garrison
  // so the city is not trivially retaken the very next turn.
  target.hp = target.maxHp;
  for (const unitId of Object.keys(target.garrison)) target.garrison[unitId] = 0;
  target.garrison.infantry = 2;
  target.garrison.guard = 2;
  let link = activeRoute;
  if (!link) {
    const id = candidateId(candidate.from, candidate.to, attackKind);
    link = state.routes[id] || (state.routes[id] = {
      id,
      from: candidate.from,
      to: candidate.to,
      owner: factionId,
      kind: attackKind,
      level: 1,
      status: 'active',
      trade: true,
      military: attackKind === 'road',
      progress: 0,
    });
  }
  link.owner = factionId;
  link.status = 'active';
  link.trade = true;
}

function igniteCity(state, city) {
  if ((city.burning || 0) < 3) {
    city.burning = 3;
    addLog(state, `${city.name} 燃烧起来（每回合 −4 血）`);
  }
}

// End-of-turn upkeep: burning damage and 工兵 healing.
export function tickCities(state) {
  for (const city of Object.values(state.cities)) {
    if (!city.owner) continue;
    if (city.burning > 0) {
      city.hp = Math.max(1, city.hp - 4);
      city.burning -= 1;
    }
    const heal = city.garrison.engineer || 0;
    if (heal > 0 && city.hp < city.maxHp) {
      city.hp = Math.min(city.maxHp, city.hp + heal);
    }
  }
}

export function raidRoute(state, factionId, routeId) {
  const route = routeById(state, routeId);
  if (!route || route.status !== 'active') return { ok: false, msg: '连接不存在' };
  if (route.owner === factionId) return { ok: false, msg: '不能袭击自己的连接' };
  return cutRoute(state, factionId, routeId);
}

export function checkVictory(state) {
  if (state.winner) return state.winner;
  const withCities = FACTION_IDS.filter(fid => Object.values(state.cities).some(c => c.owner === fid));
  for (const fid of FACTION_IDS) {
    if (!withCities.includes(fid) && state.factions[fid]?.alive) state.factions[fid].alive = false;
  }
  if (withCities.length === 1) {
    state.winner = withCities[0];
    return state.winner;
  }
  if (state.turn >= VICTORY_RULES.drawTurn) {
    state.winner = 'draw';
    return 'draw';
  }
  return null;
}

function applyLosses(units, rate) {
  for (const unitId of Object.keys(units)) {
    const count = units[unitId] || 0;
    if (count <= 0) continue;
    units[unitId] = Math.max(0, Math.floor(count * (1 - rate)));
  }
}

function checkFactionDefeat(state, factionId) {
  if (!factionId || !state.factions[factionId]) return;
  const cities = Object.values(state.cities).filter(c => c.owner === factionId).length;
  if (cities === 0) {
    state.factions[factionId].alive = false;
    addLog(state, `${state.factions[factionId].shortName} 失去全部城市，已被消灭。`);
  }
}
