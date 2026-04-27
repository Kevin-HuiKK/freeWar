// save.js — localStorage save / load
import { state } from './state.js';

const KEY = 'freeWar_V3_save';

export function save() {
  const dump = {
    turn: state.turn,
    year: state.year,
    season: state.season,
    player: state.player,
    difficulty: state.difficulty,
    nations: serializeNations(),
    territories: state.territories.map(t => ({ id: t.id, owner: t.owner })),
    units: state.units.map(u => ({ ...u })),
    diplomacy: state.diplomacy,
    wars: [...state.wars],
    log: state.log.slice(-30),
    uidCounter: state.uidCounter,
  };
  localStorage.setItem(KEY, JSON.stringify(dump));
}

function serializeNations() {
  const out = {};
  for (const id of Object.keys(state.nations)) {
    const n = state.nations[id];
    out[id] = {
      id: n.id, gold: n.gold, food: n.food, oil: n.oil, tech: n.tech,
      stability: n.stability, researched: [...n.researched],
      researching: n.researching, techProgress: n.techProgress,
      skillCD: n.skillCD, buffs: n.buffs, defeated: n.defeated,
    };
  }
  return out;
}

export function load() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return false;
  try {
    const d = JSON.parse(raw);
    state.turn = d.turn; state.year = d.year; state.season = d.season;
    state.player = d.player;
    for (const id of Object.keys(d.nations)) {
      const sn = d.nations[id]; const n = state.nations[id];
      Object.assign(n, sn);
      n.researched = new Set(sn.researched || []);
    }
    const ownerByT = new Map(d.territories.map(t => [t.id, t.owner]));
    for (const t of state.territories) {
      if (ownerByT.has(t.id)) t.owner = ownerByT.get(t.id);
    }
    state.units = d.units;
    state.diplomacy = d.diplomacy;
    state.wars = new Set(d.wars);
    state.log = d.log;
    state.uidCounter = d.uidCounter || 1;
    return true;
  } catch (e) { return false; }
}

export function hasSave() { return !!localStorage.getItem(KEY); }
export function clearSave() { localStorage.removeItem(KEY); }
