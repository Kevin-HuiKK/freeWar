import { describe, it, expect } from 'vitest';
import { WaveScheduler } from '../js/wave.js';

describe('WaveScheduler', () => {
  it('emits nothing before wave.delay', () => {
    const s = new WaveScheduler([
      { delay: 2, spawns: [{ type: 'a', count: 2, interval: 1 }] }
    ]);
    expect(s.tick(1.9)).toEqual([]);
  });

  it('emits first enemy once wave.delay elapses', () => {
    const s = new WaveScheduler([
      { delay: 2, spawns: [{ type: 'a', count: 2, interval: 1 }] }
    ]);
    s.tick(1.9);
    expect(s.tick(0.2)).toEqual(['a']);
  });

  it('spaces subsequent spawns by interval', () => {
    const s = new WaveScheduler([
      { delay: 0, spawns: [{ type: 'a', count: 2, interval: 1 }] }
    ]);
    expect(s.tick(0.01)).toEqual(['a']);
    expect(s.tick(0.5)).toEqual([]);
    expect(s.tick(0.6)).toEqual(['a']);
  });

  it('advances to the next wave after current is exhausted', () => {
    const s = new WaveScheduler([
      { delay: 0, spawns: [{ type: 'a', count: 1, interval: 1 }] },
      { delay: 1, spawns: [{ type: 'b', count: 1, interval: 1 }] }
    ]);
    expect(s.tick(0.01)).toEqual(['a']);
    expect(s.tick(1.0)).toEqual(['b']);
  });

  it('combines multiple spawn entries in one wave', () => {
    const s = new WaveScheduler([
      { delay: 0, spawns: [
        { type: 'a', count: 1, interval: 1 },
        { type: 'b', count: 1, interval: 1 }
      ]}
    ]);
    const out = s.tick(0.01);
    expect(out.sort()).toEqual(['a', 'b']);
  });

  it('isComplete when all waves exhausted', () => {
    const s = new WaveScheduler([{ delay: 0, spawns: [{ type: 'a', count: 1, interval: 1 }] }]);
    expect(s.isComplete()).toBe(false);
    s.tick(0.01);
    expect(s.isComplete()).toBe(true);
  });

  it('tolerates missing interval (treats as instant next)', () => {
    const s = new WaveScheduler([
      { delay: 0, spawns: [{ type: 'a', count: 2 }] }
    ]);
    const out = s.tick(0.01);
    expect(out).toEqual(['a', 'a']);
  });
});
