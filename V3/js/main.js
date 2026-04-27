// main.js — V3 entry. Wires data → state → UI → input.
import { state, loadAll, initRuntime, yearLabel, isAtWar } from './state.js';
import { init as initMap, draw as drawMap } from './map.js';
import { bindAll } from './input.js';
import { refreshAll, logEvent, setHint, hideModal } from './hud.js';
import { spawnUnit } from './unit.js';
import { hasSave, load as loadSave, save as writeSave } from './save.js';

let booted = false;

async function preload() {
  await loadAll();
  // Bind difficulty buttons (data only)
  bindMenu();
}

function startGame(diff) {
  state.difficulty = diff || 'normal';
  initRuntime();
  setupStartingArmies();
  if (!booted) {
    initMap();
    bindAll();
    booted = true;
  } else {
    // re-init the map for new game
    drawMap();
  }
  refreshAll();
  document.getElementById('main-menu').classList.add('hidden');
  // welcome hints
  const enemies = [];
  for (const w of state.wars) {
    const [a, b] = w.split(':');
    if (a === state.player) enemies.push(b);
    if (b === state.player) enemies.push(a);
  }
  setHint(`第 1 回合 · 已与 ${enemies.map(id => state.nations[id].name).join('、')} 处于交战 · 选择单位进攻！`, true);
}

function setupStartingArmies() {
  // clear previous units (in case of restart)
  state.units.length = 0;

  for (const nid of Object.keys(state.nations)) {
    const n = state.nations[nid];
    spawnUnit('U001', 1, nid, n.capital);    // 民兵
    spawnUnit('U002', 1, nid, n.capital);    // 标准步兵
    spawnUnit('U002', 1, nid, n.capital);
    // Coastal nations get a 巡逻艇 to enable naval play
    const cap = state.territoriesById[n.capital];
    if (cap && (cap.terrain === 'coast' || cap.terrain === 'sea')) {
      spawnUnit('U031', 1, nid, n.capital);
    }
    // Player extras
    if (nid === state.player) {
      spawnUnit('U011', 1, nid, n.capital);   // 轻型坦克
    }
    // one extra militia at a non-capital city
    const others = state.territories.filter(t => t.owner === nid && t.id !== n.capital);
    if (others.length) {
      const pick = others[Math.floor(Math.random() * others.length)];
      spawnUnit('U001', 1, nid, pick.id);
    }
  }
  state.log.length = 0;
  logEvent('event', '🌅', `游戏开始 · 红线群岛 · 难度 ${diffLabel()}`);
  for (const w of state.wars) {
    const [a, b] = w.split(':');
    if (a === state.player || b === state.player) {
      const other = a === state.player ? b : a;
      logEvent('war', '⚔', `${state.nations[other].name}与我方处于战争状态`);
    }
  }
}

function diffLabel() {
  return state.difficulty === 'easy' ? '🐣 菜鸟' : state.difficulty === 'hard' ? '🔥 老手' : '⚔ 正常';
}

function bindMenu() {
  const menu = document.getElementById('main-menu');
  // Difficulty buttons
  let pickedDiff = 'normal';
  const descBox = document.getElementById('diff-desc');
  const descs = {
    easy:   'AI 资源 ×0.7、AI 攻击性 ×0.6、玩家起始金币 300 — 适合入门',
    normal: 'AI 资源 ×1.0、AI 攻击性 ×1.0、玩家起始金币 200 — 标准对战',
    hard:   'AI 资源 ×1.4、AI 攻击性 ×1.4、玩家起始金币 200 — 老手挑战',
  };
  document.querySelectorAll('.diff-btn').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.diff-btn').forEach(x => x.classList.remove('selected'));
      b.classList.add('selected');
      pickedDiff = b.dataset.diff;
      descBox.textContent = descs[pickedDiff];
    });
  });

  document.getElementById('btn-new-game').addEventListener('click', () => startGame(pickedDiff));

  const loadBtn = document.getElementById('btn-load-game');
  if (hasSave()) {
    loadBtn.disabled = false;
    loadBtn.addEventListener('click', () => {
      // need to init runtime first to populate nations
      if (!booted) {
        // partial init: load JSONs were done; now init runtime then load save
        initRuntime();
        initMap();
        bindAll();
        booted = true;
      }
      if (loadSave()) {
        menu.classList.add('hidden');
        refreshAll();
        drawMap();
        logEvent('event', '💾', '已读取存档');
        setHint('存档已读取', true);
      }
    });
  } else {
    loadBtn.disabled = true;
  }

  const muteBtn = document.getElementById('btn-mute');
  muteBtn.addEventListener('click', () => {
    state.muted = !state.muted;
    muteBtn.textContent = state.muted ? '🔇 音效（关）' : '🔊 音效（开）';
  });
  muteBtn.textContent = state.muted ? '🔇 音效（关）' : '🔊 音效（开）';
}

// Auto-save every 3 turns
let lastSavedTurn = 0;
setInterval(() => {
  if (booted && state.turn !== lastSavedTurn && state.turn % 3 === 0 && !state.ended) {
    writeSave();
    lastSavedTurn = state.turn;
  }
}, 1500);

preload().catch(err => {
  console.error('V3 preload failed:', err);
  document.body.innerHTML = `<div style="padding:40px;color:#f88;font-family:monospace">
    <h2>V3 启动失败</h2>
    <pre>${err.stack || err.message}</pre>
    <p>请确认通过本地服务器（http://localhost:8000/V3/）打开，而不是直接 file://</p>
  </div>`;
});
