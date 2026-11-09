// Realistic gears: true involute tooth profiles, spoked or drilled webs, a raised hub with
// a keyed bore, and metal finishes (brass, silver steel, black) with machining rings.
import * as THREE from 'three';

const TAU = Math.PI * 2;
const inv = (a) => Math.tan(a) - a; // involute function

// 2D outline of an involute spur gear, centered on the origin
export function gearShape(teeth, module, { pressureAngle = 20 } = {}) {
  const pa = THREE.MathUtils.degToRad(pressureAngle);
  const rp = (teeth * module) / 2; // pitch radius
  const rb = rp * Math.cos(pa); // base circle
  const ra = rp + module; // tip
  const rf = rp - 1.25 * module; // root
  const halfPitch = Math.PI / (2 * teeth);
  // Angle of the tooth flank from the tooth center at radius r
  const flank = (r) => halfPitch + inv(pa) - inv(Math.acos(Math.min(1, rb / r)));
  const steps = 8;
  const shape = new THREE.Shape();
  const pt = (r, a) => [r * Math.cos(a), r * Math.sin(a)];
  for (let k = 0; k < teeth; k++) {
    const c = (k / teeth) * TAU;
    const rStart = Math.max(rf, rb);
    // root, then up the right flank
    const gapStart = c - Math.PI / teeth;
    if (k === 0) shape.moveTo(...pt(rf, gapStart));
    shape.lineTo(...pt(rf, c - flank(rStart)));
    if (rStart > rf) shape.lineTo(...pt(rStart, c - flank(rStart)));
    for (let i = 1; i <= steps; i++) {
      const r = rStart + ((ra - rStart) * i) / steps;
      shape.lineTo(...pt(r, c - flank(r)));
    }
    // tip
    shape.lineTo(...pt(ra, c + flank(ra)));
    // down the left flank
    for (let i = steps - 1; i >= 0; i--) {
      const r = rStart + ((ra - rStart) * i) / steps;
      shape.lineTo(...pt(r, c + flank(r)));
    }
    if (rStart > rf) shape.lineTo(...pt(rf, c + flank(rStart)));
    shape.lineTo(...pt(rf, c + Math.PI / teeth));
  }
  shape.closePath();
  return { shape, rp, ra, rf };
}

// Window between two spokes, with softly rounded corners
function spokeWindow(rIn, rOut, a1, a2) {
  const p = new THREE.Path();
  const cr = Math.min(0.18 * (rOut - rIn), 0.004);
  const da = cr / rOut;
  const db = cr / rIn;
  p.moveTo(rOut * Math.cos(a1 + da), rOut * Math.sin(a1 + da));
  p.absarc(0, 0, rOut, a1 + da, a2 - da, false);
  p.quadraticCurveTo(rOut * Math.cos(a2), rOut * Math.sin(a2), (rOut - cr) * Math.cos(a2), (rOut - cr) * Math.sin(a2));
  p.lineTo((rIn + cr) * Math.cos(a2), (rIn + cr) * Math.sin(a2));
  p.quadraticCurveTo(rIn * Math.cos(a2), rIn * Math.sin(a2), rIn * Math.cos(a2 - db), rIn * Math.sin(a2 - db));
  p.absarc(0, 0, rIn, a2 - db, a1 + db, true);
  p.quadraticCurveTo(rIn * Math.cos(a1), rIn * Math.sin(a1), (rIn + cr) * Math.cos(a1), (rIn + cr) * Math.sin(a1));
  p.lineTo((rOut - cr) * Math.cos(a1), (rOut - cr) * Math.sin(a1));
  p.quadraticCurveTo(rOut * Math.cos(a1), rOut * Math.sin(a1), rOut * Math.cos(a1 + da), rOut * Math.sin(a1 + da));
  return p;
}

function circleHole(x, y, r) {
  const p = new THREE.Path();
  p.absarc(x, y, r, 0, TAU, true);
  return p;
}

