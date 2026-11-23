// Low-poly actors: articulated people, arcade cars with rolling wheels and police lights,
// mission markers and pickups. All geometry is created here, in code.
import * as THREE from 'three';
import { PALETTE, clamp } from './config.js';

const shadowGeo = new THREE.CircleGeometry(1, 16);
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x1b2230, transparent: true, opacity: 0.26, depthWrite: false });

export function contactShadow(scale = 1) {
  const m = new THREE.Mesh(shadowGeo, shadowMat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.045;
  m.scale.setScalar(scale);
  return m;
}

export function makePerson(rng, opts = {}) {
  const group = new THREE.Group();
  const skin = new THREE.Color(opts.skin ?? rng.pick(PALETTE.skin));
  const shirt = new THREE.Color(opts.shirt ?? rng.pick(PALETTE.clothes));
  const pants = new THREE.Color(opts.pants ?? rng.pick([0x26324a, 0x42474f, 0x6b5c4a, 0x8b8f96]));
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.36), mat(shirt));
  torso.position.y = 1.17;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), mat(skin));
  head.position.y = 1.76;
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.27, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(rng.pick([0x201a19, 0x4a2f1d, 0x7a5733, 0x111318])));
  hair.position.y = 1.79;
  const arm = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.4, 1.47, 0);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.68, 0.19), mat(skin));
    m.position.y = -0.34;
    pivot.add(m);
    group.add(pivot);
    return pivot;
  };
  const leg = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.17, 0.8, 0);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.76, 0.24), mat(pants));
    m.position.y = -0.38;
    pivot.add(m);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.14, 0.4), mat(0x23262b));
    shoe.position.set(0, -0.76, 0.08);
    pivot.add(shoe);
    group.add(pivot);
    return pivot;
  };
  group.add(torso, head, hair, contactShadow(0.55));
  const parts = { armL: arm(-1), armR: arm(1), legL: leg(-1), legR: leg(1), torso, head };
  let phase = rng.float(0, 6);
  let punch = 0;
  function animate(dt, speed, facing) {
    if (facing !== undefined) group.rotation.y = facing;
    phase += dt * clamp(speed, 0, 14) * 1.7;
    const amp = clamp(speed / 5, 0, 1);
    const s = Math.sin(phase) * amp;
    parts.legL.rotation.x = s * 0.75;
    parts.legR.rotation.x = -s * 0.75;
    parts.armL.rotation.x = -s * 0.6;
    parts.armR.rotation.x = s * 0.6;
    punch = Math.max(0, punch - dt * 4.5);
    if (punch > 0) parts.armR.rotation.x = -1.7 * punch;
    group.position.y = Math.abs(Math.sin(phase)) * 0.045 * amp;
  }
  return {
    group, parts,
    animate,
    strike() { punch = 1; },
    setVisible(v) { group.visible = v; },
  };
}

const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.28, 10).rotateZ(Math.PI / 2);
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x1b1d21, flatShading: true });
const rimMat = new THREE.MeshLambertMaterial({ color: 0xbfc4c9, flatShading: true });

