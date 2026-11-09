// Phase 0 puzzle: bring three gears from the tray onto the board and build a chain of
// teeth from the brass gear (turned by its crank) to the stuck carbon-steel gear.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { makeGear, meshAngle, finishes, steel, nutStack, toothRadius, toothFlank } from './gearmaker.js';
import { feel, unlockAudio } from './feel.js';

const $ = (id) => document.getElementById(id);
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const M = 0.0038; // tooth size (module), meters: every gear uses it, so any two can mesh

// ---------- Renderer, studio lighting, camera ----------
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x131417);
scene.environment = (() => {
  // A grey studio with soft boxes, so polished metal has something to reflect
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(12, 12, 12), new THREE.MeshBasicMaterial({ color: 0x3a3d43, side: THREE.BackSide })));
  const box = (w, h, c, pos) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
    m.position.copy(pos);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  box(7, 4, new THREE.Color(6, 6, 6), V(0, 5, 1.5));
  box(2.4, 6, new THREE.Color(4.2, 4, 3.6), V(-5, 1, 2.5));
  box(2.4, 6, new THREE.Color(3, 3.3, 4), V(5, 0.5, 2));
  box(6, 2, new THREE.Color(2.2, 2.1, 2), V(0, -2, 5.5));
  return new THREE.PMREMGenerator(renderer).fromScene(env, 0.02).texture;
})();

const key = new THREE.DirectionalLight(0xfff4e6, 2.2);
key.position.set(-0.8, 1.2, 1.6);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -0.6, right: 0.6, top: 0.5, bottom: -0.5, near: 0.2, far: 5 });
key.shadow.camera.updateProjectionMatrix();
key.shadow.bias = -0.0002;
key.shadow.normalBias = 0.002;
scene.add(key);
const rim = new THREE.DirectionalLight(0xbcd2ff, 1.2);
rim.position.set(1.4, 0.4, -0.2);
scene.add(rim);

const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 20);
let controls = null;
// Orbit controls read the camera's "up" once, so they're rebuilt when the phone turns
function makeControls() {
  controls?.dispose();
  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 0.15;
  controls.maxDistance = 3.5;
}

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const ao = new GTAOPass(scene, camera, 256, 256);
ao.updateGtaoMaterial({ radius: 0.01, distanceExponent: 1.4, thickness: 1, scale: 1.4, samples: 16 });
ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
composer.addPass(ao);
composer.addPass(new OutputPass());

// ---------- The board ----------
const PLATE_W = 0.68;
const PLATE_H = 0.46;
const TRAY_Y = -0.165; // the tray of loose gears runs along the bottom of the board
const BOARD_BOTTOM = -0.1; // gears must be placed above this line, clear of the tray
function brushedTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#6a6a6a';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2200; i++) {
    const y = Math.random() * 512;
    const v = 90 + Math.random() * 60;
    ctx.strokeStyle = `rgba(${v},${v},${v},0.35)`;
    ctx.beginPath();
    ctx.moveTo(Math.random() * 512, y);
    ctx.lineTo(Math.random() * 512, y);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  return t;
}
const plate = new THREE.Mesh(
  new RoundedBoxGeometry(PLATE_W, PLATE_H, 0.01, 4, 0.006),
  new THREE.MeshPhysicalMaterial({ color: 0xa4a7ac, metalness: 0.72, roughness: 0.7, roughnessMap: brushedTexture(), anisotropy: 0.9 }),
);
plate.position.z = -0.03;
plate.receiveShadow = true;
scene.add(plate);
const brassSide = finishes.brass(0.01)[1];
for (const sx of [-1, 1]) {
  for (const sy of [-1, 1]) {
    const px = sx * (PLATE_W / 2 - 0.022);
    const py = sy * (PLATE_H / 2 - 0.022);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.018, 24).rotateX(Math.PI / 2), brassSide);
    post.position.set(px, py, -0.016);
    post.castShadow = true;
    scene.add(post);
  }
}
// Felt-lined tray recess for the loose gears
const tray = new THREE.Mesh(
  new RoundedBoxGeometry(PLATE_W - 0.08, 0.11, 0.004, 4, 0.01),
  new THREE.MeshStandardMaterial({ color: 0x1d2a3a, roughness: 0.95 }),
);
tray.position.set(0, TRAY_Y, -0.024);
tray.receiveShadow = true;
scene.add(tray);
// Engraved line marking the edge of the working area
const line = new THREE.Mesh(new THREE.BoxGeometry(PLATE_W - 0.06, 0.0012, 0.0006), new THREE.MeshStandardMaterial({ color: 0x55585e, metalness: 0.5, roughness: 0.5 }));
line.position.set(0, BOARD_BOTTOM - 0.004, -0.0248);
scene.add(line);

