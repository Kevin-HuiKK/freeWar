const $ = (id) => document.getElementById(id);

export function buildUnitMenu(listEl, unitsData, onSelect) {
  listEl.innerHTML = '';
  const btns = {};
  for (const [key, u] of Object.entries(unitsData)) {
    const el = document.createElement('div');
    el.className = 'mc';
    el.innerHTML = `
      <div class="mc-icon"><img src="../assets/sprites/units/${u.sprite}.svg" alt=""/></div>
      <div class="mc-meta">
        <div class="mc-name">${u.name}</div>
        <div class="mc-role">${u.role}</div>
        <div class="mc-cost">$${u.cost}</div>
      </div>`;
    el.addEventListener('click', () => {
      if (el.classList.contains('locked')) return;
      onSelect('unit', key);
    });
    listEl.appendChild(el);
    btns[key] = el;
  }
  return {
    setSelected(key) {
      for (const [k, b] of Object.entries(btns)) b.classList.toggle('selected', k === key);
    },
    setAffordable(fn) {
      for (const [k, b] of Object.entries(btns)) b.classList.toggle('locked', !fn(unitsData[k].cost));
    }
  };
}

export function buildBuildingMenu(listEl, buildingsData, onSelect) {
  listEl.innerHTML = '';
  const btns = {};
  for (const [key, b] of Object.entries(buildingsData)) {
    const el = document.createElement('div');
    el.className = 'mc';
    el.innerHTML = `
      <div class="mc-icon">${renderBuildingIcon(key, b)}</div>
      <div class="mc-meta">
        <div class="mc-name">${b.name}</div>
        <div class="mc-role">${b.role}</div>
        <div class="mc-cost">$${b.cost}</div>
      </div>`;
    el.addEventListener('click', () => {
      if (el.classList.contains('locked')) return;
      onSelect('building', key);
    });
    listEl.appendChild(el);
    btns[key] = el;
  }
  return {
    setSelected(key) {
      for (const [k, b] of Object.entries(btns)) b.classList.toggle('selected', k === key);
    },
    setAffordable(fn) {
      for (const [k, b] of Object.entries(btns)) b.classList.toggle('locked', !fn(buildingsData[k].cost));
    }
  };
}

function renderBuildingIcon(key, cfg) {
  const c = cfg.color;
  switch (key) {
    case 'turret':
      return `<svg viewBox="0 0 36 36"><rect x="6" y="6" width="24" height="24" fill="${c}" stroke="#1a2010"/><circle cx="18" cy="18" r="7" fill="#2a3418"/><rect x="22" y="17" width="10" height="2" fill="#1a1a1a"/></svg>`;
    case 'cannon':
      return `<svg viewBox="0 0 36 36"><rect x="5" y="5" width="26" height="26" fill="${c}" stroke="#1a1008"/><circle cx="18" cy="18" r="8" fill="#2a1810"/><rect x="24" y="17" width="12" height="3" fill="#1a1a1a"/></svg>`;
    case 'goldmine':
      return `<svg viewBox="0 0 36 36"><rect x="4" y="6" width="28" height="24" rx="2" fill="${c}" stroke="#d4a43a" stroke-width="1.5"/><text x="18" y="25" text-anchor="middle" font-family="Black Ops One,Impact" font-size="18" fill="#ffd46a">$</text></svg>`;
    case 'sandbag':
      return `<svg viewBox="0 0 36 36"><ellipse cx="18" cy="22" rx="12" ry="4" fill="#a08550"/><ellipse cx="12" cy="18" rx="9" ry="3" fill="#8a7045"/><ellipse cx="24" cy="18" rx="9" ry="3" fill="#8a7045"/><ellipse cx="18" cy="14" rx="9" ry="3" fill="#b29870"/></svg>`;
    default: return '';
  }
}

export function updateHud({ gold, allyFlag, enemyFlag, elapsedSec, protocol }) {
  $('hud-gold').textContent = String(gold);
  $('hud-ally-flag').textContent = `${allyFlag.hp}/${allyFlag.maxHp}`;
  $('hud-enemy-flag').textContent = `${enemyFlag.hp}/${enemyFlag.maxHp}`;
  $('hud-ally-fill').style.width = (allyFlag.ratio * 100) + '%';
  $('hud-enemy-fill').style.width = (enemyFlag.ratio * 100) + '%';
  const m = Math.floor(elapsedSec / 60), s = Math.floor(elapsedSec % 60);
  const mmss = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  $('hud-timer').textContent = mmss;
  $('field-zoom').textContent = `▶ LIVE · T ${mmss}`;
  if (protocol) $('hud-protocol').textContent = protocol;
}

export function updateStatus({ allyCount, enemyCount, structureCount, structureMax }) {
  $('stat-units').textContent = `己方 ${allyCount} · 敌方 ${enemyCount}`;
  $('stat-structures').textContent = `建筑 ${structureCount} / ${structureMax}`;
}

export function showToast(msg, ms = 1400) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { t.hidden = true; }, ms);
}

export function showEnd(result) {
  $('end-text').textContent = result === 'win' ? '胜利！' : '失败';
  $('end-text').style.color = result === 'win' ? '#ffeb6b' : '#ff6b6b';
  $('end-sub').textContent = result === 'win' ? 'ENEMY FLAG · CAPTURED' : 'ALLY FLAG · LOST';
  $('end-overlay').hidden = false;
}

export function hideEnd() { $('end-overlay').hidden = true; }
