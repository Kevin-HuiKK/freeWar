import { loadSprites } from './assets.js';
import { Economy } from './economy.js';
import { Flag } from './flag.js';
import { Unit } from './unit.js';
import { Hero } from './hero.js';
import { Defense } from './defense.js';
import { Building } from './building.js';
import { EnemyAI } from './ai.js';
import { AudioSystem } from './audio.js';
import { applyAoeDamage } from './combat.js';
import {
  buildUnitMenu, buildBuildingMenu, buildHeroMenu,
  showActiveHero, hideActiveHero, updateHeroPanel, setSkillTargetingMode,
  updateHud, updateStatus, showToast, showEnd, hideEnd
} from './hud.js';
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
const menuHeroesList = document.getElementById('menu-heroes-list');
const skillBtn = document.getElementById('skill-btn');

const STRUCTURE_MAX = 10;
const DEFENSE_KINDS = new Set(['turret', 'cannon']);

const audio = new AudioSystem();

let level, unitsData, buildingsData, heroesData, aiData, sprites;

const battlefield = {
  units: [],
  defenses: [],
  buildings: [],
  projectiles: [],
  effects: [],
  pendingStrikes: [],
  flags: { ally: null, enemy: null },
  activeHero: { ally: null, enemy: null },
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

  spawnEffect(e) {
    e.age = 0;
    this.effects.push(e);
  },

  scheduleAirStrike(strike) {
    this.pendingStrikes.push({ ...strike, timeLeft: strike.delay });
  },

  creditBounty(team, amount) {
    if (team === 'ally') this.playerEconomy.addBounty(amount);
    else this.enemyEconomy.addBounty(amount);
  }
};

let selection = null;
let unitMenu, bldgMenu, heroMenu;
let ai;
let gameOver = null;
let elapsed = 0;
let hoverPos = null;
let skillTargetingMode = false;

async function init() {
  [level, unitsData, buildingsData, heroesData, aiData, sprites] = await Promise.all([
    fetch('data/level.json').then(r => r.json()),
    fetch('data/units.json').then(r => r.json()),
    fetch('data/buildings.json').then(r => r.json()),
    fetch('data/heroes.json').then(r => r.json()),
    fetch('data/ai.json').then(r => r.json()),
    loadSprites()
  ]);

  resetLevel();

  unitMenu = buildUnitMenu(menuUnitsList, unitsData, handleMenuSelect);
  bldgMenu = buildBuildingMenu(menuBuildingsList, buildingsData, handleMenuSelect);
  heroMenu = buildHeroMenu(menuHeroesList, heroesData, handleBuyHero);

  attachCanvasInput(canvas, field, {
    onClick: handleCanvasClick,
    onHover: handleCanvasHover,
    onLeave: () => { hoverPos = null; }
  });
  attachMinimap(field, minimapSvg, minimapViewport);

  // Audio — init on first user gesture (any click anywhere in app)
  document.addEventListener('click', () => {
    audio.resume();
    if (!gameOver) audio.startBgm();
  }, { once: true });

  muteBtn.textContent = audio.isMuted() ? '🔇' : '🔊';
  muteBtn.addEventListener('click', () => {
    audio.resume();
    audio.toggleMute();
    muteBtn.textContent = audio.isMuted() ? '🔇' : '🔊';
  });

  skillBtn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const hero = battlefield.activeHero.ally;
    if (!hero || !hero.alive) return;
    if (hero.skill.cooldownLeft > 0) return;
    toggleSkillTargeting(true);
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && skillTargetingMode) toggleSkillTargeting(false);
  });

  restartBtn.addEventListener('click', () => {
    resetLevel();
    hideEnd();
    audio.startBgm();
  });

  requestAnimationFrame(loop);
}

