// tech.js — research progression
import { state } from './state.js';
import { logEvent } from './hud.js';

export function startResearch(nationId, techId) {
  const n = state.nations[nationId];
  const t = state.techDefs.find(x => x.id === techId);
  if (!n || !t) return false;
  if (n.researched.has(techId)) return false;
  n.researching = techId;
  // keep existing progress if same; reset if switching
  return true;
}

export function tickResearch(nationId) {
  const n = state.nations[nationId];
  if (!n.researching) return;
  const t = state.techDefs.find(x => x.id === n.researching);
  // research rate: tech points + free passive 5/turn
  const gain = 5 + n.tech;
  n.techProgress += gain;
  n.tech = 0;            // reset tech-resource as it's spent
  if (n.techProgress >= t.cost) {
    completeResearch(nationId, n.researching);
  }
}

export function completeResearch(nationId, techId) {
  const n = state.nations[nationId];
  const t = state.techDefs.find(x => x.id === techId);
  n.researched.add(techId);
  n.researching = null;
  n.techProgress = 0;
  if (nationId === state.player) {
    logEvent('tech', '🧪', `Research complete: ${t.name}`);
  }
}

export function isUnitUnlocked(nationId, unitDef) {
  if (!unitDef.tech) return true;     // Lv1 always available
  return state.nations[nationId].researched.has(unitDef.tech);
}

export function aiPickTech(nationId) {
  const n = state.nations[nationId];
  if (n.researching) return;
  // pick next un-researched tech, prefer cheaper
  const opts = state.techDefs.filter(t => !n.researched.has(t.id));
  if (opts.length === 0) return;
  opts.sort((a, b) => a.cost - b.cost);
  n.researching = opts[0].id;
}
