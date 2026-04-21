import { loadSprites } from './assets.js';
import { Economy } from './economy.js';
import { Flag } from './flag.js';
import { Unit } from './unit.js';
import { Defense } from './defense.js';
import { Building } from './building.js';
import { EnemyAI } from './ai.js';
import { buildUnitMenu, buildBuildingMenu, updateHud, updateStatus, showToast, showEnd, hideEnd } from './hud.js';
import { attachCanvasInput, attachMinimap, updateMinimapUnits } from './input.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const field = document.getElementById('field');
const minimapSvg = document.getElementById('minimap-svg');
const minimapViewport = document.getElementById('minimap-viewport');
const minimapUnitGroup = document.getElementById('minimap-units');
const muteBtn = document.getElementById('hud-mute');
const restartBtn = document.getElementById('btn-restart');
const menuUnitsList = document.getElementById('menu-units-list');
const menuBuildingsList = document.getElementById('menu-buildings-list');

const STRUCTURE_MAX = 10;
const DEFENSE_KINDS = new Set(['turret', 'cannon']);

let level, unitsData, buildingsData, aiData, sprites;

const battlefield = {
  units: [],
  defenses: [],
  buildings: [],
  projectiles: [],
  flags: { ally: null, enemy: null },
  playerEconomy: null,
  enemyEconomy: null,

  flagOf(team) { return this.flags[team]; },

  combatTargets(myTeam) {
    const enemyTeam = myTeam === 'ally' ? 'enemy' : 'ally';
    const list = [];
    for (const u of this.units) if (u.team === enemyTeam && u.hp > 0) list.push(u);
    for (const d of this.defenses) if (d.team === enemyTeam && d.hp > 0) list.push(d);
    for (const b of this.buildings) if (b.team === enemyTeam && b.hp > 0) list.push(b);
    return list;
  },

  allEntities() {
    return [...this.units, ...this.defenses, ...this.buildings];
  },

  spawnProjectile(p) { this.projectiles.push(p); },

  creditBounty(team, amount) {
    if (team === 'ally') this.playerEconomy.addBounty(amount);
    else this.enemyEconomy.addBounty(amount);
  }
};

let selection = null;        // { kind: 'unit'|'building', key: string }
let unitMenu, bldgMenu;
let ai;
let gameOver = null;
let elapsed = 0;

// ---------- Init ----------
async function init() {
  [level, unitsData, buildingsData, aiData, sprites] = await Promise.all([
    fetch('data/level.json').then(r => r.json()),
    fetch('data/units.json').then(r => r.json()),
    fetch('data/buildings.json').then(r => r.json()),
    fetch('data/ai.json').then(r => r.json()),
    loadSprites()
  ]);

  resetLevel();

  unitMenu = buildUnitMenu(menuUnitsList, unitsData, handleMenuSelect);
  bldgMenu = buildBuildingMenu(menuBuildingsList, buildingsData, handleMenuSelect);

  attachCanvasInput(canvas, field, {
    onClick: handleCanvasClick,
    onHover: handleCanvasHover,
    onLeave: () => { hoverPos = null; }
  });
  attachMinimap(field, minimapSvg, minimapViewport);

  muteBtn.addEventListener('click', () => {
    // Simple audio mute placeholder for v2 (no audio yet)
    muteBtn.textContent = muteBtn.textContent === '🔊' ? '🔇' : '🔊';
  });
  restartBtn.addEventListener('click', () => {
    resetLevel();
    hideEnd();
  });

  // Initial scroll so we see the action
  setTimeout(() => { field.scrollLeft = 0; }, 0);
  requestAnimationFrame(loop);
}

function resetLevel() {
  battlefield.units.length = 0;
  battlefield.defenses.length = 0;
  battlefield.buildings.length = 0;
  battlefield.projectiles.length = 0;

  battlefield.flags.ally  = new Flag({ ...level.flags.ally,  team: 'ally' });
  battlefield.flags.enemy = new Flag({ ...level.flags.enemy, team: 'enemy' });

  battlefield.playerEconomy = new Economy({ startingGold: level.startingGold, goldPerSecond: 0 });
  battlefield.enemyEconomy  = new Economy({ startingGold: level.enemyStartingGold, goldPerSecond: aiData.goldPerSecond });

  // Pre-placed demo structures
  for (const p of level.preplaced) {
    const cfg = buildingsData[p.kind];
    if (!cfg) continue;
    if (DEFENSE_KINDS.has(p.kind)) {
      battlefield.defenses.push(new Defense({ typeKey: p.kind, config: cfg, x: p.x, y: p.y, team: p.owner }));
    } else {
      battlefield.buildings.push(new Building({ typeKey: p.kind, config: cfg, x: p.x, y: p.y, team: p.owner }));
    }
  }

  ai = new EnemyAI({
    config: aiData,
    economy: battlefield.enemyEconomy,
    onSpawn: (type) => spawnUnit(type, 'enemy')
  });

  selection = { kind: 'unit', key: 'militia' };
  gameOver = null;
  elapsed = 0;
}

