// Deterministic composition of the four capture scenes.
import { RNG } from './random.js';
import { CFG, roadCoord } from './config.js';
import { makeCar, makePerson } from './entities.js';

function addInput(world, rng, x, z, angle, color = null) {
  const mesh = makeCar(rng, color ? { color } : {});
  mesh.setPos(x, z, angle);
  world.scene.add(mesh.group);
  const c = { mesh, x, z, angle, speed: 0, health: 100 };
  world.cars.push(c);
  return c;
}

function addPed(world, rng, x, z) {
  const mesh = makePerson(rng);
  mesh.group.position.set(x, 0, z);
  world.scene.add(mesh.group);
  world.peds.push({ mesh, x, z, angle: rng.float(0, 6.28), speed: rng.float(1, 2), panic: 0, target: world.sidewalkSpot(), hp: 1 });
}

function coastalCar(world, rng, x, z, color, speed = 24) {
  const car = addInput(world, rng, x, z, Math.PI / 2, color);
  car.speed = speed;
  car.ni = undefined;
  return car;
}

export function setupShot(name, seed, world, view) {
  const rng = new RNG(seed);
  const r = roadCoord;
  view.mode = 'follow';
  world.state = 'playing';

  if (name === 'start') {
    world.state = 'title';
    view.mode = 'manual';
    view.camera.position.set(-150, 68, -115);
    view.camera.lookAt(40, 8, 260);
    view.screen('title');
    view.el.continue.classList.toggle('hidden', !world.constructor.hasSave());
    return { yaw: 0, pitch: 0 };
  }

  if (name === 'play') {
    world.player.x = r(5) + 1.2;
    world.player.z = r(5) + 3.2;
    world.player.angle = 0.12;
    world.player.cash = 340;
    world.player.armed = false;
    world.setStars(0);
    world.syncFigure();
    world.figure.animate(0.2, 3, 0.12);
    for (let k = 0; k < 8; k++) {
      const a = rng.float(0, 6.28), d = rng.float(7, 20);
      addPed(world, rng, world.player.x + Math.sin(a) * d, world.player.z + Math.cos(a) * d);
    }
    const c = addInput(world, rng, r(5) + 4.4, r(5) - 8, 0xffd43b);
    c.speed = 9;
    const c2 = addInput(world, rng, r(6) - 4.4, r(5) + 12, 0x2e86c1);
    c2.speed = -8;
    view.screen(null);
    return { yaw: 0.12, pitch: -0.16 };
  }

  if (name === 'drive') {
    const road = r(9) - 4;
    const car = coastalCar(world, rng, -26, road, 0xffc23b, 26);
    world.player.inCar = car;
    world.player.x = car.x; world.player.z = car.z;
    world.player.cash = 1250;
    world.setStars(0);
    world.figure.setVisible(false);
    addInput(world, rng, 22, road + 4.3, 0xf2f3f4).speed = 12;
    addInput(world, rng, -78, road - 4.3, 0xe84b3c).speed = 10;
    for (let k = 0; k < 4; k++) addPed(world, rng, 30 + k * 11, r(10) - 8 + rng.float(-2, 2));
    view.screen(null);
    return { yaw: Math.PI / 2, pitch: -0.06 };
  }

  if (name === 'chase') {
    const road = r(9) - 4;
    const car = coastalCar(world, rng, -18, road, 0xffc23b, 31);
    world.player.inCar = car;
    world.player.x = car.x; world.player.z = car.z;
    world.player.cash = 640;
    world.setStars(3);
    world.figure.setVisible(false);
    // Ahead and flanking police cars make the pursuit readable from the chase camera.
    const spots = [[12, road - 3.4], [28, road + 3.6], [42, road - 3.5], [3, road + 5.4]];
    for (const [x, z] of spots) {
      const mesh = makeCar(rng, { police: true });
      mesh.setPos(x, z, x < car.x ? Math.PI / 2 : -Math.PI / 2);
      mesh.animate(0.08, 0);
      world.scene.add(mesh.group);
      world.police.push({ mesh, x, z, angle: x < car.x ? Math.PI / 2 : -Math.PI / 2, speed: 22, hp: 100, stuck: 0 });
    }
    addInput(world, rng, 56, road + 4.3, 0x8e6ccf).speed = 11;
    view.screen(null);
    return { yaw: Math.PI / 2, pitch: -0.02 };
  }

  return { yaw: 0, pitch: 0 };
}
