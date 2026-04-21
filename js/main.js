import { drawMap, isPathTile } from './map.js';
import { WaveScheduler } from './wave.js';
import { Enemy } from './enemy.js';
import { Economy } from './economy.js';
import { Unit } from './unit.js';
import { attachCanvasClick, buildUnitMenu } from './input.js';
import { setScene, getScene, onSceneChange } from './scene.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const menuEl = document.getElementById('menu');
const icebergScene = document.getElementById('iceberg-scene');
const levelScene = document.getElementById('level-scene');
const endOverlay = document.getElementById('end-overlay');
const endText = document.getElementById('end-text');
const backBtn = document.getElementById('back-to-iceberg');

const [levels, enemiesData, unitsData] = await Promise.all([
  fetch('data/levels.json').then(r => r.json()),
  fetch('data/enemies.json').then(r => r.json()),
  fetch('data/units.json').then(r => r.json())
]);

// ----- Level state (re-initialized on each play) -----
let level, tile, scheduler, economy, menu, gameOver;
let enemies, units, projectiles, occupied, baseHP;
let selectedUnit = 'militia';
let clickHandler;

function startLevel(levelKey) {
  level = levels[levelKey];
  tile = level.grid.tile;
  scheduler = new WaveScheduler(level.waves);
  economy = new Economy({
    startingGold: level.startingGold,
    goldPerSecond: level.goldPerSecond
  });
  enemies = [];
  units = [];
  projectiles = [];
  occupied = new Set();
  baseHP = level.baseHP;
  gameOver = null;

  menu = buildUnitMenu(menuEl, unitsData, (key) => {
    selectedUnit = key;
    menu.setSelected(key);
  });
  menu.setSelected(selectedUnit);

  if (clickHandler) canvas.removeEventListener('click', clickHandler);
  clickHandler = (ev) => {
    const rect = canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    const col = Math.floor(x / tile);
    const row = Math.floor(y / tile);
    handleTileClick(col, row);
  };
  canvas.addEventListener('click', clickHandler);

  endOverlay.hidden = true;
}

function handleTileClick(col, row) {
  if (gameOver) return;
  if (col < 0 || row < 0 || col >= level.grid.cols || row >= level.grid.rows) return;
  if (isPathTile(col, row, level.path)) return;
  const key = `${col},${row}`;
  if (occupied.has(key)) return;
  const cfg = unitsData[selectedUnit];
  if (!economy.spend(cfg.cost)) return;
  occupied.add(key);
  units.push(new Unit(selectedUnit, cfg, col, row, tile));
}

// ----- Iceberg scene wiring -----
document.querySelectorAll('#iceberg .layer').forEach((el) => {
  el.addEventListener('click', () => {
    if (el.dataset.unlocked !== 'true') return;
    setScene('level');
    startLevel('hopeLayer');
  });
});

backBtn.addEventListener('click', () => {
  setScene('iceberg');
});

onSceneChange((name) => {
  icebergScene.hidden = name !== 'iceberg';
  levelScene.hidden = name !== 'level';
});
icebergScene.hidden = false;
levelScene.hidden = true;

// ----- Main loop (always running; pauses logic when not in level scene) -----
let lastT = 0;
function loop(t) {
  const dt = Math.min((t - lastT) / 1000, 0.1);
  lastT = t;

  if (getScene() === 'level' && level) {
    if (!gameOver) stepLevel(dt);
    render();
  }

  requestAnimationFrame(loop);
}

function stepLevel(dt) {
  economy.tick(dt);

  const toSpawn = scheduler.tick(dt);
  for (const type of toSpawn) {
    enemies.push(new Enemy(type, enemiesData[type], level));
  }

  for (const u of units) {
    u.update(dt, enemies, (p) => projectiles.push(p));
  }

  for (let i = projectiles.length - 1; i >= 0; i--) {
    const status = projectiles[i].update(dt);
    if (status !== 'flying') projectiles.splice(i, 1);
  }

  for (let i = enemies.length - 1; i >= 0; i--) {
    if (!enemies[i].alive) {
      economy.addBounty(enemies[i].bounty);
      enemies.splice(i, 1);
      continue;
    }
    const status = enemies[i].update(dt);
    if (status === 'reached-base') {
      baseHP = Math.max(0, baseHP - 1);
      enemies.splice(i, 1);
    }
  }

  if (baseHP <= 0) endGame('lose');
  else if (scheduler.isComplete() && enemies.length === 0) endGame('win');
}

function endGame(result) {
  gameOver = result;
  endText.textContent = result === 'win' ? '胜利！' : '失败';
  endText.style.color = result === 'win' ? '#ffeb6b' : '#ff6b6b';
  endOverlay.hidden = false;
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawMap(ctx, level);
  for (const u of units) u.draw(ctx);
  for (const e of enemies) e.draw(ctx);
  for (const p of projectiles) p.draw(ctx);

  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, canvas.width, 28);
  ctx.fillStyle = '#fff';
  ctx.font = '14px sans-serif';
  ctx.fillText(`金币 ${economy.gold}`, 10, 19);
  ctx.fillText(`基地 ${baseHP}/${level.baseHP}`, 120, 19);
  ctx.fillText(`波次 ${scheduler.currentWaveIndex + 1}/${scheduler.totalWaves}`, 240, 19);
  ctx.fillText(`${level.name}`, 680, 19);

  menu.setAffordable((cost) => economy.gold >= cost);
}

requestAnimationFrame(loop);
