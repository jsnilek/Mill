import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ---------- Scene setup ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe9e6e1);

const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
camera.position.set(5.5, 4.5, 7.5);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 2.2, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 4;
controls.maxDistance = 20;
controls.maxPolarAngle = Math.PI * 0.495;
controls.update();

// ---------- Lights & floor ----------
function buildLights() {
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8b0a5, 1.0));
  const sun = new THREE.DirectionalLight(0xfff3e0, 2.0);
  sun.position.set(5, 10, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 });
  sun.shadow.radius = 4;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xdde8ff, 0.6);
  fill.position.set(-6, 4, -4);
  scene.add(fill);
}

function buildFloor() {
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(14, 64),
    new THREE.MeshStandardMaterial({ color: 0xd8d4cd, roughness: 0.95 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
}

// ---------- Materials ----------
const glassMat = new THREE.MeshPhysicalMaterial({
  color: 0xcfe6f0, transparent: true, opacity: 0.28, roughness: 0.05,
  metalness: 0, side: THREE.DoubleSide, depthWrite: false,
});
const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2f2f33, roughness: 0.45, metalness: 0.4 });
const metalMat = new THREE.MeshStandardMaterial({ color: 0xb5b8bd, roughness: 0.3, metalness: 0.9 });
const beanMat = new THREE.MeshStandardMaterial({ color: 0x4a2a14, roughness: 0.6 });
const groundsMat = new THREE.MeshStandardMaterial({ color: 0x2b1a10, roughness: 1 });

// ---------- Parts ----------
// Dimensions (y up): base 0-0.4, body 0.4-3.0, hopper 3.0-5.2, bin sits at y 0.4 in front.
const BODY_TOP = 3.0;

function buildBase() {
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.1, 0.4, 48), bodyMat);
  base.position.y = 0.2;
  base.castShadow = base.receiveShadow = true;
  return base;
}

function buildBody() {
  const body = new THREE.Group();
  const column = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.6, 2.6, 48), bodyMat);
  column.position.y = 0.4 + 1.3;
  column.castShadow = column.receiveShadow = true;
  body.add(column);
  // Decorative band
  const band = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.05, 12, 64), metalMat);
  band.rotation.x = Math.PI / 2;
  band.position.y = 1.0;
  body.add(band);
  return body;
}

// Visible burr section: a metal collar with a toothed ring that can be spun.
function buildBurrs() {
  const burrs = new THREE.Group();
  burrs.position.y = BODY_TOP + 0.15;
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.3, 48), metalMat);
  collar.castShadow = true;
  burrs.add(collar);
  const ring = new THREE.Group(); // spinnable ring of teeth
  const toothGeo = new THREE.BoxGeometry(0.12, 0.2, 0.28);
  const n = 24;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const t = new THREE.Mesh(toothGeo, metalMat);
    t.position.set(Math.cos(a) * 1.2, 0.2, Math.sin(a) * 1.2);
    t.rotation.y = -a;
    ring.add(t);
  }
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.08, 48), bodyMat);
  disc.position.y = 0.16;
  ring.add(disc);
  burrs.add(ring);
  burrs.userData.ring = ring;
  return burrs;
}

function buildHopper() {
  const hopper = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.2, 2.3, 48, 1, true), glassMat);
  shell.position.y = BODY_TOP + 0.3 + 1.15;
  shell.renderOrder = 2;
  hopper.add(shell);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.06, 12, 64), metalMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = BODY_TOP + 0.3 + 2.3;
  hopper.add(rim);
  return hopper;
}

// Beans as one InstancedMesh packed inside the hopper's cone.
function buildBeans(count = 450) {
  const beans = new THREE.Group();
  const geo = new THREE.SphereGeometry(0.12, 12, 8);
  geo.scale(1, 0.65, 0.75);
  const mesh = new THREE.InstancedMesh(geo, beanMat, count);
  mesh.castShadow = true;
  const yBottom = BODY_TOP + 0.45, yTop = BODY_TOP + 0.3 + 1.8;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < count; i++) {
    const y = yBottom + Math.random() * (yTop - yBottom);
    const f = (y - (BODY_TOP + 0.3)) / 2.3;
    const rMax = 1.2 + (1.9 - 1.2) * f - 0.2; // follow cone radius
    const r = Math.sqrt(Math.random()) * Math.max(rMax, 0.1);
    const a = Math.random() * Math.PI * 2;
    e.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r), q, new THREE.Vector3(1, 1, 1));
    mesh.setMatrixAt(i, m);
  }
  beans.add(mesh);
  beans.userData.mesh = mesh;
  return beans;
}

