// Simulation: on-foot and driving controls, traffic and pedestrian AI, police chases,
// combat, wanted level, pickups, three missions and localStorage-friendly state.
import * as THREE from '../three.module.min.js';
import { CFG, PLACES, CAR_COLORS } from './config.js';
import { Rng } from './random.js';
import { buildCity } from './city.js';
import { createPlayer, createPed, createCar, createMarker, createPickup, muzzleFlash,
  animateFigure, animateCar, animateMarker } from './entities.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angleLerp = (a, b, t) => {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;

export class GameWorld {
  constructor(scene, seed = 1, audio = null) {
    this.scene = scene;
    this.rng = new Rng(seed);
    this.audio = audio;
    this.city = buildCity(scene, this.rng);

    this.state = {
      mode: 'foot', health: 100, cash: 250, wanted: 0, wantedTimer: 0,
      busted: 0, time: 0, weapon: 0, ammo: 0, missionIndex: 0, missionStage: 0,
      missionTimer: 0, completed: [false, false, false], notice: '', noticeTimer: 0,
      shotCount: 0, lastCrime: -100,
    };
    this.player = createPlayer();
    this.player.root.position.set(-30, 0, 4);
    scene.add(this.player.root);
    this.playerHeading = Math.PI;
    this.camYaw = Math.PI;
    this.camPitch = 0;
    this.stepTimer = 0;
    this.attackCooldown = 0;
    this.attackAnim = 0;
    this.flashTimer = 0;
    this.flash = muzzleFlash();
    scene.add(this.flash);
    this.enterCooldown = 0;
    this.vehicle = null;
    this.traffic = [];
    this.police = [];
    this.peds = [];
    this.pickups = [];
    this.marker = createMarker();
    this.marker.group.visible = false;
    scene.add(this.marker.group);
    this.targetMarker = createMarker(0xff7a3d);
    this.targetMarker.group.visible = false;
    scene.add(this.targetMarker.group);
    this.onBusted = null;
    this.onWasted = null;
    this.onMission = null;
    this.onMessage = null;
    this.shotMode = false;

    this.spawnTraffic(13);
    this.spawnPeds(26);
    this.spawnPickups();
    const target = createCar({ color: 0xffc63d });
    target.group.position.set(PLACES.targetCar.x, 0, PLACES.targetCar.z);
    target.group.rotation.y = Math.PI / 2;
    scene.add(target.group);
    this.targetCar = { car: target, heading: Math.PI / 2, speed: 0, isTarget: true };
    this.state.missionTimer = 120;
    this.refreshMarker();
  }

  // ------------------------------------------------------------------ helpers
  message(text, seconds = 3.5) {
    this.state.notice = text;
    this.state.noticeTimer = seconds;
    if (this.onMessage) this.onMessage(text);
  }

  playerPos() {
    return this.mode === 'car' && this.vehicle ? this.vehicle.car.group.position : this.player.root.position;
  }

  get mode() { return this.state.mode; }
  activeMarker() {
    const s = this.state;
    if (s.missionIndex === 0) return s.missionStage === 0 ? PLACES.targetCar : PLACES.garage;
    if (s.missionIndex === 1 && s.missionStage < 6) return PLACES.checkpoints[s.missionStage];
    if (s.missionIndex === 2 && s.missionStage === 1) return PLACES.safehouse;
    return null;
  }

  missionText() {
    const s = this.state;
    if (s.missionIndex === 0) return s.missionStage === 0
      ? 'MISSION 1 · FIRST WHEELS — steal the marked car'
      : 'MISSION 1 · FIRST WHEELS — deliver it to the garage';
    if (s.missionIndex === 1) return `MISSION 2 · COASTAL RUSH — checkpoint ${s.missionStage + 1}/6 · ${Math.max(0, Math.ceil(s.missionTimer))}s`;
    if (s.missionIndex === 2) return s.missionStage === 0
      ? 'MISSION 3 · HEAT — get 3 wanted stars'
      : 'MISSION 3 · HEAT — lose the cops, reach the safehouse';
    return 'ALL MISSIONS COMPLETE · CITY CONQUERED — free roam';
  }

