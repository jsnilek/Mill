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
camera.position.set(7.6, 6.6, 10.6); // pulled back a little so the refill bag stays in frame

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 3.7, 0);
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
const beanMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.05, vertexColors: true });
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

// One coffee bean: ellipsoid (long axis x, flat side up +y) with a carved center crease.
function makeBeanGeometry() {
  const geo = new THREE.SphereGeometry(1, 36, 24);
  const A = 0.15, B = 0.095, C = 0.065; // half length, half width (z), half thickness (y)
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    let y = pos.getY(i);
    // crease: pull the upper surface down near z = 0, fading out toward the bean tips
    const g = Math.exp(-Math.pow(z / 0.16, 2));
    const tip = Math.max(0, 1 - Math.pow(Math.abs(x), 3));
    const pull = y > 0 ? 0.8 * g * tip : 0;
    if (y > 0) y *= 1 - pull;
    const wob = y > 0 ? Math.sin(x * 3.2) * 0.012 * g : 0; // slight S-curve of the slit
    pos.setXYZ(i, x * A, y * C, z * B + wob);
    const dark = 1 - 0.65 * pull; // darker inside the crease
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = dark;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

// Beans as one InstancedMesh packed inside the hopper's cone.
function buildBeans(count = 560) {
  const beans = new THREE.Group();
  const geo = makeBeanGeometry();
  const mesh = new THREE.InstancedMesh(geo, beanMat, count);
  mesh.castShadow = true;
  const yBottom = BODY_TOP + 0.45, yTop = BODY_TOP + 0.3 + 1.8;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const dark = new THREE.Color(0x2a140a), mid = new THREE.Color(0x6b3d20), c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const y = yBottom + Math.random() * (yTop - yBottom);
    const f = (y - (BODY_TOP + 0.3)) / 2.3;
    const rMax = 1.2 + (1.9 - 1.2) * f - 0.2; // follow cone radius
    const r = Math.sqrt(Math.random()) * Math.max(rMax, 0.1);
    const a = Math.random() * Math.PI * 2;
    e.set(Math.random() * 6.283, Math.random() * 6.283, Math.random() * 6.283);
    q.setFromEuler(e);
    const sz = 0.85 + Math.random() * 0.4;
    m.compose(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r), q,
      new THREE.Vector3(sz * (0.95 + Math.random() * 0.1), sz, sz));
    mesh.setMatrixAt(i, m);
    c.copy(dark).lerp(mid, Math.random());
    mesh.setColorAt(i, c);
  }
  mesh.instanceColor.needsUpdate = true;
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

// ---------- Coffee bag (procedural, shown only during Refill) ----------
function makeBagTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#a77b4f'; g.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 900; i++) { // paper grain
    g.fillStyle = `rgba(${60 + Math.random() * 60 | 0},40,20,${Math.random() * 0.08})`;
    g.fillRect(Math.random() * 256, Math.random() * 512, 1 + Math.random() * 14, 1);
  }
  g.fillStyle = '#2a1a10'; g.fillRect(0, 190, 256, 170); // dark label band
  g.fillStyle = '#f1e3c8'; g.font = 'bold 54px Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('COFFEE', 128, 250);
  g.font = '22px Arial, sans-serif'; g.fillText('ARABICA  BEANS', 128, 305);
  g.fillStyle = '#6b3d20'; g.beginPath(); g.ellipse(128, 410, 34, 22, -0.5, 0, 6.283); g.fill();
  g.strokeStyle = '#d9c4a0'; g.lineWidth = 3; g.beginPath(); g.moveTo(104, 423); g.quadraticCurveTo(128, 400, 152, 397); g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
