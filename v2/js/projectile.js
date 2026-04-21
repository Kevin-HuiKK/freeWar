import { applyDamage, applyAoeDamage } from './combat.js';

export class Projectile {
  constructor({ x, y, target, damage, team, aoeRadius = 0, color = '#ffd46a' }) {
    this.x = x;
    this.y = y;
    this.target = target;
    this.damage = damage;
    this.team = team;
    this.aoeRadius = aoeRadius;
    this.color = color;
    this.speed = 560;
    this.facing = 0;
  }

  update(dt, allEntities) {
    if (!this.target || this.target.hp <= 0) return 'expired';
    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const d = Math.hypot(dx, dy);
    this.facing = Math.atan2(dy, dx);
    const step = this.speed * dt;
    if (step >= d) {
      let killed = false;
      if (this.aoeRadius > 0) {
        const killedList = applyAoeDamage(this.target.x, this.target.y, this.aoeRadius, this.damage, allEntities, this.team);
        killed = killedList.length > 0;
        return killed ? 'killed-aoe' : 'hit-aoe';
      } else {
        const res = applyDamage(this.target, this.damage);
        return res.killed ? 'killed' : 'hit';
      }
    }
    this.x += (dx / d) * step;
    this.y += (dy / d) * step;
    return 'flying';
  }

  draw(ctx, sprite) {
    if (this.aoeRadius > 0) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.facing);
      ctx.fillStyle = '#ff8030';
      ctx.beginPath();
      ctx.ellipse(0, 0, 9, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    if (sprite) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.facing);
      ctx.drawImage(sprite, -6, -3, 12, 6);
      ctx.restore();
    } else {
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
