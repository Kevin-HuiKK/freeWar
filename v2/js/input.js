/**
 * Attach canvas click + hover tracking.
 * Also enables click-drag to pan the scrollable field when clicking outside any cell.
 */
export function attachCanvasInput(canvas, field, { onClick, onHover, onLeave }) {
  const getPos = (ev) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (ev.clientX - rect.left) * scaleX,
      y: (ev.clientY - rect.top) * scaleY
    };
  };

  const clickHandler = (ev) => {
    const p = getPos(ev);
    onClick(p.x, p.y);
  };
  const moveHandler = (ev) => {
    const p = getPos(ev);
    onHover(p.x, p.y);
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

/**
 * Minimap scroll sync — moves the viewport rect as the user scrolls the field
 * and lets the user click/drag on the minimap to jump/pan.
 */
export function attachMinimap(field, minimapSvg, viewportRect, mmW = 240, mmH = 90) {
  function sync() {
    const sw = field.scrollWidth;
    const sh = field.scrollHeight;
    if (!sw || !sh) return;
    const x = (field.scrollLeft / sw) * mmW;
    const y = (field.scrollTop / sh) * mmH;
    const w = (field.clientWidth / sw) * mmW;
    const h = (field.clientHeight / sh) * mmH;
    viewportRect.setAttribute('x', x);
    viewportRect.setAttribute('y', y);
    viewportRect.setAttribute('width', w);
    viewportRect.setAttribute('height', h);
  }
  field.addEventListener('scroll', sync);
  window.addEventListener('resize', sync);

  const jump = (ev) => {
    const rect = minimapSvg.getBoundingClientRect();
    const mx = (ev.clientX - rect.left) / rect.width;
    const my = (ev.clientY - rect.top) / rect.height;
    field.scrollLeft = mx * field.scrollWidth - field.clientWidth / 2;
    field.scrollTop  = my * field.scrollHeight - field.clientHeight / 2;
  };
  minimapSvg.addEventListener('click', jump);
  return { sync };
}

export function updateMinimapUnits(svgGroup, entities) {
  svgGroup.innerHTML = '';
  for (const e of entities) {
    if (!e.alive) continue;
    const mx = (e.x / 2400) * 240;
    const my = (e.y / 900) * 90;
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', mx);
    dot.setAttribute('cy', my);
    dot.setAttribute('r', e.kind === 'defense' || e.kind === 'building' ? 1.4 : 1.2);
    dot.setAttribute('fill', e.team === 'ally' ? '#6abef2' : '#ff7060');
    svgGroup.appendChild(dot);
  }
}
