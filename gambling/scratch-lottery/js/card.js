import { chance, pickN, pickOne, shuffle } from './rng.js';

export function generateCard(cardDef, state, upgradesData) {
  const luckBonus = state.upgrades.luck * upgradesData.luck.effectPerLevel;
  if (cardDef.type === 'lucky-number-rows') return genCard1(cardDef, luckBonus);
  if (cardDef.type === 'combo-chain') return genCard2(cardDef, luckBonus);
  if (cardDef.type === 'grid-collect') return genCard3(cardDef, luckBonus);
  throw new Error('unknown card type: ' + cardDef.type);
}

function genCard1(def, luckBonus) {
  const luckyNumber = pickOne(def.luckyNumberPool);
  const hitRate = Math.min(0.95, def.hitRatePerCell + luckBonus);
  const rows = def.rows.map((row) => {
    const cells = [];
    for (let i = 0; i < row.size; i++) {
      if (chance(hitRate)) {
        cells.push({ value: luckyNumber, isTarget: true });
      } else {
        cells.push({ value: pickNonTarget(def.numberPool, [luckyNumber]), isTarget: false });
      }
    }
    return { size: row.size, prize: row.prize, cells };
  });
  return { id: def.id, type: def.type, luckyNumber, rows };
}

function genCard2(def, luckBonus) {
  const numberPool = def.numberPool;
  const used = new Set();
  const regions = def.regions.map((r) => {
    let target;
    do { target = pickOne(numberPool); } while (used.has(target));
    used.add(target);
    const adjustedHitRate = Math.min(0.95, r.hitRate + luckBonus * 0.5);
    const willWin = chance(adjustedHitRate);
    const cells = [];
    if (willWin) {
      const targetSlots = pickN([...Array(r.size).keys()], 1 + Math.floor(Math.random() * 2));
      const targetIdx = new Set(targetSlots);
      for (let i = 0; i < r.size; i++) {
        if (targetIdx.has(i)) cells.push({ value: target, isTarget: true });
        else cells.push({ value: pickNonTarget(numberPool, [target, ...used]), isTarget: false });
      }
    } else {
      for (let i = 0; i < r.size; i++) {
        cells.push({ value: pickNonTarget(numberPool, [target, ...used]), isTarget: false });
      }
    }
    return { size: r.size, prize: r.prize, target, willWin, cells };
  });
  return { id: def.id, type: def.type, regions };
}

function genCard3(def, luckBonus) {
  const targets = pickN(def.numberPool, def.targetCount);
  const adjustedRate = Math.min(0.6, def.targetCellRate + luckBonus);
  const total = def.gridRows * def.gridCols;
  const cells = [];
  for (let i = 0; i < total; i++) {
    if (chance(adjustedRate)) {
      cells.push({ value: pickOne(targets), isTarget: true });
    } else {
      cells.push({ value: pickNonTarget(def.numberPool, targets), isTarget: false });
    }
  }
  return {
    id: def.id, type: def.type, targets,
    rows: def.gridRows, cols: def.gridCols,
    cells, tiers: def.tiers
  };
}

function pickNonTarget(pool, exclude) {
  const ex = new Set(exclude);
  for (let attempt = 0; attempt < 20; attempt++) {
    const v = pickOne(pool);
    if (!ex.has(v)) return v;
  }
  return pool[0];
}

export function evaluatePrize(card, state, upgradesData) {
  const mul = 1 + state.upgrades.multiplier * upgradesData.multiplier.effectPerLevel;
  const scale = 1 + state.upgrades.scale * upgradesData.scale.effectPerLevel;
  if (card.type === 'lucky-number-rows') return evalCard1(card, mul, scale);
  if (card.type === 'combo-chain') return evalCard2(card, mul, scale);
  if (card.type === 'grid-collect') return evalCard3(card, mul, scale);
  return { prize: 0, basePrize: 0, multiplier: mul, scale, nearMisses: [] };
}

function evalCard1(card, mul, scale) {
  let basePrize = 0;
  const wonRows = [];
  const nearMissRows = [];
  card.rows.forEach((row, idx) => {
    const matchCount = row.cells.filter((c) => c.value === card.luckyNumber).length;
    if (matchCount > 0) {
      basePrize += row.prize;
      wonRows.push(idx);
    } else {
      const close = row.cells.some((c) => Math.abs(c.value - card.luckyNumber) === 1);
      if (close) nearMissRows.push(idx);
    }
  });
  const scaled = Math.round(basePrize * scale);
  const finalPrize = Math.round(scaled * mul);
  return { prize: finalPrize, basePrize, scaledPrize: scaled, multiplier: mul, scale, wonRows, nearMisses: nearMissRows };
}

function evalCard2(card, mul, scale) {
  let basePrize = 0;
  const wonRegions = [];
  let chainBroken = false;
  card.regions.forEach((region, idx) => {
    if (chainBroken) return;
    const matchCount = region.cells.filter((c) => c.value === region.target).length;
    if (matchCount > 0) {
      basePrize += region.prize;
      wonRegions.push(idx);
    } else {
      chainBroken = true;
    }
  });
  const scaled = Math.round(basePrize * scale);
  const finalPrize = Math.round(scaled * mul);
  return { prize: finalPrize, basePrize, scaledPrize: scaled, multiplier: mul, scale, wonRegions, nearMisses: [] };
}

