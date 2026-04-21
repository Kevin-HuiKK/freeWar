/**
 * Player / enemy flag with HP.
 * Enemy units that reach their opponent's flag damage it tick-by-tick.
 */
export class Flag {
  constructor({ x, y, hp, team }) {
    this.x = x;
    this.y = y;
    this.maxHp = hp;
    this.hp = hp;
    this.team = team;       // 'ally' or 'enemy'
    this.damageFlash = 0;
  }
  damage(n) {
    this.hp = Math.max(0, this.hp - n);
    this.damageFlash = 0.4;
    return this.hp === 0;
  }
  tick(dt) {
    if (this.damageFlash > 0) this.damageFlash = Math.max(0, this.damageFlash - dt);
  }
  get alive() { return this.hp > 0; }
  get ratio() { return this.hp / this.maxHp; }
}
