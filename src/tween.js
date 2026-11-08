// Tiny tween runner: tweens.add(seconds, k => ..., onDone) with k going 0 → 1
export const ease = {
  linear: (k) => k,
  outCubic: (k) => 1 - (1 - k) ** 3,
  inOutCubic: (k) => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2),
  outBack: (k) => {
    const c = 1.9;
    return 1 + (c + 1) * (k - 1) ** 3 + c * (k - 1) ** 2;
  },
};

export class Tweens {
  constructor() {
    this.list = [];
  }

  add(duration, step, done, delay = 0) {
    const t = { t: -delay, duration, step, done };
    this.list.push(t);
    return t;
  }

  cancel(t) {
    const i = this.list.indexOf(t);
    if (i >= 0) this.list.splice(i, 1);
  }

  wait(seconds) {
    return new Promise((resolve) => this.add(seconds, () => {}, resolve));
  }

  run(duration, step, delay = 0) {
    return new Promise((resolve) => this.add(duration, step, resolve, delay));
  }

  update(dt) {
    for (const t of [...this.list]) {
      t.t += dt;
      if (t.t < 0) continue;
      const k = Math.min(1, t.t / t.duration);
      t.step(k);
      if (k >= 1) {
        this.list.splice(this.list.indexOf(t), 1);
        t.done?.();
      }
    }
  }
}
