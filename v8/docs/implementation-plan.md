# V8 Implementation Plan

## Phase 0 - Project Shell

Deliverables:

- `index.html`
- `css/style.css`
- `src/main.js`
- Canvas map area.
- Static background image loaded.
- Clickable city nodes from map data.

Acceptance:

- Page opens without build tools.
- 10 test city nodes render over a map.
- Clicking a city shows its name and level.

## Phase 1 - Network MVP

Deliverables:

- Full initial city data.
- Valid route candidates.
- Build route action.
- Route rendering.
- Selected city and hover states.

Acceptance:

- Player can select city A, connect to valid city B, and see a road.
- Invalid routes show a disabled action reason.

## Phase 2 - Economy and Growth

Deliverables:

- Gold, food, labor, influence resources.
- Trade income.
- City growth per turn.
- City level upgrade.
- Isolation detection.

Acceptance:

- Connected cities generate trade income.
- Bigger cities increase smaller connected city growth.
- Isolated cities stop growing.

## Phase 3 - Borders

Deliverables:

- Influence radius per city level.
- Merged national border overlay.
- Contested border state.

Acceptance:

- Owned connected cities create one visible territory.
- Disconnected cities render as enclaves.

## Phase 4 - Combat

Deliverables:

- Train units.
- Move armies along roads.
- Cut route.
- Attack city.
- Siege state.

Acceptance:

- Player can cut an enemy trade route.
- Isolated enemy city gets siege penalty.
- Captured city changes owner.

## Phase 5 - Sea System

Deliverables:

- Port city tag.
- Sea lane candidates.
- Fleet unit.
- Sea trade and blockade.

Acceptance:

- Port-to-port sea lane can be built.
- Fleet can blockade sea route.

## Phase 6 - AI

Deliverables:

- Expansion AI.
- Route-building AI.
- Route-attack AI.
- Capital defense behavior.

Acceptance:

- AI expands for at least 20 turns without crashing.
- AI cuts exposed player route when it has military advantage.

## Phase 7 - Meta Progression

Deliverables:

- Victory coin reward.
- Talent definitions.
- Talent selection screen.
- Saved progress in localStorage.

Acceptance:

- Winning a match grants coins.
- Selected talent modifies next game.

## Testing Checklist

- City click hit areas are accurate.
- Route hit areas do not block city clicks.
- End turn pipeline is deterministic.
- AI does not build impossible routes.
- Capturing a capital triggers victory check.
- Broken routes remove trade income immediately.
- Sea routes require port endpoints.
- UI panels do not cover important map nodes at 1280x720.

