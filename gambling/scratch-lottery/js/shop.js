import { ticketPrice, isCardUnlocked } from './state.js';

const CARD_NAMES = { card1: '卡1', card2: '卡2', card3: '卡3' };

function previousCard(cardId) {
  if (cardId === 'card2') return 'card1';
  if (cardId === 'card3') return 'card2';
  return null;
}

export function renderShop(container, state, cardsData, upgradesData, callbacks) {
  container.innerHTML = '';
  for (const cardId of Object.keys(cardsData)) {
    const def = cardsData[cardId];
    const unlocked = isCardUnlocked(cardId, state);
    const price = ticketPrice(def, state, upgradesData);
    const affordable = state.money >= price;

    const el = document.createElement('div');
    el.className = 'shop-card';

    if (!unlocked) {
      el.classList.add('locked');
      const prev = previousCard(cardId);
      const need = def.unlockAfterCards || 0;
      const prevName = prev ? CARD_NAMES[prev] : '';
      el.innerHTML = `
        <div class="name">🔒 ${def.name}</div>
        <div class="desc">刮 ${need} 张 ${prevName} 解锁</div>
      `;
    } else {
      if (!affordable) el.classList.add('disabled');
      el.innerHTML = `
        <div class="name">${def.name}</div>
        <div class="desc">${def.desc}</div>
        <div class="price">$${price}</div>
      `;
      if (affordable) {
        el.addEventListener('click', () => callbacks.onBuy(cardId));
      }
    }
    container.appendChild(el);
  }
}
