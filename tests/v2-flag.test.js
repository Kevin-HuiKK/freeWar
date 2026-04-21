import { describe, it, expect } from 'vitest';
import { Flag } from '../v2/js/flag.js';

describe('v2 Flag', () => {
  it('stores hp + maxHp + team', () => {
    const f = new Flag({ x: 0, y: 0, hp: 15, team: 'ally' });
    expect(f.hp).toBe(15);
    expect(f.maxHp).toBe(15);
    expect(f.team).toBe('ally');
    expect(f.ratio).toBe(1);
  });

  it('damage reduces hp and returns true on destruction', () => {
    const f = new Flag({ x: 0, y: 0, hp: 10, team: 'ally' });
    expect(f.damage(3)).toBe(false);
    expect(f.hp).toBe(7);
    expect(f.damage(10)).toBe(true);
    expect(f.hp).toBe(0);
    expect(f.alive).toBe(false);
  });

  it('damageFlash triggers + decays', () => {
    const f = new Flag({ x: 0, y: 0, hp: 10, team: 'ally' });
    f.damage(1);
    expect(f.damageFlash).toBeGreaterThan(0);
    f.tick(1.0);
    expect(f.damageFlash).toBe(0);
  });
});
