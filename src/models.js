// Every 3D part is generated from numbers (tooth counts, lengths, radii), so no 3D artist
// or model files are needed, and the pegboard gear editor later gets parts for free.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const PITCH = 0.0127; // bike chain pitch: half an inch, in meters
export const pitchRadius = (teeth) => PITCH / (2 * Math.sin(Math.PI / teeth));

// Depth (z) of each layer on the drive side of the bike
export const Z_CHAIN = 0.055;
export const Z_GUARD = 0.069;
export const Z_ARM = 0.084;
export const CRANK_LENGTH = 0.125;

const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

export function makeMaterials() {
  const P = THREE.MeshPhysicalMaterial;
  const S = THREE.MeshStandardMaterial;
  return {
    paint: new P({ color: 0x17c3b2, metalness: 0.3, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.06 }),
    rim: new P({ color: 0xec4a92, metalness: 0.55, roughness: 0.28, clearcoat: 0.8 }),
    chrome: new S({ color: 0xf4f6f9, metalness: 1, roughness: 0.13 }),
    steel: new S({ color: 0xcfd4dc, metalness: 1, roughness: 0.28 }),
    chain: new S({ color: 0x9aa1ab, metalness: 1, roughness: 0.36 }),
    dark: new S({ color: 0x2c2e35, metalness: 0.35, roughness: 0.5 }),
    rubber: new S({ color: 0x202125, metalness: 0, roughness: 0.9 }),
    seat: new P({ color: 0x26272c, roughness: 0.45, sheen: 0.5, sheenColor: 0x666666 }),
    reflector: new P({ color: 0xff8a1f, roughness: 0.2, clearcoat: 1 }),
    toolbox: new P({ color: 0xee4b3c, metalness: 0.25, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.08 }),
    foam: new S({ color: 0xffcf4a, roughness: 0.95 }),
    handle: new P({ color: 0xff8a1f, roughness: 0.22, clearcoat: 1 }),
    handleBand: new S({ color: 0x17c3b2, roughness: 0.4 }),
    stand: new S({ color: 0x3b4352, metalness: 0.5, roughness: 0.42 }),
    standAccent: new S({ color: 0xffcf4a, metalness: 0.2, roughness: 0.4 }),
  };
}

function shadows(obj) {
  obj.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return obj;
}

// A cylinder from point a to point b
function rodGeometry(a, b, r, radial = 18) {
  const dir = V().subVectors(b, a);
  const geo = new THREE.CylinderGeometry(r, r, dir.length(), radial, 1);
  const m = new THREE.Matrix4().compose(
    V().copy(a).addScaledVector(dir, 0.5),
    new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize()),
    V(1, 1, 1),
  );
  return geo.applyMatrix4(m);
}

function rod(a, b, r, mat, radial) {
  return new THREE.Mesh(rodGeometry(a, b, r, radial), mat);
}

function curvedTube(points, r, mat) {
  const curve = new THREE.CatmullRomCurve3(points);
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 40, r, 18, false), mat);
}

function ball(p, r, mat) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), mat);
  m.position.copy(p);
  return m;
}

// A cylinder whose axis is z (axles, hubs, spindles)
function zCylinder(r, len, mat, radial = 24) {
  const geo = new THREE.CylinderGeometry(r, r, len, radial).rotateX(Math.PI / 2);
  return new THREE.Mesh(geo, mat);
}

// Chain sprocket: roller seats on the pitch circle with short teeth between them
export function sprocketGeometry(teeth, { holes = 0, bore = 0.006, thickness = 0.0024 } = {}) {
  const rp = pitchRadius(teeth);
  const rs = 0.004; // roller seat radius
  const tip = rp + 0.0046;
  const flank = rp + 0.0016;
  const step = (Math.PI * 2) / teeth;
  const phi = 1.05;
  const shape = new THREE.Shape();
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const cx = rp * Math.cos(a);
    const cy = rp * Math.sin(a);
    for (let k = 0; k <= 6; k++) {
      const ang = a + Math.PI + phi - (2 * phi * k) / 6;
      const x = cx + rs * Math.cos(ang);
      const y = cy + rs * Math.sin(ang);
      if (i === 0 && k === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    const am = a + step / 2;
    shape.lineTo(flank * Math.cos(am - step * 0.22), flank * Math.sin(am - step * 0.22));
    shape.lineTo(tip * Math.cos(am - step * 0.07), tip * Math.sin(am - step * 0.07));
    shape.lineTo(tip * Math.cos(am + step * 0.07), tip * Math.sin(am + step * 0.07));
    shape.lineTo(flank * Math.cos(am + step * 0.22), flank * Math.sin(am + step * 0.22));
  }
  shape.closePath();
  for (let j = 0; j < holes; j++) {
    const a = (j / holes) * Math.PI * 2 + Math.PI / holes;
    const hole = new THREE.Path();
    hole.absarc(rp * 0.56 * Math.cos(a), rp * 0.56 * Math.sin(a), rp * 0.21, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }
  const b = new THREE.Path();
  b.absarc(0, 0, bore, 0, Math.PI * 2, true);
  shape.holes.push(b);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: 0.0005,
    bevelSize: 0.0004,
    bevelSegments: 2,
    curveSegments: 20,
  });
  geo.translate(0, 0, -thickness / 2);
  return { geo, rp };
}

