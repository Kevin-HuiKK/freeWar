// input.js — RTS-style command system
//   左键 = 选 (select)
//   右键 = 命令 (command: move/attack/capture)
//   ESC / 左键无单位领土 = 取消
import { state, isAtWar } from './state.js';
import { setHandlers, setHighlight, draw } from './map.js';
import { ownerUnitsAt, reachableTerritories, moveUnit, getDef, startBuild } from './unit.js';
import { showTooltip, hideTooltip, showActionBar, refreshAll, showModal, hideModal, logCombat, setHint, logEvent, refreshSelectionPanel } from './hud.js';
import { resolveTerritoryConflict, occupyTerritory } from './turn.js';
import { activateSkill } from './skill.js';
import { isUnitUnlocked, startResearch } from './tech.js';
import { canFight } from './combat.js';
import { diploActionDeclareWar, diploActionPeace, diploActionGift } from './diplomacy.js';
import { play } from './audio.js';

export function bindAll() {
  setHandlers({
    onClick: onLeftClick,
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
    if (e.code === 'Space' && !e.repeat) {
      e.preventDefault();
      window.__v3_speed = 4;
      document.body.classList.add('fast-forward');
    }
    // 'A' = select all my units in current territory; 'B' = build (when on own territory)
    if (e.key.toLowerCase() === 'b') {
      if (state.selected?.tid) {
        const t = state.territoriesById[state.selected.tid];
        if (t && t.owner === state.player) openBuildModal();
      }
    }
  });
  document.addEventListener('keyup', e => {
    if (e.code === 'Space') {
      window.__v3_speed = 1;
      document.body.classList.remove('fast-forward');
    }
  });

  // Side panel: clicking a unit chip toggles it in selection
  const panel = document.getElementById('selection-panel');
  if (panel) {
    panel.addEventListener('click', e => {
      const chip = e.target.closest('.sel-unit-chip');
      if (chip) {
        const uid = +chip.dataset.uid;
        toggleUnitInSelection(uid);
      }
      const allBtn = e.target.closest('[data-act="select-all"]');
      if (allBtn) selectAllInCurrentTerritory();
      const noneBtn = e.target.closest('[data-act="select-none"]');
      if (noneBtn) clearSelection();
    });
  }
}

// =====================================================================
// SELECTION (left click)
// =====================================================================

function onLeftClick(t) {
  // Click own territory → select all my (unmoved) units there as a group
  const myUnits = ownerUnitsAt(t.id, state.player).filter(u => !u.moved);
  if (myUnits.length > 0) {
    state.selected = { type: 'group', tid: t.id, uids: myUnits.map(u => u.uid) };
    setHighlight(classifyReach(state.selected));
    showActionBar(t.owner === state.player);
    setHint(`已选 ${myUnits.length} 个单位 · 🟢移动 🔴进攻 🟡占领 ⚪不可入 · 右键目标下令`, true);
    play('select');
  } else {
    // Click territory without own unmoved units → just info, keep selection if exists
    if (!state.selected) {
      state.selected = { type: 'info', tid: t.id, uids: [] };
      setHighlight([]);
      showActionBar(t.owner === state.player);
      const owner = state.nations[t.owner];
      const warTag = owner && state.player !== t.owner && isAtWar(state.player, t.owner) ? ' [交战中]' : '';
      setHint(`「${t.name}」 [${owner?.name || '无主'}${warTag}]`);
    } else {
      // Already have a selection → keep it; just refresh hint about target
      const reach = reachForSelection(state.selected);
      if (reach.has(t.id)) {
        const cls = classifyTarget(state.selected, t);
        const labels = { move: '🟢 右键此处 = 移动', attack: '🔴 右键此处 = 进攻',
                         capture: '🟡 右键此处 = 占领', blocked: '⚪ 此处不可入' };
        setHint(labels[cls] || '');
      } else {
        setHint(`「${t.name}」不在移动范围`);
      }
    }
  }
  refreshSelectionPanel();
  draw();
}

