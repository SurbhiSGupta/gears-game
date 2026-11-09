// Gear lookbook: realistic brass, silver and black gears in a studio, to settle the look
// before rebuilding the game with them.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { makeGear, meshAngle, finishes, steel, nutStack, toothRadius, toothFlank } from './gearmaker.js';
import { feel, unlockAudio } from './feel.js';
import { sprocketGeometry, pitchRadius } from './models.js';
import { ChainPath, ChainLoop } from './chain.js';

const $ = (id) => document.getElementById(id);
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

// ---------- Renderer and studio lighting ----------
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x131417);

// Reflections come from a dark studio with three soft boxes, like a product photo shoot
function studioEnvironment() {
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(12, 12, 12), new THREE.MeshBasicMaterial({ color: 0x3a3d43, side: THREE.BackSide })));
  const box = (w, h, color, pos, look) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    m.position.copy(pos);
    m.lookAt(look);
    env.add(m);
  };
  box(7, 4, new THREE.Color(6, 6, 6), V(0, 5, 1.5), V(0, 0, 0));
  box(2.4, 6, new THREE.Color(4.2, 4, 3.6), V(-5, 1, 2.5), V(0, 0, 0));
  box(2.4, 6, new THREE.Color(3, 3.3, 4), V(5, 0.5, 2), V(0, 0, 0));
  box(6, 2, new THREE.Color(2.2, 2.1, 2), V(0, -2, 5.5), V(0, 0, 0));
  const pmrem = new THREE.PMREMGenerator(renderer);
  return pmrem.fromScene(env, 0.02).texture;
}
scene.environment = studioEnvironment();
scene.environmentIntensity = 1;

const key = new THREE.DirectionalLight(0xfff4e6, 2.2);
key.position.set(-0.8, 1.2, 1.6);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -1, right: 1.6, top: 0.6, bottom: -0.6, near: 0.2, far: 5 });
key.shadow.camera.updateProjectionMatrix();
key.shadow.bias = -0.0002;
key.shadow.normalBias = 0.002;
scene.add(key);
const rim = new THREE.DirectionalLight(0xbcd2ff, 1.2);
rim.position.set(1.4, 0.4, -0.2);
scene.add(rim);

const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 20);
const controls = new OrbitControls(camera, canvas);

// Ambient occlusion darkens the tight spots: between meshing teeth, in tooth gaps and where
// gears sit over the plate. It's what makes them look like they really grip each other.
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const ao = new GTAOPass(scene, camera, 256, 256);
ao.updateGtaoMaterial({ radius: 0.01, distanceExponent: 1.4, thickness: 1, scale: 1.4, samples: 16 });
ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
ao.blendIntensity = 1;
composer.addPass(ao);
composer.addPass(new OutputPass());
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 0.08;
controls.maxDistance = 2.5;

// ---------- Backing plates, like a clock movement ----------
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
// Light brushed aluminium, so brass, silver and black all stand out against it
const plateMat = new THREE.MeshPhysicalMaterial({ color: 0xa4a7ac, metalness: 0.72, roughness: 0.7, roughnessMap: brushedTexture(), anisotropy: 0.9 });
const brassMat = finishes.brass(0.01)[1];

function plate(w, h, x) {
  const g = new THREE.Group();
  const p = new THREE.Mesh(new RoundedBoxGeometry(w, h, 0.01, 4, 0.006), plateMat);
  p.position.set(x, 0, -0.03);
  p.receiveShadow = true;
  g.add(p);
  // Brass standoffs with steel screws in the corners
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const px = x + sx * (w / 2 - 0.022);
      const py = sy * (h / 2 - 0.022);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.018, 24).rotateX(Math.PI / 2), brassMat);
      post.position.set(px, py, -0.016);
      post.castShadow = true;
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.002, 6).rotateX(Math.PI / 2), steel());
      head.position.set(px, py, -0.006);
      g.add(post, head);
    }
  }
  scene.add(g);
}

// Steel axle from the plate up through a gear, finished with a washer and hex nut on top
const boltMat = new THREE.MeshPhysicalMaterial({ color: 0xc3c8cf, metalness: 1, roughness: 0.24, clearcoat: 0.2 });
function bolt(x, y, boreR, topZ, parent = scene) {
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(boreR * 0.98, boreR * 0.98, topZ + 0.025, 24).rotateX(Math.PI / 2), boltMat);
  shaft.position.set(x, y, (topZ - 0.025) / 2);
  const nut = nutStack(boreR, boltMat);
  nut.position.set(x, y, topZ);
  parent.add(shaft, nut);
  return nut;
}

