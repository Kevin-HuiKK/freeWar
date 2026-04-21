import { tileCenter } from './map.js';
import { pickTarget } from './combat.js';
import { Projectile } from './projectile.js';

export class Unit {
  constructor(typeKey, config, col, row, tile, sprite) {
    this.typeKey = typeKey;
    this.name = config.name;
    this.damage = config.damage;
    this.range = config.range;
    this.fireRate = config.fireRate;
    this.projectileColor = config.projectileColor;
    this.sprite = sprite;
    this.col = col;
    this.row = row;
    this.tile = tile;
    const c = tileCenter(col, row, tile);
    this.x = c.x;
    this.y = c.y;
    this.cooldown = 0;
    this.facing = 0;
    this.muzzleFlash = 0;
  }

  update(dt, enemies, spawnProjectile) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.muzzleFlash = Math.max(0, this.muzzleFlash - dt);
    if (this.cooldown > 0) return;
    const target = pickTarget(this, enemies);
    if (!target) return;
    this.facing = Math.atan2(target.y - this.y, target.x - this.x);
    spawnProjectile(new Projectile(this.x, this.y, target, this.damage, this.projectileColor));
    this.cooldown = 1 / this.fireRate;
    this.muzzleFlash = 0.08;
  }

  draw(ctx, hovered, projectileSprite) {
    if (hovered) {
      ctx.strokeStyle = 'rgba(255, 220, 100, 0.35)';
      ctx.fillStyle = 'rgba(255, 220, 100, 0.08)';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.range * this.tile, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    const size = 48;
    if (this.sprite) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.facing);
      ctx.drawImage(this.sprite, -size / 2, -size / 2, size, size);
      ctx.restore();
    }
    if (this.muzzleFlash > 0) {
      const fx = this.x + Math.cos(this.facing) * 22;
      const fy = this.y + Math.sin(this.facing) * 22;
      ctx.fillStyle = 'rgba(255,220,120,0.9)';
      ctx.beginPath();
      ctx.arc(fx, fy, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
