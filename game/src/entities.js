// Low-poly articulated figures, arcade cars and world markers. Local car forward is +Z.
import * as THREE from '../three.module.min.js';
import { PALETTE, CAR_COLORS } from './config.js';

const box = (w, h, d, color, emissive = 0) => new THREE.Mesh(
  new THREE.BoxGeometry(w, h, d),
  new THREE.MeshLambertMaterial({ color, flatShading: true, emissive: new THREE.Color(color).multiplyScalar(emissive) }),
);

function limb(w, h, d, color, x, y, z) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  const mesh = box(w, h, d, color);
  mesh.position.y = -h / 2;
  pivot.add(mesh);
  return pivot;
}

function buildFigure({ shirt, pants, skin, hair, scale = 1 }) {
  const root = new THREE.Group();
  const rig = new THREE.Group();
  rig.scale.setScalar(scale);
  root.add(rig);
  const torso = box(0.72, 0.88, 0.38, shirt);
  torso.position.y = 1.32;
  rig.add(torso);
  const hips = box(0.68, 0.28, 0.38, pants);
  hips.position.y = 0.84;
  rig.add(hips);
  const head = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.27, 0),
    new THREE.MeshLambertMaterial({ color: skin, flatShading: true }),
  );
  head.position.y = 2.0;
  rig.add(head);
  const cap = box(0.52, 0.18, 0.5, hair);
  cap.position.y = 2.19;
  rig.add(cap);
  const brim = box(0.48, 0.06, 0.24, hair);
  brim.position.set(0, 2.13, 0.3);
  rig.add(brim);
  const armL = limb(0.2, 0.68, 0.2, shirt, -0.47, 1.67, 0);
  const armR = limb(0.2, 0.68, 0.2, shirt, 0.47, 1.67, 0);
  const handL = box(0.19, 0.2, 0.19, skin);
  handL.position.y = -0.72;
  armL.add(handL);
  const handR = handL.clone();
  armR.add(handR);
  rig.add(armL, armR);
  const legL = limb(0.25, 0.82, 0.26, pants, -0.18, 0.82, 0);
  const legR = limb(0.25, 0.82, 0.26, pants, 0.18, 0.82, 0);
  const shoeL = box(0.27, 0.16, 0.42, 0x232a34);
  shoeL.position.set(0, -0.86, 0.08);
  legL.add(shoeL);
  const shoeR = shoeL.clone();
  legR.add(shoeR);
  rig.add(legL, legR);
  return { root, rig, parts: { armL, armR, legL, legR, torso, head } };
}

export function createPlayer() {
  const fig = buildFigure({ shirt: 0xf2f4ee, pants: 0x294e63, skin: 0xd59b73, hair: 0x33271f, scale: 1 });
  fig.root.name = 'player';
  return fig;
}

export function createPed(rng) {
  const shirts = [0xe86a54, 0x4ea88c, 0xe8c455, 0x8768c9, 0xe7e2d5, 0x3f7fb0, 0xd4779b];
  const pants = [0x313b4c, 0x5a5140, 0x425c50, 0x5e4250];
  const skins = [0xd9a17a, 0x9c684a, 0xf0c49d, 0x75513b];
  const fig = buildFigure({
    shirt: rng.pick(shirts), pants: rng.pick(pants), skin: rng.pick(skins),
    hair: rng.pick([0x2b211b, 0x4b3423, 0x161a20]), scale: rng.range(0.86, 0.98),
  });
  fig.rig.rotation.y = rng.range(0, 6.28);
  return fig;
}

export function animateFigure(fig, t, speed, attacking = 0) {
  const swing = Math.min(1, speed / 5) * 0.75;
  const phase = t * Math.min(13, 4 + speed * 1.3);
  fig.parts.legL.rotation.x = Math.sin(phase) * swing;
  fig.parts.legR.rotation.x = -Math.sin(phase) * swing;
  fig.parts.armL.rotation.x = -Math.sin(phase) * swing * 0.7;
  fig.parts.armR.rotation.x = Math.sin(phase) * swing * 0.7;
  if (attacking > 0) {
    fig.parts.armR.rotation.x = -1.9 * Math.sin(attacking * Math.PI);
    fig.parts.armL.rotation.x = -0.5 * Math.sin(attacking * Math.PI);
  }
  fig.parts.torso.rotation.z = Math.sin(phase) * swing * 0.04;
}

function sirenGlowTexture() {
  if (sirenGlowTexture.cache) return sirenGlowTexture.cache;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.3, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  sirenGlowTexture.cache = new THREE.CanvasTexture(c);
  return sirenGlowTexture.cache;
}

