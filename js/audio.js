const MUTE_KEY = 'freewar.muted';
const BGM_BPM = 84;
const BGM_BEAT = 60 / BGM_BPM;      // quarter note length
const BGM_STEP = BGM_BEAT / 2;      // 8th note grid

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
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.5;
    this.sfxGain.connect(this.master);
    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.value = 0.18;
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
    if (fn) fn(this.ctx, this.sfxGain);
  }

  startBgm() {
    this._ensureCtx();
    if (this.bgmActive) return;
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
      this.bgmStepIdx = (this.bgmStepIdx + 1) % 16;
      this.bgmNextStep += BGM_STEP;
    }
    this._schedTimer = setTimeout(() => this._scheduleBgm(), 50);
  }

  _scheduleStep(idx, t) {
    if (idx === 0 || idx === 4 || idx === 8 || idx === 12) this._kick(t);
    if (idx === 4 || idx === 12) this._snare(t);
    if (idx % 2 === 1) this._hat(t);

    // Bass line over 2 bars: Am - Am - Fmaj7 - Fmaj7 style
    const bassPattern = [57, null, 60, null, 57, null, 55, null,
                         53, null, 57, null, 53, null, 52, null];
    if (bassPattern[idx] !== null) this._bassNote(t, bassPattern[idx]);

    // Pad chord changes on bar boundaries
    if (idx === 0) this._padChord(t, 57, BGM_BEAT * 4);
    if (idx === 8) this._padChord(t, 53, BGM_BEAT * 4);

    // Sparse high melody for texture
    const melody = [null, null, null, null, null, null, 72, null,
                    null, null, null, null, null, 70, null, null];
    if (melody[idx] !== null) this._melodyNote(t, melody[idx]);
  }

  _kick(t) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(0.65, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    osc.connect(g).connect(this.bgmGain);
    osc.start(t); osc.stop(t + 0.35);
  }

  _snare(t) {
    const dur = 0.16;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i * 10 / d.length);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = 0.32;
    const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800;
    src.connect(bp).connect(g).connect(this.bgmGain);
    src.start(t);
  }

  _hat(t) {
    const dur = 0.05;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i * 40 / d.length);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = 0.12;
    const hp = this.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6000;
    src.connect(hp).connect(g).connect(this.bgmGain);
    src.start(t);
  }

  _bassNote(t, midi) {
    const f = midiToHz(midi);
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = f;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 450; lp.Q.value = 2;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.22, t + 0.02);
    g.gain.setValueAtTime(0.22, t + BGM_STEP - 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + BGM_STEP + 0.05);
    osc.connect(lp).connect(g).connect(this.bgmGain);
    osc.start(t); osc.stop(t + BGM_STEP + 0.1);
  }

  _padChord(t, rootMidi, dur) {
    const intervals = [0, 7, 12]; // root-fifth-octave (power chord)
    for (const iv of intervals) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = midiToHz(rootMidi + iv);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.06, t + 0.4);
      g.gain.setValueAtTime(0.06, t + dur - 0.4);
      g.gain.linearRampToValueAtTime(0, t + dur);
      osc.connect(g).connect(this.bgmGain);
      osc.start(t); osc.stop(t + dur + 0.05);
    }
  }

  _melodyNote(t, midi) {
    const f = midiToHz(midi);
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = f;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.11, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    osc.connect(g).connect(this.bgmGain);
    osc.start(t); osc.stop(t + 0.65);
  }
}

function midiToHz(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

const SFX = {
  shoot(ctx, out) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(720 + Math.random() * 280, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.06);
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(g).connect(out);
    osc.start(t); osc.stop(t + 0.1);

    // noise layer for "crack"
    const dur = 0.04;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i * 30 / d.length);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const ng = ctx.createGain(); ng.gain.value = 0.15;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2000;
    src.connect(hp).connect(ng).connect(out);
    src.start(t);
  },

  hit(ctx, out) {
    const t = ctx.currentTime;
    const dur = 0.08;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i * 50 / d.length);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = 0.22;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 2;
    src.connect(bp).connect(g).connect(out);
    src.start(t);
  },

  kill(ctx, out) {
    const t = ctx.currentTime;
    // Explosion-ish noise
    const dur = 0.35;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i * 5 / d.length);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = 0.32;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1200, t);
    lp.frequency.exponentialRampToValueAtTime(150, t + dur);
    src.connect(lp).connect(g).connect(out);
    src.start(t);

    // Sub-bass thump
    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.25);
    og.gain.setValueAtTime(0.35, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(og).connect(out);
    osc.start(t); osc.stop(t + 0.35);
  },

  place(ctx, out) {
    const t = ctx.currentTime;
    [[440, 0], [660, 0.04]].forEach(([f, w]) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = f;
      g.gain.setValueAtTime(0.18, t + w);
      g.gain.exponentialRampToValueAtTime(0.001, t + w + 0.09);
      osc.connect(g).connect(out);
      osc.start(t + w); osc.stop(t + w + 0.11);
    });
  },

  error(ctx, out) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.linearRampToValueAtTime(110, t + 0.15);
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1000;
    osc.connect(lp).connect(g).connect(out);
    osc.start(t); osc.stop(t + 0.22);
  },

  wave(ctx, out) {
    const t = ctx.currentTime;
    [[294, 0, 0.22], [392, 0.22, 0.45]].forEach(([f, w, d]) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 2400;
      g.gain.setValueAtTime(0, t + w);
      g.gain.linearRampToValueAtTime(0.18, t + w + 0.03);
      g.gain.setValueAtTime(0.18, t + w + d - 0.08);
      g.gain.linearRampToValueAtTime(0, t + w + d);
      osc.connect(lp).connect(g).connect(out);
      osc.start(t + w); osc.stop(t + w + d + 0.05);
    });
  },

  win(ctx, out) {
    const t = ctx.currentTime;
    [60, 64, 67, 72].forEach((m, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = midiToHz(m);
      const s = t + i * 0.13;
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.28, s + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, s + 0.55);
      osc.connect(g).connect(out);
      osc.start(s); osc.stop(s + 0.65);
    });
  },

  lose(ctx, out) {
    const t = ctx.currentTime;
    [65, 62, 58, 53].forEach((m, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = midiToHz(m);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 1500;
      const s = t + i * 0.18;
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.22, s + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, s + 0.75);
      osc.connect(lp).connect(g).connect(out);
      osc.start(s); osc.stop(s + 0.85);
    });
  },

  baseHit(ctx, out) {
    const t = ctx.currentTime;
    const dur = 0.4;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i * 4 / d.length);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = 0.3;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
    src.connect(lp).connect(g).connect(out);
    src.start(t);
  }
};
