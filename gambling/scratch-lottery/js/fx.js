const GRAVITY = 400;

function layer() {
  return document.getElementById('fx-layer');
}

export function spawnParticles(x, y, count = 24, options = {}) {
  if (document.hidden) return;
  const host = layer();
  if (!host) return;
  const color = options.color || '#ffd33d';
  const parts = [];
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'particle';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.background = color;
    el.style.boxShadow = `0 0 8px ${color}`;
    el.style.transform = 'translate(-50%,-50%)';
    host.appendChild(el);
    const ang = Math.random() * Math.PI * 2;
    const speed = 80 + Math.random() * 120;
    parts.push({
      el,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      ox: 0, oy: 0,
      life: 0.8 + Math.random() * 0.4
    });
  }

  let last = performance.now();
  const start = last;

  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const elapsed = (now - start) / 1000;
    let alive = 0;
    for (const p of parts) {
      if (!p.el) continue;
      p.vy += GRAVITY * dt;
      p.ox += p.vx * dt;
      p.oy += p.vy * dt;
      const t = elapsed / p.life;
      if (t >= 1) {
        p.el.remove();
        p.el = null;
        continue;
      }
      alive++;
      const op = 1 - t;
      p.el.style.opacity = String(op);
      p.el.style.transform = `translate(calc(-50% + ${p.ox}px), calc(-50% + ${p.oy}px))`;
    }
    if (alive > 0) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

export function floatText(x, y, text, options = {}) {
  if (document.hidden) return;
  const host = layer();
  if (!host) return;
  const duration = options.duration ?? 1600;
  const el = document.createElement('div');
  el.className = 'float-text';
  el.textContent = text;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.style.transform = 'translate(-50%,-50%)';
  if (options.color) el.style.color = options.color;
  if (options.size) el.style.fontSize = typeof options.size === 'number' ? options.size + 'px' : options.size;
  if (duration !== 1600) el.style.animationDuration = (duration / 1000) + 's';
  host.appendChild(el);
  setTimeout(() => el.remove(), duration + 50);
}

export function bigWinFlash() {
  if (document.hidden) return;
  const host = layer();
  if (!host) return;
  const el = document.createElement('div');
  el.className = 'flash-overlay';
  host.appendChild(el);
  setTimeout(() => el.remove(), 700);
}

export function nearMissPulse(targetEl) {
  if (!targetEl) return;
  targetEl.classList.add('near-miss');
  setTimeout(() => targetEl.classList.remove('near-miss'), 600);
}

export function shake(el, intensity = 1) {
  if (!el) return;
  const amp = 6 * intensity;
  const start = performance.now();
  const duration = 300;
  const prev = el.style.transform;
  function tick(now) {
    const t = (now - start) / duration;
    if (t >= 1) {
      el.style.transform = prev;
      return;
    }
    const decay = 1 - t;
    const dx = (Math.random() * 2 - 1) * amp * decay;
    const dy = (Math.random() * 2 - 1) * amp * decay;
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
