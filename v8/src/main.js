import { actionLimit, addLog, consumeAction, createNewGame, cityById, resetActions, resourceCities, routeById } from './core/game-state.js';
import { BUILDINGS, CITY_TYPES, FACTIONS, RESOURCE_NAMES, TALENT_BRANCHES, TALENTS, UNIT_TYPES, VICTORY_RULES } from './data/map-data.js';
import { renderMap, fitCamera } from './render/map-renderer.js';
import { createInputController } from './ui/input-controller.js';
import { applyAllIncome } from './systems/economy-system.js';
import { applyCityGrowth } from './systems/growth-system.js';
import { attackCity, buildBuilding, canBuildBuilding, canTrainUnit, checkVictory, forecastAttack, moveArmy, raidRoute, tickCities, trainUnit } from './systems/combat-system.js';
import {
  buildRoute,
  canBuildRoute,
  canUpgradeRoute,
  adjustedCost,
  repairRoute,
  routeCandidatesFrom,
  upgradeRoute,
} from './systems/route-system.js';
import { playAITurn } from './systems/ai-system.js';

const canvas = document.getElementById('map');
const ctx = canvas.getContext('2d');
const resourceBar = document.getElementById('resource-bar');
const selectionPanel = document.getElementById('selection-panel');
const logList = document.getElementById('log-list');
const turnLabel = document.getElementById('turn-label');
const endTurnBtn = document.getElementById('end-turn');
const restartBtn = document.getElementById('restart');
const banner = document.getElementById('banner');
const objectiveList = document.getElementById('objective-list');
const actionPips = document.getElementById('action-pips');
const factionStats = document.getElementById('faction-stats');
const talentPointsEl = document.getElementById('talent-points');
const talentList = document.getElementById('talent-list');
const startScreen = document.getElementById('start-screen');
const startGameBtn = document.getElementById('start-game');
const resetProfileBtn = document.getElementById('reset-profile');
const statWins = document.getElementById('stat-wins');
const statLosses = document.getElementById('stat-losses');
const statShopGold = document.getElementById('stat-shop-gold');
const rankList = document.getElementById('rank-list');
const shopList = document.getElementById('shop-list');
const playerNameEl = document.getElementById('player-name');
const rerollNameBtn = document.getElementById('reroll-name');
const claimGiftBtn = document.getElementById('claim-gift');

const TALENT_STORAGE_KEY = 'freewar_v8_talent_state';
const PROFILE_STORAGE_KEY = 'freewar_v8_profile';
const SHOP_ITEMS = {
  retrofit: { name: '改造 +10%', cost: 15, desc: '下一局进攻战力 +10%', kind: 'boost' },
  extraCity: { name: '加一座初始城池', cost: 30, desc: '下一局开局额外纳入 1 座相邻城市', kind: 'boost' },
  talentPoint: { name: '购买一点天贝武点', cost: 100, desc: '立即获得 1 点永久天赋', kind: 'instant' },
};
const SHOP_BOOST_IDS = Object.keys(SHOP_ITEMS).filter(id => SHOP_ITEMS[id].kind === 'boost');
const EXTRA_CITY_LIMIT = 2;
const NAME_PREFIX = ['赤', '金', '青', '苍', '幽', '雷', '霜', '烈', '夜', '银'];
const NAME_CORE = ['鹰', '狼', '龙', '隼', '虎', '鲸', '鸦', '麟', '熊', '蛟'];
const NAME_TITLE = ['统帅', '将军', '督军', '舰长', '总督', '军师'];

function randomName() {
  const pick = list => list[Math.floor(Math.random() * list.length)];
  return `${pick(NAME_PREFIX)}${pick(NAME_CORE)}${pick(NAME_TITLE)}`;
}

let talentState = loadTalentState();
let profileState = loadProfileState();
let state = createNewGame(talentState.upgrades, profileState.boosts);
let camera = { scale: 1, x: 0, y: 0 };

