const UNIT_KEYS = ['militia', 'archer', 'rifleman', 'sniper', 'apc'];
const ENEMY_KEYS = ['lightInfantry', 'heavyInfantry', 'lightVehicle'];
const TILE_KEYS = ['grass', 'dirt'];
const DECOR_KEYS = ['sandbag', 'barbwire', 'crater'];

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

export async function loadSprites() {
  const unitEntries = UNIT_KEYS.map(k => [k, `assets/sprites/units/${k}.svg`]);
  const enemyEntries = ENEMY_KEYS.map(k => [k, `assets/sprites/enemies/${k}.svg`]);
  const tileEntries = TILE_KEYS.map(k => [k, `assets/sprites/tiles/${k}.svg`]);
  const decorEntries = DECOR_KEYS.map(k => [k, `assets/sprites/decor/${k}.svg`]);
  const projectileEntry = ['projectile', 'assets/sprites/projectile.svg'];

  const all = [
    ...unitEntries,
    ...enemyEntries,
    ...tileEntries,
    ...decorEntries,
    projectileEntry
  ];

  const loaded = await Promise.all(all.map(([, src]) => loadImage(src)));

  const collect = (entries, offset) => Object.fromEntries(
    entries.map(([k], i) => [k, loaded[offset + i]])
  );

  return {
    units:    collect(unitEntries, 0),
    enemies:  collect(enemyEntries, UNIT_KEYS.length),
    tiles:    collect(tileEntries, UNIT_KEYS.length + ENEMY_KEYS.length),
    decor:    collect(decorEntries, UNIT_KEYS.length + ENEMY_KEYS.length + TILE_KEYS.length),
    projectile: loaded[loaded.length - 1]
  };
}