// ---------- Axles and nuts ----------
const boltMat = new THREE.MeshPhysicalMaterial({ color: 0xc3c8cf, metalness: 1, roughness: 0.24, clearcoat: 0.2 });
function bolt(x, y, boreR, topZ) {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(boreR * 0.98, boreR * 0.98, topZ + 0.025, 24).rotateX(Math.PI / 2), boltMat);
  shaft.position.set(x, y, (topZ - 0.025) / 2);
  const nut = nutStack(boreR, boltMat);
  nut.position.set(x, y, topZ);
  g.add(shaft, nut);
  scene.add(g);
  return g;
}
const hubFront = (thickness) => (thickness * 1.7) / 2;

// ---------- The gears ----------
// Every gear on the board: the brass driver (fixed), the stuck carbon gear (fixed) and the
// three loose ones the player places.
function gearInfo(teeth, finish, web, thickness, extra = {}) {
  const gear = makeGear({ teeth, module: M, thickness, finish, web, spokes: 5 });
  scene.add(gear.group);
  return { ...gear, teeth, thickness, angle: 0, placed: false, bolt: null, ...extra };
}

const driver = gearInfo(48, 'brass', 'spokes', 0.012, { fixed: true, name: 'brass' });
driver.group.position.set(-0.19, 0.06, 0);
driver.placed = true;

// Two gears can reach at most 88 modules; three in a straight line reach 108. The stuck gear
// sits 100 modules away, so the player needs all three, zigzagged a little.
const TARGET_DIST = 100 * M;
const target = gearInfo(16, 'carbon', 'solid', 0.016, { fixed: true, name: 'target' });
target.group.position.set(-0.19 + TARGET_DIST, 0.06, 0);
target.placed = true;
bolt(target.group.position.x, target.group.position.y, target.bore * 0.8, hubFront(0.016));

// A glowing ring around the stuck gear until it turns
const goalRing = new THREE.Mesh(
  new THREE.TorusGeometry(target.ra + 0.012, 0.0022, 12, 96),
  new THREE.MeshBasicMaterial({ color: 0xffb547, transparent: true, opacity: 0.7, toneMapped: false }),
);
goalRing.position.copy(target.group.position).setZ(-0.02);
scene.add(goalRing);

const loose = [
  gearInfo(32, 'brass', 'spokes', 0.012),
  gearInfo(24, 'silver', 'holes', 0.014),
  gearInfo(20, 'silver', 'holes', 0.014),
];
const trayX = [-0.17, 0.0, 0.17];
loose.forEach((g, i) => {
  g.home = V(trayX[i], TRAY_Y, 0.004);
  g.group.position.copy(g.home);
  g.group.userData.loose = g;
});

