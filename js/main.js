import { drawMap, isPathTile } from './map.js';
import { WaveScheduler } from './wave.js';
import { Enemy } from './enemy.js';
import { Economy } from './economy.js';
import { Unit } from './unit.js';
import { buildUnitMenu, attachCanvasInput, updateHud, showToast } from './input.js';
import { setScene, getScene, onSceneChange } from './scene.js';
import { loadSprites } from './assets.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const menuEl = document.getElementById('menu');
const icebergScene = document.getElementById('iceberg-scene');
const levelScene = document.getElementById('level-scene');
const endOverlay = document.getElementById('end-overlay');
const endText = document.getElementById('end-text');
const backBtn = document.getElementById('back-to-iceberg');

const [levels, enemiesData, unitsData, sprites] = await Promise.all([
  fetch('data/levels.json').then(r => r.json()),
  fetch('data/enemies.json').then(r => r.json()),
  fetch('data/units.json').then(r => r.json()),
  loadSprites()
]);

// ----- Level state -----
let level, tile, scheduler, economy, menu, gameOver;
let enemies, units, projectiles, occupied, baseHP;
let feedbacks = [];
let hoverCell = null;
let selectedUnit = 'militia';
let detachInput;

function startLevel(levelKey) {
  level = levels[levelKey];
  tile = level.grid.tile;
  canvas.width = level.grid.cols * tile;
  canvas.height = level.grid.rows * tile;
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
  feedbacks = [];
  hoverCell = null;

  menu = buildUnitMenu(menuEl, unitsData, sprites, (key) => {
    selectedUnit = key;
    menu.setSelected(key);
  });
  menu.setSelected(selectedUnit);

  if (detachInput) detachInput();
  detachInput = attachCanvasInput(canvas, tile, {
    onClick: handleTileClick,
    onHover: (col, row) => { hoverCell = { col, row }; },
    onLeave: () => { hoverCell = null; }
  });

  endOverlay.hidden = true;
}

function handleTileClick(col, row, px, py) {
  if (gameOver) return;
  const reason = validatePlacement(col, row);
  if (reason) {
    pushFeedback(px, py, reason);
    return;
  }
  const cfg = unitsData[selectedUnit];
  if (!economy.spend(cfg.cost)) {
    pushFeedback(px, py, '金币不够');
    return;
  }
  const key = `${col},${row}`;
  occupied.add(key);
  units.push(new Unit(selectedUnit, cfg, col, row, tile, sprites.units[selectedUnit]));
}

function validatePlacement(col, row) {
  if (col < 0 || row < 0 || col >= level.grid.cols || row >= level.grid.rows) return '超出地图';
  if (isPathTile(col, row, level.path, level)) return '不能放在路上';
  if (occupied.has(`${col},${row}`)) return '此格已有单位';
  if (economy.gold < unitsData[selectedUnit].cost) return '金币不够';
  return null;
}

function pushFeedback(x, y, text) {
  feedbacks.push({ x, y, text, ttl: 0.9 });
  showToast(text);
}

// ----- Iceberg scene -----
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

// ----- Main loop -----
let lastT = 0;
function loop(t) {
  const dt = Math.min((t - lastT) / 1000, 0.1);
  lastT = t;

  if (getScene() === 'level' && level) {
    if (!gameOver) stepLevel(dt);
    tickFeedbacks(dt);
    render();
  }

  requestAnimationFrame(loop);
}

function stepLevel(dt) {
  economy.tick(dt);

  const toSpawn = scheduler.tick(dt);
  for (const type of toSpawn) {
    enemies.push(new Enemy(type, enemiesData[type], level, sprites.enemies[type]));
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

function tickFeedbacks(dt) {
  for (const f of feedbacks) f.ttl -= dt;
  feedbacks = feedbacks.filter(f => f.ttl > 0);
}

function endGame(result) {
  gameOver = result;
  endText.textContent = result === 'win' ? '胜利！' : '失败';
  endText.style.color = result === 'win' ? '#ffeb6b' : '#ff6b6b';
  endOverlay.hidden = false;
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawMap(ctx, level, sprites);

  // Hover preview of placement
  if (hoverCell && !gameOver) {
    const validReason = validatePlacement(hoverCell.col, hoverCell.row);
    const x = hoverCell.col * tile;
    const y = hoverCell.row * tile;
    ctx.fillStyle = validReason
      ? 'rgba(220, 60, 60, 0.25)'
      : 'rgba(220, 200, 80, 0.25)';
    ctx.fillRect(x, y, tile, tile);
    ctx.strokeStyle = validReason ? '#c44' : '#d4c055';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, tile - 2, tile - 2);

    if (!validReason) {
      const cfg = unitsData[selectedUnit];
      ctx.strokeStyle = 'rgba(255, 220, 100, 0.3)';
      ctx.fillStyle = 'rgba(255, 220, 100, 0.06)';
      ctx.beginPath();
      ctx.arc(x + tile / 2, y + tile / 2, cfg.range * tile, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  for (const u of units) {
    const hovered = hoverCell && hoverCell.col === u.col && hoverCell.row === u.row;
    u.draw(ctx, hovered, sprites.projectile);
  }
  for (const e of enemies) e.draw(ctx);
  for (const p of projectiles) p.draw(ctx, sprites.projectile);

  // Placement feedback (red X at click position)
  for (const f of feedbacks) {
    const alpha = Math.min(1, f.ttl * 2);
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.strokeStyle = `rgba(230, 60, 60, ${alpha})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-8, -8); ctx.lineTo(8, 8);
    ctx.moveTo(8, -8); ctx.lineTo(-8, 8);
    ctx.stroke();
    ctx.restore();
  }

  updateHud({
    gold: economy.gold,
    baseHP,
    maxBaseHP: level.baseHP,
    waveIdx: scheduler.currentWaveIndex + 1,
    totalWaves: scheduler.totalWaves,
    levelName: level.name
  });
  menu.setAffordable((key) => economy.gold >= unitsData[key].cost);
}

requestAnimationFrame(loop);
