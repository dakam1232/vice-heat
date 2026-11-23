// Procedural coastal city: flat-shaded block grid, pastel facades, palms, beach, ocean and sky.
// Everything is built from geometry and canvas textures; nothing is loaded from the network.
import * as THREE from '../three.module.min.js';
import { CFG, FACADES, PALETTE } from './config.js';

function facadeTexture(rng, lit = false) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 128, 128);
  const cols = 4, rows = 6;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const px = 10 + x * 29, py = 8 + y * 20;
      const on = rng.chance(lit ? 0.42 : 0.22);
      g.fillStyle = on ? '#ffe8ad' : '#7e8794';
      g.globalAlpha = on ? 0.92 : 0.52;
      g.fillRect(px, py, 17, 11);
      g.globalAlpha = 1;
      g.fillStyle = 'rgba(60,70,80,0.35)';
      g.fillRect(px + 8, py, 1.4, 11);
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.fillRect(px - 1, py + 11, 19, 2);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  return tex;
}

function makeSky(scene) {
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(PALETTE.skyTop) },
      horizon: { value: new THREE.Color(PALETTE.skyHorizon) },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: [
      'varying vec3 vP; uniform vec3 top; uniform vec3 horizon;',
      'void main(){ float h = clamp(normalize(vP).y * 1.7 + 0.12, 0.0, 1.0);',
      'vec3 col = mix(horizon, top, pow(h, 0.72)); gl_FragColor = vec4(col, 1.0); }',
    ].join('\n'),
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 24, 16), skyMat);
  sky.renderOrder = -2;
  scene.add(sky);

  const sunDir = new THREE.Vector3(-0.42, 0.16, -1).normalize();
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(31, 20, 14),
    new THREE.MeshBasicMaterial({ color: 0xfff1be, fog: false }),
  );
  sun.position.copy(sunDir).multiplyScalar(1050);
  sun.renderOrder = -1;
  scene.add(sun);

  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = glowCanvas.height = 128;
  const g = glowCanvas.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,236,178,0.78)');
  grad.addColorStop(0.4, 'rgba(255,204,140,0.32)');
  grad.addColorStop(1, 'rgba(255,190,120,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(glowCanvas), transparent: true, depthWrite: false, fog: false,
    blending: THREE.AdditiveBlending,
  }));
  glow.position.copy(sunDir).multiplyScalar(1040);
  glow.scale.set(360, 360, 1);
  glow.renderOrder = -1;
  scene.add(glow);
  return sunDir;
}

function plane(scene, w, h, x, z, y, material) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  scene.add(m);
  return m;
}

function makePalm(rng) {
  const g = new THREE.Group();
  const h = rng.range(6.5, 10.5);
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.45, h, 6),
    new THREE.MeshLambertMaterial({ color: PALETTE.trunk, flatShading: true }),
  );
  trunk.position.y = h / 2;
  trunk.rotation.z = rng.range(-0.09, 0.09);
  g.add(trunk);
  const leafMat = new THREE.MeshLambertMaterial({ color: PALETTE.leaf, flatShading: true, side: THREE.DoubleSide });
  const n = rng.int(6, 8);
  for (let i = 0; i < n; i++) {
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.85, 5.4, 3), leafMat);
    const a = (i / n) * Math.PI * 2 + rng.range(-0.2, 0.2);
    frond.position.set(Math.cos(a) * 2.2, h - 0.35 - rng.range(0, 0.5), Math.sin(a) * 2.2);
    frond.rotation.set(Math.cos(a) * 1.16, -a, Math.sin(a) * 1.16);
    frond.scale.set(1, 1, 0.24);
    g.add(frond);
  }
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 0), leafMat);
  crown.position.y = h - 0.2;
  g.add(crown);
  return g;
}

