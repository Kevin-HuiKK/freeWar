export function renderOreShop(container, state, oresData, callbacks) {
  container.innerHTML = '';
  const list = document.createElement('div');
  list.className = 'ore-shop-list';

  for (const key of Object.keys(oresData.ores)) {
    const ore = oresData.ores[key];
    const stock = state.oreInventory[key] || 0;
    const full = stock >= ore.stockMax;
    const poor = state.money < ore.buyCost;
    const disabled = full || poor;

    const row = document.createElement('div');
    row.className = 'ore-row' + (disabled ? ' disabled' : '');
    row.innerHTML = `
      <div class="ore-icon ${key}"></div>
      <div class="info">
        <div class="name">${ore.name}</div>
        <div class="desc">$${ore.yieldPerSec}/秒 · 库存 ${stock}/${ore.stockMax}</div>
      </div>
      <div class="price">$${ore.buyCost}</div>
    `;
    if (!disabled) {
      row.addEventListener('click', () => callbacks.onBuyOre(key));
    }
    list.appendChild(row);
  }
  container.appendChild(list);

  const tray = document.createElement('div');
  tray.className = 'inv-tray';
  for (const key of Object.keys(oresData.ores)) {
    const stock = state.oreInventory[key] || 0;
    if (stock <= 0) continue;
    const ore = oresData.ores[key];
    const tile = document.createElement('div');
    tile.className = 'inv-tile';
    tile.draggable = true;
    tile.dataset.ore = key;
    tile.innerHTML = `<span class="ore-icon ${key}"></span>${ore.name} ×${stock}`;
    tile.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', key);
      e.dataTransfer.effectAllowed = 'move';
    });
    tray.appendChild(tile);
  }
  container.appendChild(tray);
}

export function renderSlots(container, state, oresData, callbacks) {
  container.innerHTML = '';
  state.mineSlots.forEach((slot, idx) => {
    const el = document.createElement('div');
    el.className = 'slot';
    if (!slot.ore) {
      el.classList.add('empty');
      el.textContent = '空';
      el.addEventListener('dragenter', (e) => { e.preventDefault(); el.classList.add('drag-over'); });
      el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('drag-over'); });
      el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
      el.addEventListener('drop', (e) => {
        e.preventDefault();
        el.classList.remove('drag-over');
        const ore = e.dataTransfer.getData('text/plain');
        if (ore) callbacks.onPlace(idx, ore);
      });
    } else {
      const ore = oresData.ores[slot.ore];
      el.innerHTML = `
        <div class="slot-ore-icon ore-icon ${slot.ore}" title="${ore ? ore.name : slot.ore}"></div>
        <div class="slot-yield">$${Math.floor(slot.accumulated)}</div>
        <button type="button" class="slot-collect">收集</button>
        <button type="button" class="slot-clear" aria-label="清除">✕</button>
      `;
      el.querySelector('.slot-collect').addEventListener('click', (e) => {
        e.stopPropagation();
        callbacks.onCollect(idx);
      });
      el.querySelector('.slot-clear').addEventListener('click', (e) => {
        e.stopPropagation();
        callbacks.onClear(idx);
      });
    }
    container.appendChild(el);
  });
}

export function tickMines(state, oresData, dtSec) {
  const now = Date.now();
  for (const slot of state.mineSlots) {
    if (!slot.ore) continue;
    const def = oresData.ores[slot.ore];
    if (!def) continue;
    slot.accumulated += def.yieldPerSec * dtSec;
    slot.lastTickMs = now;
  }
}

export function applyOfflineEarnings(state, oresData) {
  const now = Date.now();
  const cap = (oresData.offlineCapHours || 0) * 3600;
  const last = state.lastTickMs || 0;
  let elapsed = last > 0 ? (now - last) / 1000 : 0;
  if (elapsed < 0) elapsed = 0;
  if (cap > 0 && elapsed > cap) elapsed = cap;
  if (elapsed > 0) {
    for (const slot of state.mineSlots) {
      if (!slot.ore) continue;
      const def = oresData.ores[slot.ore];
      if (!def) continue;
      slot.accumulated += def.yieldPerSec * elapsed;
      slot.lastTickMs = now;
    }
  }
  state.lastTickMs = now;
}
