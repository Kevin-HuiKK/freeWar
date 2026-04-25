import { loadProfile, saveProfile } from '../../../js/profile.js';

const SAVE_KEY = 'scratch-lottery-save';
const SCHEMA_VERSION = 1;

const DEFAULT_STATE = {
  money: 100,
  upgrades: { luck: 0, multiplier: 0, scale: 0 },
  unlocks: { card1: true, card2: false, card3: false },
  cardsScratched: { card1: 0, card2: 0, card3: 0 },
  oreInventory: { iron: 0, copper: 0, silver: 0, gold: 0 },
  mineSlots: [],
  stats: { biggestWin: 0, totalWins: 0, totalSpent: 0 },
  audioMuted: false,
  schemaVersion: SCHEMA_VERSION,
  lastTickMs: 0
};

export function loadState(slotCount = 4) {
  let parsed = null;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) parsed = JSON.parse(raw);
  } catch (e) {
    parsed = null;
  }
  const base = JSON.parse(JSON.stringify(DEFAULT_STATE));
  const state = parsed && parsed.schemaVersion === SCHEMA_VERSION
    ? Object.assign(base, parsed)
    : base;
  while (state.mineSlots.length < slotCount) {
    state.mineSlots.push({ ore: null, accumulated: 0, lastTickMs: Date.now() });
  }
  state.mineSlots.length = slotCount;
  // Wallet is shared with the tower-defense main game via the profile.
  state.money = loadProfile().wallet;
  return state;
}

export function saveState(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    const profile = loadProfile();
    profile.wallet = Math.max(0, Math.floor(state.money));
    saveProfile(profile);
  } catch (e) {
    console.warn('save failed', e);
  }
}

export function resetState() {
  localStorage.removeItem(SAVE_KEY);
  // Also clear the shared profile so a "reset progress" in gambling
  // wipes the wallet that the main game would otherwise still see.
  localStorage.removeItem('freewar-profile');
}

export function effectiveScalePct(state, upgradesData) {
  const lvl = state.upgrades.scale;
  return 1 + lvl * upgradesData.scale.effectPerLevel;
}

export function effectiveMultiplier(state, upgradesData) {
  const lvl = state.upgrades.multiplier;
  return 1 + lvl * upgradesData.multiplier.effectPerLevel;
}

export function effectiveLuckBonus(state, upgradesData) {
  return state.upgrades.luck * upgradesData.luck.effectPerLevel;
}

export function upgradeCost(upgradeDef, currentLevel) {
  return Math.ceil(upgradeDef.baseCost * Math.pow(upgradeDef.costMul, currentLevel));
}

export function ticketPrice(card, state, upgradesData) {
  return Math.ceil(card.basePrice * effectiveScalePct(state, upgradesData));
}

export function isCardUnlocked(cardId, state) {
  return !!state.unlocks[cardId];
}

export function checkUnlocks(state, cardsData) {
  let changed = false;
  for (const cardId of Object.keys(cardsData)) {
    if (state.unlocks[cardId]) continue;
    const def = cardsData[cardId];
    const required = def.unlockAfterCards || 0;
    if (required <= 0) continue;
    const previousCardId = previousCard(cardId);
    if (!previousCardId) continue;
    const scratchedPrev = state.cardsScratched[previousCardId] || 0;
    if (scratchedPrev >= required) {
      state.unlocks[cardId] = true;
      changed = true;
    }
  }
  return changed;
}

function previousCard(cardId) {
  if (cardId === 'card2') return 'card1';
  if (cardId === 'card3') return 'card2';
  return null;
}
