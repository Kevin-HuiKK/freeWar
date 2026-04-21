/**
 * v2.0 audio — Battle-City / NES-tank-war inspired chiptune BGM + SFX.
 * Pure Web Audio synthesis. No asset files. Lazy-init on first user gesture.
 */

const MUTE_KEY = 'freewar.v2.muted';
const BPM = 140;
const BEAT = 60 / BPM;
const STEP = BEAT / 4;   // 16th-note grid → 16 steps = 4 beats = 1 bar

export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxGain = null;
    this.bgmGain = null;
    this.muted = localStorage.getItem(MUTE_KEY) === 'true';
    this.bgmActive = false;
    this._nextStep = 0;
    this._stepIdx = 0;
    this._schedTimer = null;
    this._lastPlay = {};
  }

  _ensureCtx() {
    if (this.ctx) return;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.55;
    this.sfxGain.connect(this.master);
    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.value = 0.22;
    this.bgmGain.connect(this.master);
  }

  resume() {
    this._ensureCtx();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(m) {
    this.muted = m;
    localStorage.setItem(MUTE_KEY, m ? 'true' : 'false');
    if (this.master) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.02);
    }
  }

  toggleMute() { this.setMuted(!this.muted); return this.muted; }
  isMuted() { return this.muted; }

  play(name, throttleMs = 0) {
    if (!this.ctx || this.muted) return;
    const now = performance.now();
    if (throttleMs > 0) {
      const last = this._lastPlay[name] || 0;
      if (now - last < throttleMs) return;
      this._lastPlay[name] = now;
    }
    const fn = SFX[name];
    if (fn) fn(this.ctx, this.sfxGain);
  }

  startBgm() {
    this._ensureCtx();
    if (this.bgmActive) return;
    this.bgmActive = true;
    this._nextStep = this.ctx.currentTime + 0.05;
    this._stepIdx = 0;
    this._scheduleBgm();
  }

  stopBgm() {
    this.bgmActive = false;
    if (this._schedTimer) { clearTimeout(this._schedTimer); this._schedTimer = null; }
  }

  _scheduleBgm() {
    if (!this.bgmActive || !this.ctx) return;
    const lookAhead = 0.15;
    while (this._nextStep < this.ctx.currentTime + lookAhead) {
      this._scheduleStep(this._stepIdx, this._nextStep);
      this._stepIdx = (this._stepIdx + 1) % 32;
      this._nextStep += STEP;
    }
    this._schedTimer = setTimeout(() => this._scheduleBgm(), 50);
  }

  _scheduleStep(idx, t) {
    // ---- DRUMS (steady march) ----
    if (idx % 4 === 0) this._kick(t);
    if (idx === 4 || idx === 12 || idx === 20 || idx === 28) this._snare(t);
    if (idx % 2 === 1) this._hat(t);

    // ---- BASS (triangle, 1/4 notes) ----
    // Bar 1: C C F G
    // Bar 2: C C F G (repeat)
    const bassBar1 = [48, null, null, null, 48, null, null, null, 53, null, null, null, 55, null, null, null];
    const bassBar2 = [48, null, null, null, 48, null, null, null, 53, null, null, null, 55, null, null, null];
    const bassSeq = idx < 16 ? bassBar1 : bassBar2;
    const bassNote = bassSeq[idx % 16];
    if (bassNote !== null) this._bass(t, bassNote);

    // ---- LEAD (square, main melody) — 32 steps (2 bars) ----
    // C minor pentatonic blocky march
    // Bar 1: C . C . Eb . C Bb  C . C . Ab . Bb .
    // Bar 2: C . C . F  . Eb C  Bb . Bb . Ab . G  .
    const leadBar1 = [72, null, 72, null, 75, null, 72, 70, 72, null, 72, null, 68, null, 70, null];
    const leadBar2 = [72, null, 72, null, 77, null, 75, 72, 70, null, 70, null, 68, null, 67, null];
    const leadSeq = idx < 16 ? leadBar1 : leadBar2;
    const leadNote = leadSeq[idx % 16];
    if (leadNote !== null) this._lead(t, leadNote);

    // ---- COUNTER-MELODY (triangle, sparse higher notes) ----
    if (idx === 2  || idx === 10) this._counter(t, 79);
    if (idx === 18 || idx === 26) this._counter(t, 77);
  }

  _kick(t) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.1);
    g.gain.setValueAtTime(0.6, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o.connect(g).connect(this.bgmGain);
    o.start(t); o.stop(t + 0.3);
  }

  _snare(t) {
    const buf = this._noiseBuffer(0.12, 10);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = 0.35;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1800;
    src.connect(bp).connect(g).connect(this.bgmGain);
    src.start(t);
  }

  _hat(t) {
    const buf = this._noiseBuffer(0.04, 40);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = 0.12;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 6500;
    src.connect(hp).connect(g).connect(this.bgmGain);
    src.start(t);
  }

  _bass(t, midi) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = midiToHz(midi);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.28, t + 0.02);
    g.gain.setValueAtTime(0.28, t + BEAT - 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + BEAT + 0.04);
    o.connect(g).connect(this.bgmGain);
    o.start(t); o.stop(t + BEAT + 0.08);
  }

  _lead(t, midi) {
    // Square-wave NES-style lead
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'square';
    o.frequency.value = midiToHz(midi);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.13, t + 0.015);
    g.gain.setValueAtTime(0.13, t + STEP - 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + STEP + 0.02);
    o.connect(g).connect(this.bgmGain);
    o.start(t); o.stop(t + STEP + 0.04);
  }

  _counter(t, midi) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = midiToHz(midi);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.08, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(g).connect(this.bgmGain);
    o.start(t); o.stop(t + 0.4);
  }

  _noiseBuffer(dur, decay) {
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i * decay / d.length);
    return buf;
  }
}

