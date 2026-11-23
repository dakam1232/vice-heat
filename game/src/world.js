// Simulation: player on foot and in cars, traffic, pedestrians, wanted level, police,
// combat, pickups, three missions, notifications and save data.
import * as THREE from 'three';
import { CFG, PALETTE, MISSIONS, roadCoord, clamp, dist2 } from './config.js';
import { makePerson, makeCar, makeMarker, makePickup, makeMuzzle } from './entities.js';

const THRESHOLDS = [0, 55, 115, 185, 265, 355];
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const angleTo = (dx, dz) => Math.atan2(dx, dz);

export class World {
  constructor(scene, city, rng, audio) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.audio = audio;
    this.time = 0;
    this.state = 'title'; // title | playing | paused | busted | wasted
    this.messages = [];
    this.cars = [];
    this.police = [];
    this.peds = [];
    this.pickups = [];
    this.onEvent = null;
    this.player = {
      x: 8, z: 6, angle: 0.6, health: 100, cash: 0, stars: 0, heat: 0,
      armed: false, ammo: 0, inCar: null, busted: 0, hidden: 0, alive: true,
    };
    this.mission = { index: 0, stage: 0, checkpoint: 0, timer: 0, ready: false, done: false };
    this.missionCar = { x: roadCoord(3) + 6.4, z: roadCoord(4) - 5.6 };
    this.garage = { x: roadCoord(8) - 5, z: roadCoord(6) + 5 };
    this.safehouse = { x: roadCoord(2) + 5, z: roadCoord(3) + 5 };
    this.checkpoints = [
      { x: roadCoord(1), z: roadCoord(7) }, { x: roadCoord(7), z: roadCoord(7) },
      { x: roadCoord(8), z: roadCoord(2) }, { x: roadCoord(3), z: roadCoord(1) },
      { x: roadCoord(6), z: roadCoord(4) }, { x: roadCoord(9), z: roadCoord(5) },
    ];
    this.figure = makePerson(rng, { shirt: 0xe8503e, pants: 0x24304a });
    scene.add(this.figure.group);
    this.muzzle = makeMuzzle();
    scene.add(this.muzzle);
    this.muzzleLife = 0;
    this.marker = makeMarker(0xffd257);
    scene.add(this.marker.group);
    this.spawnTraffic(15);
    this.spawnParked();
    this.spawnPeds(22);
    this.spawnPickups();
    this.policeSpawnTimer = 0;
    this.autosaveTimer = 0;
    this.shotFlash = 0;
    this.lastCrash = 0;
    this.syncFigure();
  }

  notify(text, seconds = 3.4) {
    this.messages.unshift({ text, until: this.time + seconds });
    this.messages.length = Math.min(this.messages.length, 4);
    if (this.onEvent) this.onEvent('notify', text);
  }

  // ---------------------------------------------------------------- spawning
  roadPoint(i, j, lane = 0, axis = 'x') {
    if (axis === 'x') return { x: roadCoord(i) + lane, z: roadCoord(j) };
    return { x: roadCoord(i) - lane, z: roadCoord(j) + lane * 0 };
  }

  spawnTraffic(n) {
    for (let k = 0; k < n; k++) {
      const i = this.rng.int(0, CFG.grid);
      const j = this.rng.int(0, CFG.grid - 2);
      const axis = this.rng.chance(0.5) ? 'x' : 'z';
      const dir = this.rng.sign();
      const lane = axis === 'x' ? dir * 4.4 : -dir * 4.4;
      const x = axis === 'x' ? this.rng.float(-260, 260) : roadCoord(i) + lane;
      const z = axis === 'z' ? this.rng.float(-260, 215) : roadCoord(j) + lane;
      let ni = i, nj = j;
      if (axis === 'x') ni = clamp(Math.floor((x + CFG.extent) / CFG.block) + (dir > 0 ? 1 : 0), 0, CFG.grid);
      else nj = clamp(Math.floor((z + CFG.extent) / CFG.block) + (dir > 0 ? 1 : 0), 0, CFG.grid - 1);
      const mesh = makeCar(this.rng, { color: this.rng.pick(PALETTE.cars) });
      this.scene.add(mesh.group);
      this.cars.push({ mesh, x, z, angle: axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
        speed: this.rng.float(8, 14), targetSpeed: this.rng.float(9, 15), ni, nj, axis, dir, lane, stopped: 0 });
    }
  }

  spawnParked() {
    for (let k = 0; k < 14; k++) {
      const i = this.rng.int(0, CFG.grid);
      const j = this.rng.int(0, CFG.grid - 1);
      const side = this.rng.sign();
      const x = roadCoord(i) + side * 6.6;
      const z = roadCoord(j) + this.rng.float(-16, 16);
      const mesh = makeCar(this.rng, { color: this.rng.pick(PALETTE.cars) });
      mesh.setPos(x, z, Math.PI / 2);
      this.scene.add(mesh.group);
      this.cars.push({ mesh, x, z, angle: Math.PI / 2, speed: 0, parked: true });
    }
    const missionMesh = makeCar(this.rng, { color: 0xffd43b, convertible: true });
    missionMesh.setPos(this.missionCar.x, this.missionCar.z, Math.PI / 2);
    this.scene.add(missionMesh.group);
    this.cars.push({ mesh: missionMesh, x: this.missionCar.x, z: this.missionCar.z, angle: Math.PI / 2, speed: 0, parked: true, mission: true });
  }

  sidewalkSpot() {
    const i = this.rng.int(0, CFG.grid - 1);
    const j = this.rng.int(0, CFG.grid - 2);
    const cx = roadCoord(i) + CFG.block / 2;
    const cz = roadCoord(j) + CFG.block / 2;
    const r = CFG.block / 2 - CFG.roadHalf - 1;
    const edge = this.rng.int(0, 3);
    if (edge === 0) return { x: cx + this.rng.float(-r, r), z: cz - r };
    if (edge === 1) return { x: cx + this.rng.float(-r, r), z: cz + r };
    if (edge === 2) return { x: cx - r, z: cz + this.rng.float(-r, r) };
    return { x: cx + r, z: cz + this.rng.float(-r, r) };
  }

  spawnPeds(n) {
    for (let k = 0; k < n; k++) {
      const p = this.sidewalkSpot();
      const mesh = makePerson(this.rng);
      mesh.group.position.set(p.x, 0, p.z);
      this.scene.add(mesh.group);
      this.peds.push({ mesh, x: p.x, z: p.z, angle: this.rng.float(0, 6.28), speed: this.rng.float(1.1, 2.2), panic: 0, target: this.sidewalkSpot(), hp: 1 });
    }
  }

  spawnPickups() {
    for (let k = 0; k < 6; k++) {
      const p = this.sidewalkSpot();
      const kind = this.rng.chance(0.55) ? 'health' : 'weapon';
      const item = makePickup(kind);
      item.group.position.set(p.x, 0, p.z);
      this.scene.add(item.group);
      this.pickups.push({ ...item, x: p.x, z: p.z, active: true });
    }
  }

  spawnPolice() {
    const p = this.player;
    const angle = this.rng.float(0, Math.PI * 2);
    const dist = this.rng.float(62, 105);
    let x = clamp(p.x + Math.sin(angle) * dist, -280, 280);
    let z = clamp(p.z + Math.cos(angle) * dist, -280, 225);
    if (this.city.isBlocked(x, z, 3)) {
      x = roadCoord(this.rng.int(0, CFG.grid));
      z = roadCoord(this.rng.int(0, CFG.grid - 1));
    }
    const mesh = makeCar(this.rng, { police: true });
    mesh.setPos(x, z, 0);
    this.scene.add(mesh.group);
    this.police.push({ mesh, x, z, angle: 0, speed: 10, hp: 100, stuck: 0 });
    this.audio.setSiren(true, 0.6);
  }

  clearPolice() {
    for (const p of this.police) this.scene.remove(p.mesh.group);
    this.police.length = 0;
    this.audio.setSiren(false);
  }

  // ---------------------------------------------------------------- helpers
  syncFigure() {
    this.figure.group.position.x = this.player.x;
    this.figure.group.position.z = this.player.z;
    this.figure.group.rotation.y = this.player.angle;
    this.figure.setVisible(!this.player.inCar);
  }

  getFocus() {
    const car = this.player.inCar;
    if (car) return { x: car.x, z: car.z, y: 2.2, angle: car.angle, speed: Math.abs(car.speed), inCar: true };
    return { x: this.player.x, z: this.player.z, y: 1.25, angle: this.player.angle, speed: 0, inCar: false };
  }

  addHeat(n, reason) {
    if (this.state !== 'playing') return;
    const before = this.player.stars;
    this.player.heat = clamp(this.player.heat + n, 0, 400);
    this.player.stars = THRESHOLDS.filter((t) => t > 0 && this.player.heat >= t).length;
    this.player.hidden = 0;
    if (this.player.stars > before && reason) this.notify(`${'★'.repeat(this.player.stars)}  ${reason}`, 3);
  }

  setStars(n) {
    this.player.heat = n <= 0 ? 0 : THRESHOLDS[n] + 3;
    this.player.stars = clamp(n, 0, 5);
    this.player.hidden = 0;
  }

  hurt(n) {
    this.player.health = clamp(this.player.health - n, 0, 100);
    if (this.player.health <= 0) {
      this.state = 'wasted';
      this.audio.wasted();
      this.audio.setEngine(0, false);
      if (this.onEvent) this.onEvent('wasted');
    }
  }

  bust() {
    if (this.state !== 'playing') return;
    this.state = 'busted';
    this.player.cash = Math.max(0, this.player.cash - 200);
    this.player.heat = 0;
    this.player.stars = 0;
    this.clearPolice();
    this.audio.busted();
    this.audio.setEngine(0, false);
    this.notify('Busted - $200 fine');
    if (this.onEvent) this.onEvent('busted');
  }

  respawn() {
    this.player.x = 8; this.player.z = 6; this.player.angle = 0.6;
    if (this.player.inCar) { this.player.inCar.mesh.group.visible = true; this.player.inCar = null; }
    this.player.health = 100;
    this.player.busted = 0;
    this.state = 'playing';
    this.syncFigure();
  }

  // ---------------------------------------------------------------- interaction
  nearestCar(maxDist = 4.4) {
    let best = null, bd = maxDist * maxDist;
    for (const c of this.cars) {
      if (c.parked && c.mission === false && dist2(c.x, c.z, this.player.x, this.player.z) > 16) continue;
      const d = dist2(c.x, c.z, this.player.x, this.player.z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  interact() {
    const p = this.player;
    if (p.inCar) {
      const c = p.inCar;
      p.x = c.x + Math.sin(c.angle + Math.PI / 2) * 2.6;
      p.z = c.z + Math.cos(c.angle + Math.PI / 2) * 2.6;
      p.angle = c.angle;
      p.inCar = null;
      c.speed *= 0.3;
      this.audio.setEngine(0, false);
      this.syncFigure();
      this.notify('Left vehicle');
      return;
    }
    const car = this.nearestCar();
    if (!car) { this.notify('No vehicle nearby', 1.5); return; }
    p.inCar = car;
    this.figure.setVisible(false);
    car.speed = Math.max(0, car.speed * 0.3);
    car.parked = false;
    this.audio.unlock();
    this.addHeat(car.mission ? 64 : 62, car.mission ? 'Grand theft - mission car' : 'Carjacking');
    if (car.mission && this.mission.index === 0 && this.mission.stage === 0) {
      this.mission.stage = 1;
      this.notify('FIRST WHEELS: deliver the cabriolet to the garage');
    } else this.notify('Hot-wired. Keep moving.');
  }

  shoot(aimYaw) {
    const p = this.player;
    if (!p.inCar && !p.armed) { this.punch(); return; }
    const car = p.inCar;
    const yaw = car ? car.angle : aimYaw;
    const ox = car ? car.x + Math.sin(yaw) * 1.4 : p.x + Math.sin(yaw) * 0.7;
    const oz = car ? car.z + Math.cos(yaw) * 1.4 : p.z + Math.cos(yaw) * 0.7;
    const muzzleY = car ? 1.65 : 1.32;
    this.muzzle.position.set(ox + Math.sin(yaw) * 0.5, muzzleY, oz + Math.cos(yaw) * 0.5);
    this.muzzle.visible = true;
    this.muzzleLife = 0.09;
    this.audio.shot();
    this.addHeat(22, 'Shots fired');
    let bestDist = 46 * 46, hit = null, type = null;
    const consider = (o, d, ty) => {
      if (d < bestDist) { bestDist = d; hit = o; type = ty; }
    };
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    const inCone = (x, z) => {
      const dx = x - ox, dz = z - oz;
      const d = dx * dx + dz * dz;
      return d > 1 && d < 46 * 46 && (dx * fx + dz * fz) / Math.sqrt(d) > 0.78 ? d : -1;
    };
    for (const ped of this.peds) {
      const d = inCone(ped.x, ped.z);
      if (d >= 0) consider(ped, d, 'ped');
    }
    for (const cop of this.police) {
      const d = inCone(cop.x, cop.z);
      if (d >= 0) consider(cop, d, 'police');
    }
    for (const c of this.cars) {
      if (c === car) continue;
      const d = inCone(c.x, c.z);
      if (d >= 0) consider(c, d, 'car');
    }
    if (hit && type === 'ped') { hit.panic = 9; hit.speed = 7.5; this.notify('Pedestrian hit!'); }
    if (hit && type === 'police') {
      hit.hp -= 40;
      if (hit.hp <= 0) {
        this.scene.remove(hit.mesh.group);
        this.police.splice(this.police.indexOf(hit), 1);
        this.notify('Police vehicle disabled');
        this.addHeat(30);
      }
    }
    if (hit && type === 'car') { hit.speed *= 0.4; this.notify('Windshield hit'); }
  }

  punch() {
    this.figure.strike();
    this.audio.punch();
    const p = this.player;
    const fx = Math.sin(p.angle), fz = Math.cos(p.angle);
    for (const ped of this.peds) {
      const dx = ped.x - p.x, dz = ped.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 2.6 && (dx * fx + dz * fz) / Math.max(d, 0.01) > 0.3) {
        ped.panic = 10; ped.speed = 8; this.addHeat(14, 'Assault');
      }
    }
  }

  // ---------------------------------------------------------------- missions
  missionMarker() {
    const m = this.mission;
    if (m.done) return null;
    if (m.index === 0) return m.stage === 0 ? { ...this.missionCar, color: 0xffd257 } : { ...this.garage, color: 0x59e08a };
    if (m.index === 1) return { ...this.checkpoints[m.checkpoint % this.checkpoints.length], color: 0x59c8ff };
    if (m.index === 2) return m.stage === 1 ? { ...this.safehouse, color: 0x59e08a } : null;
    return null;
  }

  missionText() {
    const m = this.mission;
    if (m.done) return 'CITY CONQUERED - free roam';
    if (m.index === 0) return m.stage === 0 ? `${MISSIONS[0].name}: steal the yellow cabriolet` : `${MISSIONS[0].name}: deliver it to the green garage marker`;
    if (m.index === 1) return `COASTAL RUSH: checkpoint ${m.checkpoint + 1}/6 - ${Math.max(0, 110 - m.timer).toFixed(0)}s`;
    if (m.index === 2) return m.stage === 0 ? 'HEAT ESCAPE: get 3 wanted stars' : 'HEAT ESCAPE: lose the cops, reach the safehouse';
    return '';
  }

  completeMission() {
    const m = this.mission;
    const reward = MISSIONS[m.index].reward;
    this.player.cash += reward;
    this.audio.complete();
    this.notify(`${MISSIONS[m.index].name} COMPLETE  +$${reward}`, 5);
    m.index++; m.stage = 0; m.checkpoint = 0; m.timer = 0;
    if (m.index >= MISSIONS.length) {
      m.done = true;
      this.notify('CITY CONQUERED - the streets are yours', 8);
    }
    this.save();
  }

  updateMissions(dt) {
    const m = this.mission;
    const p = this.player;
    if (m.done) return;
    if (m.index === 0 && m.stage === 1 && p.inCar && p.inCar.mission) {
      if (dist2(p.x, p.z, this.garage.x, this.garage.z) < 64 && Math.abs(p.inCar.speed) < 14) this.completeMission();
    }
    if (m.index === 1 && p.inCar) {
      const cp = this.checkpoints[m.checkpoint];
      if (m.checkpoint === 0 && m.timer === 0) m.timer = 0.01;
      m.timer += dt;
      if (dist2(p.x, p.z, cp.x, cp.z) < 100) {
        m.checkpoint++;
        this.audio.pickup();
        this.notify(`Checkpoint ${m.checkpoint}/6`);
        if (m.checkpoint >= 6) this.completeMission();
      }
      if (m.timer > 110) {
        m.timer = 0; m.checkpoint = 0;
        this.notify('RACE FAILED - clock ran out. Try again.', 4);
      }
    }
    if (m.index === 2) {
      if (m.stage === 0 && p.stars >= 3) { m.stage = 1; this.notify('Lose the heat and get to the safehouse'); }
      if (m.stage === 1 && p.stars < 2 && dist2(p.x, p.z, this.safehouse.x, this.safehouse.z) < 81) this.completeMission();
    }
  }

  // ---------------------------------------------------------------- simulation
  update(dt, input, camYaw) {
    this.time += dt;
    if (this.muzzleLife > 0) {
      this.muzzleLife -= dt;
      if (this.muzzleLife <= 0) this.muzzle.visible = false;
    }
    for (const msg of this.messages) if (msg.until < this.time) msg.until = -1;
    this.messages = this.messages.filter((m) => m.until > 0);
    for (const pk of this.pickups) if (pk.active) pk.update(dt);
    this.marker.update(dt);
    const mark = this.missionMarker();
    this.marker.group.visible = !!mark && this.state === 'playing';
    if (mark) this.marker.group.position.set(mark.x, 0, mark.z);

    if (this.state !== 'playing') {
      this.audio.setEngine(0, false);
      this.audio.setSiren(false);
      return;
    }
    const p = this.player;
    const car = p.inCar;

    // On-foot movement, camera-relative.
    if (!car) {
      let mx = 0, mz = 0;
      if (input.is('KeyW') || input.is('ArrowUp')) mz += 1;
      if (input.is('KeyS') || input.is('ArrowDown')) mz -= 1;
      if (input.is('KeyD') || input.is('ArrowRight')) mx += 1;
      if (input.is('KeyA') || input.is('ArrowLeft')) mx -= 1;
      const len = Math.hypot(mx, mz);
      if (len > 0) {
        mx /= len; mz /= len;
        const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
        const rx = fz, rz = -fx;
        const speed = input.is('ShiftLeft') || input.is('ShiftRight') ? CFG.runSpeed : CFG.playerSpeed;
        const vx = (fx * mz + rx * mx) * speed * dt;
        const vz = (fz * mz + rz * mx) * speed * dt;
        const nx = clamp(p.x + vx, -285, 285);
        if (!this.city.isBlocked(nx, p.z, 0.55)) p.x = nx;
        const nz = clamp(p.z + vz, -285, 288);
        if (!this.city.isBlocked(p.x, nz, 0.55)) p.z = nz;
        p.angle = angleTo(vx, vz);
        this.audio.footstep();
      }
      this.figure.animate(dt, len > 0 ? (input.is('ShiftLeft') ? CFG.runSpeed : CFG.playerSpeed) : 0, p.angle);
      this.figure.group.position.x = p.x;
      this.figure.group.position.z = p.z;
    }

    // Driving: arcade throttle, brake, reverse and steering.
    if (car) {
      const accel = input.is('KeyW') || input.is('ArrowUp');
      const brake = input.is('KeyS') || input.is('ArrowDown');
      const steer = (input.is('KeyD') || input.is('ArrowRight') ? 1 : 0) - (input.is('KeyA') || input.is('ArrowLeft') ? 1 : 0);
      if (accel) car.speed += CFG.carAccel * dt;
      else if (brake) car.speed -= CFG.carBrake * dt;
      else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 9 * dt);
      car.speed = clamp(car.speed, -13, CFG.carMaxSpeed);
      if (Math.abs(car.speed) > 0.2) {
        const grip = clamp(Math.abs(car.speed) / 10, 0.25, 1);
        car.angle += steer * CFG.carTurn * dt * grip * Math.sign(car.speed);
      }
      const nx = car.x + Math.sin(car.angle) * car.speed * dt;
      const nz = car.z + Math.cos(car.angle) * car.speed * dt;
      let crashed = false;
      if (this.city.isBlocked(nx, nz, 1.5) || Math.abs(nx) > 288 || nz < -288 || nz > 292) {
        car.speed = -car.speed * 0.22;
        car.health = (car.health ?? 100) - 4;
        crashed = true;
      } else {
        car.x = nx; car.z = nz;
        for (const other of this.cars) {
          if (other === car) continue;
          if (dist2(car.x, car.z, other.x, other.z) < 12 && Math.abs(car.speed) > 5) {
            car.speed *= 0.82; other.speed = (other.speed || 0) + 2;
            crashed = true; break;
          }
        }
      }
      if (crashed && this.time - this.lastCrash > 0.45) {
        this.lastCrash = this.time;
        this.audio.crash();
        this.hurt(2);
      }
      car.mesh.setPos(car.x, car.z, car.angle);
      car.mesh.animate(dt, car.speed);
      this.figure.group.visible = false;
      this.audio.setEngine(car.speed, true);
    } else this.audio.setEngine(0, false);

    // Traffic follows the road grid, one intersection at a time.
    for (const c of this.cars) {
      if (c === car || c.parked) continue;
      let tx = c.x, tz = c.z;
      if (c.ni !== undefined) {
        if (c.axis === 'x') { tx = roadCoord(c.ni) + c.lane; tz = roadCoord(c.nj) + c.lane; }
        else { tx = roadCoord(c.ni) + c.lane; tz = roadCoord(c.nj); }
      }
      let dx = tx - c.x, dz = tz - c.z;
      const d = Math.hypot(dx, dz);
      if (d < 3.4 && c.ni !== undefined) {
        const choices = [];
        const stepI = c.axis === 'x' ? c.dir : 0;
        const stepJ = c.axis === 'z' ? c.dir : 0;
        const opts = [
          [c.ni + stepI, c.nj + stepJ, c.axis, c.dir],
          [c.ni - stepJ, c.nj + stepI, c.axis === 'x' ? 'z' : 'x', c.axis === 'x' ? stepI : -stepJ],
          [c.ni + stepJ, c.nj - stepI, c.axis === 'x' ? 'z' : 'x', c.axis === 'x' ? -stepI : stepJ],
        ];
        for (const [ni, nj, axis, dir] of opts) {
          if (ni >= 0 && ni <= CFG.grid && nj >= 0 && nj <= CFG.grid - 1) choices.push([ni, nj, axis, dir]);
        }
        if (choices.length) {
          const straight = choices[0];
          const chosen = this.rng.chance(0.68) && straight ? straight : this.rng.pick(choices);
          [c.ni, c.nj, c.axis, c.dir] = chosen;
          c.lane = c.axis === 'x' ? c.dir * 4.4 : -c.dir * 4.4;
        } else { c.ni = undefined; c.speed = 0; }
      }
      let blocker = false;
      for (const other of this.cars) {
        if (other === c || other.parked) continue;
        const odx = other.x - c.x, odz = other.z - c.z;
        const ahead = odx * dx / (d + 0.01) + odz * dz / (d + 0.01);
        if (ahead > 0 && ahead < 8 && Math.hypot(odx, odz) < 8) { blocker = true; break; }
      }
      c.speed += ((blocker ? 0 : c.targetSpeed) - c.speed) * dt * 1.6;
      if (d > 0.2) {
        c.angle = angleTo(dx, dz);
        const nx = c.x + dx / d * c.speed * dt;
        const nz = c.z + dz / d * c.speed * dt;
        if (!this.city.isBlocked(nx, nz, 1.4)) { c.x = nx; c.z = nz; }
        else c.speed *= 0.5;
      }
      c.mesh.setPos(c.x, c.z, c.angle);
      c.mesh.animate(dt, c.speed);
    }

    // Pedestrians wander the sidewalks and flee from danger.
    for (const ped of this.peds) {
      const threat = (car && Math.abs(car.speed) > 5 && dist2(ped.x, ped.z, car.x, car.z) < 90)
        || (this.shotFlash > 0 && dist2(ped.x, ped.z, p.x, p.z) < 900);
      if (threat) ped.panic = Math.max(ped.panic, 5);
      if (this.police.some((cop) => dist2(ped.x, ped.z, cop.x, cop.z) < 90)) ped.panic = Math.max(ped.panic, 4);
      const goal = ped.panic > 0 ? { x: ped.x + (ped.x - (car ? car.x : p.x)), z: ped.z + (ped.z - (car ? car.z : p.z)) } : ped.target;
      let dx = goal.x - ped.x, dz = goal.z - ped.z;
      let d = Math.hypot(dx, dz);
      if (d < 1.5) {
        if (ped.panic > 0) ped.panic = Math.max(0, ped.panic - 3);
        else ped.target = this.sidewalkSpot();
        continue;
      }
      const speed = ped.panic > 0 ? 7.2 : ped.speed;
      ped.panic = Math.max(0, ped.panic - dt);
      const nx = ped.x + dx / d * speed * dt;
      const nz = ped.z + dz / d * speed * dt;
      if (!this.city.isBlocked(nx, nz, 0.45)) { ped.x = nx; ped.z = nz; }
      else if (ped.panic > 0) { ped.x += -dz / d * speed * dt * 0.6; ped.z += dx / d * speed * dt * 0.6; }
      else ped.target = this.sidewalkSpot();
      ped.angle = angleTo(dx, dz);
      ped.mesh.group.position.x = ped.x;
      ped.mesh.group.position.z = ped.z;
      ped.mesh.animate(dt, speed, ped.angle);
      // Run over: a fast car scatters peds and leaves them winded on the pavement.
      if (car && Math.abs(car.speed) > 6 && dist2(ped.x, ped.z, car.x, car.z) < 5) {
        ped.panic = 12;
        const a = Math.atan2(ped.x - car.x, ped.z - car.z);
        ped.x += Math.sin(a) * 2.4; ped.z += Math.cos(a) * 2.4;
        this.addHeat(9);
        if (this.time - this.lastCrash > 0.6) { this.lastCrash = this.time; this.audio.crash(); }
      }
    }
    this.shotFlash = Math.max(0, this.shotFlash - dt);

    // Pickups.
    if (!car) {
      for (const pk of this.pickups) {
        if (!pk.active) continue;
        if (dist2(pk.x, pk.z, p.x, p.z) < 5) {
          pk.active = false;
          pk.group.visible = false;
          this.audio.pickup();
          if (pk.kind === 'health') { p.health = clamp(p.health + 35, 0, 100); this.notify('+35 health'); }
          else { p.armed = true; p.ammo += 60; this.notify('Pistol picked up - F / click to fire'); }
        }
      }
    }

    // Wanted, police and hiding.
    const visible = this.police.some((cop) => dist2(cop.x, cop.z, p.x, p.z) < 55 * 55 && this.city.lineOfSight(cop.x, cop.z, p.x, p.z));
    if (visible || this.police.length === 0) p.hidden = 0;
    else p.hidden += dt;
    if (p.hidden > 7 && this.police.length === 0) p.hidden = 7;
    if (p.hidden > 5) {
      const before = p.stars;
      p.heat = Math.max(0, p.heat - 11 * dt);
      p.stars = THRESHOLDS.filter((t) => t > 0 && p.heat >= t).length;
      if (p.stars < before && p.stars === 0) { this.clearPolice(); this.notify('Lost the cops'); }
    }
    const desired = Math.min(6, p.stars + (p.stars >= 4 ? 1 : 0));
    this.policeSpawnTimer -= dt;
    if (p.stars > 0 && this.police.length < desired && this.policeSpawnTimer <= 0) {
      this.spawnPolice();
      this.policeSpawnTimer = 6;
    }
    if (p.stars === 0 && this.police.length) this.clearPolice();
    for (const cop of this.police) {
      const dx = p.x - cop.x, dz = p.z - cop.z;
      const d = Math.hypot(dx, dz);
      let desiredAngle = angleTo(dx, dz);
      if (this.city.isBlocked(cop.x + Math.sin(desiredAngle) * 12, cop.z + Math.cos(desiredAngle) * 12, 2)) {
        desiredAngle += (cop.stuck % 2 === 0 ? 1 : -1) * 1.1;
        cop.stuck++;
      }
      const diff = wrap(desiredAngle - cop.angle);
      cop.angle += clamp(diff, -2.4 * dt, 2.4 * dt);
      const targetSpeed = clamp(14 + p.stars * 2.2 - Math.abs(diff) * 9, 5, 28);
      cop.speed += (targetSpeed - cop.speed) * dt * 2;
      const nx = cop.x + Math.sin(cop.angle) * cop.speed * dt;
      const nz = cop.z + Math.cos(cop.angle) * cop.speed * dt;
      if (!this.city.isBlocked(nx, nz, 1.6)) { cop.x = nx; cop.z = nz; }
      else cop.speed *= 0.3;
      cop.mesh.setPos(cop.x, cop.z, cop.angle);
      cop.mesh.animate(dt, cop.speed);
      if (car && d < 4.4 && Math.abs(car.speed) > 8) {
        car.health = (car.health ?? 100) - 9 * dt;
        car.speed *= 0.985;
        if (this.time - this.lastCrash > 0.7) { this.lastCrash = this.time; this.audio.crash(); }
      }
      const close = car ? d < 5 && Math.abs(car.speed) < 6 : d < 3.5;
      if (close) p.busted += (car ? 17 : 27) * dt;
    }
    p.busted = Math.max(0, p.busted - (car && Math.abs(car.speed) > 8 ? 22 : 9) * dt);
    if (p.busted > 100) { this.bust(); return; }
    this.audio.setSiren(p.stars > 0 && this.police.length > 0, clamp(1 - d2(p.x, p.z, this.police[0]) / 400, 0.25, 1) || 0.5);

    // Controls with edges.
    if (input.pressed('KeyE') || input.pressed('Enter')) this.interact();
    if (input.pressed('KeyF') || input.click) this.shoot(camYaw);

    this.updateMissions(dt);
    this.autosaveTimer += dt;
    if (this.autosaveTimer > 60) { this.autosaveTimer = 0; this.save(); }
  }

  // ---------------------------------------------------------------- persistence
  save() {
    try {
      const p = this.player;
      const c = p.inCar;
      localStorage.setItem(CFG.saveKey, JSON.stringify({
        v: 1, x: c ? c.x : p.x, z: c ? c.z : p.z, angle: p.angle, cash: p.cash,
        health: p.health, heat: p.heat, stars: p.stars, armed: p.armed, ammo: p.ammo,
        mission: { ...this.mission }, time: this.time,
      }));
      this.notify('Game saved', 2);
    } catch { /* private browsing: play on without saving */ }
  }

  static hasSave() {
    try { return !!localStorage.getItem(CFG.saveKey); } catch { return false; }
  }

  restore(data) {
    if (!data || data.v !== 1) return;
    const p = this.player;
    p.x = data.x ?? 8; p.z = data.z ?? 6; p.angle = data.angle ?? 0;
    p.cash = data.cash ?? 0; p.health = data.health ?? 100;
    p.heat = data.heat ?? 0; p.stars = data.stars ?? 0;
    p.armed = !!data.armed; p.ammo = data.ammo ?? 0;
    Object.assign(this.mission, data.mission ?? {});
    this.syncFigure();
  }

  static load() {
    try { return JSON.parse(localStorage.getItem(CFG.saveKey) ?? 'null'); } catch { return null; }
  }
}

function d2(ax, az, cop) { return cop ? dist2(ax, az, cop.x, cop.z) : 600; }

export { MISSIONS };