// ---------- The gear train: brass, silver and carbon steel, all meshing ----------
const M = 0.0038; // tooth size (module), meters
plate(0.48, 0.3, -0.01);
const brass = makeGear({ teeth: 48, module: M, thickness: 0.012, finish: 'brass', web: 'spokes', spokes: 5 });
const silver = makeGear({ teeth: 24, module: M, thickness: 0.014, finish: 'silver', web: 'holes' });
const carbon = makeGear({ teeth: 16, module: M, thickness: 0.016, finish: 'carbon', web: 'solid' });
const beta1 = THREE.MathUtils.degToRad(14);
const beta2 = THREE.MathUtils.degToRad(-32);
brass.group.position.set(-0.12, -0.014, 0);
silver.group.position.copy(brass.group.position).add(V(Math.cos(beta1), Math.sin(beta1)).multiplyScalar(((48 + 24) * M) / 2));
carbon.group.position.copy(silver.group.position).add(V(Math.cos(beta2), Math.sin(beta2)).multiplyScalar(((24 + 16) * M) / 2));
const hubFront = (thickness) => (thickness * 1.7) / 2; // front face of a gear's hub
for (const g of [brass, silver, carbon]) scene.add(g.group);
bolt(silver.group.position.x, silver.group.position.y, silver.bore * 0.75, hubFront(0.014));
bolt(carbon.group.position.x, carbon.group.position.y, carbon.bore * 0.8, hubFront(0.016));

// ---------- The crank handle on the brass gear ----------
const BRASS_FRONT = hubFront(0.012);

// Carbon steel arm from the hub out to a turned walnut knob
const carbonMat = finishes.carbon(0.08);
const ARM = 0.068;
const armShape = new THREE.Shape();
armShape.moveTo(0, -0.0085);
armShape.lineTo(ARM, -0.0055);
armShape.absarc(ARM, 0, 0.0055, -Math.PI / 2, Math.PI / 2, false);
armShape.lineTo(0, 0.0085);
armShape.absarc(0, 0, 0.0085, Math.PI / 2, (3 * Math.PI) / 2, false);
const armHole = new THREE.Path();
armHole.absarc(0, 0, brass.bore, 0, TAU, true);
armShape.holes.push(armHole);
const armGeo = new THREE.ExtrudeGeometry(armShape, { depth: 0.0034, bevelEnabled: true, bevelThickness: 0.0006, bevelSize: 0.0006, bevelSegments: 2, curveSegments: 32 });
const arm = new THREE.Mesh(armGeo, carbonMat);
const ARM_Z = BRASS_FRONT + 0.0006;
arm.position.z = ARM_Z;
arm.castShadow = true;
arm.rotation.z = Math.PI * 0.62;
brass.group.add(arm);

