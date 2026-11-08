// Hint arrows drawn on top of the 3D scene: a pulsing ring to tap, a dashed arrow to
// drag along, or a curved arrow to turn. They follow their 3D anchors every frame.
import * as THREE from 'three';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  parent?.appendChild(e);
  return e;
};

export class Hints {
  constructor(svg) {
    this.svg = svg;
    this.spec = null;
    const defs = el('defs', {}, svg);
    const marker = el('marker', { id: 'head', markerWidth: 4, markerHeight: 4, refX: 2, refY: 2, orient: 'auto' }, defs);
    el('path', { d: 'M0,0 L4,2 L0,4 Z', class: 'arrow-head' }, marker);
    this.ring = el('circle', { class: 'ring', r: 24 }, svg);
    this.ring2 = el('circle', { class: 'ring ring-b', r: 24 }, svg);
    this.path = el('path', { class: 'arrow', 'marker-end': 'url(#head)' }, svg);
    this._v = new THREE.Vector3();
  }

  get visible() {
    return !!this.spec;
  }

  show(spec) {
    this.spec = spec;
    this.svg.dataset.type = spec.type;
    this.svg.classList.add('on');
  }

  hide() {
    this.spec = null;
    this.svg.classList.remove('on');
  }

  toScreen(p, camera, w, h) {
    const v = this._v.copy(p).project(camera);
    return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h, behind: v.z > 1 };
  }

  update(camera, w, h) {
    const spec = this.spec;
    if (!spec) return;
    if (spec.type === 'tap') {
      const p = this.toScreen(spec.at(), camera, w, h);
      for (const r of [this.ring, this.ring2]) {
        r.setAttribute('cx', p.x);
        r.setAttribute('cy', p.y);
      }
      this.path.setAttribute('d', '');
    } else if (spec.type === 'drag') {
      const a = this.toScreen(spec.from(), camera, w, h);
      const b = this.toScreen(spec.to(), camera, w, h);
      const lift = Math.min(120, Math.hypot(b.x - a.x, b.y - a.y) * 0.35);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2 - lift;
      this.path.setAttribute('d', `M${a.x},${a.y} Q${mx},${my} ${b.x},${b.y}`);
      this.ring.setAttribute('cx', a.x);
      this.ring.setAttribute('cy', a.y);
      this.ring2.setAttribute('cx', b.x);
      this.ring2.setAttribute('cy', b.y);
    } else if (spec.type === 'turn') {
      const c = this.toScreen(spec.at(), camera, w, h);
      const r = spec.radius ?? 60;
      // Clockwise on screen, starting at the top left and sweeping around
      const a0 = (-160 * Math.PI) / 180;
      const a1 = (110 * Math.PI) / 180;
      const x0 = c.x + r * Math.cos(a0);
      const y0 = c.y + r * Math.sin(a0);
      const x1 = c.x + r * Math.cos(a1);
      const y1 = c.y + r * Math.sin(a1);
      this.path.setAttribute('d', `M${x0},${y0} A${r},${r} 0 1 1 ${x1},${y1}`);
      this.ring.setAttribute('cx', c.x);
      this.ring.setAttribute('cy', c.y);
      this.ring2.setAttribute('cx', -999);
    }
  }
}
