// map.js — SVG rendering of the redline-islands map
import { state } from './state.js';
import { getDef } from './unit.js';

const NS = 'http://www.w3.org/2000/svg';

let svg, layers = {};
let highlightSet = new Set();
let handlers = {};

export function setHandlers(h) { handlers = h; }

export function init() {
  svg = document.getElementById('map-svg');
  svg.setAttribute('viewBox', `0 0 ${state.mapMeta.width} ${state.mapMeta.height}`);
  buildDefs();
  layers.sea       = group('sea');
  layers.redLines  = group('red-lines');
  layers.seaLinks  = group('sea-links');
  layers.territories = group('territories');
  layers.cities    = group('cities');
  layers.units     = group('units');
  layers.fx        = group('fx');
  drawSeaBg();
  drawRedLines();
  drawSeaLinks();
  drawTerritories();
  drawCities();
  drawUnits();
  drawMinimap();
  bindEvents();
}

function group(cls) {
  const g = el('g', { class: cls });
  svg.appendChild(g);
  return g;
}

function el(name, attrs = {}, parent = null) {
  const e = document.createElementNS(NS, name);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

function buildDefs() {
  let defs = svg.querySelector('defs');
  if (!defs) defs = el('defs', {}, svg);
  defs.innerHTML = `
    <radialGradient id="sea-grad" cx="50%" cy="50%" r="80%">
      <stop offset="0%"  stop-color="#3a78a8"/>
      <stop offset="100%" stop-color="#0a2848"/>
    </radialGradient>

    <pattern id="t-plain" patternUnits="userSpaceOnUse" width="22" height="22">
      <rect width="22" height="22" fill="#a8c878"/>
      <circle cx="6"  cy="14" r="1.4" fill="#6a9a48"/>
      <circle cx="16" cy="6"  r="1.4" fill="#6a9a48"/>
      <circle cx="14" cy="18" r="1.2" fill="#88b058"/>
      <circle cx="2"  cy="2"  r="1.2" fill="#88b058"/>
    </pattern>

    <pattern id="t-forest" patternUnits="userSpaceOnUse" width="34" height="34">
      <rect width="34" height="34" fill="#3a6828"/>
      <g fill="#173a07">
        <path d="M 8 24 L 4 32 L 12 32 Z"/>
        <path d="M 8 18 L 5 24 L 11 24 Z"/>
        <rect x="7.2" y="30" width="1.6" height="3" fill="#4a2a10"/>
        <path d="M 24 16 L 20 24 L 28 24 Z"/>
        <path d="M 24 10 L 21 16 L 27 16 Z"/>
        <rect x="23.2" y="22" width="1.6" height="3" fill="#4a2a10"/>
      </g>
    </pattern>

    <pattern id="t-mountain" patternUnits="userSpaceOnUse" width="44" height="44">
      <rect width="44" height="44" fill="#9a8068"/>
      <polygon points="6 34 18 12 30 34" fill="#5a4030" stroke="#2a1818" stroke-width="0.7"/>
      <polygon points="22 36 32 18 42 36" fill="#5a4030" stroke="#2a1818" stroke-width="0.7"/>
      <polygon points="14 22 18 17 22 22 18 25" fill="#fff" opacity="0.65"/>
      <polygon points="29 25 32 21 35 25 32 27" fill="#fff" opacity="0.65"/>
    </pattern>

    <pattern id="t-desert" patternUnits="userSpaceOnUse" width="32" height="32">
      <rect width="32" height="32" fill="#e8c448"/>
      <path d="M 0 12 Q 8 8 16 12 T 32 12" stroke="#b88820" stroke-width="1.4" fill="none"/>
      <path d="M 0 22 Q 8 18 16 22 T 32 22" stroke="#b88820" stroke-width="1.4" fill="none"/>
      <circle cx="6"  cy="28" r="1" fill="#a07810"/>
      <circle cx="22" cy="6"  r="1" fill="#a07810"/>
    </pattern>

    <pattern id="t-coast" patternUnits="userSpaceOnUse" width="28" height="28">
      <rect width="28" height="28" fill="#8acab0"/>
      <path d="M 0 9  Q 7 5 14 9  T 28 9"  stroke="#fff" stroke-width="0.9" opacity="0.65" fill="none"/>
      <path d="M 0 19 Q 7 15 14 19 T 28 19" stroke="#fff" stroke-width="0.9" opacity="0.55" fill="none"/>
      <circle cx="3"  cy="24" r="0.8" fill="#d8c098"/>
      <circle cx="20" cy="14" r="0.8" fill="#d8c098"/>
    </pattern>

    <pattern id="t-fortress" patternUnits="userSpaceOnUse" width="48" height="48">
      <rect width="48" height="48" fill="#7a5a3a"/>
      <!-- castle wall blocks -->
      <g fill="#a0805a" stroke="#3a2818" stroke-width="0.6">
        <rect x="6"  y="22" width="14" height="14"/>
        <rect x="20" y="20" width="14" height="16"/>
        <rect x="6"  y="14" width="4"  height="8"/>
        <rect x="14" y="14" width="4"  height="8"/>
        <rect x="22" y="12" width="4"  height="8"/>
        <rect x="30" y="12" width="4"  height="8"/>
      </g>
      <!-- flag -->
      <line x1="40" y1="8" x2="40" y2="22" stroke="#3a2818" stroke-width="1.5"/>
      <polygon points="40 8 46 11 40 14" fill="#e85a5a"/>
    </pattern>

    <filter id="terrain-shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-opacity="0.5"/>
    </filter>

    <filter id="glow">
      <feGaussianBlur stdDeviation="2" result="g"/>
      <feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  `;
}

function drawSeaBg() {
  const w = state.mapMeta.width, h = state.mapMeta.height;
  el('rect', { width: w, height: h, fill: 'url(#sea-grad)' }, layers.sea);
  // decorative wave paths (CSS animated)
  const waves = el('g', { class: 'waves' }, layers.sea);
  for (let i = 0; i < 5; i++) {
    const y = (h / 6) * (i + 1);
    let d = `M 0 ${y}`;
    for (let x = 0; x < w; x += 70) {
      d += ` Q ${x + 17.5} ${y - 3} ${x + 35} ${y} T ${x + 70} ${y}`;
    }
    el('path', { d, stroke: '#7ab0d8', 'stroke-width': '1', fill: 'none', opacity: '0.16' }, waves);
  }
}

function drawRedLines() {
  layers.redLines.innerHTML = '';
  const drawn = new Set();
  for (const t of state.territories) {
    for (const nid of t.neighbors) {
      const k = [t.id, nid].sort().join(':');
      if (drawn.has(k)) continue;
      drawn.add(k);
      const n = state.territoriesById[nid];
      if (!n) continue;
      el('line', {
        x1: t.center[0], y1: t.center[1],
        x2: n.center[0], y2: n.center[1],
        stroke: '#d04848', 'stroke-width': '2.5', opacity: '0.85'
      }, layers.redLines);
    }
  }
}

function drawSeaLinks() {
  layers.seaLinks.innerHTML = '';
  const drawn = new Set();
  for (const t of state.territories) {
    for (const nid of (t.seaLinks || [])) {
      const k = [t.id, nid].sort().join(':');
      if (drawn.has(k)) continue;
      drawn.add(k);
      const n = state.territoriesById[nid];
      if (!n) continue;
      el('line', {
        x1: t.center[0], y1: t.center[1],
        x2: n.center[0], y2: n.center[1],
        stroke: '#8cc8e8', 'stroke-width': '2', 'stroke-dasharray': '6 6', opacity: '0.7'
      }, layers.seaLinks);
    }
  }
}

function drawTerritories() {
  layers.territories.innerHTML = '';
  for (const t of state.territories) {
    const g = el('g', { class: 'territory', 'data-id': t.id });
    layers.territories.appendChild(g);
    const d = polyToPath(t.polygon);
    el('path', { d, fill: `url(#t-${t.terrain})`, filter: 'url(#terrain-shadow)', class: 'terrain-fill' }, g);
    el('path', { d, class: 'owner-tint', 'pointer-events': 'none' }, g);
    el('path', { d, class: 'border', 'pointer-events': 'none', fill: 'none' }, g);
    setOwnerStyles(g, t);
  }
}

function setOwnerStyles(g, t) {
  const n = state.nations[t.owner];
  const tint = g.querySelector('.owner-tint');
  const border = g.querySelector('.border');
  tint.setAttribute('fill', n ? n.color : '#444');
  tint.setAttribute('opacity', '0.32');
  border.setAttribute('stroke', n ? n.color : '#444');
  border.setAttribute('stroke-width', t.isCapital ? '4' : '2');
}

function polyToPath(poly) {
  return poly.map((p, i) => (i === 0 ? 'M ' : 'L ') + p[0] + ' ' + p[1]).join(' ') + ' Z';
}

function drawCities() {
  layers.cities.innerHTML = '';
  for (const t of state.territories) {
    const [cx, cy] = t.center;
    const g = el('g', { class: 'city', transform: `translate(${cx} ${cy})`, 'pointer-events': 'none' }, layers.cities);
    const n = state.nations[t.owner];
    if (t.isCapital) {
      el('path', {
        d: 'M -16 -20 L 16 -20 L 16 5 L 0 20 L -16 5 Z',
        fill: n?.color || '#666', stroke: '#fff', 'stroke-width': '2.2'
      }, g);
      const txt = el('text', { y: '0', 'text-anchor': 'middle', 'font-size': '16', 'font-weight': 'bold', fill: '#fff', 'dominant-baseline': 'middle' }, g);
      txt.textContent = '♛';
    } else {
      // small village icon
      el('rect', { x: -9, y: -4, width: 18, height: 14, fill: n?.color || '#666', stroke: '#fff', 'stroke-width': '1.5' }, g);
      el('polygon', { points: '-11 -4 0 -14 11 -4', fill: '#3a3a3a', stroke: '#fff', 'stroke-width': '1.5' }, g);
      el('rect', { x: -2, y: 2, width: 4, height: 8, fill: '#fff' }, g);
    }
    // Name label (with stroke for legibility)
    const lbl = el('text', {
      y: 30, 'text-anchor': 'middle', 'font-size': 12,
      fill: '#fff', stroke: '#000', 'stroke-width': '3.5', 'paint-order': 'stroke',
      'font-weight': 'bold'
    }, g);
    lbl.textContent = t.name;
  }
}

function drawUnits() {
  layers.units.innerHTML = '';
  // group units by territory + owner
  const groups = {};
  for (const u of state.units) {
    if (u.buildTurnsLeft > 0) continue;
    if (!groups[u.location]) groups[u.location] = {};
    if (!groups[u.location][u.owner]) groups[u.location][u.owner] = [];
    groups[u.location][u.owner].push(u);
  }
  for (const tid of Object.keys(groups)) {
    const t = state.territoriesById[tid];
    if (!t) continue;
    const ownerIds = Object.keys(groups[tid]);
    let i = 0;
    for (const owner of ownerIds) {
      const us = groups[tid][owner];
      const strongest = pickStrongest(us);
      const def = getDef(strongest);
      const nation = state.nations[owner];
      const baseX = t.center[0];
      const baseY = t.center[1];
      const x = baseX + 30 + i * 6;
      const y = baseY - 35 + i * 4;
      const movedAll = us.every(u => u.moved);
      const cls = `unit-stack${movedAll ? ' moved' : ''}${owner === state.player ? ' mine' : ''}`;
      const g = el('g', { class: cls, transform: `translate(${x} ${y})`, 'data-uid': strongest.uid, 'data-tid': tid }, layers.units);
      // shadow circle
      el('circle', { r: 18, cx: 0, cy: 2, fill: 'rgba(0,0,0,0.4)' }, g);
      // owner halo
      el('circle', { r: 16, fill: nation?.color || '#666', stroke: '#fff', 'stroke-width': 2.5 }, g);
      // emoji  (large, distinct per type)
      const emj = el('text', { y: 6, 'text-anchor': 'middle', 'font-size': 20, 'dominant-baseline': 'central' }, g);
      emj.textContent = def.icon;
      // HP bar
      const hpRatio = strongest.hp / strongest.maxHp;
      el('rect', { x: -14, y: 14, width: 28, height: 4, fill: '#000', opacity: 0.7, rx: 1 }, g);
      el('rect', {
        x: -14, y: 14, width: 28 * hpRatio, height: 4,
        fill: hpRatio > 0.6 ? '#4ad84a' : hpRatio > 0.3 ? '#ffc847' : '#e85a5a', rx: 1
      }, g);
      // count badge if multiple types
      const totalCount = us.length;
      if (totalCount > 1) {
        el('circle', { cx: 13, cy: -12, r: 8, fill: '#fff', stroke: '#000', 'stroke-width': 1.5 }, g);
        const ct = el('text', { x: 13, y: -9, 'text-anchor': 'middle', 'font-size': 10, 'font-weight': 'bold', fill: '#000', 'dominant-baseline': 'central' }, g);
        ct.textContent = '×' + totalCount;
      }
      i++;
    }
  }
  // production indicators
  for (const u of state.units) {
    if (u.buildTurnsLeft <= 0) continue;
    const t = state.territoriesById[u.location];
    if (!t) continue;
    const def = getDef(u);
    const g = el('g', { class: 'production', transform: `translate(${t.center[0] - 28} ${t.center[1] - 25})`, 'pointer-events': 'none' }, layers.units);
    el('rect', { x: -14, y: -10, width: 28, height: 20, rx: 4, fill: 'rgba(0,0,0,0.8)', stroke: '#fff', 'stroke-width': 1.2 }, g);
    const tx = el('text', { y: 5, 'text-anchor': 'middle', 'font-size': 11, fill: '#fff', 'dominant-baseline': 'central' }, g);
    tx.textContent = `🔨${u.buildTurnsLeft}`;
    const tx2 = el('text', { y: -3, 'text-anchor': 'middle', 'font-size': 10, fill: '#ffc847', 'dominant-baseline': 'central' }, g);
    tx2.textContent = def.icon;
  }
}

function pickStrongest(us) {
  let best = us[0]; let bestS = -1;
  for (const u of us) {
    const d = getDef(u);
    const s = d.atk * 2 + d.hp * 0.3 + d.def;
    if (s > bestS) { bestS = s; best = u; }
  }
  return best;
}

// Accepts either:
//   - array of territory IDs (back-compat, all yellow)
//   - object map { tid: 'move' | 'attack' | 'capture' | 'blocked' }
export function setHighlight(idsOrMap) {
  const KIND_CLASSES = ['hl-move', 'hl-attack', 'hl-capture', 'hl-blocked', 'highlighted'];
  if (!layers.territories) return;
  let map = {};
  if (Array.isArray(idsOrMap) || idsOrMap instanceof Set) {
    [...idsOrMap].forEach(id => map[id] = 'move');
  } else if (idsOrMap && typeof idsOrMap === 'object') {
    map = idsOrMap;
  }
  highlightSet = new Set(Object.keys(map));
  layers.territories.querySelectorAll('.territory').forEach(g => {
    KIND_CLASSES.forEach(c => g.classList.remove(c));
    const kind = map[g.dataset.id];
    if (kind) {
      g.classList.add('highlighted');
      g.classList.add('hl-' + kind);
    }
  });
}

function applySelectedClass() {
  if (!layers.territories) return;
  layers.territories.querySelectorAll('.territory').forEach(g => g.classList.remove('selected'));
  layers.units && layers.units.querySelectorAll('.unit-stack').forEach(g => g.classList.remove('group-selected'));
  if (!state.selected) return;
  const tid = state.selected.tid;
  if (!tid) return;
  const tEl = layers.territories.querySelector(`[data-id="${tid}"]`);
  if (tEl) tEl.classList.add('selected');
  // Mark the unit-stack as group-selected
  if (state.selected.type === 'group' && state.selected.uids?.length) {
    const sEl = layers.units?.querySelector(`.unit-stack[data-tid="${tid}"][data-uid]`);
    if (sEl) sEl.classList.add('group-selected');
  }
}

// Refresh after any state change
export function draw() {
  if (!layers.territories) return;
  // re-tint existing polygons
  layers.territories.querySelectorAll('.territory').forEach(g => {
    const t = state.territoriesById[g.dataset.id];
    if (!t) return;
    setOwnerStyles(g, t);
  });
  drawCities();
  drawUnits();
  applySelectedClass();
  drawMinimap();
}

function drawMinimap() {
  const c = document.getElementById('minimap');
  if (!c) return;
  const g = c.getContext('2d');
  g.fillStyle = '#1a3858';
  g.fillRect(0, 0, c.width, c.height);
  const sx = c.width / state.mapMeta.width;
  const sy = c.height / state.mapMeta.height;
  for (const t of state.territories) {
    const nation = state.nations[t.owner];
    g.fillStyle = nation?.color || '#666';
    g.beginPath();
    for (let i = 0; i < t.polygon.length; i++) {
      const [x, y] = t.polygon[i];
      if (i === 0) g.moveTo(x * sx, y * sy);
      else g.lineTo(x * sx, y * sy);
    }
    g.closePath();
    g.fill();
  }
}

function bindEvents() {
  layers.territories.addEventListener('click', e => {
    const g = e.target.closest('.territory');
    if (!g) return;
    const t = state.territoriesById[g.dataset.id];
    if (t && handlers.onClick) handlers.onClick(t, e);
  });
  layers.territories.addEventListener('contextmenu', e => {
    e.preventDefault();
    const g = e.target.closest('.territory');
    const t = g ? state.territoriesById[g.dataset.id] : null;
    if (handlers.onRightClick) handlers.onRightClick(t, e);
  });
  layers.units.addEventListener('click', e => {
    const g = e.target.closest('.unit-stack');
    if (!g) return;
    e.stopPropagation();
    const tid = g.dataset.tid || (state.units.find(x => x.uid === +g.dataset.uid)?.location);
    const t = state.territoriesById[tid];
    if (t && handlers.onClick) handlers.onClick(t, e);
  });
  layers.units.addEventListener('contextmenu', e => {
    e.preventDefault();
    const g = e.target.closest('.unit-stack');
    if (!g) { if (handlers.onRightClick) handlers.onRightClick(null, e); return; }
    e.stopPropagation();
    const tid = g.dataset.tid || (state.units.find(x => x.uid === +g.dataset.uid)?.location);
    const t = state.territoriesById[tid];
    if (handlers.onRightClick) handlers.onRightClick(t, e);
  });
  svg.addEventListener('mousemove', e => {
    const g = e.target.closest('.territory') || e.target.closest('.unit-stack');
    if (g && g.dataset.id) {
      const t = state.territoriesById[g.dataset.id];
      if (handlers.onHover) handlers.onHover(t, e.clientX, e.clientY);
    } else if (g && g.dataset.tid) {
      const t = state.territoriesById[g.dataset.tid];
      if (handlers.onHover) handlers.onHover(t, e.clientX, e.clientY);
    } else {
      if (handlers.onHover) handlers.onHover(null);
    }
  });
  svg.addEventListener('mouseleave', () => { if (handlers.onHover) handlers.onHover(null); });
}

// === Battle FX ===
export function spawnBattleFx(territoryId) {
  const t = state.territoriesById[territoryId];
  if (!t || !layers.fx) return;
  const [cx, cy] = t.center;
  const g = el('g', { class: 'battle-burst', transform: `translate(${cx} ${cy})` }, layers.fx);
  // expanding shockwaves
  for (let i = 0; i < 3; i++) {
    const c = el('circle', { r: 12, cx: 0, cy: 0, fill: 'none', stroke: '#ffeb3b', 'stroke-width': 4, opacity: 0.95 }, g);
    c.style.animation = `shockwave 0.9s ease-out ${i * 0.18}s forwards`;
  }
  // crossed swords burst
  const sw = el('text', { 'text-anchor': 'middle', y: 8, 'font-size': 44, 'dominant-baseline': 'central' }, g);
  sw.textContent = '⚔';
  sw.style.animation = 'battle-burst 1.0s ease-out forwards';
  setTimeout(() => g.remove(), 1200);
  // screen shake
  const ma = document.getElementById('map-area');
  if (ma) { ma.classList.remove('shake'); void ma.offsetWidth; ma.classList.add('shake'); }
}

export function spawnDamageNumber(territoryId, value, side = 'atk', delay = 0) {
  const t = state.territoriesById[territoryId];
  if (!t || !layers.fx) return;
  const [cx, cy] = t.center;
  setTimeout(() => {
    const dx = (Math.random() - 0.5) * 30;
    const tx = el('text', {
      x: cx + dx, y: cy,
      'text-anchor': 'middle',
      'font-size': 22, 'font-weight': 'bold',
      fill: side === 'atk' ? '#ff6464' : '#ffc847',
      stroke: '#000', 'stroke-width': 3, 'paint-order': 'stroke',
      class: 'damage-number'
    }, layers.fx);
    tx.textContent = `-${value}`;
    setTimeout(() => tx.remove(), 1200);
  }, delay);
}

export function spawnSkull(territoryId, delay = 0) {
  const t = state.territoriesById[territoryId];
  if (!t || !layers.fx) return;
  const [cx, cy] = t.center;
  setTimeout(() => {
    const tx = el('text', {
      x: cx + (Math.random()-0.5)*20, y: cy + 5,
      'text-anchor': 'middle', 'font-size': 26,
      class: 'damage-number'
    }, layers.fx);
    tx.textContent = '☠';
    setTimeout(() => tx.remove(), 1500);
  }, delay);
}

export function flashUnit(territoryId) {
  if (!layers.units) return;
  const stacks = layers.units.querySelectorAll(`.unit-stack[data-tid="${territoryId}"]`);
  stacks.forEach(g => {
    g.classList.remove('hit'); void g.getBBox(); g.classList.add('hit');
    setTimeout(() => g.classList.remove('hit'), 350);
  });
}

// Animated arrow drawn from one territory's center to another's.
export function spawnMoveArrow(fromId, toId, color = '#ff4040', durMs = 900) {
  if (!layers.fx) return;
  const f = state.territoriesById[fromId];
  const t = state.territoriesById[toId];
  if (!f || !t) return;
  const x1 = f.center[0], y1 = f.center[1];
  const x2 = t.center[0], y2 = t.center[1];
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const angleDeg = Math.atan2(dy, dx) * 180 / Math.PI;
  // Pull arrow tip back from target so it doesn't overlap city icon
  const back = 22;
  const tx = x2 - back * Math.cos(angleDeg * Math.PI / 180);
  const ty = y2 - back * Math.sin(angleDeg * Math.PI / 180);

  const g = el('g', { class: 'move-arrow' }, layers.fx);
  const dur = (durMs / 1000) + 's';
  // Outer glow line (white, slightly thicker)
  const glow = el('line', {
    x1, y1, x2: tx, y2: ty,
    stroke: '#fff', 'stroke-width': 8, 'stroke-linecap': 'round',
    opacity: 0.45,
    pathLength: 100, 'stroke-dasharray': 100, 'stroke-dashoffset': 100,
  }, g);
  el('animate', { attributeName: 'stroke-dashoffset', from: 100, to: 0, dur, fill: 'freeze' }, glow);
  // Main colored line
  const line = el('line', {
    x1, y1, x2: tx, y2: ty,
    stroke: color, 'stroke-width': 5, 'stroke-linecap': 'round',
    pathLength: 100, 'stroke-dasharray': 100, 'stroke-dashoffset': 100,
    class: 'arrow-line'
  }, g);
  el('animate', { attributeName: 'stroke-dashoffset', from: 100, to: 0, dur, fill: 'freeze' }, line);
  // Arrow head (triangle, pops in at the end)
  el('polygon', {
    points: '0,-10 18,0 0,10',
    fill: color, stroke: '#fff', 'stroke-width': 1.4,
    transform: `translate(${tx} ${ty}) rotate(${angleDeg})`,
    style: `animation: head-pop 0.45s ease-out ${durMs - 200}ms both`,
    opacity: 0
  }, g);

  setTimeout(() => g.remove(), durMs + 800);
}

// Briefly focus a territory (small zoom-pulse to attract attention).
export function focusTerritory(territoryId) {
  if (!layers.territories) return;
  const tEl = layers.territories.querySelector(`[data-id="${territoryId}"]`);
  if (!tEl) return;
  tEl.classList.remove('focusing');
  void tEl.getBBox();
  tEl.classList.add('focusing');
  setTimeout(() => tEl.classList.remove('focusing'), 1200);
}
