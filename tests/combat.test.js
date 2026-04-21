import { describe, it, expect } from 'vitest';
import { pickTarget, applyDamage } from '../js/combat.js';

describe('pickTarget', () => {
  it('returns nearest enemy in range', () => {
    const unit = { x: 0, y: 0, range: 3 };
    const enemies = [
      { x: 10, y: 0, hp: 5 },
      { x: 2, y: 0, hp: 5 },
      { x: 2.5, y: 0, hp: 5 }
    ];
    expect(pickTarget(unit, enemies)).toBe(enemies[1]);
  });

  it('returns null when none in range', () => {
    expect(pickTarget({ x: 0, y: 0, range: 1 }, [{ x: 10, y: 0, hp: 5 }])).toBe(null);
  });

  it('ignores dead enemies', () => {
    const unit = { x: 0, y: 0, range: 5 };
    const enemies = [{ x: 1, y: 0, hp: 0 }, { x: 3, y: 0, hp: 5 }];
    expect(pickTarget(unit, enemies)).toBe(enemies[1]);
  });

  it('returns null for empty list', () => {
    expect(pickTarget({ x: 0, y: 0, range: 5 }, [])).toBe(null);
  });

  it('treats range as tile distance (uses unit.tile scale)', () => {
    const unit = { x: 0, y: 0, range: 2, tile: 64 };
    const within = { x: 100, y: 0, hp: 5 };
    const outside = { x: 200, y: 0, hp: 5 };
    expect(pickTarget(unit, [within])).toBe(within);
    expect(pickTarget(unit, [outside])).toBe(null);
  });
});

describe('applyDamage', () => {
  it('reduces hp', () => {
    const e = { hp: 10 };
    expect(applyDamage(e, 4).killed).toBe(false);
    expect(e.hp).toBe(6);
  });

  it('returns killed=true when hp drops to 0 or below', () => {
    const e = { hp: 10 };
    expect(applyDamage(e, 10).killed).toBe(true);
    expect(e.hp).toBe(0);
  });

  it('clamps hp at 0 when damage exceeds', () => {
    const e = { hp: 5 };
    applyDamage(e, 100);
    expect(e.hp).toBe(0);
  });
});
