import {
  loadState, saveState, resetState,
  ticketPrice, isCardUnlocked, checkUnlocks, upgradeCost
} from './state.js';
import { generateCard, evaluatePrize, isBigWin, renderCardDOM, applyResultStyling } from './card.js';
import { attachScratch } from './scratch.js';
import { spawnParticles, floatText, bigWinFlash, nearMissPulse, shake } from './fx.js';
import { AudioSystem } from './audio.js';
import { renderShop } from './shop.js';
import { renderUpgrades } from './upgrade.js';
import {
  renderOreShop, renderSlots,
  tickMines, applyOfflineEarnings
} from './mine.js';

let state, cardsData, upgradesData, oresData;
const audio = new AudioSystem();

let activeCard = null;
let activeScratch = null;
let activeRender = null;
let lastTick = performance.now();
let lastSave = performance.now();

const els = {
  money: document.getElementById('hud-money'),
  scratched: document.getElementById('hud-scratched'),
  best: document.getElementById('hud-best'),
  shop: document.getElementById('shop-cards'),
  upgrade: document.getElementById('upgrade-list'),
  oreShop: document.getElementById('ore-shop'),
  slots: document.getElementById('mine-slots'),
  stage: document.getElementById('stage-area'),
  stageTitle: document.getElementById('stage-title'),
  mute: document.getElementById('btn-mute'),
  reset: document.getElementById('btn-reset'),
  toast: document.getElementById('toast')
};

async function loadData() {
  const [c, u, o] = await Promise.all([
    fetch('data/cards.json').then((r) => r.json()),
    fetch('data/upgrades.json').then((r) => r.json()),
    fetch('data/ores.json').then((r) => r.json())
  ]);
  cardsData = c; upgradesData = u; oresData = o;
}

function renderHUD() {
  els.money.textContent = '$' + Math.floor(state.money).toLocaleString();
  const total = (state.cardsScratched.card1 || 0) + (state.cardsScratched.card2 || 0) + (state.cardsScratched.card3 || 0);
  els.scratched.textContent = total;
  els.best.textContent = '$' + Math.floor(state.stats.biggestWin).toLocaleString();
}

function renderAll() {
  renderHUD();
  renderShop(els.shop, state, cardsData, upgradesData, { onBuy: handleBuyCard });
  renderUpgrades(els.upgrade, state, upgradesData, { onUpgrade: handleUpgrade });
  renderOreShop(els.oreShop, state, oresData, { onBuyOre: handleBuyOre });
  renderSlots(els.slots, state, oresData, {
    onPlace: handlePlaceOre,
    onCollect: handleCollect,
    onClear: handleClearSlot
  });
}

function renderSlotsOnly() {
  renderSlots(els.slots, state, oresData, {
    onPlace: handlePlaceOre,
    onCollect: handleCollect,
    onClear: handleClearSlot
  });
}

function toast(msg, ms = 1600) {
  els.toast.textContent = msg;
  els.toast.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { els.toast.hidden = true; }, ms);
}

function handleBuyCard(cardId) {
  audio.resume();
  if (!isCardUnlocked(cardId, state)) { audio.play('error'); return; }
  if (activeCard) { audio.play('error'); toast('先把当前卡刮完'); return; }
  const def = cardsData[cardId];
  const price = ticketPrice(def, state, upgradesData);
  if (state.money < price) { audio.play('error'); toast('钱不够'); return; }
  state.money -= price;
  state.stats.totalSpent += price;
  audio.play('buy');
  startCard(cardId, def, price);
  renderHUD();
  renderShop(els.shop, state, cardsData, upgradesData, { onBuy: handleBuyCard });
  saveState(state);
}

function startCard(cardId, def, price) {
  els.stageTitle.textContent = `🎫 ${def.name}（$${price}）— 用鼠标/手指刮开`;
  const card = generateCard(def, state, upgradesData);
  activeCard = { card, cardId, def, price };
  const { canvas, content, resultBox, wrap } = renderCardDOM(card, def, price, els.stage);
  activeRender = { canvas, content, resultBox, wrap };
  requestAnimationFrame(() => {
    activeScratch = attachScratch(canvas, {
      threshold: 0.55,
      onProgress: (pct) => {
        if (pct > 0 && pct < 1) audio.play('scratch', 90);
      },
      onReveal: handleReveal
    });
  });
}