function woodTexture() {
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
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const knobProfile = [
  [0, 0], [0.0042, 0], [0.0046, 0.003], [0.004, 0.006], [0.0062, 0.015], [0.0068, 0.024], [0.0064, 0.03], [0.0045, 0.0335], [0, 0.034],
].map(([r, y]) => new THREE.Vector2(r, y));
const knob = new THREE.Mesh(
  new THREE.LatheGeometry(knobProfile, 40).rotateX(Math.PI / 2),
  new THREE.MeshPhysicalMaterial({ map: woodTexture(), roughness: 0.42, clearcoat: 0.7, clearcoatRoughness: 0.2 }),
);
knob.castShadow = true;
const knobPivot = new THREE.Group(); // keeps the knob upright-feeling as the arm sweeps around
knobPivot.position.set(ARM, 0, 0.0034 + 0.0012);
knobPivot.add(knob);
arm.add(knobPivot);
const knobCap = nutStack(0.0022, boltMat);
knobCap.position.set(ARM, 0, 0.0034 + 0.0012 + 0.034);
arm.add(knobCap);
for (const m of [arm, knob]) m.userData.handle = true;

// The brass gear's own axle and nut, on top of the arm
bolt(brass.group.position.x, brass.group.position.y, brass.bore * 0.6, ARM_Z + 0.0034 + 0.0012);

// ---------- The pawl: a spring-loaded click riding on the brass gear's outer teeth ----------
// Turning clockwise, each tooth lifts the pawl and it drops into the next gap with a click.
// Turned back, the teeth push into the pawl and it jams, like a ratchet.
const BRASS_TEETH = 48;
const STEP = TAU / BRASS_TEETH;
const BRASS_RP = (BRASS_TEETH * M) / 2;
const BRASS_RA = BRASS_RP + M;
const R_REST = BRASS_RP - 0.55 * M; // how deep the pawl's tip sits in a gap
const DROP = toothFlank(BRASS_TEETH, M, R_REST) / STEP; // where the tip falls off a tooth
const PAWL_ANGLE = THREE.MathUtils.degToRad(122); // where the pawl touches the rim (upper left)
const bc = brass.group.position;
const tipAt = (r) => V(bc.x + r * Math.cos(PAWL_ANGLE), bc.y + r * Math.sin(PAWL_ANGLE), 0);
// The pivot sits outside the rim, on the side the teeth turn toward when going backward,
// so a backward push drives the tip straight into the pawl and it locks
const pivotPos = V(bc.x + (BRASS_RA + 0.026) * Math.cos(PAWL_ANGLE + 0.3), bc.y + (BRASS_RA + 0.026) * Math.sin(PAWL_ANGLE + 0.3), 0);
const restTip = tipAt(R_REST);
const pawlLen = pivotPos.distanceTo(restTip);
const pawlBase = Math.atan2(restTip.y - pivotPos.y, restTip.x - pivotPos.x);
const pawlZ = -0.0022; // in the same plane as the gear teeth
const pawl = new THREE.Group();
pawl.position.set(pivotPos.x, pivotPos.y, pawlZ);
{
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.0042);
  shape.lineTo(pawlLen * 0.78, -0.003);
  shape.lineTo(pawlLen, 0);
  shape.lineTo(pawlLen * 0.8, 0.0026);
  shape.lineTo(0, 0.0042);
  shape.absarc(0, 0, 0.0042, Math.PI / 2, (3 * Math.PI) / 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, 0.0016, 0, TAU, true);
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.0038, bevelEnabled: true, bevelThickness: 0.0003, bevelSize: 0.0003, bevelSegments: 2, curveSegments: 16 });
  const lever = new THREE.Mesh(geo, finishes.carbon(0.03));
  lever.castShadow = true;
  pawl.add(lever);
}
scene.add(pawl);
// Brass post the pawl swings on, and a tiny pivot screw
{
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.0032, 0.0032, pawlZ + 0.025, 20).rotateX(Math.PI / 2), finishes.brass(0.01)[1]);
  post.position.set(pivotPos.x, pivotPos.y, (pawlZ - 0.025) / 2);
  post.castShadow = true;
  scene.add(post);
  const cap = nutStack(0.0016, boltMat);
  cap.position.set(pivotPos.x, pivotPos.y, pawlZ + 0.0044);
  scene.add(cap);
}
// Short coil spring pressing the pawl onto the teeth, from a pin just beside the lever
const springAnchor = (() => {
  const d = V(Math.cos(pawlBase), Math.sin(pawlBase), 0);
  const mid = pivotPos.clone().addScaledVector(d, pawlLen * 0.6);
  let n = V(-d.y, d.x, 0);
  if (n.dot(mid.clone().sub(V(bc.x, bc.y, 0))) < 0) n = n.negate(); // away from the gear
  return mid.addScaledVector(n, 0.014).setZ(pawlZ + 0.0019);
})();
const springPost = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, springAnchor.z + 0.025, 16).rotateX(Math.PI / 2), steel());
springPost.position.set(springAnchor.x, springAnchor.y, (springAnchor.z - 0.025) / 2);
scene.add(springPost);
const springMat = new THREE.MeshPhysicalMaterial({ color: 0xb9bec6, metalness: 1, roughness: 0.25 });
let spring = null;
function updateSpring() {
  const end = new THREE.Vector3(pawlLen * 0.6, 0, 0.0019).applyMatrix4(pawl.matrixWorld);
  const dir = end.clone().sub(springAnchor);
  const len = dir.length();
  dir.normalize();
  const side = V(-dir.y, dir.x, 0);
  const pts = [];
  const turns = 9;
  for (let i = 0; i <= 120; i++) {
    const t = i / 120;
    const a = t * turns * TAU;
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
// How far the pawl must rotate to lift its tip by a given amount (measured once)
const liftPerRadian = (() => {
  const tip = (ang) => V(pivotPos.x + pawlLen * Math.cos(ang), pivotPos.y + pawlLen * Math.sin(ang), 0).distanceTo(V(bc.x, bc.y, 0));
  return (tip(pawlBase + 0.001) - tip(pawlBase)) / 0.001;
})();

// ---------- Bike gears: silver chainring on a carbon spider, carbon rear cog, chain ----------
const BIKE_X = 0.9;
plate(0.5, 0.26, BIKE_X);
const ringTeeth = 32;
const cogTeeth = 16;
const ringR = pitchRadius(ringTeeth);
const cogR = pitchRadius(cogTeeth);
const ringPos = V(BIKE_X + 0.11, 0, 0.004);
const cogPos = V(BIKE_X - 0.15, 0, 0.004);

const chainring = new THREE.Group();
{
  const { geo } = sprocketGeometry(ringTeeth, { holes: 0, bore: 0.042, thickness: 0.003 });
  chainring.add(new THREE.Mesh(geo, finishes.silver(ringR + 0.005)));
  const arms = 5;
  const spiderMat = finishes.carbon(0.05);
  const extrude = (shape, depth, z) => {
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.0007, bevelSize: 0.0007, bevelSegments: 2, curveSegments: 32 });
    g.translate(0, 0, z);
    return new THREE.Mesh(g, spiderMat);
  };
  const hubShape = new THREE.Shape();
  hubShape.absarc(0, 0, 0.022, 0, TAU, false);
  const bore = new THREE.Path();
  bore.absarc(0, 0, 0.009, 0, TAU, true);
  hubShape.holes.push(bore);
  chainring.add(extrude(hubShape, 0.009, 0.0015));
  for (let i = 0; i < arms; i++) {
    const a = (i / arms) * TAU;
    const armS = new THREE.Shape();
    armS.moveTo(0.012, -0.0085);
    armS.lineTo(0.046, -0.0055);
    armS.absarc(0.046, 0, 0.0055, -Math.PI / 2, Math.PI / 2, false);
    armS.lineTo(0.012, 0.0085);
    armS.lineTo(0.012, -0.0085);
    const mesh = extrude(armS, 0.006, 0.0015);
    mesh.rotation.z = a;
    chainring.add(mesh);
    const b = nutStack(0.0024, boltMat);
    b.position.set(0.046 * Math.cos(a), 0.046 * Math.sin(a), 0.0082);
    chainring.add(b);
  }
}
chainring.position.copy(ringPos);
const cog = new THREE.Group();
{
  const { geo } = sprocketGeometry(cogTeeth, { holes: 6, bore: 0.008, thickness: 0.003 });
  cog.add(new THREE.Mesh(geo, finishes.carbon(cogR + 0.005)));
}
cog.position.copy(cogPos);
for (const g of [chainring, cog]) {
  g.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  scene.add(g);
}
bolt(ringPos.x, ringPos.y, 0.009, ringPos.z + 0.0105);
bolt(cogPos.x, cogPos.y, 0.0075, ringPos.z + 0.0015);