  addWanted(n = 1) {
    const s = this.state;
    s.wanted = clamp(s.wanted + n, 0, 5);
    s.wantedTimer = CFG.wantedDecay;
    s.lastCrime = s.time;
    if (s.wanted > 0) this.message(`WANTED · ${s.wanted} STAR${s.wanted > 1 ? 'S' : ''}`);
  }

  collides(x, z, radius) {
    if (x < -246 || x > 246 || z < -238 || z > 246) return true;
    for (const b of this.city.colliders) {
      if (Math.abs(x - b.x) < b.hw + radius && Math.abs(z - b.z) < b.hd + radius) return true;
    }
    return false;
  }

  moveWithCollision(pos, dx, dz, radius) {
    let hit = false;
    if (!this.collides(pos.x + dx, pos.z + dz, radius)) {
      pos.x += dx; pos.z += dz;
    } else {
      hit = true;
      if (!this.collides(pos.x + dx, pos.z, radius)) pos.x += dx;
      else if (!this.collides(pos.x, pos.z + dz, radius)) pos.z += dz;
    }
    return hit;
  }

  // ------------------------------------------------------------------ spawning
  spawnTraffic(n) {
    for (let i = 0; i < n; i++) this.traffic.push(this.makeTrafficCar());
  }

  makeTrafficCar() {
    const vertical = this.rng.chance(0.5);
    const road = this.rng.pick(this.city.roads);
    const lane = this.rng.sign() * 3.6;
    const along = this.rng.range(-220, 220);
    const car = createCar({ color: this.rng.pick(CAR_COLORS), convertible: this.rng.chance(0.16) });
    const heading = vertical ? (lane > 0 ? 0 : Math.PI) : (lane > 0 ? -Math.PI / 2 : Math.PI / 2);
    const pos = vertical ? new THREE.Vector3(road + lane, 0, along) : new THREE.Vector3(along, 0, road + lane);
    car.group.position.copy(pos);
    car.group.rotation.y = heading;
    this.scene.add(car.group);
    return { car, heading, speed: this.rng.range(8, 16), baseSpeed: this.rng.range(9, 17),
      vertical, road, lane, along, dir: lane > 0 ? 1 : -1, isTarget: false };
  }

  spawnPeds(n) {
    for (let i = 0; i < n; i++) this.peds.push(this.makePed());
  }

  makePed() {
    const fig = createPed(this.rng);
    const vertical = this.rng.chance(0.5);
    const road = this.rng.pick(this.city.roads);
    const offset = this.rng.sign() * 9.3;
    const along = this.rng.range(-225, 225);
    const pos = vertical ? new THREE.Vector3(road + offset, 0, along) : new THREE.Vector3(along, 0, road + offset);
    fig.root.position.copy(pos);
    this.scene.add(fig.root);
    return { fig, pos, vertical, road, offset, along, dir: this.rng.sign(),
      baseSpeed: this.rng.range(1.1, 2.3), speed: 1.6, scared: 0, panic: new THREE.Vector3(), down: 0 };
  }

  spawnPickups() {
    for (const [kind, p] of [['weapon', PLACES.weapon], ['health', PLACES.health]]) {
      const item = createPickup(kind);
      item.group.position.set(p.x, 0, p.z);
      item.cooldown = 0;
      this.scene.add(item.group);
      this.pickups.push(item);
    }
  }

  spawnPolice() {
    const p = this.playerPos();
    const a = this.rng.range(0, Math.PI * 2);
    let x = clamp(p.x + Math.cos(a) * 80, -220, 220);
    let z = clamp(p.z + Math.sin(a) * 80, -215, 220);
    // Snap onto the closest road so cruisers always arrive along the grid.
    const nearest = (v) => this.city.roads.reduce((best, r) => Math.abs(r - v) < Math.abs(best - v) ? r : best, this.city.roads[0]);
    if (this.rng.chance(0.5)) x = nearest(x) + (this.rng.chance(0.5) ? 3.5 : -3.5);
    else z = nearest(z) + (this.rng.chance(0.5) ? 3.5 : -3.5);
    const car = createCar({ police: true, color: 0xffffff });
    car.group.position.set(x, 0, z);
    const heading = Math.atan2(p.x - x, p.z - z);
    car.group.rotation.y = heading;
    this.scene.add(car.group);
    this.police.push({ car, heading, speed: 10, health: 100 });
  }

