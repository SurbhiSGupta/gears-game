// Feel settings shared by the whole game. The ⚙︎ panel edits them live and they are
// remembered on this device, so we can tune the feel together on real phones.
const KEY = 'bodai-gears-tune-v2';

export const defaults = {
  mode: 'gentle',
  pedalWeight: 0.7,
  grip: 6,
  wheelDrag: 0.35,
  snap: 0.07,
  haptics: 1,
  volume: 0.8,
  hintGentle: 8,
  hintClassic: 20,
  lives: 3,
};

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

export const tune = { ...defaults, ...read() };

export function saveTune() {
  try {
    localStorage.setItem(KEY, JSON.stringify(tune));
  } catch {
    // Private windows can refuse storage; the settings still work for this visit.
  }
}

export function resetTune() {
  Object.assign(tune, defaults);
  saveTune();
}

export const tuneSpec = [
  { key: 'mode', label: 'Mode', options: [['gentle', 'Gentle'], ['classic', 'Classic']] },
  { key: 'pedalWeight', label: 'Pedal weight', min: 0.2, max: 3, step: 0.05 },
  { key: 'grip', label: 'Finger grip', min: 1, max: 20, step: 0.5 },
  { key: 'wheelDrag', label: 'Wheel drag', min: 0.05, max: 1.5, step: 0.05 },
  { key: 'snap', label: 'Snap reach', min: 0.03, max: 0.15, step: 0.005 },
  { key: 'haptics', label: 'Buzz strength', min: 0, max: 2, step: 0.1 },
  { key: 'volume', label: 'Volume', min: 0, max: 1, step: 0.05 },
  { key: 'hintGentle', label: 'Hint wait, Gentle (s)', min: 3, max: 30, step: 1 },
  { key: 'hintClassic', label: 'Hint wait, Classic (s)', min: 5, max: 60, step: 1 },
];
