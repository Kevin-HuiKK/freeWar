// input.js — pointer handling on SVG map + side panel buttons
import { state, isAtWar } from './state.js';
import { setHandlers, setHighlight, draw } from './map.js';
import { unitsAt, ownerUnitsAt, reachableTerritories, moveUnit, getDef, startBuild } from './unit.js';
import { showTooltip, hideTooltip, showActionBar, refreshAll, showModal, hideModal, logCombat, setHint, logEvent } from './hud.js';
import { resolveTerritoryConflict, occupyTerritory } from './turn.js';
import { activateSkill } from './skill.js';
import { isUnitUnlocked, startResearch } from './tech.js';
import { canFight } from './combat.js';
import { diploActionDeclareWar, diploActionPeace, diploActionGift } from './diplomacy.js';
import { play } from './audio.js';

export function bindAll() {
  // Wire SVG events into our logic
  setHandlers({
    onClick: onTerritoryClick,
    onRightClick: onRightClick,
    onHover: onHover,
  });

  document.getElementById('btn-end-turn').addEventListener('click', () => onEndTurn());
  document.getElementById('btn-diplo').addEventListener('click', openDiploModal);
  document.getElementById('btn-tech').addEventListener('click', openTechModal);
  document.getElementById('btn-events').addEventListener('click', openEventsModal);
  document.getElementById('modal-close').addEventListener('click', hideModal);
  document.getElementById('modal-mask').addEventListener('click', e => { if (e.target.id === 'modal-mask') hideModal(); });

  document.getElementById('skill-bar').addEventListener('click', e => {
    const ic = e.target.closest('.skill-icon');
    if (!ic || ic.classList.contains('cooling')) return;
    if (activateSkill(state.player, ic.dataset.skillId)) {
      play('skill');
      refreshAll();
      draw();
    }
  });

  document.getElementById('act-build').addEventListener('click', openBuildModal);
  document.getElementById('act-cancel').addEventListener('click', clearSelection);
  document.getElementById('btn-topmenu').addEventListener('click', () => {
    document.getElementById('main-menu').classList.remove('hidden');
  });

  // Keyboard
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (!document.getElementById('modal-mask').classList.contains('hidden')) hideModal();
      else clearSelection();
    }
    if (e.key === 'Enter') {
      if (e.target.tagName !== 'INPUT' && !document.getElementById('btn-end-turn').disabled) {
        e.preventDefault();
        onEndTurn();
      }
    }
    // Hold space to fast-forward AI turn (4x)
    if (e.code === 'Space' && !e.repeat) {
      e.preventDefault();
      window.__v3_speed = 4;
      document.body.classList.add('fast-forward');
    }
  });
  document.addEventListener('keyup', e => {
    if (e.code === 'Space') {
      window.__v3_speed = 1;
      document.body.classList.remove('fast-forward');
    }
  });
}

function onHover(t, x, y) {
  if (t) {
    showTooltip(t, x, y);
    // If a unit is selected, append action preview
    if (state.selected?.type === 'unit') {
      const u = state.units.find(x => x.uid === state.selected.id);
      if (u) {
        const reach = reachableTerritories(u);
        if (reach.has(t.id)) {
          const def = getDef(u);
          let label = '';
          if (def.domain === 'sea' && t.terrain !== 'coast' && t.terrain !== 'sea') label = '⚪ 海军不可登陆';
          else if (state.units.some(x => x.location === t.id && canFight(state.player, x.owner) && x.buildTurnsLeft === 0)) label = '🔴 进攻此处';
          else if (t.owner && t.owner !== state.player && !isAtWar(state.player, t.owner)) label = '⚪ 未交战，不可入';
          else if (t.owner && t.owner !== state.player) label = '🟡 占领空城';
          else label = '🟢 移动到此';
          // append to tooltip
          const tip = document.getElementById('tooltip');
          if (tip && !tip.classList.contains('hidden')) {
            const ext = document.createElement('div');
            ext.className = 'tooltip-action';
            ext.textContent = `点击 → ${label}`;
            tip.appendChild(ext);
          }
        } else if (u.location !== t.id) {
          const tip = document.getElementById('tooltip');
          if (tip && !tip.classList.contains('hidden')) {
            const ext = document.createElement('div');
            ext.className = 'tooltip-action gray';
            ext.textContent = '✗ 移动范围之外';
            tip.appendChild(ext);
          }
        }
      }
    }
  } else hideTooltip();
}

