import { Unit } from './unit.js';
import { applyAoeDamage } from './combat.js';

/**
 * Hero — stronger single-instance unit with a click-activated skill.
 * Extends Unit for the walking/shooting behavior, adds skill system.
 */
export class Hero extends Unit {
  constructor({ typeKey, config, team, path, sprite }) {
    super({ typeKey, config, team, path, sprite });
    this.isHero = true;
    this.title = config.title;
    this.skill = {
      ...config.skill,
      cooldownLeft: 0,
      ready: true
    };
    // Dash skill state
    this.dashTarget = null;    // { x, y } when dashing
    this.dashDamage = 0;
    this.dashRadius = 0;
  }

  /**
   * Try to cast the skill at (x, y). Returns true if cast.
   */
  castSkill(x, y, battlefield) {
    if (this.skill.cooldownLeft > 0) return false;
    this.skill.cooldownLeft = this.skill.cooldown;
    this.skill.ready = false;

    switch (this.skill.key) {
      case 'dash-strike':
        this.dashTarget = { x, y };
        this.dashDamage = this.skill.damage;
        this.dashRadius = this.skill.radius;
        return true;

      case 'heal-aura': {
        let healed = 0;
        for (const u of battlefield.units) {
          if (u.team !== this.team || u.hp <= 0) continue;
          if (Math.hypot(u.x - x, u.y - y) <= this.skill.radius) {
            u.hp = Math.min(u.maxHp, u.hp + this.skill.heal);
            healed++;
          }
        }
        battlefield.spawnEffect({
          kind: 'heal-aura', x, y,
          radius: this.skill.radius,
          ttl: 0.8
        });
        return true;
      }

      case 'air-strike': {
        battlefield.scheduleAirStrike({
          x, y,
          delay: this.skill.delay,
          damage: this.skill.damage,
          radius: this.skill.radius,
          team: this.team
        });
        battlefield.spawnEffect({
          kind: 'airstrike-marker', x, y,
          radius: this.skill.radius,
          ttl: this.skill.delay
        });
        return true;
      }
    }
    return false;
  }

  update(dt, battlefield) {
    // Cooldown
    if (this.skill.cooldownLeft > 0) {
      this.skill.cooldownLeft = Math.max(0, this.skill.cooldownLeft - dt);
      if (this.skill.cooldownLeft === 0) this.skill.ready = true;
    }

    // Dash override
    if (this.dashTarget) {
      const dx = this.dashTarget.x - this.x;
      const dy = this.dashTarget.y - this.y;
      const d = Math.hypot(dx, dy);
      const step = (this.skill.dashSpeed || 600) * dt;
      if (step >= d) {
        this.x = this.dashTarget.x;
        this.y = this.dashTarget.y;
        // Apply AoE damage on arrival
        const targets = [
          ...battlefield.units,
          ...battlefield.defenses,
          ...battlefield.buildings,
          battlefield.flags.ally,
          battlefield.flags.enemy
        ];
        applyAoeDamage(this.x, this.y, this.dashRadius, this.dashDamage, targets, this.team);
        battlefield.spawnEffect({
          kind: 'impact', x: this.x, y: this.y,
          radius: this.dashRadius, ttl: 0.5
        });
        this.dashTarget = null;
      } else {
        this.facing = Math.atan2(dy, dx);
        this.x += (dx / d) * step;
        this.y += (dy / d) * step;
      }
      return;
    }

    super.update(dt, battlefield);
  }

  draw(ctx) {
    // Aura ring
    const pulse = 0.4 + 0.2 * Math.sin(performance.now() / 300);
    ctx.strokeStyle = this.team === 'ally'
      ? `rgba(255, 220, 106, ${pulse})`
      : `rgba(225, 74, 58, ${pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * 0.55, 0, Math.PI * 2);
    ctx.stroke();

    super.draw(ctx);

    // "HERO" label
    ctx.fillStyle = this.team === 'ally' ? '#ffd46a' : '#ff8a7a';
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('HERO', this.x, this.y - this.size / 2 - 14);
    ctx.textAlign = 'start';

    // Cooldown ring around the hero
    if (this.skill.cooldownLeft > 0) {
      const frac = this.skill.cooldownLeft / this.skill.cooldown;
      ctx.strokeStyle = 'rgba(160,160,160,0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * 0.6, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
      ctx.stroke();
    }
  }
}