  syncPolice() {
    const want = this.state.wanted;
    while (this.police.length < want && this.police.length < 5) this.spawnPolice();
    while (this.police.length > want) {
      const p = this.police.pop();
      this.scene.remove(p.car.group);
    }
  }

  // ------------------------------------------------------------------ vehicles
  enterCar(entry, crime = true) {
    if (this.vehicle || !entry) return;
    this.vehicle = entry;
    this.state.mode = 'car';
    this.player.root.visible = false;
    entry.speed = 0;
    entry.car.group.rotation.y = entry.heading ?? entry.car.group.rotation.y;
    const idx = this.traffic.indexOf(entry);
    if (idx >= 0) this.traffic.splice(idx, 1);
    if (crime) {
      this.addWanted(1);
      this.message('CARJACK! · WANTED 1 STAR');
      this.audio?.punch();
    }
    if (entry.isTarget && this.state.missionIndex === 0 && this.state.missionStage === 0) {
      this.state.missionStage = 1;
      this.message('MISSION 1 · Take the car to the garage', 4);
      this.refreshMarker();
    }
  }

  exitCar() {
    if (!this.vehicle) return;
    const v = this.vehicle;
    const side = new THREE.Vector3(Math.cos(v.heading), 0, -Math.sin(v.heading)).multiplyScalar(3.2);
    const p = v.car.group.position;
    let x = p.x + side.x, z = p.z + side.z;
    if (this.collides(x, z, 0.6)) { x = p.x - side.x; z = p.z - side.z; }
    this.player.root.position.set(x, 0, z);
    this.player.root.visible = true;
    this.playerHeading = v.heading;
    v.speed = 0;
    this.vehicle = null;
    this.state.mode = 'foot';
    this.enterCooldown = 0.8;
  }

