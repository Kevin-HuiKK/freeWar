// Shared persistent profile for freeWar.
// Used by both the tower-defense main game and the gambling (scratch-lottery)
// module so that money won at the casino can be spent on permanent upgrades
// for the battlefield, and vice versa.

const PROFILE_KEY = 'freewar-profile';
const SCHEMA_VERSION = 1;

const DEFAULT_PROFILE = {
  schemaVersion: SCHEMA_VERSION,
  wallet: 100,
  bonusStartingGold: 0,
  levelWins: 0,
  levelLosses: 0,
  lastLevelResult: null
};

// One-time migration: if the gambling save already has money but no profile
// exists yet, seed the wallet with that money so legacy players don't lose it.
const LEGACY_GAMBLING_KEY = 'scratch-lottery-save';

function readJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function loadProfile() {
  const base = JSON.parse(JSON.stringify(DEFAULT_PROFILE));
  const parsed = readJSON(PROFILE_KEY);
  if (parsed && parsed.schemaVersion === SCHEMA_VERSION) {
    return Object.assign(base, parsed);
  }
  const legacy = readJSON(LEGACY_GAMBLING_KEY);
  if (legacy && typeof legacy.money === 'number' && legacy.money > base.wallet) {
    base.wallet = Math.floor(legacy.money);
  }
  saveProfile(base);
  return base;
}

export function saveProfile(profile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.warn('profile save failed', e);
  }
}

export function addToWallet(profile, amount) {
  profile.wallet = Math.max(0, Math.floor(profile.wallet + amount));
  saveProfile(profile);
  return profile.wallet;
}

export function spendFromWallet(profile, amount) {
  if (profile.wallet < amount) return false;
  profile.wallet = Math.floor(profile.wallet - amount);
  saveProfile(profile);
  return true;
}

// The price for buying one more permanent +50 starting-gold upgrade.
// Cost grows with each tier purchased so it does not trivialise the game.
export const BONUS_GOLD_STEP = 50;
export function bonusGoldPrice(profile) {
  const tier = Math.floor(profile.bonusStartingGold / BONUS_GOLD_STEP);
  return 30 + tier * 20;
}