function midiToHz(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

const SFX = {
  shoot(ctx, out) {
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(820 + Math.random() * 200, t);
    o.frequency.exponentialRampToValueAtTime(120, t + 0.05);
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    o.connect(g).connect(out);
    o.start(t); o.stop(t + 0.09);
  },

  hit(ctx, out) {
    const t = ctx.currentTime;
    const dur = 0.07;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i * 60 / d.length);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = 0.22;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1500;
    src.connect(bp).connect(g).connect(out);
    src.start(t);
  },

  kill(ctx, out) {
    const t = ctx.currentTime;
    const dur = 0.3;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i * 5 / d.length);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = 0.32;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1200, t);
    lp.frequency.exponentialRampToValueAtTime(150, t + dur);
    src.connect(lp).connect(g).connect(out);
    src.start(t);

    const o = ctx.createOscillator();
    const og = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(100, t);
    o.frequency.exponentialRampToValueAtTime(30, t + 0.25);
    og.gain.setValueAtTime(0.35, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(og).connect(out);
    o.start(t); o.stop(t + 0.35);
  },

  place(ctx, out) {
    const t = ctx.currentTime;
    [[440, 0], [660, 0.05]].forEach(([f, w]) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.2, t + w);
      g.gain.exponentialRampToValueAtTime(0.001, t + w + 0.1);
      o.connect(g).connect(out);
      o.start(t + w); o.stop(t + w + 0.12);
    });
  },

  error(ctx, out) {
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(200, t);
    o.frequency.linearRampToValueAtTime(110, t + 0.15);
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.connect(g).connect(out);
    o.start(t); o.stop(t + 0.22);
  },

  buy(ctx, out) {
    // Cha-ching
    const t = ctx.currentTime;
    [[660, 0], [880, 0.05], [1320, 0.1]].forEach(([f, w]) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.value = f;
      g.gain.setValueAtTime(0, t + w);
      g.gain.linearRampToValueAtTime(0.15, t + w + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + w + 0.14);
      o.connect(g).connect(out);
      o.start(t + w); o.stop(t + w + 0.16);
    });
  },

  hero(ctx, out) {
    // Heroic horn
    const t = ctx.currentTime;
    [[392, 0, 0.18], [523, 0.15, 0.22], [659, 0.32, 0.35]].forEach(([f, w, d]) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.value = f;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 2200;
      g.gain.setValueAtTime(0, t + w);
      g.gain.linearRampToValueAtTime(0.22, t + w + 0.04);
      g.gain.setValueAtTime(0.22, t + w + d - 0.08);
      g.gain.linearRampToValueAtTime(0, t + w + d);
      o.connect(lp).connect(g).connect(out);
      o.start(t + w); o.stop(t + w + d + 0.05);
    });
  },

  skill(ctx, out) {
    // Whoosh + boom
    const t = ctx.currentTime;
    // Whoosh (pitched noise sweep)
    const dur1 = 0.25;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur1, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i * 4 / d.length);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g1 = ctx.createGain(); g1.gain.value = 0.25;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(400, t);
    lp.frequency.exponentialRampToValueAtTime(2400, t + dur1);
    src.connect(lp).connect(g1).connect(out);
    src.start(t);
    // Boom (low sub)
    const o = ctx.createOscillator();
    const g2 = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(160, t + 0.22);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.55);
    g2.gain.setValueAtTime(0, t + 0.22);
    g2.gain.linearRampToValueAtTime(0.5, t + 0.23);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    o.connect(g2).connect(out);
    o.start(t + 0.22); o.stop(t + 0.65);
  },

  flagHit(ctx, out) {
    const t = ctx.currentTime;
    const dur = 0.35;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i * 4 / d.length);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = 0.3;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 260;
    src.connect(lp).connect(g).connect(out);
    src.start(t);
  },

  win(ctx, out) {
    const t = ctx.currentTime;
    [60, 64, 67, 72, 76].forEach((m, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.value = midiToHz(m);
      const s = t + i * 0.12;
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.26, s + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, s + 0.5);
      o.connect(g).connect(out);
      o.start(s); o.stop(s + 0.6);
    });
  },

  lose(ctx, out) {
    const t = ctx.currentTime;
    [67, 63, 58, 53, 48].forEach((m, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.value = midiToHz(m);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 1400;
      const s = t + i * 0.18;
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.22, s + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, s + 0.7);
      o.connect(lp).connect(g).connect(out);
      o.start(s); o.stop(s + 0.8);
    });
  }
};
