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

// Concentric lathe marks: used as a roughness and bump map on the gear faces
export function ringTexture(radius, seed = 1, base = 0.32, spread = 0.16) {
  const size = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  ctx.fillStyle = `rgb(${base * 255},${base * 255},${base * 255})`;
  ctx.fillRect(0, 0, size, size);
  for (let r = 2; r < size / 2; r += 1.4) {
    const v = Math.max(0, Math.min(1, base + (rand() - 0.5) * spread));
    ctx.strokeStyle = `rgb(${v * 255},${v * 255},${v * 255})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, r, 0, TAU);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  // Extruded caps use the shape's x/y (meters) as UVs: map -radius..radius onto 0..1
  tex.repeat.set(1 / (2 * radius), 1 / (2 * radius));
  tex.offset.set(0.5, 0.5);
  tex.anisotropy = 8;
  return tex;
}

// Metal finishes. Each returns [face material, side material] for extruded parts.
export const finishes = {
  brass(radius) {
    const rough = ringTexture(radius, 7, 0.3, 0.07);
    const face = new THREE.MeshPhysicalMaterial({
      color: 0xd9b25a, metalness: 1, roughness: 1, roughnessMap: rough, bumpMap: rough, bumpScale: 0.12,
      clearcoat: 0.25, clearcoatRoughness: 0.2,
    });
    const side = new THREE.MeshPhysicalMaterial({ color: 0xe0bb66, metalness: 1, roughness: 0.22 });
    return [face, side];
  },
  silver(radius) {
    const rough = ringTexture(radius, 11, 0.16, 0.06);
    const face = new THREE.MeshPhysicalMaterial({
      color: 0xe9ecf0, metalness: 1, roughness: 1, roughnessMap: rough, bumpMap: rough, bumpScale: 0.1,
    });
    const side = new THREE.MeshPhysicalMaterial({ color: 0xf2f4f7, metalness: 1, roughness: 0.12 });
    return [face, side];
  },
  black(radius) {
    const rough = ringTexture(radius, 23, 0.4, 0.06);
    const face = new THREE.MeshPhysicalMaterial({
      color: 0x16171a, metalness: 0.7, roughness: 1, roughnessMap: rough, bumpMap: rough, bumpScale: 0.1,
      clearcoat: 0.6, clearcoatRoughness: 0.25,
    });
    // Black anodized parts show bright machined metal where the edges are chamfered
    const side = new THREE.MeshPhysicalMaterial({ color: 0x2a2c31, metalness: 0.85, roughness: 0.3 });
    return [face, side];
  },
};

export const steel = () => new THREE.MeshPhysicalMaterial({ color: 0xc9ced6, metalness: 1, roughness: 0.18 });

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

// Angle for gear j so its teeth sit in gear i's gaps, where j's center is at angle beta from i
export function meshAngle(thetaI, teethI, teethJ, beta) {
  return beta + Math.PI - ((beta - thetaI) * teethI) / teethJ - Math.PI / teethJ;
}