function resize() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(960, Math.floor(rect.width * window.devicePixelRatio));
  canvas.height = Math.max(540, Math.floor(rect.height * window.devicePixelRatio));
  camera = fitCamera(canvas);
}

function render(timeMs = 0) {
  renderMap(ctx, state, null, camera, timeMs);
  requestAnimationFrame(render);
}

function renderHUD() {
  const player = state.factions.player;
  turnLabel.textContent = `回合 ${state.turn}`;
  resourceBar.innerHTML = Object.entries(player.resources).map(([key, value]) => (
    `<div class="resource"><span>${RESOURCE_NAMES[key]}</span><b>${Math.floor(value)}</b></div>`
  )).join('');
  renderSelection();
  renderLog();
  renderBanner();
  renderObjectives();
  renderActionPips();
  renderFactionStats();
  renderTalents();
  renderProfile();
  renderShop();
}

function renderSelection() {
  if (!state.selected) {
    selectionPanel.innerHTML = `<h2>未选中</h2><p>点击城市或连接查看操作。</p>`;
    return;
  }
  if (state.selected.kind === 'city') {
    renderCityPanel(cityById(state, state.selected.id));
  } else {
    renderRoutePanel(routeById(state, state.selected.id));
  }
}

function renderCityPanel(city) {
  if (!city) return;
  const owner = city.owner ? FACTIONS[city.owner] : null;
  const type = CITY_TYPES[city.type];
  const unitRows = Object.entries(city.garrison)
    .filter(([, count]) => count > 0)
    .map(([id, count]) => `${UNIT_TYPES[id].icon}${count}`)
    .join(' ') || '无';
  const canAct = city.owner === 'player' && !state.winner;
  selectionPanel.innerHTML = `
    <h2>${city.name}</h2>
    <div class="tag-row">
      <span>${type.name}</span>
      <span>Lv.${city.level}</span>
      <span style="color:${owner?.color || '#c8b99a'}">${owner?.shortName || '中立'}</span>
    </div>
    <div class="hpbar"><i style="width:${Math.round(Math.max(0, city.hp) / city.maxHp * 100)}%"></i></div>
    <dl>
      <dt>血量</dt><dd>${Math.max(0, Math.ceil(city.hp))}/${city.maxHp}${city.burning ? ` · 🔥燃烧${city.burning}` : ''}</dd>
      <dt>防御</dt><dd>${city.defense}（防守值，1 抵 2 攻）${city.siege ? ' · 围城' : ''}${city.isolated ? ' · 孤立' : ''}</dd>
      <dt>建筑</dt><dd>${city.building ? BUILDINGS[city.building].name : '无'}</dd>
      <dt>驻军</dt><dd>${unitRows}</dd>
    </dl>
    <div class="actions" id="city-actions"></div>
  `;
  const actions = document.getElementById('city-actions');
  if (!canAct) {
    actions.innerHTML = `<p class="muted">${city.owner ? '敌方或非玩家城市。选择己方相邻城市后沿连接进攻。' : '中立城市，可由相邻己方城市建路纳入。'}</p>`;
    return;
  }

  addNeighborActions(actions, city);
  addBuildingButtons(actions, city);
  addTrainButtons(actions, city);
  applyActionLock(actions);
}

const TRAIN_GROUPS = [
  { name: '步兵营', ids: ['infantry', 'charger', 'cavalry', 'guard', 'engineer'] },
  { name: '机械化', ids: ['apc', 'tank', 'siege', 'rocket', 'engvehicle', 'flamer'] },
  { name: '空军 / 战略', ids: ['fighter', 'bomber', 'aaa', 'missile', 'nuke', 'hbomb'] },
  { name: '工事 / 后勤', ids: ['bunker', 'miner', 'civilian', 'fleet'] },
];

