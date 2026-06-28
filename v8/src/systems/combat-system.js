import { FACTION_IDS, UNIT_TYPES, VICTORY_RULES } from '../data/map-data.js';
import {
  addLog,
  armyPower,
  canPay,
  cityById,
  routeById,
  spendResources,
  totalUnits,
} from '../core/game-state.js';
import { cutRoute } from './route-system.js';

export function trainUnit(state, factionId, cityId, unitId) {
  const check = canTrainUnit(state, factionId, cityId, unitId);
  if (!check.ok) return check;
  const city = cityById(state, cityId);
  const unit = UNIT_TYPES[unitId];
  spendResources(state.factions[factionId], unit.cost);
  city.garrison[unitId] += 1;
  addLog(state, `${state.factions[factionId].shortName} 在 ${city.name} 训练 ${unit.name}`);
  return { ok: true, msg: '训练完成' };
}

export function canTrainUnit(state, factionId, cityId, unitId) {
  const city = cityById(state, cityId);
  const unit = UNIT_TYPES[unitId];
  if (!city || city.owner !== factionId) return { ok: false, msg: '只能在己方城市训练' };
  if (!unit) return { ok: false, msg: '兵种不存在' };
  if (unitId === 'fleet' && !city.tags.includes('port')) return { ok: false, msg: '舰队只能在港口训练' };
  if (unitId === 'siege' && !city.tags.includes('barracks') && city.type !== 'capital') return { ok: false, msg: '攻城车需要军营或首都' };
  if (!canPay(state.factions[factionId], unit.cost)) return { ok: false, msg: '资源不足' };
  return { ok: true, msg: '' };
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

export function attackCity(state, factionId, fromCityId, targetCityId) {
  const from = cityById(state, fromCityId);
  const target = cityById(state, targetCityId);
  if (!from || !target || from.owner !== factionId) return { ok: false, msg: '需要选择己方出发城市' };
  if (target.owner === factionId) return { ok: false, msg: '目标已经属于你' };
  const route = Object.values(state.routes).find(r => {
    if (r.status !== 'active') return false;
    return (r.from === fromCityId && r.to === targetCityId) || (r.from === targetCityId && r.to === fromCityId);
  });
  if (!route) return { ok: false, msg: '必须沿现有连接进攻' };
  if (route.kind === 'sea' && from.garrison.fleet <= 0) return { ok: false, msg: '跨海进攻需要舰队' };
  const attackingUnits = { ...from.garrison };
  const attackTalent = factionId === 'player' ? (state.talents?.assaultDrill || 0) : 0;
  const attackBoost = factionId === 'player' ? (state.profileBoosts?.warBanner || 0) : 0;
  const attackPower = armyPower(attackingUnits, target.type === 'fortress' || target.type === 'capital' ? 'siege' : 'field') * (1 + attackTalent * 0.12 + attackBoost * 0.1);
  if (attackPower < 2) return { ok: false, msg: '出发城市没有可用部队' };
  const defensePower = target.defense + armyPower(target.garrison, 'defense') + target.level * 2;
  const ratio = attackPower / Math.max(1, defensePower);
  const attackerLoss = ratio >= 1 ? 0.45 : 0.75;
  const defenderLoss = ratio >= 1 ? 0.9 : 0.45;
  applyLosses(from.garrison, attackerLoss);
  applyLosses(target.garrison, defenderLoss);
  if (ratio >= 1 || totalUnits(target.garrison) === 0) {
    const oldOwner = target.owner;
    target.owner = factionId;
    target.siege = false;
    target.isolated = false;
    target.garrison.infantry = Math.max(target.garrison.infantry, 1);
    route.owner = factionId;
    route.trade = true;
    addLog(state, `${state.factions[factionId].shortName} 攻占 ${target.name}`);
    checkFactionDefeat(state, oldOwner);
    return { ok: true, msg: '城市已攻占' };
  }
  addLog(state, `${state.factions[factionId].shortName} 进攻 ${target.name} 失败`);
  return { ok: false, msg: '进攻失败' };
}

export function raidRoute(state, factionId, routeId) {
  const route = routeById(state, routeId);
  if (!route || route.status !== 'active') return { ok: false, msg: '连接不存在' };
  if (route.owner === factionId) return { ok: false, msg: '不能袭击自己的连接' };
  return cutRoute(state, factionId, routeId);
}

export function checkVictory(state) {
  for (const fid of FACTION_IDS) {
    if (!state.factions[fid]?.alive) continue;
    const capitals = Object.values(state.cities).filter(city => city.type === 'capital' && city.owner === fid).length;
    if (capitals >= VICTORY_RULES.capitalTarget) {
      state.winner = fid;
      return state.winner;
    }
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
  const capital = cityById(state, state.factions[factionId].capitalId);
  if (capital?.owner !== factionId) {
    addLog(state, `${state.factions[factionId].shortName} 首都陷落，仍可继续争夺其它首都`);
  }
}
