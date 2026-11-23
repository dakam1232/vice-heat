// VICE HEAT - bootstrap, game loop, screens and a small test/debug surface.
import * as THREE from 'three';
import { CFG, clamp } from './config.js';
import { RNG } from './random.js';
import { AudioSystem } from './audio.js';
import { Input } from './input.js';
import { buildCity } from './city.js';
import { World } from './world.js';
import { View } from './render.js';
import { setupShot } from './shots.js';

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
const seed = Number(params.get('seed')) || 1;

const canvas = document.getElementById('view');
const scene = new THREE.Scene();
const city = buildCity(scene, new RNG(seed * 7 + 3));
const audio = new AudioSystem();
const world = new World(scene, city, new RNG(seed * 131 + 17), audio);
const view = new View(canvas);
view.attach(scene);
const input = new Input(canvas);
input.gesture = () => audio.unlock();

let yaw = 0.35;
let pitch = -0.14;
let last = 0;
let frames = 0;
let ready = false;

if (shot) {
  const result = setupShot(shot, seed, world, view);
  yaw = result.yaw;
  pitch = result.pitch;
}

function startGame() {
  audio.unlock();
  world.state = 'playing';
  world.messages = [];
  view.mode = 'follow';
  view.screen(null);
}

function continueGame() {
  const data = World.load();
  if (!data) { startGame(); return; }
  audio.unlock();
  world.restore(data);
  world.state = 'playing';
  view.mode = 'follow';
  view.screen(null);
  world.notify('Save loaded');
}

function pauseGame() {
  if (world.state !== 'playing') return;
  world.state = 'paused';
  audio.setEngine(0, false);
  view.screen('pause');
}
function resumeGame() {
  if (world.state !== 'paused') return;
  world.state = 'playing';
  view.screen(null);
}

world.onEvent = (kind) => {
  if (kind === 'busted') view.screen('busted');
  if (kind === 'wasted') view.screen('wasted');
};

document.getElementById('playBtn').addEventListener('click', (e) => { e.stopPropagation(); startGame(); });
document.getElementById('continueBtn').addEventListener('click', (e) => { e.stopPropagation(); continueGame(); });
document.getElementById('resumeBtn').addEventListener('click', resumeGame);
document.getElementById('saveBtn').addEventListener('click', () => { world.save(); resumeGame(); });
document.getElementById('quitBtn').addEventListener('click', () => {
  world.state = 'title';
  view.screen('title');
  view.el.continue.classList.toggle('hidden', !World.hasSave());
});
document.getElementById('bustBtn').addEventListener('click', () => { world.respawn(); view.screen(null); });
document.getElementById('wastedBtn').addEventListener('click', () => { world.respawn(); view.screen(null); });
document.getElementById('title').addEventListener('click', (e) => {
  if (e.target.tagName === 'BUTTON') return;
  startGame();
});
if (!shot) view.el.continue.classList.toggle('hidden', !World.hasSave());

function frame(now) {
  const dt = last ? clamp((now - last) / 1000, 0, 0.05) : 0.016;
  last = now;
  frames++;

  if (input.pressed('Escape') || input.pressed('KeyP')) {
    if (world.state === 'playing') pauseGame();
    else if (world.state === 'paused') resumeGame();
  }
  if (input.pressed('KeyM')) audio.toggleMute();
  if (input.pressed('KeyK') && (world.state === 'playing' || world.state === 'paused')) world.save();
  if (input.pressed('KeyL')) continueGame();

  if (!shot) {
    yaw += input.yawDelta;
    pitch = clamp(pitch + input.pitchDelta, -0.6, 0.4);
  }
  world.update(shot ? 0 : dt, input, yaw);
  view.updateCamera(world, yaw, pitch, dt, frames < 2);
  if (shot) city.update(4.2);
  else city.update(world.time);
  view.hud(world, audio.muted);
  view.minimap(world);
  view.render();
  input.endFrame();

  if (shot && !ready && frames >= 3) {
    ready = true;
    window.__shotReady = true;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Test surface: lets a headless browser drive a real play session through the same code paths.
window.__game = {
  world, view, input, audio, city, THREE,
  shot,
  start: startGame,
  continue: continueGame,
  pause: pauseGame,
  resume: resumeGame,
  teleport(x, z) {
    if (world.player.inCar) { world.player.inCar.x = x; world.player.inCar.z = z; world.player.inCar.mesh.setPos(x, z, world.player.inCar.angle); }
    else { world.player.x = x; world.player.z = z; world.syncFigure(); }
  },
  enter: () => world.interact(),
  setStars: (n) => world.setStars(n),
  completeMission: () => world.completeMission(),
  press: (code) => input.press(code),
  release: (code) => input.release(code),
  save: () => world.save(),
  load: () => continueGame(),
  tick: (seconds = 1) => new Promise((resolve) => setTimeout(resolve, seconds * 1000)),
  state: () => ({
    state: world.state,
    player: { x: world.player.x, z: world.player.z, health: world.player.health, cash: world.player.cash,
      stars: world.player.stars, armed: world.player.armed, inCar: !!world.player.inCar },
    mission: { ...world.mission },
    cars: world.cars.length, police: world.police.length, peds: world.peds.length,
    ready: !!window.__shotReady, frames,
  }),
};
