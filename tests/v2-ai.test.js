import { describe, it, expect } from 'vitest';
import { EnemyAI } from '../v2/js/ai.js';
import { Economy } from '../v2/js/economy.js';

function makeRng(seq) {
  let i = 0;
  return () => seq[i++ % seq.length];
}

describe('v2 EnemyAI', () => {
  it('does not spawn before initialDelay', () => {
    const econ = new Economy({ startingGold: 100 });
    const spawned = [];
    const ai = new EnemyAI({
      config: {
        initialDelay: 3,
        cycleInterval: [4, 4],
        saveUpChance: 0,
        saveUpMax: 0,
        unitPool: [{ type: 'a', weight: 1, minGold: 10 }]
      },
      economy: econ,
      onSpawn: (t) => spawned.push(t),
      rng: makeRng([0.1, 0.5])
    });
    ai.tick(2.9);
    expect(spawned).toEqual([]);
  });

  it('spawns a unit when cycle fires + gold is enough', () => {
    const econ = new Economy({ startingGold: 50 });
    const spawned = [];
    const ai = new EnemyAI({
      config: {
        initialDelay: 1,
        cycleInterval: [1, 1],
        saveUpChance: 0,
        saveUpMax: 0,
        unitPool: [{ type: 'militia', weight: 1, minGold: 10 }]
      },
      economy: econ,
      onSpawn: (t) => spawned.push(t),
      rng: makeRng([0.5, 0.5])
    });
    ai.tick(1.5);
    expect(spawned).toEqual(['militia']);
    expect(econ.gold).toBe(40);
  });

  it('prefers higher-weight picks', () => {
    const econ = new Economy({ startingGold: 200 });
    const spawned = [];
    const ai = new EnemyAI({
      config: {
        initialDelay: 0,
        cycleInterval: [0.01, 0.01],
        saveUpChance: 0,
        saveUpMax: 0,
        unitPool: [
          { type: 'militia', weight: 90, minGold: 10 },
          { type: 'tank',    weight: 10, minGold: 180 }
        ]
      },
      economy: econ,
      onSpawn: (t) => spawned.push(t),
      rng: makeRng([0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1])
    });
    // Tick many cycles
    for (let i = 0; i < 5; i++) ai.tick(0.02);
    // With rng=0.1 * weight=100 = 10 → picks militia every time
    expect(spawned.filter(t => t === 'militia').length).toBe(5);
  });

  it('skips spawn if gold below all minGold', () => {
    const econ = new Economy({ startingGold: 5 });
    const spawned = [];
    const ai = new EnemyAI({
      config: {
        initialDelay: 0,
        cycleInterval: [0.01, 0.01],
        saveUpChance: 0,
        saveUpMax: 0,
        unitPool: [{ type: 'militia', weight: 1, minGold: 10 }]
      },
      economy: econ,
      onSpawn: (t) => spawned.push(t),
      rng: makeRng([0.5])
    });
    ai.tick(1);
    expect(spawned).toEqual([]);
    expect(econ.gold).toBe(5);
  });
});