function onTerritoryClick(t) {
  // If a unit is already selected → try to move to t
  if (state.selected?.type === 'unit') {
    const u = state.units.find(x => x.uid === state.selected.id);
    if (!u) { clearSelection(); return; }
    if (u.location === t.id) {
      // clicking same territory cycles to next own unit there
      cycleUnit(t);
      return;
    }
    const reach = reachableTerritories(u);
    if (reach.has(t.id)) {
      attemptMove(u, t);
      // keep selection cleared after move
      return;
    }
    // not reachable → fall through to re-select on the new territory
    setHint(`「${t.name}」不在移动范围内`);
  }

  // Select unit on this territory if any (filter out already-moved)
  const myUnits = ownerUnitsAt(t.id, state.player).filter(u => !u.moved);
  if (myUnits.length > 0) {
    const u = myUnits[0];
    state.selected = { type: 'unit', id: u.uid };
    setHighlight(classifyReach(u));
    showActionBar(t.owner === state.player);
    setHint(`已选: ${getDef(u).name} · 🟢移动 🔴进攻 🟡占领 ⚪不可入 · 右键切换`, true);
    play('select');
  } else {
    state.selected = { type: 'territory', id: t.id };
    setHighlight([]);
    showActionBar(t.owner === state.player);
    if (t.owner === state.player) {
      setHint(`「${t.name}」(我方) · 可点"造兵"`);
    } else {
      setHint(`「${t.name}」属于 ${state.nations[t.owner]?.name || '无主'}${isAtWar(state.player, t.owner) ? ' [交战中]' : ''}`);
    }
  }
  draw();
}

function cycleUnit(t) {
  const myUnits = ownerUnitsAt(t.id, state.player).filter(u => !u.moved);
  if (myUnits.length === 0) return;
  const idx = myUnits.findIndex(u => u.uid === state.selected.id);
  const next = myUnits[(idx + 1) % myUnits.length];
  state.selected = { type: 'unit', id: next.uid };
  setHighlight(classifyReach(next));
  setHint(`已选: ${getDef(next).name} · 🟢=可移动 🔴=进攻 🟡=占领 ⚪=不可入`);
  play('select');
  draw();
}

// Build a map of reachable territory id -> action kind
function classifyReach(unit) {
  const map = {};
  const reach = reachableTerritories(unit);
  const def = getDef(unit);
  for (const tid of reach) {
    const t = state.territoriesById[tid];
    if (!t) continue;
    // domain check (sea unit can't land inland)
    if (def.domain === 'sea' && t.terrain !== 'coast' && t.terrain !== 'sea') {
      map[tid] = 'blocked';
      continue;
    }
    const hasHostile = state.units.some(x => x.location === tid && canFight(state.player, x.owner) && x.buildTurnsLeft === 0);
    if (hasHostile) {
      map[tid] = 'attack';
    } else if (t.owner && t.owner !== state.player && !isAtWar(state.player, t.owner)) {
      map[tid] = 'blocked';     // peaceful nation, can't enter
    } else if (t.owner && t.owner !== state.player) {
      map[tid] = 'capture';     // enemy territory empty
    } else {
      map[tid] = 'move';
    }
  }
  return map;
}

function onRightClick(t /* may be null */) {
  // Always do something useful:
  // 1) If selected unit + clicked own territory → cycle to next
  // 2) Otherwise → clear selection (with feedback)
  if (state.selected?.type === 'unit' && t) {
    const u = state.units.find(x => x.uid === state.selected.id);
    if (u && u.location === t.id) {
      cycleUnit(t);
      return;
    }
  }
  if (state.selected) {
    setHint('已取消选择');
    clearSelection();
  } else if (t) {
    setHint(`「${t.name}」 [${state.nations[t.owner]?.name || '无主'}]`);
  }
}