export function buildWheel(M) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.228, 0.026, 20, 120), M.rubber));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.204, 0.0095, 14, 120), M.rim);
  rim.scale.z = 1.5;
  g.add(rim);
  const spokes = [];
  for (let i = 0; i < 28; i++) {
    const side = i % 2 ? 1 : -1;
    const a = (i / 28) * Math.PI * 2;
    const hub = V(0.024 * Math.cos(a + side * 0.25), 0.024 * Math.sin(a + side * 0.25), side * 0.028);
    const end = V(0.198 * Math.cos(a), 0.198 * Math.sin(a), 0);
    spokes.push(rodGeometry(hub, end, 0.0011, 5).toNonIndexed());
  }
  g.add(new THREE.Mesh(mergeGeometries(spokes), M.chrome));
  g.add(zCylinder(0.015, 0.09, M.chrome));
  for (const z of [-0.028, 0.028]) {
    const flange = zCylinder(0.027, 0.003, M.chrome);
    flange.position.z = z;
    g.add(flange);
  }
  return shadows(g);
}

// The teal kid's bike. Frame, wheels, seat and handlebars are already on.
export function buildBike(M) {
  const bike = new THREE.Group();
  const A = V(-0.42, 0.255); // rear axle
  const BB = V(-0.05, 0.215); // bottom bracket (pedal axle)
  const F = V(0.44, 0.255); // front axle
  const headTop = V(0.322, 0.6);
  const headBot = V(0.356, 0.48);
  const seatTop = V(-0.143, 0.56);
  const seatJoin = V(-0.13, 0.505);

  const frame = new THREE.Group();
  frame.add(rod(BB, V(0.352, 0.5), 0.017, M.paint));
  frame.add(rod(BB, seatTop, 0.015, M.paint));
  frame.add(curvedTube([V(0.33, 0.575), V(0.12, 0.548), seatJoin], 0.014, M.paint));
  frame.add(rod(headTop, headBot, 0.02, M.paint));
  for (const s of [-1, 1]) {
    frame.add(rod(V(-0.42, 0.255, 0.052 * s), V(-0.07, 0.215, 0.03 * s), 0.009, M.paint));
    frame.add(rod(V(-0.42, 0.255, 0.052 * s), V(-0.136, 0.52, 0.016 * s), 0.008, M.paint));
    frame.add(rod(V(0.356, 0.48, 0.03 * s), V(0.44, 0.255, 0.046 * s), 0.011, M.paint));
    const drop = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.022, 0.006, 2, 0.002), M.paint);
    drop.position.set(-0.42, 0.255, 0.054 * s);
    frame.add(drop);
  }
  const crown = new THREE.Mesh(new RoundedBoxGeometry(0.04, 0.02, 0.085, 2, 0.006), M.paint);
  crown.position.copy(headBot);
  frame.add(crown);
  const shell = zCylinder(0.021, 0.075, M.paint);
  shell.position.copy(BB);
  frame.add(shell);
  for (const p of [seatJoin, V(0.33, 0.575), V(0.352, 0.5)]) frame.add(ball(p, 0.015, M.paint));

  // Seat
  frame.add(rod(seatTop, V(-0.168, 0.66), 0.012, M.chrome));
  const saddle = new THREE.Mesh(new THREE.SphereGeometry(1, 36, 18), M.seat);
  saddle.scale.set(0.11, 0.026, 0.06);
  saddle.position.set(-0.18, 0.676, 0);
  saddle.rotation.z = -0.06;
  frame.add(saddle);

  // Handlebars
  frame.add(rod(V(0.322, 0.6), V(0.31, 0.672), 0.012, M.chrome));
  frame.add(
    curvedTube([V(0.29, 0.676, -0.23), V(0.312, 0.68, -0.1), V(0.312, 0.68, 0.1), V(0.29, 0.676, 0.23)], 0.0095, M.chrome),
  );
  for (const s of [-1, 1]) frame.add(rod(V(0.296, 0.677, 0.17 * s), V(0.285, 0.675, 0.255 * s), 0.016, M.rubber));
  bike.add(shadows(frame));

  const frontPivot = new THREE.Group();
  frontPivot.position.copy(F);
  frontPivot.add(buildWheel(M));
  bike.add(frontPivot);

  const rearPivot = new THREE.Group();
  rearPivot.position.copy(A);
  rearPivot.add(buildWheel(M));
  bike.add(rearPivot);

  // Empty mounting points that parts snap onto
  const cogPivot = new THREE.Group();
  cogPivot.position.copy(A);
  bike.add(cogPivot);
  const crankPivot = new THREE.Group();
  crankPivot.position.copy(BB);
  bike.add(crankPivot);
  const chainHolder = new THREE.Group();
  chainHolder.position.z = Z_CHAIN;
  bike.add(chainHolder);

  return { group: bike, A, BB, F, frontPivot, rearPivot, cogPivot, crankPivot, chainHolder };
}

