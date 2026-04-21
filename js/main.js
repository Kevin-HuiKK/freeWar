import { drawMap } from './map.js';
import { WaveScheduler } from './wave.js';
import { Enemy } from './enemy.js';
import { Economy } from './economy.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const levels = await fetch('data/levels.json').then(r => r.json());
const enemiesData = await fetch('data/enemies.json').then(r => r.json());

const level = levels.hopeLayer;
const scheduler = new WaveScheduler(level.waves);
const enemies = [];
let baseHP = level.baseHP;
const economy = new Economy({
  startingGold: level.startingGold,
  goldPerSecond: level.goldPerSecond
});

let lastT = 0;
function loop(t) {
  const dt = Math.min((t - lastT) / 1000, 0.1);
  lastT = t;

  economy.tick(dt);

  const toSpawn = scheduler.tick(dt);
  for (const type of toSpawn) {
    enemies.push(new Enemy(type, enemiesData[type], level));
  }

  for (let i = enemies.length - 1; i >= 0; i--) {
    const status = enemies[i].update(dt);
    if (status === 'reached-base') {
      baseHP -= 1;
      enemies.splice(i, 1);
    } else if (!enemies[i].alive) {
      economy.addBounty(enemies[i].bounty);
      enemies.splice(i, 1);
    }
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawMap(ctx, level);
  for (const e of enemies) e.draw(ctx);

  ctx.fillStyle = '#fff';
  ctx.font = '16px sans-serif';
  ctx.fillText(`基地 HP: ${baseHP}`, 10, 20);
  ctx.fillText(`波次: ${scheduler.currentWaveIndex + 1}/${scheduler.totalWaves}`, 10, 40);
  ctx.fillText(`金币: ${economy.gold}`, 10, 60);

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
