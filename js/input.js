export function attachCanvasClick(canvas, tileSize, onTileClick) {
  canvas.addEventListener('click', (ev) => {
    const rect = canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    const col = Math.floor(x / tileSize);
    const row = Math.floor(y / tileSize);
    onTileClick(col, row);
  });
}

export function buildUnitMenu(menuEl, unitsData, onSelect) {
  menuEl.innerHTML = '';
  const heading = document.createElement('div');
  heading.textContent = '选择要放置的单位';
  heading.style.fontSize = '13px';
  heading.style.opacity = '0.7';
  heading.style.marginBottom = '4px';
  menuEl.appendChild(heading);

  const buttons = {};
  for (const [key, u] of Object.entries(unitsData)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.unit = key;
    btn.style.cssText = [
      'padding:8px 10px',
      'border:2px solid #555',
      'border-radius:4px',
      'background:#333',
      'color:#eee',
      'cursor:pointer',
      'text-align:left',
      'font-family:inherit'
    ].join(';');
    btn.innerHTML = `<strong style="color:${u.color}">■</strong> ${u.name} <span style="float:right;opacity:0.7">$${u.cost}</span>`;
    btn.addEventListener('click', () => onSelect(key));
    menuEl.appendChild(btn);
    buttons[key] = btn;
  }

  return {
    setSelected(key) {
      for (const [k, b] of Object.entries(buttons)) {
        b.style.borderColor = k === key ? '#fc0' : '#555';
      }
    },
    setAffordable(goldChecker) {
      for (const [k, b] of Object.entries(buttons)) {
        b.style.opacity = goldChecker(unitsData[k].cost) ? '1' : '0.45';
      }
    }
  };
}