function addTrainButtons(root, city) {
  for (const groupDef of TRAIN_GROUPS) {
    const group = document.createElement('div');
    group.className = 'action-group';
    group.innerHTML = `<h3>训练 · ${groupDef.name}</h3>`;
    for (const unitId of groupDef.ids) {
      const unit = UNIT_TYPES[unitId];
      const check = canTrainUnit(state, 'player', city.id, unitId);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.disabled = !check.ok;
      btn.title = check.msg;
      btn.innerHTML = `<span>${unit.icon} ${unit.name} <i class="stat">攻${unit.attack}/防${unit.defense}</i></span><small>${costText(unit.cost)}</small>`;
      btn.dataset.freeAction = 'true';
      btn.addEventListener('click', () => runPlayerAction(() => trainUnit(state, 'player', city.id, unitId), { consumesAction: false }));
      group.appendChild(btn);
    }
    root.appendChild(group);
  }
}

function addBuildingButtons(root, city) {
  const group = document.createElement('div');
  group.className = 'action-group';
  group.innerHTML = '<h3>建筑</h3>';
  for (const buildingId of Object.keys(BUILDINGS)) {
    const building = BUILDINGS[buildingId];
    const check = canBuildBuilding(state, 'player', city.id, buildingId);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.disabled = !check.ok;
    btn.title = check.ok ? building.desc : check.msg;
    btn.innerHTML = `<span>${building.icon} 建造 ${building.name}</span><small>${costText(building.cost)}</small>`;
    btn.dataset.freeAction = 'true';
    btn.addEventListener('click', () => runPlayerAction(() => buildBuilding(state, 'player', city.id, buildingId), { consumesAction: false }));
    group.appendChild(btn);
  }
  root.appendChild(group);
}

function addNeighborActions(root, city) {
  const group = document.createElement('div');
  group.className = 'action-group';
  group.innerHTML = '<h3>连接 / 进攻</h3>';
  const options = routeCandidatesFrom(state, city.id);
  for (const option of options) {
    const target = cityById(state, option.other);
    const btn = document.createElement('button');
    btn.type = 'button';
    const route = option.existing;
    if (target.owner === 'player' && route?.status === 'active') {
      btn.innerHTML = `<span>调兵至 ${target.name}</span><small>${route.kind === 'sea' ? '海路' : '道路'} Lv.${route.level}</small>`;
      btn.dataset.freeAction = 'true';
      btn.addEventListener('click', () => runPlayerAction(() => moveArmy(state, 'player', city.id, target.id), { consumesAction: false }));
    } else if (target.owner && target.owner !== 'player') {
      const seaAttack = option.kind === 'sea';
      const canAttack = !seaAttack || city.garrison.fleet > 0;
      const fc = forecastAttack(state, 'player', city.id, target.id);
      const preview = fc ? (fc.damage <= 0 ? `被挡下(攻${fc.attack}≤防${fc.blocked})` : fc.willCapture ? `可攻占! 伤害${fc.damage}` : `伤害${fc.damage}·敌血${Math.max(0, Math.ceil(fc.hp))}`) : '';
      btn.innerHTML = `<span>进攻 ${target.name}</span><small>${FACTIONS[target.owner].shortName} · ${preview} · 消耗行动点</small>`;
      btn.disabled = !canAttack;
      btn.title = canAttack ? '' : '跨海进攻需要舰队';
      btn.addEventListener('click', () => runPlayerAction(() => attackCity(state, 'player', city.id, target.id)));
    } else {
      const check = canBuildRoute(state, 'player', city.id, target.id);
      btn.innerHTML = `<span>${target.owner === 'player' ? '建立连接' : '连接并纳入'} ${target.name}</span><small>${option.kind === 'sea' ? '海路' : '道路'} · ${costText(adjustedCost(state, option.buildCost, 'player'))}</small>`;
      btn.disabled = !check.ok;
      btn.title = check.msg;
      btn.dataset.freeAction = 'true';
      btn.addEventListener('click', () => runPlayerAction(() => buildRoute(state, 'player', city.id, target.id), { consumesAction: false }));
    }
    group.appendChild(btn);
  }
  root.appendChild(group);
}

