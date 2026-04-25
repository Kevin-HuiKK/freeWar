import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __d = dirname(fileURLToPath(import.meta.url));

global.localStorage = {
  _: {},
  getItem(k) { return this._[k] ?? null; },
  setItem(k, v) { this._[k] = String(v); },
  removeItem(k) { delete this._[k]; }
};

const { loadState, saveState, ticketPrice, isCardUnlocked, checkUnlocks, upgradeCost } = await import('../js/state.js');
const { generateCard, evaluatePrize } = await import('../js/card.js');
const cardsData = JSON.parse(readFileSync(resolve(__d, '../data/cards.json'), 'utf8'));
const upgradesData = JSON.parse(readFileSync(resolve(__d, '../data/upgrades.json'), 'utf8'));
const oresData = JSON.parse(readFileSync(resolve(__d, '../data/ores.json'), 'utf8'));

let pass = 0, fail = 0;
function check(name, ok, got) {
  if (ok) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, got !== undefined ? `got: ${JSON.stringify(got)}` : ''); }
}

console.log('state.js');
const s = loadState(oresData.slots);
check('default money 100', s.money === 100, s.money);
check('card1 unlocked', s.unlocks.card1 === true, s.unlocks);
check('card2 locked', s.unlocks.card2 === false, s.unlocks);
check('card3 locked', s.unlocks.card3 === false, s.unlocks);
check('mineSlots length = 4', s.mineSlots.length === 4, s.mineSlots.length);
check('luck level 0', s.upgrades.luck === 0);
check('isCardUnlocked card1', isCardUnlocked('card1', s));
check('!isCardUnlocked card2', !isCardUnlocked('card2', s));
check('ticketPrice card1 base', ticketPrice(cardsData.card1, s, upgradesData) === 25);
check('upgradeCost luck lvl 0 = 200', upgradeCost(upgradesData.luck, 0) === 200);

console.log('card.js — generate + evaluate');
const c1 = generateCard(cardsData.card1, s, upgradesData);
check('card1 has luckyNumber', typeof c1.luckyNumber === 'number');
check('card1 has 5 rows', c1.rows.length === 5);
check('card1 row 0 has 5 cells', c1.rows[0].cells.length === 5);
const r1 = evaluatePrize(c1, s, upgradesData);
check('card1 evaluate has prize >= 0', typeof r1.prize === 'number' && r1.prize >= 0);
check('card1 multiplier 1.0', r1.multiplier === 1);
check('card1 scale 1.0', r1.scale === 1);

const c2 = generateCard(cardsData.card2, s, upgradesData);
check('card2 has 3 regions', c2.regions.length === 3);
const r2 = evaluatePrize(c2, s, upgradesData);
check('card2 prize >= 0', r2.prize >= 0);

const c3 = generateCard(cardsData.card3, s, upgradesData);
check('card3 has cells', c3.cells.length === 25);
check('card3 has targets', c3.targets.length === 3);
const r3 = evaluatePrize(c3, s, upgradesData);
check('card3 prize >= 0', r3.prize >= 0);

console.log('checkUnlocks');
const s2 = loadState(oresData.slots);
s2.cardsScratched.card1 = 5;
const changed = checkUnlocks(s2, cardsData);
check('unlocked card2 after 5 card1', changed && s2.unlocks.card2 === true);
s2.cardsScratched.card2 = 5;
checkUnlocks(s2, cardsData);
check('unlocked card3 after 5 card2', s2.unlocks.card3 === true);

console.log('save/load');
s2.money = 12345;
saveState(s2);
const s3 = loadState(oresData.slots);
check('roundtrip money', s3.money === 12345);
check('roundtrip unlocks', s3.unlocks.card3 === true);

console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
