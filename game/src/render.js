// Three.js renderer, three camera rigs (cinematic / on-foot / chase) and the canvas minimap.
import * as THREE from '../three.module.min.js';
import { CFG, PALETTE } from './config.js';

export class Renderer3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.42;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(PALETTE.skyHorizon);
    this.camera = new THREE.PerspectiveCamera(63, window.innerWidth / window.innerHeight, 0.4, 2200);
    this.camera.position.set(0, 20, 40);
    this.tmp = new THREE.Vector3();
    this.look = new THREE.Vector3();
    window.addEventListener('resize', () => {
      const w = window.innerWidth, h = window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h, false);
    });
  }

  title(t, instant = false) {
    const a = t * 0.045;
    const p = this.tmp.set(Math.sin(a) * 34 + 32, 45 + Math.sin(a * 0.6) * 4, -84 + Math.cos(a) * 12);
    if (instant) this.camera.position.copy(p);
    else this.camera.position.lerp(p, 0.035);
    this.look.set(-16, 12, -205);
    this.camera.lookAt(this.look);
  }

  foot(pos, yaw, pitch, instant = false) {
    const f = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const desired = this.tmp.copy(pos).addScaledVector(f, -8.4);
    desired.y += 4.25 + pitch * 5;
    if (instant) this.camera.position.copy(desired);
    else this.camera.position.lerp(desired, 0.16);
    this.look.copy(pos).addScaledVector(f, 2.4);
    this.look.y = pos.y + 1.65 - pitch * 1.6;
    this.camera.lookAt(this.look);
  }

  chase(pos, heading, speed, instant = false, biasZ = 0) {
    const f = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
    const distance = 10.6 + Math.min(4, Math.abs(speed) * 0.12);
    const desired = this.tmp.copy(pos).addScaledVector(f, -distance);
    desired.y += 4.9;
    if (instant) this.camera.position.copy(desired);
    else this.camera.position.lerp(desired, 0.12);
    this.look.copy(pos).addScaledVector(f, 8);
    this.look.y = pos.y + 1.5;
    this.look.z += biasZ;
    this.camera.lookAt(this.look);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

// A top-down 2D minimap drawn each frame: roads, shoreline, the player's arrow,
// police blips and the active mission marker.
export function drawMinimap(canvas, world) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height, c = W / 2, scale = 0.62;
  const p = world.playerPos();
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#cdd8c4';
  ctx.fillRect(0, 0, W, H);
  const tx = (x) => c + (x - p.x) * scale;
  const ty = (z) => c + (z - p.z) * scale;
  // Ocean and beach.
  if (ty(CFG.oceanZ) < H) {
    ctx.fillStyle = '#2d98bd';
    ctx.fillRect(0, 0, W, Math.max(0, ty(CFG.oceanZ)));
    ctx.fillStyle = '#e9d8a9';
    ctx.fillRect(0, Math.max(0, ty(CFG.oceanZ)), W, Math.max(0, ty(CFG.shoreZ) - ty(CFG.oceanZ)));
  }
  // Building footprints.
  ctx.fillStyle = 'rgba(106,113,112,0.32)';
  for (const b of world.city.colliders) {
    const x = tx(b.x - b.hw), y = ty(b.z - b.hd);
    if (x > W || y > H || x + b.hw * 2 * scale < 0 || y + b.hd * 2 * scale < 0) continue;
    ctx.fillRect(x, y, b.hw * 2 * scale, b.hd * 2 * scale);
  }
  // Road grid.
  ctx.strokeStyle = '#59606b';
  ctx.lineWidth = CFG.roadHalf * 2 * scale;
  for (const r of world.city.roads) {
    ctx.beginPath(); ctx.moveTo(tx(r), 0); ctx.lineTo(tx(r), H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, ty(r)); ctx.lineTo(W, ty(r)); ctx.stroke();
  }
  // Mission marker.
  if (world.activeMarker()) {
    const m = world.activeMarker();
    ctx.fillStyle = '#ffd23f';
    ctx.strokeStyle = '#5a3d00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tx(m.x), ty(m.z) - 8);
    ctx.lineTo(tx(m.x) + 8, ty(m.z));
    ctx.lineTo(tx(m.x), ty(m.z) + 8);
    ctx.lineTo(tx(m.x) - 8, ty(m.z));
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  // Police blips.
  for (const car of world.police) {
    const q = car.car.group.position;
    ctx.fillStyle = '#e64a3b';
    ctx.beginPath(); ctx.arc(tx(q.x), ty(q.z), 4, 0, Math.PI * 2); ctx.fill();
  }
  // Player arrow.
  const h = world.mode === 'car' ? world.vehicle.heading : world.playerHeading;
  ctx.save();
  ctx.translate(c, c);
  ctx.rotate(-h);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#1c2d3a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -10); ctx.lineTo(7, 8); ctx.lineTo(0, 4); ctx.lineTo(-7, 8);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = 'rgba(30,45,55,0.6)';
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, W - 3, H - 3);
}
