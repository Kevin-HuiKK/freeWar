# FreeWar V8 - City Network War

V8 is an independent game direction based on `design.jpg`. It is not a continuation of V6.

The game is a node-network strategy game: players build and attack city connections on a hand-drawn world map. Cities grow through trade routes, military links, ports, and influence borders. War is fought by capturing cities, cutting roads, surrounding capitals, and controlling sea lanes.

## Design Pillars

- City nodes are the core units of the map.
- Connections are valuable targets, not just movement lines.
- Bigger cities accelerate smaller connected cities.
- Trade routes generate money and reveal strategic pressure.
- Armies can capture cities or cut enemy routes.
- Ports and sea lanes connect separated islands.
- Borders emerge from connected city influence, not from square tiles.

## Directory Guide

- `design.jpg` - original handwritten concept.
- `docs/game-design.md` - gameplay rules and systems.
- `docs/asset-brief.md` - required images, visual style, and generation prompts.
- `docs/code-architecture.md` - module boundaries, data schemas, and APIs.
- `docs/implementation-plan.md` - recommended build order.
- `src/` - code skeleton and module contract placeholders.
- `assets/` - asset folders and manifest.

## Current Build Status

V8 now has a playable browser MVP:

- Canvas strategy map with landmasses, city nodes, borders, roads, sea lanes, and animated trade dots.
- Mechanism-overview layout with left rules, central faction map, command card, and bottom rule panels.
- Two-action turn economy for route building, route upgrades, unit training, city attacks, route raids, and army transfer.
- Single victory condition: occupy all 3 capitals.
- Permanent talent points: claim 1 point after victory and spend it on persistent upgrades that do not reset between games.
- Three factions with capitals, resource points, ports, fortresses, independent neutral cities, and starting networks.
- Vitest coverage for the core V8 systems.

Run locally from the repository root:

```bash
python3 -m http.server 4188
```

Then open:

```text
http://localhost:4188/v8/
```

## MVP Feature Scope

The first playable version includes:

1. One fixed archipelago map.
2. 30-45 city nodes.
3. City levels, capitals, ports, barracks, and trade towns.
4. Build/remove route actions.
5. Passive city growth through connected larger cities.
6. Trade income from connected commercial routes.
7. Army movement along connected routes.
8. Route cutting and city capture.
9. Simple AI expansion and route attacks.
