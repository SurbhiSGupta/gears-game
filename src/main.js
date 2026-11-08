// Phase 0 workbench: open the toolbox, fit the gears, pedals, chain and chain guard onto
// the daughter's bike, tighten the screws, then turn the pedals to test it.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import * as Models from './models.js';
import { ChainPath, ChainLoop } from './chain.js';
import { CameraRig } from './camera.js';
import { feel, unlockAudio, setVolume, setWhir, kick } from './feel.js';
import { tune, saveTune, resetTune, tuneSpec } from './tune.js';
import { Hints } from './hints.js';
import { Tweens, ease } from './tween.js';
import { level } from './level1.js';

const $ = (id) => document.getElementById(id);
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const Z_AXIS = V(0, 0, 1);
const FLIP = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), Math.PI);
const unwrap = (d) => (d > Math.PI ? d - TAU : d < -Math.PI ? d + TAU : d);
const qEuler = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));

// ---------- Renderer, light and room ----------
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xfbefdc);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.6;

const camera = new THREE.PerspectiveCamera(38, 1, 0.02, 30);
camera.layers.enable(0);
const rig = new CameraRig(camera);

const hemi = new THREE.HemisphereLight(0xe3f4ff, 0xf3d2a8, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d8, 2.6);
sun.position.set(-1.4, 2.6, 1.9);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -1.6, right: 1.8, top: 1.6, bottom: -1.4, near: 0.5, far: 8 });
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.004;
scene.add(sun);
const fill = new THREE.DirectionalLight(0xd6ecff, 0.6);
fill.position.set(2, 1.2, 2.5);
scene.add(fill);
const room = Models.buildRoom();
scene.add(room);

// A warm hanging lamp that only switches on in the evening (dark mode)
const lamp = new THREE.PointLight(0xffc77a, 0, 4, 1.4);
lamp.position.set(0.15, 1.7, 0.7);
scene.add(lamp);

// Day (light) or evening (dark) garage, following the ⚙︎ setting or the phone's setting
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const dark = tune.theme === 'dark' || (tune.theme === 'auto' && darkQuery.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#1c1a28' : '#fbefdc');
  const { floorMat, wallMat, boardMat } = room.userData;
  scene.background.set(dark ? 0x1c1a28 : 0xfbefdc);
  wallMat.color.set(dark ? 0x2b2940 : 0xfbefdc);
  floorMat.color.set(dark ? 0x8a7a6c : 0xffffff);
  boardMat.color.set(dark ? 0x8c7b66 : 0xffffff);
  hemi.color.set(dark ? 0x7d86c4 : 0xe3f4ff);
  hemi.groundColor.set(dark ? 0x4a3a30 : 0xf3d2a8);
  hemi.intensity = dark ? 0.45 : 0.9;
  sun.color.set(dark ? 0xffd2a0 : 0xfff0d8);
  sun.intensity = dark ? 1.3 : 2.6;
  fill.color.set(dark ? 0x8f9cff : 0xd6ecff);
  fill.intensity = dark ? 0.35 : 0.6;
  lamp.intensity = dark ? 3 : 0;
  scene.environmentIntensity = dark ? 0.4 : 0.6;
}
darkQuery.addEventListener?.('change', applyTheme);
applyTheme();

// The glow around the finished bike
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const outline = new OutlinePass(new THREE.Vector2(256, 256), scene, camera);
Object.assign(outline, { edgeStrength: 0, edgeGlow: 2, edgeThickness: 3.5, pulsePeriod: 0 });
outline.visibleEdgeColor.set(0xffa800);
outline.hiddenEdgeColor.set(0xff8a00);
composer.addPass(outline);
composer.addPass(new OutputPass());
let glowing = false;

// ---------- Bike, stand and toolbox ----------
const M = Models.makeMaterials();
M.paint.emissive.set(0xffb030);
M.rim.emissive.set(0xffb030);
const bikeRoot = new THREE.Group();
bikeRoot.position.y = 0.06;
scene.add(bikeRoot);
const bike = Models.buildBike(M);
bikeRoot.add(bike.group);
bike.rearPivot.userData.pick = { kind: 'wheel' };
const stand = Models.buildStand(M);
scene.add(stand);

const frontR = Models.pitchRadius(level.frontTeeth);
const rearR = Models.pitchRadius(level.rearTeeth);
const RATIO = level.frontTeeth / level.rearTeeth;
const chainPath = new ChainPath(bike.A, rearR, bike.BB, frontR);

const tb = Models.buildToolbox(M);
tb.group.position.set(0.95, 0, 0.2);
tb.group.rotation.y = -0.5;
tb.group.userData.pick = { kind: 'toolbox' };
tb.latches.forEach((l, i) => (l.userData.pick = { kind: 'latch', i }));
scene.add(tb.group);
const boxLight = new THREE.PointLight(0xfff0c8, 0, 0.8, 1.5);
boxLight.position.set(0, tb.foamTop + 0.09, 0);
tb.group.add(boxLight);

// ---------- Parts ----------
// Invisible, finger-sized grab areas. They live on layer 1, so the camera never draws
// them but the raycaster still hits them.
const proxyMat = new THREE.MeshBasicMaterial();
function addProxy(obj, radius, at = V()) {
  const p = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 8), proxyMat);
  p.position.copy(at);
  p.layers.set(1);
  obj.add(p);
  return p;
}

const defs = Object.fromEntries(level.parts.map((p) => [p.id, p]));
const parts = {};
function addPart(id, obj, slot, home, proxyRadius, proxyAt) {
  const part = { ...defs[id], obj, slot, home, installed: false, isPedal: id.startsWith('pedal') };
  obj.userData.pick = { kind: 'part', id };
  part.proxy = addProxy(obj, proxyRadius, proxyAt);
  home.parent.add(obj);
  obj.position.copy(home.pos);
  obj.quaternion.copy(home.quat);
  parts[id] = part;
  return part;
}

const y0 = tb.foamTop;
const crank = Models.buildCrankset(M, level.frontTeeth);
addPart(
  'crankset',
  crank.group,
  { parent: bike.crankPivot, pos: V(), quat: new THREE.Quaternion() },
  { parent: tb.group, pos: V(-0.095, y0 - 0.05, -0.06), quat: qEuler(-Math.PI / 2, 0, 0) },
  0.075,
  V(0, 0, Models.Z_CHAIN),
);

const cog = Models.buildCog(M, level.rearTeeth);
addPart(
  'rearCog',
  cog.group,
  { parent: bike.cogPivot, pos: V(0, 0, Models.Z_CHAIN), quat: new THREE.Quaternion() },
  { parent: tb.group, pos: V(0.09, y0 + 0.003, -0.085), quat: qEuler(-Math.PI / 2, 0, 0) },
  0.045,
);

const pedalSlots = [
  { parent: crank.armEndR, flip: false, part: null },
  { parent: crank.armEndL, flip: true, part: null },
];
addPart('pedalR', Models.buildPedal(M), null, { parent: tb.group, pos: V(0.195, y0 + 0.009, -0.11), quat: new THREE.Quaternion() }, 0.05, V(0, 0, 0.06));
addPart('pedalL', Models.buildPedal(M), null, { parent: tb.group, pos: V(0.195, y0 + 0.009, 0.012), quat: new THREE.Quaternion() }, 0.05, V(0, 0, 0.06));

