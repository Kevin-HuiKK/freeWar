import { drawMap, isPathTile } from './map.js';
import { WaveScheduler } from './wave.js';
import { Enemy } from './enemy.js';
import { Economy } from './economy.js';
import { Unit } from './unit.js';
import { attachCanvasClick, buildUnitMenu } from './input.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const menuEl = document.getElementById('menu');

const [levels, enemiesData, unitsData] = await Promise.all([
  fetch('data/levels.json').then(r => r.json()),
  fetch('data/enemies.json').then(r => r.json()),
  fetch('data/units.json').then(r => r.json())
]);

const level = levels.hopeLayer;
const tile = level.grid.tile;
const scheduler = new WaveScheduler(level.waves);
const economy = new Economy({
  startingGold: level.startingGold,
  goldPerSecond: level.goldPerSecond
});

const enemies = [];
const units = [];
const projectiles = [];
const occupied = new Set();
let baseHP = level.baseHP;
let selectedUnit = 'militia';

const menu = buildUnitMenu(menuEl, unitsData, (key) => {
  selectedUnit = key;
  menu.setSelected(key);
});
menu.setSelected(selectedUnit);

attachCanvasClick(canvas, tile, (col, row) => {
  if (col < 0 || row < 0 || col >= level.grid.cols || row >= level.grid.rows) return;
  if (isPathTile(col, row, level.path)) return;
  const key = `${col},${row}`;
  if (occupied.has(key)) return;
  const cfg = unitsData[selectedUnit];
  if (!economy.spend(cfg.cost)) return;
  occupied.add(key);
  units.push(new Unit(selectedUnit, cfg, col, row, tile));
});

let gameOver = null;
let lastT = 0;
function loop(t) {
  const dt = Math.min((t - lastT) / 1000, 0.1);
  lastT = t;

  if (!gameOver) {
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

    if (baseHP <= 0) gameOver = 'lose';
    else if (scheduler.isComplete() && enemies.length === 0) gameOver = 'win';
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawMap(ctx, level);
  for (const u of units) u.draw(ctx);
  for (const e of enemies) e.draw(ctx);
  for (const p of projectiles) p.draw(ctx);

  ctx.fillStyle = '#fff';
  ctx.font = '16px sans-serif';
  ctx.fillText(`基地 HP: ${baseHP}`, 10, 20);
  ctx.fillText(`波次: ${scheduler.currentWaveIndex + 1}/${scheduler.totalWaves}`, 10, 40);
  ctx.fillText(`金币: ${economy.gold}`, 10, 60);

  menu.setAffordable((cost) => economy.gold >= cost);

  if (gameOver) {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = gameOver === 'win' ? '#ffeb6b' : '#ff6b6b';
    ctx.font = 'bold 64px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(gameOver === 'win' ? '胜利！' : '失败', canvas.width / 2, canvas.height / 2);
    ctx.textAlign = 'left';
  }

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
