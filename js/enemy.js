import { tileCenter } from './map.js';

export class Enemy {
  constructor(type, config, level) {
    this.type = type;
    this.maxHp = config.hp;
    this.hp = config.hp;
    this.speed = config.speed;
    this.bounty = config.bounty;
    this.color = config.color;
    this.radius = config.radius;
    this.tile = level.grid.tile;
    this.path = level.path;
    this.waypointIdx = 0;

    const first = tileCenter(this.path[0][0], this.path[0][1], this.tile);
    this.x = first.x;
    this.y = first.y;
  }

  update(dt) {
    if (this.waypointIdx >= this.path.length - 1) return 'reached-base';
    const target = this.path[this.waypointIdx + 1];
    const tc = tileCenter(target[0], target[1], this.tile);
    const dx = tc.x - this.x;
    const dy = tc.y - this.y;
    const dist = Math.hypot(dx, dy);
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
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    const w = this.radius * 2;
    const hpRatio = Math.max(0, this.hp / this.maxHp);
    ctx.fillStyle = '#000';
    ctx.fillRect(this.x - this.radius, this.y - this.radius - 6, w, 3);
    ctx.fillStyle = '#4c4';
    ctx.fillRect(this.x - this.radius, this.y - this.radius - 6, w * hpRatio, 3);
  }

  get alive() {
    return this.hp > 0;
  }
}