  // ------------------------------------------------------------------ input / simulation
  update(dt, input = null) {
    const s = this.state;
    s.time += dt;
    this.city.update(s.time);
    this.enterCooldown = Math.max(0, this.enterCooldown - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.attackAnim = Math.max(0, this.attackAnim - dt * 3.6);
    s.noticeTimer = Math.max(0, s.noticeTimer - dt);

    if (input && !this.shotMode) {
      this.camYaw -= input.mouseDX * 0.0027;
      this.camPitch = clamp(this.camPitch + input.mouseDY * 0.0022, -0.35, 0.5);
      if (s.mode === 'foot') this.updateFoot(dt, input);
      else this.updateDriving(dt, input);
      if (input.pressed('KeyF') || input.mouseClicked) this.attack();
      if (input.pressed('KeyE')) {
        if (s.mode === 'car') this.exitCar();
        else this.tryEnter();
      }
    } else if (s.mode === 'car' && this.vehicle) {
      this.vehicle.car.group.rotation.y = this.vehicle.heading;
      this.vehicle.car.group.position.y = 0;
    }

    this.updateTraffic(dt);
    this.updatePeds(dt);
    this.updatePolice(dt);
    this.updatePickups(dt);
    this.updateWanted(dt);
    this.updateMissions(dt);
    this.updateVisuals(dt);
    this.audio?.engine(this.vehicle ? this.vehicle.speed : 0, !!this.vehicle);
    this.audio?.policeSiren(s.wanted > 0 && this.police.length > 0);
  }

  updateFoot(dt, input) {
    let fx = 0, fz = 0;
    if (input.isDown('KeyW') || input.isDown('ArrowUp')) fz += 1;
    if (input.isDown('KeyS') || input.isDown('ArrowDown')) fz -= 1;
    if (input.isDown('KeyA') || input.isDown('ArrowLeft')) fx -= 1;
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) fx += 1;
    const len = Math.hypot(fx, fz);
    const speed = input.isDown('ShiftLeft') || input.isDown('ShiftRight') ? CFG.runSpeed : CFG.walkSpeed;
    let moving = 0;
    if (len > 0) {
      const yaw = this.camYaw;
      const dx = (Math.sin(yaw) * fz + Math.cos(yaw) * fx) / len;
      const dz = (Math.cos(yaw) * fz - Math.sin(yaw) * fx) / len;
      this.moveWithCollision(this.player.root.position, dx * speed * dt, dz * speed * dt, 0.62);
      this.playerHeading = angleLerp(this.playerHeading, Math.atan2(dx, dz), 0.22);
      moving = speed;
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) { this.audio?.step(); this.stepTimer = speed > 7 ? 0.29 : 0.44; }
    }
    this.player.root.rotation.y = this.playerHeading;
    animateFigure(this.player, this.state.time, moving, this.attackAnim);
  }

  updateDriving(dt, input) {
    const v = this.vehicle;
    if (!v) return;
    const accel = input.isDown('KeyW') || input.isDown('ArrowUp');
    const brake = input.isDown('KeyS') || input.isDown('ArrowDown');
    const steer = (input.isDown('KeyD') || input.isDown('ArrowRight') ? 1 : 0)
      - (input.isDown('KeyA') || input.isDown('ArrowLeft') ? 1 : 0);
    if (accel) v.speed = clamp(v.speed + CFG.carAccel * dt, -14, CFG.carMaxSpeed);
    else if (brake) v.speed = clamp(v.speed - CFG.carBrake * dt, -14, CFG.carMaxSpeed);
    else v.speed *= 1 - Math.min(0.9, dt * 0.7);
    if (input.isDown('Space')) v.speed *= 1 - Math.min(0.9, dt * 3.2);
    const sign = v.speed < -0.2 ? -1 : 1;
    v.heading += steer * CFG.carTurn * dt * sign * Math.min(1, Math.abs(v.speed) / 7);
    const p = v.car.group.position;
    const dx = Math.sin(v.heading) * v.speed * dt;
    const dz = Math.cos(v.heading) * v.speed * dt;
    const hit = this.moveWithCollision(p, dx, dz, 1.65);
    if (hit) {
      if (Math.abs(v.speed) > 12) {
        this.state.health = Math.max(0, this.state.health - Math.abs(v.speed) * 0.18);
        this.audio?.crash();
      }
      v.speed *= -0.22;
    }
    if (Math.abs(v.speed) > 8 && this.rng.chance(dt * 1.4)) {
      for (const ped of this.peds) {
        if (dist2(ped.pos, p) < 16 && ped.down <= 0) this.hitPed(ped, true);
      }
    }
    v.car.group.rotation.y = v.heading;
    animateCar(v.car, v.speed, dt, steer);
  }

  tryEnter() {
    if (this.enterCooldown > 0) return;
    const p = this.player.root.position;
    const candidates = [{ car: this.targetCar.car, heading: this.targetCar.heading, isTarget: true, speed: 0 }];
    for (const t of this.traffic) candidates.push(t);
    for (const pol of this.police) candidates.push({ car: pol.car, heading: pol.heading, speed: pol.speed });
    let best = null, bestD = 26;
    for (const c of candidates) {
      const d = dist2(c.car.group.position, p);
      if (d < bestD) { best = c; bestD = d; }
    }
    if (best) this.enterCar(best);
    else this.message('No vehicle nearby');
  }

  // ------------------------------------------------------------------ combat
  attack() {
    if (this.attackCooldown > 0) return;
    this.attackCooldown = this.state.mode === 'car' ? 0.22 : 0.36;
    this.attackAnim = 1;
    const p = this.playerPos();
    const baseHeading = this.state.mode === 'car' ? this.vehicle.heading : this.playerHeading;
    const usingGun = this.state.weapon > 0 && (this.state.mode === 'car' || this.state.ammo > 0);
    if (usingGun) {
      this.state.ammo = Math.max(0, this.state.ammo - 1);
      this.state.shotCount++;
      this.audio?.gunshot();
      this.flash.visible = true;
      this.flash.position.set(p.x + Math.sin(baseHeading) * 2, 1.65, p.z + Math.cos(baseHeading) * 2);
      this.flashTimer = 0.09;
      const range = this.state.mode === 'car' ? 55 : 48;
      for (const ped of this.peds) {
        if (ped.down > 0 || !this.inCone(p, baseHeading, ped.pos, range, 0.27)) continue;
        this.hitPed(ped, false);
      }
      for (const pol of this.police) {
        if (!this.inCone(p, baseHeading, pol.car.group.position, range, 0.32)) continue;
        pol.health -= 40;
        if (pol.health <= 0) {
          this.scene.remove(pol.car.group);
          this.police.splice(this.police.indexOf(pol), 1);
        }
      }
      if (this.state.shotCount % 3 === 1) this.addWanted(1);
      for (const ped of this.peds) if (dist2(ped.pos, p) < 1600) ped.scared = Math.max(ped.scared, 3);
    } else {
      this.audio?.punch();
      const f = new THREE.Vector3(Math.sin(baseHeading), 0, Math.cos(baseHeading));
      for (const ped of this.peds) {
        if (ped.down > 0) continue;
        const d = new THREE.Vector3().subVectors(ped.pos, p);
        if (d.length() < 3.2 && d.normalize().dot(f) > 0.1) {
          this.hitPed(ped, false);
          this.addWanted(1);
        }
      }
    }
  }

  inCone(origin, heading, target, range, cos) {
    const d = new THREE.Vector3().subVectors(target, origin);
    if (d.length() > range) return false;
    const f = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
    return d.normalize().dot(f) > 1 - cos;
  }

  hitPed(ped, byCar) {
    ped.down = byCar ? 4.5 : 2.2;
    ped.scared = 0;
    ped.fig.root.rotation.z = Math.PI / 2;
    ped.fig.root.position.y = -0.4;
    if (byCar) {
      this.audio?.crash();
      this.addWanted(1);
      this.message('Hit and run · witness saw you');
    }
  }

  // ------------------------------------------------------------------ AI updates
  updateTraffic(dt) {
    for (const t of this.traffic) {
      if (t.frozen) { animateCar(t.car, 0, dt); continue; }
      let target = t.baseSpeed;
      const p = t.car.group.position;
      const ahead = new THREE.Vector3(p.x + Math.sin(t.heading) * 9, 0, p.z + Math.cos(t.heading) * 9);
      for (const other of this.traffic) {
        if (other === t) continue;
        if (dist2(other.car.group.position, ahead) < 25) { target = 0; break; }
      }
      if (this.vehicle && dist2(this.vehicle.car.group.position, ahead) < 30) target = 0;
      t.speed += clamp(target - t.speed, -18 * dt, 9 * dt);
      t.along += t.dir * t.speed * dt;
      if (t.along > 236) t.along = -236;
      if (t.along < -236) t.along = 236;
      if (t.vertical) p.set(t.road + t.lane, 0, t.along);
      else p.set(t.along, 0, t.road + t.lane);
      t.car.group.rotation.y = t.heading;
      animateCar(t.car, t.speed, dt);
    }
  }

  updatePeds(dt) {
    const focus = this.playerPos();
    for (const ped of this.peds) {
      if (ped.frozen) { ped.fig.root.position.x = ped.pos.x; ped.fig.root.position.z = ped.pos.z; continue; }
      if (ped.down > 0) {
        ped.down -= dt;
        if (ped.down <= 0) {
          ped.fig.root.rotation.z = 0;
          ped.fig.root.position.y = 0;
          ped.scared = 0;
        }
        continue;
      }
      const threatCar = this.nearestThreat(ped.pos, focus);
      if (threatCar < 200) ped.scared = Math.max(ped.scared, 2.4);
      ped.scared = Math.max(0, ped.scared - dt);
      if (ped.scared > 0) {
        const away = new THREE.Vector3().subVectors(ped.pos, focus);
        if (away.lengthSq() < 0.01) away.set(1, 0, 0);
        away.normalize();
        ped.panic.copy(away);
        this.moveWithCollision(ped.pos, away.x * 7.6 * dt, away.z * 7.6 * dt, 0.5);
        ped.fig.root.rotation.y = Math.atan2(away.x, away.z);
        animateFigure(ped.fig, this.state.time, 7.6);
      } else {
        ped.along += ped.dir * ped.baseSpeed * dt;
        if (ped.along > 230) ped.dir = -1;
        if (ped.along < -230) ped.dir = 1;
        if (ped.vertical) ped.pos.set(ped.road + ped.offset, 0, ped.along);
        else ped.pos.set(ped.along, 0, ped.road + ped.offset);
        ped.fig.root.rotation.y = Math.atan2(ped.vertical ? 0 : ped.dir, ped.vertical ? ped.dir : 0);
        animateFigure(ped.fig, this.state.time, ped.baseSpeed);
      }
      ped.fig.root.position.x = ped.pos.x;
      ped.fig.root.position.z = ped.pos.z;
    }
  }

  nearestThreat(pedPos, focus) {
    let best = Infinity;
    for (const t of [...this.traffic, ...this.police, ...(this.vehicle ? [this.vehicle] : [])]) {
      const d = dist2(t.car.group.position, pedPos);
      if (d < best) best = d;
      if (Math.abs(t.speed) > 9 && d < 625) return 0;
    }
    if (this.state.mode === 'foot' && dist2(focus, pedPos) < 900) return 0;
    return best;
  }

  updatePolice(dt) {
    this.syncPolice();
    const focus = this.playerPos();
    const playerSpeed = this.vehicle ? Math.abs(this.vehicle.speed) : 0;
    let nearby = false;
    for (const pol of this.police) {
      const p = pol.car.group.position;
      if (pol.frozen) { animateCar(pol.car, 0, dt); if (dist2(p, focus) < 169) nearby = true; continue; }
      const desired = Math.atan2(focus.x - p.x, focus.z - p.z);
      pol.heading = angleLerp(pol.heading, desired, Math.min(1, dt * 2.2));
      const d = Math.hypot(focus.x - p.x, focus.z - p.z);
      const target = d < 6 ? 0 : CFG.policeMaxSpeed;
      pol.speed += clamp(target - pol.speed, -25 * dt, 16 * dt);
      this.moveWithCollision(p, Math.sin(pol.heading) * pol.speed * dt, Math.cos(pol.heading) * pol.speed * dt, 1.7);
      pol.car.group.rotation.y = pol.heading;
      animateCar(pol.car, pol.speed, dt);
      if (d < 13) nearby = true;
      if (this.vehicle && d < 4.8 && pol.speed > 12) {
        this.state.health = Math.max(0, this.state.health - dt * 16);
        this.vehicle.speed *= 0.97;
        if (this.rng.chance(dt * 0.7)) { this.audio?.crash(); this.addWanted(1); }
      }
    }
    if (this.state.wanted > 0) {
      if (nearby && playerSpeed < 14) this.state.busted += dt;
      else this.state.busted = Math.max(0, this.state.busted - dt * 1.4);
      if (this.state.busted >= CFG.bustedTime) {
        this.state.busted = 0;
        if (this.onBusted) this.onBusted();
      }
    }
  }

  updatePickups(dt) {
    const p = this.playerPos();
    for (const item of this.pickups) {
      item.core.rotation.y += dt * 1.4;
      item.ring.rotation.z += dt * 0.8;
      item.cooldown = Math.max(0, item.cooldown - dt);
      item.group.visible = item.cooldown <= 0;
      if (item.cooldown > 0 || this.state.mode !== 'foot') continue;
      if (dist2(item.group.position, p) < 8) {
        if (item.kind === 'weapon') {
          this.state.weapon = 1;
          this.state.ammo = 24;
          this.message('Pistol picked up · F to fire');
        } else {
          this.state.health = Math.min(100, this.state.health + 40);
          this.message('Health restored');
        }
        this.audio?.pickup();
        item.cooldown = 25;
      }
    }
  }

  updateWanted(dt) {
    const s = this.state;
    if (s.wanted <= 0) { s.busted = 0; return; }
    const nearPolice = this.police.some((p) => dist2(p.car.group.position, this.playerPos()) < 14400);
    if (!nearPolice && s.time - s.lastCrime > 9) {
      s.wantedTimer -= dt;
      if (s.wantedTimer <= 0) {
        s.wanted--;
        s.wantedTimer = CFG.wantedDecay;
        s.busted = 0;
        if (s.wanted === 0) this.message('Lost the cops');
      }
    } else s.wantedTimer = CFG.wantedDecay;
  }

  updateMissions(dt) {
    const s = this.state;
    const p = this.playerPos();
    if (s.missionIndex === 0) {
      this.targetMarker.group.visible = s.missionStage === 0;
      this.targetMarker.group.position.set(PLACES.targetCar.x, 0, PLACES.targetCar.z);
      animateMarker(this.targetMarker, s.time);
      if (s.missionStage === 1 && this.mode === 'car' && dist2(p, PLACES.garage) < 260) {
        s.missionStage = 0;
        s.missionIndex = 1;
        s.cash += 500;
        s.missionTimer = 120;
        this.complete('FIRST WHEELS COMPLETE · +$500');
      }
    } else {
      this.targetMarker.group.visible = false;
    }
    if (s.missionIndex === 1) {
      s.missionTimer -= dt;
      if (s.missionTimer <= 0) {
        s.missionStage = 0;
        s.missionTimer = 120;
        this.message('RACE FAILED · timer restarted');
      }
      const cp = PLACES.checkpoints[s.missionStage];
      if (cp && dist2(p, cp) < 330) {
        s.missionStage++;
        s.missionTimer += 22;
        this.message(`CHECKPOINT ${s.missionStage}/6`);
        if (s.missionStage >= 6) {
          s.missionIndex = 2;
          s.missionStage = 0;
          s.cash += 750;
          this.complete('COASTAL RUSH COMPLETE · +$750');
        }
      }
    }
    if (s.missionIndex === 2) {
      if (s.missionStage === 0 && s.wanted >= 3) {
        s.missionStage = 1;
        this.message('HEAT IS ON · lose the cops and reach the safehouse', 5);
      }
      if (s.missionStage === 1 && dist2(p, PLACES.safehouse) < 340) {
        const chased = this.police.some((pol) => dist2(pol.car.group.position, p) < 3600);
        if (!chased) {
          s.missionIndex = 3;
          s.cash += 1000;
          this.complete('HEAT COMPLETE · +$1000 · CITY CONQUERED');
        } else this.message('Police too close — lose them first');
      }
    }
    this.refreshMarker();
  }

  complete(text) {
    this.audio?.complete();
    this.message(text, 5);
    if (this.onMission) this.onMission(text);
  }

  refreshMarker() {
    const m = this.activeMarker();
    this.marker.group.visible = !!m;
    if (m) this.marker.group.position.set(m.x, 0, m.z);
  }

  updateVisuals(dt) {
    animateMarker(this.marker, this.state.time);
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) this.flash.visible = false;
    }
    if (this.state.health <= 0 && this.onWasted) this.onWasted();
  }

  // ------------------------------------------------------------------ persistence
  saveState() {
    const s = this.state;
    const p = this.player.root.position;
    return {
      v: 1, cash: s.cash, health: s.health, wanted: s.wanted, weapon: s.weapon, ammo: s.ammo,
      missionIndex: s.missionIndex, missionStage: s.missionStage, completed: s.completed,
      foot: { x: p.x, z: p.z, heading: this.playerHeading },
      car: this.vehicle ? { x: this.vehicle.car.group.position.x, z: this.vehicle.car.group.position.z,
        heading: this.vehicle.heading, convertible: this.vehicle.car.convertible, color: this.vehicle.car.body.material.color.getHex() } : null,
    };
  }

  loadState(data) {
    if (!data || data.v !== 1) return false;
    const s = this.state;
    if (this.vehicle) { this.vehicle.car.group.visible = false; this.vehicle = null; }
    s.mode = 'foot';
    s.cash = data.cash ?? 250;
    s.health = data.health ?? 100;
    s.wanted = clamp(data.wanted ?? 0, 0, 5);
    s.weapon = data.weapon ?? 0;
    s.ammo = data.ammo ?? 0;
    s.missionIndex = data.missionIndex ?? 0;
    s.missionStage = data.missionStage ?? 0;
    s.completed = data.completed ?? s.completed;
    s.missionTimer = 120;
    s.lastCrime = -100;
    if (data.car) {
      const car = createCar({ color: data.car.color ?? CAR_COLORS[0], convertible: !!data.car.convertible });
      car.group.position.set(data.car.x, 0, data.car.z);
      this.scene.add(car.group);
      this.enterCar({ car, heading: data.car.heading ?? 0, speed: 0 }, false);
    } else {
      this.player.root.position.set(data.foot?.x ?? -30, 0, data.foot?.z ?? 4);
      this.playerHeading = data.foot?.heading ?? Math.PI;
      this.player.root.visible = true;
    }
    this.syncPolice();
    this.refreshMarker();
    return true;
  }
}