// Big gear with both pedal arms and the axle through the middle
export function buildCrankset(M, teeth) {
  const g = new THREE.Group();
  const { geo, rp } = sprocketGeometry(teeth, { holes: 5, bore: 0.013 });
  const ring = new THREE.Mesh(geo, M.chrome);
  ring.position.z = Z_CHAIN;
  g.add(ring);
  const spider = zCylinder(0.024, 0.006, M.dark, 32);
  spider.position.z = Z_CHAIN + 0.004;
  g.add(spider);
  g.add(zCylinder(0.009, Z_ARM * 2 + 0.006, M.steel));

  const armGeo = new RoundedBoxGeometry(CRANK_LENGTH + 0.03, 0.022, 0.012, 3, 0.005);
  const armR = new THREE.Mesh(armGeo, M.chrome);
  armR.position.set(CRANK_LENGTH / 2, 0, Z_ARM);
  g.add(armR);
  const armL = new THREE.Mesh(armGeo, M.chrome);
  armL.position.set(-CRANK_LENGTH / 2, 0, -Z_ARM);
  g.add(armL);
  for (const [x, z] of [[0, Z_ARM], [0, -Z_ARM]]) {
    const cap = zCylinder(0.014, 0.014, M.chrome);
    cap.position.set(x, 0, z);
    g.add(cap);
  }

  const armEndR = new THREE.Object3D();
  armEndR.position.set(CRANK_LENGTH, 0, Z_ARM + 0.006);
  g.add(armEndR);
  const armEndL = new THREE.Object3D();
  armEndL.position.set(-CRANK_LENGTH, 0, -Z_ARM - 0.006);
  g.add(armEndL);
  return { group: shadows(g), rp, armEndR, armEndL };
}

export function buildCog(M, teeth) {
  const g = new THREE.Group();
  const { geo, rp } = sprocketGeometry(teeth, { bore: 0.009 });
  g.add(new THREE.Mesh(geo, M.chrome));
  const hub = zCylinder(0.014, 0.012, M.dark, 24);
  g.add(hub);
  return { group: shadows(g), rp };
}

// Pedal axle points along +z (outwards). side = -1 builds the left one.
export function buildPedal(M, side = 1) {
  const g = new THREE.Group();
  const axle = zCylinder(0.005, 0.03, M.steel);
  axle.position.z = 0.015 * side;
  g.add(axle);
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.085, 0.018, 0.068, 3, 0.006), M.dark);
  body.position.z = (0.03 + 0.034) * side;
  g.add(body);
  for (const x of [-0.0435, 0.0435]) {
    const refl = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.009, 0.04), M.reflector);
    refl.position.set(x, 0, body.position.z);
    g.add(refl);
  }
  return shadows(g);
}