function buildChute() {
  const chute = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.6, 24), metalMat);
  // angled spout from the body toward the bin at the front (+z)
  chute.position.set(0, 2.5, 1.6);
  chute.rotation.x = -Math.PI / 5;
  chute.castShadow = true;
  return chute;
}

// Transparent bin/cup in front of the body, with a ground-coffee cylinder inside.
function buildBin() {
  const bin = new THREE.Group();
  bin.position.set(0, 0.4, 2.6);
  const H = 1.6, R = 0.8;
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.8, H, 40, 1, true), glassMat);
  cup.position.y = H / 2;
  cup.renderOrder = 2;
  bin.add(cup);
  const bottom = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.8, R * 0.8, 0.05, 40), glassMat);
  bottom.position.y = 0.025;
  bin.add(bottom);

  // Unit-height cylinder with origin at its base so scale.y = fill height.
  const geo = new THREE.CylinderGeometry(R * 0.78, R * 0.78, 1, 40);
  geo.translate(0, 0.5, 0);
  const grounds = new THREE.Mesh(geo, groundsMat);
  grounds.position.y = 0.05;
  grounds.scale.y = 0.0001; // empty initially (set to ~H*0.9 max)
  grounds.castShadow = true;
  bin.add(grounds);
  bin.userData = { grounds, maxHeight: H * 0.85 };
  return bin;
}

// ---------- Assemble ----------
const grinder = new THREE.Group();
const base = buildBase();
const body = buildBody();
const burrs = buildBurrs();
const hopper = buildHopper();
const beans = buildBeans();
const chute = buildChute();
const bin = buildBin();
grinder.add(base, body, burrs, hopper, beans, chute, bin);
grinder.traverse(o => { if (o.isMesh && o.material !== glassMat) o.receiveShadow = true; });

// Handles for task 2 animations
Object.assign(grinder, {
  parts: { base, body, hopper, chute, bin },
  burrs,                          // group; burrs.userData.ring is the spinnable ring
  beans,                          // group; beans.userData.mesh is the InstancedMesh
  groundsMesh: bin.userData.grounds, // scale.y = fill height (0..groundsMaxHeight)
  groundsMaxHeight: bin.userData.maxHeight,
});

buildLights();
buildFloor();
scene.add(grinder);
window.grinder = grinder; // convenient for console / task 2

// ---------- UI ----------
const grindBtn = document.getElementById('grind');
const refillBtn = document.getElementById('refill');
const statusEl = document.getElementById('status');

// ---------- Simulation state ----------
const GRIND_TIME = 3, REFILL_TIME = 1.5, GRIND_AMOUNT = 0.2, MAX_SPIN = 14; // rad/s
const state = {
  mode: 'idle',        // 'idle' | 'grinding' | 'refilling'
  t: 0,                // time within current action
  beansLevel: 1,
  groundsLevel: 0,
  from: 0, delta: 0,   // beans level at action start / change over the action
  groundsFrom: 0,
  spin: 0,             // current ring angle
};
const ease = x => x * x * (3 - 2 * x);

// Bean pile: remember each bean's original matrix + relative height (0 bottom .. 1 top).
const beanMesh = grinder.beans.userData.mesh;
const beanBase = [];
{
  const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < beanMesh.count; i++) {
    beanMesh.getMatrixAt(i, m);
    m.decompose(p, q, s);
    beanBase.push({ p: p.clone(), q: q.clone(), h: 0 });
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  for (const b of beanBase) b.h = (b.p.y - minY) / (maxY - minY);
}
const _m = new THREE.Matrix4(), _s = new THREE.Vector3();
// Hide beans above the level; beans near the surface shrink out so the pile lowers smoothly.
function applyBeansLevel(level) {
  const soft = 0.04;
  for (let i = 0; i < beanBase.length; i++) {
    const b = beanBase[i];
    const k = level <= 0 ? 0 : Math.min(1, Math.max(0, (level * (1 + soft) - b.h) / soft));
    _s.setScalar(Math.max(k, 1e-5));
    _m.compose(b.p, b.q, _s);
    beanMesh.setMatrixAt(i, _m);
  }
  beanMesh.instanceMatrix.needsUpdate = true;
}
function applyGroundsLevel(level) {
  grinder.groundsMesh.scale.y = Math.max(level * grinder.groundsMaxHeight, 0.0001);
}