const chain = new ChainLoop(M.chain);
chain.setPath(chainPath);
chain.visibleLinks = 0;
chain.update();
bike.chainHolder.add(chain.group);
const coil = new ChainLoop(M.chain, 60);
coil.setPath(new ChainPath({ x: -0.045, y: 0 }, 0.03, { x: 0.045, y: 0 }, 0.03));
const coilObj = new THREE.Group();
coilObj.add(coil.group);
const chainMid = V((bike.A.x + bike.BB.x) / 2, (bike.A.y + bike.BB.y) / 2, 0);
addPart(
  'chain',
  coilObj,
  { parent: bike.chainHolder, pos: chainMid, quat: new THREE.Quaternion() },
  { parent: tb.group, pos: V(0.06, y0 + 0.004, 0.06), quat: qEuler(-Math.PI / 2, 0, 0) },
  0.07,
);

const guard = Models.buildGuard(M, chainPath, rearR, frontR, bike.A, bike.BB);
addPart(
  'guard',
  guard.group,
  { parent: bike.group, pos: V(guard.center.x, guard.center.y, Models.Z_GUARD), quat: new THREE.Quaternion() },
  { parent: tb.lidPivot, pos: V(0, -0.008, tb.D / 2), quat: qEuler(Math.PI / 2, 0, 0) },
  0.09,
);
const LOOSE = 0.009;
const screws = guard.screwSpots.map((spot) => {
  const obj = Models.buildScrew(M);
  obj.position.set(spot.x, spot.y, spot.z + LOOSE);
  obj.rotation.x = 0.35;
  guard.group.add(obj);
  return { obj, spot, turned: 0, progress: 0, tickAcc: 0, tight: false };
});

const driver = Models.buildScrewdriver(M);
driver.userData.pick = { kind: 'tool' };
addProxy(driver, 0.055, V(0, 0.1, 0));
const driverHome = { parent: tb.group, pos: V(-0.235, y0 + 0.016, 0.035), quat: qEuler(0, 0, -Math.PI / 2) };
tb.group.add(driver);
driver.position.copy(driverHome.pos);
driver.quaternion.copy(driverHome.quat);

// ---------- Teaching how the gears work ----------
// The drive parts get their own materials so they can light up along the power path:
// pedal → big gear → chain → little gear → wheel
const powerMats = [M.dark.clone(), M.chrome.clone(), M.chain, M.chrome.clone(), M.rim.clone()];
for (const m of powerMats) m.emissive.set(0xffb030);
const swapMat = (root, from, to) =>
  root.traverse((o) => {
    if (o.isMesh && o.material === from) o.material = to;
  });
swapMat(parts.pedalR.obj, M.dark, powerMats[0]);
swapMat(parts.pedalL.obj, M.dark, powerMats[0]);
swapMat(crank.group, M.chrome, powerMats[1]);
swapMat(cog.group, M.chrome, powerMats[3]);
swapMat(bike.rearPivot, M.rim, powerMats[4]);

// Bright stickers on the big gear and the back tire, so you can count them going around
const stickerMat = new THREE.MeshBasicMaterial({ color: 0xffcf4a });
const stickerEdge = new THREE.MeshBasicMaterial({ color: 0x2b2a45 });
function sticker(parent, r, x, y, z) {
  const dot = new THREE.Mesh(new THREE.CircleGeometry(r, 24), stickerMat);
  const edge = new THREE.Mesh(new THREE.RingGeometry(r, r * 1.3, 24), stickerEdge);
  dot.position.set(x, y, z);
  edge.position.set(x, y, z - 0.0002);
  parent.add(dot, edge);
}
sticker(crank.group, 0.0075, crank.rp * 0.56, 0, Models.Z_CHAIN + 0.0022);
sticker(bike.rearPivot.children[0], 0.013, 0.228, 0, 0.0275);

// ---------- Ghost of where a dragged part goes (Gentle mode) ----------
const ghostMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false });
const ghosts = {};
function ghostOf(part) {
  if (!ghosts[part.id]) {
    const g = part.obj.clone(true);
    g.traverse((o) => {
      if (o.isMesh) {
        o.material = ghostMat;
        o.castShadow = false;
      }
    });
    g.remove(...g.children.filter((c) => c.layers.mask === 2));
    g.visible = false;
    scene.add(g);
    ghosts[part.id] = g;
  }
  return ghosts[part.id];
}

// ---------- State ----------
const tweens = new Tweens();
const hints = new Hints($('hints'));
let phase = 'intro'; // intro → closed → opening → build ⇄ screw → celebrate → done
const latchOpen = [false, false];
let lives = tune.lives;
let tested = false;
let testTurn = 0;
let currentScrew = 0;
let gesture = null;
let lastTouch = performance.now();
const firstHints = new Set();
const crankState = { theta: 0, omega: 0, target: 0, held: false };
const wheel = { theta: 0, omega: 0, held: false, pending: 0 };
const cogState = { theta: 0 };
// Turns counted since the finger last grabbed a pedal
const session = { pedal: 0, cog: 0, told: false, last: -10 };
let power = 0;
let autoPedal = false;
let replayFocus = -1;
let callout = null;
let linkAcc = 0;
let freeAcc = 0;

// ---------- Helpers ----------
const raycaster = new THREE.Raycaster();
raycaster.layers.enable(1);
const ndc = new THREE.Vector2();
function aim(x, y) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
}

function pick(x, y) {
  aim(x, y);
  const hits = raycaster.intersectObjects([bikeRoot, tb.group], true);
  const owner = (h) => {
    for (let o = h.object; o; o = o.parent) if (o.userData.pick) return o.userData.pick;
    return null;
  };
  // What the finger visibly touches wins; the larger invisible grab areas only help when
  // the finger lands just next to a part.
  const real = hits.find((h) => h.object.layers.mask !== 2);
  const realPick = real && owner(real);
  if (realPick && realPick.kind !== 'toolbox') return { ...realPick, point: real.point };
  const near = hits.find((h) => h.object.layers.mask === 2);
  if (near) return { ...owner(near), point: near.point };
  if (real) return { ...(realPick ?? { kind: 'none' }), point: real.point };
  return null;
}

function slotFor(part, near) {
  if (!part.isPedal) return part.slot;
  const free = pedalSlots.filter((s) => !s.part);
  if (!near || free.length < 2) return free[0] ?? pedalSlots[0];
  const d = (s) => s.parent.getWorldPosition(V()).distanceTo(near);
  return d(free[0]) <= d(free[1]) ? free[0] : free[1];
}

function slotPose(part, slot) {
  if (!part.isPedal) return { pos: slot.pos, quat: slot.quat };
  const quat = new THREE.Quaternion().setFromAxisAngle(Z_AXIS, crankState.theta);
  if (slot.flip) quat.multiply(FLIP);
  return { pos: V(), quat };
}

function slotWorld(part, near) {
  const slot = slotFor(part, near);
  const { pos, quat } = slotPose(part, slot);
  slot.parent.updateWorldMatrix(true, false);
  return {
    slot,
    pos: pos.clone().applyMatrix4(slot.parent.matrixWorld),
    quat: slot.parent.getWorldQuaternion(new THREE.Quaternion()).multiply(quat),
  };
}

// Angle of the finger around a point on the bike's side, in bike coordinates, so turning
// works the same from either side of the bike.
const _plane = new THREE.Plane();
const _hit = V();
function angleAround(x, y, center) {
  aim(x, y);
  bike.group.updateWorldMatrix(true, false);
  const c = center.clone().applyMatrix4(bike.group.matrixWorld);
  const n = Z_AXIS.clone().applyQuaternion(bike.group.getWorldQuaternion(new THREE.Quaternion()));
  _plane.setFromNormalAndCoplanarPoint(n, c);
  if (!raycaster.ray.intersectPlane(_plane, _hit)) return null;
  const local = bike.group.worldToLocal(_hit.clone());
  return Math.atan2(local.y - center.y, local.x - center.x);
}