// Pivot sits at the bag mouth (local origin); the bag hangs below it when upright.
function buildBag() {
  const pivot = new THREE.Group();
  const H = 1.7, NECK = 0.25;
  const paper = new THREE.MeshStandardMaterial({ map: makeBagTexture(), roughness: 0.9, side: THREE.DoubleSide });
  const geo = new THREE.BoxGeometry(1.1, H, 0.62, 10, 16, 4);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i); const y = pos.getY(i); let z = pos.getZ(i);
    const t = (y + H / 2) / H; // 0 bottom .. 1 top
    const pinch = Math.min(1, Math.max(0, (t - 0.65) / 0.35));
    const ps = pinch * pinch * (3 - 2 * pinch);
    const pillow = 0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, t * 1.05 + 0.05)); // bulge mid-height
    x *= (1 - 0.08 * t) * (1 - 0.64 * ps);
    z *= pillow * (1 - 0.6 * ps);
    z += Math.sin(x * 9 + y * 4) * 0.015 * (0.3 + t); // crinkles
    x += Math.sin(y * 13 + z * 5) * 0.012;
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  const bodyMesh = new THREE.Mesh(geo, paper);
  bodyMesh.position.y = -NECK - H / 2 + 0.02;
  bodyMesh.castShadow = true;
  pivot.add(bodyMesh);
  // open neck with a crinkled folded rim
  const neckGeo = new THREE.CylinderGeometry(0.27, 0.22, NECK + 0.05, 20, 4, true);
  const np = neckGeo.attributes.position;
  for (let i = 0; i < np.count; i++) {
    const a = Math.atan2(np.getZ(i), np.getX(i));
    const k = 1 + 0.12 * Math.sin(a * 7 + np.getY(i) * 20) * (np.getY(i) > 0 ? 1 : 0.3);
    np.setX(i, np.getX(i) * k); np.setZ(i, np.getZ(i) * k * 0.8);
  }
  neckGeo.computeVertexNormals();
  const neck = new THREE.Mesh(neckGeo, new THREE.MeshStandardMaterial({ color: 0x9a7048, roughness: 0.95, side: THREE.DoubleSide }));
  neck.position.y = -NECK / 2 + 0.02;
  neck.castShadow = true;
  pivot.add(neck);
  const fold = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.035, 8, 24), new THREE.MeshStandardMaterial({ color: 0x8a6240, roughness: 1 }));
  fold.rotation.x = Math.PI / 2; fold.scale.set(1, 0.8, 1);
  pivot.add(fold);
  pivot.visible = false;
  return pivot;
}
const bag = buildBag();
scene.add(bag);
const BAG_AWAY = new THREE.Vector3(5.0, 8.2, 0.6);
const BAG_HOVER = new THREE.Vector3(1.0, 6.4, 0);
const BAG_POUR = new THREE.Vector3(0.45, 5.95, 0); // mouth position while pouring
const mouthPos = new THREE.Vector3();
// Choreography timeline (seconds): enter, tilt, pour, tilt back, leave (ends at REFILL_TIME).
const T_ENTER = 0.7, T_TILT = 1.15, T_POUR_END = 2.1, T_BACK = 2.65;
const POUR_ANGLE = 2.2;
const seg = (t, a, b) => ease(Math.min(1, Math.max(0, (t - a) / (b - a))));
function updateBag(t) {
  const e = seg(t, 0, T_ENTER), tl = seg(t, T_ENTER, T_TILT), bk = seg(t, T_POUR_END, T_BACK), lv = seg(t, T_BACK, REFILL_TIME);
  const pr = Math.min(1, Math.max(0, (t - T_TILT) / (T_POUR_END - T_TILT)));
  bag.visible = true;
  if (t < T_ENTER) bag.position.lerpVectors(BAG_AWAY, BAG_HOVER, e);
  else if (t < T_POUR_END) bag.position.lerpVectors(BAG_HOVER, BAG_POUR, tl);
  else if (t < T_BACK) bag.position.lerpVectors(BAG_POUR, BAG_HOVER, bk);
  else bag.position.lerpVectors(BAG_HOVER, BAG_AWAY, lv);
  if (t < T_POUR_END) bag.rotation.z = POUR_ANGLE * tl + 0.3 * pr + (pr > 0 ? 0.03 * Math.sin(t * 25) : 0);
  else bag.rotation.z = (POUR_ANGLE + 0.3) * (1 - bk);
  bag.scale.setScalar(t < T_ENTER ? 0.3 + 0.7 * e : 1 - 0.7 * lv);
  mouthPos.copy(bag.position);
}
function hideBag() { bag.visible = false; }

// ---------- UI ----------
const grindBtn = document.getElementById('grind');
const refillBtn = document.getElementById('refill');
const statusEl = document.getElementById('status');

// ---------- Simulation state ----------
const GRIND_TIME = 3, REFILL_TIME = 3.2, GRIND_AMOUNT = 0.2, MAX_SPIN = 14; // rad/s
const GROUNDS_FADE = 0.3, GROUNDS_PER_GRIND = 0.6; // old grounds fade time (s); bin fill of a full grind
const state = {
  mode: 'idle',        // 'idle' | 'grinding' | 'refilling'
  t: 0,                // time within current action
  beansLevel: 1,
  groundsLevel: 0,
  from: 0, delta: 0,   // beans level at action start / change over the action
  groundsFrom: 0, groundsTarget: 0,
  spin: 0,             // current ring angle
};
const ease = x => x * x * (3 - 2 * x);

