// Camera, WebGL presentation, HUD and the canvas minimap.
import * as THREE from 'three';
import { CFG, roadCoord, clamp } from './config.js';

const $ = (id) => document.getElementById(id);

export class View {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.16;
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.2, 2400);
    this.scene = null;
    this.mode = 'follow';
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.mapCtx = $('minimap').getContext('2d');
    this.el = {
      hud: $('hud'), title: $('title'), pause: $('pause'), busted: $('busted'), wasted: $('wasted'),
      health: $('healthFill'), stars: $('stars'), cash: $('cash'), speed: $('speed'), speedBox: $('speedBox'),
      mission: $('missionText'), notify: $('notify'), bust: $('bustFill'), crosshair: $('crosshair'),
      mute: $('muteTag'), continue: $('continueBtn'),
    };
    this._tmp = new THREE.Vector3();
  }

  attach(scene) { this.scene = scene; }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  updateCamera(world, yaw, pitch, dt, snap = false) {
    if (this.mode === 'manual') return;
    const f = world.getFocus();
    const heading = f.inCar ? f.angle : yaw;
    const dist = f.inCar ? 13.5 : 10.6;
    const height = f.inCar ? 5.4 : 4.25;
    const cp = Math.cos(pitch * 0.55);
    const want = this._tmp.set(
      f.x - Math.sin(heading) * dist * cp,
      f.y + height + Math.sin(pitch) * 8,
      f.z - Math.cos(heading) * dist * cp,
    );
    if (snap) this.camera.position.copy(want);
    else this.camera.position.lerp(want, 1 - Math.exp(-dt * 5.5));
    this.camera.lookAt(f.x + Math.sin(heading) * (f.inCar ? 7 : 1.6), f.y + 0.95, f.z + Math.cos(heading) * (f.inCar ? 7 : 1.6));
  }

  render() { this.renderer.render(this.scene, this.camera); }

  screen(name) {
    for (const k of ['title', 'pause', 'busted', 'wasted']) this.el[k].classList.toggle('hidden', k !== name);
    this.el.hud.classList.toggle('hidden', name === 'title');
  }

  hud(world, muted) {
    const p = world.player;
    const e = this.el;
    e.health.style.width = `${p.health}%`;
    let stars = '';
    for (let i = 0; i < CFG.maxStars; i++) stars += i < p.stars ? '<b>★</b>' : '★';
    e.stars.innerHTML = stars;
    e.bust.style.width = `${clamp(p.busted, 0, 100)}%`;
    e.cash.textContent = p.cash.toLocaleString();
    e.speed.textContent = p.inCar ? Math.round(Math.abs(p.inCar.speed) * 3.6) : 0;
    e.speedBox.classList.toggle('hidden', !p.inCar);
    e.mission.textContent = world.missionText();
    e.notify.textContent = world.messages.length ? world.messages[0].text : '';
    e.crosshair.classList.toggle('hidden', !(p.armed || p.inCar) || world.state !== 'playing');
    e.mute.textContent = muted ? 'MUTED  ·  M' : '';
  }

  minimap(world) {
    const ctx = this.mapCtx;
    const p = world.getFocus();
    const S = 184, half = S / 2, scale = 0.72;
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#16222e';
    ctx.fillRect(0, 0, S, S);
    const mapX = (x) => half + (x - p.x) * scale;
    const mapY = (z) => half + (z - p.z) * scale;
    // Beach and water.
    ctx.fillStyle = '#d9c18d';
    ctx.fillRect(0, mapY(CFG.coastZ), S, S);
    ctx.fillStyle = '#247c93';
    ctx.fillRect(0, mapY(CFG.oceanZ), S, S);
    // Sea wall / roads.
    ctx.strokeStyle = 'rgba(255,255,255,.38)';
    ctx.lineWidth = 2.4 * scale * 2;
    ctx.beginPath();
    for (let i = 0; i <= CFG.grid; i++) {
      const x = mapX(roadCoord(i));
      if (x > -30 && x < S + 30) { ctx.moveTo(x, 0); ctx.lineTo(x, S); }
      const z = mapY(roadCoord(i));
      if (z > -30 && z < S + 30) { ctx.moveTo(0, z); ctx.lineTo(S, z); }
    }
    ctx.stroke();
    // Buildings.
    ctx.fillStyle = 'rgba(232,226,210,.5)';
    for (const b of world.city.boxes) {
      const x = mapX(b.x - b.w / 2), y = mapY(b.z - b.d / 2);
      if (x < -30 || y < -30 || x > S + 30 || y > S + 30) continue;
      ctx.fillRect(x, y, b.w * scale, b.d * scale);
    }
    // Traffic and police.
    ctx.fillStyle = 'rgba(190,225,255,.75)';
    for (const c of world.cars) {
      const x = mapX(c.x), y = mapY(c.z);
      if (x > 0 && y > 0 && x < S && y < S) ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    for (const cop of world.police) {
      const x = mapX(cop.x), y = mapY(cop.z);
      ctx.fillStyle = '#ff4d4d';
      ctx.beginPath(); ctx.arc(x, y, 3.6, 0, 6.283); ctx.fill();
    }
    const mark = world.missionMarker();
    if (mark) {
      const x = mapX(mark.x), y = mapY(mark.z);
      ctx.fillStyle = '#ffd257';
      ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x + 6, y); ctx.lineTo(x, y + 6); ctx.lineTo(x - 6, y);
      ctx.closePath(); ctx.fill();
    }
    // Player arrow.
    ctx.save();
    ctx.translate(half, half);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6.5, 7); ctx.lineTo(0, 3.5); ctx.lineTo(-6.5, 7);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,.5)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(half, half, S / 2 - 2, 0, 6.283); ctx.stroke();
  }
}
