import { describe, it, expect } from 'vitest';
import { Economy } from '../v2/js/economy.js';

describe('v2 Economy', () => {
  it('starts with startingGold', () => {
    expect(new Economy({ startingGold: 150 }).gold).toBe(150);
  });
  it('accrues passive income (enemy AI)', () => {
    const e = new Economy({ startingGold: 0, goldPerSecond: 4 });
    e.tick(2.5);
    expect(e.gold).toBe(10);
  });
  it('addBounty works', () => {
    const e = new Economy({ startingGold: 50 });
    e.addBounty(25);
    expect(e.gold).toBe(75);
  });
  it('spend returns false when insufficient', () => {
    const e = new Economy({ startingGold: 5 });
    expect(e.spend(10)).toBe(false);
    expect(e.gold).toBe(5);
  });
  it('spend returns true when sufficient', () => {
    const e = new Economy({ startingGold: 100 });
    expect(e.spend(25)).toBe(true);
    expect(e.gold).toBe(75);
  });
});
