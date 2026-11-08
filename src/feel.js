// The feel layer: every game event comes through feel(name) and turns into a sound,
// a buzz and sometimes a small camera nudge. Sounds are generated in code for now;
// recorded sounds can replace each recipe later without touching the game.
import { tune } from './tune.js';

let ctx = null;
let master = null;
let noise = null;
let whirNodes = null;
let lastBuzz = 0;

export const kick = { amount: 0 };

export function unlockAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = tune.volume;
  master.connect(ctx.destination);
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

export function setVolume(v) {
  if (master) master.gain.value = v;
}

function envelope(g, t, peak, attack, decay) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function noiseHit({ freq = 2000, q = 1, type = 'bandpass', dur = 0.03, gain = 0.3, at = 0 }) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  envelope(g, t, gain, 0.002, dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}

function tone({ freq = 440, to = null, dur = 0.1, gain = 0.2, type = 'sine', at = 0, attack = 0.003 }) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + attack + dur);
  const g = ctx.createGain();
  envelope(g, t, gain, attack, dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + attack + dur + 0.05);
}

// Bicycle bell: a bright strike with slightly detuned partials that shimmer as they fade
function bell(at) {
  const base = 2150;
  const partials = [
    [1, 1, 1.5],
    [1.51, 0.5, 1.1],
    [2.02, 0.35, 0.8],
    [2.74, 0.25, 0.6],
    [4.1, 0.12, 0.35],
  ];
  for (const [r, a, d] of partials) {
    tone({ freq: base * r, dur: d, gain: 0.11 * a, at, attack: 0.002 });
    tone({ freq: base * r * 1.004, dur: d, gain: 0.07 * a, at, attack: 0.002 });
  }
  noiseHit({ freq: 5200, q: 2, dur: 0.02, gain: 0.25, at });
}

function boing() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(430, t);
  o.frequency.exponentialRampToValueAtTime(140, t + 0.45);
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 15;
  const depth = ctx.createGain();
  depth.gain.setValueAtTime(70, t);
  depth.gain.linearRampToValueAtTime(4, t + 0.45);
  lfo.connect(depth).connect(o.frequency);
  const g = ctx.createGain();
  envelope(g, t, 0.32, 0.005, 0.5);
  o.connect(g).connect(master);
  o.start(t);
  lfo.start(t);
  o.stop(t + 0.6);
  lfo.stop(t + 0.6);
}

function lidCreak() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 5;
  f.frequency.setValueAtTime(260, t);
  f.frequency.exponentialRampToValueAtTime(1100, t + 1.1);
  const g = ctx.createGain();
  envelope(g, t, 0.13, 0.25, 0.9);
  src.connect(f).connect(g).connect(master);
  src.start(t);
  src.stop(t + 1.3);
  tone({ freq: 75, to: 120, dur: 0.8, gain: 0.025, type: 'sawtooth', attack: 0.15 });
}

// The quiet chain whir, louder as the wheel spins faster (0..1)
export function setWhir(level) {
  if (!ctx) return;
  if (!whirNodes) {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(f).connect(g).connect(master);
    src.start();
    whirNodes = { f, g };
  }
  const t = ctx.currentTime;
  whirNodes.g.gain.setTargetAtTime(level * 0.09, t, 0.06);
  whirNodes.f.frequency.setTargetAtTime(400 + level * 1600, t, 0.06);
}

// Android phones buzz from the web; iPhones and iPads need the app wrapper (Capacitor) later.
function buzz(ms, minGap = 0) {
  if (!navigator.vibrate || tune.haptics <= 0) return;
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  const now = performance.now();
  if (now - lastBuzz < minGap) return;
  lastBuzz = now;
  try {
    navigator.vibrate(Math.max(5, Math.round(ms * tune.haptics)));
  } catch {
    // Some browsers throw before the first tap; the next event will try again.
  }
}

const recipes = {
  latch() {
    noiseHit({ freq: 3200, q: 3, dur: 0.03, gain: 0.35 });
    tone({ freq: 1350, dur: 0.05, gain: 0.12, type: 'triangle' });
    tone({ freq: 2650, dur: 0.04, gain: 0.06, type: 'triangle' });
    buzz(18);
    kick.amount += 0.002;
  },
  lid() {
    lidCreak();
    buzz(30);
  },
  pickup() {
    tone({ freq: 520, to: 820, dur: 0.07, gain: 0.12 });
    buzz(8);
  },
  drop() {
    noiseHit({ freq: 900, q: 1, dur: 0.05, gain: 0.2 });
    buzz(10);
  },
  magnet() {
    tone({ freq: 880, to: 1320, dur: 0.05, gain: 0.05 });
    buzz(6, 120);
  },
  snap() {
    noiseHit({ freq: 2600, q: 2, dur: 0.025, gain: 0.5 });
    tone({ freq: 160, to: 90, dur: 0.09, gain: 0.45 });
    noiseHit({ freq: 6000, q: 4, dur: 0.012, gain: 0.25, at: 0.03 });
    buzz(28);
    kick.amount += 0.004;
  },
  link(s = 1) {
    noiseHit({ freq: 3800, q: 6, dur: 0.012, gain: 0.07 * s });
    buzz(5, 70);
  },
  freewheel(s = 1) {
    noiseHit({ freq: 5200, q: 9, dur: 0.01, gain: 0.13 * s });
  },
  boing() {
    boing();
    buzz(20);
  },
  clunk() {
    tone({ freq: 95, to: 48, dur: 0.28, gain: 0.6 });
    noiseHit({ freq: 500, type: 'lowpass', dur: 0.15, gain: 0.5 });
    buzz(70);
    kick.amount += 0.02;
  },
  screw() {
    noiseHit({ freq: 1700, q: 5, dur: 0.035, gain: 0.16 });
    buzz(7, 40);
  },
  tight() {
    noiseHit({ freq: 3000, q: 3, dur: 0.02, gain: 0.4 });
    tone({ freq: 900, dur: 0.06, gain: 0.15, type: 'triangle' });
    buzz(35);
    kick.amount += 0.003;
  },
  chainOn() {
    tone({ freq: 300, to: 620, dur: 0.35, gain: 0.05 });
  },
  bell() {
    bell(0);
    bell(0.3);
    buzz(40);
  },
  fanfare() {
    // A bright rising arpeggio that lands on a held chord
    [523, 659, 784].forEach((f, i) => tone({ freq: f, dur: 0.16, gain: 0.1, type: 'triangle', at: 0.5 + i * 0.11 }));
    for (const f of [1047, 1319, 1568]) tone({ freq: f, dur: 1.1, gain: 0.07, type: 'triangle', at: 0.84, attack: 0.02 });
    buzz(60);
  },
  woof() {
    // Two quick happy barks
    for (const at of [0, 0.16]) {
      tone({ freq: 520, to: 240, dur: 0.11, gain: 0.22, type: 'square', at });
      noiseHit({ freq: 900, q: 1.5, dur: 0.06, gain: 0.18, at });
    }
  },
  whoosh() {
    noiseHit({ freq: 700, q: 0.7, dur: 0.6, gain: 0.18 });
  },
  sparkle() {
    [1320, 1760, 2093, 2637].forEach((f, i) => tone({ freq: f, dur: 0.25, gain: 0.05, at: i * 0.07 }));
  },
  land() {
    tone({ freq: 120, to: 70, dur: 0.15, gain: 0.4 });
    noiseHit({ freq: 700, type: 'lowpass', dur: 0.08, gain: 0.3 });
    buzz(25);
    kick.amount += 0.006;
  },
};

export function feel(name, strength) {
  recipes[name]?.(strength);
}
