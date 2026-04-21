const UNIT_SPRITES = ['militia', 'archer', 'rifleman', 'sniper', 'apc'];

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

export async function loadSprites() {
  const entries = UNIT_SPRITES.map(k => [k, `../assets/sprites/units/${k}.svg`]);
  const loaded = await Promise.all(entries.map(([, src]) => loadImage(src)));
  const units = Object.fromEntries(entries.map(([k], i) => [k, loaded[i]]));
  const projectile = await loadImage(`../assets/sprites/projectile.svg`);
  return { units, projectile };
}