export function buildCity(scene, rng) {
  const sunDir = makeSky(scene);
  scene.fog = new THREE.Fog(PALETTE.fog, 260, 1050);
  scene.add(new THREE.HemisphereLight(0xfff1d6, 0x6b7b74, 1.55));
  const sun = new THREE.DirectionalLight(0xffe2b4, 2.05);
  sun.position.copy(sunDir).multiplyScalar(240);
  scene.add(sun);

  const colliders = [];
  const roads = [];
  for (let i = 0; i < 8; i++) roads.push(CFG.gridMin + i * CFG.block);

  // Ground: a warm concrete basin, sandy beach and blue ocean beyond the shore.
  plane(scene, 560, 490, 0, 15, -0.06, new THREE.MeshLambertMaterial({ color: 0xd9c9aa }));
  plane(scene, 540, 76, 0, -238, 0.005, new THREE.MeshLambertMaterial({ color: PALETTE.sand }));
  // Water starts at the shoreline and reaches the horizon: no sandy gap.
  plane(scene, 1600, 700, 0, -600, -0.35, new THREE.MeshLambertMaterial({ color: PALETTE.ocean }));
  plane(scene, 1600, 700, 0, -1300, -0.5, new THREE.MeshLambertMaterial({ color: PALETTE.oceanDeep }));
  plane(scene, 1200, 2.6, 0, -251, 0.03, new THREE.MeshBasicMaterial({
    color: PALETTE.foam, transparent: true, opacity: 0.55, depthWrite: false,
  }));

  const waves = [];
  for (let i = 0; i < 12; i++) {
    const w = plane(scene, rng.range(60, 210), rng.range(0.8, 2.4), rng.range(-280, 280), -258 - i * 19, -0.28,
      new THREE.MeshBasicMaterial({ color: 0xcfeef0, transparent: true, opacity: 0.26 - i * 0.012, depthWrite: false }));
    waves.push({ mesh: w, base: w.position.x, speed: rng.range(1.4, 4.5) });
  }
  // Sun glitter on the water.
  plane(scene, 110, 330, -180, -390, -0.24, new THREE.MeshBasicMaterial({
    color: 0xffd9a0, transparent: true, opacity: 0.13, depthWrite: false,
  }));

  const sidewalkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.road });
  const lineMat = new THREE.MeshBasicMaterial({ color: PALETTE.roadLine });
  const lineGeo = new THREE.PlaneGeometry(0.36, 5.2);
  const stripLen = 500;

  for (const c of roads) {
    plane(scene, stripLen, CFG.roadHalf * 2 + CFG.sidewalk * 2, 0, c, 0.012, sidewalkMat);
    plane(scene, stripLen, CFG.roadHalf * 2 + CFG.sidewalk * 2, c, 0, 0.011, sidewalkMat);
    plane(scene, stripLen, CFG.roadHalf * 2, 0, c, 0.022, roadMat);
    plane(scene, CFG.roadHalf * 2, stripLen, c, 0, 0.023, roadMat);
    for (let p = -244; p <= 244; p += 15) {
      for (const intersect of roads) {
        if (Math.abs(p - intersect) < 11) continue;
        const m = new THREE.Mesh(lineGeo, lineMat);
        m.rotation.x = -Math.PI / 2;
        m.position.set(p, 0.03, c);
        scene.add(m);
        const m2 = new THREE.Mesh(lineGeo, lineMat);
        m2.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
        m2.position.set(c, 0.031, p);
        scene.add(m2);
      }
    }
  }

  // Buildings: four varied lots per city block, with a handful of empty lots for parking.
  const texLit = facadeTexture(rng, false);
  const texDark = facadeTexture(rng, false);
  const texWarm = facadeTexture(rng, true);
  const textures = [texLit, texDark, texWarm];
  const roofMat = new THREE.MeshLambertMaterial({ color: 0xb9a995, flatShading: true });
  const trimMat = new THREE.MeshLambertMaterial({ color: 0xf6efe1 });
  const materials = FACADES.map((color) => textures.map((tex) => new THREE.MeshLambertMaterial({
    color, map: tex, emissiveMap: tex, emissive: new THREE.Color(color).multiplyScalar(0.12),
    flatShading: true,
  })));
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  for (let ix = 0; ix < roads.length - 1; ix++) {
    for (let iz = 0; iz < roads.length - 1; iz++) {
      const cx = (roads[ix] + roads[ix + 1]) / 2;
      const cz = (roads[iz] + roads[iz + 1]) / 2;
      for (let sx = -1; sx <= 1; sx += 2) {
        for (let sz = -1; sz <= 1; sz += 2) {
          if (rng.chance(0.1)) continue;
          const w = rng.range(15, 17.2);
          const d = rng.range(15, 17.2);
          const h = rng.range(9, 44) * (Math.abs(cx) < 100 && Math.abs(cz) < 100 ? 1.18 : 1);
          const bx = cx + sx * 9.7 + rng.range(-0.6, 0.6);
          const bz = cz + sz * 9.7 + rng.range(-0.6, 0.6);
          const mat = materials[rng.int(0, materials.length - 1)][rng.int(0, 2)];
          const b = new THREE.Mesh(boxGeo, mat);
          b.scale.set(w, h, d);
          b.position.set(bx, h / 2, bz);
          scene.add(b);
          colliders.push({ x: bx, z: bz, hw: w / 2, hd: d / 2, height: h });
          const roof = new THREE.Mesh(boxGeo, roofMat);
          roof.scale.set(w * 0.82, 0.8, d * 0.82);
          roof.position.set(bx, h + 0.4, bz);
          scene.add(roof);
          if (rng.chance(0.4)) {
            const pent = new THREE.Mesh(boxGeo, trimMat);
            const pw = rng.range(3, 7);
            pent.scale.set(pw, rng.range(2, 5), pw);
            pent.position.set(bx + rng.range(-3, 3), h + 2, bz + rng.range(-3, 3));
            scene.add(pent);
          }
        }
      }
    }
  }

  // Palms line the coastal road and the promenade, plus a few inland avenues.
  for (let x = -214; x <= 214; x += 28) {
    const p1 = makePalm(rng);
    p1.position.set(x + rng.range(-3, 3), 0, -228 + rng.range(-2, 2));
    p1.rotation.y = rng.range(0, 6.28);
    scene.add(p1);
    if (rng.chance(0.62)) {
      const p2 = makePalm(rng);
      p2.position.set(x + rng.range(-4, 4), 0, -192 + rng.range(-2, 2));
      p2.rotation.y = rng.range(0, 6.28);
      scene.add(p2);
    }
  }
  for (let z = -60; z <= 210; z += 84) {
    for (const side of [-1, 1]) {
      const p = makePalm(rng);
      p.position.set(side * 230 + rng.range(-3, 3), 0, z + rng.range(-4, 4));
      scene.add(p);
    }
  }

  // Small waterfront boards and a pier add recognizable landmarks to the vista.
  const wood = new THREE.MeshLambertMaterial({ color: 0x9d7a52 });
  const pier = new THREE.Mesh(boxGeo, wood);
  pier.scale.set(11, 0.7, 58);
  pier.position.set(-150, 0.3, -258);
  scene.add(pier);
  for (const x of [-154, -146]) {
    for (const z of [-238, -258, -278]) {
      const post = new THREE.Mesh(boxGeo, wood);
      post.scale.set(0.8, 4, 0.8);
      post.position.set(x, -1.4, z);
      scene.add(post);
    }
  }

  return {
    roads,
    colliders,
    sunDir,
    update(t) {
      for (const w of waves) {
        w.mesh.position.x = w.base + Math.sin(t * 0.16 * w.speed) * 8;
      }
    },
  };
}
