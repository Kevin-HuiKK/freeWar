import { createNewGame, cityById, routeById, totalUnits } from './core/game-state.js';
import { CITY_TYPES, FACTIONS, RESOURCE_NAMES, UNIT_TYPES } from './data/map-data.js';
import { renderMap, fitCamera } from './render/map-renderer.js';
import { createInputController } from './ui/input-controller.js';
import { applyAllIncome } from './systems/economy-system.js';
import { applyCityGrowth } from './systems/growth-system.js';
import { attackCity, canTrainUnit, checkVictory, moveArmy, raidRoute, trainUnit } from './systems/combat-system.js';
import {
  buildRoute,
  canBuildRoute,
  canUpgradeRoute,
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

let state = createNewGame();
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
    <div class="meter"><i style="width:${Math.min(100, city.growth)}%"></i></div>
    <dl>
      <dt>防御</dt><dd>${city.defense}${city.siege ? ' · 围城' : ''}${city.isolated ? ' · 孤立' : ''}</dd>
      <dt>驻军</dt><dd>${unitRows}</dd>
    </dl>
    <div class="actions" id="city-actions"></div>
  `;
  const actions = document.getElementById('city-actions');
  if (!canAct) {
    actions.innerHTML = `<p class="muted">${city.owner ? '敌方或非玩家城市。选择己方相邻城市后沿连接进攻。' : '中立城市，可由相邻己方城市建路纳入。'}</p>`;
    return;
  }

  addTrainButtons(actions, city);
  addNeighborActions(actions, city);
}

function addTrainButtons(root, city) {
  const group = document.createElement('div');
  group.className = 'action-group';
  group.innerHTML = '<h3>训练</h3>';
  for (const unitId of Object.keys(UNIT_TYPES)) {
    const unit = UNIT_TYPES[unitId];
    const check = canTrainUnit(state, 'player', city.id, unitId);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.disabled = !check.ok;
    btn.title = check.msg;
    btn.innerHTML = `<span>${unit.icon} ${unit.name}</span><small>${costText(unit.cost)}</small>`;
    btn.addEventListener('click', () => runAction(trainUnit(state, 'player', city.id, unitId)));
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
      btn.addEventListener('click', () => runAction(moveArmy(state, 'player', city.id, target.id)));
    } else if (target.owner && target.owner !== 'player' && route?.status === 'active') {
      btn.innerHTML = `<span>进攻 ${target.name}</span><small>${FACTIONS[target.owner].shortName} · ${route.kind === 'sea' ? '需舰队' : '陆路'}</small>`;
      btn.addEventListener('click', () => runAction(attackCity(state, 'player', city.id, target.id)));
    } else {
      const check = canBuildRoute(state, 'player', city.id, target.id);
      btn.innerHTML = `<span>${target.owner === 'player' ? '建立连接' : '连接并纳入'} ${target.name}</span><small>${option.kind === 'sea' ? '海路' : '道路'} · ${costText(option.buildCost)}</small>`;
      btn.disabled = !check.ok;
      btn.title = check.msg;
      btn.addEventListener('click', () => runAction(buildRoute(state, 'player', city.id, target.id)));
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
    upgrade.addEventListener('click', () => runAction(upgradeRoute(state, 'player', route.id)));
    actions.appendChild(upgrade);
    const repair = document.createElement('button');
    repair.type = 'button';
    repair.disabled = route.status !== 'broken';
    repair.textContent = '修复连接';
    repair.addEventListener('click', () => runAction(repairRoute(state, 'player', route.id)));
    actions.appendChild(repair);
  } else {
    const cut = document.createElement('button');
    cut.type = 'button';
    cut.textContent = '切断敌方连接';
    cut.addEventListener('click', () => runAction(raidRoute(state, 'player', route.id)));
    actions.appendChild(cut);
  }
}

function renderLog() {
  logList.innerHTML = state.log.slice(-12).map(line => `<li>${escapeHtml(line)}</li>`).join('');
}

function renderBanner() {
  if (!state.winner) {
    banner.hidden = true;
    return;
  }
  banner.hidden = false;
  banner.textContent = state.winner === 'player'
    ? '胜利：你控制了全部首都。'
    : `战败：${FACTIONS[state.winner].name} 取得霸权。`;
}

function runAction(result) {
  if (!result.ok && result.msg) {
    state.log.push(result.msg);
  }
  checkVictory(state);
  renderHUD();
}

function endTurn() {
  if (state.winner) return;
  applyAllIncome(state);
  applyCityGrowth(state);
  for (const fid of Object.keys(FACTIONS)) {
    if (fid !== 'player') playAITurn(state, fid);
  }
  checkVictory(state);
  state.turn += 1;
  renderHUD();
}

function restart() {
  state = createNewGame();
  renderHUD();
}

function costText(cost) {
  return Object.entries(cost).map(([key, value]) => `${RESOURCE_NAMES[key]} ${value}`).join(' · ');
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

window.addEventListener('resize', resize);
endTurnBtn.addEventListener('click', endTurn);
restartBtn.addEventListener('click', restart);

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