function handleReveal() {
  const { card, cardId, def, price } = activeCard;
  const result = evaluatePrize(card, state, upgradesData);
  audio.play('reveal');
  applyResultStyling(card, result, activeRender.content);

  state.cardsScratched[cardId] = (state.cardsScratched[cardId] || 0) + 1;

  result.nearMisses.forEach((idx) => {
    let el;
    if (card.type === 'lucky-number-rows') el = activeRender.content.querySelector(`[data-row-idx="${idx}"]`);
    if (el) nearMissPulse(el);
  });
  if (result.nearMisses.length > 0 && result.prize === 0) {
    audio.play('near-miss');
  }

  if (result.prize > 0) {
    state.money += result.prize;
    state.stats.totalWins += 1;
    if (result.prize > state.stats.biggestWin) state.stats.biggestWin = result.prize;
    showWinFX(result.prize, price, def);
  } else {
    showLoseFX();
  }

  showResultBox(result, def);

  const unlockChanged = checkUnlocks(state, cardsData);
  if (unlockChanged) {
    audio.play('unlock');
    toast('🎉 解锁新彩票！');
  }

  renderHUD();
  renderShop(els.shop, state, cardsData, upgradesData, { onBuy: handleBuyCard });
  renderUpgrades(els.upgrade, state, upgradesData, { onUpgrade: handleUpgrade });
  saveState(state);
}

function showWinFX(prize, price, def) {
  const rect = activeRender.wrap.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const big = isBigWin(prize, price);
  if (big) {
    audio.play('win-big');
    bigWinFlash();
    spawnParticles(cx, cy, 60, { color: '#ffd33d' });
    spawnParticles(cx, cy, 30, { color: '#ff8e3c' });
    floatText(cx, cy - 20, `+$${prize.toLocaleString()}`, { color: '#ffd33d', size: 42 });
    shake(activeRender.wrap, 1.2);
  } else {
    audio.play('win-small');
    spawnParticles(cx, cy, 24, { color: '#ffd33d' });
    floatText(cx, cy - 20, `+$${prize.toLocaleString()}`);
  }
}

function showLoseFX() {
  const rect = activeRender.wrap.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  floatText(cx, cy - 10, '没中', { color: '#b6a8d6', size: 22 });
}

function showResultBox(result, def) {
  const box = activeRender.resultBox;
  box.style.display = 'flex';
  box.classList.toggle('win', result.prize > 0);
  box.classList.toggle('lose', result.prize === 0);
  let txt;
  if (result.prize > 0) {
    const breakdown = [];
    if (result.scale > 1) breakdown.push(`金额 ×${result.scale.toFixed(1)}`);
    if (result.multiplier > 1) breakdown.push(`翻倍 ×${result.multiplier.toFixed(1)}`);
    const extra = breakdown.length ? `（${breakdown.join('，')}）` : '';
    txt = `🏆 中奖 $${result.prize.toLocaleString()} ${extra}`;
  } else if (result.nearMisses.length > 0) {
    txt = `差一点！再来一张？`;
  } else {
    txt = `没中。`;
  }
  box.innerHTML = '';
  const t = document.createElement('div');
  t.className = 'result-text';
  t.textContent = txt;
  const btn = document.createElement('button');
  btn.className = 'next-btn';
  btn.textContent = '关闭';
  btn.onclick = closeCard;
  box.appendChild(t);
  box.appendChild(btn);
}

function closeCard() {
  if (activeScratch) activeScratch.destroy();
  activeScratch = null;
  activeCard = null;
  activeRender = null;
  els.stage.innerHTML = '<div class="empty-stage">点 [买票] 开始刮一张</div>';
  els.stageTitle.textContent = '点 [买票] 开始';
}

function handleUpgrade(key) {
  audio.resume();
  const def = upgradesData[key];
  const lvl = state.upgrades[key];
  if (lvl >= def.maxLevel) { audio.play('error'); return; }
  const cost = upgradeCost(def, lvl);
  if (state.money < cost) { audio.play('error'); toast('钱不够'); return; }
  state.money -= cost;
  state.upgrades[key] += 1;
  audio.play('unlock');
  renderHUD();
  renderUpgrades(els.upgrade, state, upgradesData, { onUpgrade: handleUpgrade });
  renderShop(els.shop, state, cardsData, upgradesData, { onBuy: handleBuyCard });
  saveState(state);
}

