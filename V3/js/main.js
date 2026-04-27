// main.js — V3 entry. Wires data → state → UI → input.
import { state, loadAll, initRuntime, yearLabel, isAtWar } from './state.js';
import { init as initMap, draw as drawMap } from './map.js';
import { bindAll } from './input.js';
import { refreshAll, logEvent, setHint } from './hud.js';
import { spawnUnit } from './unit.js';
import { hasSave, load as loadSave, save as writeSave } from './save.js';

let booted = false;
let pickedNation = 'blue';
let pickedDiff = 'normal';

const DIFF_DESCS = {
  easy:   'AI ×0.7 · Easier · Player gold 300',
  normal: 'AI ×1.0 · Standard · Player gold 200',
  hard:   'AI ×1.4 · Tougher · Player gold 200',
};

async function preload() {
  await loadAll();
  // Default pick = first nation in file (Blue)
  pickedNation = state.nationDefs[0].id;
  bindMenu();
}

function startGame() {
  state.player = pickedNation;
  state.difficulty = pickedDiff;
  initRuntime();
  setupStartingArmies();
  if (!booted) {
    initMap();
    bindAll();
    booted = true;
  } else {
    drawMap();
  }
  refreshAll();
  document.getElementById('main-menu').classList.add('hidden');
  // Initial briefing
  const enemies = [];
  for (const w of state.wars) {
    const [a, b] = w.split(':');
    if (a === state.player) enemies.push(b);
    if (b === state.player) enemies.push(a);
  }
  const me = state.nations[state.player];
  const intro = enemies.length
    ? `Turn 1 · ${me.name} · already at war with ${enemies.map(id => state.nations[id].name).join(', ')}`
    : `Turn 1 · ${me.name} · pick a unit, right-click target to attack`;
  setHint(intro, true);
}

function setupStartingArmies() {
  state.units.length = 0;
  for (const nid of Object.keys(state.nations)) {
    const n = state.nations[nid];
    spawnUnit('U001', 1, nid, n.capital);
    spawnUnit('U002', 1, nid, n.capital);
    spawnUnit('U002', 1, nid, n.capital);
    const cap = state.territoriesById[n.capital];
    if (cap && (cap.terrain === 'coast' || cap.terrain === 'sea')) {
      spawnUnit('U031', 1, nid, n.capital);
    }
    if (nid === state.player) {
      spawnUnit('U011', 1, nid, n.capital);
    }
    const others = state.territories.filter(t => t.owner === nid && t.id !== n.capital);
    if (others.length) {
      const pick = others[Math.floor(Math.random() * others.length)];
      spawnUnit('U001', 1, nid, pick.id);
    }
  }
  state.log.length = 0;
  const me = state.nations[state.player];
  logEvent('event', '🌅', `Game start · ${me.name} · Difficulty: ${diffLabel()}`);
  for (const w of state.wars) {
    const [a, b] = w.split(':');
    if (a === state.player || b === state.player) {
      const other = a === state.player ? b : a;
      logEvent('war', '⚔', `${state.nations[other].name} is at war with us`);
    }
  }
}

function diffLabel() {
  return state.difficulty === 'easy' ? 'Easy' : state.difficulty === 'hard' ? 'Hard' : 'Normal';
}

function buildNationPicker() {
  const box = document.getElementById('nation-picker');
  if (!box) return;
  box.innerHTML = state.nationDefs.map(n => `
    <div class="nation-pick ${n.id === pickedNation ? 'selected' : ''}" data-id="${n.id}">
      <div class="np-flag" style="background:${n.color}">${n.icon || '⚑'}</div>
      <div class="np-name">${n.name}</div>
    </div>`).join('');
  const tagline = document.getElementById('nation-tagline');
  const cur = state.nationDefs.find(n => n.id === pickedNation);
  if (tagline && cur) tagline.textContent = cur.tagline || '';
  box.addEventListener('click', e => {
    const card = e.target.closest('.nation-pick');
    if (!card) return;
    pickedNation = card.dataset.id;
    box.querySelectorAll('.nation-pick').forEach(c => c.classList.toggle('selected', c.dataset.id === pickedNation));
    const sel = state.nationDefs.find(n => n.id === pickedNation);
    if (tagline && sel) tagline.textContent = sel.tagline || '';
  }, { once: true });   // re-bind after each render via the same event flow; we re-render once on entry
}

function bindMenu() {
  const menu = document.getElementById('main-menu');
  buildNationPicker();
  // event delegation for picker (since we use { once:true } re-runs would lose listener)
  document.getElementById('nation-picker').addEventListener('click', e => {
    const card = e.target.closest('.nation-pick');
    if (!card) return;
    pickedNation = card.dataset.id;
    document.querySelectorAll('#nation-picker .nation-pick').forEach(c =>
      c.classList.toggle('selected', c.dataset.id === pickedNation));
    const sel = state.nationDefs.find(n => n.id === pickedNation);
    const tag = document.getElementById('nation-tagline');
    if (tag && sel) tag.textContent = sel.tagline || '';
  });

  // Difficulty buttons
  const descBox = document.getElementById('diff-desc');
  if (descBox) descBox.textContent = DIFF_DESCS[pickedDiff];
  document.querySelectorAll('.diff-btn').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.diff-btn').forEach(x => x.classList.remove('selected'));
      b.classList.add('selected');
      pickedDiff = b.dataset.diff;
      if (descBox) descBox.textContent = DIFF_DESCS[pickedDiff];
    });
  });

  document.getElementById('btn-new-game').addEventListener('click', startGame);

  const loadBtn = document.getElementById('btn-load-game');
  if (hasSave()) {
    loadBtn.disabled = false;
    loadBtn.addEventListener('click', () => {
      // Read player from save first
      const raw = localStorage.getItem('freeWar_V3_save');
      try {
        const dump = JSON.parse(raw);
        state.player = dump.player || pickedNation;
        state.difficulty = dump.difficulty || 'normal';
      } catch (e) { state.player = pickedNation; }
      if (!booted) {
        initRuntime();
        initMap();
        bindAll();
        booted = true;
      }
      if (loadSave()) {
        menu.classList.add('hidden');
        refreshAll();
        drawMap();
        logEvent('event', '💾', 'Save loaded');
        setHint('Save loaded', true);
      }
    });
  } else {
    loadBtn.disabled = true;
  }

  const muteBtn = document.getElementById('btn-mute');
  muteBtn.addEventListener('click', () => {
    state.muted = !state.muted;
    muteBtn.textContent = state.muted ? '🔇 Sound (off)' : '🔊 Sound (on)';
  });
  muteBtn.textContent = state.muted ? '🔇 Sound (off)' : '🔊 Sound (on)';
}

let lastSavedTurn = 0;
setInterval(() => {
  if (booted && state.turn !== lastSavedTurn && state.turn % 3 === 0 && !state.ended) {
    writeSave();
    lastSavedTurn = state.turn;
  }
}, 1500);

preload().catch(err => {
  console.error('V3 boot failed:', err);
  document.body.innerHTML = `<div style="padding:40px;color:#f88;font-family:monospace">
    <h2>V3 Boot Failed</h2>
    <pre>${err.stack || err.message}</pre>
    <p>Open via local server (e.g., python3 -m http.server 8000) — not file://</p>
  </div>`;
});