// ---------- Crank handle and click (pawl) on the brass driver ----------
const BRASS_FRONT = hubFront(0.012);
const ARM_Z = BRASS_FRONT + 0.0006;
const ARM = 0.068;
const carbonMat = finishes.carbon(0.08);
const arm = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, -0.0085);
  s.lineTo(ARM, -0.0055);
  s.absarc(ARM, 0, 0.0055, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(0, 0.0085);
  s.absarc(0, 0, 0.0085, Math.PI / 2, (3 * Math.PI) / 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, driver.bore, 0, TAU, true);
  s.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.0034, bevelEnabled: true, bevelThickness: 0.0006, bevelSize: 0.0006, bevelSegments: 2, curveSegments: 32 });
  const m = new THREE.Mesh(geo, carbonMat);
  m.position.z = ARM_Z;
  m.rotation.z = Math.PI * 0.62;
  m.castShadow = true;
  driver.group.add(m);
  return m;
})();
{
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#6a3a20';
  ctx.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * 64;
    ctx.strokeStyle = `rgba(${40 + Math.random() * 30},${20 + Math.random() * 12},10,0.5)`;
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.bezierCurveTo(x + 6, 80, x - 6, 170, x + 2, 256);
    ctx.stroke();
  }
  const wood = new THREE.CanvasTexture(c);
  wood.colorSpace = THREE.SRGBColorSpace;
  const profile = [
    [0, 0], [0.0042, 0], [0.0046, 0.003], [0.004, 0.006], [0.0062, 0.015], [0.0068, 0.024], [0.0064, 0.03], [0.0045, 0.0335], [0, 0.034],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const knob = new THREE.Mesh(
    new THREE.LatheGeometry(profile, 40).rotateX(Math.PI / 2),
    new THREE.MeshPhysicalMaterial({ map: wood, roughness: 0.42, clearcoat: 0.7, clearcoatRoughness: 0.2 }),
  );
  knob.position.set(ARM, 0, 0.0046);
  knob.castShadow = true;
  arm.add(knob);
  const cap = nutStack(0.0022, boltMat);
  cap.position.set(ARM, 0, 0.0046 + 0.034);
  arm.add(cap);
}
bolt(driver.group.position.x, driver.group.position.y, driver.bore * 0.6, ARM_Z + 0.0046);

const STEP = TAU / 48;
const RP = (48 * M) / 2;
const RA = RP + M;
const R_REST = RP - 0.55 * M;
const DROP = toothFlank(48, M, R_REST) / STEP;
const PAWL_ANGLE = THREE.MathUtils.degToRad(122);
const dc = driver.group.position;
const tipAt = (r) => V(dc.x + r * Math.cos(PAWL_ANGLE), dc.y + r * Math.sin(PAWL_ANGLE), 0);
const pivotPos = V(dc.x + (RA + 0.026) * Math.cos(PAWL_ANGLE + 0.3), dc.y + (RA + 0.026) * Math.sin(PAWL_ANGLE + 0.3), 0);
const pawlLen = pivotPos.distanceTo(tipAt(R_REST));
const pawlBase = Math.atan2(tipAt(R_REST).y - pivotPos.y, tipAt(R_REST).x - pivotPos.x);
const pawlZ = -0.0022;
const pawl = new THREE.Group();
pawl.position.set(pivotPos.x, pivotPos.y, pawlZ);
{
  const s = new THREE.Shape();
  s.moveTo(0, -0.0042);
  s.lineTo(pawlLen * 0.78, -0.003);
  s.lineTo(pawlLen, 0);
  s.lineTo(pawlLen * 0.8, 0.0026);
  s.lineTo(0, 0.0042);
  s.absarc(0, 0, 0.0042, Math.PI / 2, (3 * Math.PI) / 2, false);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.0038, bevelEnabled: true, bevelThickness: 0.0003, bevelSize: 0.0003, bevelSegments: 2, curveSegments: 16 });
  const lever = new THREE.Mesh(geo, finishes.carbon(0.03));
  lever.castShadow = true;
  pawl.add(lever);
  scene.add(pawl);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.0032, 0.0032, pawlZ + 0.025, 20).rotateX(Math.PI / 2), brassSide);
  post.position.set(pivotPos.x, pivotPos.y, (pawlZ - 0.025) / 2);
  scene.add(post);
  const cap = nutStack(0.0016, boltMat);
  cap.position.set(pivotPos.x, pivotPos.y, pawlZ + 0.0044);
  scene.add(cap);
}
const liftPerRadian = (() => {
  const tipR = (ang) => V(pivotPos.x + pawlLen * Math.cos(ang), pivotPos.y + pawlLen * Math.sin(ang), 0).distanceTo(V(dc.x, dc.y, 0));
  return (tipR(pawlBase + 0.001) - tipR(pawlBase)) / 0.001;
})();
const springAnchor = (() => {
  const d = V(Math.cos(pawlBase), Math.sin(pawlBase), 0);
  const mid = pivotPos.clone().addScaledVector(d, pawlLen * 0.6);
  let n = V(-d.y, d.x, 0);
  if (n.dot(mid.clone().sub(V(dc.x, dc.y, 0))) < 0) n = n.negate();
  return mid.addScaledVector(n, 0.014).setZ(pawlZ + 0.0019);
})();
{
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, springAnchor.z + 0.025, 16).rotateX(Math.PI / 2), steel());
  pin.position.set(springAnchor.x, springAnchor.y, (springAnchor.z - 0.025) / 2);
  scene.add(pin);
}
const springMat = new THREE.MeshPhysicalMaterial({ color: 0xb9bec6, metalness: 1, roughness: 0.25 });
let spring = null;
function updateSpring() {
  const end = V(pawlLen * 0.6, 0, 0.0019).applyMatrix4(pawl.matrixWorld);
  const dir = end.clone().sub(springAnchor);
  const len = dir.length();
  dir.normalize();
  const side = V(-dir.y, dir.x, 0);
  const pts = [];
  for (let i = 0; i <= 120; i++) {
    const t = i / 120;
    const a = t * 9 * TAU;
    pts.push(springAnchor.clone().addScaledVector(dir, t * len).addScaledVector(side, Math.cos(a) * 0.0012).add(V(0, 0, Math.sin(a) * 0.0012)));
  }
  const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.00028, 6, false);
  if (spring) {
    spring.geometry.dispose();
    spring.geometry = geo;
  } else {
    spring = new THREE.Mesh(geo, springMat);
    scene.add(spring);
  }
}

