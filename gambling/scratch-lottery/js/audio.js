// Audio system for the scratch-lottery treasure game.
// Vanilla WebAudio synth — no dependencies. Upbeat exploration BGM (not casino).

const MUTE_KEY = 'scratch-lottery.muted';
const BGM_BPM = 104;
const BGM_BEAT = 60 / BGM_BPM;          // quarter-note length in seconds
const BGM_STEP = BGM_BEAT / 2;          // 8th-note grid
const BGM_STEPS = 16;                   // two bars per loop

function midiToHz(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxGain = null;
    this.bgmGain = null;
    this.muted = localStorage.getItem(MUTE_KEY) === 'true';
    this.bgmActive = false;
    this.bgmNextStep = 0;
    this.bgmStepIdx = 0;
    this._schedTimer = null;
    this._lastPlay = {};
  }

  _ensureCtx() {
    if (this.ctx) return;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.5;
    this.sfxGain.connect(this.master);
    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.value = 0.15;
    this.bgmGain.connect(this.master);
  }

  resume() {
    this._ensureCtx();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(m) {
    this.muted = !!m;
    localStorage.setItem(MUTE_KEY, this.muted ? 'true' : 'false');
    if (this.master) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.setTargetAtTime(this.muted ? 0 : 1, this.ctx.currentTime, 0.02);
    }
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

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
    if (fn) {
      try { fn(this.ctx, this.sfxGain); } catch (_) { /* no-op */ }
    }
  }

  startBgm() {
    this._ensureCtx();
    if (!this.ctx || this.bgmActive) return;
    this.bgmActive = true;
    this.bgmNextStep = this.ctx.currentTime + 0.05;
    this.bgmStepIdx = 0;
    this._scheduleBgm();
  }

  stopBgm() {
    this.bgmActive = false;
    if (this._schedTimer) {
      clearTimeout(this._schedTimer);
      this._schedTimer = null;
    }
  }

  _scheduleBgm() {
    if (!this.bgmActive || !this.ctx) return;
    const lookAhead = 0.15;
    while (this.bgmNextStep < this.ctx.currentTime + lookAhead) {
      this._scheduleStep(this.bgmStepIdx, this.bgmNextStep);
      this.bgmStepIdx = (this.bgmStepIdx + 1) % BGM_STEPS;
      this.bgmNextStep += BGM_STEP;
    }
    this._schedTimer = setTimeout(() => this._scheduleBgm(), 50);
  }

  _scheduleStep(idx, t) {
    // Soft kick on beats 1 and 3 of every bar (steps 0, 8 within a bar of 8 steps,
    // but our loop is 2 bars / 16 steps so kicks fall on 0, 4, 8, 12).
    if (idx === 0 || idx === 4 || idx === 8 || idx === 12) this._kick(t);
    // Soft hat on offbeat 8th-notes.
    if (idx % 2 === 1) this._hat(t);

    // Chord progression: C - F - Am - G (one chord per bar = 8 steps).
    // Two-bar loop covers two chords. Roots in MIDI: C3=48, F3=53, A3=57, G3=55.
    // Loop A (this 16-step pass): C major then F major.
    // Loop B (next pass)         : Am then G major.
    // We swap each loop using stepIdx rollover counter via bgmStepIdx tracking.
    // To keep it self-contained inside _scheduleStep, alternate by checking
    // a derived loopParity stored on the instance.
    if (idx === 0) {
      this._loopParity = (this._loopParity || 0) ^ 1;
    }
    const parity = this._loopParity || 0;
    const chordsA = [
      { root: 48, third: 52, fifth: 55, seventh: 59 }, // Cmaj7
      { root: 53, third: 57, fifth: 60, seventh: 64 }, // Fmaj7
    ];
    const chordsB = [
      { root: 57, third: 60, fifth: 64, seventh: 67 }, // Am7
      { root: 55, third: 59, fifth: 62, seventh: 65 }, // G7
    ];
    const chords = parity === 0 ? chordsA : chordsB;

    if (idx === 0) this._padChord(t, chords[0], BGM_BEAT * 4);
    if (idx === 8) this._padChord(t, chords[1], BGM_BEAT * 4);

    // Bass line: root on beat 1, fifth on beat 3 — steady, gentle.
    const bassPattern = [
      // bar 1 (chord 0)
      chords[0].root, null, null, null, chords[0].fifth, null, chords[0].root, null,
      // bar 2 (chord 1)
      chords[1].root, null, null, null, chords[1].fifth, null, chords[1].root, null,
    ];
    if (bassPattern[idx] !== null && bassPattern[idx] !== undefined) {
      this._bassNote(t, bassPattern[idx]);
    }

    // Sparse melody motif — once every 2 bars (i.e. once per loop), starting near the
    // top of the loop. 5 notes drifting up then settling. Uses chord tones for a
    // pleasant "exploration" feel.
    // Steps 2, 4, 6, 9, 11 — gives a syncopated, light skip.
    const melodyA = {
      2: chords[0].fifth + 12,   // high fifth
      4: chords[0].seventh + 7,  // bright color tone
      6: chords[0].root + 12,    // octave
      9: chords[1].third + 12,   // chord tone of chord 2
      11: chords[1].fifth + 7,
    };
    const melodyB = {
      2: chords[0].root + 12,
      4: chords[0].fifth + 7,
      6: chords[0].third + 12,
      9: chords[1].root + 12,
      11: chords[1].seventh + 7,
    };
    const mel = parity === 0 ? melodyA : melodyB;
    if (mel[idx] !== undefined) this._melodyNote(t, mel[idx]);
  }

  // ---------- BGM voices ----------

  _kick(t) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(48, t + 0.1);
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    osc.connect(g).connect(this.bgmGain);
    osc.start(t); osc.stop(t + 0.32);
  }

  _hat(t) {
    const dur = 0.04;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.exp(-i * 50 / d.length);
    }
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = 0.08;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 7000;
    src.connect(hp).connect(g).connect(this.bgmGain);
    src.start(t);
  }

  _bassNote(t, midi) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = midiToHz(midi);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380; lp.Q.value = 1.4;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.03);
    g.gain.setValueAtTime(0.18, t + BGM_STEP * 2 - 0.06);
    g.gain.exponentialRampToValueAtTime(0.001, t + BGM_STEP * 2 + 0.05);
    osc.connect(lp).connect(g).connect(this.bgmGain);
    osc.start(t); osc.stop(t + BGM_STEP * 2 + 0.1);
  }

  _padChord(t, chord, dur) {
    // Layered sine pad — root, third, fifth, seventh — soft swells.
    const notes = [chord.root + 12, chord.third + 12, chord.fifth + 12, chord.seventh + 12];
    for (const m of notes) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = midiToHz(m);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.045, t + 0.5);
      g.gain.setValueAtTime(0.045, t + dur - 0.5);
      g.gain.linearRampToValueAtTime(0, t + dur);
      osc.connect(g).connect(this.bgmGain);
      osc.start(t); osc.stop(t + dur + 0.05);
    }
  }

  _melodyNote(t, midi) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = midiToHz(midi);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(g).connect(this.bgmGain);
    osc.start(t); osc.stop(t + 0.55);
  }
}

