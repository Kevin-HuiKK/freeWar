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

/**
 * Build a list of hero purchase cards.
 * Selecting one triggers the purchase (not placement — heroes spawn at flag).
 */
export function buildHeroMenu(listEl, heroesData, onBuy) {
  listEl.innerHTML = '';
  const btns = {};
  for (const [key, h] of Object.entries(heroesData)) {
    const el = document.createElement('div');
    el.className = 'mc hero-mc';
    el.innerHTML = `
      <div class="mc-icon"><img src="../assets/sprites/units/${h.sprite}.svg" alt=""/></div>
      <div class="mc-meta">
        <div class="mc-name">${h.name}</div>
        <div class="mc-role">${h.skill.name} · CD ${h.skill.cooldown}s</div>
        <div class="mc-cost">$${h.cost}</div>
      </div>`;
    el.addEventListener('click', () => {
      if (el.classList.contains('locked')) return;
      onBuy(key);
    });
    listEl.appendChild(el);
    btns[key] = el;
  }
  return {
    setAffordable(fn, hasActive) {
      for (const [k, b] of Object.entries(btns)) {
        b.classList.toggle('locked', hasActive || !fn(heroesData[k].cost));
      }
    }
  };
}

/**
 * Show or hide the "active hero" panel on the left sidebar.
 */
export function showActiveHero(hero, skill) {
  $('hero-active').hidden = false;
  $('hero-portrait-img').src = `../assets/sprites/units/${hero.typeKey === 'captain' ? 'rifleman' : hero.typeKey === 'medic' ? 'archer' : 'sniper'}.svg`;
  $('hero-name').textContent = hero.name;
  $('hero-title').textContent = hero.title;
  $('skill-name').textContent = skill.name;
  $('skill-hint').textContent = 'READY';
}

export function hideActiveHero() {
  $('hero-active').hidden = true;
}

/**
 * Called every frame while an active hero exists.
 */
export function updateHeroPanel(hero) {
  const ratio = Math.max(0, hero.hp / hero.maxHp);
  $('hero-hp-fill').style.width = (ratio * 100) + '%';
  $('hero-hp-text').textContent = `${Math.ceil(hero.hp)}/${hero.maxHp}`;

  const btn = $('skill-btn');
  const circle = $('skill-cd-circle');
  const hint = $('skill-hint');
  const cd = hero.skill.cooldownLeft;
  const total = hero.skill.cooldown;

  if (cd > 0) {
    btn.disabled = true;
    btn.classList.remove('active');
    hint.textContent = `CD ${cd.toFixed(1)}s`;
    const circumference = 2 * Math.PI * 15;
    const offset = circumference * (1 - cd / total);
    circle.setAttribute('stroke-dashoffset', offset);
  } else {
    btn.disabled = false;
    hint.textContent = '准备就绪 · 点击激活';
    circle.setAttribute('stroke-dashoffset', 0);
  }
}

export function setSkillTargetingMode(active) {
  const btn = $('skill-btn');
  const canvas = document.getElementById('game');
  const field = document.getElementById('field');
  btn.classList.toggle('active', active);
  canvas.classList.toggle('targeting', active);
  field.classList.toggle('targeting-mode', active);
  $('skill-hint').textContent = active ? '点地图施放 · ESC 取消' : ($('skill-btn').disabled ? '冷却中' : '准备就绪 · 点击激活');
}