function seeded(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

// Extruded caps use the shape's x/y (meters) as UVs: map -radius..radius onto 0..1
function fitToRadius(tex, radius) {
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(1 / (2 * radius), 1 / (2 * radius));
  tex.offset.set(0.5, 0.5);
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

// Roughness for a lathe-turned face: fine rings, a few hazy fingerprint smudges and
// light scratches, so it reads as real worked metal instead of perfect plastic
function roughnessCanvas(seed, base, ringSpread) {
  const size = 1024;
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const rand = seeded(seed);
  const g = (v) => Math.round(Math.max(0, Math.min(1, v)) * 255);
  ctx.fillStyle = `rgb(${g(base)},${g(base)},${g(base)})`;
  ctx.fillRect(0, 0, size, size);
  for (let r = 2; r < size * 0.71; r += 1.3) {
    const v = base + (rand() - 0.5) * ringSpread;
    ctx.strokeStyle = `rgb(${g(v)},${g(v)},${g(v)})`;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, r, 0, TAU);
    ctx.stroke();
  }
  for (let i = 0; i < 16; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 30 + rand() * 110;
    const v = base + (rand() < 0.5 ? 0.12 : -0.06);
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(${g(v)},${g(v)},${g(v)},0.35)`);
    grad.addColorStop(1, `rgba(${g(v)},${g(v)},${g(v)},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  ctx.lineCap = 'round';
  for (let i = 0; i < 40; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const len = 8 + rand() * 45;
    const a = rand() * TAU;
    const v = base + 0.12;
    ctx.strokeStyle = `rgba(${g(v)},${g(v)},${g(v)},${0.1 + rand() * 0.18})`;
    ctx.lineWidth = 0.5 + rand() * 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a + 0.3) * len * 0.5, y + Math.sin(a + 0.3) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  return c;
}

// Anisotropy direction map: tangent to circles around the center. On a turned face this
// gives the "bow-tie" highlight that real machined gears have.
let circularCanvas = null;
function circularDirections() {
  if (circularCanvas) return circularCanvas;
  const size = 512;
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      // Canvas rows run downward but texture v runs upward (flipY), so work in uv space
      const x = (px + 0.5) / size - 0.5;
      const y = 1 - (py + 0.5) / size - 0.5;
      const len = Math.hypot(x, y) || 1;
      const i = (py * size + px) * 4;
      img.data[i] = ((-y / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((x / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  circularCanvas = c;
  return c;
}

// Fine noise for the tooth flanks and edges, tiled in meters
let sideNoise = null;
function sideRoughness() {
  if (!sideNoise) {
    const c = canvas(256);
    const ctx = c.getContext('2d');
    const rand = seeded(99);
    const img = ctx.createImageData(256, 256);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 128 + (rand() - 0.5) * 70;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    sideNoise = c;
  }
  const tex = new THREE.CanvasTexture(sideNoise);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(60, 60);
  return tex;
}

function face(radius, seed, base, spread, props) {
  const rough = fitToRadius(new THREE.CanvasTexture(roughnessCanvas(seed, base, spread)), radius);
  const dirs = fitToRadius(new THREE.CanvasTexture(circularDirections()), radius);
  return new THREE.MeshPhysicalMaterial({
    metalness: 1,
    roughness: 1,
    roughnessMap: rough,
    bumpMap: rough,
    bumpScale: 0.025,
    anisotropy: 0.8,
    anisotropyMap: dirs,
    ...props,
  });
}

function side(props) {
  return new THREE.MeshPhysicalMaterial({ metalness: 1, roughnessMap: sideRoughness(), ...props });
}

// Metal finishes. Each returns [face material, side material] for extruded parts.
export const finishes = {
  brass(radius) {
    return [
      face(radius, 7, 0.3, 0.08, { color: 0xd6ad57, clearcoat: 0.35, clearcoatRoughness: 0.18 }),
      side({ color: 0xdcb562, roughness: 0.3 }),
    ];
  },
  silver(radius) {
    return [
      face(radius, 11, 0.2, 0.07, { color: 0xe6e9ee }),
      side({ color: 0xeef0f3, roughness: 0.2 }),
    ];
  },
  // Carbon steel: dark gunmetal with a faint cool sheen, machined like the others
  carbon(radius) {
    return [
      face(radius, 31, 0.26, 0.07, { color: 0x4a4e55, anisotropy: 0.75, clearcoat: 0.25, clearcoatRoughness: 0.25 }),
      side({ color: 0x555a62, roughness: 0.28 }),
    ];
  },
  black(radius) {
    return [
      face(radius, 23, 0.36, 0.06, { color: 0x1a1b1f, anisotropy: 0.55, clearcoat: 0.4, clearcoatRoughness: 0.3 }),
      side({ color: 0x25272c, roughness: 0.42 }),
    ];
  },
};

export const steel = () => new THREE.MeshPhysicalMaterial({ color: 0xc9ced6, metalness: 1, roughness: 0.16, clearcoat: 0.3 });

// A complete spur gear: toothed body with a spoked or drilled web, raised hub, keyed bore
export function makeGear({ teeth, module, thickness, finish = 'brass', web = 'spokes', spokes = 5 }) {
  const { shape, rp, ra, rf } = gearShape(teeth, module);
  const hubR = Math.max(rp * 0.24, 0.009);
  const bore = hubR * 0.42;
  const rim = Math.max(rp * 0.14, module * 1.4);
  const webOut = rf - rim;
  const webIn = hubR * 1.25;
  if (web === 'spokes' && webOut - webIn > 0.01) {
    const spokeHalf = Math.max(0.045, 0.35 / spokes) * 1.0;
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * TAU;
      shape.holes.push(spokeWindow(webIn, webOut, a + spokeHalf + 0.05, a + TAU / spokes - spokeHalf - 0.05));
    }
  } else if (web === 'holes' && webOut - webIn > 0.006) {
    const n = 6;
    const rm = (webIn + webOut) / 2;
    const hr = Math.min((webOut - webIn) * 0.38, rm * Math.sin(Math.PI / n) * 0.7);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + Math.PI / n;
      shape.holes.push(circleHole(rm * Math.cos(a), rm * Math.sin(a), hr));
    }
  }
  shape.holes.push(circleHole(0, 0, hubR * 0.98));
  const [face, side] = finishes[finish](ra);
  const bevel = Math.min(module * 0.12, 0.0006);
  const bodyGeo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness - 2 * bevel,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 48,
  });
  bodyGeo.translate(0, 0, -(thickness - 2 * bevel) / 2);
  const group = new THREE.Group();
  const body = new THREE.Mesh(bodyGeo, [face, side]);
  group.add(body);

  // Hub: a thicker ring with a keyed bore
  const hub = new THREE.Shape();
  hub.absarc(0, 0, hubR, 0, TAU, false);
  const hole = new THREE.Path();
  const kw = bore * 0.45;
  hole.moveTo(bore, 0);
  hole.absarc(0, 0, bore, 0, TAU - Math.asin(kw / bore), false);
  hole.lineTo(bore + kw * 0.8, -kw);
  hole.lineTo(bore + kw * 0.8, kw);
  hole.lineTo(Math.sqrt(bore * bore - kw * kw), kw);
  hub.holes.push(hole);
  const hubDepth = thickness * 1.7;
  const hubBevel = 0.0006;
  const hubGeo = new THREE.ExtrudeGeometry(hub, {
    depth: hubDepth - 2 * hubBevel,
    bevelEnabled: true,
    bevelThickness: hubBevel,
    bevelSize: hubBevel,
    bevelSegments: 2,
    curveSegments: 40,
  });
  hubGeo.translate(0, 0, -(hubDepth - 2 * hubBevel) / 2);
  group.add(new THREE.Mesh(hubGeo, [face, side]));

  // Set screw in the hub's side
  const screw = new THREE.Mesh(new THREE.CylinderGeometry(bore * 0.35, bore * 0.35, 0.003, 6), new THREE.MeshPhysicalMaterial({ color: 0x1c1d20, metalness: 0.9, roughness: 0.35 }));
  screw.position.set(0, hubR + 0.0004, 0); // points outward along the hub's radius
  group.add(screw);

  group.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return { group, rp, ra, hubR, bore, teeth };
}

// Angle for gear j so a tooth of gear i always sits in a gap of gear j, where j's center is
// at angle beta from i. Meshing gears turn opposite ways: as i turns by d, j turns by
// -d * teethI / teethJ, so the teeth roll against each other and push j along.
export function meshAngle(thetaI, teethI, teethJ, beta) {
  return beta + Math.PI - Math.PI / teethJ + ((beta - thetaI) * teethI) / teethJ;
}

// ---------- Fasteners and the ratchet ----------
function extrudeShape(shape, depth, bevel = 0.0004, segments = 24) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: depth - 2 * bevel,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: segments,
  });
  geo.translate(0, 0, bevel);
  return geo;
}

