export function pathTiles(path) {
  const tiles = [];
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, ay] = path[i];
    const [bx, by] = path[i + 1];
    const dx = Math.sign(bx - ax);
    const dy = Math.sign(by - ay);
    let x = ax, y = ay;
    tiles.push([x, y]);
    while (x !== bx || y !== by) {
      x += dx;
      y += dy;
      tiles.push([x, y]);
    }
  }
  return tiles;
}

function cachedPathTileSet(level) {
  if (!level._pathTileSet) {
    level._pathTileSet = new Set(pathTiles(level.path).map(([x, y]) => `${x},${y}`));
  }
  return level._pathTileSet;
}

export function isPathTile(col, row, path, level) {
  if (level) return cachedPathTileSet(level).has(`${col},${row}`);
  return pathTiles(path).some(([x, y]) => x === col && y === row);
}

// Small deterministic PRNG so the decoration layout is stable between frames
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function planDecorations(level) {
  if (level._decorations) return level._decorations;
  const { cols, rows, tile } = level.grid;
  const pathSet = cachedPathTileSet(level);
  const rng = mulberry32(42);
  const items = [];

  // 2-3 craters on grass tiles, avoiding path
  let craters = 0;
  for (let tries = 0; tries < 40 && craters < 3; tries++) {
    const c = Math.floor(rng() * cols);
    const r = Math.floor(rng() * rows);
    if (pathSet.has(`${c},${r}`)) continue;
    items.push({ kind: 'crater', x: c * tile + tile / 2, y: r * tile + tile / 2, w: 40, h: 40 });
    craters++;
  }

  // Sandbags adjacent to path (tactical flavor)
  let sandbags = 0;
  for (let tries = 0; tries < 60 && sandbags < 3; tries++) {
    const c = Math.floor(rng() * cols);
    const r = Math.floor(rng() * rows);
    if (pathSet.has(`${c},${r}`)) continue;
    const adjacent = [[c - 1, r], [c + 1, r], [c, r - 1], [c, r + 1]]
      .some(([nc, nr]) => pathSet.has(`${nc},${nr}`));
    if (!adjacent) continue;
    items.push({ kind: 'sandbag', x: c * tile + tile / 2, y: r * tile + tile / 2 + 4, w: 44, h: 28 });
    sandbags++;
  }

  // Barbed wire along top edge (atmosphere)
  items.push({ kind: 'barbwire', x: 0, y: 0, w: cols * tile, h: 20 });

  level._decorations = items;
  return items;
}

export function drawMap(ctx, level, sprites) {
  const { cols, rows, tile } = level.grid;
  const pathSet = cachedPathTileSet(level);
  const grass = sprites.tiles.grass;
  const dirt = sprites.tiles.dirt;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const isPath = pathSet.has(`${x},${y}`);
      const img = isPath ? dirt : grass;
      ctx.drawImage(img, x * tile, y * tile, tile, tile);
    }
  }

  // Path direction markers at waypoints (subtle arrow hint)
  for (let i = 0; i < level.path.length - 1; i++) {
    const [ax, ay] = level.path[i];
    const [bx, by] = level.path[i + 1];
    const cx = ((ax + bx) / 2) * tile + tile / 2;
    const cy = ((ay + by) / 2) * tile + tile / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Decorations (craters, sandbags, wire)
  const decor = planDecorations(level);
  for (const d of decor) {
    const img = sprites.decor[d.kind];
    if (!img) continue;
    ctx.drawImage(img, d.x - d.w / 2, d.y - d.h / 2, d.w, d.h);
  }

  // Start / end markers (spawn flag + base marker)
  const [sx, sy] = level.path[0];
  const [ex, ey] = level.path[level.path.length - 1];
  drawSpawnMarker(ctx, sx * tile + tile / 2, sy * tile + tile / 2);
  drawBaseMarker(ctx, ex * tile + tile / 2, ey * tile + tile / 2);
}

function drawSpawnMarker(ctx, x, y) {
  ctx.fillStyle = 'rgba(160,30,30,0.85)';
  ctx.beginPath();
  ctx.moveTo(x - 10, y - 14);
  ctx.lineTo(x - 10, y + 14);
  ctx.lineTo(x - 8, y + 14);
  ctx.lineTo(x - 8, y - 12);
  ctx.lineTo(x + 6, y - 10);
  ctx.lineTo(x + 6, y - 2);
  ctx.lineTo(x - 8, y - 4);
  ctx.closePath();
  ctx.fill();
}

function drawBaseMarker(ctx, x, y) {
  ctx.fillStyle = 'rgba(70,100,50,0.6)';
  ctx.fillRect(x - 16, y - 16, 32, 32);
  ctx.strokeStyle = '#d4c585';
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 16, y - 16, 32, 32);
  ctx.strokeStyle = '#aa9060';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 12, y - 12);
  ctx.lineTo(x + 12, y + 12);
  ctx.moveTo(x + 12, y - 12);
  ctx.lineTo(x - 12, y + 12);
  ctx.stroke();
  ctx.font = 'bold 11px sans-serif';
  ctx.fillStyle = '#fff5c0';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('基地', x, y);
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
}

export function tileCenter(col, row, tile) {
  return { x: col * tile + tile / 2, y: row * tile + tile / 2 };
}