// ---------- Where a gear may go: meshing, crashing and snapping ----------
const meshDist = (a, b) => ((a.teeth + b.teeth) * M) / 2;
const onBoard = () => [driver, target, ...loose.filter((g) => g.placed)];

// Would a gear with this many teeth at p crash into anything, or hang off the board?
function crashAt(g, p) {
  const ra = (g.teeth * M) / 2 + M;
  if (Math.abs(p.x) > PLATE_W / 2 - ra - 0.006 || p.y > PLATE_H / 2 - ra - 0.006 || p.y - ra < BOARD_BOTTOM) return 'edge';
  for (const o of onBoard()) {
    if (o === g) continue;
    const d = Math.hypot(p.x - o.group.position.x, p.y - o.group.position.y);
    if (d < meshDist(g, o) - 0.0012) return 'crash';
  }
  // keep clear of the pawl and its spring
  if (Math.hypot(p.x - pivotPos.x, p.y - pivotPos.y) < ra + 0.008) return 'crash';
  return null;
}

// Find the nearest spot where the gear's teeth mesh exactly: with one gear, or with two at once
function snapFor(g, p) {
  const others = onBoard().filter((o) => o !== g);
  const cands = [];
  for (let i = 0; i < others.length; i++) {
    for (let j = i + 1; j < others.length; j++) {
      const a = others[i].group.position;
      const b = others[j].group.position;
      const ra = meshDist(g, others[i]);
      const rb = meshDist(g, others[j]);
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      if (d > ra + rb || d < Math.abs(ra - rb)) continue;
      const x = (d * d + ra * ra - rb * rb) / (2 * d);
      const h = Math.sqrt(Math.max(0, ra * ra - x * x));
      const ux = (b.x - a.x) / d;
      const uy = (b.y - a.y) / d;
      for (const s of [-1, 1]) {
        cands.push({ p: V(a.x + ux * x - s * uy * h, a.y + uy * x + s * ux * h, 0), bonus: 0.012 });
      }
    }
    const a = others[i].group.position;
    const dir = V(p.x - a.x, p.y - a.y, 0);
    if (dir.length() < 1e-6) continue;
    dir.normalize().multiplyScalar(meshDist(g, others[i]));
    cands.push({ p: V(a.x + dir.x, a.y + dir.y, 0), bonus: 0 });
  }
  let best = null;
  for (const c of cands) {
    const dist = c.p.distanceTo(V(p.x, p.y, 0));
    if (dist > 0.035 || crashAt(g, c.p)) continue;
    const score = dist - c.bonus;
    if (!best || score < best.score) best = { p: c.p, score };
  }
  return best ? best.p : null;
}

