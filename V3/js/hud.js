// hud.js — DOM updates for sidebars, topbar, modals
import { state, yearLabel, isAtWar } from './state.js';
import { unitsAt, getDef, nationArmyStrength } from './unit.js';

export function refreshAll() {
  refreshTopbar();
  refreshNationCard();
  refreshDiploList();
  refreshSkillBar();
  refreshEventLog();
  refreshCombatLog();
  refreshSelectionPanel();
}

export function refreshSelectionPanel() {
  const panel = document.getElementById('selection-panel');
  if (!panel) return;
  const sel = state.selected;
  if (!sel || sel.type !== 'group' || !sel.uids?.length) {
    panel.classList.add('hidden');
    return;
  }
  const t = state.territoriesById[sel.tid];
  const allHere = t ? state.units.filter(u => u.location === t.id && u.owner === state.player && u.buildTurnsLeft === 0) : [];
  const chips = allHere.map(u => {
    const d = getDef(u);
    const selectedC = sel.uids.includes(u.uid) ? ' selected' : '';
    const movedC = u.moved ? ' moved' : '';
    const hpPct = Math.round(u.hp / u.maxHp * 100);
    return `<div class="sel-unit-chip${selectedC}${movedC}" data-uid="${u.uid}" title="${d.name} HP ${u.hp}/${u.maxHp}${u.moved ? ' · moved' : ''}">
      <span class="sc-emoji">${d.icon}</span>
      <span class="sc-hp">${hpPct}%</span>
    </div>`;
  }).join('');
  panel.innerHTML = `
    <div class="sel-title">${t?.name || ''} (${sel.uids.length}/${allHere.length} picked)</div>
    <div class="sel-chips">${chips}</div>
    <div class="sel-actions">
      <button data-act="select-all">All</button>
      <button data-act="select-none">None</button>
    </div>
    <div class="sel-hint">Click chip = toggle · Right-click map = order</div>`;
  panel.classList.remove('hidden');
}

export function refreshTopbar() {
  const me = state.nations[state.player];
  document.getElementById('hud-year').textContent = yearLabel();
  document.getElementById('hud-gold').textContent = me.gold;
  document.getElementById('hud-food').textContent = me.food;
  document.getElementById('hud-pop').textContent  = countPopulation(me.id);
  document.getElementById('hud-tech').textContent = me.tech;
  document.getElementById('hud-oil').textContent  = me.oil;
  document.getElementById('hud-stab').textContent = me.stability + '%';
  document.getElementById('hud-stab-fill').style.width = me.stability + '%';
  document.getElementById('hud-stab-fill').style.background =
    me.stability < 30 ? 'var(--red)' : me.stability < 60 ? 'var(--food)' : 'var(--green)';
  const turnEl = document.getElementById('hud-turn');
  if (turnEl) turnEl.textContent = state.turn;
}

function countPopulation(owner) {
  // proxy: 1000 per territory + 200 per unit
  const terrCount = state.territories.filter(t => t.owner === owner).length;
  const unitCount = state.units.filter(u => u.owner === owner && u.buildTurnsLeft === 0).length;
  return terrCount * 1000 + unitCount * 200;
}

function refreshNationCard() {
  const me = state.nations[state.player];
  document.getElementById('nation-icon').textContent = me.icon;
  document.getElementById('nation-name').textContent = me.name;
  document.getElementById('nation-rank').textContent = computeRank(me.id);
  const territories = state.territories.filter(t => t.owner === me.id).length;
  document.getElementById('nation-territories').textContent = territories;
  document.getElementById('stat-pop').textContent = countPopulation(me.id);
  document.getElementById('stat-econ').textContent = me.gold;
  document.getElementById('stat-army').textContent = nationArmyStrength(me.id);
  document.getElementById('stat-tech').textContent = me.tech;
  document.getElementById('stat-stab').textContent = me.stability + '%';
}

function computeRank(playerId) {
  const ranked = Object.values(state.nations)
    .filter(n => !n.defeated)
    .map(n => ({ id: n.id, score: nationArmyStrength(n.id) + state.territories.filter(t => t.owner === n.id).length * 50 }))
    .sort((a, b) => b.score - a.score);
  return ranked.findIndex(r => r.id === playerId) + 1;
}

function refreshDiploList() {
  const list = document.getElementById('diplo-list');
  list.innerHTML = '';
  const me = state.player;
  for (const id of Object.keys(state.nations)) {
    if (id === me) continue;
    const n = state.nations[id];
    if (n.defeated) continue;
    const rel = state.diplomacy[me]?.[id] ?? 50;
    const war = isAtWar(me, id);
    const cls = war ? 'war' : (rel < 30 ? 'hostile' : rel >= 60 ? 'friendly' : 'neutral');
    const label = war ? 'WAR' : (rel < 30 ? `Hostile(${rel})` : rel >= 60 ? `Friendly(${rel})` : `Neutral(${rel})`);
    const row = document.createElement('div');
    row.className = 'diplo-row';
    row.innerHTML = `<div class="swatch" style="background:${n.color}"></div>
      <span>${n.name}</span>
      <span class="relation ${cls}">${label}</span>`;
    list.appendChild(row);
  }
}