function overview() {
  const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  if (upright) {
    // Bike across the full width, toolbox in front of it (lower on screen), looking down a bit
    const dist = Math.min(6, 0.8 / (t * camera.aspect));
    return { target: V(0.08, 0.22, 0.6), dist, az: 0.06, pol: 1.05 };
  }
  // Short sideways phone screens get extra headroom so the seat and handlebars stay in view
  const halfH = camera.aspect > 1.7 ? 0.58 : 0.5;
  const dist = Math.min(4, Math.max(halfH / t, 1.0 / (t * camera.aspect)));
  return { target: V(0.27, 0.3, 0.1), dist, az: 0.12, pol: 1.15 };
}

// Upright screens are tall and narrow, so the toolbox sits in front of the bike instead of
// beside it. Parts in the toolbox move with it.
let upright = false;
function applyLayout() {
  upright = camera.aspect < 0.8;
  if (upright) {
    tb.group.position.set(0.22, 0, 1.35);
    tb.group.rotation.y = -0.2;
  } else {
    tb.group.position.set(0.95, 0, 0.2);
    tb.group.rotation.y = -0.5;
  }
}

function toolboxView() {
  const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const dist = Math.max(0.85, 0.36 / (t * camera.aspect));
  return { target: tb.group.localToWorld(V(0, 0.1, 0.04)), dist, az: -0.3, pol: 0.98 };
}

// ---------- Messages, steps and hints ----------
let sayTimer = 0;
let quietTimer = 0;
const compact = window.matchMedia('(max-width: 640px), (max-height: 520px)');
function say(text, mood = '', ms = 0) {
  const b = $('bubble');
  b.textContent = text;
  b.className = mood;
  b.hidden = false;
  clearTimeout(sayTimer);
  if (ms) sayTimer = setTimeout(() => currentStep() && say(currentStep().say), ms);
  quietLater();
}

// On phones the message fades once it's been read; the progress pill still shows the step
function quietLater() {
  clearTimeout(quietTimer);
  if (compact.matches) quietTimer = setTimeout(() => $('bubble').classList.add('quiet'), 5000);
}

const stepDone = {
  open: () => !['intro', 'closed', 'opening'].includes(phase),
  crankset: () => parts.crankset.installed,
  rearCog: () => parts.rearCog.installed,
  pedals: () => parts.pedalR.installed && parts.pedalL.installed,
  chain: () => parts.chain.installed,
  guard: () => parts.guard.installed,
  screws: () => screws.every((s) => s.tight),
  test: () => tested,
};
const currentStep = () => level.steps.find((s) => !stepDone[s.id]());

let shownStep = null;
function refreshSteps() {
  const now = currentStep();
  const state = (s) => (stepDone[s.id]() ? 'done' : s === now ? 'now' : '');
  const items = level.steps.map((s) => `<li class="${state(s)}">${s.label}</li>`).join('');
  $('steps').innerHTML = items;
  $('steps-list').innerHTML = items;
  $('progress-dots').innerHTML = level.steps.map((s) => `<i class="${state(s)}"></i>`).join('');
  $('progress-label').textContent = now
    ? `${level.steps.indexOf(now) + 1}/${level.steps.length} · ${now.label}`
    : 'All done!';
  if (now && now !== shownStep && phase !== 'celebrate') {
    shownStep = now;
    say(now.say);
    // Arrows show right away the first time a kind of move is needed, and for steps whose
    // part is easy to miss (the guard in the lid, the screwdriver)
    const key = now.id === 'test' ? 'pedal' : now.gesture;
    if (now.showNow || !firstHints.has(key)) {
      firstHints.add(key);
      setTimeout(() => showHint(), 700);
    }
  }
}

function dragHint(part) {
  if (!part || part.installed) return null;
  return { type: 'drag', from: () => part.proxy.getWorldPosition(V()), to: () => slotWorld(part).pos };
}

function hintFor(step) {
  if (!step) return null;
  switch (step.id) {
    case 'open': {
      const i = latchOpen.indexOf(false);
      return { type: 'tap', at: () => tb.latches[i].localToWorld(V(0, 0.023, 0.006)) };
    }
    case 'pedals':
      return dragHint(parts.pedalR.installed ? parts.pedalL : parts.pedalR);
    case 'screws':
      if (phase === 'screw') return { type: 'turn', at: () => screwWorld(currentScrew), radius: 70 };
      return { type: 'tap', at: () => driver.localToWorld(V(0, 0.13, 0)) };
    case 'test':
      return { type: 'turn', at: () => bike.crankPivot.getWorldPosition(V()), radius: 80 };
    default:
      return dragHint(parts[step.id]);
  }
}

function showHint() {
  if (gesture || ['intro', 'opening', 'celebrate', 'done'].includes(phase)) return;
  const spec = hintFor(currentStep());
  if (spec) hints.show(spec);
}

function touch() {
  lastTouch = performance.now();
  hints.hide();
}

function mistake(text) {
  if (tune.mode === 'classic') {
    feel('clunk');
    lives -= 1;
    renderLives();
    say(`Oops! ${text}`, 'oops', 3500);
    if (lives <= 0) {
      setTimeout(
        () => modal("Oh no, the bike jammed! Let's try this one again.", 'Try again', startOver),
        700,
      );
    }
  } else {
    feel('boing');
    say(text, 'oops', 3500);
  }
}

function renderLives() {
  const el = $('lives');
  el.hidden = tune.mode !== 'classic';
  el.innerHTML = Array.from({ length: tune.lives }, (_, i) => `<span class="${i < lives ? 'on' : ''}">♥</span>`).join('');
}

function modal(text, button, onClick, secondary) {
  $('modal-text').textContent = text;
  const b = $('modal-btn');
  b.textContent = button;
  b.onclick = onClick;
  const b2 = $('modal-btn2');
  b2.hidden = !secondary;
  if (secondary) {
    b2.textContent = secondary[0];
    b2.onclick = secondary[1];
  }
  $('modal').hidden = false;
}

// ---------- Toolbox ----------
function tapToolbox(hit) {
  if (phase !== 'closed') return;
  rig.set(toolboxView());
  if (hit.kind !== 'latch') {
    say('Tap the two shiny latches on the front.');
    showHint();
    return;
  }
  if (latchOpen[hit.i]) return;
  latchOpen[hit.i] = true;
  feel('latch');
  const l = tb.latches[hit.i];
  tweens.run(0.3, (k) => (l.rotation.x = 1.35 * ease.outBack(k)));
  if (latchOpen.every(Boolean)) openLid();
  else setTimeout(showHint, 500);
}

async function openLid() {
  phase = 'opening';
  hints.hide();
  await tweens.wait(0.3);
  feel('lid');
  tweens.run(0.5, (k) => (boxLight.intensity = 2.4 * k));
  await tweens.run(1.4, (k) => (tb.lidPivot.rotation.x = -1.95 * ease.outBack(k)));
  tweens.run(1.6, (k) => (boxLight.intensity = 2.4 - 1.8 * k));
  await tweens.wait(0.6);
  rig.set(overview());
  phase = 'build';
  refreshSteps();
}

// ---------- Dragging parts ----------
function startDrag(part, e) {
  feel('pickup');
  scene.attach(part.obj);
  const target = slotWorld(part);
  const fromQ = part.obj.quaternion.clone();
  const g = {
    type: 'drag',
    part,
    moved: false,
    magnet: false,
    point: null,
    touchLift: e.pointerType === 'touch' ? 55 : 0,
    x0: e.clientX,
    y0: e.clientY,
    plane: new THREE.Plane(),
  };
  g.rot = tweens.add(0.25, (k) => part.obj.quaternion.slerpQuaternions(fromQ, target.quat, ease.outCubic(k)));
  return g;
}

