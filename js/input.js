export function buildUnitMenu(menuEl, unitsData, sprites, onSelect) {
  menuEl.innerHTML = '<div class="menu-title">放置单位</div>';

  const buttons = {};
  for (const [key, u] of Object.entries(unitsData)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'unit-btn';
    btn.dataset.unit = key;

    const icon = document.createElement('div');
    icon.className = 'unit-icon';
    const img = document.createElement('img');
    img.alt = u.name;
    img.src = `assets/sprites/units/${key}.svg`;
    icon.appendChild(img);

    const meta = document.createElement('div');
    meta.className = 'unit-meta';
    meta.innerHTML = `<div class="unit-name">${u.name}</div><div class="unit-cost">$${u.cost}</div>`;

    btn.appendChild(icon);
    btn.appendChild(meta);
    btn.addEventListener('click', () => {
      if (btn.classList.contains('locked')) return;
      onSelect(key);
    });
    menuEl.appendChild(btn);
    buttons[key] = btn;
  }

  return {
    setSelected(key) {
      for (const [k, b] of Object.entries(buttons)) {
        b.classList.toggle('selected', k === key);
      }
    },
    setAffordable(canAfford) {
      for (const [k, b] of Object.entries(buttons)) {
        b.classList.toggle('locked', !canAfford(k));
      }
    }
  };
}

export function attachCanvasInput(canvas, tileSize, { onClick, onHover, onLeave }) {
  const getCell = (ev) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (ev.clientX - rect.left) * scaleX;
    const y = (ev.clientY - rect.top) * scaleY;
    return {
      col: Math.floor(x / tileSize),
      row: Math.floor(y / tileSize),
      px: x,
      py: y
    };
  };

  const clickHandler = (ev) => {
    const c = getCell(ev);
    onClick(c.col, c.row, c.px, c.py);
  };
  const moveHandler = (ev) => {
    const c = getCell(ev);
    onHover(c.col, c.row);
  };
  const leaveHandler = () => onLeave();

  canvas.addEventListener('click', clickHandler);
  canvas.addEventListener('mousemove', moveHandler);
  canvas.addEventListener('mouseleave', leaveHandler);

  return () => {
    canvas.removeEventListener('click', clickHandler);
    canvas.removeEventListener('mousemove', moveHandler);
    canvas.removeEventListener('mouseleave', leaveHandler);
  };
}

export function updateHud({ gold, baseHP, maxBaseHP, waveIdx, totalWaves, levelName }) {
  document.getElementById('hud-gold').textContent = String(gold);
  document.getElementById('hud-base').textContent = `${baseHP}/${maxBaseHP}`;
  document.getElementById('hud-wave-label').textContent = `${waveIdx}/${totalWaves}`;
  document.getElementById('hud-wave-fill').style.width = `${(waveIdx / totalWaves) * 100}%`;
  document.getElementById('hud-level').textContent = levelName;
}

export function showToast(message, duration = 1500) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.hidden = false;
  el.classList.remove('toast-anim');
  void el.offsetWidth;
  el.classList.add('toast-anim');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { el.hidden = true; }, duration);
}
