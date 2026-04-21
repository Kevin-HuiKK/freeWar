/**
 * Enemy AI opponent.
 * Accumulates gold over time; periodically picks a random affordable unit
 * and spawns it at the enemy flag.
 */
export class EnemyAI {
  constructor({ config, economy, onSpawn, rng = Math.random }) {
    this.config = config;
    this.economy = economy;
    this.onSpawn = onSpawn;
    this.rng = rng;
    this._nextCycle = config.initialDelay;
    this._timer = 0;
  }

  tick(dt) {
    this._timer += dt;
    if (this._timer < this._nextCycle) return;
    this._timer = 0;
    this._nextCycle = this._pickCycleDelay();
    this._attemptSpawn();
  }

  _pickCycleDelay() {
    const [lo, hi] = this.config.cycleInterval;
    return lo + this.rng() * (hi - lo);
  }

  _attemptSpawn() {
    const gold = this.economy.gold;

    // Small chance to save up for a bigger unit if barely above threshold
    if (gold < this.config.saveUpMax && this.rng() < this.config.saveUpChance) {
      return;
    }

    const affordable = this.config.unitPool.filter(u => u.minGold <= gold);
    if (affordable.length === 0) return;

    const totalWeight = affordable.reduce((s, u) => s + u.weight, 0);
    let r = this.rng() * totalWeight;
    let picked = affordable[0];
    for (const u of affordable) {
      r -= u.weight;
      if (r <= 0) { picked = u; break; }
    }

    if (this.economy.spend(picked.minGold)) {
      this.onSpawn(picked.type);
    }
  }
}