function handleBuyOre(name) {
  audio.resume();
  const ore = oresData.ores[name];
  if (!ore) return;
  if ((state.oreInventory[name] || 0) >= ore.stockMax) { audio.play('error'); toast('库存满了'); return; }
  if (state.money < ore.buyCost) { audio.play('error'); toast('钱不够'); return; }
  state.money -= ore.buyCost;
  state.oreInventory[name] = (state.oreInventory[name] || 0) + 1;
  audio.play('buy');
  renderHUD();
  renderOreShop(els.oreShop, state, oresData, { onBuyOre: handleBuyOre });
  saveState(state);
}

function handlePlaceOre(slotIdx, oreName) {
  if ((state.oreInventory[oreName] || 0) <= 0) { audio.play('error'); return; }
  if (state.mineSlots[slotIdx].ore) { audio.play('error'); toast('矿位已占用'); return; }
  state.oreInventory[oreName] -= 1;
  state.mineSlots[slotIdx] = { ore: oreName, accumulated: 0, lastTickMs: Date.now() };
  audio.play('place');
  renderOreShop(els.oreShop, state, oresData, { onBuyOre: handleBuyOre });
  renderSlotsOnly();
  saveState(state);
}

function handleCollect(slotIdx) {
  audio.resume();
  const slot = state.mineSlots[slotIdx];
  if (!slot.ore) return;
  const gain = Math.floor(slot.accumulated);
  if (gain <= 0) { toast('还没产出'); return; }
  state.money += gain;
  slot.accumulated -= gain;
  audio.play('collect');
  const slotEl = els.slots.children[slotIdx];
  if (slotEl) {
    const r = slotEl.getBoundingClientRect();
    floatText(r.left + r.width / 2, r.top + 8, `+$${gain}`, { color: '#6dd66d', size: 20 });
  }
  renderHUD();
  renderSlotsOnly();
  saveState(state);
}

function handleClearSlot(slotIdx) {
  const slot = state.mineSlots[slotIdx];
  if (!slot.ore) return;
  state.oreInventory[slot.ore] = (state.oreInventory[slot.ore] || 0) + 1;
  state.mineSlots[slotIdx] = { ore: null, accumulated: 0, lastTickMs: Date.now() };
  audio.play('place');
  renderOreShop(els.oreShop, state, oresData, { onBuyOre: handleBuyOre });
  renderSlotsOnly();
  saveState(state);
}

function loop(now) {
  const dt = Math.min(0.5, (now - lastTick) / 1000);
  lastTick = now;
  if (dt > 0) {
    tickMines(state, oresData, dt);
    state.lastTickMs = Date.now();
    updateSlotYieldsInline();
  }
  if (now - lastSave > 5000) {
    saveState(state);
    lastSave = now;
  }
  requestAnimationFrame(loop);
}

function updateSlotYieldsInline() {
  const slotEls = els.slots.querySelectorAll('.slot');
  state.mineSlots.forEach((slot, i) => {
    const el = slotEls[i];
    if (!el) return;
    const yieldEl = el.querySelector('.slot-yield');
    if (yieldEl && slot.ore) yieldEl.textContent = '$' + Math.floor(slot.accumulated);
  });
}

function setupTopbar() {
  els.mute.textContent = audio.isMuted() ? '🔇' : '🔊';
  els.mute.onclick = () => {
    audio.resume();
    const muted = audio.toggleMute();
    els.mute.textContent = muted ? '🔇' : '🔊';
    if (!muted) audio.startBgm();
    else audio.stopBgm();
  };
  els.reset.onclick = () => {
    if (!confirm('确定重置所有进度？金币、升级、矿石都会清空。')) return;
    if (!confirm('真的真的确定？')) return;
    resetState();
    location.reload();
  };
}

function setupVisibility() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      applyOfflineEarnings(state, oresData);
      renderHUD();
      renderSlotsOnly();
    } else {
      saveState(state);
    }
  });
  window.addEventListener('beforeunload', () => saveState(state));
}

async function init() {
  await loadData();
  state = loadState(oresData.slots);
  applyOfflineEarnings(state, oresData);
  setupTopbar();
  setupVisibility();
  renderAll();
  els.stage.innerHTML = '<div class="empty-stage">点 [买票] 开始刮一张</div>';
  document.body.addEventListener('pointerdown', () => audio.resume(), { once: true });
  document.body.addEventListener('pointerdown', () => {
    if (!audio.isMuted()) audio.startBgm();
  }, { once: true });
  lastTick = performance.now();
  requestAnimationFrame(loop);
}

init().catch((e) => {
  console.error(e);
  document.body.innerHTML = `<pre style="color:#fff;padding:20px;">加载失败: ${e.message}</pre>`;
});
