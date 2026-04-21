export class Economy {
  constructor({ startingGold, goldPerSecond }) {
    this._gold = startingGold;
    this.rate = goldPerSecond;
  }

  tick(dt) {
    this._gold += this.rate * dt;
  }

  addBounty(n) {
    this._gold += n;
  }

  spend(n) {
    if (this.gold < n) return false;
    this._gold -= n;
    return true;
  }

  get gold() {
    return Math.floor(this._gold);
  }
}
