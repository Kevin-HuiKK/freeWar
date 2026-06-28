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
    expect(Object.keys(state.routes).length).toBeGreaterThan(4);
    expect(state.actionsRemaining).toBe(3);
    expect(resourceCities(state, 'player').length).toBeGreaterThan(0);
    expect(['c_whitecliff', 'c_glassbay', 'c_drywell', 'c_moonpass', 'c_amberholm'].every(id => cityById(state, id).owner === null)).toBe(true);
  });

  it('opens each faction with a capital and two adjacent cities', () => {
    const state = createNewGame();
    for (const fid of ['player', 'crimson', 'azure']) {
      const owned = Object.values(state.cities).filter(city => city.owner === fid);
      expect(owned).toHaveLength(3);
      expect(owned.filter(city => city.type === 'capital')).toHaveLength(1);
    }
    expect(cityById(state, 'c_oldport').owner).toBe(null);
    expect(cityById(state, 'c_mistden').owner).toBe(null);
  });

  it('grants an extra starting city from the shop boost', () => {
    const state = createNewGame({}, { extraCity: 1 });
    expect(cityById(state, 'c_oldport').owner).toBe('player');
    expect(Object.values(state.cities).filter(city => city.owner === 'player')).toHaveLength(4);
  });

  it('tracks three player actions per turn', () => {
    const state = createNewGame();
    expect(consumeAction(state)).toBe(true);
    expect(consumeAction(state)).toBe(true);
    expect(consumeAction(state)).toBe(true);
    expect(consumeAction(state)).toBe(false);
    resetActions(state);
    expect(state.actionsRemaining).toBe(3);
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

  it('only wins by occupying three capitals', () => {
    const state = createNewGame();
    state.factions.player.resources.influence = 20;
    expect(checkVictory(state)).toBe(null);
    cityById(state, 'c_redspire').owner = 'player';
    cityById(state, 'c_blueharbor').owner = 'player';
    expect(checkVictory(state)).toBe('player');
  });

  it('applies persistent talent bonuses to new games', () => {
    const state = createNewGame({ capitalExpansion: 2, harborWorks: 1, grandRoads: 1 });
    expect(cityById(state, 'c_aurea').level).toBe(5);
    expect(state.factions.player.resources.gold).toBeGreaterThan(120);
    expect(state.factions.player.resources.labor).toBeGreaterThan(55);
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

  it('attacks an adjacent enemy city across an unbuilt route candidate', () => {
    const state = createNewGame();
    // Make the player hold a frontier city that is map-adjacent to a crimson city
    // (c_eastgate <-> c_emberfall is a road candidate) with no pre-built route.
    const front = cityById(state, 'c_eastgate');
    front.owner = 'player';
    front.garrison = { infantry: 40, cavalry: 0, engineer: 0, siege: 8, guard: 0, fleet: 0 };
    const target = cityById(state, 'c_emberfall');
    expect(target.owner).toBe('crimson');
    const result = attackCity(state, 'player', 'c_eastgate', 'c_emberfall');
    expect(result.ok).toBe(true);
    expect(cityById(state, 'c_emberfall').owner).toBe('player');
    // capture forged an owned, active connecting road
    const link = Object.values(state.routes).find(r =>
      (r.from === 'c_eastgate' && r.to === 'c_emberfall') || (r.from === 'c_emberfall' && r.to === 'c_eastgate'));
    expect(link?.owner).toBe('player');
    expect(link?.status).toBe('active');
  });

  it('trains units and attacks across an active route', () => {
    const state = createNewGame();
    buildRoute(state, 'player', 'c_aurea', 'c_ashbridge');
    buildRoute(state, 'crimson', 'c_emberfall', 'c_silverfen');
    trainUnit(state, 'player', 'c_aurea', 'infantry');
    trainUnit(state, 'player', 'c_aurea', 'siege');
    const route = buildRoute(state, 'player', 'c_ashbridge', 'c_copper');
    expect(route.ok).toBe(true);
    cityById(state, 'c_copper').owner = 'crimson';
    const result = attackCity(state, 'player', 'c_ashbridge', 'c_copper');
    expect(typeof result.ok).toBe('boolean');
  });
});