function resetLevel() {
  battlefield.units.length = 0;
  battlefield.defenses.length = 0;
  battlefield.buildings.length = 0;
  battlefield.projectiles.length = 0;
  battlefield.effects.length = 0;
  battlefield.pendingStrikes.length = 0;
  battlefield.activeHero.ally = null;
  battlefield.activeHero.enemy = null;

  battlefield.flags.ally  = new Flag({ ...level.flags.ally,  team: 'ally' });
  battlefield.flags.enemy = new Flag({ ...level.flags.enemy, team: 'enemy' });

  battlefield.playerEconomy = new Economy({ startingGold: level.startingGold, goldPerSecond: 0 });
  battlefield.enemyEconomy  = new Economy({ startingGold: level.enemyStartingGold, goldPerSecond: aiData.goldPerSecond });

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
  toggleSkillTargeting(false);
  hideActiveHero();
}

function spawnUnit(typeKey, team) {
  const cfg = unitsData[typeKey];
  if (!cfg) return;
  battlefield.units.push(new Unit({
    typeKey, config: cfg, team,
    path: level.path,
    sprite: sprites.units[cfg.sprite]
  }));
}

function spawnHero(typeKey, team) {
  const cfg = heroesData[typeKey];
  if (!cfg) return null;
  const hero = new Hero({
    typeKey, config: cfg, team,
    path: level.path,
    sprite: sprites.units[cfg.sprite]
  });
  battlefield.units.push(hero);
  battlefield.activeHero[team] = hero;
  return hero;
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
  toggleSkillTargeting(false);
}

function handleBuyHero(typeKey) {
  if (gameOver) return;
  audio.resume();
  if (battlefield.activeHero.ally && battlefield.activeHero.ally.alive) {
    showToast('场上已有一个英雄');
    audio.play('error');
    return;
  }
  const cfg = heroesData[typeKey];
  if (!cfg) return;
  if (!battlefield.playerEconomy.spend(cfg.cost)) {
    showToast('金币不够');
    audio.play('error');
    return;
  }
  const hero = spawnHero(typeKey, 'ally');
  showActiveHero(hero, cfg.skill);
  audio.play('hero');
  showToast(`英雄参战：${cfg.name}`);
}

function handleCanvasHover(x, y) {
  hoverPos = { x, y };
}

function handleCanvasClick(x, y) {
  if (gameOver) return;
  audio.resume();

  // Skill targeting mode intercepts all clicks
  if (skillTargetingMode) {
    const hero = battlefield.activeHero.ally;
    if (hero && hero.alive && hero.skill.cooldownLeft === 0) {
      const cast = hero.castSkill(x, y, battlefield);
      if (cast) {
        audio.play('skill');
        showToast(`${hero.skill.name} 已激活`);
      }
    }
    toggleSkillTargeting(false);
    return;
  }

  if (!selection) { showToast('先选一个兵种或建筑'); return; }

  if (selection.kind === 'unit') {
    const cfg = unitsData[selection.key];
    if (!cfg) return;
    if (!battlefield.playerEconomy.spend(cfg.cost)) {
      showToast('金币不够');
      audio.play('error');
      return;
    }
    spawnUnit(selection.key, 'ally');
    audio.play('place');
  } else {
    const cfg = buildingsData[selection.key];
    if (!cfg) return;
    const z = level.zones.ally;
    if (x < z.x1 + 40 || x > z.x2 - 20) {
      showToast('只能放在我方区域（地图左侧）');
      audio.play('error');
      return;
    }
    if (tooCloseToStructure(x, y)) {
      showToast('此处已有建筑，换个位置');
      audio.play('error');
      return;
    }
    if (structureCount() >= STRUCTURE_MAX) {
      showToast(`建筑已达上限 ${STRUCTURE_MAX}`);
      audio.play('error');
      return;
    }
    if (!battlefield.playerEconomy.spend(cfg.cost)) {
      showToast('金币不够');
      audio.play('error');
      return;
    }
    placeStructure(selection.key, 'ally', x, y);
    audio.play('buy');
  }
}