// Plate that covers the top run of the chain and the top of the big gear
export function buildGuard(M, path, rearR, frontR, A, B) {
  const { mTop, aTop } = path;
  const o = 0.021;
  const i = -0.011;
  const aEnd = 0.3;
  const P = (c, r, m) => [c.x + r * m.x, c.y + r * m.y];
  const shape = new THREE.Shape();
  const [x0, y0] = P(A, rearR + o, mTop);
  shape.moveTo(x0, y0);
  shape.lineTo(...P(B, frontR + o, mTop));
  shape.absarc(B.x, B.y, frontR + o, aTop, aEnd, true);
  shape.lineTo(B.x + (frontR + i) * Math.cos(aEnd), B.y + (frontR + i) * Math.sin(aEnd));
  shape.absarc(B.x, B.y, frontR + i, aEnd, aTop, false);
  shape.lineTo(...P(A, rearR + i, mTop));
  const mid = P(A, rearR + (o + i) / 2, mTop);
  shape.quadraticCurveTo(mid[0] - 0.02, mid[1], x0, y0);

  const mid1 = (o + i) / 2;
  const s1 = V(...P(A, rearR + mid1, mTop)).lerp(V(...P(B, frontR + mid1, mTop)), 0.32);
  const aS2 = (aTop + aEnd) / 2 + 0.15;
  const s2 = V(B.x + (frontR + mid1) * Math.cos(aS2), B.y + (frontR + mid1) * Math.sin(aS2));
  for (const s of [s1, s2]) {
    const h = new THREE.Path();
    h.absarc(s.x, s.y, 0.0036, 0, Math.PI * 2, true);
    shape.holes.push(h);
  }
  const depth = 0.003;
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.0008,
    bevelSize: 0.0008,
    bevelSegments: 3,
    curveSegments: 40,
  });
  geo.translate(0, 0, -depth / 2);
  geo.computeBoundingBox();
  const center = geo.boundingBox.getCenter(V());
  center.z = 0;
  geo.translate(-center.x, -center.y, 0);

  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, M.paint));
  const front = depth / 2 + 0.0008;
  const screwSpots = [s1, s2].map((s) => V(s.x - center.x, s.y - center.y, front));
  return { group: shadows(g), center, screwSpots, front };
}

export function buildScrew(M) {
  const g = new THREE.Group();
  const head = zCylinder(0.0056, 0.0028, M.chrome, 24);
  head.position.z = 0.0014;
  g.add(head);
  for (const r of [0, Math.PI / 2]) {
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.0085, 0.0012, 0.0012), M.dark);
    slot.position.z = 0.0027;
    slot.rotation.z = r;
    g.add(slot);
  }
  const shank = zCylinder(0.0022, 0.012, M.steel, 12);
  shank.position.z = -0.006;
  g.add(shank);
  return shadows(g);
}

// Screwdriver along +y, tip at the origin
export function buildScrewdriver(M) {
  const g = new THREE.Group();
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.0034, 0.0011, 0.008, 12), M.steel);
  tip.position.y = 0.004;
  g.add(tip);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0034, 0.0034, 0.076, 14), M.chrome);
  shaft.position.y = 0.008 + 0.038;
  g.add(shaft);
  const profile = [
    [0.0045, 0.082], [0.011, 0.088], [0.0145, 0.1], [0.015, 0.13], [0.0142, 0.162], [0.011, 0.176], [0.005, 0.181], [0.0001, 0.1815],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  g.add(new THREE.Mesh(new THREE.LatheGeometry(profile, 32), M.handle));
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0153, 0.0153, 0.012, 32), M.handleBand);
  band.position.y = 0.118;
  g.add(band);
  return shadows(g);
}

export function buildToolbox(M) {
  const W = 0.5;
  const H = 0.13;
  const D = 0.28;
  const t = 0.008;
  const box = new THREE.Group();
  const panel = (w, h, d, x, y, z) => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.003), M.toolbox);
    m.position.set(x, y, z);
    box.add(m);
    return m;
  };
  panel(W, t, D, 0, t / 2, 0);
  panel(W, H, t, 0, H / 2, D / 2 - t / 2);
  panel(W, H, t, 0, H / 2, -D / 2 + t / 2);
  panel(t, H, D, -W / 2 + t / 2, H / 2, 0);
  panel(t, H, D, W / 2 - t / 2, H / 2, 0);
  const foamTop = t + 0.07;
  const foam = new THREE.Mesh(new THREE.BoxGeometry(W - 2 * t, 0.07, D - 2 * t), M.foam);
  foam.position.y = t + 0.035;
  box.add(foam);

  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, H, -D / 2);
  const lid = new THREE.Mesh(new RoundedBoxGeometry(W + 0.006, 0.03, D + 0.006, 3, 0.008), M.toolbox);
  lid.position.set(0, 0.015, D / 2);
  lidPivot.add(lid);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.0065, 12, 32, Math.PI), M.chrome);
  handle.position.set(0, 0.03, D / 2);
  lidPivot.add(handle);
  box.add(lidPivot);

  const latches = [];
  for (const x of [-0.16, 0.16]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, H - 0.03, D / 2 + 0.004);
    const plate = new THREE.Mesh(new RoundedBoxGeometry(0.042, 0.046, 0.007, 2, 0.003), M.chrome);
    plate.position.y = 0.023;
    pivot.add(plate);
    box.add(pivot);
    latches.push(pivot);
  }
  shadows(box);
  return { group: box, lidPivot, latches, foamTop, W, H, D };
}

