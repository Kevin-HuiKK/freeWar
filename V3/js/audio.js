// audio.js — synthesized SFX (no asset files, generated via WebAudio)
import { state } from './state.js';

let ac = null;
function ctx() {
  if (!ac) {
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { return null; }
  }
  return ac;
}

const RECIPES = {
  select:   { freq: 660, dur: 0.05, type: 'square', vol: 0.05 },
  move:     { freq: 440, dur: 0.08, type: 'sine',   vol: 0.06 },
  build:    { freq: 220, dur: 0.18, type: 'triangle', vol: 0.08, sweep: 1.5 },
  battle:   { freq: 110, dur: 0.30, type: 'sawtooth', vol: 0.10, sweep: 0.5 },
  capture:  { freq: 880, dur: 0.30, type: 'triangle', vol: 0.09, sweep: 1.5 },
  endturn:  { freq: 330, dur: 0.20, type: 'sine',     vol: 0.06, sweep: 0.7 },
  skill:    { freq: 550, dur: 0.15, type: 'square',   vol: 0.06, sweep: 1.4 },
  blocked:  { freq: 180, dur: 0.10, type: 'square',   vol: 0.06, sweep: 0.5 },
};

export function play(name) {
  if (state.muted) return;
  const r = RECIPES[name];
  const c = ctx();
  if (!r || !c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = r.type;
  o.frequency.value = r.freq;
  if (r.sweep) o.frequency.exponentialRampToValueAtTime(r.freq * r.sweep, c.currentTime + r.dur);
  g.gain.value = r.vol;
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + r.dur);
  o.connect(g); g.connect(c.destination);
  o.start();
  o.stop(c.currentTime + r.dur);
}

// Simple ambient drone for BGM
let bgmPlaying = false;
export function startBGM() {
  if (state.muted || bgmPlaying) return;
  const c = ctx();
  if (!c) return;
  bgmPlaying = true;
  const drone = c.createOscillator();
  drone.type = 'sine';
  drone.frequency.value = 110;
  const lfo = c.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.1;
  const lfoGain = c.createGain();
  lfoGain.gain.value = 5;
  const g = c.createGain();
  g.gain.value = 0.025;
  lfo.connect(lfoGain);
  lfoGain.connect(drone.frequency);
  drone.connect(g); g.connect(c.destination);
  drone.start(); lfo.start();
}
