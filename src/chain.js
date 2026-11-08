// A roller chain that wraps two sprockets. ChainPath is the loop's shape;
// ChainLoop draws the links along it and slides them as the pedals turn.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PITCH } from './models.js';

const TAU = Math.PI * 2;
const wrap = (a) => ((a % TAU) + TAU) % TAU;

export class ChainPath {
  // a = rear sprocket center and pitch radius, b = front sprocket center and pitch radius
  constructor(a, ra, b, rb) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.hypot(dx, dy);
    const ux = dx / d;
    const uy = dy / d;
    const nx = -uy;
    const ny = ux;
    const sg = (ra - rb) / d;
    const cg = Math.sqrt(1 - sg * sg);
    this.mTop = { x: nx * cg + ux * sg, y: ny * cg + uy * sg };
    this.mBot = { x: -nx * cg + ux * sg, y: -ny * cg + uy * sg };
    this.aTop = Math.atan2(this.mTop.y, this.mTop.x);
    this.aBot = Math.atan2(this.mBot.y, this.mBot.x);
    const line = d * cg;
    const sweepFront = wrap(this.aTop - this.aBot);
    const sweepRear = wrap(this.aBot - this.aTop);
    const pt = (c, r, m) => ({ x: c.x + r * m.x, y: c.y + r * m.y });
    // Forward pedaling moves the chain along this list: top run towards the front,
    // around the big gear, bottom run back, around the little gear.
    this.segs = [
      { kind: 'line', from: pt(a, ra, this.mTop), to: pt(b, rb, this.mTop), len: line },
      { kind: 'arc', c: b, r: rb, start: this.aTop, len: rb * sweepFront },
      { kind: 'line', from: pt(b, rb, this.mBot), to: pt(a, ra, this.mBot), len: line },
      { kind: 'arc', c: a, r: ra, start: this.aBot, len: ra * sweepRear },
    ];
    this.length = this.segs.reduce((s, g) => s + g.len, 0);
  }

  pointAt(s, out) {
    s = ((s % this.length) + this.length) % this.length;
    for (const g of this.segs) {
      if (s <= g.len) {
        if (g.kind === 'line') {
          const k = s / g.len;
          out.x = g.from.x + (g.to.x - g.from.x) * k;
          out.y = g.from.y + (g.to.y - g.from.y) * k;
        } else {
          const ang = g.start - s / g.r;
          out.x = g.c.x + g.r * Math.cos(ang);
          out.y = g.c.y + g.r * Math.sin(ang);
        }
        return out;
      }
      s -= g.len;
    }
    return out;
  }
}

function plate(h, z) {
  const shape = new THREE.Shape();
  shape.moveTo(0, h);
  shape.absarc(0, 0, h, Math.PI / 2, (3 * Math.PI) / 2, false);
  shape.lineTo(PITCH, -h);
  shape.absarc(PITCH, 0, h, -Math.PI / 2, Math.PI / 2, false);
  shape.lineTo(0, h);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.0007, bevelEnabled: false, curveSegments: 6 });
  return geo.translate(0, 0, z - 0.00035);
}

function pin(r, len, x) {
  return new THREE.CylinderGeometry(r, r, len, 10).rotateX(Math.PI / 2).translate(x, 0, 0).toNonIndexed();
}

let cachedLinks = null;
function linkGeometries() {
  if (!cachedLinks) {
    cachedLinks = {
      outer: mergeGeometries([plate(0.0042, 0.0046), plate(0.0042, -0.0046), pin(0.0018, 0.0112, 0), pin(0.0018, 0.0112, PITCH)]),
      inner: mergeGeometries([plate(0.0039, 0.003), plate(0.0039, -0.003), pin(0.0039, 0.0053, 0), pin(0.0039, 0.0053, PITCH)]),
    };
  }
  return cachedLinks;
}

export class ChainLoop {
  constructor(material, maxLinks = 200) {
    const geos = linkGeometries();
    this.group = new THREE.Group();
    this.outer = new THREE.InstancedMesh(geos.outer, material, maxLinks / 2);
    this.inner = new THREE.InstancedMesh(geos.inner, material, maxLinks / 2);
    for (const m of [this.outer, this.inner]) {
      m.castShadow = true;
      m.frustumCulled = false;
      this.group.add(m);
    }
    this.offset = 0;
    this.visibleLinks = Infinity;
    this._dummy = new THREE.Object3D();
    this._p1 = { x: 0, y: 0 };
    this._p2 = { x: 0, y: 0 };
  }

  setPath(path) {
    this.path = path;
    let n = Math.round(path.length / PITCH);
    if (n % 2) n += 1;
    this.n = n;
    this.spacing = path.length / n;
    this.outer.count = n / 2;
    this.inner.count = n / 2;
    this.update();
  }

  update() {
    const { path, spacing, _dummy: d, _p1: p1, _p2: p2 } = this;
    for (let i = 0; i < this.n; i++) {
      const s = this.offset + i * spacing;
      path.pointAt(s, p1);
      path.pointAt(s + spacing, p2);
      d.position.set(p1.x, p1.y, 0);
      d.rotation.set(0, 0, Math.atan2(p2.y - p1.y, p2.x - p1.x));
      const show = i < this.visibleLinks ? 1 : 0.0001;
      d.scale.set((spacing / PITCH) * show, show, show);
      d.updateMatrix();
      (i % 2 ? this.inner : this.outer).setMatrixAt(i >> 1, d.matrix);
    }
    this.outer.instanceMatrix.needsUpdate = true;
    this.inner.instanceMatrix.needsUpdate = true;
  }
}
