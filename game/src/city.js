// Procedural coastal city: road grid, buildings, palms, beach, ocean and sunset sky.
import * as THREE from 'three';
import { CFG, PALETTE, roadCoord, clamp } from './config.js';

const SUN = new THREE.Vector3(0.62, 0.26, 0.74).normalize();

const skyVert = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const skyFrag = `
varying vec3 vDir;
uniform vec3 uSun;
void main() {
  float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 low = vec3(1.00, 0.76, 0.56);
  vec3 mid = vec3(0.98, 0.56, 0.49);
  vec3 high = vec3(0.22, 0.42, 0.72);
  vec3 col = mix(low, mid, smoothstep(0.42, 0.56, h));
  col = mix(col, high, smoothstep(0.52, 0.95, h));
  float sun = max(dot(normalize(vDir), normalize(uSun)), 0.0);
  col += vec3(1.0, 0.62, 0.30) * pow(sun, 42.0) * 0.85;
  col += vec3(1.0, 0.82, 0.55) * pow(sun, 900.0) * 0.9;
  gl_FragColor = vec4(col, 1.0);
}`;

const buildVert = `
attribute vec3 aTint;
varying vec3 vWorld;
varying vec3 vNormalW;
varying vec3 vTint;
varying float vDepth;
void main() {
  vec4 wp = instanceMatrix * vec4(position, 1.0);
  vec4 mv = modelViewMatrix * wp;
  vWorld = wp.xyz;
  vNormalW = normalize(mat3(instanceMatrix) * normal);
  vTint = aTint;
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const buildFrag = `
precision highp float;
varying vec3 vWorld;
varying vec3 vNormalW;
varying vec3 vTint;
varying float vDepth;
uniform vec3 uSun;
uniform vec3 uFog;
uniform float uFogNear;
uniform float uFogFar;
float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec3 n = normalize(vNormalW);
  float diff = max(dot(n, uSun), 0.0);
  float shade = 0.62 + 0.38 * diff;
  vec3 base = vTint * shade;
  vec3 an = abs(n);
  vec2 uv = an.x > 0.5 ? vec2(vWorld.z, vWorld.y) : vec2(vWorld.x, vWorld.y);
  vec2 cell = vec2(3.2, 3.6);
  vec2 id = floor(uv / cell);
  vec2 g = fract(uv / cell);
  float win = step(0.16, g.x) * step(g.x, 0.84) * step(0.17, g.y) * step(g.y, 0.78);
  win *= step(4.2, vWorld.y);
  float lit = step(0.52, hash21(id + floor(vWorld.xz * 0.11)));
  vec3 glass = mix(vec3(0.19, 0.28, 0.34), vec3(1.0, 0.78, 0.42), lit * 0.86);
  base = mix(base * 0.96, glass, win * 0.85);
  float band = step(0.965, fract(vWorld.y / 3.6));
  base = mix(base, base * 1.18 + 0.05, band * 0.7);
  float roof = step(0.55, n.y);
  base = mix(base, mix(vTint, vec3(0.78, 0.74, 0.68), 0.42), roof);
  float fog = smoothstep(uFogNear, uFogFar, vDepth);
  base = mix(base, uFog, fog);
  gl_FragColor = vec4(base, 1.0);
}`;

const oceanVert = `
uniform float uTime;
varying vec3 vWorld;
varying float vDepth;
void main() {
  vec3 p = position;
  float w = sin(p.x * 0.035 + uTime * 0.9) * 0.34 + sin(p.y * 0.05 - uTime * 1.2) * 0.22;
  p.z += w;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vec4 mv = viewMatrix * wp;
  vWorld = wp.xyz;
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const oceanFrag = `
precision highp float;
varying vec3 vWorld;
varying float vDepth;
uniform float uTime;
uniform vec3 uFog;
uniform float uFogNear;
uniform float uFogFar;
void main() {
  float w = sin(vWorld.x * 0.11 + uTime * 1.4) * sin(vWorld.z * 0.09 - uTime);
  vec3 deep = vec3(0.05, 0.36, 0.48);
  vec3 shallow = vec3(0.20, 0.68, 0.70);
  vec3 col = mix(deep, shallow, clamp(0.45 + w * 0.35 + (700.0 - vWorld.z) / 900.0, 0.0, 1.0));
  float glitter = pow(max(sin(vWorld.x * 0.6 + uTime) * sin(vWorld.z * 0.5 - uTime * 0.7), 0.0), 12.0);
  col += vec3(1.0, 0.78, 0.45) * glitter * 0.28;
  float foam = 1.0 - smoothstep(0.0, 15.0, vWorld.z - ${CFG.oceanZ}.0);
  col = mix(col, vec3(0.93, 0.90, 0.80), foam * 0.55);
  float fog = smoothstep(uFogNear, uFogFar, vDepth);
  col = mix(col, uFog, fog);
  gl_FragColor = vec4(col, 1.0);
}`;

function quad(arrays, x, z, w, d, y, color) {
  const { pos, col } = arrays;
  const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
  const c = new THREE.Color(color);
  const verts = [x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z0, x1, y, z1, x0, y, z1];
  for (let i = 0; i < verts.length; i += 3) {
    pos.push(verts[i], verts[i + 1], verts[i + 2]);
    col.push(c.r, c.g, c.b);
  }
}

function quadMesh(arrays) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(arrays.pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(arrays.col, 3));
  g.computeVertexNormals();
  return new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
}