export function makeCar(rng, opts = {}) {
  const group = new THREE.Group();
  const color = opts.color ?? rng.pick(PALETTE.cars);
  const police = !!opts.police;
  const convertible = !!opts.convertible;
  const paint = new THREE.MeshLambertMaterial({ color: police ? 0xf2f3f4 : color, flatShading: true });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1d2733, flatShading: true });
  const glass = new THREE.MeshLambertMaterial({ color: 0x7fc4d6, transparent: true, opacity: 0.72, flatShading: true });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.7, 4.5), paint);
  body.position.y = 0.78;
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.22, 1.35), paint);
  hood.position.set(0, 1.12, 1.45);
  const boot = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.2, 1.1), paint);
  boot.position.set(0, 1.1, -1.65);
  group.add(body, hood, boot);
  if (!convertible && !police) {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.67, 2.15), paint);
    cabin.position.set(0, 1.48, -0.28);
    const wind = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.48, 0.08), glass);
    wind.position.set(0, 1.5, 0.79); wind.rotation.x = -0.24;
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.46, 0.08), glass);
    back.position.set(0, 1.5, -1.34); back.rotation.x = 0.22;
    group.add(cabin, wind, back);
    for (const s of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 1.7), glass);
      side.position.set(s * 0.92, 1.5, -0.28);
      group.add(side);
    }
  } else if (convertible) {
    const wind = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.52, 0.08), glass);
    wind.position.set(0, 1.45, 0.82); wind.rotation.x = -0.3;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.1), dark);
    bar.position.set(0, 1.3, -0.85);
    group.add(wind, bar);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.4, 0.5), dark);
    seat.position.set(0, 1.2, -0.5);
    group.add(seat);
  }
  if (police) {
    for (const s of [-1, 1]) {
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.58, 1.8), new THREE.MeshLambertMaterial({ color: 0x244a8a }));
      door.position.set(s * 1.04, 0.96, -0.25);
      group.add(door);
    }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.32), dark);
    bar.position.set(0, 1.88, -0.3);
    group.add(bar);
  }
  for (const s of [-1, 1]) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.24), new THREE.MeshBasicMaterial({ color: 0xfff4cf }));
    light.position.set(s * 0.66, 0.86, 2.27);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.14, 0.1), new THREE.MeshBasicMaterial({ color: 0xd33b34 }));
    tail.position.set(s * 0.66, 0.9, -2.28);
    group.add(light, tail);
  }
  const wheels = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.position.set(sx * 1.05, 0.43, sz * 1.48);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.3, 8).rotateZ(Math.PI / 2), rimMat);
      w.add(rim);
      wheels.push(w);
      group.add(w);
    }
  }
  group.add(contactShadow(1.35));
  let flash = 0;
  const red = new THREE.MeshBasicMaterial({ color: 0xff3322 });
  const blue = new THREE.MeshBasicMaterial({ color: 0x3377ff });
  const l1 = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, 0.24), red);
  const l2 = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, 0.24), blue);
  l1.position.set(-0.4, 1.99, -0.3); l2.position.set(0.4, 1.99, -0.3);
  l1.visible = false; l2.visible = false;
  if (police) group.add(l1, l2);
  function animate(dt, speed) {
    for (const w of wheels) w.rotation.x += speed * dt / 0.42;
    if (police) {
      flash += dt * 9;
      const on = Math.floor(flash) % 2 === 0;
      l1.visible = on; l2.visible = !on;
    }
  }
  return {
    group, wheels, animate,
    setColor(c) { paint.color.set(c); },
    setPos(x, z, angle) { group.position.set(x, 0, z); group.rotation.y = angle; },
  };
}

export function makeMarker(color = 0xffd257, scale = 1) {
  const group = new THREE.Group();
  const c = new THREE.Color(color);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.16, 6, 28).rotateX(Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.92 }));
  ring.position.y = 0.35;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.2, 16, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false }));
  beam.position.y = 8;
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.7), new THREE.MeshBasicMaterial({ color: c }));
  gem.position.y = 4.6;
  group.add(ring, beam, gem);
  group.scale.setScalar(scale);
  let t = 0;
  return { group, update(dt) { t += dt; gem.rotation.y += dt * 2; gem.position.y = 4.6 + Math.sin(t * 2.2) * 0.4; ring.rotation.z += dt * 0.7; } };
}

export function makePickup(kind, color) {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: color ?? (kind === 'health' ? 0x59e08a : 0xffd75e) });
  const core = new THREE.Mesh(kind === 'health' ? new THREE.BoxGeometry(0.55, 0.55, 0.55) : new THREE.OctahedronGeometry(0.55), mat);
  core.position.y = 1.1;
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.06, 5, 20).rotateX(Math.PI / 2), mat);
  halo.position.y = 0.3;
  group.add(core, halo, contactShadow(0.5));
  return { group, kind, update(dt) { core.rotation.y += dt * 1.8; core.position.y = 1.1 + Math.sin(performance.now() * 0.003) * 0.15; } };
}

export function makeMuzzle() {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff0a0, transparent: true, opacity: 0.9 }));
  m.visible = false;
  return m;
}
