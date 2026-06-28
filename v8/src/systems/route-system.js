import { ALL_ROUTE_CANDIDATES, candidateId } from '../data/map-data.js';
import { addLog, canPay, cityById, otherCityId, routeById, routesOfCity, spendResources } from '../core/game-state.js';

export function candidateBetween(fromCityId, toCityId, kind = null) {
  return ALL_ROUTE_CANDIDATES.find(candidate => {
    if (kind && candidate.kind !== kind) return false;
    return candidateId(candidate.from, candidate.to, candidate.kind) === candidateId(fromCityId, toCityId, candidate.kind);
  }) || null;
}

export function canBuildRoute(state, factionId, fromCityId, toCityId) {
  const from = cityById(state, fromCityId);
  const to = cityById(state, toCityId);
  if (!from || !to) return { ok: false, msg: '城市不存在' };
  if (from.owner !== factionId) return { ok: false, msg: '起点不是你的城市' };
  if (to.owner && to.owner !== factionId) return { ok: false, msg: '不能向敌方城市直接建路，请先攻占' };
  const candidate = candidateBetween(fromCityId, toCityId);
  if (!candidate) return { ok: false, msg: '两城之间没有可建连接' };
  if (candidate.kind === 'sea' && (!from.tags.includes('port') || !to.tags.includes('port'))) {
    return { ok: false, msg: '海路需要两个港口' };
  }
  const id = candidateId(fromCityId, toCityId, candidate.kind);
  if (state.routes[id]?.status === 'active') return { ok: false, msg: '连接已经存在' };
  const faction = state.factions[factionId];
  const cost = adjustedCost(state, candidate.buildCost, factionId);
  if (!canPay(faction, cost)) return { ok: false, msg: costText(cost) + ' 不足' };
  return { ok: true, candidate, msg: '' };
}

export function buildRoute(state, factionId, fromCityId, toCityId) {
  const check = canBuildRoute(state, factionId, fromCityId, toCityId);
  if (!check.ok) return check;
  const { candidate } = check;
  const id = candidateId(fromCityId, toCityId, candidate.kind);
  spendResources(state.factions[factionId], adjustedCost(state, candidate.buildCost, factionId));
  const target = cityById(state, toCityId);
  if (!target.owner) {
    target.owner = factionId;
    target.garrison.infantry += 1;
  }
  state.routes[id] = {
    id,
    from: candidate.from,
    to: candidate.to,
    owner: factionId,
    kind: candidate.kind,
    level: 1,
    status: 'active',
    trade: true,
    military: candidate.kind === 'road',
    progress: 0,
  };
  addLog(state, `${state.factions[factionId].shortName} 建立 ${candidate.kind === 'sea' ? '海路' : '道路'}：${cityById(state, fromCityId).name} ⇄ ${target.name}`);
  return { ok: true, msg: '连接已建立' };
}

export function canUpgradeRoute(state, factionId, routeId) {
  const route = routeById(state, routeId);
  if (!route || route.status !== 'active') return { ok: false, msg: '连接不存在' };
  if (route.owner !== factionId) return { ok: false, msg: '不是你的连接' };
  if (route.level >= 3) return { ok: false, msg: '连接已满级' };
  const cost = upgradeCost(route);
  const adjusted = adjustedCost(state, cost, factionId);
  if (!canPay(state.factions[factionId], adjusted)) return { ok: false, msg: costText(adjusted) + ' 不足' };
  return { ok: true, cost: adjusted };
}

export function upgradeRoute(state, factionId, routeId) {
  const check = canUpgradeRoute(state, factionId, routeId);
  if (!check.ok) return check;
  const route = routeById(state, routeId);
  spendResources(state.factions[factionId], check.cost);
  route.level += 1;
  route.military = true;
  addLog(state, `${state.factions[factionId].shortName} 升级连接 ${cityById(state, route.from).name} ⇄ ${cityById(state, route.to).name} 至 Lv.${route.level}`);
  return { ok: true, msg: '连接已升级' };
}

export function cutRoute(state, factionId, routeId) {
  const route = routeById(state, routeId);
  if (!route || route.status !== 'active') return { ok: false, msg: '连接不存在' };
  if (route.owner === factionId) return { ok: false, msg: '不能切断自己的连接' };
  const from = cityById(state, route.from);
  const to = cityById(state, route.to);
  const hasAdjacentForce = [from, to].some(city => {
    if (city.owner === factionId) return true;
    return routesOfCity(state, city.id).some(r => {
      const near = cityById(state, otherCityId(r, city.id));
      return near?.owner === factionId;
    });
  });
  if (!hasAdjacentForce) return { ok: false, msg: '需要邻近己方城市才能切路' };
  route.status = 'broken';
  route.trade = false;
  addLog(state, `${state.factions[factionId].shortName} 切断了 ${cityById(state, route.from).name} ⇄ ${cityById(state, route.to).name}`);
  return { ok: true, msg: '连接已切断' };
}

export function repairRoute(state, factionId, routeId) {
  const route = routeById(state, routeId);
  if (!route || route.owner !== factionId) return { ok: false, msg: '不是你的连接' };
  if (route.status !== 'broken') return { ok: false, msg: '连接未损坏' };
  const cost = { gold: 10 + route.level * 5, labor: 8 + route.level * 4 };
  if (!canPay(state.factions[factionId], cost)) return { ok: false, msg: costText(cost) + ' 不足' };
  spendResources(state.factions[factionId], cost);
  route.status = 'active';
  route.trade = true;
  addLog(state, `${state.factions[factionId].shortName} 修复了 ${cityById(state, route.from).name} ⇄ ${cityById(state, route.to).name}`);
  return { ok: true, msg: '连接已修复' };
}

export function connectedToCapital(state, factionId, cityId) {
  const capitalId = state.factions[factionId].capitalId;
  if (cityId === capitalId) return true;
  const seen = new Set([capitalId]);
  const queue = [capitalId];
  while (queue.length) {
    const current = queue.shift();
    for (const route of routesOfCity(state, current)) {
      if (route.owner !== factionId) continue;
      const next = otherCityId(route, current);
      const city = cityById(state, next);
      if (!city || city.owner !== factionId || seen.has(next)) continue;
      if (next === cityId) return true;
      seen.add(next);
      queue.push(next);
    }
  }
  return false;
}

export function routeCandidatesFrom(state, cityId) {
  return ALL_ROUTE_CANDIDATES
    .filter(candidate => candidate.from === cityId || candidate.to === cityId)
    .map(candidate => {
      const other = candidate.from === cityId ? candidate.to : candidate.from;
      const id = candidateId(candidate.from, candidate.to, candidate.kind);
      return { ...candidate, id, other, existing: state.routes[id] || null };
    });
}

export function upgradeCost(route) {
  return {
    gold: 28 + route.level * 20 + (route.kind === 'sea' ? 12 : 0),
    labor: 12 + route.level * 9,
  };
}

export function adjustedCost(state, cost, factionId) {
  if (factionId !== 'player') return { ...cost };
  const discount = Math.min(0.45, (state.talents?.grandRoads || 0) * 0.1 + (state.talents?.swiftRoads || 0) * 0.05);
  if (!discount) return { ...cost };
  const out = {};
  for (const [key, value] of Object.entries(cost)) {
    out[key] = Math.max(1, Math.ceil(value * (1 - discount)));
  }
  return out;
}

export function costText(cost) {
  return Object.entries(cost).map(([key, value]) => `${resourceIcon(key)}${value}`).join(' ');
}

function resourceIcon(key) {
  return { gold: '金', food: '粮', labor: '工', influence: '势' }[key] || key;
}