// Hex nut with chamfered corners, sitting on a flat washer, over a threaded axle end.
// Built from z = 0 upward (place it on the face it bolts down).
export function nutStack(boreR, material) {
  const g = new THREE.Group();
  const washer = new THREE.Shape();
  washer.absarc(0, 0, boreR * 2.3, 0, TAU, false);
  const wHole = new THREE.Path();
  wHole.absarc(0, 0, boreR * 1.05, 0, TAU, true);
  washer.holes.push(wHole);
  const wGeo = extrudeShape(washer, boreR * 0.35, 0.0002, 40);
  g.add(new THREE.Mesh(wGeo, material));

  const across = boreR * 3.6;
  const hex = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + Math.PI / 6;
    const r = across / 2 / Math.cos(Math.PI / 6);
    if (i === 0) hex.moveTo(r * Math.cos(a), r * Math.sin(a));
    else hex.lineTo(r * Math.cos(a), r * Math.sin(a));
  }
  hex.closePath();
  const nHole = new THREE.Path();
  nHole.absarc(0, 0, boreR * 0.98, 0, TAU, true);
  hex.holes.push(nHole);
  const nutH = boreR * 1.6;
  const nGeo = extrudeShape(hex, nutH, boreR * 0.22, 6);
  const nut = new THREE.Mesh(nGeo, material);
  nut.position.z = boreR * 0.35;
  g.add(nut);

  // Axle end poking through the nut, with a small chamfer and thread rings
  const tipH = boreR * 0.9;
  const profile = [
    [0, 0], [boreR * 0.98, 0], [boreR * 0.98, nutH + tipH * 0.75], [boreR * 0.8, nutH + tipH], [0, nutH + tipH],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const tip = new THREE.Mesh(new THREE.LatheGeometry(profile, 32).rotateX(Math.PI / 2), material);
  tip.position.z = boreR * 0.35;
  g.add(tip);
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(boreR * 0.98, boreR * 0.05, 6, 32), material);
    ring.position.z = boreR * 0.35 + nutH + tipH * (0.15 + i * 0.2);
    g.add(ring);
  }
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  g.userData.height = boreR * 0.35 + nutH + tipH;
  return g;
}

// Ratchet wheel: each tooth ramps up gently, then drops off a sharp edge. Seen from the
// front, it lets the wheel turn clockwise and catches when turned back.
export function ratchetWheel(teeth, rIn, rOut, boreR, depth, material) {
  const s = new THREE.Shape();
  const step = TAU / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const p = (r, ang) => [r * Math.cos(ang), r * Math.sin(ang)];
    if (i === 0) s.moveTo(...p(rIn, a));
    // the ramp climbs as the angle increases, the cliff drops straight back to the root
    for (let k = 1; k <= 6; k++) {
      const t = k / 6;
      s.lineTo(...p(rIn + (rOut - rIn) * t, a + step * t * 0.96));
    }
    s.lineTo(...p(rIn, a + step * 0.98));
  }
  s.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, boreR, 0, TAU, true);
  s.holes.push(hole);
  const mesh = new THREE.Mesh(extrudeShape(s, depth, 0.0002, 12), material);
  mesh.castShadow = true;
  return mesh;
}