function renderRoutePanel(route) {
  if (!route) return;
  const a = cityById(state, route.from);
  const b = cityById(state, route.to);
  const owner = FACTIONS[route.owner];
  selectionPanel.innerHTML = `
    <h2>${a.name} ⇄ ${b.name}</h2>
    <div class="tag-row">
      <span>${route.kind === 'sea' ? '海路' : '道路'}</span>
      <span>Lv.${route.level}</span>
      <span style="color:${owner.color}">${owner.shortName}</span>
      <span>${route.status === 'active' ? '通行' : '损坏'}</span>
    </div>
    <div class="actions" id="route-actions"></div>
  `;
  const actions = document.getElementById('route-actions');
  if (route.owner === 'player') {
    const upgrade = document.createElement('button');
    const check = canUpgradeRoute(state, 'player', route.id);
    upgrade.type = 'button';
    upgrade.disabled = !check.ok;
    upgrade.textContent = check.ok ? '升级连接' : check.msg;
    upgrade.dataset.freeAction = 'true';
    upgrade.addEventListener('click', () => runPlayerAction(() => upgradeRoute(state, 'player', route.id), { consumesAction: false }));
    actions.appendChild(upgrade);
    const repair = document.createElement('button');
    repair.type = 'button';
    repair.disabled = route.status !== 'broken';
    repair.textContent = '修复连接';
    repair.dataset.freeAction = 'true';
    repair.addEventListener('click', () => runPlayerAction(() => repairRoute(state, 'player', route.id), { consumesAction: false }));
    actions.appendChild(repair);
  } else {
    const cut = document.createElement('button');
    cut.type = 'button';
    cut.textContent = '切断敌方连接（消耗行动点）';
    cut.addEventListener('click', () => runPlayerAction(() => raidRoute(state, 'player', route.id)));
    actions.appendChild(cut);
  }
  applyActionLock(actions);
}

function renderLog() {
  logList.innerHTML = state.log.slice(-12).map(line => `<li>${escapeHtml(line)}</li>`).join('');
}

function renderBanner() {
  if (!state.winner) {
    banner.hidden = true;
    return;
  }
  updateProfileForWinner();
  banner.hidden = false;
  if (state.winner === 'draw') {
    banner.textContent = `平局：到达第 ${VICTORY_RULES.drawTurn} 回合仍未分出胜负。`;
  } else if (state.winner === 'player') {
    banner.innerHTML = `
      <strong>胜利：你占领了全部敌方城市。</strong>
      <button id="claim-talent" type="button" ${state.rewardClaimed ? 'disabled' : ''}>${state.rewardClaimed ? '已领取天赋点' : '领取 1 点天赋'}</button>
    `;
    const claim = document.getElementById('claim-talent');
    claim?.addEventListener('click', claimTalentReward);
  } else {
    banner.textContent = `战败：${FACTIONS[state.winner].name} 统一了战场。`;
  }
}

function runPlayerAction(action, options = { consumesAction: true }) {
  if (state.winner) return;
  if (options.consumesAction && (state.actionsRemaining || 0) <= 0) {
    addLog(state, `本回合行动已用完，每回合最多 ${actionLimit(state.talents)} 项。训练仍可继续。`);
    renderHUD();
    return;
  }
  const result = action();
  if (result.ok && options.consumesAction) consumeAction(state);
  runAction(result);
}

function runAction(result) {
  if (!result.ok && result.msg) {
    addLog(state, result.msg);
  }
  checkVictory(state);
  renderHUD();
}

function endTurn() {
  if (state.winner) return;
  applyAllIncome(state);
  applyCityGrowth(state);
  tickCities(state);
  checkVictory(state);
  if (state.winner) {
    renderHUD();
    return;
  }
  for (const fid of Object.keys(FACTIONS)) {
    if (fid !== 'player') playAITurn(state, fid);
  }
  state.turn += 1;
  checkVictory(state);
  resetActions(state);
  renderHUD();
}