// Bean pile: remember each bean's original matrix + relative height (0 bottom .. 1 top).
const beanMesh = grinder.beans.userData.mesh;
// Each bean: rest rank height h (0 bottom .. 1 top; negative = consumed), radial fraction u of the
// cone radius, angle, and a current height y that eases toward its target (per-bean lag).
const Y_BOT = BODY_TOP + 0.45, Y_TOP = BODY_TOP + 0.3 + 1.8, SPAN = Y_TOP - Y_BOT;
const coneLimit = y => { // allowed bean-center radius at height y (hopper cone minus bean size)
  const f = Math.min(1, Math.max(0, (y - (BODY_TOP + 0.3)) / 2.3));
  return Math.max(1.2 + 0.7 * f - 0.2, 0.1);
};
const beanBase = [];
{
  const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  for (let i = 0; i < beanMesh.count; i++) {
    beanMesh.getMatrixAt(i, m);
    m.decompose(p, q, s);
    const h = (p.y - Y_BOT) / SPAN;
    beanBase.push({
      q0: q.clone(), s: s.clone(), h, h0: h, gone: false,
      u: Math.min(1, Math.hypot(p.x, p.z) / coneLimit(p.y)), ang: Math.atan2(p.z, p.x),
      y: p.y, tgt: p.y, k: 5 + Math.random() * 6, wait: 0, vel: 0, falling: false,
      axis: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
      omega: (Math.random() < 0.5 ? -1 : 1) * (1 + Math.random() * 1.5),
      ph: Math.random() * 6.283, stream: false, sx: 0, sz: 0, sy: 0,
    });
  }
}
const _m = new THREE.Matrix4(), _s = new THREE.Vector3(), _p = new THREE.Vector3(),
  _q = new THREE.Quaternion(), _qa = new THREE.Quaternion();
let beansMoving = false;
// Advance bean motion. off = pile lowering (in h units) during a grind; always rewrites matrices.
function stepBeans(dt, off = 0) {
  let moving = false;
  for (let i = 0; i < beanBase.length; i++) {
    const b = beanBase[i];
    let scale = 1;
    b.tgt = Y_BOT + Math.max(b.h - off, -0.2) * SPAN;
    if (b.wait > 0) { // refill bean still waiting above the hopper
      b.wait -= dt; moving = true; scale = 0;
      if (b.wait <= 0) { // leaves the bag mouth now
        b.stream = true; b.y = mouthPos.y - Math.random() * 0.1; b.vel = 0.5 + Math.random();
        b.sx = mouthPos.x + (Math.random() - 0.5) * 0.18; b.sz = mouthPos.z + (Math.random() - 0.5) * 0.18;
      }
    } else if (b.falling) {
      b.vel += 9 * dt; b.y -= b.vel * dt; moving = true;
      if (b.y <= b.tgt) { b.y = b.tgt; b.falling = false; b.vel = 0; b.stream = false; }
    } else {
      const d = b.tgt - b.y;
      if (Math.abs(d) > 5e-4) { b.y += d * (1 - Math.exp(-b.k * dt)); moving = true; }
      else b.y = b.tgt;
    }
    const y = b.y;
    if (b.wait > 0 || (b.gone && y <= Y_BOT - 0.3)) scale = 0;
    else scale = Math.min(1, Math.max(0, (y - (Y_BOT - 0.3)) / 0.3)); // vanish into the burrs
    // radius: fraction of the cone radius at this height; squeezed toward the center at the burr opening
    const sq = Math.min(1, Math.max(0, (y - (Y_BOT - 0.3)) / 0.7));
    const lim = coneLimit(y);
    const r0 = b.u * lim * (0.25 + 0.75 * sq * sq * (3 - 2 * sq));
    let x = Math.cos(b.ang) * r0 + Math.sin(y * 13 + b.ph) * 0.035;
    let z = Math.sin(b.ang) * r0 + Math.cos(y * 11 + b.ph) * 0.035;
    const rr = Math.hypot(x, z);
    if (rr > lim) { x *= lim / rr; z *= lim / rr; }
    if (b.stream) { // still in the stream from the bag mouth: blend into the pile column inside the hopper
      const w = Math.min(1, Math.max(0, (BODY_TOP + 2.6 - y) / 1.0)), w2 = w * w * (3 - 2 * w);
      x = b.sx + (x - b.sx) * w2;
      z = b.sz + (z - b.sz) * w2;
    }
    _qa.setFromAxisAngle(b.axis, y * b.omega);
    _q.copy(b.q0).multiply(_qa);
    _s.copy(b.s).multiplyScalar(Math.max(scale, 1e-5));
    _m.compose(_p.set(x, y, z), _q, _s);
    beanMesh.setMatrixAt(i, _m);
  }
  beanMesh.instanceMatrix.needsUpdate = true;
  beansMoving = moving;
}
function snapBeans() { // jump to rest state
  for (const b of beanBase) { b.y = Y_BOT + Math.max(b.h, -0.2) * SPAN; b.wait = 0; b.falling = false; b.stream = false; }
  stepBeans(0);
}
function beginGrindBeans() { for (const b of beanBase) b.h0 = b.h; }
function endGrindBeans(delta) {
  for (const b of beanBase) { b.h -= delta; if (b.h < 0) b.gone = true; }
}
// Consumed beans re-enter above the hopper and fall into slots on top of the remaining pile.
function beginRefillBeans() {
  let top = 0, n = 0;
  for (const b of beanBase) { if (b.gone) n++; else top = Math.max(top, b.h); }
  let j = 0;
  for (const b of beanBase) {
    if (!b.gone) continue;
    b.h = top + ((j + 0.5) / n) * (1 - top);
    b.gone = false;
    const slotY = Y_BOT + b.h * SPAN;
    b.y = Math.max(slotY, Y_TOP) + 0.4 + Math.random() * 1.0;
    b.wait = T_TILT + 0.08 + (j / n) * (T_POUR_END - T_TILT - 0.15) + Math.random() * 0.05;
    b.falling = true; b.vel = 0;
    j++;
  }
}
function applyGroundsLevel(level, radial = 1) {
  grinder.groundsMesh.scale.set(radial, Math.max(level * grinder.groundsMaxHeight, 0.0001), radial);
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
  if (state.mode !== 'idle') return;
  state.mode = 'grinding'; state.t = 0;
  state.from = Math.max(0, state.beansLevel);
  state.groundsFrom = state.groundsLevel; // old grounds, cleared at the start of this grind
  state.delta = Math.min(GRIND_AMOUNT, state.from); // only what is available; 0 when empty
  if (state.delta < 0.0005) state.delta = 0;
  state.groundsTarget = GROUNDS_PER_GRIND * state.delta / GRIND_AMOUNT;
  beginGrindBeans();
  particles.visible = state.delta > 0;
  refreshUI();
}
function startRefill() {
  if (state.mode !== 'idle' || state.beansLevel >= 1) return;
  state.mode = 'refilling'; state.t = 0;
  state.from = state.beansLevel;
  state.delta = 1 - state.beansLevel;
  beginRefillBeans();
  refreshUI();
}