function moveDrag(e, g) {
  if (Math.hypot(e.clientX - g.x0, e.clientY - g.y0) > 6) g.moved = true;
  if (!g.moved) return;
  // Hold the part a little above the finger on touch screens, so the finger doesn't hide it
  aim(e.clientX, e.clientY - g.touchLift);
  const target = slotWorld(g.part, g.point);
  g.plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(V()).negate(), target.pos);
  const hit = raycaster.ray.intersectPlane(g.plane, V());
  if (!hit) return;
  g.point = hit;
  const near = hit.distanceTo(target.pos) < tune.snap;
  if (near && !g.magnet) feel('magnet');
  g.magnet = near;
  // A magnet-like pull once the part is close to where it belongs
  g.part.obj.position.copy(near ? hit.clone().lerp(target.pos, 0.65) : hit);
  if (tweens.list.includes(g.rot)) return;
  g.part.obj.quaternion.copy(target.quat);
}

function endDrag(g, cancel) {
  const part = g.part;
  tweens.cancel(g.rot);
  if (ghosts[part.id]) ghosts[part.id].visible = false;
  if (cancel || !g.moved || !g.point) {
    sendHome(part);
    if (!cancel && !g.moved) {
      const spec = dragHint(part);
      if (spec) setTimeout(() => hints.show(spec), 350);
      say(`Drag the ${part.label} to where it goes on the bike.`, '', 3500);
    }
    return;
  }
  const target = slotWorld(part, g.point);
  if (g.point.distanceTo(target.pos) < tune.snap) {
    const missing = part.needs.filter((id) => !parts[id].installed);
    if (missing.length) {
      mistake(`The ${part.label} needs the ${parts[missing[0]].label} first.`);
      sendHome(part);
      return;
    }
    install(part, target.slot);
    return;
  }
  const other = Object.values(parts).find(
    (p) => p !== part && !p.installed && p.slot && !p.isPedal && slotWorld(p).pos.distanceTo(g.point) < tune.snap * 0.8,
  );
  if (other) {
    mistake(`That spot is for the ${other.label}.`);
  } else {
    feel('drop');
  }
  sendHome(part);
}

function sendHome(part) {
  const { parent, pos, quat } = part.home;
  parent.attach(part.obj);
  const p0 = part.obj.position.clone();
  const q0 = part.obj.quaternion.clone();
  part.tweening = true;
  tweens.add(
    0.45,
    (k) => {
      part.obj.position.lerpVectors(p0, pos, ease.outCubic(k));
      part.obj.quaternion.slerpQuaternions(q0, quat, ease.outCubic(k));
    },
    () => (part.tweening = false),
  );
}

// The part the player needs next does a little hop every few seconds, so it's easy to find
function attention() {
  const step = currentStep();
  if (phase !== 'build' || gesture || !step) return;
  let obj = null;
  let home = null;
  if (step.id === 'screws') {
    obj = driver;
    home = driverHome;
  } else {
    const id = step.id === 'pedals' ? (parts.pedalR.installed ? 'pedalL' : 'pedalR') : step.id;
    const part = parts[id];
    if (!part || part.installed || part.tweening) return;
    obj = part.obj;
    home = part.home;
  }
  if (!obj || obj.parent !== home.parent || driver.userData.flying) return;
  const k = time % 2.4;
  const hop = k < 0.6 ? Math.sin((k / 0.6) * Math.PI) : 0;
  obj.position.copy(home.pos);
  obj.position.y += 0.018 * hop;
  obj.quaternion.copy(home.quat);
  obj.rotateZ(0.08 * Math.sin(k * 20) * hop);
}

function install(part, slot) {
  part.installed = true;
  hints.hide();
  if (part.isPedal) slot.part = part;
  slot.parent.attach(part.obj);
  const p0 = part.obj.position.clone();
  const q0 = part.obj.quaternion.clone();
  const { pos, quat } = slotPose(part, slot);
  part.tweening = true;
  tweens.add(
    0.24,
    (k) => {
      part.obj.position.lerpVectors(p0, pos, ease.outBack(k));
      part.obj.quaternion.slerpQuaternions(q0, quat, ease.outCubic(k));
    },
    () => {
      part.tweening = false;
      feel('snap');
      afterInstall(part);
    },
  );
}

function afterInstall(part) {
  if (part.id === 'crankset' || part.isPedal) part.obj.userData.pick = { kind: 'crank' };
  else part.obj.userData.pick = null;
  if (part.id === 'rearCog') part.proxy.removeFromParent();
  if (part.id === 'guard') part.proxy.removeFromParent();
  if (part.id === 'chain') {
    coilObj.removeFromParent();
    let shown = 0;
    tweens.add(
      0.9,
      (k) => {
        const v = Math.floor(k * chain.n);
        if (v - shown >= 3) {
          feel('link', 0.9);
          shown = v;
        }
        chain.visibleLinks = v;
        chain.update();
      },
      () => {
        chain.visibleLinks = Infinity;
        chain.update();
        feel('chainOn');
        refreshSteps();
      },
    );
    return;
  }
  refreshSteps();
  if (part.id === 'crankset') say(`Big gear on! It has ${level.frontTeeth} teeth.`, 'yay', 3200);
  if (part.id === 'rearCog') {
    const fewer = RATIO === 2 ? 'half as many as' : 'fewer than';
    say(`Little gear on! It has ${level.rearTeeth} teeth, ${fewer} the big gear.`, 'yay', 3800);
  }
}

// ---------- Screwdriver ----------
function screwWorld(i) {
  return screws[i].obj.localToWorld(V(0, 0, 0.0028));
}

function driverPose(i) {
  const s = screws[i];
  const quat = bike.group
    .getWorldQuaternion(new THREE.Quaternion())
    .multiply(qEuler(Math.PI / 2, 0, 0))
    .multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), -s.turned));
  return { pos: screwWorld(i), quat };
}

function screwView(i) {
  return { target: screwWorld(i), dist: 0.3, az: 0.5, pol: 1.2 };
}

function useScrewdriver() {
  if (!parts.guard.installed) {
    feel('boing');
    say('Nothing to tighten yet. Snap the chain guard on first.', 'oops', 3500);
    return;
  }
  if (screws.every((s) => s.tight)) return;
  phase = 'screw';
  hints.hide();
  feel('pickup');
  currentScrew = screws.findIndex((s) => !s.tight);
  flyDriverTo(currentScrew);
}

function flyDriverTo(i) {
  scene.attach(driver);
  const p0 = driver.position.clone();
  const q0 = driver.quaternion.clone();
  driver.userData.flying = true;
  rig.set(screwView(i));
  say(i === 0 ? 'Here comes the screwdriver…' : 'One more screw!');
  // Lift out of the box first, then glide over to the screw
  const lift = p0.clone().add(V(0, 0.15, 0));
  tweens.add(
    1.3,
    (k) => {
      const { pos, quat } = driverPose(i);
      const e = ease.inOutCubic(k);
      const a = lift.clone().lerp(pos, e);
      driver.position.copy(p0.clone().lerp(lift, Math.min(1, k * 3)).lerp(a, e));
      driver.quaternion.slerpQuaternions(q0, quat, e);
    },
    () => {
      driver.userData.flying = false;
      say('Turn your finger in circles to tighten the screw.');
      showHint();
    },
  );
}