// ---------- Turning: work out every gear's angle from the brass driver ----------
// Meshing gears turn opposite ways. If a gear could be reached two ways with the same
// direction (three gears in a triangle), the train is locked.
function solveTrain(theta) {
  const all = onBoard();
  const angle = new Map([[driver, theta]]);
  const sign = new Map([[driver, 1]]);
  const queue = [driver];
  let jammed = false;
  while (queue.length) {
    const g = queue.shift();
    for (const o of all) {
      if (o === g) continue;
      const a = g.group.position;
      const b = o.group.position;
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      if (Math.abs(d - meshDist(g, o)) > 0.0015) continue;
      if (sign.has(o)) {
        if (sign.get(o) === sign.get(g)) jammed = true;
        continue;
      }
      sign.set(o, -sign.get(g));
      angle.set(o, meshAngle(angle.get(g), g.teeth, o.teeth, Math.atan2(b.y - a.y, b.x - a.x)));
      queue.push(o);
    }
  }
  return { angle, jammed, reachesTarget: angle.has(target) };
}

// ---------- Messages ----------
let sayTimer = 0;
function say(text, mood = '', ms = 0) {
  const b = $('bubble');
  b.textContent = text;
  b.className = mood;
  clearTimeout(sayTimer);
  if (ms) sayTimer = setTimeout(() => say(goalText()), ms);
}
function goalText() {
  const n = loose.filter((g) => g.placed).length;
  if (solved) return 'It turns! Try another way to connect them, or reset.';
  if (n < 3) return `Drag gears from the tray to link the brass gear to the stuck carbon gear (${n} of 3 placed).`;
  return 'All three are on. Turn the wooden handle!';
}

// ---------- Pointer: crank the handle, or drag gears ----------
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function aim(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
}
const boardPlane = new THREE.Plane(V(0, 0, 1), 0);
const handlePlane = new THREE.Plane(V(0, 0, 1), -(ARM_Z + 0.02));
function pointOn(plane, e) {
  aim(e);
  return raycaster.ray.intersectPlane(plane, V());
}
function pick(e) {
  aim(e);
  const hits = raycaster.intersectObjects([arm, ...loose.map((g) => g.group)], true);
  if (!hits.length) return null;
  for (let o = hits[0].object; o; o = o.parent) {
    if (o === arm) return { kind: 'handle' };
    if (o.userData.loose) return { kind: 'gear', gear: o.userData.loose };
  }
  return null;
}

const drive = { theta: 0, omega: 0, target: 0, held: false, last: null };
let drag = null;
const unwrap = (d) => (d > Math.PI ? d - TAU : d < -Math.PI ? d + TAU : d);

// The ring under a dragged gear: green when its teeth mesh, red when it would crash
const hintRing = new THREE.Mesh(new THREE.RingGeometry(1, 1.06, 96), new THREE.MeshBasicMaterial({ color: 0x3ddc84, transparent: true, opacity: 0.85, toneMapped: false }));
hintRing.position.z = -0.0235;
hintRing.visible = false;
scene.add(hintRing);

