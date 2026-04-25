import {
  upgradeCost,
  effectiveLuckBonus,
  effectiveMultiplier,
  effectiveScalePct
} from './state.js';

const ORDER = ['luck', 'multiplier', 'scale'];

function effectText(key, state, upgradesData) {
  if (key === 'luck') return `+${Math.round(effectiveLuckBonus(state, upgradesData) * 100)}%`;
  if (key === 'multiplier') return `×${effectiveMultiplier(state, upgradesData).toFixed(1)}`;
  if (key === 'scale') return `${Math.round(effectiveScalePct(state, upgradesData) * 100)}%`;
  return '';
}

export function renderUpgrades(container, state, upgradesData, callbacks) {
  container.innerHTML = '';
  for (const key of ORDER) {
    const def = upgradesData[key];
    if (!def) continue;
    const lvl = state.upgrades[key] || 0;
    const maxed = lvl >= def.maxLevel;
    const cost = maxed ? 0 : upgradeCost(def, lvl);
    const affordable = !maxed && state.money >= cost;

    const row = document.createElement('div');
    row.className = 'upgrade-row';
    row.innerHTML = `
      <div class="info">
        <div class="title">${def.name} <span style="color:var(--text-dim);font-weight:400;">Lv.${lvl} / ${def.maxLevel}</span> · ${effectText(key, state, upgradesData)}</div>
        <div class="meta">${def.desc}</div>
      </div>
      <button type="button"${(maxed || !affordable) ? ' disabled' : ''}>${maxed ? '已满级' : `$${cost}`}</button>
    `;
    const btn = row.querySelector('button');
    if (!maxed && affordable) {
      btn.addEventListener('click', () => callbacks.onUpgrade(key));
    }
    container.appendChild(row);
  }
}
