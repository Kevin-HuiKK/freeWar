# V8 Game Design

## One Sentence

Build a country across an island world by connecting cities, upgrading trade networks, defending roads, cutting enemy routes, and controlling sea lanes.

## Core Loop

1. Select a city.
2. Build or upgrade a connection to another city.
3. Earn trade income and city growth from the connection.
4. Train units in military cities.
5. Attack enemy roads, ports, or cities.
6. Expand borders by linking more cities into the national network.
7. Win by controlling capitals, trade centers, or the whole archipelago network.

## Map Model

The map is a hand-drawn world with several landmasses and islands. It uses nodes and edges instead of square regions.

### Nodes

Each city is a node.

- Village: smallest settlement, cheap to connect, low output.
- Town: medium settlement, can support local trade.
- City: strong economy, larger influence radius.
- Great City: major economic and military hub.
- Capital: national core. Losing all capitals means defeat.
- Port: can create sea routes.
- Barracks City: can train armies faster.
- Trade City: creates stronger income routes.
- Fortress: strong defense and slower capture.

### Edges

Connections are roads or sea routes.

- Road: land connection between nearby cities.
- Trade Route: road with commercial activity and income.
- Military Road: upgraded road for faster army movement.
- Sea Lane: port-to-port connection across water.
- Broken Route: destroyed connection that blocks trade and movement until repaired.

## City Growth

Cities grow through connected networks.

- A larger city sends growth pressure to smaller connected cities.
- A capital gives the strongest growth pressure.
- Trade cities increase economic growth.
- Barracks cities increase recruitment capacity.
- Isolated cities stop growing.
- Surrounded cities lose growth and defense.

Suggested growth formula:

```text
growthPerTurn =
  baseCityGrowth
  + connectedBiggerCityBonus
  + activeTradeRouteBonus
  + capitalNetworkBonus
  - isolatedPenalty
  - siegePenalty
```

City levels:

| Level | Name | Radius | Slots | Notes |
| --- | --- | ---: | ---: | --- |
| 1 | Village | Small | 0 | Can connect and produce small tax. |
| 2 | Town | Medium | 1 | Can host a simple building. |
| 3 | City | Large | 2 | Strong trade and defense. |
| 4 | Great City | Very large | 3 | Strong growth source. |
| 5 | Capital-class | Huge | 4 | Strategic core. |

## Borders

Borders are generated from city influence.

- Each owned city projects a circular or organic influence area.
- Higher-level cities project larger borders.
- Connected cities merge their borders into one national territory.
- Disconnected cities become enclaves.
- Enemy roads crossing your border can be taxed, blocked, or attacked.

## Economy

Resources:

- Gold: used for routes, upgrades, buildings, and diplomacy.
- Food: supports armies and city growth.
- Labor: used for road construction and repairs.
- Influence: used for border pressure, annexation, and diplomacy.

Income sources:

- City tax.
- Trade routes.
- Port trade.
- Market buildings.
- Captured enemy tolls.

Trade route rules:

- Route income scales with distance and endpoint city levels.
- Longer routes are more profitable but easier to cut.
- A trade route must stay connected to a capital or major trade city for full value.
- Sea trade pays more but can be raided.

## Military

War is about network disruption.

Actions:

- Capture City: take a node after winning a battle.
- Cut Route: destroy an edge without taking either city.
- Raid Trade: steal gold from an active trade route.
- Siege City: isolate a city by cutting all owned connections around it.
- Repair Route: restore a broken route.

Units:

| Unit | Role | Strength |
| --- | --- | --- |
| Infantry | Basic capture force | Cheap, reliable. |
| Cavalry | Route raider | Fast along roads, strong at cutting trade. |
| Engineer | Builder and repair | Builds roads, bridges, trading posts. |
| Siege Train | City attacker | Slow, strong against forts and capitals. |
| Guard | Defensive unit | Protects cities and trade. |
| Fleet | Sea control | Attacks ports and sea lanes. |

Battle should remain compact for MVP: compare attacker power, defender power, city defense, route defense, and terrain modifiers.

## Sea System

Ports unlock sea routes.

- Only port cities can create sea lanes.
- Sea lanes connect islands and separated continents.
- Sea routes can transport trade and armies.
- Fleets can raid or blockade sea lanes.
- Sea routes should be visually curved and animated with small moving dots.

Sea lane levels:

| Level | Name | Unlock |
| --- | --- | --- |
| 1 | Ferry | Trade only, small income. |
| 2 | Transport Lane | Can move small armies. |
| 3 | Naval Route | Can move large armies and fleets. |
| 4 | Imperial Sea Road | High-value protected route. |

## AI Design

MVP AI priorities:

1. Connect nearby unowned cities.
2. Upgrade routes between high-value cities.
3. Train units if threatened.
4. Cut exposed player trade routes.
5. Attack isolated cities.
6. Defend capital if enemy army is nearby.

## Victory Condition

V8 uses one victory condition only:

- Capital Victory: occupy all 3 capitals.

Other systems such as trade, influence, ports, and resource points support expansion, but they do not directly win the match.

## Meta Progression

After each match, award Victory Coins.

Use Victory Coins for strategy-altering talents:

- Start with extra gold.
- First road is free.
- Port routes cost less.
- Trade routes produce more.
- Engineers repair faster.
- Capitals project wider influence.

Current MVP uses persistent talent points instead of spendable coins:

- Claim 1 talent point after winning by occupying all 3 capitals.
- Talent points and upgrades are saved locally and do not reset when starting a new game.
- Talents improve large strategic systems such as capital scale, road construction, and harbor works.