window.addEventListener(
  'pointerdown',
  (e) => {
    unlockAudio();
    if (e.target !== canvas) return;
    const hit = pick(e);
    if (!hit) return;
    controls.enabled = false;
    if (hit.kind === 'handle') {
      drive.held = true;
      drive.target = drive.theta;
      const p = pointOn(handlePlane, e);
      drive.last = p ? Math.atan2(p.y - dc.y, p.x - dc.x) : null;
      return;
    }
    const g = hit.gear;
    if (g.placed) {
      // Lift it off its axle
      g.placed = false;
      g.bolt?.removeFromParent();
      g.bolt = null;
      feel('pickup');
    } else {
      feel('pickup');
    }
    drag = { g, lift: 0 };
    g.group.position.z = 0.02;
  },
  true,
);

window.addEventListener('pointermove', (e) => {
  if (drive.held) {
    const p = pointOn(handlePlane, e);
    if (!p) return;
    const a = Math.atan2(p.y - dc.y, p.x - dc.x);
    if (drive.last != null) drive.target += unwrap(a - drive.last);
    drive.last = a;
    return;
  }
  if (drag) {
    const p = pointOn(boardPlane, e);
    if (!p) return;
    const snap = snapFor(drag.g, p);
    const spot = snap ?? p;
    const problem = crashAt(drag.g, spot);
    drag.g.group.position.set(spot.x, spot.y, 0.02);
    drag.snap = snap && !problem ? snap : null;
    drag.free = !snap && !problem ? p.clone() : null;
    const ra = (drag.g.teeth * M) / 2 + M;
    hintRing.visible = true;
    hintRing.position.set(spot.x, spot.y, -0.0235);
    hintRing.scale.setScalar(ra + 0.004);
    hintRing.material.color.set(drag.snap ? 0x3ddc84 : problem ? 0xff5a4f : 0xb9bec6);
    if (snap && !drag.wasSnapped) feel('magnet');
    drag.wasSnapped = !!snap;
    return;
  }
  if (e.target === canvas) {
    const hit = pick(e);
    canvas.style.cursor = hit ? (hit.kind === 'handle' ? 'grab' : 'grab') : '';
  }
});

function place(g, p) {
  g.group.position.set(p.x, p.y, 0);
  g.placed = true;
  g.bolt = bolt(p.x, p.y, g.bore * 0.75, hubFront(g.thickness));
  feel('snap');
}

function sendHome(g) {
  const from = g.group.position.clone();
  const t0 = performance.now();
  const step = () => {
    const k = Math.min(1, (performance.now() - t0) / 450);
    const e = 1 - (1 - k) ** 3;
    g.group.position.lerpVectors(from, g.home, e);
    if (k < 1) requestAnimationFrame(step);
  };
  step();
}

window.addEventListener('pointerup', () => {
  controls.enabled = true;
  if (drive.held) {
    drive.held = false;
    return;
  }
  if (!drag) return;
  const { g } = drag;
  hintRing.visible = false;
  if (drag.snap) {
    place(g, drag.snap);
  } else if (drag.free) {
    // Allowed, but it won't turn: nothing is touching its teeth
    place(g, drag.free);
    say('It fits there, but its teeth aren’t touching another gear yet.', 'oops', 3000);
  } else if (g.group.position.y < BOARD_BOTTOM) {
    sendHome(g);
  } else {
    feel('boing');
    say('No room there: its teeth would crash into another gear.', 'oops', 3000);
    sendHome(g);
  }
  drag = null;
  refresh();
});

// ---------- HUD ----------
let solved = false;
function refresh() {
  const n = loose.filter((g) => g.placed).length;
  $('count').textContent = `${n} / 3 gears placed`;
  say(goalText());
}
$('reset').onclick = () => {
  for (const g of loose) {
    g.placed = false;
    g.bolt?.removeFromParent();
    g.bolt = null;
    sendHome(g);
  }
  solved = false;
  goalRing.visible = true;
  refresh();
};