const chainMat = new THREE.MeshPhysicalMaterial({ color: 0x4f535a, metalness: 1, roughness: 0.3 });
const chainPath = new ChainPath({ x: cogPos.x, y: cogPos.y }, cogR, { x: ringPos.x, y: ringPos.y }, ringR);
const chain = new ChainLoop(chainMat);
chain.setPath(chainPath);
chain.group.position.z = ringPos.z;
scene.add(chain.group);

// ---------- Views ----------
const contact = brass.group.position.clone().add(V(Math.cos(beta1), Math.sin(beta1)).multiplyScalar((48 * M) / 2));
const VIEWS = {
  train: {
    label: 'Gear train',
    note: 'Drag the wooden handle to turn the brass gear. Each gear turns the opposite way to the one it meshes with.',
    target: V(-0.01, 0, 0),
    from: V(0.07, 0.08, 0.7),
  },
  mesh: {
    label: 'Teeth close-up',
    note: 'Where the brass teeth push the silver ones round. Turn the handle and watch each tooth hand off to the next.',
    target: contact,
    from: contact.clone().add(V(0.04, 0.07, 0.13)),
  },
  ratchet: {
    label: 'Ratchet',
    note: 'The pawl rides on the brass teeth and drops into each gap with a click. Turn backward and it locks.',
    target: tipAt(BRASS_RP),
    from: tipAt(BRASS_RP).add(V(-0.02, 0.05, 0.12)),
  },
  silver: {
    label: 'Silver',
    note: 'Polished steel, 24 teeth, six drilled lightening holes, held on with a washer and hex nut.',
    target: silver.group.position.clone(),
    from: V(0.06, 0.05, 0.16),
  },
  carbon: {
    label: 'Carbon steel',
    note: 'Carbon steel, 16 teeth: dark gunmetal with a cool machined sheen.',
    target: carbon.group.position.clone(),
    from: V(0.08, 0.04, 0.13),
  },
  bike: {
    label: 'Bike gears',
    note: 'A real bike drivetrain: silver 32-tooth chainring on a carbon steel spider, carbon steel 16-tooth cog, steel chain.',
    target: V(BIKE_X, 0, 0),
    from: V(BIKE_X + 0.02, 0.1, 0.86),
  },
};

