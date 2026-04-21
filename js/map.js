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

export function isPathTile(col, row, path) {
  return pathTiles(path).some(([x, y]) => x === col && y === row);
}

export function drawMap(ctx, level) {
  const { cols, rows, tile } = level.grid;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      ctx.fillStyle = '#3a5f3a';
      ctx.fillRect(x * tile, y * tile, tile, tile);
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.strokeRect(x * tile, y * tile, tile, tile);
    }
  }

  for (const [x, y] of pathTiles(level.path)) {
    ctx.fillStyle = '#c4a36c';
    ctx.fillRect(x * tile, y * tile, tile, tile);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.strokeRect(x * tile, y * tile, tile, tile);
  }

  const start = level.path[0];
  const end = level.path[level.path.length - 1];
  ctx.fillStyle = '#2a7';
  ctx.fillRect(start[0] * tile + 8, start[1] * tile + 8, tile - 16, tile - 16);
  ctx.fillStyle = '#c33';
  ctx.fillRect(end[0] * tile + 8, end[1] * tile + 8, tile - 16, tile - 16);
}

export function tileCenter(col, row, tile) {
  return { x: col * tile + tile / 2, y: row * tile + tile / 2 };
}