function restart() {
  state = createNewGame(talentState.upgrades, profileState.boosts);
  renderHUD();
}

function costText(cost) {
  return Object.entries(cost).map(([key, value]) => `${RESOURCE_NAMES[key]} ${value}`).join(' · ');
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function renderObjectives() {
  if (!objectiveList) return;
  const all = Object.values(state.cities).length;
  const mine = Object.values(state.cities).filter(c => c.owner === 'player').length;
  const enemy = Object.values(state.cities).filter(c => c.owner && c.owner !== 'player').length;
  objectiveList.innerHTML = `
    <li>占领全部敌方城市获胜：己方 ${mine} / 共 ${all}（敌方剩 ${enemy}）</li>
    <li>第 ${VICTORY_RULES.drawTurn} 回合自动平局（当前回合 ${state.turn}）</li>
  `;
}

function renderActionPips() {
  if (!actionPips) return;
  const limit = actionLimit(state.talents);
  actionPips.innerHTML = Array.from({ length: limit }, (_, index) => (
    `<i class="${index < state.actionsRemaining ? 'active' : ''}"></i>`
  )).join('');
}

function renderFactionStats() {
  if (!factionStats) return;
  factionStats.innerHTML = Object.values(FACTIONS).map(faction => {
    const owned = Object.values(state.cities).filter(city => city.owner === faction.id).length;
    const resources = resourceCities(state, faction.id).length;
    const capital = ownedCapitalCount(faction.id);
    return `<div style="--faction:${faction.color}"><b>${faction.shortName}</b><span>城市 ${owned}</span><span>资源 ${resources}</span><span>主城 ${capital}</span></div>`;
  }).join('');
}

function ownedCapitalCount(factionId) {
  return Object.values(state.cities).filter(city => city.type === 'capital' && city.owner === factionId).length;
}

function applyActionLock(root) {
  if ((state.actionsRemaining || 0) > 0) return;
  for (const button of root.querySelectorAll('button')) {
    if (button.dataset.freeAction === 'true') continue;
    button.disabled = true;
    button.title = '本回合行动已用完';
  }
}

function loadTalentState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(TALENT_STORAGE_KEY) || '{}');
    return normalizeTalentState(parsed);
  } catch {
    return normalizeTalentState({});
  }
}

function normalizeTalentState(input) {
  const upgrades = {};
  for (const id of Object.keys(TALENTS)) {
    const level = Number(input?.upgrades?.[id] || 0);
    upgrades[id] = Math.max(0, Math.min(TALENTS[id].max, Number.isFinite(level) ? level : 0));
  }
  return {
    points: Math.max(0, Number(input?.points || 0)),
    upgrades,
  };
}

function loadProfileState() {
  try {
    return normalizeProfileState(JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) || '{}'));
  } catch {
    return normalizeProfileState({});
  }
}

function normalizeProfileState(input) {
  return {
    name: typeof input?.name === 'string' && input.name.trim() ? input.name : randomName(),
    giftClaimed: Boolean(input?.giftClaimed),
    wins: Math.max(0, Number(input?.wins || 0)),
    losses: Math.max(0, Number(input?.losses || 0)),
    shopGold: Math.max(0, Number(input?.shopGold ?? 5)),
    boosts: normalizeBoosts(input?.boosts),
    recordedGames: Array.isArray(input?.recordedGames) ? input.recordedGames : [],
  };
}

function normalizeBoosts(input = {}) {
  return Object.fromEntries(SHOP_BOOST_IDS.map(id => [id, Math.max(0, Number(input?.[id] || 0))]));
}

function saveProfileState() {
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profileState));
}