function selectAllInCurrentTerritory() {
  if (!state.selected?.tid) return;
  const t = state.territoriesById[state.selected.tid];
  if (!t) return;
  const myUnits = ownerUnitsAt(t.id, state.player).filter(u => !u.moved);
  if (myUnits.length === 0) return;
  state.selected = { type: 'group', tid: t.id, uids: myUnits.map(u => u.uid) };
  setHighlight(classifyReach(state.selected));
  refreshSelectionPanel();
  draw();
}

function toggleUnitInSelection(uid) {
  if (!state.selected || state.selected.type !== 'group') return;
  const idx = state.selected.uids.indexOf(uid);
  if (idx >= 0) state.selected.uids.splice(idx, 1);
  else state.selected.uids.push(uid);
  if (state.selected.uids.length === 0) {
    clearSelection();
    return;
  }
  setHighlight(classifyReach(state.selected));
  refreshSelectionPanel();
  draw();
}

function clearSelection() {
  state.selected = null;
  setHighlight([]);
  showActionBar(false);
  setHint('已取消选择');
  refreshSelectionPanel();
  draw();
}

// =====================================================================
// COMMAND (right click)
// =====================================================================

async function onRightClick(t) {
  if (!t) {
    // right-click on empty area = cancel
    if (state.selected) clearSelection();
    return;
  }
  // No selection? right-click = info
  if (!state.selected || state.selected.type !== 'group' || state.selected.uids.length === 0) {
    const owner = state.nations[t.owner];
    setHint(`「${t.name}」 [${owner?.name || '无主'}]`);
    return;
  }
  // Same territory? cancel
  if (state.selected.tid === t.id) {
    clearSelection();
    return;
  }
  // Try to command movement
  await commandMove(state.selected, t);
}

async function commandMove(group, target) {
  // Filter to units that can actually reach target
  const movers = group.uids.map(uid => state.units.find(x => x.uid === uid)).filter(Boolean);
  const reaching = [];
  const blockers = [];
  for (const u of movers) {
    const def = getDef(u);
    const reach = reachableTerritories(u);
    if (!reach.has(target.id)) {
      blockers.push({ u, reason: 'range' });
      continue;
    }
    if (def.domain === 'sea' && target.terrain !== 'coast' && target.terrain !== 'sea') {
      blockers.push({ u, reason: 'sea' });
      continue;
    }
    reaching.push(u);
  }
  // Need war for non-empty enemy territory
  if (target.owner && target.owner !== state.player && !isAtWar(state.player, target.owner)) {
    setHint(`✗ 与${state.nations[target.owner].name}没有交战，无法进入「${target.name}」（左栏外交→宣战）`);
    play('blocked');
    return;
  }
  if (reaching.length === 0) {
    setHint(`✗ 选中的单位都到不了「${target.name}」`);
    play('blocked');
    return;
  }
  // Move them all
  for (const u of reaching) moveUnit(u, target.id);
  play('move');

  const hostile = state.units.filter(x => x.location === target.id && canFight(state.player, x.owner) && x.buildTurnsLeft === 0);
  if (hostile.length > 0) {
    setHint(`⚔ 在「${target.name}」交战中…`);
    play('battle');
    resolveTerritoryConflict(target.id, state.player);
  } else if (target.owner !== state.player && (target.owner == null || isAtWar(state.player, target.owner))) {
    occupyTerritory(target, state.player);
    play('capture');
    setHint(`✓ 占领「${target.name}」`);
  } else {
    setHint(`✓ ${reaching.length}个单位 移动到「${target.name}」`);
  }
  // Selection: keep only units that survived AND haven't moved... they did move so clear
  state.selected = null;
  setHighlight([]);
  showActionBar(false);
  refreshSelectionPanel();
  refreshAll();
  draw();
}

// =====================================================================
// HOVER  (live preview of what right-click will do)
// =====================================================================

function onHover(t, x, y) {
  if (!t) { hideTooltip(); return; }
  showTooltip(t, x, y);
  if (state.selected?.type === 'group' && state.selected.uids.length) {
    const cls = classifyTarget(state.selected, t);
    const tip = document.getElementById('tooltip');
    if (tip && !tip.classList.contains('hidden')) {
      const labels = {
        move:    '🟢 右键 → 移动至此',
        attack:  '🔴 右键 → 进攻此处',
        capture: '🟡 右键 → 占领此处',
        blocked: '⚪ 不可入',
        out:     '✗ 移动范围外',
      };
      const ext = document.createElement('div');
      ext.className = 'tooltip-action' + (cls === 'blocked' || cls === 'out' ? ' gray' : '');
      ext.textContent = labels[cls] || '';
      tip.appendChild(ext);
    }
  }
}

