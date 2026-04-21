import { describe, it, expect } from 'vitest';
import { Economy } from '../js/economy.js';

describe('Economy', () => {
  it('starts with startingGold', () => {
    expect(new Economy({ startingGold: 100, goldPerSecond: 2 }).gold).toBe(100);
  });

  it('passive income accrues over time', () => {
    const e = new Economy({ startingGold: 0, goldPerSecond: 10 });
    e.tick(2.5);
    expect(e.gold).toBe(25);
  });

  it('bounty adds immediately', () => {
    const e = new Economy({ startingGold: 0, goldPerSecond: 0 });
    e.addBounty(8);
    expect(e.gold).toBe(8);
  });

  it('spend returns false when insufficient', () => {
    const e = new Economy({ startingGold: 5, goldPerSecond: 0 });
    expect(e.spend(10)).toBe(false);
    expect(e.gold).toBe(5);
  });

  it('spend returns true and deducts when sufficient', () => {
    const e = new Economy({ startingGold: 10, goldPerSecond: 0 });
    expect(e.spend(4)).toBe(true);
    expect(e.gold).toBe(6);
  });

  it('gold floors fractional passive income', () => {
    const e = new Economy({ startingGold: 0, goldPerSecond: 1 });
    e.tick(0.3);
    expect(e.gold).toBe(0);
    e.tick(0.8);
    expect(e.gold).toBe(1);
  });
});
