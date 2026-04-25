export function attachScratch(canvas, opts = {}) {
  const onProgress = opts.onProgress || (() => {});
  const onReveal = opts.onReveal || (() => {});
  const threshold = opts.threshold ?? 0.6;
  const brushRadius = opts.brushRadius ?? 28;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  let dpr = Math.max(1, window.devicePixelRatio || 1);
  let cssW = 0, cssH = 0;
  let scaled = false;
  let drawing = false;
  let lastX = 0, lastY = 0;
  let lastSampleAt = 0;
  let revealed = false;
  let lastPct = 0;
  let pending = false;

  function fillCoating() {
    if (cssW <= 0 || cssH <= 0) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);
    scaled = true;

    const grad = ctx.createLinearGradient(0, 0, cssW, cssH);
    grad.addColorStop(0, '#8b7ab0');
    grad.addColorStop(0.5, '#7a6a98');
    grad.addColorStop(1, '#5d4f7a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cssW, cssH);

    const dotCount = Math.floor(cssW * cssH * 0.0005);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < dotCount; i++) {
      const x = Math.random() * cssW;
      const y = Math.random() * cssH;
      const r = Math.random() * 1.4 + 0.3;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    for (let i = 0; i < 12; i++) {
      const x = Math.random() * cssW;
      const y = Math.random() * cssH;
      drawSparkle(x, y, 6 + Math.random() * 6);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `700 ${Math.max(18, Math.min(cssW, cssH) * 0.12)}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 6;
    ctx.fillText('刮一刮 →', cssW / 2, cssH / 2);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function drawSparkle(x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.lineTo(x + s * 0.2, y - s * 0.2);
    ctx.lineTo(x + s, y);
    ctx.lineTo(x + s * 0.2, y + s * 0.2);
    ctx.lineTo(x, y + s);
    ctx.lineTo(x - s * 0.2, y + s * 0.2);
    ctx.lineTo(x - s, y);
    ctx.lineTo(x - s * 0.2, y - s * 0.2);
    ctx.closePath();
    ctx.fill();
  }

  function resize() {
    const parent = canvas.parentElement;
    if (!parent) return;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    if (w <= 0 || h <= 0) {
      if (!pending) {
        pending = true;
        requestAnimationFrame(() => { pending = false; resize(); });
      }
      return;
    }
    dpr = Math.max(1, window.devicePixelRatio || 1);
    cssW = w; cssH = h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    if (!revealed) fillCoating();
  }

  function pointFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  }

  function startStroke(e) {
    if (revealed) return;
    drawing = true;
    const p = pointFromEvent(e);
    lastX = p.x; lastY = p.y;
    stamp(p.x, p.y);
  }

  function moveStroke(e) {
    if (!drawing || revealed) return;
    if (e.cancelable) e.preventDefault();
    const p = pointFromEvent(e);
    drawSegment(lastX, lastY, p.x, p.y);
    lastX = p.x; lastY = p.y;
    maybeSample();
  }

  function endStroke() {
    if (!drawing) return;
    drawing = false;
    maybeSample(true);
  }

  function stamp(x, y) {
    if (!scaled) return;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, brushRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawSegment(x0, y0, x1, y1) {
    if (!scaled) return;
    const dx = x1 - x0, dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    const step = Math.max(2, brushRadius * 0.4);
    const n = Math.max(1, Math.ceil(dist / step));
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      ctx.beginPath();
      ctx.arc(x0 + dx * t, y0 + dy * t, brushRadius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function maybeSample(force) {
    const now = performance.now();
    if (!force && now - lastSampleAt < 150) return;
    lastSampleAt = now;
    const pct = samplePct();
    if (pct !== lastPct) {
      lastPct = pct;
      onProgress(pct);
    }
    if (pct >= threshold) revealAll();
  }

  function samplePct() {
    if (canvas.width <= 0 || canvas.height <= 0) return 0;
    const grid = 64;
    let cleared = 0;
    let total = 0;
    const w = canvas.width, h = canvas.height;
    const stepX = Math.max(1, Math.floor(w / grid));
    const stepY = Math.max(1, Math.floor(h / grid));
    try {
      for (let y = 0; y < h; y += stepY) {
        for (let x = 0; x < w; x += stepX) {
          const px = ctx.getImageData(x, y, 1, 1).data;
          if (px[3] < 16) cleared++;
          total++;
        }
      }
    } catch (e) {
      return 0;
    }
    return total ? cleared / total : 0;
  }

  function revealAll() {
    if (revealed) return;
    revealed = true;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    canvas.classList.add('revealed');
    onProgress(1);
    onReveal();
  }

  function onResize() { resize(); }

  canvas.addEventListener('mousedown', startStroke);
  window.addEventListener('mousemove', moveStroke);
  window.addEventListener('mouseup', endStroke);
  canvas.addEventListener('touchstart', startStroke, { passive: true });
  canvas.addEventListener('touchmove', moveStroke, { passive: false });
  canvas.addEventListener('touchend', endStroke);
  canvas.addEventListener('touchcancel', endStroke);
  window.addEventListener('resize', onResize);

  requestAnimationFrame(resize);

  function destroy() {
    canvas.removeEventListener('mousedown', startStroke);
    window.removeEventListener('mousemove', moveStroke);
    window.removeEventListener('mouseup', endStroke);
    canvas.removeEventListener('touchstart', startStroke);
    canvas.removeEventListener('touchmove', moveStroke);
    canvas.removeEventListener('touchend', endStroke);
    canvas.removeEventListener('touchcancel', endStroke);
    window.removeEventListener('resize', onResize);
  }

  return { revealAll, destroy };
}