function refreshUI() {
  const idle = state.mode === 'idle';
  const empty = state.beansLevel <= 0.0005;
  grindBtn.disabled = !idle;
  refillBtn.disabled = !idle || state.beansLevel >= 1;
  statusEl.textContent =
    state.mode === 'grinding' ? 'Grinding…' :
    state.mode === 'refilling' ? 'Refilling…' :
    empty ? (state.groundsLevel > 0 ? 'Grounds ready – hopper empty, refill or grind empty' : 'Hopper empty – refill or grind empty') :
    state.groundsLevel > 0 ? 'Grounds ready – grind again to replace' : 'Ready';
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
    stepBeans(dt, state.delta * prog);
    if (state.t < GROUNDS_FADE) { // old grounds vanish quickly
      const f = ease(state.t / GROUNDS_FADE);
      state.groundsLevel = state.groundsFrom * (1 - f);
      applyGroundsLevel(state.groundsLevel, 1 - 0.3 * f);
    } else { // new grounds rise from empty
      const r = ease(Math.min(1, (state.t - GROUNDS_FADE) / (GRIND_TIME - GROUNDS_FADE)));
      state.groundsLevel = state.groundsTarget * r;
      applyGroundsLevel(state.groundsLevel);
    }
    if (state.delta > 0) updateParticles(time);
    if (p >= 1) {
      state.mode = 'idle';
      state.beansLevel = Math.max(0, state.from - state.delta);
      endGrindBeans(state.delta);
      state.groundsLevel = state.groundsTarget;
      applyGroundsLevel(state.groundsLevel);
      particles.visible = false;
      refreshUI();
    }
  } else if (state.mode === 'refilling') {
    state.t += dt;
    const p = Math.min(state.t / REFILL_TIME, 1);
    state.beansLevel = state.from + state.delta * ease(p);
    updateBag(state.t);
    stepBeans(dt);
    if (p >= 1) { hideBag(); state.mode = 'idle'; state.beansLevel = 1; refreshUI(); }
  } else if (beansMoving) {
    stepBeans(dt); // let beans finish settling after the action ends
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
snapBeans();
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