function refreshSkillBar() {
  const bar = document.getElementById('skill-bar');
  bar.innerHTML = '';
  const me = state.nations[state.player];
  state.skillDefs.forEach(s => {
    const cd = me.skillCD[s.id] || 0;
    const div = document.createElement('div');
    div.className = 'skill-icon' + (cd > 0 ? ' cooling' : '');
    div.title = s.desc + (cd > 0 ? ` (CD ${cd} turns)` : '');
    div.dataset.skillId = s.id;
    div.innerHTML = `<div class="si-emoji">${s.icon}</div>
      <div class="si-name">${s.name}</div>
      <div class="si-cd">${cd > 0 ? `CD:${cd}t` : `CD:${s.cd}t`}</div>`;
    bar.appendChild(div);
  });
}

function refreshEventLog() {
  const list = document.getElementById('event-list');
  list.innerHTML = '';
  const recent = state.log.slice(-8).reverse();
  for (const e of recent) {
    const div = document.createElement('div');
    div.className = 'event-item ' + (e.kind || '');
    div.innerHTML = `<div class="event-icon">${e.icon}</div>
      <div class="event-body">
        <div class="event-title">${e.title}</div>
        <div class="event-when">${e.when}</div>
      </div>`;
    list.appendChild(div);
  }
}

function refreshCombatLog() {
  const div = document.getElementById('combat-log');
  div.innerHTML = '';
  const recent = state.combatLog.slice(-6);
  for (const line of recent) {
    const p = document.createElement('div');
    p.className = 'log-line ' + (line.cls || '');
    p.textContent = line.text;
    div.appendChild(p);
  }
  div.scrollTop = div.scrollHeight;
}

export function logEvent(kind, icon, title) {
  state.log.push({ kind, icon, title, when: yearLabel() });
  refreshEventLog();
}

export function logCombat(text, cls = '') {
  state.combatLog.push({ text, cls });
  if (state.combatLog.length > 60) state.combatLog.shift();
  refreshCombatLog();
}

export function showTooltip(t, mouseX, mouseY) {
  const tip = document.getElementById('tooltip');
  if (!t) { tip.classList.add('hidden'); return; }
  const nation = state.nations[t.owner];
  const us = unitsAt(t.id);
  const terr = state.terrainDefs[t.terrain] || { name: t.terrain };
  const usHtml = us.length
    ? '<div class="ttl-units">' + us.map(u => {
        const d = getDef(u);
        const owner = state.nations[u.owner];
        const hpPct = u.hp / u.maxHp * 100;
        const hpColor = hpPct > 60 ? '#4ad84a' : hpPct > 30 ? '#ffc847' : '#e85a5a';
        return `<div class="ttl-row"><span style="color:${owner?.color || '#888'}">●</span>${d.icon}${d.name}<span style="color:${hpColor}">HP ${u.hp}/${u.maxHp}</span></div>`;
      }).join('') + '</div>'
    : '';
  const warTag = nation && state.player !== t.owner && state.wars.has([state.player, t.owner].sort().join(':')) ? ' <span style="color:var(--red)">[AT WAR]</span>' : '';
  tip.innerHTML = `<h4>${t.name}${t.isCapital ? ' ♛' : ''}</h4>
    <div class="ttl-row"><span>Owner</span><span style="color:${nation?.color}">${nation?.name || 'Unclaimed'}${warTag}</span></div>
    <div class="ttl-row"><span>Terrain</span><span>${terr.name}</span></div>
    ${usHtml}
    <div class="tooltip-help">Left = pick · Right = order</div>`;
  tip.classList.remove('hidden');
  const sv = document.getElementById('map-svg');
  const rect = sv.getBoundingClientRect();
  let x = mouseX + 14, y = mouseY + 14;
  if (x + 260 > rect.right) x = mouseX - 260;
  if (y + 200 > rect.bottom) y = mouseY - 200;
  tip.style.left = x + 'px';
  tip.style.top  = y + 'px';
}

let hintTimer = 0;
export function setHint(text, sticky = false) {
  const bar = document.getElementById('hint-bar');
  if (!bar) return;
  bar.textContent = text || '';
  bar.classList.toggle('hidden', !text);
  clearTimeout(hintTimer);
  if (text && !sticky) {
    hintTimer = setTimeout(() => bar.classList.add('hidden'), 4500);
  }
}

export function setAITurnBanner(nationId) {
  let banner = document.getElementById('ai-turn-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'ai-turn-banner';
    document.getElementById('map-area').appendChild(banner);
  }
  if (!nationId) {
    banner.classList.add('hidden');
    return;
  }
  const n = state.nations[nationId];
  if (!n) return;
  banner.classList.remove('hidden');
  banner.style.borderColor = n.color;
  banner.style.boxShadow = `0 0 24px ${n.color}, inset 0 0 12px rgba(0,0,0,0.5)`;
  banner.innerHTML = `
    <div class="ai-banner-flag" style="background:${n.color}">${n.icon || '⚔'}</div>
    <div class="ai-banner-body">
      <div class="ai-banner-name" style="color:${n.color}">${n.name}</div>
      <div class="ai-banner-sub">taking their turn…</div>
    </div>`;
}

export function hideTooltip() {
  document.getElementById('tooltip').classList.add('hidden');
}

export function showActionBar(visible) {
  document.getElementById('action-bar').classList.toggle('hidden', !visible);
}

export function showModal(html) {
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('modal-mask').classList.remove('hidden');
}

export function hideModal() {
  document.getElementById('modal-mask').classList.add('hidden');
}