function turnScrew(delta) {
  const s = screws[currentScrew];
  if (!s || s.tight || driver.userData.flying) return;
  s.turned = Math.max(0, s.turned + delta);
  s.progress = Math.min(1, s.turned / (TAU * 2.5));
  s.obj.rotation.z = -s.turned;
  s.obj.rotation.x = 0.35 * (1 - s.progress);
  s.obj.position.z = s.spot.z + LOOSE * (1 - s.progress);
  s.tickAcc += Math.abs(delta);
  if (s.tickAcc > Math.PI / 6) {
    s.tickAcc = 0;
    feel('screw');
  }
  if (s.progress >= 1) {
    s.tight = true;
    feel('tight');
    hints.hide();
    say('Nice and tight!', 'yay');
    setTimeout(nextScrew, 1000);
  }
}

function nextScrew() {
  const i = screws.findIndex((s) => !s.tight);
  if (i >= 0) {
    currentScrew = i;
    flyDriverTo(i);
    return;
  }
  // All tight: the screwdriver goes back in the box
  phase = 'build';
  driverHome.parent.attach(driver);
  const p0 = driver.position.clone();
  const q0 = driver.quaternion.clone();
  tweens.add(1.1, (k) => {
    driver.position.lerpVectors(p0, driverHome.pos, ease.inOutCubic(k));
    driver.quaternion.slerpQuaternions(q0, driverHome.quat, ease.inOutCubic(k));
  });
  rig.set(overview());
  refreshSteps();
}

// ---------- Pedals and wheel ----------
const crankCenter = V(bike.BB.x, bike.BB.y, Models.Z_ARM);
const wheelCenter = V(bike.A.x, bike.A.y, 0);

function physics(dt) {
  const geared = parts.chain.installed;
  const wheelI = 0.05 * tune.pedalWeight;
  const crankI = 0.02;
  const steps = 4;
  const h = dt / steps;
  const prevCrank = crankState.theta;
  const prevWheel = wheel.theta;
  if (wheel.held) {
    const d = wheel.pending;
    wheel.pending = 0;
    wheel.theta += d;
    wheel.omega = 0.6 * (d / Math.max(dt, 1e-3)) + 0.4 * wheel.omega;
  }
  for (let i = 0; i < steps; i++) {
    if (crankState.held) {
      // The pedal follows the finger like a spring. While it drives the wheel it carries the
      // wheel's weight (times the gear ratio squared), so it lags: that's the resistance.
      const engaged = geared && RATIO * crankState.omega >= wheel.omega - 0.05;
      const I = crankI + (engaged ? RATIO * RATIO * wheelI : 0);
      const K = tune.grip;
      const C = 2 * Math.sqrt(K * I);
      crankState.omega += ((K * (crankState.target - crankState.theta) - C * crankState.omega) / I) * h;
    } else {
      crankState.omega *= Math.exp((geared ? -14 : -2.5) * h);
    }
    crankState.theta += crankState.omega * h;
    if (!wheel.held) wheel.omega *= Math.exp(-tune.wheelDrag * h);
    // The freewheel: the wheel may spin faster than the chain, never slower
    if (geared && wheel.omega < RATIO * crankState.omega) {
      if (wheel.held) crankState.omega = wheel.omega / RATIO;
      else wheel.omega = RATIO * crankState.omega;
    }
    if (!wheel.held) wheel.theta += wheel.omega * h;
  }

  const dCrank = crankState.theta - prevCrank;
  if (crankState.held) {
    session.pedal += dCrank;
    if (geared) session.cog += RATIO * dCrank;
  }
  if (geared) {
    cogState.theta += RATIO * dCrank;
    chain.offset += dCrank * frontR;
    chain.update();
    linkAcc += Math.abs(dCrank * frontR);
    if (linkAcc > Models.PITCH * 2) {
      linkAcc = 0;
      feel('link', Math.min(1, 0.4 + Math.abs(crankState.omega) * 0.08));
    }
  }
  // Clicks from the hub while the wheel runs ahead of the chain
  freeAcc += Math.max(0, wheel.theta - prevWheel - (geared ? RATIO * dCrank : 0));
  if (freeAcc > TAU / 24) {
    freeAcc = 0;
    if (Math.abs(wheel.omega) > 0.4) feel('freewheel', Math.min(1, 0.3 + wheel.omega * 0.05));
  }
  setWhir(Math.min(1, Math.abs(wheel.omega) / 30 + (geared ? Math.abs(crankState.omega) * frontR * 1.5 : 0)));

  bike.crankPivot.rotation.z = -crankState.theta;
  bike.cogPivot.rotation.z = -cogState.theta;
  bike.rearPivot.rotation.z = -wheel.theta;
  for (const s of pedalSlots) {
    if (s.part && !s.part.tweening) s.part.obj.quaternion.copy(slotPose(s.part, s).quat);
  }

  // The test: everything on, and the pedals turned forward a full turn and a half
  if (phase === 'build' && !tested && stepDone.screws() && geared) {
    testTurn += Math.max(0, dCrank);
    if (testTurn > TAU * 2.2 && wheel.omega > 6) celebrate();
  }
}

// ---------- Power path, turn counters and the "See how it works" replay ----------
const ANCHORS = {
  pedal: () => parts.pedalR.obj.localToWorld(V(0, 0, 0.065)),
  bigGear: () => bike.group.localToWorld(V(bike.BB.x, bike.BB.y + frontR, Models.Z_CHAIN)),
  chain: () => {
    const top = chainPath.segs[0];
    return bike.group.localToWorld(V((top.from.x + top.to.x) / 2, (top.from.y + top.to.y) / 2, Models.Z_CHAIN));
  },
  littleGear: () => bike.group.localToWorld(V(bike.A.x, bike.A.y + rearR, Models.Z_CHAIN)),
  wheel: () => bike.group.localToWorld(V(bike.A.x - 0.12, bike.A.y + 0.19, 0.03)),
  pedalTag: () => bike.group.localToWorld(V(bike.BB.x, bike.BB.y - 0.17, 0.08)),
  wheelTag: () => bike.group.localToWorld(V(bike.A.x, bike.A.y - 0.3, 0.08)),
  middle: () => bike.group.localToWorld(V((bike.A.x + bike.BB.x) / 2, bike.BB.y + 0.04, 0.06)),
};

const _sv = V();
function placeAt(el, p, w, h, above = false) {
  _sv.copy(p).project(camera);
  const lift = above ? 'translate(-50%, calc(-100% - 18px))' : 'translate(-50%, -50%)';
  el.style.transform = `translate(${((_sv.x + 1) / 2) * w}px, ${((1 - _sv.y) / 2) * h}px) ${lift}`;
}

function teach(dt, shine) {
  const pedaling = crankState.held && Math.abs(crankState.omega) > 0.3;
  if (pedaling) session.last = time;
  const geared = parts.chain.installed;

  // Light the drive parts in a wave that travels from the pedal to the wheel
  if (phase === 'replay') {
    powerMats.forEach((m, i) => {
      m.emissiveIntensity =
        replayFocus < 0
          ? 0.25 + 0.45 * Math.max(0, Math.sin(time * 5 - i * 1.1))
          : i === replayFocus
            ? 0.65 + 0.25 * Math.sin(time * 6)
            : 0.04;
    });
  } else {
    power += ((pedaling ? 1 : 0) - power) * (1 - Math.exp(-dt * (pedaling ? 6 : 2)));
    powerMats.forEach((m, i) => {
      const lit = i < 2 || geared;
      m.emissiveIntensity = lit ? power * (0.12 + 0.4 * Math.max(0, Math.sin(time * 5 - i * 1.1))) : 0;
    });
  }
  powerMats[4].emissiveIntensity = Math.max(powerMats[4].emissiveIntensity, shine);

  // Live counters under the pedal and the back wheel
  const w = window.innerWidth;
  const h = window.innerHeight;
  const show =
    phase === 'replay' ||
    (parts.crankset.installed && phase !== 'celebrate' && time - session.last < 2.5 && Math.abs(session.pedal) > 0.2);
  const tp = $('tag-pedal');
  const tw = $('tag-wheel');
  tp.classList.toggle('on', show);
  tw.classList.toggle('on', show);
  if (show) {
    tp.textContent = `Pedal: ${Math.max(0, session.pedal / TAU).toFixed(1)} turns`;
    tw.textContent = geared ? `Wheel: ${Math.max(0, session.cog / TAU).toFixed(1)} turns` : 'Wheel: 0 (no chain yet!)';
    placeAt(tp, ANCHORS.pedalTag(), w, h);
    placeAt(tw, ANCHORS.wheelTag(), w, h);
  }
  if (!session.told && geared && session.pedal >= TAU && (phase === 'build' || phase === 'done')) {
    session.told = true;
    say(`One pedal turn = ${RATIO} wheel turns! (${level.frontTeeth} ÷ ${level.rearTeeth} teeth = ${RATIO})`, 'yay', 4500);
  }

  const c = $('callout');
  c.classList.toggle('on', !!callout);
  if (callout) placeAt(c, callout(), w, h, true);
}