let fly = null;
let current = 'train';
function goTo(name) {
  const v = VIEWS[name];
  const portrait = camera.aspect < 0.9;
  const scale = portrait ? Math.min(2.4, 1 / camera.aspect) : 1;
  const offset = v.from.clone().sub(v.target);
  if (name === 'train' || name === 'bike') offset.multiplyScalar(scale);
  else offset.multiplyScalar(portrait ? 1.3 : 1);
  fly = {
    t: 0,
    fromPos: camera.position.clone(),
    fromTarget: controls.target.clone(),
    toPos: v.target.clone().add(offset),
    toTarget: v.target.clone(),
  };
  $('note').textContent = v.note;
  for (const b of document.querySelectorAll('#views button')) b.classList.toggle('on', b.dataset.view === name);
  current = name;
}

const bar = $('views');
for (const [name, v] of Object.entries(VIEWS)) {
  const b = document.createElement('button');
  b.textContent = v.label;
  b.dataset.view = name;
  b.onclick = () => goTo(name);
  bar.append(b);
}

let speed = 0.35;
let auto = false;
$('play').onclick = () => {
  unlockAudio();
  auto = !auto;
  $('play').textContent = auto ? 'Stop' : 'Auto-turn';
  $('play').classList.toggle('on', auto);
};
$('speed').oninput = (e) => (speed = parseFloat(e.target.value));

// ---------- Turning the handle ----------
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const handlePlane = new THREE.Plane(V(0, 0, 1), -(ARM_Z + 0.02));
function pointerAngle(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.ray.intersectPlane(handlePlane, V());
  return hit ? Math.atan2(hit.y - bc.y, hit.x - bc.x) : null;
}
function hitsHandle(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects([arm], true);
  return hits.length > 0;
}

const drive = { theta: 0, omega: 0, target: 0, held: false, last: null };
const unwrap = (d) => (d > Math.PI ? d - TAU : d < -Math.PI ? d + TAU : d);
window.addEventListener(
  'pointerdown',
  (e) => {
    unlockAudio();
    if (e.target !== canvas || !hitsHandle(e)) return;
    controls.enabled = false;
    drive.held = true;
    drive.target = drive.theta;
    drive.last = pointerAngle(e);
    canvas.style.cursor = 'grabbing';
  },
  true,
);
window.addEventListener('pointermove', (e) => {
  if (!drive.held) {
    if (e.target === canvas) canvas.style.cursor = hitsHandle(e) ? 'grab' : '';
    return;
  }
  const a = pointerAngle(e);
  if (a == null || drive.last == null) {
    drive.last = a;
    return;
  }
  drive.target += unwrap(a - drive.last);
  drive.last = a;
});
window.addEventListener('pointerup', () => {
  if (!drive.held) return;
  drive.held = false;
  controls.enabled = true;
  canvas.style.cursor = '';
});

