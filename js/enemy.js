import { tileCenter } from './map.js';

export class Enemy {
  constructor(type, config, level, sprite) {
    this.type = type;
    this.maxHp = config.hp;
    this.hp = config.hp;
    this.speed = config.speed;
    this.bounty = config.bounty;
    this.radius = config.radius;
    this.sprite = sprite;
    this.tile = level.grid.tile;
    this.path = level.path;
    this.waypointIdx = 0;

    const first = tileCenter(this.path[0][0], this.path[0][1], this.tile);
    this.x = first.x;
    this.y = first.y;
    this.facing = 0;
  }

  update(dt) {
    if (this.waypointIdx >= this.path.length - 1) return 'reached-base';
    const target = this.path[this.waypointIdx + 1];
    const tc = tileCenter(target[0], target[1], this.tile);
    const dx = tc.x - this.x;
    const dy = tc.y - this.y;
    const dist = Math.hypot(dx, dy);
    this.facing = Math.atan2(dy, dx);
    const step = this.speed * this.tile * dt;
    if (step >= dist) {
      this.x = tc.x;
      this.y = tc.y;
      this.waypointIdx += 1;
      if (this.waypointIdx >= this.path.length - 1) return 'reached-base';
    } else {
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;
    }
    return 'walking';
  }

  draw(ctx) {
    const size = 40;
    if (this.sprite) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.facing);
      ctx.drawImage(this.sprite, -size / 2, -size / 2, size, size);
      ctx.restore();
    } else {
      ctx.fillStyle = '#a33';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    this.drawHpBar(ctx);
  }

  drawHpBar(ctx) {
    const w = 30;
    const hpRatio = Math.max(0, this.hp / this.maxHp);
    const x = this.x - w / 2;
    const y = this.y - 24;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x - 1, y - 1, w + 2, 5);
    ctx.fillStyle =
      hpRatio > 0.6 ? '#6cdc5c' :
      hpRatio > 0.3 ? '#e8c94a' : '#e84a4a';
    ctx.fillRect(x, y, w * hpRatio, 3);
  }

  get alive() {
    return this.hp > 0;
  }
}