// ---------- Placement & spawning ----------
function spawnUnit(typeKey, team) {
  const cfg = unitsData[typeKey];
  if (!cfg) return;
  battlefield.units.push(new Unit({
    typeKey, config: cfg, team,
    path: level.path,
    sprite: sprites.units[cfg.sprite]
  }));
}

function placeStructure(typeKey, team, x, y) {
  const cfg = buildingsData[typeKey];
  if (!cfg) return false;
  if (DEFENSE_KINDS.has(typeKey)) {
    battlefield.defenses.push(new Defense({ typeKey, config: cfg, x, y, team }));
  } else {
    battlefield.buildings.push(new Building({ typeKey, config: cfg, x, y, team }));
  }
  return true;
}

function handleMenuSelect(kind, key) {
  selection = { kind, key };
  unitMenu.setSelected(kind === 'unit' ? key : null);
  bldgMenu.setSelected(kind === 'building' ? key : null);
}

let hoverPos = null;

function handleCanvasHover(x, y) {
  hoverPos = { x, y };
}

function handleCanvasClick(x, y) {
  if (gameOver) return;
  if (!selection) { showToast('先选一个兵种或建筑'); return; }

  if (selection.kind === 'unit') {
    // Units spawn AT the ally flag (not at click point).
    // Clicking just triggers the spawn if affordable.
    const cfg = unitsData[selection.key];
    if (!cfg) return;
    if (!battlefield.playerEconomy.spend(cfg.cost)) {
      showToast('金币不够');
      return;
    }
    spawnUnit(selection.key, 'ally');
  } else {
    // Building placement: must be in ally zone, not too close to other structures
    const cfg = buildingsData[selection.key];
    if (!cfg) return;
    const z = level.zones.ally;
    if (x < z.x1 + 40 || x > z.x2 - 20) {
      showToast('只能放在我方区域（地图左侧）');
      return;
    }
    if (tooCloseToStructure(x, y)) {
      showToast('此处已有建筑，换个位置');
      return;
    }
    if (structureCount() >= STRUCTURE_MAX) {
      showToast(`建筑已达上限 ${STRUCTURE_MAX}`);
      return;
    }
    if (!battlefield.playerEconomy.spend(cfg.cost)) {
      showToast('金币不够');
      return;
    }
    placeStructure(selection.key, 'ally', x, y);
  }
}

function tooCloseToStructure(x, y) {
  const minDist = 42;
  for (const s of [...battlefield.defenses, ...battlefield.buildings]) {
    if (s.team !== 'ally') continue;
    if (Math.hypot(s.x - x, s.y - y) < minDist) return true;
  }
  return false;
}

function structureCount() {
  return battlefield.defenses.filter(d => d.team === 'ally').length +
         battlefield.buildings.filter(b => b.team === 'ally').length;
}

// ---------- Game loop ----------
let lastT = 0;
function loop(t) {
  const dt = Math.min((t - lastT) / 1000, 0.1);
  lastT = t;

  if (!gameOver) {
    step(dt);
    elapsed += dt;
  }
  render();
  requestAnimationFrame(loop);
}

function step(dt) {
  battlefield.playerEconomy.tick(dt);
  battlefield.enemyEconomy.tick(dt);

  ai.tick(dt);

  for (const u of battlefield.units) u.update(dt, battlefield);
  for (const d of battlefield.defenses) d.update(dt, battlefield);
  for (const b of battlefield.buildings) b.update(dt, battlefield);
  battlefield.flags.ally.tick(dt);
  battlefield.flags.enemy.tick(dt);

  // Projectiles
  for (let i = battlefield.projectiles.length - 1; i >= 0; i--) {
    const p = battlefield.projectiles[i];
    const status = p.update(dt, battlefield.allEntities().concat([battlefield.flags.ally, battlefield.flags.enemy]));
    if (status !== 'flying') battlefield.projectiles.splice(i, 1);
  }

  // Units attacking the flag: tick flag damage directly (since projectiles to a flag work via target.hp)
  // The projectile system already handles flag HP via applyDamage on the target.
  // Flags that reach 0 HP → game over.

  // Cleanup dead units + award bounty
  for (let i = battlefield.units.length - 1; i >= 0; i--) {
    const u = battlefield.units[i];
    if (!u.alive) {
      const bountyTo = u.team === 'ally' ? 'enemy' : 'ally';
      battlefield.creditBounty(bountyTo, u.bounty);
      battlefield.units.splice(i, 1);
    }
  }
  // Cleanup dead structures (no bounty for structures for now)
  battlefield.defenses = battlefield.defenses.filter(d => d.alive);
  battlefield.buildings = battlefield.buildings.filter(b => b.alive);

  // Win/lose
  if (!battlefield.flags.ally.alive) { gameOver = 'lose'; showEnd('lose'); }
  else if (!battlefield.flags.enemy.alive) { gameOver = 'win'; showEnd('win'); }
}