// =====================================================================
// REACH classification
// =====================================================================

function reachForSelection(sel) {
  if (!sel || sel.type !== 'group') return new Set();
  // union of reach for all units in group
  const out = new Set();
  for (const uid of sel.uids) {
    const u = state.units.find(x => x.uid === uid);
    if (!u) continue;
    for (const tid of reachableTerritories(u)) out.add(tid);
  }
  return out;
}

function classifyReach(sel) {
  if (!sel || sel.type !== 'group') return {};
  const reach = reachForSelection(sel);
  const map = {};
  // Use the first unit's domain as primary; if mixed, take the most permissive
  const units = sel.uids.map(uid => state.units.find(x => x.uid === uid)).filter(Boolean);
  for (const tid of reach) {
    const t = state.territoriesById[tid];
    if (!t) continue;
    // Some unit needs to be able to enter (domain check)
    const anyCanEnter = units.some(u => {
      const d = getDef(u);
      const reachU = reachableTerritories(u);
      if (!reachU.has(tid)) return false;
      if (d.domain === 'sea' && t.terrain !== 'coast' && t.terrain !== 'sea') return false;
      return true;
    });
    if (!anyCanEnter) { map[tid] = 'blocked'; continue; }
    const hostile = state.units.some(x => x.location === tid && canFight(state.player, x.owner) && x.buildTurnsLeft === 0);
    if (hostile) { map[tid] = 'attack'; continue; }
    if (t.owner && t.owner !== state.player && !isAtWar(state.player, t.owner)) {
      map[tid] = 'blocked'; continue;
    }
    if (t.owner && t.owner !== state.player) { map[tid] = 'capture'; continue; }
    map[tid] = 'move';
  }
  return map;
}

function classifyTarget(sel, t) {
  const map = classifyReach(sel);
  if (map[t.id]) return map[t.id];
  return 'out';
}

// =====================================================================
// END TURN
// =====================================================================

function onEndTurn() {
  document.getElementById('btn-end-turn').disabled = true;
  document.getElementById('btn-end-turn').textContent = 'AI回合中…';
  setHint('AI 各国行动中…按住空格 ×4 加速');
  play('endturn');
  setTimeout(() => {
    import('./turn.js').then(({ endPlayerTurn }) => {
      endPlayerTurn().then(() => {
        document.getElementById('btn-end-turn').disabled = false;
        document.getElementById('btn-end-turn').textContent = '结束回合';
        clearSelection();
        setHint(`第 ${state.turn} 回合开始 · 你的行动`, true);
      });
    });
  }, 220);
}

// =====================================================================
// BUILD MODAL — multi-quantity queue
// =====================================================================

