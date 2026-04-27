// turn.js — turn driver, conflict resolution, season/year tick
import { state } from './state.js';
import { logEvent, logCombat, refreshAll, setHint, setAITurnBanner } from './hud.js';
import { tickResearch } from './tech.js';
import { tickSkills } from './skill.js';
import { resolveBattle, canFight } from './combat.js';
import { getDef, tickBuilds } from './unit.js';
import { spawnBattleFx, spawnDamageNumber, spawnSkull, flashUnit, draw as drawMap } from './map.js';

export async function endPlayerTurn() {
  const { runAITurn } = await import('./ai.js');
  for (const id of Object.keys(state.nations)) {
    if (id === state.player) continue;
    if (state.nations[id].defeated) continue;
    setAITurnBanner(id);
    setHint(`${state.nations[id].name} 行动中…`, true);
    await runAITurn(id);
    await new Promise(r => setTimeout(r, 400));
  }
  setAITurnBanner(null);
  advanceTurn();
}

function advanceTurn() {
  // Resource income / upkeep for all
  for (const nid of Object.keys(state.nations)) {
    const n = state.nations[nid];
    if (n.defeated) continue;
    const owned = state.territories.filter(t => t.owner === nid);
    let goldGain = 0, foodGain = 0, oilGain = 0, techGain = 0;
    for (const t of owned) {
      goldGain += t.isCapital ? 30 : 12;
      switch (t.terrain) {
        case 'plain':    foodGain += 8; break;
        case 'forest':   foodGain += 5; goldGain += 3; break;
        case 'desert':   oilGain += 4; break;
        case 'mountain': goldGain += 6; oilGain += 1; break;
        case 'coast':    goldGain += 5; foodGain += 3; break;
      }
      techGain += t.isCapital ? 5 : 1;
    }
    // stability multiplier
    const stabMult = 0.5 + (n.stability / 100) * 0.7;   // 0.5 ~ 1.2
    n.gold += Math.round(goldGain * stabMult);
    n.food += Math.round(foodGain * stabMult);
    n.oil  += Math.round(oilGain * stabMult);
    n.tech += Math.round(techGain * stabMult);
    // upkeep
    let upkeep = 0;
    for (const u of state.units) {
      if (u.owner !== nid || u.buildTurnsLeft > 0) continue;
      const d = getDef(u);
      upkeep += d.upkeep;
    }
    n.gold = Math.max(0, n.gold - upkeep);
    n.food = Math.max(0, n.food - Math.floor(upkeep / 2));
    if (n.food <= 0) {
      n.stability = Math.max(0, n.stability - 3);
    } else {
      n.stability = Math.min(100, n.stability + 1);
    }
    tickResearch(nid);
    tickSkills(nid);
    tickBuilds(nid);
    // reset moved flags
    for (const u of state.units) if (u.owner === nid) { u.moved = false; u.attacked = false; }
    // defeat check
    if (!n.defeated) {
      const cap = state.territoriesById[n.capital];
      if (cap && cap.owner !== nid) {
        n.defeated = true;
        logEvent('war', '💀', `${n.name}首都失守，覆灭！`);
      }
    }
  }
  // random event
  import('./event.js').then(m => m.drawEvent());
  // season/year
  state.season = (state.season + 1) % 4;
  if (state.season === 0) state.year++;
  state.turn++;
  // win check
  const alive = Object.values(state.nations).filter(n => !n.defeated).map(n => n.id);
  if (alive.length === 1) {
    state.ended = true;
    state.winner = alive[0];
    showEndScreen();
  } else if (state.nations[state.player].defeated) {
    state.ended = true;
    state.winner = alive.find(id => id !== state.player) || null;
    showEndScreen();
  }
  refreshAll();
  // redraw map
  import('./map.js').then(m => m.draw());
}