function toggleSkillTargeting(active) {
  skillTargetingMode = active;
  setSkillTargetingMode(active);
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
    if (status === 'hit') audio.play('hit', 50);
    else if (status === 'killed') audio.play('kill', 90);
    else if (status === 'killed-aoe') audio.play('kill', 90);
    if (status !== 'flying') battlefield.projectiles.splice(i, 1);
  }

  // Air strikes
  for (let i = battlefield.pendingStrikes.length - 1; i >= 0; i--) {
    const s = battlefield.pendingStrikes[i];
    s.timeLeft -= dt;
    if (s.timeLeft <= 0) {
      const targets = [
        ...battlefield.units, ...battlefield.defenses, ...battlefield.buildings,
        battlefield.flags.ally, battlefield.flags.enemy
      ];
      applyAoeDamage(s.x, s.y, s.radius, s.damage, targets, s.team);
      battlefield.spawnEffect({ kind: 'impact', x: s.x, y: s.y, radius: s.radius, ttl: 0.6 });
      audio.play('kill');
      battlefield.pendingStrikes.splice(i, 1);
    }
  }

  // Effects lifecycle
  for (let i = battlefield.effects.length - 1; i >= 0; i--) {
    const e = battlefield.effects[i];
    e.age += dt;
    if (e.age >= e.ttl) battlefield.effects.splice(i, 1);
  }

  // Flag damage detection (audio) — compare prev vs now HP via cached state
  const prevAlly = battlefield.flags.ally._prevHp ?? battlefield.flags.ally.hp;
  const prevEnemy = battlefield.flags.enemy._prevHp ?? battlefield.flags.enemy.hp;
  if (battlefield.flags.ally.hp < prevAlly) audio.play('flagHit', 400);
  if (battlefield.flags.enemy.hp < prevEnemy) audio.play('flagHit', 400);
  battlefield.flags.ally._prevHp = battlefield.flags.ally.hp;
  battlefield.flags.enemy._prevHp = battlefield.flags.enemy.hp;

  // Cleanup dead units + bounty
  for (let i = battlefield.units.length - 1; i >= 0; i--) {
    const u = battlefield.units[i];
    if (!u.alive) {
      if (u.isHero && battlefield.activeHero[u.team] === u) {
        battlefield.activeHero[u.team] = null;
        if (u.team === 'ally') hideActiveHero();
      }
      const bountyTo = u.team === 'ally' ? 'enemy' : 'ally';
      battlefield.creditBounty(bountyTo, u.bounty);
      battlefield.units.splice(i, 1);
    }
  }
  battlefield.defenses = battlefield.defenses.filter(d => d.alive);
  battlefield.buildings = battlefield.buildings.filter(b => b.alive);

  if (!battlefield.flags.ally.alive)  { gameOver = 'lose'; onGameEnd('lose'); }
  else if (!battlefield.flags.enemy.alive) { gameOver = 'win';  onGameEnd('win'); }
}

