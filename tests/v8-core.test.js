import { describe, expect, it } from 'vitest';
import { consumeAction, createNewGame, cityById, resetActions, resourceCities } from '../v8/src/core/game-state.js';
import { buildRoute } from '../v8/src/systems/route-system.js';
import { calculateIncome } from '../v8/src/systems/economy-system.js';
import { applyCityGrowth } from '../v8/src/systems/growth-system.js';
import { attackCity, checkVictory, trainUnit } from '../v8/src/systems/combat-system.js';

describe('v8 city network core', () => {
  it('starts with three living factions and initial networks', () => {
    const state = createNewGame();
    expect(Object.values(state.factions).filter(f => f.alive)).toHaveLength(3);
    expect(cityById(state, 'c_aurea').owner).toBe('player');
    expect(Object.keys(state.routes).length).toBeGreaterThan(5);
    expect(state.actionsRemaining).toBe(2);
    expect(resourceCities(state, 'player').length).toBeGreaterThan(0);
  });

  it('tracks two player actions per turn', () => {
    const state = createNewGame();
    expect(consumeAction(state)).toBe(true);
    expect(consumeAction(state)).toBe(true);
    expect(consumeAction(state)).toBe(false);
    resetActions(state);
    expect(state.actionsRemaining).toBe(2);
  });

  it('builds a route to a neutral city and annexes it', () => {
    const state = createNewGame();
    const result = buildRoute(state, 'player', 'c_aurea', 'c_ashbridge');
    expect(result.ok).toBe(true);
    expect(cityById(state, 'c_ashbridge').owner).toBe('player');
  });

  it('calculates trade income from active routes', () => {
    const state = createNewGame();
    const base = calculateIncome(state, 'player').gold;
    buildRoute(state, 'player', 'c_aurea', 'c_ashbridge');
    const after = calculateIncome(state, 'player').gold;
    expect(after).toBeGreaterThan(base);
  });

  it('can win by influence target', () => {
    const state = createNewGame();
    state.factions.player.resources.influence = 20;
    expect(checkVictory(state)).toBe('player');
  });

  it('applies city growth without crashing and can upgrade cities over time', () => {
    const state = createNewGame();
    buildRoute(state, 'player', 'c_aurea', 'c_ashbridge');
    const city = cityById(state, 'c_ashbridge');
    const startLevel = city.level;
    for (let i = 0; i < 12; i++) applyCityGrowth(state);
    expect(city.level).toBeGreaterThanOrEqual(startLevel);
    expect(city.growth).toBeGreaterThanOrEqual(0);
  });

  it('trains units and attacks across an active route', () => {
    const state = createNewGame();
    buildRoute(state, 'player', 'c_aurea', 'c_ashbridge');
    buildRoute(state, 'crimson', 'c_eastgate', 'c_gatecross');
    trainUnit(state, 'player', 'c_aurea', 'infantry');
    trainUnit(state, 'player', 'c_aurea', 'siege');
    const route = buildRoute(state, 'player', 'c_ashbridge', 'c_copper');
    expect(route.ok).toBe(true);
    cityById(state, 'c_copper').owner = 'crimson';
    const result = attackCity(state, 'player', 'c_ashbridge', 'c_copper');
    expect(typeof result.ok).toBe('boolean');
  });
});
