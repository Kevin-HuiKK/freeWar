const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let lastT = 0;
function loop(t) {
  const dt = (t - lastT) / 1000;
  lastT = t;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  ctx.font = '20px sans-serif';
  ctx.fillText(`dt=${dt.toFixed(3)}`, 10, 30);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