function updateProfileForWinner() {
  if (!state.winner || state.profileRecorded) return;
  state.profileRecorded = true;
  profileState.recordedGames = [...profileState.recordedGames.slice(-19), state.turn + ':' + state.winner];
  if (state.winner === 'player') {
    profileState.wins += 1;
    profileState.shopGold += 25 + (talentState.upgrades.talentDividend >= TALENTS.talentDividend.max ? 2 : 0);
  } else if (state.winner === 'draw') {
    profileState.shopGold += 15;
  } else {
    profileState.losses += 1;
    profileState.shopGold += 10;
  }
  saveProfileState();
}

function renderProfile() {
  if (playerNameEl) playerNameEl.textContent = profileState.name;
  if (claimGiftBtn) {
    claimGiftBtn.disabled = profileState.giftClaimed;
    claimGiftBtn.textContent = profileState.giftClaimed ? '🎁 礼包已领取' : '🎁 领取礼包（+2 天贝武点）';
  }
  if (statWins) statWins.textContent = profileState.wins;
  if (statLosses) statLosses.textContent = profileState.losses;
  if (statShopGold) statShopGold.textContent = profileState.shopGold;
  if (rankList) {
    const score = profileState.wins * 3000 + profileState.shopGold * 20 - profileState.losses * 400;
    const entries = [
      ['AAA', 12345],
      ['王冕', 9000],
      [profileState.name, Math.max(0, score)],
      ['作者', 6000],
    ].sort((a, b) => b[1] - a[1]).slice(0, 4);
    rankList.innerHTML = entries.map(([name, value]) => `<li>${escapeHtml(name)} · ${value}</li>`).join('');
  }
}

function renderShop() {
  if (!shopList) return;
  shopList.innerHTML = Object.entries(SHOP_ITEMS).map(([id, item]) => {
    const queued = profileState.boosts[id] || 0;
    const atLimit = id === 'extraCity' && queued >= EXTRA_CITY_LIMIT;
    const disabled = profileState.shopGold < item.cost || atLimit;
    return `
      <button type="button" data-shop-item="${id}" ${disabled ? 'disabled' : ''}>
        <span>${item.name} · ${item.cost} 金币${queued ? ` · 待用 ${queued}` : ''}</span>
        <small>${item.desc}</small>
      </button>
    `;
  }).join('');
  for (const button of shopList.querySelectorAll('[data-shop-item]')) {
    button.addEventListener('click', () => buyShopItem(button.dataset.shopItem));
  }
}

function buyShopItem(itemId) {
  const item = SHOP_ITEMS[itemId];
  if (!item || profileState.shopGold < item.cost) return;
  if (item.kind === 'instant') {
    profileState.shopGold -= item.cost;
    if (itemId === 'talentPoint') {
      talentState.points += 1;
      saveTalentState();
      addLog(state, `商店购买：${item.name}，已获得 1 点永久天赋。`);
    }
    saveProfileState();
    renderHUD();
    return;
  }
  if (itemId === 'extraCity' && (profileState.boosts.extraCity || 0) >= EXTRA_CITY_LIMIT) return;
  profileState.shopGold -= item.cost;
  profileState.boosts[itemId] = (profileState.boosts[itemId] || 0) + 1;
  saveProfileState();
  state = createNewGame(talentState.upgrades, profileState.boosts);
  addLog(state, `商店购买：${item.name} 已加入下一局补给。`);
  renderHUD();
}

function consumeQueuedBoosts() {
  const hasBoost = Object.values(profileState.boosts).some(value => value > 0);
  if (!hasBoost) return;
  profileState.boosts = normalizeBoosts({});
  saveProfileState();
  renderProfile();
  renderShop();
}

function saveTalentState() {
  localStorage.setItem(TALENT_STORAGE_KEY, JSON.stringify(talentState));
}

