import { describe, it, expect } from 'vitest';
import { buildPath, advanceAlongPath } from '../v2/js/pathing.js';

describe('v2 pathing', () => {
  it('buildPath: ally keeps order', () => {
    const p = [[0, 0], [10, 0], [10, 10]];
    expect(buildPath(p, 'ally')).toEqual([[0, 0], [10, 0], [10, 10]]);
  });
  it('buildPath: enemy reverses', () => {
    const p = [[0, 0], [10, 0], [10, 10]];
    expect(buildPath(p, 'enemy')).toEqual([[10, 10], [10, 0], [0, 0]]);
  });

  it('advanceAlongPath moves toward next waypoint', () => {
    const u = { x: 0, y: 0, speed: 10, waypointIdx: 0, path: [[0, 0], [100, 0]] };
    advanceAlongPath(u, 1);
    expect(u.x).toBe(10);
    expect(u.y).toBe(0);
    expect(u.waypointIdx).toBe(0);
  });

  it('advanceAlongPath snaps to waypoint and increments idx', () => {
    const u = { x: 90, y: 0, speed: 100, waypointIdx: 0, path: [[0, 0], [100, 0], [100, 50]] };
    advanceAlongPath(u, 1);
    expect(u.x).toBe(100);
    expect(u.waypointIdx).toBe(1);
  });

  it('advanceAlongPath returns "reached" at end', () => {
    const u = { x: 95, y: 50, speed: 1000, waypointIdx: 0, path: [[0, 50], [100, 50]] };
    const res = advanceAlongPath(u, 1);
    expect(res).toBe('reached');
  });

  it('updates facing based on direction', () => {
    const u = { x: 0, y: 0, speed: 10, waypointIdx: 0, path: [[0, 0], [0, 100]] };
    advanceAlongPath(u, 0.1);
    expect(u.facing).toBeCloseTo(Math.PI / 2, 2);
  });
});
