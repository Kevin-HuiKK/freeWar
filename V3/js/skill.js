// skill.js — national skills
import { state } from './state.js';
import { logEvent, logCombat } from './hud.js';
import { startBuild } from './unit.js';
import { adjustRelation } from './diplomacy.js';

export function activateSkill(nationId, skillId) {
  const n = state.nations[nationId];
  const s = state.skillDefs.find(x => x.id === skillId);
  if (!s) return false;
  if ((n.skillCD[skillId] || 0) > 0) return false;
  applyEffect(nationId, s);
  n.skillCD[skillId] = s.cd;
  if (nationId === state.player) {
    logEvent('diplo', s.icon, `Used ${s.name}`);
    logCombat(`✓ National skill: ${s.name}`, 'log-blue');
  }
  return true;
}

function applyEffect(nationId, skill) {
  const n = state.nations[nationId];
  const e = skill.effect;
  switch (e.type) {
    case 'spawn':
      const where = e.where === 'capital' ? n.capital : null;
      if (where) {
        for (let i = 0; i < e.count; i++) {
          const u = startBuild(e.unit, 1, nationId, where);
          u.buildTurnsLeft = 0;  // immediate
        }
      }
      break;
    case 'resource':
      if (e.gold) n.gold += e.gold;
      if (e.food) n.food += e.food;
      if (e.oil)  n.oil  += e.oil;
      if (e.tech) n.tech += e.tech;
      if (e.stability) n.stability = Math.min(100, n.stability + e.stability);
      break;
    case 'buff':
      n.buffs[skill.id] = { stat: e.stat, amount: e.amount, movBonus: e.movBonus, turnsLeft: e.duration };
      break;
    case 'diplomacy':
      Object.keys(state.nations).forEach(other => {
        if (other === nationId) return;
        if (state.wars.has([nationId, other].sort().join(':'))) return;
        adjustRelation(nationId, other, e.amount);
      });
      break;
  }
}

export function tickSkills(nationId) {
  const n = state.nations[nationId];
  for (const id of Object.keys(n.skillCD)) {
    if (n.skillCD[id] > 0) n.skillCD[id]--;
  }
  for (const id of Object.keys(n.buffs)) {
    n.buffs[id].turnsLeft--;
    if (n.buffs[id].turnsLeft <= 0) delete n.buffs[id];
  }
}

export function aiPickSkill(nationId) {
  const n = state.nations[nationId];
  // priority: low stability -> 农业改革, low gold -> 经济振兴, at war -> 军事动员
  const cdReady = id => (n.skillCD[id] || 0) === 0;
  if (n.stability < 40 && cdReady('S_FARM')) return activateSkill(nationId, 'S_FARM');
  if (n.gold < 30 && cdReady('S_ECONOMY')) return activateSkill(nationId, 'S_ECONOMY');
  // at war -> mobilize
  for (const w of state.wars) {
    const [a, b] = w.split(':');
    if ((a === nationId || b === nationId) && cdReady('S_MOBILIZE')) {
      return activateSkill(nationId, 'S_MOBILIZE');
    }
  }
}
