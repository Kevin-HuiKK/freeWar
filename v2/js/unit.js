import { advanceAlongPath, buildPath } from './pathing.js';
import { pickTarget } from './combat.js';
import { Projectile } from './projectile.js';

let UID = 0;

export class Unit {
  constructor({ typeKey, config, team, path, sprite }) {
    this.id = ++UID;
    this.typeKey = typeKey;
    this.team = team;
    this.name = config.name;
    this.hp = config.hp;
    this.maxHp = config.hp;
    this.damage = config.damage;
    this.range = config.range;
    this.fireRate = config.fireRate;
    this.speed = config.speed;
    this.bounty = config.bounty;
    this.aoeRadius = config.aoeRadius || 0;
    this.size = config.size || 40;
    this.sprite = sprite;
    this.path = buildPath(path, team);
    this.x = this.path[0][0];
    this.y = this.path[0][1];
    this.waypointIdx = 0;
    this.cooldown = 0;
    this.facing = team === 'ally' ? 0 : Math.PI;
    this.muzzleFlash = 0;
    this.attackingFlag = false;
  }

  update(dt, battlefield) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.muzzleFlash = Math.max(0, this.muzzleFlash - dt);

    // Priority 1: Attack nearby hostile flag?
    const enemyFlag = battlefield.flagOf(this.team === 'ally' ? 'enemy' : 'ally');
    if (enemyFlag && enemyFlag.alive) {
      const df = Math.hypot(enemyFlag.x - this.x, enemyFlag.y - this.y);
      if (df <= this.range + 20) {
        this.attackingFlag = true;
        this._fireAt(enemyFlag, battlefield, { facing: Math.atan2(enemyFlag.y - this.y, enemyFlag.x - this.x) });
        return;
      }
    }
    this.attackingFlag = false;

    // Priority 2: shoot enemy units/defenses in range
    const target = pickTarget(this, battlefield.combatTargets(this.team));
    if (target) {
      this._fireAt(target, battlefield);
      return;
    }

    // Otherwise, walk toward opponent flag along path
    advanceAlongPath(this, dt);
  }

  _fireAt(target, battlefield, opts = {}) {
    this.facing = opts.facing ?? Math.atan2(target.y - this.y, target.x - this.x);
    if (this.cooldown > 0) return;
    battlefield.spawnProjectile(new Projectile({
      x: this.x, y: this.y,
      target,
      damage: this.damage,
      team: this.team,
      aoeRadius: this.aoeRadius
    }));
    this.cooldown = 1 / this.fireRate;
    this.muzzleFlash = 0.08;
  }

  draw(ctx) {
    if (this.sprite) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.facing);
      ctx.drawImage(this.sprite, -this.size / 2, -this.size / 2, this.size, this.size);
      ctx.restore();
    } else {
      ctx.fillStyle = this.team === 'ally' ? '#4a8ac7' : '#e14a3a';
      ctx.fillRect(this.x - 12, this.y - 12, 24, 24);
    }

    // Team-color underline ring
    ctx.strokeStyle = this.team === 'ally' ? 'rgba(74,138,199,0.75)' : 'rgba(225,74,58,0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + this.size * 0.45, this.size * 0.38, 4, 0, 0, Math.PI * 2);
    ctx.stroke();

    // HP bar
    const w = Math.max(28, this.size * 0.7);
    const ratio = Math.max(0, this.hp / this.maxHp);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(this.x - w / 2 - 1, this.y - this.size / 2 - 8, w + 2, 5);
    ctx.fillStyle = ratio > 0.6 ? '#6cdc5c' : ratio > 0.3 ? '#e8c94a' : '#e14a3a';
    ctx.fillRect(this.x - w / 2, this.y - this.size / 2 - 7, w * ratio, 3);

    if (this.muzzleFlash > 0) {
      const fx = this.x + Math.cos(this.facing) * (this.size * 0.45);
      const fy = this.y + Math.sin(this.facing) * (this.size * 0.45);
      ctx.fillStyle = 'rgba(255,220,120,0.95)';
      ctx.beginPath();
      ctx.arc(fx, fy, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  get alive() { return this.hp > 0; }
}