async function attemptMove(unit, target) {
  const def = getDef(unit);
  if (def.domain === 'sea' && target.terrain !== 'coast' && target.terrain !== 'sea') {
    setHint(`✗ ${def.name}无法登陆 ${target.name}（海军只能停海岸）`);
    play('blocked');
    return;
  }
  // Foreign territory? Need war declared.
  if (target.owner && target.owner !== state.player && !isAtWar(state.player, target.owner)) {
    setHint(`✗ 与${state.nations[target.owner].name}没有交战，无法进入「${target.name}」（外交→宣战）`);
    play('blocked');
    return;
  }
  const hostile = state.units.filter(x => x.location === target.id && canFight(state.player, x.owner) && x.buildTurnsLeft === 0);
  moveUnit(unit, target.id);
  play('move');
  if (hostile.length > 0) {
    setHint(`⚔ 在「${target.name}」交战中…`);
    play('battle');
    resolveTerritoryConflict(target.id, state.player);   // FX is spawned inside
  } else if (target.owner !== state.player && (target.owner == null || isAtWar(state.player, target.owner))) {
    occupyTerritory(target, state.player);
    play('capture');
    setHint(`✓ 占领「${target.name}」`);
  } else {
    setHint(`✓ 移动到「${target.name}」`);
  }
  state.selected = null;
  setHighlight([]);
  showActionBar(false);
  refreshAll();
  draw();
}

function clearSelection() {
  state.selected = null;
  setHighlight([]);
  showActionBar(false);
  draw();
}

function onEndTurn() {
  document.getElementById('btn-end-turn').disabled = true;
  document.getElementById('btn-end-turn').textContent = 'AI回合中…';
  setHint('AI 各国行动中…');
  play('endturn');
  setTimeout(() => {
    import('./turn.js').then(({ endPlayerTurn }) => {
      endPlayerTurn().then(() => {
        document.getElementById('btn-end-turn').disabled = false;
        document.getElementById('btn-end-turn').textContent = '结束回合';
        clearSelection();
        setHint(`第 ${state.turn} 回合开始 · 你的行动`);
      });
    });
  }, 220);
}

// === MODALS ===
function openBuildModal() {
  if (!state.selected || state.selected.type !== 'territory') {
    setHint('需先选择我方领土');
    return;
  }
  const t = state.territoriesById[state.selected.id];
  if (t.owner !== state.player) return;
  const me = state.nations[state.player];
  const cards = state.unitDefs
    .filter(d => !d.spawnOnly)
    .filter(d => isUnitUnlocked(state.player, d))
    .map(d => {
      const okGold = me.gold >= d.gold;
      const okFood = me.food >= d.food;
      const okOil  = me.oil  >= d.oil;
      const domainOk = d.domain === 'sea' ? (t.terrain === 'coast' || t.terrain === 'sea')
                     : d.domain === 'air' ? t.isCapital
                     : true;
      const ok = okGold && okFood && okOil && domainOk;
      return `<div class="unit-card ${ok ? '' : 'disabled'}" data-id="${d.id}" data-lv="${d.level}">
        <div class="uc-row1"><span class="uc-emoji">${d.icon}</span><span>${d.name} <small>Lv${d.level}</small></span></div>
        <div class="uc-stats">
          <span>HP ${d.hp}</span><span>ATK ${d.atk}</span><span>DEF ${d.def}</span>
          <span>MOV ${d.mov}</span><span>RNG ${d.range}</span>
        </div>
        <div class="uc-cost">💰${d.gold} 🌾${d.food} 🛢${d.oil} ⏳${d.build}回合</div>
        <div class="uc-ability">${d.ability}</div>
        ${!domainOk ? '<div style="color:var(--red);font-size:11px">此地形不可造</div>' : ''}
        ${!okGold ? '<div style="color:var(--red);font-size:11px">金币不足</div>' : ''}
      </div>`;
    }).join('');
  showModal(`<h2>在「${t.name}」造兵</h2>
    <p>资源: 💰${me.gold} 🌾${me.food} 🛢${me.oil}</p>
    <div class="unit-pick">${cards}</div>`);
  document.querySelector('.unit-pick').addEventListener('click', e => {
    const card = e.target.closest('.unit-card');
    if (!card || card.classList.contains('disabled')) return;
    const id = card.dataset.id;
    const lv = +card.dataset.lv;
    const d = state.unitDefById[`${id}_${lv}`];
    me.gold -= d.gold; me.food -= d.food; me.oil -= d.oil;
    startBuild(id, lv, state.player, t.id);
    play('build');
    logEvent('event', '🔨', `在「${t.name}」开始建造 ${d.name}（${d.build}回合）`);
    hideModal();
    refreshAll();
    draw();
  });
}