function claimTalentReward() {
  if (state.winner !== 'player' || state.rewardClaimed) return;
  const bonus = talentState.upgrades.talentDividend >= TALENTS.talentDividend.max ? 1 : 0;
  talentState.points += 1 + bonus;
  state.rewardClaimed = true;
  saveTalentState();
  addLog(state, `胜利奖励：获得 ${1 + bonus} 点永久天赋。`);
  renderHUD();
}

function renderTalents() {
  if (!talentList || !talentPointsEl) return;
  talentPointsEl.textContent = talentState.points;
  talentList.innerHTML = Object.values(TALENT_BRANCHES).map(branch => {
    const talents = Object.values(TALENTS).filter(talent => talent.branch === branch.id);
    return `
      <section class="talent-branch" style="--branch:${branch.color}">
        <h3>${branch.name}</h3>
        ${talents.map(talent => talentButtonHtml(talent)).join('')}
      </section>
    `;
  }).join('');
  for (const button of talentList.querySelectorAll('[data-talent]')) {
    button.addEventListener('click', () => upgradeTalent(button.dataset.talent));
  }
}

function talentButtonHtml(talent) {
  const level = talentState.upgrades[talent.id] || 0;
  const maxed = level >= talent.max;
  const locked = !talentUnlocked(talent);
  const disabled = talentState.points <= 0 || maxed || locked;
  const req = locked ? `需要：${talent.prereq.map(id => TALENTS[id].name).join(' / ')}` : '';
  return `
    <button class="talent-card" type="button" data-talent="${talent.id}" ${disabled ? 'disabled' : ''}>
      <span><b>${talent.name}</b><i>Lv.${level}/${talent.max}</i></span>
      <small>${talent.desc}</small>
      <em>${locked ? req : (maxed ? '已满级' : '消耗 1 点升级')}</em>
    </button>
  `;
}

function talentUnlocked(talent) {
  if (!talent.prereq?.length) return true;
  return talent.prereq.every(id => (talentState.upgrades[id] || 0) > 0);
}

function upgradeTalent(talentId) {
  const talent = TALENTS[talentId];
  if (!talent || talentState.points <= 0) return;
  if (!talentUnlocked(talent)) return;
  const current = talentState.upgrades[talentId] || 0;
  if (current >= talent.max) return;
  talentState.points -= 1;
  talentState.upgrades[talentId] = current + 1;
  saveTalentState();
  addLog(state, `永久天赋升级：${talent.name} Lv.${current + 1}，下一局生效。`);
  renderHUD();
}

window.addEventListener('resize', resize);
endTurnBtn.addEventListener('click', endTurn);
restartBtn.addEventListener('click', restart);
startGameBtn?.addEventListener('click', () => {
  startScreen.hidden = true;
  consumeQueuedBoosts();
  resize();
});
for (const button of document.querySelectorAll('[data-start-jump]')) {
  button.addEventListener('click', () => {
    startScreen.hidden = true;
    consumeQueuedBoosts();
    document.querySelector(button.dataset.startJump === 'talent' ? '.manual-panel' : '.rule-grid')?.scrollIntoView({ behavior: 'smooth' });
    resize();
  });
}
rerollNameBtn?.addEventListener('click', () => {
  profileState.name = randomName();
  saveProfileState();
  renderHUD();
});
claimGiftBtn?.addEventListener('click', () => {
  if (profileState.giftClaimed) return;
  profileState.giftClaimed = true;
  talentState.points += 2;
  saveProfileState();
  saveTalentState();
  addLog(state, '礼包已领取：获得 2 点永久天赋。');
  renderHUD();
});
resetProfileBtn?.addEventListener('click', () => {
  profileState = normalizeProfileState({});
  talentState = normalizeTalentState({});
  saveProfileState();
  saveTalentState();
  state = createNewGame(talentState.upgrades);
  renderHUD();
});

createInputController(canvas, () => state, () => camera, {
  onHover(target) {
    state.hover = target;
  },
  onSelect(target) {
    state.selected = target;
    renderHUD();
  },
});

resize();
renderHUD();
requestAnimationFrame(render);