export function buildCity(scene, rng) {
  scene.fog = new THREE.Fog(CFG.duskFog, 180, 760);
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1400, 32, 20),
    new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: { uSun: { value: SUN } }, vertexShader: skyVert, fragmentShader: skyFrag }),
  );
  scene.add(sky);

  const hemi = new THREE.HemisphereLight(0xffe6c4, 0x6c7a80, 2.0);
  scene.add(hemi);
  const sunLight = new THREE.DirectionalLight(0xffd9ad, 2.3);
  sunLight.position.copy(SUN).multiplyScalar(220);
  scene.add(sunLight);
  scene.add(new THREE.AmbientLight(0xffffff, 0.28));

  // Ground, roads, markings, sidewalks and sand in one merged mesh.
  const q = { pos: [], col: [] };
  quad(q, 0, 0, 2600, 2600, -0.22, 0xcbbd97);
  for (let i = 0; i <= CFG.grid; i++) {
    const x = roadCoord(i);
    quad(q, x, 0, CFG.roadHalf * 2, 620, 0.01, PALETTE.asphalt);
    for (let z = -CFG.extent + 6; z < 285; z += 13) quad(q, x, z, 0.32, 5.4, 0.035, PALETTE.lane);
  }
  for (let j = 0; j <= CFG.grid - 1; j++) {
    const z = roadCoord(j);
    quad(q, 0, z, 620, CFG.roadHalf * 2, 0.012, PALETTE.asphalt);
    for (let x = -CFG.extent + 6; x < 285; x += 13) quad(q, x, z, 5.4, 0.32, 0.036, PALETTE.lane);
    for (let i = 0; i <= CFG.grid; i++) {
      const cx = roadCoord(i);
      for (let k = -2; k <= 2; k++) quad(q, cx + k * 2.9, z, 1.5, 1.7, 0.04, 0xf0e6d2);
    }
  }
  for (let i = 0; i < CFG.grid; i++) {
    for (let j = 0; j < CFG.grid; j++) {
      const cx = roadCoord(i) + CFG.block / 2;
      const cz = roadCoord(j) + CFG.block / 2;
      const inner = CFG.block - CFG.roadHalf * 2 - 0.8;
      if (j < CFG.grid - 1) {
        quad(q, cx, cz, inner, inner, 0.19, (i + j) % 5 === 0 ? 0xe4d6c0 : PALETTE.sidewalk);
        // faint kerb outline
        quad(q, cx, cz - inner / 2, inner, 0.5, 0.22, 0xbfb3a2);
        quad(q, cx, cz + inner / 2, inner, 0.5, 0.22, 0xbfb3a2);
      } else {
        quad(q, cx, cz, inner, inner, 0.05, PALETTE.sand);
      }
    }
  }
  // The whole beach and the shore.
  quad(q, 0, 266, 640, 48, 0.02, PALETTE.sand);
  const ground = quadMesh(q);
  ground.renderOrder = -2;
  scene.add(ground);

  // Ocean.
  const oceanUniforms = {
    uTime: { value: 0 },
    uFog: { value: new THREE.Color(CFG.duskFog) },
    uFogNear: { value: 260 },
    uFogFar: { value: 900 },
  };
  const oceanGeo = new THREE.PlaneGeometry(2200, 1500, 56, 40);
  const ocean = new THREE.Mesh(oceanGeo, new THREE.ShaderMaterial({
    uniforms: oceanUniforms, vertexShader: oceanVert, fragmentShader: oceanFrag,
  }));
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, -0.10, CFG.oceanZ + 740);
  scene.add(ocean);

  // Buildings: two to four per city block in the nine inland rows.
  const boxes = [];
  const half = CFG.block / 2 - CFG.roadHalf - 3.4;
  for (let i = 0; i < CFG.grid; i++) {
    for (let j = 0; j < CFG.grid - 1; j++) {
      const cx = roadCoord(i) + CFG.block / 2;
      const cz = roadCoord(j) + CFG.block / 2;
      for (let sx = -1; sx <= 1; sx += 2) {
        for (let sz = -1; sz <= 1; sz += 2) {
          if (rng.chance(0.1)) continue;
          const district = Math.exp(-(((i - 5.5) ** 2 + (j - 4) ** 2) / 22));
          const baseH = 8 + district * 36 + rng.float(0, 17) + (j > 5 ? 10 : 0);
          const h = clamp(baseH, 7, 76);
          const w = half - rng.float(1.2, 3.2);
          const d = half - rng.float(1.2, 3.2);
          const x = cx + sx * (half / 2 + 0.6) + rng.float(-0.6, 0.6);
          const z = cz + sz * (half / 2 + 0.6) + rng.float(-0.6, 0.6);
          boxes.push({ x, z, w, d, h, tint: rng.pick(PALETTE.buildings) });
        }
      }
    }
  }
  const bgeo = new THREE.BoxGeometry(1, 1, 1);
  const tints = new Float32Array(boxes.length * 3);
  const bmesh = new THREE.InstancedMesh(bgeo, new THREE.ShaderMaterial({
    uniforms: {
      uSun: { value: SUN },
      uFog: { value: new THREE.Color(CFG.duskFog) },
      uFogNear: { value: 170 },
      uFogFar: { value: 730 },
    },
    vertexShader: buildVert, fragmentShader: buildFrag,
  }), boxes.length);
  const mats = new THREE.Matrix4();
  boxes.forEach((b, k) => {
    mats.makeScale(b.w, b.h, b.d);
    mats.setPosition(b.x, b.h / 2 + 0.19, b.z);
    bmesh.setMatrixAt(k, mats);
    const c = new THREE.Color(b.tint);
    tints[k * 3] = c.r; tints[k * 3 + 1] = c.g; tints[k * 3 + 2] = c.b;
  });
  bgeo.setAttribute('aTint', new THREE.InstancedBufferAttribute(tints, 3));
  bmesh.instanceMatrix.needsUpdate = true;
  bmesh.frustumCulled = false;
  scene.add(bmesh);

  // Palm trees: an instanced trunk and seven drooping fronds each.
  const palms = [];
  for (let i = 0; i <= CFG.grid; i++) {
    const x = roadCoord(i);
    for (let z = -250; z < 288; z += rng.float(21, 32)) {
      if (z < 232 && rng.chance(0.7)) continue;
      palms.push({ x: x + rng.sign() * rng.float(11.4, 14.5), z, h: rng.float(6.5, 11.5), r: rng.float(0, Math.PI * 2) });
    }
  }
  for (let k = 0; k < 26; k++) palms.push({ x: rng.float(-280, 280), z: rng.float(242, 294), h: rng.float(7, 12), r: rng.float(0, 6.28) });
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.46, 1, 6);
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: 0x8b6a4c }), palms.length);
  palms.forEach((p, k) => {
    mats.makeScale(1, p.h, 1);
    mats.setPosition(p.x, p.h / 2 + 0.2, p.z);
    trunks.setMatrixAt(k, mats);
  });
  trunks.instanceMatrix.needsUpdate = true;
  scene.add(trunks);

  // One frond is a tapered fan of triangles; instances carry rotation and scale.
  const fg = new THREE.BufferGeometry();
  const fv = [0, 0, 0, 0.3, 0.12, -0.5, 0.55, -0.05, -1, 0, 0, 0, 0.55, -0.05, -1, 0.28, -0.16, -1.5, 0, 0, 0, 0.28, -0.16, -1.5, -0.28, -0.16, -1.5, 0, 0, 0, -0.28, -0.16, -1.5, -0.55, -0.05, -1, 0, 0, 0, -0.55, -0.05, -1, -0.3, 0.12, -0.5];
  fg.setAttribute('position', new THREE.Float32BufferAttribute(fv, 3));
  fg.computeVertexNormals();
  const fronds = new THREE.InstancedMesh(fg, new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }), palms.length * 7);
  let fi = 0;
  const qat = new THREE.Quaternion();
  const posv = new THREE.Vector3();
  const scl = new THREE.Vector3();
  for (const p of palms) {
    for (let f = 0; f < 7; f++) {
      const a = p.r + f * Math.PI * 2 / 7 + rng.float(-0.14, 0.14);
      qat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a);
      posv.set(p.x, p.h + 0.14, p.z);
      const s = rng.float(1.9, 3.1);
      scl.set(s, s, s);
      mats.compose(posv, qat, scl);
      fronds.setMatrixAt(fi, mats);
      fronds.setColorAt(fi, new THREE.Color(rng.pick(PALETTE.trees)));
      fi++;
    }
  }
  fronds.instanceMatrix.needsUpdate = true;
  if (fronds.instanceColor) fronds.instanceColor.needsUpdate = true;
  scene.add(fronds);

  const blockers = boxes.map(({ x, z, w, d, h }) => ({ x, z, w, d, h }));
  function isBlocked(x, z, r = 1) {
    for (const b of blockers) {
      if (Math.abs(x - b.x) < b.w / 2 + r && Math.abs(z - b.z) < b.d / 2 + r) return true;
    }
    return false;
  }
  function lineOfSight(ax, az, bx, bz) {
    const steps = Math.min(40, Math.ceil(Math.hypot(ax - bx, az - bz) / 9));
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      if (isBlocked(ax + (bx - ax) * t, az + (bz - az) * t, 0.7)) return false;
    }
    return true;
  }
  return {
    boxes: blockers, palms, sun: SUN, isBlocked, lineOfSight,
    update(t) { oceanUniforms.uTime.value = t; },
  };
}
