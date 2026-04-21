import { drawMap } from './map.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const level = await fetch('data/levels.json').then(r => r.json()).then(d => d.hopeLayer);

let lastT = 0;
function loop(t) {
  const dt = (t - lastT) / 1000;
  lastT = t;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawMap(ctx, level);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