// ---------- Resize and loop ----------
// Upright screens turn the camera a quarter turn, so the long board runs top to bottom
// (brass at the bottom, the stuck gear at the top, the tray down the side) and fills the screen.
function frameCamera() {
  const portrait = camera.aspect < 0.9;
  const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const across = portrait ? 0.27 : 0.37; // half the board's width as it appears on screen
  const dist = Math.min(3.2, Math.max(portrait ? 0.9 : 1.08, across / (t * camera.aspect)));
  camera.up.set(portrait ? 1 : 0, portrait ? 0 : 1, 0);
  camera.position.set(portrait ? -0.03 : 0.02, portrait ? 0 : 0.06, dist);
  makeControls();
  controls.target.set(0, -0.01, 0);
  camera.lookAt(controls.target);
}
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', () => {
  resize();
  frameCamera();
});
resize();
frameCamera();
refresh();

let alphaFloor = -Infinity;
let lastTooth = null;
let lastCatch = 0;
let lastJamNote = 0;
let spin = 0; // how far the stuck gear has turned since it got connected
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const prev = drive.theta;
  if (drive.held) drive.theta += (drive.target - drive.theta) * Math.min(1, dt * 18);
  else {
    drive.theta += drive.omega * dt;
    drive.omega *= Math.exp(-2.2 * dt);
  }

  // The click on the brass teeth: forward is fine, backward locks
  let alpha = PAWL_ANGLE - drive.theta;
  if (alphaFloor === -Infinity) alphaFloor = (Math.floor(alpha / STEP - DROP) + DROP) * STEP;
  if (alpha < alphaFloor) {
    alpha = alphaFloor + 1e-6;
    drive.theta = PAWL_ANGLE - alpha;
    if (drive.held) drive.target = Math.min(drive.target, drive.theta + 0.05);
    drive.omega = 0;
    if (now - lastCatch > 350) {
      feel('catch');
      lastCatch = now;
    }
  }

  // A locked train won't let the handle move at all
  let train = solveTrain(drive.theta);
  if (train.jammed && Math.abs(drive.theta - prev) > 1e-6) {
    drive.theta = prev;
    alpha = PAWL_ANGLE - drive.theta;
    if (drive.held) drive.target = drive.theta;
    drive.omega = 0;
    if (now - lastJamNote > 1500) {
      feel('clunk');
      say('Jammed! Three gears touching in a triangle lock each other up. Move one.', 'oops', 3500);
      lastJamNote = now;
    }
    train = solveTrain(drive.theta);
  }
  const t = Math.floor(alpha / STEP - DROP);
  if (lastTooth !== null && t > lastTooth) {
    feel('ratchet', Math.min(1, 0.5 + Math.abs(drive.omega) * 0.3));
    alphaFloor = (t + DROP) * STEP;
  }
  lastTooth = t;
  if (drive.held) drive.omega = (drive.theta - prev) / Math.max(dt, 1e-3);

  const phi = alpha - Math.round(alpha / STEP) * STEP;
  pawl.rotation.z = pawlBase + (Math.max(R_REST, toothRadius(48, M, phi)) - R_REST) / liftPerRadian;
  pawl.updateMatrixWorld();
  updateSpring();

  for (const [g, a] of train.angle) g.group.rotation.z = a;

  // The goal: the stuck carbon gear turns
  if (train.reachesTarget && !train.jammed) {
    spin += Math.abs(drive.theta - prev);
    if (!solved && spin > 0.6) {
      solved = true;
      goalRing.visible = false;
      feel('bell');
      say('It turns! You linked the brass gear to the carbon gear with three gears.', 'yay');
      $('done').hidden = false;
    }
  } else {
    spin = 0;
  }
  goalRing.material.opacity = 0.45 + 0.3 * Math.sin(now / 300);

  controls.update();
  composer.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
$('again').onclick = () => {
  $('done').hidden = true;
  $('reset').click();
};
$('keep').onclick = () => ($('done').hidden = true);

// For debugging in the browser console
window.__puzzle = { camera, driver, target, loose, M };