function evalCard3(card, mul, scale) {
  const targetSet = new Set(card.targets);
  let matched = 0;
  card.cells.forEach((c) => { if (targetSet.has(c.value)) matched++; });
  let basePrize = 0;
  let bestTier = null;
  for (const tier of card.tiers) {
    if (matched >= tier.matches && tier.prize > basePrize) {
      basePrize = tier.prize;
      bestTier = tier;
    }
  }
  const nearMisses = [];
  if (!bestTier) {
    const lowest = card.tiers[0];
    if (matched === lowest.matches - 1) nearMisses.push(0);
  } else {
    const nextIdx = card.tiers.findIndex((t) => t.matches > bestTier.matches);
    if (nextIdx >= 0) {
      const nextTier = card.tiers[nextIdx];
      if (matched === nextTier.matches - 1) nearMisses.push(nextIdx);
    }
  }
  const scaled = Math.round(basePrize * scale);
  const finalPrize = Math.round(scaled * mul);
  return { prize: finalPrize, basePrize, scaledPrize: scaled, multiplier: mul, scale, matched, bestTier, nearMisses };
}

export function isBigWin(prize, ticketPrice) {
  return prize >= ticketPrice * 10;
}

export function renderCardDOM(card, cardDef, displayPrice, container) {
  container.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'scratch-card';
  wrap.innerHTML = `
    <div class="card-header">
      <span class="card-name">🎫 ${cardDef.name}</span>
      <span class="card-price">$${displayPrice}</span>
    </div>
    <div class="card-desc">${cardDef.desc}</div>
  `;

  const scratchWrap = document.createElement('div');
  scratchWrap.className = 'scratch-area-wrap';
  const content = document.createElement('div');
  content.className = 'scratch-content';
  scratchWrap.appendChild(content);

  if (card.type === 'lucky-number-rows') renderCard1Body(card, content);
  if (card.type === 'combo-chain') renderCard2Body(card, content);
  if (card.type === 'grid-collect') renderCard3Body(card, content);

  const canvas = document.createElement('canvas');
  canvas.className = 'scratch-canvas';
  scratchWrap.appendChild(canvas);

  wrap.appendChild(scratchWrap);

  const resultBox = document.createElement('div');
  resultBox.className = 'card-result';
  resultBox.style.display = 'none';
  wrap.appendChild(resultBox);

  container.appendChild(wrap);
  return { wrap, canvas, content, resultBox };
}

function renderCard1Body(card, root) {
  const banner = document.createElement('div');
  banner.className = 'lucky-banner';
  banner.innerHTML = `<span>幸运数字</span><span class="lucky-num">${card.luckyNumber}</span>`;
  root.appendChild(banner);
  card.rows.forEach((row, idx) => {
    const line = document.createElement('div');
    line.className = 'row-line';
    line.dataset.rowIdx = String(idx);
    const cells = document.createElement('div');
    cells.className = 'row-cells';
    row.cells.forEach((c) => {
      const cell = document.createElement('div');
      cell.className = 'cell' + (c.value === card.luckyNumber ? ' target' : '');
      cell.textContent = c.value;
      cells.appendChild(cell);
    });
    const prize = document.createElement('div');
    prize.className = 'row-prize';
    prize.textContent = `$${row.prize}`;
    line.appendChild(cells);
    line.appendChild(prize);
    root.appendChild(line);
  });
}

function renderCard2Body(card, root) {
  card.regions.forEach((r, idx) => {
    const region = document.createElement('div');
    region.className = 'region';
    region.dataset.regionIdx = String(idx);
    region.innerHTML = `
      <div class="region-header">
        <span>第 ${idx + 1} 区 · 目标 <span class="target-badge">${r.target}</span></span>
        <span class="region-prize">$${r.prize}</span>
      </div>
    `;
    const cells = document.createElement('div');
    cells.className = 'region-cells';
    r.cells.forEach((c) => {
      const cell = document.createElement('div');
      cell.className = 'cell' + (c.value === r.target ? ' target' : '');
      cell.textContent = c.value;
      cells.appendChild(cell);
    });
    region.appendChild(cells);
    root.appendChild(region);
  });
}

function renderCard3Body(card, root) {
  const banner = document.createElement('div');
  banner.className = 'targets-banner';
  banner.innerHTML = `<span>目标:</span>` +
    card.targets.map((t) => `<span class="target">${t}</span>`).join('');
  root.appendChild(banner);
  const grid = document.createElement('div');
  grid.className = 'grid-content';
  grid.style.gridTemplateColumns = `repeat(${card.cols}, 1fr)`;
  const targetSet = new Set(card.targets);
  card.cells.forEach((c) => {
    const cell = document.createElement('div');
    cell.className = 'cell' + (targetSet.has(c.value) ? ' target' : '');
    cell.textContent = c.value;
    grid.appendChild(cell);
  });
  root.appendChild(grid);
}

export function applyResultStyling(card, result, root) {
  if (card.type === 'lucky-number-rows' && result.wonRows) {
    result.wonRows.forEach((idx) => {
      const line = root.querySelector(`[data-row-idx="${idx}"]`);
      if (line) line.classList.add('won');
    });
    result.nearMisses.forEach((idx) => {
      const line = root.querySelector(`[data-row-idx="${idx}"]`);
      if (line) line.classList.add('near-miss');
    });
  } else if (card.type === 'combo-chain' && result.wonRegions) {
    result.wonRegions.forEach((idx) => {
      const region = root.querySelector(`[data-region-idx="${idx}"]`);
      if (region) region.classList.add('won');
    });
    card.regions.forEach((_, idx) => {
      if (idx > result.wonRegions.length - 1 && idx > 0 && !result.wonRegions.includes(idx)) {
        if (idx > (result.wonRegions[result.wonRegions.length - 1] ?? -1) + 1) {
          const region = root.querySelector(`[data-region-idx="${idx}"]`);
          if (region) region.classList.add('locked');
        }
      }
    });
  }
}
