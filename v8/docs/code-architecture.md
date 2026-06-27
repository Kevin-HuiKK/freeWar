# V8 Code Architecture

## Recommended Stack

Use a simple browser game stack for MVP:

- HTML/CSS for layout.
- Canvas 2D for map rendering, borders, routes, and animations.
- Plain JavaScript modules for game logic.
- JSON-like data files for city and route definitions.

Do not use a heavy engine for MVP. The game is UI/network-heavy, not physics-heavy.

## Runtime Layers

```text
index.html
  main.js
    core/game-state.js
    data/map-data.js
    systems/economy-system.js
    systems/growth-system.js
    systems/route-system.js
    systems/combat-system.js
    systems/ai-system.js
    render/map-renderer.js
    render/ui-renderer.js
    ui/input-controller.js
```

## Module Responsibilities

### `core/game-state.js`

Owns the state shape and state creation.

Responsibilities:

- Create new game state.
- Store current turn, selected node, factions, cities, routes, units, logs.
- Provide lookup helpers: `cityById`, `routeById`, `routesOfCity`.
- No rendering code.

### `data/map-data.js`

Static map content.

Responsibilities:

- City positions.
- Initial city ownership.
- Default city type and level.
- Valid route candidates.
- Port-to-port sea route candidates.
- Starting factions.

### `systems/route-system.js`

Connection logic.

Responsibilities:

- Check whether two cities can connect.
- Build roads and sea lanes.
- Upgrade routes.
- Cut and repair routes.
- Determine network connectivity to capital.

### `systems/growth-system.js`

City growth and influence.

Responsibilities:

- Calculate growth per turn.
- Apply city level upgrades.
- Calculate city influence radius.
- Mark isolated and surrounded cities.

### `systems/economy-system.js`

Resource production and trade.

Responsibilities:

- Calculate city tax.
- Calculate trade route income.
- Apply upkeep.
- Add turn income to factions.

### `systems/combat-system.js`

Military resolution.

Responsibilities:

- Move armies along routes.
- Raid trade routes.
- Cut routes.
- Resolve city attacks.
- Apply siege penalties.

### `systems/ai-system.js`

Opponent strategy.

Responsibilities:

- Choose expansion targets.
- Build routes.
- Train armies.
- Attack weak player routes.
- Capture isolated cities.

### `render/map-renderer.js`

Canvas map drawing.

Responsibilities:

- Draw background image.
- Draw borders.
- Draw routes.
- Draw city nodes.
- Draw moving trade dots.
- Draw selection and hover states.

### `render/ui-renderer.js`

DOM UI rendering.

Responsibilities:

- Resource bar.
- City detail panel.
- Route detail panel.
- Action buttons.
- Log.
- End-game modal.

### `ui/input-controller.js`

Mouse/touch input.

Responsibilities:

- Convert screen coordinates to city/route hit targets.
- Handle click, hover, drag, and route building mode.
- Dispatch user actions to systems.

## State Schema

```js
export const state = {
  turn: 1,
  phase: 'player',
  selected: { kind: 'city', id: 'c_capital_player' },
  hover: null,
  winner: null,
  factions: {
    player: {
      id: 'player',
      name: 'Aurora League',
      color: '#d2a74f',
      capitalIds: ['c_player_capital'],
      resources: { gold: 120, food: 60, labor: 40, influence: 10 },
      talents: []
    }
  },
  cities: {
    c_001: {
      id: 'c_001',
      name: 'Northford',
      x: 420,
      y: 360,
      owner: 'player',
      type: 'capital',
      level: 3,
      growth: 0,
      defense: 12,
      garrison: { infantry: 4, cavalry: 1, engineer: 0, siege: 0, guard: 2, fleet: 0 },
      buildingSlots: ['market', 'barracks'],
      tags: ['port']
    }
  },
  routes: {
    r_001: {
      id: 'r_001',
      from: 'c_001',
      to: 'c_002',
      owner: 'player',
      kind: 'road',
      level: 1,
      status: 'active',
      trade: true,
      military: false,
      progress: 0
    }
  },
  armies: {
    a_001: {
      id: 'a_001',
      owner: 'player',
      location: { kind: 'city', id: 'c_001' },
      units: { infantry: 3, cavalry: 1, engineer: 0, siege: 0, guard: 0, fleet: 0 },
      order: null
    }
  },
  log: []
};
```

## Data Schema

### City Definition

```js
{
  id: 'c_014',
  name: 'Red Harbor',
  x: 1180,
  y: 620,
  defaultOwner: null,
  type: 'port',
  level: 2,
  tags: ['port', 'trade'],
  neighbors: ['c_013', 'c_015', 'c_022']
}
```

### Route Candidate

```js
{
  id: 'rc_014_015',
  from: 'c_014',
  to: 'c_015',
  kind: 'road',
  distance: 110,
  buildCost: { gold: 20, labor: 8 },
  terrain: 'plain'
}
```

## Action API

Systems should expose action functions returning `{ ok, message, changes }`.

```js
buildRoute(state, factionId, fromCityId, toCityId)
upgradeRoute(state, factionId, routeId)
cutRoute(state, factionId, routeId, armyId)
repairRoute(state, factionId, routeId)
trainUnit(state, factionId, cityId, unitId)
moveArmy(state, factionId, armyId, routeId)
attackCity(state, factionId, armyId, cityId)
endTurn(state)
```

## Turn Order

Player turn:

1. Player performs actions.
2. Player clicks end turn.

End turn pipeline:

1. Resolve route construction progress.
2. Resolve army movement.
3. Apply trade income.
4. Apply city growth.
5. Apply siege/isolation penalties.
6. Run AI turns.
7. Check victory.
8. Start next player turn.

## Renderer Contract

Map renderer receives state and assets, then draws a complete frame.

```js
renderMap(ctx, state, assets, camera, timeMs)
```

Renderer must not mutate game state.

Input controller should use renderer hit maps or geometry helpers:

```js
hitTestCity(state, x, y)
hitTestRoute(state, x, y)
screenToWorld(camera, screenX, screenY)
```

## Implementation Notes

- Store city coordinates in world pixels matching the 1920x1080 background.
- Use one canvas for the map.
- Use DOM panels for UI.
- Use `requestAnimationFrame` only for visual animation.
- Use explicit action functions for all gameplay changes.
- Keep AI deterministic for testing by using seeded random choices.