function showCallout(text, anchor) {
  $('callout').textContent = text;
  callout = anchor;
}

// Fade the frame, tires and seat to see-through so only the drive parts stand out
const fadeMats = [M.paint, M.rubber, M.seat, M.rim, M.chrome];
function fadeBody(to) {
  const from = fadeMats[0].opacity;
  for (const m of fadeMats) {
    m.transparent = true;
    m.depthWrite = false;
    m.needsUpdate = true;
  }
  return tweens.run(0.8, (k) => fadeMats.forEach((m) => (m.opacity = from + (to - from) * ease.inOutCubic(k)))).then(() => {
    if (to >= 1) {
      for (const m of fadeMats) {
        m.transparent = false;
        m.depthWrite = true;
        m.needsUpdate = true;
      }
    }
  });
}

async function howItWorks() {
  if (phase !== 'done') return;
  phase = 'replay';
  $('cta').hidden = true;
  hints.hide();
  say('Watch how the pedal turns the wheel…');
  const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  rig.set({ target: ANCHORS.middle(), dist: Math.max(1, 0.6 / (t * camera.aspect)), az: 0.08, pol: 1.38 });
  await fadeBody(0.12);
  Object.assign(session, { pedal: 0, cog: 0, told: true });
  crankState.held = true;
  crankState.target = crankState.theta;
  autoPedal = true;
  const script = [
    [0, 'You push the pedal…', ANCHORS.pedal],
    [1, `…which turns the big gear (${level.frontTeeth} teeth)…`, ANCHORS.bigGear],
    [2, '…its teeth pull the chain…', ANCHORS.chain],
    [3, `…the chain turns the little gear (${level.rearTeeth} teeth)…`, ANCHORS.littleGear],
    [4, '…and the little gear spins the wheel!', ANCHORS.wheel],
  ];
  for (const [i, text, anchor] of script) {
    replayFocus = i;
    feel('magnet');
    showCallout(text, anchor);
    await tweens.wait(2.6);
  }
  replayFocus = -1;
  showCallout(
    `${level.frontTeeth} ÷ ${level.rearTeeth} = ${RATIO}, so one pedal turn spins the wheel ${RATIO} times!`,
    ANCHORS.middle,
  );
  feel('sparkle');
  await tweens.wait(4);
  callout = null;
  autoPedal = false;
  crankState.held = false;
  await fadeBody(1);
  rig.set(overview());
  phase = 'done';
  say('Ready to ride!', 'yay');
  $('cta').hidden = false;
}

// ---------- Celebration ----------
const spark = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,225,140,0.9)');
  g.addColorStop(1, 'rgba(255,200,80,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const N = 90;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  const mat = new THREE.PointsMaterial({
    size: 0.035,
    map: new THREE.CanvasTexture(c),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0,
  });
  const points = new THREE.Points(geo, mat);
  points.visible = false;
  scene.add(points);
  const speeds = new Float32Array(N);
  return {
    burst() {
      const p = geo.attributes.position.array;
      for (let i = 0; i < N; i++) {
        p[i * 3] = (Math.random() - 0.5) * 1.4;
        p[i * 3 + 1] = 0.15 + Math.random() * 0.6;
        p[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
        speeds[i] = 0.05 + Math.random() * 0.12;
      }
      points.visible = true;
      tweens.add(
        2.8,
        (k) => {
          for (let i = 0; i < N; i++) p[i * 3 + 1] += speeds[i] * 0.016;
          geo.attributes.position.needsUpdate = true;
          mat.opacity = Math.sin(k * Math.PI);
        },
        () => (points.visible = false),
      );
    },
  };
})();

// Golden rays that spin slowly behind the bike
const sunburst = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d');
  ctx.translate(256, 256);
  for (let i = 0; i < 18; i++) {
    ctx.rotate(TAU / 18);
    ctx.fillStyle = i % 2 ? 'rgba(255, 196, 60, 0.75)' : 'rgba(255, 226, 130, 0.55)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(256, -26);
    ctx.lineTo(256, 26);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'destination-in';
  const fade = ctx.createRadialGradient(0, 0, 10, 0, 0, 256);
  fade.addColorStop(0, 'rgba(0,0,0,1)');
  fade.addColorStop(0.65, 'rgba(0,0,0,0.6)');
  fade.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = fade;
  ctx.fillRect(-256, -256, 512, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0, toneMapped: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), mat);
  mesh.renderOrder = -1;
  mesh.visible = false;
  scene.add(mesh);
  return { mesh, mat };
})();

// Paper confetti in the Bodai colors, with gravity and a little air drag
const confetti = (() => {
  const N = 220;
  const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.6, transparent: true });
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.016, 0.028), mat, N);
  mesh.frustumCulled = false;
  mesh.visible = false;
  const palette = [0x17c3b2, 0xee4b3c, 0xffcf4a, 0xec4a92, 0xffffff, 0x6c8cff];
  const color = new THREE.Color();
  for (let i = 0; i < N; i++) mesh.setColorAt(i, color.set(palette[i % palette.length]));
  scene.add(mesh);
  const bits = Array.from({ length: N }, () => ({ p: V(), v: V(), r: new THREE.Euler(), w: V() }));
  const d = new THREE.Object3D();
  let t = 0;
  return {
    burst(y = 0.5) {
      for (const b of bits) {
        b.p.set((Math.random() - 0.5) * 0.5, y, (Math.random() - 0.5) * 0.2);
        b.v.set((Math.random() - 0.5) * 2.6, 1.4 + Math.random() * 2.2, (Math.random() - 0.5) * 1.6);
        b.r.set(Math.random() * TAU, Math.random() * TAU, Math.random() * TAU);
        b.w.set(Math.random() * 12 - 6, Math.random() * 12 - 6, Math.random() * 12 - 6);
      }
      t = 0;
      mat.opacity = 1;
      mesh.visible = true;
    },
    update(dt) {
      if (!mesh.visible) return;
      t += dt;
      bits.forEach((b, i) => {
        if (b.p.y > 0.003) {
          b.v.y -= 3 * dt;
          b.v.multiplyScalar(Math.exp(-1.4 * dt));
          b.p.addScaledVector(b.v, dt);
          b.r.x += b.w.x * dt;
          b.r.y += b.w.y * dt;
          b.r.z += b.w.z * dt;
          if (b.p.y <= 0.003) {
            b.p.y = 0.003;
            b.r.set(-Math.PI / 2, 0, b.r.z);
          }
        }
        d.position.copy(b.p);
        d.rotation.copy(b.r);
        d.updateMatrix();
        mesh.setMatrixAt(i, d.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (t > 7) mat.opacity = Math.max(0, 1 - (t - 7));
      if (t > 8) mesh.visible = false;
    },
  };
})();

// A golden ring that races out across the floor when the bike lands
const shockwave = new THREE.Mesh(
  new THREE.RingGeometry(0.42, 0.5, 72).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0xffc23d, transparent: true, opacity: 0, depthWrite: false }),
);
shockwave.position.y = 0.004;
shockwave.visible = false;
scene.add(shockwave);

