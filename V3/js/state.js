// state.js — central game state singleton + JSON loading
export const state = {
  turn: 1,
  year: 1,
  season: 0,                 // 0=春 1=夏 2=秋 3=冬
  player: 'blue',
  nations: {},               // id → nation runtime state
  territories: [],           // [{id, name, owner, terrain, polygon, center, isCapital, neighbors, seaLinks, building?}]
  territoriesById: {},
  units: [],                 // [{uid, id, level, owner, hp, maxHp, location, moved, attacked, buildTurnsLeft, queuedFor}]
  diplomacy: {},             // {a: {b: 0-100}}
  wars: new Set(),           // "a:b" sorted alphabetically
  selected: null,            // {type:'territory'|'unit', id}
  pendingMove: null,         // unitUid being moved (highlight valid)
  log: [],                   // [{kind, icon, title, when, color}]
  combatLog: [],             // recent battle text lines
  techDefs: [],
  unitDefs: [],
  unitDefById: {},           // "U001_1" → def
  skillDefs: [],
  eventDefs: [],
  nationDefs: [],
  terrainDefs: {},
  mapMeta: { width: 1200, height: 700 },
  ended: false,
  winner: null,
  uidCounter: 1,
  muted: true,        // BGM 默认关闭，le'o 嫌难听
  difficulty: 'normal', // easy / normal / hard
};

const DIFFICULTY_PRESETS = {
  easy:   { aiResMul: 0.7, aiAggressionMul: 0.6, playerStartGold: 300 },
  normal: { aiResMul: 1.0, aiAggressionMul: 1.0, playerStartGold: 200 },
  hard:   { aiResMul: 1.4, aiAggressionMul: 1.4, playerStartGold: 200 },
};
export function difficultyPreset() { return DIFFICULTY_PRESETS[state.difficulty] || DIFFICULTY_PRESETS.normal; }

const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];
export const seasonName = () => SEASONS[state.season];
export const yearLabel = () => `Year ${state.year} ${seasonName()}`;

export function nextUid() { return state.uidCounter++; }

export function warKey(a, b) { return [a, b].sort().join(':'); }
export function isAtWar(a, b) { return state.wars.has(warKey(a, b)); }
export function declareWar(a, b) { state.wars.add(warKey(a, b)); state.diplomacy[a][b] = 0; state.diplomacy[b][a] = 0; }
export function makePeace(a, b) { state.wars.delete(warKey(a, b)); state.diplomacy[a][b] = 35; state.diplomacy[b][a] = 35; }

export async function loadAll() {
  const [units, map, nations, techs, skills, events, terrain] = await Promise.all([
    fetch('data/units.json').then(r => r.json()),
    fetch('data/map.json').then(r => r.json()),
    fetch('data/nations.json').then(r => r.json()),
    fetch('data/techs.json').then(r => r.json()),
    fetch('data/skills.json').then(r => r.json()),
    fetch('data/events.json').then(r => r.json()),
    fetch('data/terrain.json').then(r => r.json()),
  ]);
  state.unitDefs = units.units;
  state.unitCategories = units.categories;
  state.unitDefById = {};
  units.units.forEach(u => { state.unitDefById[`${u.id}_${u.level}`] = u; });
  state.mapMeta = { width: map.width, height: map.height };
  state.territories = map.territories.map(t => ({ ...t }));
  state.territoriesById = {};
  state.mapDefaultOwners = {};
  state.territories.forEach(t => { state.territoriesById[t.id] = t; state.mapDefaultOwners[t.id] = t.owner; });
  state.nationDefs = nations.nations;
  state.techDefs = techs.techs;
  state.skillDefs = skills.skills;
  state.eventDefs = events.events;
  state.terrainDefs = terrain.terrains;
  state._initialDiplomacy = nations._initialDiplomacy;
}

export function initRuntime() {
  // Build nation runtime states.
  const preset = difficultyPreset();
  state.nations = {};
  state.nationDefs.forEach(n => {
    const isP = (n.id === state.player);
    const startG = isP ? preset.playerStartGold : Math.round(n.startResources.gold * preset.aiResMul);
    state.nations[n.id] = {
      id: n.id,
      name: n.name,
      color: n.color,
      colorLight: n.colorLight,
      icon: n.icon,
      isPlayer: isP,
      capital: n.capital,
      gold:  startG,
      food:  Math.round(n.startResources.food * (isP ? 1 : preset.aiResMul)),
      oil:   Math.round(n.startResources.oil  * (isP ? 1 : preset.aiResMul)),
      tech:  n.startResources.tech,
      stability: n.stability,
      researched: new Set(),
      researching: null,        // techId
      techProgress: 0,
      skillCD: {},              // skillId → turns left
      buffs: {},                // skillId → {turnsLeft, ...}
      defeated: false,
      aggression: (n.aggression ?? 0.5) * (isP ? 1 : preset.aiAggressionMul),
      rank: n.rank,
    };
    state.skillDefs.forEach(s => { state.nations[n.id].skillCD[s.id] = 0; });
  });
  // Diplomacy
  state.diplomacy = {};
  Object.keys(state._initialDiplomacy).forEach(a => {
    state.diplomacy[a] = { ...state._initialDiplomacy[a] };
  });
  // Wars: compute from diplomacy — anyone at relation < 30 starts the game at war
  state.wars = new Set();
  const ids = Object.keys(state.nations);
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i], b = ids[j];
      const rel = state.diplomacy[a]?.[b] ?? 50;
      if (rel < 30) state.wars.add(warKey(a, b));
    }
  }
  // Reset territory ownership to whatever map.json says (in case of restart)
  state.territories.forEach(t => {
    const orig = state.mapDefaultOwners?.[t.id];
    if (orig) t.owner = orig;
  });
}
