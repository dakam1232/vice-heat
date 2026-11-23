// Shared tuning constants and the warm coastal palette. All distances are in world metres.
export const CFG = {
  block: 60,
  roadHalf: 7,
  sidewalk: 3.6,
  gridMin: -210,
  gridMax: 210,
  limit: 248,
  oceanZ: -247,
  shoreZ: -218,
  eyeHeight: 1.65,
  walkSpeed: 5.2,
  runSpeed: 9.4,
  footAccel: 26,
  carMaxSpeed: 42,
  carAccel: 20,
  carBrake: 34,
  carTurn: 1.9,
  policeMaxSpeed: 39,
  wantedDecay: 11,
  bustedTime: 6.5,
  day: 0.72,
};

// Facade colours: sun-bleached pastels with a few saturated accents.
export const FACADES = [
  0xf2e2cb, 0xe9d9c6, 0xf6e8d7, 0xd9e5e6, 0xe6ded1, 0xf0d9c0,
  0xdce8e2, 0xe8d5cd, 0xf5e6bd, 0xd6dce4, 0xe9dfd5, 0xf1d3bb,
];

export const CAR_COLORS = [
  0xe8483c, 0x2fa8c9, 0xf2b63c, 0x38b879, 0x7c6de1, 0xf1f0e8,
  0xe4792e, 0x394a63, 0xd94f88, 0x9bbf3d,
];

export const PALETTE = {
  skyTop: 0x2f6fb5,
  skyHorizon: 0xffd2a1,
  sun: 0xffd98a,
  fog: 0xe8c9a5,
  sand: 0xe8d6aa,
  road: 0x454b55,
  roadLine: 0xf4e6c8,
  sidewalk: 0xcac7bb,
  ocean: 0x1687ad,
  oceanDeep: 0x0b5678,
  foam: 0xd9f3ef,
  leaf: 0x2f8d63,
  trunk: 0x8c6239,
  metal: 0x222935,
};

// Fixed landmarks, also used by the minimap and mission markers.
export const PLACES = {
  targetCar: { x: 30, z: -30 },
  garage: { x: 150, z: 150 },
  safehouse: { x: -150, z: 150 },
  checkpoints: [
    { x: -150, z: -150 }, { x: 90, z: -150 }, { x: 150, z: -30 },
    { x: 90, z: 150 }, { x: -90, z: 90 }, { x: -150, z: -30 },
  ],
  weapon: { x: -30, z: 90 },
  health: { x: 90, z: 30 },
};