function openDiploModal() {
  const me = state.player;
  const rows = Object.keys(state.nations).filter(id => id !== me).map(id => {
    const n = state.nations[id];
    if (n.defeated) return '';
    const rel = state.diplomacy[me][id] ?? 50;
    const war = isAtWar(me, id);
    const buttons = war
      ? `<button data-act="peace" data-id="${id}">求和</button>`
      : `<button data-act="war" data-id="${id}">宣战</button>
         <button data-act="gift50" data-id="${id}">送礼50💰</button>`;
    return `<div class="tech-item">
      <div class="ti-icon" style="color:${n.color}">●</div>
      <div class="ti-body">
        <div class="ti-name">${n.name}</div>
        <div class="ti-desc">关系: ${war ? '<b style="color:var(--red)">交战中</b>' : rel}</div>
      </div>
      <div class="diplo-action">${buttons}</div>
    </div>`;
  }).join('');
  showModal(`<h2>外交</h2><div class="tech-list">${rows}</div>`);
  document.querySelector('#modal-content .tech-list').addEventListener('click', e => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    const id = b.dataset.id;
    if (act === 'war') diploActionDeclareWar(me, id);
    if (act === 'peace') diploActionPeace(me, id);
    if (act === 'gift50') diploActionGift(me, id, 50);
    refreshAll();
    openDiploModal();
  });
}

function openTechModal() {
  const me = state.nations[state.player];
  const rows = state.techDefs.map(t => {
    const done = me.researched.has(t.id);
    const cur = me.researching === t.id;
    const progress = cur ? Math.min(100, Math.round(me.techProgress / t.cost * 100)) : 0;
    const action = done ? '<b>已完成</b>' :
                   cur ? `<b>研究中 ${progress}%</b>` :
                   `<button data-id="${t.id}">研究</button>`;
    return `<div class="tech-item ${done ? 'done' : ''} ${cur ? 'researching' : ''}">
      <div class="ti-icon">${t.icon}</div>
      <div class="ti-body">
        <div class="ti-name">${t.name} <small>(${t.cost} 科技)</small></div>
        <div class="ti-desc">${t.desc}</div>
        ${cur ? `<div class="ti-progress"><div style="width:${progress}%"></div></div>` : ''}
      </div>
      <div>${action}</div>
    </div>`;
  }).join('');
  showModal(`<h2>科技树</h2>
    <p>当前科技点: ${me.tech} · 每回合自动累积</p>
    <div class="tech-list">${rows}</div>`);
  document.querySelector('#modal-content .tech-list').addEventListener('click', e => {
    const b = e.target.closest('button[data-id]');
    if (!b) return;
    startResearch(state.player, b.dataset.id);
    play('skill');
    openTechModal();
    refreshAll();
  });
}

function openEventsModal() {
  const rows = state.log.slice().reverse().map(e =>
    `<div class="event-item ${e.kind || ''}"><div class="event-icon">${e.icon}</div>
      <div class="event-body"><div class="event-title">${e.title}</div><div class="event-when">${e.when}</div></div></div>`
  ).join('');
  showModal(`<h2>所有事件</h2><div>${rows || '<p>暂无事件</p>'}</div>`);
}
