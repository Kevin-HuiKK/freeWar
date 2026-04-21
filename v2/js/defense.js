import { pickTarget } from './combat.js';
import { Projectile } from './projectile.js';

let DID = 0;

/**
 * Static defensive structure (turret / cannon).
 * Stands still; targets and fires like a unit but no movement.
 */
export class Defense {
  constructor({ typeKey, config, x, y, team }) {
    this.id = ++DID;
    this.typeKey = typeKey;
    this.kind = 'defense';
    this.team = team;
    this.name = config.name;
    this.x = x;
    this.y = y;
    this.maxHp = config.hp;
    this.hp = config.hp;
    this.damage = config.damage;
    this.range = config.range;
    this.fireRate = config.fireRate;
    this.aoeRadius = config.aoeRadius || 0;
    this.size = config.size;
    this.color = config.color;
    this.barrelColor = config.barrelColor || '#1a1a1a';
    this.cooldown = 0;
    this.facing = team === 'ally' ? 0 : Math.PI;
    this.muzzleFlash = 0;
  }

  update(dt, battlefield) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.muzzleFlash = Math.max(0, this.muzzleFlash - dt);
    const target = pickTarget(this, battlefield.combatTargets(this.team));
    if (!target) return;
    this.facing = Math.atan2(target.y - this.y, target.x - this.x);
    if (this.cooldown > 0) return;
    battlefield.spawnProjectile(new Projectile({
      x: this.x, y: this.y,
      target, damage: this.damage, team: this.team,
      aoeRadius: this.aoeRadius
    }));
    this.cooldown = 1 / this.fireRate;
    this.muzzleFlash = 0.1;
  }

  draw(ctx) {
    const half = this.size / 2;
    // base
    ctx.fillStyle = this.color;
    ctx.strokeStyle = '#1a2010';
    ctx.lineWidth = 2;
    ctx.fillRect(this.x - half, this.y - half, this.size, this.size);
    ctx.strokeRect(this.x - half, this.y - half, this.size, this.size);
    // rotating turret head
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.facing);
    ctx.fillStyle = '#2a3418';
    ctx.beginPath();
    ctx.arc(0, 0, this.size * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = this.barrelColor;
    ctx.fillRect(this.size * 0.18, -2.5, this.size * 0.45, 5);
    ctx.restore();
    // team marker
    ctx.strokeStyle = this.team === 'ally' ? 'rgba(74,138,199,0.7)' : 'rgba(225,74,58,0.7)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(this.x - half + 2, this.y - half + 2, this.size - 4, this.size - 4);
    // HP bar
    const w = this.size + 4;
    const ratio = Math.max(0, this.hp / this.maxHp);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(this.x - w / 2, this.y - half - 8, w, 5);
    ctx.fillStyle = ratio > 0.6 ? '#6cdc5c' : ratio > 0.3 ? '#e8c94a' : '#e14a3a';
    ctx.fillRect(this.x - w / 2 + 1, this.y - half - 7, (w - 2) * ratio, 3);
    // muzzle flash
    if (this.muzzleFlash > 0) {
      const fx = this.x + Math.cos(this.facing) * this.size * 0.55;
      const fy = this.y + Math.sin(this.facing) * this.size * 0.55;
      ctx.fillStyle = 'rgba(255,220,120,0.95)';
      ctx.beginPath();
      ctx.arc(fx, fy, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  get alive() { return this.hp > 0; }
}