const flash = new THREE.PointLight(0xffd27a, 0, 4, 1.2);
flash.position.set(0, 0.9, 0.7);
scene.add(flash);

async function celebrate() {
  tested = true;
  phase = 'celebrate';
  hints.hide();
  refreshSteps();
  feel('bell');
  feel('fanfare');
  say('Ding ding! The bike works!', 'yay');
  glowing = true;
  outline.selectedObjects = [bike.group];
  rig.set({ target: V(0, 0.4, 0), dist: overview().dist * 1.05, az: 0.15, pol: 1.25 });
  sunburst.mesh.visible = true;
  tweens.run(1.2, (k) => {
    sunburst.mat.opacity = ease.outCubic(k);
    sunburst.mesh.scale.setScalar(0.3 + 0.7 * ease.outBack(k));
    flash.intensity = 7 * Math.sin(k * Math.PI) + 1.5 * k;
  });
  feel('whoosh');
  await tweens.run(0.9, (k) => {
    stand.position.y = -0.85 * ease.inOutCubic(k);
    bikeRoot.position.y = 0.06 + 0.16 * ease.outCubic(k);
  });
  feel('sparkle');
  spark.burst();
  confetti.burst(0.55);
  kick.amount += 0.01;
  await tweens.run(4.5, (k) => {
    bikeRoot.rotation.y = TAU * ease.inOutCubic(k);
    bikeRoot.position.y = 0.22 + 0.03 * Math.sin(k * Math.PI * 2);
  });
  bikeRoot.rotation.y = 0;
  await tweens.run(0.45, (k) => (bikeRoot.position.y = 0.22 * (1 - k * k)));
  feel('land');
  kick.amount += 0.012;
  shockwave.visible = true;
  tweens.run(1.1, (k) => {
    shockwave.scale.setScalar(1 + 4 * ease.outCubic(k));
    shockwave.material.opacity = 0.85 * (1 - k);
  }).then(() => (shockwave.visible = false));
  // A little squash-and-bounce on landing
  await tweens.run(0.4, (k) => {
    const s = Math.sin(k * Math.PI);
    bikeRoot.scale.set(1 + 0.04 * s, 1 - 0.06 * s, 1 + 0.04 * s);
  });
  bikeRoot.scale.set(1, 1, 1);
  feel('sparkle');
  await tweens.run(2, (k) => {
    outline.edgeStrength = 10 * (1 - k);
    sunburst.mat.opacity = 1 - k;
    flash.intensity = 1.5 * (1 - k);
  });
  sunburst.mesh.visible = false;
  glowing = false;
  phase = 'done';
  say('Ready to ride!', 'yay');
  $('cta').hidden = false;
}

// ---------- Pointer and touch ----------
const pointers = new Map();
let lastTap = { t: 0, x: 0, y: 0 };

function onDown(e) {
  if (phase === 'intro') return;
  unlockAudio();
  touch();
  try {
    canvas.setPointerCapture(e.pointerId);
  } catch {
    // Synthetic or already-released pointers can't be captured; window listeners still work.
  }
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now() });
  if (pointers.size === 2) {
    endGesture(true);
    const [a, b] = [...pointers.values()];
    gesture = { type: 'pinch', d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
    return;
  }
  // Laptops: right-drag or Shift-drag slides the view
  if (e.button === 2 || e.shiftKey) {
    gesture = { type: 'pan' };
    return;
  }
  if (pointers.size > 2) return;

  if (phase === 'screw') {
    gesture = { type: 'screw', last: angleAround(e.clientX, e.clientY, bike.group.worldToLocal(screwWorld(currentScrew))) };
    return;
  }
  const hit = pick(e.clientX, e.clientY);
  const kind = hit?.kind;
  const canPlay = phase === 'build' || phase === 'done';
  if (phase === 'closed' && kind && kind !== 'none' && kind !== 'wheel' && kind !== 'crank') {
    tapToolbox(kind === 'latch' ? hit : { kind: 'toolbox' });
    gesture = { type: 'none' };
  } else if (kind === 'part' && phase === 'build' && !parts[hit.id].installed && !parts[hit.id].tweening) {
    gesture = startDrag(parts[hit.id], e);
  } else if (kind === 'crank' && canPlay) {
    crankState.held = true;
    crankState.target = crankState.theta;
    Object.assign(session, { pedal: 0, cog: 0, told: false });
    gesture = { type: 'crank', last: angleAround(e.clientX, e.clientY, crankCenter) };
  } else if (kind === 'wheel' && canPlay) {
    wheel.held = true;
    gesture = { type: 'wheel', last: angleAround(e.clientX, e.clientY, wheelCenter) };
  } else if (kind === 'tool' && phase === 'build') {
    useScrewdriver();
    gesture = { type: 'none' };
  } else {
    gesture = { type: 'orbit' };
  }
}

function onMove(e) {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  const dx = e.clientX - p.x;
  const dy = e.clientY - p.y;
  p.x = e.clientX;
  p.y = e.clientY;
  if (!gesture) return;
  touch();
  const g = gesture;
  if (g.type === 'pinch') {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (g.d > 0 && d > 0) rig.zoom(g.d / d);
    g.d = d;
    // Moving both fingers together slides the view
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    rig.pan(mx - g.mx, my - g.my);
    g.mx = mx;
    g.my = my;
  } else if (g.type === 'pan') {
    rig.pan(dx, dy);
  } else if (g.type === 'orbit') {
    rig.orbit(dx, dy);
  } else if (g.type === 'drag') {
    moveDrag(e, g);
  } else if (g.type === 'crank' || g.type === 'wheel' || g.type === 'screw') {
    const center =
      g.type === 'crank' ? crankCenter : g.type === 'wheel' ? wheelCenter : bike.group.worldToLocal(screwWorld(currentScrew));
    const a = angleAround(e.clientX, e.clientY, center);
    if (a == null) return;
    if (g.last == null) {
      g.last = a;
      return;
    }
    const forward = -unwrap(a - g.last); // clockwise on the drive side = forward / tighten
    g.last = a;
    if (g.type === 'crank') crankState.target += forward;
    else if (g.type === 'wheel') wheel.pending += forward;
    else turnScrew(forward);
  }
}

function endGesture(cancel = false) {
  if (!gesture) return;
  if (gesture.type === 'drag') endDrag(gesture, cancel);
  if (gesture.type === 'crank') crankState.held = false;
  if (gesture.type === 'wheel') wheel.held = false;
  gesture = null;
}

function onUp(e) {
  const p = pointers.get(e.pointerId);
  pointers.delete(e.pointerId);
  if (!p) return;
  if (gesture?.type === 'pinch') {
    if (pointers.size === 0) gesture = null;
    return;
  }
  endGesture(e.type === 'pointercancel');
  const moved = Math.hypot(e.clientX - p.x0, e.clientY - p.y0);
  if (moved < 10 && performance.now() - p.t0 < 300) {
    const now = performance.now();
    if (now - lastTap.t < 330 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 40) {
      doubleTap(e.clientX, e.clientY);
      lastTap.t = 0;
    } else {
      lastTap = { t: now, x: e.clientX, y: e.clientY };
    }
  }
}

