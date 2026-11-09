// Gear lookbook: realistic brass, silver and black gears in a studio, to settle the look
// before rebuilding the game with them.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { makeGear, meshAngle, finishes, steel } from './gearmaker.js';
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
const plateMat = new THREE.MeshPhysicalMaterial({ color: 0xa4a7ac, metalness: 0.9, roughness: 1, roughnessMap: brushedTexture() });
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

// Steel axle through each gear with a polished dome cap
function axle(x, y, r, len) {
  const a = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 24).rotateX(Math.PI / 2), steel());
  a.position.set(x, y, -0.025 + len / 2);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(r * 1.4, 24, 12, 0, TAU, 0, Math.PI / 2).rotateX(Math.PI / 2), steel());
  cap.position.set(x, y, -0.025 + len);
  for (const m of [a, cap]) m.castShadow = true;
  scene.add(a, cap);
}

// ---------- The gear train: brass, silver and black, all meshing ----------
const M = 0.0032; // tooth size (module), meters
plate(0.42, 0.26, -0.02);
const brass = makeGear({ teeth: 48, module: M, thickness: 0.008, finish: 'brass', web: 'spokes', spokes: 5 });
const silver = makeGear({ teeth: 24, module: M, thickness: 0.009, finish: 'silver', web: 'holes' });
const black = makeGear({ teeth: 16, module: M, thickness: 0.01, finish: 'black', web: 'solid' });
const beta1 = THREE.MathUtils.degToRad(14);
const beta2 = THREE.MathUtils.degToRad(-32);
brass.group.position.set(-0.11, -0.012, 0);
silver.group.position.copy(brass.group.position).add(V(Math.cos(beta1), Math.sin(beta1)).multiplyScalar(((48 + 24) * M) / 2));
black.group.position.copy(silver.group.position).add(V(Math.cos(beta2), Math.sin(beta2)).multiplyScalar(((24 + 16) * M) / 2));
for (const g of [brass, silver, black]) {
  scene.add(g.group);
  axle(g.group.position.x, g.group.position.y, g.bore * 0.95, 0.04);
}

// ---------- Bike gears: silver chainring on a black spider, black rear cog, chain ----------
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
  // Five-arm black spider: a round hub with straight tapered arms out to the chainring bolts
  const arms = 5;
  const spiderMat = finishes.black(0.05);
  const extrude = (shape, depth, z) => {
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.0007, bevelSize: 0.0007, bevelSegments: 2, curveSegments: 32 });
    geo.translate(0, 0, z);
    return new THREE.Mesh(geo, spiderMat);
  };
  const hubShape = new THREE.Shape();
  hubShape.absarc(0, 0, 0.022, 0, TAU, false);
  const bore = new THREE.Path();
  bore.absarc(0, 0, 0.009, 0, TAU, true);
  hubShape.holes.push(bore);
  chainring.add(extrude(hubShape, 0.009, 0.0015));
  for (let i = 0; i < arms; i++) {
    const a = (i / arms) * TAU;
    // Arm along +x from the hub to the bolt, wide at the root and narrower at the rounded tip
    const arm = new THREE.Shape();
    arm.moveTo(0.012, -0.0085);
    arm.lineTo(0.046, -0.0055);
    arm.absarc(0.046, 0, 0.0055, -Math.PI / 2, Math.PI / 2, false);
    arm.lineTo(0.012, 0.0085);
    arm.lineTo(0.012, -0.0085);
    const mesh = extrude(arm, 0.006, 0.0015);
    mesh.rotation.z = a;
    chainring.add(mesh);
  }
  for (let i = 0; i < arms; i++) {
    const a = (i / arms) * TAU;
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.0042, 0.0042, 0.003, 32).rotateX(Math.PI / 2), steel());
    bolt.position.set(0.046 * Math.cos(a), 0.046 * Math.sin(a), 0.0095);
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.0009, 0.0008), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    slot.position.set(bolt.position.x, bolt.position.y, 0.0112);
    slot.rotation.z = a;
    chainring.add(bolt, slot);
  }
}
chainring.position.copy(ringPos);
const cog = new THREE.Group();
{
  const { geo } = sprocketGeometry(cogTeeth, { holes: 6, bore: 0.008, thickness: 0.003 });
  cog.add(new THREE.Mesh(geo, finishes.black(cogR + 0.005)));
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
axle(ringPos.x, ringPos.y, 0.009, 0.045);
axle(cogPos.x, cogPos.y, 0.006, 0.04);

const chainMat = new THREE.MeshPhysicalMaterial({ color: 0x4f535a, metalness: 1, roughness: 0.3 });
const chainPath = new ChainPath({ x: cogPos.x, y: cogPos.y }, cogR, { x: ringPos.x, y: ringPos.y }, ringR);
const chain = new ChainLoop(chainMat);
chain.setPath(chainPath);
chain.group.position.z = ringPos.z;
scene.add(chain.group);

// ---------- Views ----------
const VIEWS = {
  train: {
    label: 'Gear train',
    note: 'Brass, silver and black gears turning together on a brushed aluminium plate.',
    target: V(-0.02, 0, 0),
    from: V(0.06, 0.07, 0.62),
  },
  brass: {
    label: 'Brass',
    note: 'Satin brass, 48 teeth, five spokes. Fine lathe rings catch the light as it turns.',
    target: brass.group.position.clone(),
    from: V(0.03, 0.09, 0.27),
  },
  silver: {
    label: 'Silver',
    note: 'Polished steel, 24 teeth, six drilled lightening holes and a keyed hub.',
    target: silver.group.position.clone(),
    from: V(0.06, 0.05, 0.16),
  },
  black: {
    label: 'Black',
    note: 'Black anodized, 16 teeth, with a set screw in the hub and machined edges.',
    target: black.group.position.clone(),
    from: V(0.08, 0.04, 0.13),
  },
  bike: {
    label: 'Bike gears',
    note: 'A real bike drivetrain: silver 32-tooth chainring on a black spider, black 16-tooth cog, steel chain.',
    target: V(BIKE_X, 0, 0),
    from: V(BIKE_X + 0.02, 0.1, 0.86),
  },
};

let fly = null;
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
let current = 'train';

const bar = $('views');
for (const [name, v] of Object.entries(VIEWS)) {
  const b = document.createElement('button');
  b.textContent = v.label;
  b.dataset.view = name;
  b.onclick = () => goTo(name);
  bar.append(b);
}

let speed = 0.35;
let playing = true;
$('play').onclick = () => {
  playing = !playing;
  $('play').textContent = playing ? 'Pause' : 'Play';
};
$('speed').oninput = (e) => (speed = parseFloat(e.target.value));

// ---------- Resize and loop ----------
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
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

let theta = 0;
let crank = 0;
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (playing) {
    theta -= speed * dt;
    crank -= speed * 0.9 * dt;
  }
  brass.group.rotation.z = theta;
  const t2 = meshAngle(theta, 48, 24, beta1);
  silver.group.rotation.z = t2;
  black.group.rotation.z = meshAngle(t2, 24, 16, beta2);
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
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
