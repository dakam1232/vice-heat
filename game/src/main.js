// Boot, UI screens, HUD, autosave and the main loop. The game owns no external assets.
import { AudioKit } from './audio.js';
import { Input } from './input.js';
import { Renderer3D, drawMinimap } from './render.js';
import { GameWorld } from './world.js';
import { applyShot, shotSeed } from './shots.js';

const $ = (id) => document.getElementById(id);
const canvas = $('view');
const params = new URLSearchParams(location.search);
const shot = params.get('shot');
const seed = shotSeed(params);
const SAVE_KEY = 'vice_heat_save_v1';

const audio = new AudioKit();
const renderer = new Renderer3D(canvas);
const world = new GameWorld(renderer.scene, seed, audio);
const input = new Input(canvas);

let screen = 'title';
let firstFrame = true;
let frames = 0;
let autosave = 0;
let toastTimer = 0;

function setScreen(name) {
  screen = name;
  for (const id of ['title', 'pause', 'busted', 'wasted']) $(id).classList.toggle('hidden', id !== name);
  $('hud').classList.toggle('hidden', name === 'title');
  input.enabled = name === 'game';
  if (name !== 'game') input.unlock();
}

function showToast(text) {
  const el = $('toast');
  el.textContent = text;
  el.classList.add('show');
  toastTimer = 4.5;
}

function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(world.saveState()));
    showToast('GAME SAVED');
    return true;
  } catch {
    showToast('SAVE FAILED');
    return false;
  }
}

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (!data) { showToast('NO SAVE FOUND'); return false; }
    world.loadState(data);
    setScreen('game');
    showToast('GAME LOADED');
    return true;
  } catch {
    showToast('LOAD FAILED');
    return false;
  }
}

function startGame() {
  audio.ensure();
  setScreen('game');
  input.lock();
  world.message('STEAL THE MARKED CAR · follow the yellow marker', 5);
}

function respawn(fine) {
  if (fine) world.state.cash = Math.max(0, world.state.cash - 250);
  world.state.health = 100;
  world.state.wanted = 0;
  world.state.busted = 0;
  if (world.vehicle) {
    world.scene.remove(world.vehicle.car.group);
    world.vehicle = null;
    world.state.mode = 'foot';
    world.player.root.visible = true;
  }
  world.player.root.position.set(-30, 0, 4);
  world.playerHeading = Math.PI;
  world.syncPolice();
  setScreen('game');
  audio.policeSiren(false);
}

world.onBusted = () => { audio.busted(); setScreen('busted'); };
world.onWasted = () => { if (screen !== 'wasted') { audio.hurt(); setScreen('wasted'); } };
world.onMission = (text) => showToast(text);

$('playBtn').addEventListener('click', startGame);
$('continueBtn').addEventListener('click', load);
$('resumeBtn').addEventListener('click', () => { setScreen('game'); audio.ensure(); });
$('saveBtn').addEventListener('click', save);
$('loadBtn').addEventListener('click', load);
$('bustedBtn').addEventListener('click', () => respawn(true));
$('wastedBtn').addEventListener('click', () => respawn(false));

input.onEscape = () => {
  if (screen === 'game') setScreen('pause');
  else if (screen === 'pause') setScreen('game');
};

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyM') { audio.setMuted(!audio.muted); showToast(audio.muted ? 'MUTED' : 'SOUND ON'); }
  if (e.code === 'KeyK' && screen === 'game') save();
  if (e.code === 'KeyL' && screen === 'game') load();
  if (e.code === 'KeyP') {
    if (screen === 'game') setScreen('pause');
    else if (screen === 'pause') setScreen('game');
  }
});

try {
  if (localStorage.getItem(SAVE_KEY)) $('continueBtn').classList.remove('hidden');
} catch { /* private browsing: no Continue button */ }

const shotScreen = shot ? applyShot(world, renderer, shot) : null;
if (shotScreen) setScreen(shotScreen);

function updateHud() {
  const s = world.state;
  $('healthBar').style.width = `${Math.max(0, s.health)}%`;
  $('cash').textContent = `$${s.cash.toLocaleString('en-US')}`;
  $('weapon').textContent = s.weapon
    ? `Pistol · ${s.ammo} rounds · K save / L load · M mute`
    : 'Fists · K save / L load · M mute';
  $('missionText').textContent = world.missionText();
  $('stars').textContent = '★'.repeat(s.wanted) + '☆'.repeat(5 - s.wanted);
  $('bustedBar').style.width = `${Math.min(100, (s.busted / 6.5) * 100)}%`;
  $('speed').style.display = world.mode === 'car' ? 'block' : 'none';
  $('speedVal').textContent = String(Math.round(Math.abs(world.vehicle?.speed || 0) * 3.1));
  $('hint').innerHTML = world.mode === 'car'
    ? 'WASD steer / accelerate<br>Space handbrake · F fire<br>E exit · Esc pause'
    : 'WASD move · Shift run<br>E enter / exit · F attack<br>Esc pause';
  const note = $('notice');
  note.textContent = s.notice;
  note.style.opacity = s.noticeTimer > 0 ? '1' : '0';
}

let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;

  if (shot || screen === 'game') world.update(dt, shot ? null : input);
  if (screen === 'title') renderer.title(now / 1000, firstFrame);
  else if (world.mode === 'car' && world.vehicle) renderer.chase(world.vehicle.car.group.position, world.vehicle.heading, world.vehicle.speed, firstFrame, world.shotCameraBias || 0);
  else renderer.foot(world.player.root.position, world.camYaw, world.camPitch, firstFrame);
  renderer.render();

  if (!shot && screen === 'game') {
    autosave += dt;
    if (autosave > 30) { autosave = 0; try { localStorage.setItem(SAVE_KEY, JSON.stringify(world.saveState())); } catch {} }
  }
  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) $('toast').classList.remove('show');
  }
  if (screen !== 'title') {
    updateHud();
    if (frames % 3 === 0) drawMinimap($('minimap'), world);
  }
  if (shot && firstFrame) window.__shotReady = true;
  input.endFrame();
  firstFrame = false;
  frames++;
}
requestAnimationFrame(loop);

// Small automation surface, also handy when play-testing the build in a browser.
window.__vh = { world, renderer, input, audio, startGame, save, load, respawn,
  get screen() { return screen; }, setScreen };