// Falling ground particles through the chute (cheap Points, shown only while grinding).
const PN = 40;
const pPos = new Float32Array(PN * 3), pSeed = new Float32Array(PN);
for (let i = 0; i < PN; i++) pSeed[i] = Math.random();
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0x2b1a10, size: 0.07 }));
particles.frustumCulled = false;
particles.visible = false;
grinder.add(particles);
function updateParticles(time) {
  const top = 2.0, x0 = 0, z0 = 2.25;
  const bottom = 0.45 + state.groundsLevel * grinder.groundsMaxHeight;
  for (let i = 0; i < PN; i++) {
    const f = (time * 1.6 + pSeed[i] * 7.3) % 1;
    pPos[i * 3] = x0 + (pSeed[(i + 3) % PN] - 0.5) * 0.25;
    pPos[i * 3 + 1] = top - f * f * (top - bottom);
    pPos[i * 3 + 2] = z0 + (pSeed[(i + 7) % PN] - 0.5) * 0.25;
  }
  pGeo.attributes.position.needsUpdate = true;
}

function startGrind() {
  if (state.mode !== 'idle' || state.beansLevel <= 0 || state.groundsLevel >= 1) return;
  state.mode = 'grinding'; state.t = 0;
  state.from = state.beansLevel;
  state.groundsFrom = state.groundsLevel;
  state.delta = Math.min(GRIND_AMOUNT, state.beansLevel, 1 - state.groundsLevel);
  particles.visible = true;
  refreshUI();
}
function startRefill() {
  if (state.mode !== 'idle' || state.beansLevel >= 1) return;
  state.mode = 'refilling'; state.t = 0;
  state.from = state.beansLevel;
  state.delta = 1 - state.beansLevel;
  refreshUI();
}

function refreshUI() {
  const idle = state.mode === 'idle';
  const empty = state.beansLevel <= 0.0005, full = state.groundsLevel >= 0.9995;
  grindBtn.disabled = !idle || empty || full;
  refillBtn.disabled = !idle || state.beansLevel >= 1;
  statusEl.textContent =
    state.mode === 'grinding' ? 'Grinding…' :
    state.mode === 'refilling' ? 'Refilling…' :
    full ? 'Bin full' :
    empty ? 'Hopper empty – refill' : 'Ready';
}

function update(dt, time) {
  let spinSpeed = 0, shake = 0;
  if (state.mode === 'grinding') {
    state.t += dt;
    const p = Math.min(state.t / GRIND_TIME, 1);
    const env = ease(Math.min(1, p / 0.2, (1 - p) / 0.2)); // ease in / out
    spinSpeed = MAX_SPIN * env;
    shake = env;
    const prog = ease(p);
    state.beansLevel = state.from - state.delta * prog;
    state.groundsLevel = state.groundsFrom + state.delta * prog;
    applyBeansLevel(state.beansLevel);
    applyGroundsLevel(state.groundsLevel);
    updateParticles(time);
    if (p >= 1) {
      state.mode = 'idle';
      state.beansLevel = Math.max(0, state.from - state.delta);
      state.groundsLevel = Math.min(1, state.groundsFrom + state.delta);
      particles.visible = false;
      refreshUI();
    }
  } else if (state.mode === 'refilling') {
    state.t += dt;
    const p = Math.min(state.t / REFILL_TIME, 1);
    state.beansLevel = state.from + state.delta * ease(p);
    applyBeansLevel(state.beansLevel);
    if (p >= 1) { state.mode = 'idle'; state.beansLevel = 1; refreshUI(); }
  }
  state.spin += spinSpeed * dt;
  grinder.burrs.userData.ring.rotation.y = state.spin;
  // tiny vibration of the whole machine
  grinder.position.x = shake * 0.012 * Math.sin(time * 70);
  grinder.position.z = shake * 0.012 * Math.cos(time * 83);
  grinder.rotation.z = shake * 0.003 * Math.sin(time * 61);
}

grindBtn.addEventListener('click', startGrind);
refillBtn.addEventListener('click', startRefill);
applyBeansLevel(state.beansLevel);
applyGroundsLevel(state.groundsLevel);
refreshUI();
const clock = new THREE.Clock();

// ---------- Resize & loop ----------
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  update(dt, clock.elapsedTime);
  controls.update();
  renderer.render(scene, camera);
});
