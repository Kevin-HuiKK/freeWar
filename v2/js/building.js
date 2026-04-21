let BID = 0;

/**
 * Non-combat structures (金矿 / 沙袋).
 * Gold mines emit bounty every `interval` seconds to the owner's economy.
 * Sandbags block the path (not yet wired to pathfinding — future).
 */
export class Building {
  constructor({ typeKey, config, x, y, team }) {
    this.id = ++BID;
    this.typeKey = typeKey;
    this.kind = 'building';
    this.team = team;
    this.name = config.name;
    this.x = x;
    this.y = y;
    this.maxHp = config.hp;
    this.hp = config.hp;
    this.size = config.size;
    this.color = config.color;
    this.income = config.income || 0;
    this.interval = config.interval || 0;
    this.blocks = !!config.blocks;
    this._tick = 0;
    this.pulse = 0;
  }

  update(dt, battlefield) {
    this.pulse = Math.max(0, this.pulse - dt);
    if (this.income <= 0) return;
    this._tick += dt;
    if (this._tick >= this.interval) {
      this._tick -= this.interval;
      battlefield.creditBounty(this.team, this.income);
      this.pulse = 0.5;
    }
  }

  draw(ctx) {
    const half = this.size / 2;
    if (this.typeKey === 'goldmine') {
      ctx.fillStyle = this.color;
      ctx.strokeStyle = '#d4a43a';
      ctx.lineWidth = 2;
      ctx.fillRect(this.x - half, this.y - half, this.size, this.size);
      ctx.strokeRect(this.x - half, this.y - half, this.size, this.size);
      ctx.fillStyle = '#ffd46a';
      ctx.font = 'bold 22px "Black Ops One", Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', this.x, this.y + 2);
      if (this.pulse > 0) {
        const a = this.pulse * 2;
        ctx.fillStyle = `rgba(255,212,106,${a})`;
        ctx.font = 'bold 14px "JetBrains Mono", monospace';
        ctx.fillText(`+${this.income}`, this.x, this.y - this.size / 2 - 10 - (1 - this.pulse * 2) * 6);
      }
    } else {
      // sandbag / generic
      ctx.fillStyle = this.color;
      ctx.strokeStyle = '#4a3a1e';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, half, half * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // team marker
    ctx.strokeStyle = this.team === 'ally' ? 'rgba(74,138,199,0.6)' : 'rgba(225,74,58,0.6)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(this.x - half + 1, this.y - half + 1, this.size - 2, this.size - 2);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';

    // HP bar
    const w = this.size + 4;
    const ratio = Math.max(0, this.hp / this.maxHp);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(this.x - w / 2, this.y - half - 8, w, 5);
    ctx.fillStyle = ratio > 0.6 ? '#6cdc5c' : ratio > 0.3 ? '#e8c94a' : '#e14a3a';
    ctx.fillRect(this.x - w / 2 + 1, this.y - half - 7, (w - 2) * ratio, 3);
  }

  get alive() { return this.hp > 0; }
}