// ---------- SFX library ----------

const SFX = {
  // Soft white-noise sweep — emitted while user drags. Throttle externally.
  scratch(ctx, out) {
    const t = ctx.currentTime;
    const dur = 0.08;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      const env = Math.sin(Math.PI * (i / d.length)); // hump envelope
      d[i] = (Math.random() * 2 - 1) * env;
    }
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = 0.08;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1800 + Math.random() * 600, t);
    bp.frequency.linearRampToValueAtTime(900, t + dur);
    bp.Q.value = 0.8;
    src.connect(bp).connect(g).connect(out);
    src.start(t);
  },

  // Bright "ding" arpeggio — three ascending triangle notes (C5-E5-G5).
  'win-small'(ctx, out) {
    const t = ctx.currentTime;
    [72, 76, 79].forEach((m, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = midiToHz(m);
      const s = t + i * 0.08;
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.22, s + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, s + 0.18);
      osc.connect(g).connect(out);
      osc.start(s); osc.stop(s + 0.22);
    });
  },

  // Exciting cascade — noise burst + ascending arpeggio + low boom.
  'win-big'(ctx, out) {
    const t = ctx.currentTime;

    // Noise sparkle burst at the start.
    const dur = 0.18;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.exp(-i * 8 / d.length);
    }
    const src = ctx.createBufferSource(); src.buffer = buf;
    const ng = ctx.createGain(); ng.gain.value = 0.28;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 3000;
    src.connect(hp).connect(ng).connect(out);
    src.start(t);

    // Ascending arpeggio: C major over an octave + (C, E, G, C, E, G).
    const notes = [60, 64, 67, 72, 76, 79, 84];
    notes.forEach((m, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = midiToHz(m);
      const s = t + 0.04 + i * 0.07;
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.4, s + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, s + 0.45);
      osc.connect(g).connect(out);
      osc.start(s); osc.stop(s + 0.5);
    });

    // Low boom underneath.
    const boom = ctx.createOscillator();
    const bg = ctx.createGain();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(110, t);
    boom.frequency.exponentialRampToValueAtTime(45, t + 0.5);
    bg.gain.setValueAtTime(0.4, t);
    bg.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    boom.connect(bg).connect(out);
    boom.start(t); boom.stop(t + 0.6);
  },

  // Gentle low descending tone — A3 → F3 on triangle. Not punishing.
  'near-miss'(ctx, out) {
    const t = ctx.currentTime;
    [57, 53].forEach((m, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = midiToHz(m);
      const s = t + i * 0.13;
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.18, s + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, s + 0.18);
      osc.connect(g).connect(out);
      osc.start(s); osc.stop(s + 0.22);
    });
  },

  // "Ka-ching" — pair of high blips.
  buy(ctx, out) {
    const t = ctx.currentTime;
    [[1320, 0], [1760, 0.06]].forEach(([f, w]) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = f;
      g.gain.setValueAtTime(0, t + w);
      g.gain.linearRampToValueAtTime(0.16, t + w + 0.005);
      g.gain.exponentialRampToValueAtTime(0.001, t + w + 0.08);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 4000;
      osc.connect(lp).connect(g).connect(out);
      osc.start(t + w); osc.stop(t + w + 0.1);
    });
  },

  // Short low buzz — square wave, low pitch.
  error(ctx, out) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.linearRampToValueAtTime(120, t + 0.1);
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 800;
    osc.connect(lp).connect(g).connect(out);
    osc.start(t); osc.stop(t + 0.14);
  },

  // Fanfare — two rising perfect-fifth chords on triangle.
  unlock(ctx, out) {
    const t = ctx.currentTime;
    // Chord 1: C5 + G5 (root + fifth)
    // Chord 2: F5 + C6 (a fourth up — bright lift)
    const chords = [
      { time: 0,    notes: [72, 79] },
      { time: 0.18, notes: [77, 84] },
    ];
    chords.forEach(({ time, notes }) => {
      notes.forEach((m) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = midiToHz(m);
        const s = t + time;
        g.gain.setValueAtTime(0, s);
        g.gain.linearRampToValueAtTime(0.22, s + 0.02);
        g.gain.setValueAtTime(0.22, s + 0.16);
        g.gain.exponentialRampToValueAtTime(0.001, s + 0.32);
        osc.connect(g).connect(out);
        osc.start(s); osc.stop(s + 0.36);
      });
    });
  },

  // Coin pickup — single high "tink" sine ~1200Hz with quick decay.
  collect(ctx, out) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(1500, t + 0.04);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.24, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(g).connect(out);
    osc.start(t); osc.stop(t + 0.1);
  },

  // Soft "thud" — short low sine envelope.
  place(ctx, out) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.08);
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(g).connect(out);
    osc.start(t); osc.stop(t + 0.12);
  },

  // Magical chime — 3 sine notes high (A5/C6/E6) overlapping with shimmer.
  reveal(ctx, out) {
    const t = ctx.currentTime;
    [81, 84, 88].forEach((m, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = midiToHz(m);
      const s = t + i * 0.06;
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.18, s + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, s + 0.45);
      osc.connect(g).connect(out);
      osc.start(s); osc.stop(s + 0.5);
    });

    // Shimmer: short high-passed noise tail for sparkle.
    const dur = 0.4;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.exp(-i * 4 / d.length);
    }
    const src = ctx.createBufferSource(); src.buffer = buf;
    const ng = ctx.createGain(); ng.gain.value = 0.06;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 5000;
    src.connect(hp).connect(ng).connect(out);
    src.start(t);
  },
};