export function createCar(opts = {}) {
  const color = opts.color ?? CAR_COLORS[0];
  const police = !!opts.police;
  const convertible = !!opts.convertible;
  const g = new THREE.Group();
  const bodyColor = police ? 0xf2f3ef : color;
  const body = box(2.15, 0.78, 4.5, bodyColor);
  body.position.y = 0.82;
  g.add(body);
  const nose = box(2.02, 0.36, 1.15, bodyColor);
  nose.position.set(0, 0.62, 1.85);
  g.add(nose);
  const bumper = box(2.2, 0.2, 0.22, 0x303743);
  bumper.position.set(0, 0.55, 2.32);
  g.add(bumper);
  const bumperR = bumper.clone();
  bumperR.position.z = -2.32;
  g.add(bumperR);

  if (!convertible) {
    const cabin = box(1.84, 0.72, 2.15, police ? 0xe8ecef : color);
    cabin.position.set(0, 1.52, -0.25);
    g.add(cabin);
    const glassMat = new THREE.MeshLambertMaterial({ color: 0x9ecad6, transparent: true, opacity: 0.72, flatShading: true });
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 2.02), glassMat);
    glass.position.set(0, 1.55, -0.25);
    g.add(glass);
  } else {
    const frame = box(1.9, 0.1, 0.14, bodyColor);
    frame.position.set(0, 1.93, 0.68);
    g.add(frame);
    const glassMat = new THREE.MeshLambertMaterial({ color: 0x9ecad6, transparent: true, opacity: 0.6 });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.6), glassMat);
    screen.position.set(0, 1.63, 0.7);
    screen.rotation.x = -0.28;
    g.add(screen);
    const seat = box(1.55, 0.42, 0.5, 0x332b2a);
    seat.position.set(0, 1.25, -0.35);
    g.add(seat);
  }

  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x1c2028, flatShading: true });
  const hubMat = new THREE.MeshLambertMaterial({ color: 0xc9ccd0, flatShading: true });
  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.47, 0.47, 0.3, 10);
  const hubGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.32, 8);
  for (const x of [-1.08, 1.08]) {
    for (const z of [-1.48, 1.48]) {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.47, z);
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2;
      pivot.add(w);
      const hub = new THREE.Mesh(hubGeo, hubMat);
      hub.rotation.z = Math.PI / 2;
      pivot.add(hub);
      g.add(pivot);
      wheels.push(pivot);
    }
  }
  const lampMat = new THREE.MeshLambertMaterial({ color: 0xfff2c4, emissive: 0xffd98c, emissiveIntensity: 0.7 });
  const tailMat = new THREE.MeshLambertMaterial({ color: 0xd63a2c, emissive: 0xa51c10, emissiveIntensity: 0.6 });
  for (const x of [-0.72, 0.72]) {
    const lamp = box(0.46, 0.2, 0.1, 0xfff2c4);
    lamp.material = lampMat;
    lamp.position.set(x, 0.92, 2.27);
    g.add(lamp);
    const tail = box(0.46, 0.16, 0.09, 0xd63a2c);
    tail.material = tailMat;
    tail.position.set(x, 0.96, -2.27);
    g.add(tail);
  }

  let lights = null;
  if (police) {
    const blue = box(1.0, 0.28, 0.5, 0x2f72ff, 1.2);
    const red = box(1.0, 0.28, 0.5, 0xff2f3d, 1.2);
    blue.position.set(-0.52, 1.99, -0.2);
    red.position.set(0.52, 1.99, -0.2);
    g.add(blue, red);
    const glowMat = { map: sirenGlowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };
    const redGlow = new THREE.Sprite(new THREE.SpriteMaterial({ ...glowMat, color: 0xff3344, opacity: 0.9 }));
    const blueGlow = new THREE.Sprite(new THREE.SpriteMaterial({ ...glowMat, color: 0x3f7bff, opacity: 0.9 }));
    redGlow.scale.set(4.2, 4.2, 1);
    blueGlow.scale.set(4.2, 4.2, 1);
    redGlow.position.set(0.52, 2.25, -0.2);
    blueGlow.position.set(-0.52, 2.25, -0.2);
    g.add(redGlow, blueGlow);
    const door = box(0.05, 0.5, 1.4, 0x2458b8);
    door.position.set(1.09, 0.93, -0.2);
    g.add(door);
    const door2 = door.clone();
    door2.position.x = -1.09;
    g.add(door2);
    lights = { red, blue, redGlow, blueGlow };
  }
  return { group: g, wheels, lights, body, convertible };
}

export function animateCar(car, speed, dt, steer = 0) {
  for (const w of car.wheels) {
    w.rotation.x += (speed / 0.47) * dt;
    if (w.position.z > 0) w.rotation.y = steer * 0.36;
  }
  if (car.lights) {
    const on = Math.floor(performance.now() / 180) % 2 === 0;
    car.lights.red.material.emissiveIntensity = on ? 2.4 : 0.08;
    car.lights.blue.material.emissiveIntensity = on ? 0.08 : 2.4;
    car.lights.redGlow.material.opacity = on ? 1 : 0.08;
    car.lights.blueGlow.material.opacity = on ? 0.08 : 1;
  }
}

export function createMarker(color = 0xffd54a) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(3.1, 0.24, 6, 28),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.12;
  g.add(ring);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 2.6, 16, 12, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 8;
  g.add(beam);
  const arrow = new THREE.Mesh(
    new THREE.ConeGeometry(1.1, 1.7, 4),
    new THREE.MeshBasicMaterial({ color }),
  );
  arrow.rotation.x = Math.PI;
  arrow.position.y = 5.5;
  g.add(arrow);
  return { group: g, ring, beam, arrow };
}

export function animateMarker(marker, t) {
  marker.ring.rotation.z = t * 0.7;
  marker.arrow.position.y = 5.4 + Math.sin(t * 3) * 0.5;
  marker.beam.material.opacity = 0.11 + Math.sin(t * 2.2) * 0.045;
}

export function createPickup(kind) {
  const color = kind === 'health' ? 0x45d789 : 0xffd447;
  const g = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.62, 0),
    new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.5, flatShading: true }),
  );
  core.position.y = 1.1;
  g.add(core);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1, 0.07, 5, 20),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.65 }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.1;
  g.add(ring);
  return { group: g, core, ring, kind };
}

export function muzzleFlash() {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    color: 0xffe3a0, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  sprite.scale.set(1.5, 1.5, 1);
  sprite.visible = false;
  return sprite;
}

export { PALETTE, CAR_COLORS };
