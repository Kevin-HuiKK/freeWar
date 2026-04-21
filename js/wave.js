export class WaveScheduler {
  constructor(waves) {
    this.waves = waves.map(w => ({
      delay: w.delay || 0,
      spawns: w.spawns.map(s => ({
        type: s.type,
        remaining: s.count,
        interval: s.interval ?? 0,
        sinceLast: 0
      }))
    }));
    this.idx = 0;
    this.waveTime = 0;
    this.waveStarted = false;
  }

  _currentWave() {
    return this.waves[this.idx];
  }

  _waveExhausted(wave) {
    return wave.spawns.every(s => s.remaining === 0);
  }

  tick(dt) {
    const out = [];
    if (this.idx >= this.waves.length) return out;
    const wave = this._currentWave();

    if (!this.waveStarted) {
      this.waveTime += dt;
      if (this.waveTime < wave.delay) return out;
      dt = this.waveTime - wave.delay;
      this.waveStarted = true;
      this.waveTime = 0;
      for (const s of wave.spawns) s.sinceLast = s.interval;
    }

    for (const s of wave.spawns) {
      if (s.remaining === 0) continue;
      if (s.interval === 0) {
        while (s.remaining > 0) {
          out.push(s.type);
          s.remaining -= 1;
        }
        continue;
      }
      s.sinceLast += dt;
      while (s.remaining > 0 && s.sinceLast >= s.interval) {
        out.push(s.type);
        s.remaining -= 1;
        s.sinceLast -= s.interval;
      }
    }

    if (this._waveExhausted(wave)) {
      this.idx += 1;
      this.waveTime = 0;
      this.waveStarted = false;
    }

    return out;
  }

  isComplete() {
    return this.idx >= this.waves.length;
  }

  get currentWaveIndex() {
    return Math.min(this.idx, this.waves.length - 1);
  }

  get totalWaves() {
    return this.waves.length;
  }
}
