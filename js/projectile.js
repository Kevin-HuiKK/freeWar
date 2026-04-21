import { applyDamage } from './combat.js';

export class Projectile {
  constructor(x, y, target, damage, color) {
    this.x = x;
    this.y = y;
    this.target = target;
    this.damage = damage;
    this.color = color;
    this.speed = 480;
  }

  update(dt) {
    if (!this.target || this.target.hp <= 0) return 'expired';
    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const d = Math.hypot(dx, dy);
    const step = this.speed * dt;
    if (step >= d) {
      const res = applyDamage(this.target, this.damage);
      return res.killed ? 'killed' : 'hit';
    }
    this.x += (dx / d) * step;
    this.y += (dy / d) * step;
    return 'flying';
  }

  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}