export function buildStand(M) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 0.02, 40), M.stand);
  base.position.set(-0.12, 0.01, -0.2);
  g.add(base);
  g.add(rod(V(-0.12, 0.02, -0.2), V(-0.12, 0.74, -0.2), 0.016, M.stand));
  g.add(rod(V(-0.12, 0.72, -0.2), V(-0.165, 0.705, -0.02), 0.012, M.stand));
  const clamp = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.035, 0.04, 2, 0.008), M.standAccent);
  clamp.position.set(-0.165, 0.705, -0.01);
  g.add(clamp);
  const knob = zCylinder(0.016, 0.02, M.standAccent);
  knob.position.set(-0.12, 0.6, -0.2);
  g.add(knob);
  return shadows(g);
}

function canvasTexture(size, draw, repeat = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 8;
  return tex;
}

// Warm wooden floor and a pegboard wall
export function buildRoom() {
  const room = new THREE.Group();
  const wood = canvasTexture(
    1024,
    (ctx, s) => {
      const rows = 8;
      const h = s / rows;
      for (let r = 0; r < rows; r++) {
        let x = -Math.random() * s * 0.5;
        while (x < s) {
          const len = s * (0.35 + Math.random() * 0.4);
          const tone = 196 + Math.random() * 30;
          ctx.fillStyle = `rgb(${tone + 22}, ${tone - 30}, ${tone - 92})`;
          ctx.fillRect(x, r * h, len, h);
          ctx.strokeStyle = 'rgba(90, 50, 20, 0.12)';
          ctx.lineWidth = 1.5;
          for (let k = 0; k < 9; k++) {
            const y = r * h + Math.random() * h;
            ctx.beginPath();
            ctx.moveTo(x, y);
            for (let px = x; px < x + len; px += 40) ctx.lineTo(px, y + Math.sin(px * 0.01 + k) * 4);
            ctx.stroke();
          }
          ctx.fillStyle = 'rgba(80, 45, 20, 0.45)';
          ctx.fillRect(x, r * h, 2, h);
          x += len;
        }
        ctx.fillStyle = 'rgba(80, 45, 20, 0.5)';
        ctx.fillRect(0, r * h, s, 2);
      }
    },
    3,
  );
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 9),
    new THREE.MeshStandardMaterial({ map: wood, roughness: 0.7 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  room.add(floor);

  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 5),
    new THREE.MeshStandardMaterial({ color: 0xfbefdc, roughness: 1 }),
  );
  wall.position.set(0, 2.5, -1.1);
  wall.receiveShadow = true;
  room.add(wall);

  const peg = canvasTexture(512, (ctx, s) => {
    ctx.fillStyle = '#ecd2a6';
    ctx.fillRect(0, 0, s, s);
    for (let y = 16; y < s; y += 32) {
      for (let x = 16; x < s; x += 32) {
        ctx.fillStyle = 'rgba(110, 70, 35, 0.55)';
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, 1);
  peg.repeat.set(4, 2);
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 1.1, 0.02),
    new THREE.MeshStandardMaterial({ map: peg, roughness: 0.85 }),
  );
  board.position.set(0.2, 1.1, -1.08);
  board.receiveShadow = true;
  room.add(board);

  // A few cheerful tool silhouettes hanging on the pegboard
  const colors = [0x17c3b2, 0xee4b3c, 0xffcf4a, 0xec4a92];
  for (let k = 0; k < 4; k++) {
    const tool = new THREE.Mesh(
      new RoundedBoxGeometry(0.05, 0.32 + k * 0.05, 0.015, 2, 0.012),
      new THREE.MeshStandardMaterial({ color: colors[k], roughness: 0.5 }),
    );
    tool.position.set(-0.6 + k * 0.32, 1.12, -1.06);
    tool.castShadow = true;
    room.add(tool);
  }
  return room;
}