function onGameEnd(result) {
  audio.stopBgm();
  audio.play(result === 'win' ? 'win' : 'lose');
  showEnd(result);
  toggleSkillTargeting(false);
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Effects (under units so they look "on the ground")
  for (const e of battlefield.effects) drawEffect(e);
  for (const s of battlefield.pendingStrikes) drawStrikeMarker(s);

  for (const b of battlefield.buildings) b.draw(ctx);
  for (const d of battlefield.defenses) d.draw(ctx);
  for (const u of battlefield.units) u.draw(ctx);
  for (const p of battlefield.projectiles) p.draw(ctx, sprites.projectile);

  drawFlag(battlefield.flags.ally, 'ally');
  drawFlag(battlefield.flags.enemy, 'enemy');

  // Hover preview
  if (hoverPos && !gameOver) {
    if (skillTargetingMode) drawSkillPreview(hoverPos.x, hoverPos.y);
    else if (selection?.kind === 'building') {
      const valid = isValidPlacement(hoverPos.x, hoverPos.y);
      ctx.fillStyle = valid ? 'rgba(212,164,58,0.22)' : 'rgba(220,60,60,0.22)';
      ctx.strokeStyle = valid ? '#d4a43a' : '#c44';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(hoverPos.x, hoverPos.y, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
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

  unitMenu.setAffordable((cost) => e.gold >= cost);
  bldgMenu.setAffordable((cost) => e.gold >= cost);
  heroMenu.setAffordable((cost) => e.gold >= cost, !!(battlefield.activeHero.ally && battlefield.activeHero.ally.alive));

  if (battlefield.activeHero.ally && battlefield.activeHero.ally.alive) {
    updateHeroPanel(battlefield.activeHero.ally);
  }

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
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(flag.x - 70, flag.y - 80, 140, 160);
  if (pulse) {
    ctx.strokeStyle = pulse;
    ctx.lineWidth = 4;
    ctx.strokeRect(flag.x - 70, flag.y - 80, 140, 160);
  }
  ctx.fillStyle = '#b8b8b8';
  ctx.fillRect(flag.x - 2, flag.y - 100, 4, 180);
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
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px "Black Ops One", Impact, sans-serif';
  ctx.textAlign = team === 'ally' ? 'start' : 'end';
  ctx.fillText('★', flag.x + (team === 'ally' ? 18 : -18), flag.y - 84);
  ctx.textAlign = 'start';
  ctx.fillStyle = color;
  ctx.font = 'bold 16px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(team === 'ally' ? '我方基地' : '敌方基地', flag.x, flag.y + 100);
  ctx.fillStyle = team === 'ally' ? '#8ebfe4' : '#f8a090';
  ctx.font = '12px "JetBrains Mono", monospace';
  ctx.fillText(`HP ${flag.hp}/${flag.maxHp}`, flag.x, flag.y + 118);
  ctx.textAlign = 'start';
}

function drawEffect(e) {
  const frac = e.age / e.ttl;
  if (e.kind === 'impact') {
    const r = e.radius * (0.4 + 0.8 * frac);
    ctx.strokeStyle = `rgba(255,180,80,${1 - frac})`;
    ctx.fillStyle   = `rgba(255,180,80,${0.4 * (1 - frac)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,240,180,${1 - frac})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r * 0.55, 0, Math.PI * 2);
    ctx.stroke();
  } else if (e.kind === 'heal-aura') {
    ctx.strokeStyle = `rgba(120,255,160,${1 - frac})`;
    ctx.fillStyle   = `rgba(120,255,160,${0.2 * (1 - frac)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius * (0.8 + 0.2 * frac), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.font = 'bold 16px "JetBrains Mono", monospace';
    ctx.fillStyle = `rgba(160,255,180,${1 - frac})`;
    ctx.textAlign = 'center';
    ctx.fillText('+HP', e.x, e.y - 8 - frac * 20);
    ctx.textAlign = 'start';
  } else if (e.kind === 'airstrike-marker') {
    // Hero's strike marker is drawn via pending strikes instead
  }
}

function drawStrikeMarker(s) {
  const alpha = 0.5 + 0.4 * Math.sin(performance.now() / 120);
  ctx.strokeStyle = `rgba(225,74,58,${alpha})`;
  ctx.fillStyle = 'rgba(225,74,58,0.12)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);
  // crosshair
  ctx.strokeStyle = '#e14a3a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(s.x - 14, s.y); ctx.lineTo(s.x + 14, s.y);
  ctx.moveTo(s.x, s.y - 14); ctx.lineTo(s.x, s.y + 14);
  ctx.stroke();
  // countdown
  ctx.font = 'bold 14px "JetBrains Mono", monospace';
  ctx.fillStyle = '#ffd46a';
  ctx.textAlign = 'center';
  ctx.fillText(`${s.timeLeft.toFixed(1)}s`, s.x, s.y - s.radius - 8);
  ctx.textAlign = 'start';
}

function drawSkillPreview(x, y) {
  const hero = battlefield.activeHero.ally;
  if (!hero) return;
  const r = hero.skill.radius || 60;
  ctx.strokeStyle = '#ffd46a';
  ctx.fillStyle = 'rgba(255,212,106,0.18)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 4]);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = '#ffd46a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - r - 10, y); ctx.lineTo(x - r + 4, y);
  ctx.moveTo(x + r - 4, y);  ctx.lineTo(x + r + 10, y);
  ctx.moveTo(x, y - r - 10); ctx.lineTo(x, y - r + 4);
  ctx.moveTo(x, y + r - 4);  ctx.lineTo(x, y + r + 10);
  ctx.stroke();
}

init().catch(err => {
  console.error(err);
  document.body.innerHTML = `<div style="padding:40px; color:#e14a3a; font-family: monospace;">启动失败：${err.message}</div>`;
});
