import { tileCenter } from './map.js';
import { pickTarget } from './combat.js';
import { Projectile } from './projectile.js';

export class Unit {
  constructor(typeKey, config, col, row, tile) {
    this.typeKey = typeKey;
    this.name = config.name;
    this.damage = config.damage;
    this.range = config.range;
    this.fireRate = config.fireRate;
    this.color = config.color;
    this.projectileColor = config.projectileColor;
    this.col = col;
    this.row = row;
    this.tile = tile;
    const c = tileCenter(col, row, tile);
    this.x = c.x;
    this.y = c.y;
    this.cooldown = 0;
  }

  update(dt, enemies, spawnProjectile) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.cooldown > 0) return;
    const target = pickTarget(this, enemies);
    if (!target) return;
    spawnProjectile(new Projectile(this.x, this.y, target, this.damage, this.projectileColor));
    this.cooldown = 1 / this.fireRate;
  }

  draw(ctx) {
    const half = this.tile * 0.35;
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x - half, this.y - half, half * 2, half * 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.strokeRect(this.x - half, this.y - half, half * 2, half * 2);

    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.range * this.tile, 0, Math.PI * 2);
    ctx.stroke();
  }
}
