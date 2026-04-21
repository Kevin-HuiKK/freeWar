import { describe, it, expect } from 'vitest';
import { Hero } from '../v2/js/hero.js';

function makeHero(overrides = {}) {
  const config = {
    name: 'Test',
    title: 'T',
    cost: 100,
    hp: 100, damage: 10, range: 50, fireRate: 1, speed: 10, bounty: 10,
    sprite: 'rifleman',
    size: 50,
    skill: {
      key: 'dash-strike',
      name: 'Dash',
      cooldown: 10,
      damage: 50,
      radius: 40,
      dashSpeed: 200,
      ...overrides.skill
    }
  };
  const path = [[0, 0], [500, 0]];
  return new Hero({ typeKey: 'captain', config, team: 'ally', path, sprite: null });
}

describe('v2 Hero', () => {
  it('starts with zero cooldown', () => {
    const h = makeHero();
    expect(h.skill.cooldownLeft).toBe(0);
    expect(h.skill.ready).toBe(true);
  });

  it('castSkill sets cooldown and starts dash', () => {
    const h = makeHero();
    const bf = minimalBattlefield();
    const ok = h.castSkill(100, 0, bf);
    expect(ok).toBe(true);
    expect(h.skill.cooldownLeft).toBe(10);
    expect(h.skill.ready).toBe(false);
    expect(h.dashTarget).toEqual({ x: 100, y: 0 });
  });

  it('castSkill returns false while on cooldown', () => {
    const h = makeHero();
    const bf = minimalBattlefield();
    h.castSkill(50, 0, bf);
    expect(h.castSkill(100, 0, bf)).toBe(false);
  });

  it('dash moves hero and applies AoE on arrival', () => {
    const h = makeHero();
    const enemy = { x: 100, y: 0, hp: 60, team: 'enemy' };
    const bf = minimalBattlefield({ units: [enemy] });
    h.castSkill(100, 0, bf);
    // Dash at speed=200, distance=100 → arrives in ~0.5s. Run fewer ticks.
    for (let i = 0; i < 6; i++) h.update(0.1, bf);
    expect(h.dashTarget).toBe(null);                  // dash finished
    expect(enemy.hp).toBeLessThan(60);                // AoE applied
    expect(h.x).toBeGreaterThanOrEqual(100);          // arrived at or past target
  });

  it('cooldown ticks down during update', () => {
    const h = makeHero();
    h.castSkill(10, 0, minimalBattlefield());
    h.update(3, minimalBattlefield()); // 3 seconds passed
    // Cooldown decreases during update, but dash may still be active; give it time to land
    for (let i = 0; i < 20; i++) h.update(0.5, minimalBattlefield());
    expect(h.skill.cooldownLeft).toBe(0);
    expect(h.skill.ready).toBe(true);
  });

  it('heal-aura heals friendly units in range', () => {
    const h = makeHero({ skill: { key: 'heal-aura', heal: 40, radius: 100, cooldown: 5 } });
    const ally = { x: 50, y: 0, hp: 20, maxHp: 100, team: 'ally' };
    const enemy = { x: 60, y: 0, hp: 50, maxHp: 100, team: 'enemy' };
    const bf = minimalBattlefield({ units: [ally, enemy] });
    h.castSkill(50, 0, bf);
    expect(ally.hp).toBe(60);
    expect(enemy.hp).toBe(50);
  });

  it('air-strike schedules a pending strike', () => {
    const h = makeHero({ skill: { key: 'air-strike', delay: 1, damage: 80, radius: 100, cooldown: 10 } });
    const bf = minimalBattlefield();
    h.castSkill(200, 0, bf);
    expect(bf.pendingStrikes.length).toBe(1);
    expect(bf.pendingStrikes[0].x).toBe(200);
    expect(bf.pendingStrikes[0].delay).toBe(1);
  });
});

function minimalBattlefield(overrides = {}) {
  return {
    units: [], defenses: [], buildings: [], projectiles: [], effects: [],
    pendingStrikes: [],
    flags: { ally: { x: 0, y: 0, hp: 10, team: 'ally' }, enemy: { x: 500, y: 0, hp: 10, team: 'enemy' } },
    flagOf(t) { return this.flags[t]; },
    combatTargets() { return []; },
    allEntities() { return [...this.units, ...this.defenses, ...this.buildings]; },
    spawnProjectile() {},
    spawnEffect(e) { this.effects.push(e); },
    scheduleAirStrike(s) { this.pendingStrikes.push(s); },
    creditBounty() {},
    ...overrides
  };
}