// ---------- Which way each gear is turning ----------
const tags = [brass, silver, carbon].map((g) => {
  const el = document.createElement('div');
  el.className = 'dir';
  document.body.append(el);
  return { g, el };
});
const _p = V();
function placeTags(omegas) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  tags.forEach(({ g, el }, i) => {
    const om = omegas[i];
    const on = Math.abs(om) > 0.05 && (current === 'train' || current === 'mesh');
    el.classList.toggle('on', on);
    if (!on) return;
    el.textContent = om < 0 ? '↻ clockwise' : '↺ anticlockwise';
    _p.copy(g.group.position).add(V(0, -(g.ra + 0.016), 0.02)).project(camera);
    el.style.transform = `translate(${((_p.x + 1) / 2) * w}px, ${((1 - _p.y) / 2) * h}px) translate(-50%, -50%)`;
  });
}

// ---------- Resize and loop ----------
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
  goTo(current);
});
resize();
camera.position.copy(VIEWS.train.target).add(VIEWS.train.from.clone().sub(VIEWS.train.target).multiplyScalar(camera.aspect < 0.9 ? Math.min(2.4, 1 / camera.aspect) : 1));
controls.target.copy(VIEWS.train.target);
goTo('train');

let alphaFloor = -Infinity;
let lastTooth = null;
let lastCatch = 0;
let crank = 0;
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const prev = drive.theta;

  if (drive.held) {
    // The gear follows your hand with a little weight
    drive.theta += (drive.target - drive.theta) * Math.min(1, dt * 18);
  } else if (auto) {
    drive.theta -= speed * dt;
  } else {
    drive.theta += drive.omega * dt;
    drive.omega *= Math.exp(-2.2 * dt);
  }

  // The ratchet: the pawl's tip sits at a fixed angle; seen from the gear it slides along
  // the teeth. It may climb forward (clockwise) but catches on a tooth's edge going back.
  // alpha: where the pawl tip is, measured on the turning gear; teeth are centered on whole STEPs
  let alpha = PAWL_ANGLE - drive.theta;
  const tooth = Math.floor(alpha / STEP - DROP);
  if (alphaFloor === -Infinity) alphaFloor = (tooth + DROP) * STEP;
  if (alpha < alphaFloor) {
    alpha = alphaFloor + 1e-6;
    drive.theta = PAWL_ANGLE - alpha;
    if (drive.held) drive.target = Math.min(drive.target, drive.theta + 0.05);
    drive.omega = 0;
    if (now - lastCatch > 350 && Math.abs(drive.theta - prev) < 1e-9) {
      feel('catch');
      lastCatch = now;
    }
  }
  const t = Math.floor(alpha / STEP - DROP);
  if (lastTooth !== null && t > lastTooth) {
    feel('ratchet', Math.min(1, 0.5 + Math.abs(drive.omega) * 0.3));
    alphaFloor = (t + DROP) * STEP;
  }
  lastTooth = t;
  // Let go mid-turn and the gears coast on, slowing down
  if (drive.held || auto) drive.omega = (drive.theta - prev) / Math.max(dt, 1e-3);

  // The pawl's tip rests on whatever part of a tooth is under it, never deeper than its rest
  const phi = alpha - Math.round(alpha / STEP) * STEP;
  const lift = (Math.max(R_REST, toothRadius(BRASS_TEETH, M, phi)) - R_REST) / liftPerRadian;
  pawl.rotation.z = pawlBase + lift;
  pawl.updateMatrixWorld();
  updateSpring();

  brass.group.rotation.z = drive.theta;
  knobPivot.rotation.z = -drive.theta - arm.rotation.z;
  const t2 = meshAngle(drive.theta, 48, 24, beta1);
  silver.group.rotation.z = t2;
  carbon.group.rotation.z = meshAngle(t2, 24, 16, beta2);
  const w1 = drive.omega;
  placeTags([w1, (-w1 * 48) / 24, (w1 * 48) / 16]);

  crank -= speed * 0.9 * dt;
  chainring.rotation.z = crank;
  cog.rotation.z = crank * (ringTeeth / cogTeeth);
  chain.offset = -crank * ringR;
  chain.update();

  if (fly) {
    fly.t = Math.min(1, fly.t + dt / 1.1);
    const k = fly.t < 0.5 ? 4 * fly.t ** 3 : 1 - (-2 * fly.t + 2) ** 3 / 2;
    camera.position.lerpVectors(fly.fromPos, fly.toPos, k);
    controls.target.lerpVectors(fly.fromTarget, fly.toTarget, k);
    if (fly.t >= 1) fly = null;
  }
  controls.update();
  composer.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
