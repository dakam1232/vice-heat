// Deterministic scene recipes for the four ?shot= states used by the screenshots.
// Each recipe sets the camera and the world so one frame tells the whole story.
import { createCar } from './entities.js';

export function applyShot(world, renderer, shot) {
  if (!shot) return null;
  world.shotMode = true;
  world.shotCameraBias = 0;

  if (shot === 'start') {
    world.player.root.position.set(-30, 0, -12);
    world.player.root.visible = true;
    world.playerHeading = Math.PI * 0.62;
    world.player.root.rotation.y = world.playerHeading;
    renderer.title(0, true);
    return 'title';
  }

  if (shot === 'play') {
    world.player.root.position.set(-30, 0, 26);
    world.player.root.visible = true;
    world.playerHeading = Math.PI;
    world.player.root.rotation.y = world.playerHeading;
    world.camYaw = Math.PI - 0.24;
    world.camPitch = 0.02;
    // Park a few cars down the street; frozen so the deterministic scene holds still.
    const cars = [
      [-33.6, 6, 0], [-26.4, -22, Math.PI], [-33.6, -48, Math.PI],
    ];
    world.traffic.slice(0, 3).forEach((t, i) => {
      t.frozen = true;
      t.heading = cars[i][2];
      t.car.group.position.set(cars[i][0], 0, cars[i][1]);
      t.car.group.rotation.y = cars[i][2];
    });
    const spots = [[-39.3, 19], [-20.7, 8], [-39.3, -4], [-20.7, -16]];
    world.peds.slice(0, 4).forEach((ped, i) => {
      ped.frozen = true;
      ped.pos.set(spots[i][0], 0, spots[i][1]);
      ped.fig.root.position.set(spots[i][0], 0, spots[i][1]);
      ped.fig.root.rotation.y = i % 2 ? 0 : Math.PI;
    });
    renderer.foot(world.player.root.position, world.camYaw, world.camPitch, true);
    return 'game';
  }

  if (shot === 'drive' || shot === 'chase') {
    const fast = shot === 'chase';
    const car = createCar({ color: fast ? 0xe8483c : 0xf7f2e6, convertible: true });
    const x = fast ? 46 : -52;
    car.group.position.set(x, 0, -210);
    world.scene.add(car.group);
    const speed = fast ? 33 : 26;
    const entry = { car, heading: Math.PI / 2, speed: 0, isTarget: false };
    world.enterCar(entry, false);
    entry.speed = speed;
    world.camYaw = Math.PI / 2;
    world.shotCameraBias = fast ? -7 : -17;
    if (fast) {
      world.addWanted(3);
      world.syncPolice();
      const spots = [[x + 13, -203], [x + 26, -219], [x + 44, -205]];
      world.police.forEach((pol, i) => {
        pol.car.group.position.set(spots[i][0], 0, spots[i][1]);
        pol.heading = -Math.PI / 2;
        pol.speed = 26;
        pol.frozen = true;
        pol.car.group.rotation.y = pol.heading;
      });
    }
    renderer.chase(car.group.position, entry.heading, entry.speed, true, world.shotCameraBias);
    return 'game';
  }
  return null;
}

export function shotSeed(params) {
  const raw = Number(params.get('seed'));
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 1;
}