// ---------- Render ----------
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw buildings (bottom), defenses, then units, then projectiles
  for (const b of battlefield.buildings) b.draw(ctx);
  for (const d of battlefield.defenses) d.draw(ctx);
  for (const u of battlefield.units) u.draw(ctx);
  for (const p of battlefield.projectiles) p.draw(ctx, sprites.projectile);

  // Flags (always on top)
  drawFlag(battlefield.flags.ally, 'ally');
  drawFlag(battlefield.flags.enemy, 'enemy');

  // Hover placement preview
  if (hoverPos && selection?.kind === 'building' && !gameOver) {
    const valid = isValidPlacement(hoverPos.x, hoverPos.y);
    ctx.fillStyle = valid ? 'rgba(212,164,58,0.22)' : 'rgba(220,60,60,0.22)';
    ctx.strokeStyle = valid ? '#d4a43a' : '#c44';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(hoverPos.x, hoverPos.y, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // HUD
  const e = battlefield.playerEconomy;
  updateHud({
    gold: e.gold,
    allyFlag: battlefield.flags.ally,
    enemyFlag: battlefield.flags.enemy,
    elapsedSec: elapsed,
    protocol: aiData.name
  });
  updateStatus({
    allyCount: battlefield.units.filter(u => u.team === 'ally').length,
    enemyCount: battlefield.units.filter(u => u.team === 'enemy').length,
    structureCount: structureCount(),
    structureMax: STRUCTURE_MAX
  });

  // Menu affordability
  unitMenu.setAffordable((cost) => e.gold >= cost);
  bldgMenu.setAffordable((cost) => e.gold >= cost);

  // Minimap live markers
  updateMinimapUnits(minimapUnitGroup, [...battlefield.units, ...battlefield.defenses, ...battlefield.buildings]);
}

function isValidPlacement(x, y) {
  const z = level.zones.ally;
  if (x < z.x1 + 40 || x > z.x2 - 20) return false;
  if (tooCloseToStructure(x, y)) return false;
  if (structureCount() >= STRUCTURE_MAX) return false;
  return true;
}

function drawFlag(flag, team) {
  const color = team === 'ally' ? '#4a8ac7' : '#e14a3a';
  const pulse = flag.damageFlash > 0 ? `rgba(225,74,58,${flag.damageFlash})` : null;

  // pad outline
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(flag.x - 70, flag.y - 80, 140, 160);
  if (pulse) {
    ctx.strokeStyle = pulse;
    ctx.lineWidth = 4;
    ctx.strokeRect(flag.x - 70, flag.y - 80, 140, 160);
  }
  // pole
  ctx.fillStyle = '#b8b8b8';
  ctx.fillRect(flag.x - 2, flag.y - 100, 4, 180);
  // flag cloth
  ctx.fillStyle = color;
  ctx.beginPath();
  if (team === 'ally') {
    ctx.moveTo(flag.x + 2, flag.y - 100);
    ctx.lineTo(flag.x + 80, flag.y - 88);
    ctx.lineTo(flag.x + 2, flag.y - 76);
  } else {
    ctx.moveTo(flag.x + 2, flag.y - 100);
    ctx.lineTo(flag.x - 78, flag.y - 88);
    ctx.lineTo(flag.x + 2, flag.y - 76);
  }
  ctx.closePath();
  ctx.fill();

  // star
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px "Black Ops One", Impact, sans-serif';
  ctx.textAlign = team === 'ally' ? 'start' : 'end';
  ctx.fillText('★', flag.x + (team === 'ally' ? 18 : -18), flag.y - 84);
  ctx.textAlign = 'start';

  // label + HP
  ctx.fillStyle = color;
  ctx.font = 'bold 16px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(team === 'ally' ? '我方基地' : '敌方基地', flag.x, flag.y + 100);
  ctx.fillStyle = team === 'ally' ? '#8ebfe4' : '#f8a090';
  ctx.font = '12px "JetBrains Mono", monospace';
  ctx.fillText(`HP ${flag.hp}/${flag.maxHp}`, flag.x, flag.y + 118);
  ctx.textAlign = 'start';
}

init().catch(err => {
  console.error(err);
  document.body.innerHTML = `<div style="padding:40px; color:#e14a3a; font-family: monospace;">启动失败：${err.message}</div>`;
});
