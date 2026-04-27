// combat.js — pure combat math + battle resolver
import { state, isAtWar } from './state.js';

// Damage formula per V3 plan: max(1, ATK - DEF*0.35) × terrainMod × techMod.
export function calcDamage(atk, def, terrainAtkMod = 1, terrainDefMod = 1, buffAtk = 0) {
  const effectiveAtk = (atk + buffAtk) * terrainAtkMod;
  const effectiveDef = def * terrainDefMod;
  return Math.max(1, Math.round(effectiveAtk - effectiveDef * 0.35));
}

// Resolve a single skirmish: attacker -> defenders in same territory.
// Both sides take damage simultaneously each round; loop until one side empty.
// Returns { atkSurv, defSurv, log[] } where log is text lines.
export function resolveBattle(attackers, defenders, terrain, atkBuffs = {}, defBuffs = {}) {
  const log = [];
  const aTerr = state.terrainDefs[terrain] || { atkMod: 1, defMod: 1 };
  let safetyRounds = 30;
  while (attackers.length > 0 && defenders.length > 0 && safetyRounds-- > 0) {
    // Attacker's turn: pick weakest target (most efficient kill)
    const aTarget = pickWeakest(defenders);
    const aUnit   = pickStrongest(attackers);
    const aDef    = unitDef(aUnit);
    const tDef    = unitDef(aTarget);
    const aDmg = calcDamage(aDef.atk, tDef.def, aTerr.atkMod, aTerr.defMod, atkBuffs.atk || 0);
    aTarget.hp -= aDmg;
    log.push({ side: 'atk', text: `${aDef.name} → ${tDef.name} (-${aDmg})` });
    if (aTarget.hp <= 0) {
      log.push({ side: 'atk', text: `☠ ${tDef.name} 阵亡` });
      defenders.splice(defenders.indexOf(aTarget), 1);
      if (defenders.length === 0) break;
    }
    // Defender's counter
    const dTarget = pickWeakest(attackers);
    const dUnit   = pickStrongest(defenders);
    const dDef    = unitDef(dUnit);
    const tDef2   = unitDef(dTarget);
    if (dDef.atk > 0) {
      const dDmg = calcDamage(dDef.atk, tDef2.def, aTerr.defMod, aTerr.atkMod, defBuffs.atk || 0);
      dTarget.hp -= dDmg;
      log.push({ side: 'def', text: `${dDef.name} → ${tDef2.name} (-${dDmg})` });
      if (dTarget.hp <= 0) {
        log.push({ side: 'def', text: `☠ ${tDef2.name} 阵亡` });
        attackers.splice(attackers.indexOf(dTarget), 1);
      }
    }
  }
  return { atkSurv: attackers, defSurv: defenders, log };
}

function unitDef(u) { return state.unitDefById[`${u.id}_${u.level}`]; }
function pickWeakest(arr) {
  let best = arr[0]; let bestHp = best.hp;
  for (const u of arr) if (u.hp < bestHp) { best = u; bestHp = u.hp; }
  return best;
}
function pickStrongest(arr) {
  let best = arr[0];
  let bestAtk = unitDef(best).atk;
  for (const u of arr) {
    const a = unitDef(u).atk;
    if (a > bestAtk) { best = u; bestAtk = a; }
  }
  return best;
}

// Check if owner can fight unit's owner (war or contesting).
export function canFight(ownerA, ownerB) {
  if (ownerA === ownerB) return false;
  return isAtWar(ownerA, ownerB);
}