// Resolve battle when attacker enters territory holding defenders.
// attacker = nationId moving in. Returns { log, atkSurv, defSurv }.
// Spawns battle FX visible whether player or AI initiated.
export function resolveTerritoryConflict(territoryId, attackerNation) {
  const all = state.units.filter(u => u.location === territoryId && u.buildTurnsLeft === 0);
  const attackers = all.filter(u => u.owner === attackerNation);
  const defenders = all.filter(u => u.owner !== attackerNation && canFight(attackerNation, u.owner));
  if (defenders.length === 0) return null;
  const t = state.territoriesById[territoryId];
  const me = state.nations[attackerNation];
  const dn = state.nations[defenders[0].owner];
  const myBuff = Object.values(me.buffs || {}).reduce((s, b) => s + (b.amount || 0), 0);
  const dBuff = Object.values(dn?.buffs || {}).reduce((s, b) => s + (b.amount || 0), 0);
  const result = resolveBattle([...attackers], [...defenders], t.terrain, { atk: myBuff }, { atk: dBuff });
  const aliveIds = new Set([...result.atkSurv, ...result.defSurv].map(u => u.uid));
  state.units = state.units.filter(u => {
    if (u.location !== territoryId) return true;
    if (u.buildTurnsLeft > 0) return true;
    return aliveIds.has(u.uid);
  });
  for (const line of result.log.slice(-8)) {
    logCombat(line.text, line.side === 'atk' ? 'log-blue' : 'log-red');
  }
  // Visual battle FX (works for both player- and AI-initiated)
  spawnBattleFx(territoryId);
  flashUnit(territoryId);
  let delay = 200;
  for (const line of result.log) {
    const m = line.text.match(/-(\d+)/);
    if (m) {
      spawnDamageNumber(territoryId, m[1], line.side, delay);
      delay += 220;
    }
    if (line.text.startsWith('☠')) {
      spawnSkull(territoryId, delay);
      delay += 250;
    }
  }
  if (result.defSurv.length === 0 && result.atkSurv.length > 0) {
    const aname = state.nations[attackerNation].name;
    const dname = dn?.name || '敌军';
    if (attackerNation === state.player) {
      logEvent('battle', '⚔', `我方在${t.name}击败了${dname}`);
    } else if (defenders[0].owner === state.player) {
      logEvent('war', '💥', `${aname}在${t.name}击败了我方守军！`);
      setHint(`⚠ ${aname}在${t.name}击败了我方！`, true);
    } else {
      logEvent('battle', '⚔', `${aname}在${t.name}击败了${dname}`);
    }
    occupyTerritory(t, attackerNation);
  } else if (result.atkSurv.length === 0) {
    if (defenders[0].owner === state.player) {
      logEvent('war', '🛡', `我方在${t.name}击退了${state.nations[attackerNation].name}的进攻！`);
      setHint(`✓ 我方在${t.name}击退${state.nations[attackerNation].name}的进攻！`, true);
    } else {
      logEvent('battle', '🛡', `${state.nations[attackerNation].name}进攻${t.name}失败`);
    }
  } else {
    logEvent('battle', '⚔', `双方在${t.name}激战`);
  }
  return result;
}

export function occupyTerritory(t, newOwner) {
  if (t.owner === newOwner) return;
  const oldOwner = t.owner;
  t.owner = newOwner;
  state.nations[newOwner].stability = Math.max(0, state.nations[newOwner].stability + 2);
  if (oldOwner && state.nations[oldOwner]) {
    state.nations[oldOwner].stability = Math.max(0, state.nations[oldOwner].stability - 6);
    if (t.isCapital) {
      logEvent('war', '🏰', `${state.nations[newOwner].name}占领了${t.name}！`);
    } else {
      logEvent('war', '🏴', `${state.nations[newOwner].name}占领了${t.name}`);
    }
  }
}

function showEndScreen() {
  const winner = state.nations[state.winner];
  const youWon = state.winner === state.player;
  const html = `<h2>${youWon ? '🏆 胜利！' : '💀 失败...'}</h2>
    <p>${youWon ? '你统一了红线群岛。' : `${winner.name}主宰了群岛。`}</p>
    <p>历经 ${state.turn} 个回合 · 第 ${state.year} 年。</p>
    <button class="big-btn" onclick="location.reload()">再来一局</button>`;
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('modal-mask').classList.remove('hidden');
}