function doubleTap(x, y) {
  if (phase === 'screw' || phase === 'celebrate') return;
  aim(x, y);
  const hits = raycaster.intersectObjects([bikeRoot, tb.group], true);
  if (hits.length && rig.goal.dist > 0.55) rig.set({ target: hits[0].point, dist: 0.42 });
  else rig.set(overview());
}

canvas.addEventListener('pointerdown', onDown);
window.addEventListener('pointermove', onMove);
window.addEventListener('pointerup', onUp);
window.addEventListener('pointercancel', onUp);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    touch();
    rig.zoom(Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
  },
  { passive: false },
);

// ---------- Buttons and the tuning panel ----------
function begin() {
  unlockAudio();
  $('start').hidden = true;
  // Phones: go full screen so the browser bar doesn't eat the game. Browsers that can't
  // (like iPhone Safari) just carry on as normal. Upright or sideways is the player's choice.
  if (window.matchMedia('(pointer: coarse)').matches) {
    document.documentElement.requestFullscreen?.().catch(() => {});
  }
  phase = 'closed';
  renderLives();
  refreshSteps();
}
$('btn-start').onclick = begin;

// Starting over reloads the level and skips the welcome card
function startOver() {
  try {
    sessionStorage.setItem('gears-skip-intro', '1');
  } catch {
    // Without storage the welcome card just shows again.
  }
  location.reload();
}
$('btn-restart').onclick = () =>
  modal('Start the bike over from the beginning?', 'Start over', startOver, ['Keep building', () => ($('modal').hidden = true)]);
try {
  if (sessionStorage.getItem('gears-skip-intro')) {
    sessionStorage.removeItem('gears-skip-intro');
    begin();
  }
} catch {
  // Storage blocked: show the welcome card as usual.
}
$('btn-hint').onclick = () => {
  unlockAudio();
  const step = currentStep();
  if (step) say(step.say);
  showHint();
};
$('btn-view').onclick = () => rig.set(phase === 'screw' ? screwView(currentScrew) : overview());
$('btn-scene').onclick = () =>
  modal(
    'Coming next (Phase 1): the bike rolls back into the storybook garage. The girl hops on and rides off, Mom stands up and waves, and the dog chases after them, barking.',
    'Build it again',
    startOver,
    ['Keep playing', () => ($('modal').hidden = true)],
  );
$('btn-how').onclick = () => howItWorks();

// Phones: tap the progress dots to see every step, and it tucks away again by itself
let listTimer = 0;
$('progress').onclick = () => {
  $('bubble').classList.remove('quiet');
  quietLater();
  const list = $('steps-list');
  list.hidden = !list.hidden;
  clearTimeout(listTimer);
  if (!list.hidden) listTimer = setTimeout(() => (list.hidden = true), 4000);
};
$('btn-tune').onclick = () => ($('tune').hidden = !$('tune').hidden);

function buildTunePanel() {
  const panel = $('tune');
  const version = document.querySelector('meta[name="version"]')?.content ?? '';
  panel.innerHTML = `<h2>Tune the feel <small>${version}</small></h2>`;
  const fmt = (v) => (Math.round(v * 100) / 100).toString();
  for (const s of tuneSpec) {
    const row = document.createElement('label');
    row.className = 'row';
    const name = document.createElement('span');
    name.textContent = s.label;
    const out = document.createElement('output');
    let input;
    if (s.options) {
      input = document.createElement('select');
      for (const [v, t] of s.options) input.add(new Option(t, v));
    } else {
      input = document.createElement('input');
      input.type = 'range';
      Object.assign(input, { min: s.min, max: s.max, step: s.step });
      out.textContent = fmt(tune[s.key]);
    }
    input.value = tune[s.key];
    input.addEventListener('input', () => {
      tune[s.key] = s.options ? input.value : parseFloat(input.value);
      if (!s.options) out.textContent = fmt(tune[s.key]);
      saveTune();
      if (s.key === 'volume') setVolume(tune.volume);
      if (s.key === 'theme') applyTheme();
      if (s.key === 'mode') {
        lives = tune.lives;
        renderLives();
      }
    });
    row.append(name, input, out);
    panel.append(row);
  }
  const actions = document.createElement('div');
  actions.className = 'actions';
  const copy = document.createElement('button');
  copy.textContent = 'Copy settings';
  copy.onclick = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(tune));
      copy.textContent = 'Copied!';
    } catch {
      copy.textContent = 'Copy failed';
    }
    setTimeout(() => (copy.textContent = 'Copy settings'), 1500);
  };
  const reset = document.createElement('button');
  reset.textContent = 'Reset';
  reset.onclick = () => {
    resetTune();
    setVolume(tune.volume);
    applyTheme();
    buildTunePanel();
    renderLives();
  };
  const close = document.createElement('button');
  close.textContent = 'Close';
  close.onclick = () => (panel.hidden = true);
  actions.append(copy, reset, close);
  panel.append(actions);
}
buildTunePanel();

// ---------- Resize and main loop ----------
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  applyLayout();
  if (['intro', 'closed', 'build', 'done'].includes(phase)) rig.set(overview());
}
window.addEventListener('resize', resize);
resize();
rig.set({ ...overview(), az: 0.3 }, true);

let last = performance.now();
let time = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time += dt;
  tweens.update(dt);
  physics(dt);
  attention();
  if (phase === 'screw' && !driver.userData.flying) {
    const { pos, quat } = driverPose(currentScrew);
    driver.position.copy(pos);
    driver.quaternion.copy(quat);
  }
  if (gesture?.type === 'drag' && tune.mode === 'gentle' && gesture.moved) {
    const ghost = ghostOf(gesture.part);
    const t = slotWorld(gesture.part, gesture.point);
    ghost.position.copy(t.pos);
    ghost.quaternion.copy(t.quat);
    ghost.visible = true;
    ghostMat.opacity = 0.25 + 0.15 * Math.sin(time * 6);
  }
  kick.amount *= Math.exp(-dt * 9);
  rig.update(dt, kick.amount);
  if (glowing && phase === 'celebrate') outline.edgeStrength = Math.min(outline.edgeStrength + dt * 20, 9 + 3 * Math.sin(time * 4));
  // A warm shine on the paint that pulses with the outline
  const shine = glowing ? (outline.edgeStrength / 12) * (0.45 + 0.15 * Math.sin(time * 4)) : 0;
  for (const m of [M.paint, M.rim]) m.emissiveIntensity = shine;
  if (autoPedal) crankState.target += 1.6 * dt;
  teach(dt, shine);
  confetti.update(dt);
  if (sunburst.mesh.visible) {
    // Always face the camera from just behind the bike, and turn slowly
    sunburst.mesh.position.copy(V(0, 0.42, 0)).addScaledVector(camera.getWorldDirection(V()), 0.6);
    sunburst.mesh.quaternion.copy(camera.quaternion);
    sunburst.mesh.rotateZ(time * 0.25);
  }
  hints.update(camera, window.innerWidth, window.innerHeight);

  // Idle hints: show the next step's hint after a quiet spell
  const wait = (tune.mode === 'gentle' ? tune.hintGentle : tune.hintClassic) * 1000;
  if (!gesture && !hints.visible && now - lastTouch > wait && ['closed', 'build', 'screw'].includes(phase)) {
    lastTouch = now;
    const step = currentStep();
    if (step) say(step.say);
    showHint();
  }

  if (glowing) composer.render();
  else renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
// For debugging in the browser console
window.__gears = {
  camera,
  rig,
  bike,
  crankState,
  wheel,
  parts,
  slotWorld,
  screwWorld,
  outline,
  glow: (on) => {
    glowing = on;
    outline.selectedObjects = [bike.group];
    outline.edgeStrength = 10;
  },
};