function openBuildModal() {
  if (!state.selected || !state.selected.tid) {
    setHint('需先选择我方领土');
    return;
  }
  const t = state.territoriesById[state.selected.tid];
  if (t.owner !== state.player) { setHint('只能在我方领土造兵'); return; }

  // Build a stateful queue: { defKey: count }
  const queue = {};

  function totalCost() {
    let g = 0, f = 0, o = 0, n = 0;
    for (const k of Object.keys(queue)) {
      const d = state.unitDefById[k];
      g += d.gold * queue[k];
      f += d.food * queue[k];
      o += d.oil  * queue[k];
      n += queue[k];
    }
    return { g, f, o, n };
  }

  function render() {
    const me = state.nations[state.player];
    const total = totalCost();
    const okGold = me.gold >= total.g;
    const okFood = me.food >= total.f;
    const okOil  = me.oil  >= total.o;
    const cards = state.unitDefs
      .filter(d => !d.spawnOnly && isUnitUnlocked(state.player, d))
      .map(d => {
        const key = `${d.id}_${d.level}`;
        const q = queue[key] || 0;
        const domainOk = d.domain === 'sea' ? (t.terrain === 'coast' || t.terrain === 'sea')
                       : d.domain === 'air' ? t.isCapital
                       : true;
        const remGold = me.gold - total.g;
        const remFood = me.food - total.f;
        const remOil  = me.oil  - total.o;
        const canAfford = remGold >= d.gold && remFood >= d.food && remOil >= d.oil;
        const canAdd = domainOk && canAfford;
        return `<div class="unit-card ${domainOk ? '' : 'disabled'}" data-key="${key}">
          <div class="uc-row1"><span class="uc-emoji">${d.icon}</span><span>${d.name} <small>Lv${d.level}</small></span></div>
          <div class="uc-stats">
            <span>HP ${d.hp}</span><span>ATK ${d.atk}</span><span>DEF ${d.def}</span>
            <span>MOV ${d.mov}</span><span>RNG ${d.range}</span>
          </div>
          <div class="uc-cost">💰${d.gold} 🌾${d.food} 🛢${d.oil} ⏳${d.build}回合</div>
          <div class="uc-ability">${d.ability}</div>
          ${!domainOk ? '<div style="color:var(--red);font-size:11px">此地形不可造</div>' : ''}
          <div class="qty-row">
            <button class="qty-btn" data-key="${key}" data-delta="-1">−</button>
            <span class="qty-val">${q}</span>
            <button class="qty-btn ${canAdd ? '' : 'disabled'}" data-key="${key}" data-delta="+1">+</button>
          </div>
        </div>`;
      }).join('');
    showModal(`<h2>在「${t.name}」造兵</h2>
      <div class="build-status">
        <div>资源: 💰${me.gold} 🌾${me.food} 🛢${me.oil}</div>
        <div class="build-total">
          已选: ${total.n} 个单位 · 预计花费 💰${total.g} 🌾${total.f} 🛢${total.o}
        </div>
        ${(!okGold || !okFood || !okOil) ? '<div style="color:var(--red)">资源不足</div>' : ''}
      </div>
      <div class="unit-pick">${cards}</div>
      <div class="modal-actions">
        <button class="big-btn ghost" id="build-clear">清空队列</button>
        <button class="big-btn ${total.n === 0 || !okGold || !okFood || !okOil ? 'disabled' : 'primary'}"
                id="build-confirm" ${total.n === 0 || !okGold || !okFood || !okOil ? 'disabled' : ''}>
          建造 ${total.n} 个单位
        </button>
      </div>`);
    // Bind qty buttons
    document.querySelector('#modal-content .unit-pick').addEventListener('click', e => {
      const b = e.target.closest('.qty-btn');
      if (!b || b.classList.contains('disabled')) return;
      const key = b.dataset.key;
      const delta = +b.dataset.delta;
      // For + check affordability one more time
      const d = state.unitDefById[key];
      if (delta > 0) {
        const tt = totalCost();
        if (state.nations[state.player].gold - tt.g < d.gold) return;
        if (state.nations[state.player].food - tt.f < d.food) return;
        if (state.nations[state.player].oil  - tt.o < d.oil)  return;
      }
      queue[key] = Math.max(0, (queue[key] || 0) + delta);
      if (queue[key] === 0) delete queue[key];
      render();
    });
    document.getElementById('build-clear').addEventListener('click', () => {
      for (const k of Object.keys(queue)) delete queue[k];
      render();
    });
    const confirmBtn = document.getElementById('build-confirm');
    if (!confirmBtn.disabled) {
      confirmBtn.addEventListener('click', () => {
        const me = state.nations[state.player];
        const tot = totalCost();
        me.gold -= tot.g; me.food -= tot.f; me.oil -= tot.o;
        let count = 0;
        for (const key of Object.keys(queue)) {
          const [defId, lv] = key.split('_');
          for (let i = 0; i < queue[key]; i++) {
            startBuild(defId, +lv, state.player, t.id);
            count++;
          }
        }
        play('build');
        logEvent('event', '🔨', `在「${t.name}」开始建造 ${count} 个单位`);
        hideModal();
        refreshAll();
        draw();
      });
    }
  }
  render();
}

// =====================================================================
// DIPLO / TECH / EVENTS — unchanged
// =====================================================================

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
