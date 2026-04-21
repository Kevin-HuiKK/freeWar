import { describe, it, expect } from 'vitest';
import { pickTarget, applyDamage, applyAoeDamage } from '../v2/js/combat.js';

describe('v2 combat', () => {
  it('pickTarget only returns hostile team', () => {
    const self = { x: 0, y: 0, range: 100, team: 'ally' };
    const targets = [
      { x: 10, y: 0, hp: 20, team: 'ally' },   // friendly, skip
      { x: 30, y: 0, hp: 20, team: 'enemy' },  // hostile, closer
      { x: 80, y: 0, hp: 20, team: 'enemy' }
    ];
    expect(pickTarget(self, targets)).toBe(targets[1]);
  });

  it('pickTarget respects range (pixels)', () => {
    const self = { x: 0, y: 0, range: 50, team: 'ally' };
    const out = { x: 100, y: 0, hp: 10, team: 'enemy' };
    expect(pickTarget(self, [out])).toBe(null);
  });

  it('pickTarget ignores dead', () => {
    const self = { x: 0, y: 0, range: 100, team: 'ally' };
    const targets = [
      { x: 10, y: 0, hp: 0, team: 'enemy' },
      { x: 30, y: 0, hp: 5, team: 'enemy' }
    ];
    expect(pickTarget(self, targets)).toBe(targets[1]);
  });

  it('applyDamage reduces + reports killed', () => {
    const e = { hp: 10 };
    expect(applyDamage(e, 3).killed).toBe(false);
    expect(e.hp).toBe(7);
    expect(applyDamage(e, 7).killed).toBe(true);
  });

  it('applyAoeDamage hits all in-range hostiles, returns killed list', () => {
    const targets = [
      { x: 0,  y: 0, hp: 5,  team: 'enemy' },
      { x: 10, y: 0, hp: 100, team: 'enemy' },
      { x: 50, y: 0, hp: 5,  team: 'enemy' },   // out of aoe
      { x: 5,  y: 5, hp: 5,  team: 'ally' }     // friendly fire skipped
    ];
    const killed = applyAoeDamage(0, 0, 20, 10, targets, 'ally');
    expect(targets[0].hp).toBe(0);
    expect(targets[1].hp).toBe(90);
    expect(targets[2].hp).toBe(5);
    expect(targets[3].hp).toBe(5);
    expect(killed).toEqual([targets[0]]);
  });
});
