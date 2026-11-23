// make.fun entrypoint. The playable game is the ./game folder: plain static files a
// desktop browser opens offline. This file only stages the hand-in — it copies game/
// and screenshots/ into the output directory and drops a dossier.json for the judge.
//
// Locally the grader's /output is replaced by MAKEFUN_OUTPUT_DIR:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// To play in a browser: node serve.ts, then open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const sourceDir = fileURLToPath(new URL('.', import.meta.url));
const targetDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Assemble the output tree: the game first, then the cover and any other renders.
mkdirSync(targetDir, { recursive: true });
cpSync(join(sourceDir, 'game'), join(targetDir, 'game'), { recursive: true });

const targetShots = join(targetDir, 'screenshots');
mkdirSync(targetShots, { recursive: true });
const sourceShots = join(sourceDir, 'screenshots');
if (existsSync(sourceShots)) cpSync(sourceShots, targetShots, { recursive: true });

// Same limits as reference/gate.json. buildDossier refuses an entry that breaks any of
// them, so passing them here makes a bad hand-in fail exactly where the scorer would.
// Only text_max_bytes changes the dossier's bytes; the rest are pure refusals.
const gates = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

writeFileSync(join(targetDir, 'dossier.json'), buildDossier(targetDir, gates));
