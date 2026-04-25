import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { generateCard, evaluatePrize } from '../js/card.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cardsData = JSON.parse(readFileSync(resolve(__dirname, '../data/cards.json'), 'utf8'));
const upgradesData = JSON.parse(readFileSync(resolve(__dirname, '../data/upgrades.json'), 'utf8'));

const baselineState = {
  upgrades: { luck: 0, multiplier: 0, scale: 0 }
};

const N = 100_000;

console.log('cards EV simulation @ N =', N);
console.log('target: payback ratio ≈ 0.60 (game keeps 40%)');
console.log('-'.repeat(64));

for (const cardId of Object.keys(cardsData)) {
  const def = cardsData[cardId];
  let totalSpent = 0;
  let totalWon = 0;
  let wins = 0;
  let bigWin = 0;
  for (let i = 0; i < N; i++) {
    const card = generateCard(def, baselineState, upgradesData);
    const r = evaluatePrize(card, baselineState, upgradesData);
    totalSpent += def.basePrice;
    totalWon += r.prize;
    if (r.prize > 0) wins++;
    if (r.prize > bigWin) bigWin = r.prize;
  }
  const payback = totalWon / totalSpent;
  const winRate = wins / N;
  const evPerCard = totalWon / N;
  console.log(
    `${cardId.padEnd(6)} price=$${def.basePrice.toString().padEnd(5)} ` +
    `EV=$${evPerCard.toFixed(2).padStart(8)} ` +
    `payback=${(payback * 100).toFixed(1)}% ` +
    `winRate=${(winRate * 100).toFixed(1)}% ` +
    `maxWin=$${bigWin}`
  );
}

console.log('-'.repeat(64));
console.log('with maxed luck (10) + multiplier (5) — at upgrade caps:');
const maxedState = {
  upgrades: { luck: 10, multiplier: 5, scale: 0 }
};
for (const cardId of Object.keys(cardsData)) {
  const def = cardsData[cardId];
  let totalSpent = 0;
  let totalWon = 0;
  for (let i = 0; i < N; i++) {
    const card = generateCard(def, maxedState, upgradesData);
    const r = evaluatePrize(card, maxedState, upgradesData);
    totalSpent += def.basePrice;
    totalWon += r.prize;
  }
  const payback = totalWon / totalSpent;
  console.log(
    `${cardId.padEnd(6)} payback=${(payback * 100).toFixed(1)}%   ` +
    `(higher because upgrades help the player)`
  );
}
