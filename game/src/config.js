// VICE HEAT - shared configuration. All distances are in world units (roughly metres).
export const CFG = {
  grid: 10,                 // ten blocks per side, eleven roads per axis
  block: 58,                // road centre spacing
  roadHalf: 9,              // half width of a road
  walk: 3.2,                // sidewalk width
  coastZ: 232,              // coastal road / beginning of the beach
  oceanZ: 302,              // shoreline
  extent: 290,
  dayFog: 0x9fc4d8,
  duskFog: 0xf3b98d,
  playerSpeed: 7.5,
  runSpeed: 12.5,
  carMaxSpeed: 38,
  carAccel: 17,
  carBrake: 26,
  carTurn: 1.9,
  maxStars: 5,
  saveKey: 'viceheat.save.v1',
};

export const PALETTE = {
  asphalt: 0x3b4046,
  asphaltLight: 0x4a5057,
  lane: 0xf6e3b3,
  sidewalk: 0xdccfbb,
  sand: 0xe8cf9c,
  ocean: 0x2a8fa6,
  buildings: [0xf2e3cf, 0xe9c9a8, 0xf0b79f, 0xdfe7e0, 0xf5e6b8, 0xc9dce0, 0xe7cdbd, 0xf4d6c2],
  trims: [0xffffff, 0xf6eedd, 0xe9ded0, 0xf3e6d6],
  trees: [0x2f7d55, 0x3a905f, 0x276c4a, 0x4a9c68],
  cars: [0xe84b3c, 0x2e86c1, 0xf2c14e, 0x2f9e79, 0xf0f0e6, 0x8e6ccf, 0xe4772a, 0x3d4d63],
  skin: [0xd9a478, 0xb97b52, 0x8d5a3c, 0xf0c69b, 0x6f4a34],
  clothes: [0xe8503e, 0x3686c4, 0x2c9c72, 0xe9b23c, 0x8d6ac7, 0x2f3f56],
};

// The four deterministic capture scenes.
export const SHOTS = {
  start: { seed: 11 },
  play: { seed: 17 },
  drive: { seed: 23 },
  chase: { seed: 29 },
};

export const MISSIONS = [
  { id: 'wheels', name: 'FIRST WHEELS', desc: 'Steal the marked cabriolet and deliver it to the garage', reward: 500 },
  { id: 'race', name: 'COASTAL RUSH', desc: 'Hit 6 checkpoints before the clock runs out', reward: 750 },
  { id: 'heat', name: 'HEAT ESCAPE', desc: 'Reach 3 stars, lose the cops, reach the safehouse', reward: 1000 },
];

export const roadCoord = (i) => -CFG.grid * CFG.block / 2 + i * CFG.block;
export const nearestRoad = (v) => Math.max(0, Math.min(CFG.grid, Math.round((v + CFG.extent) / CFG.block)));
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist2 = (ax, az, bx, bz) => (ax - bx) ** 2 + (az - bz) ** 2;
