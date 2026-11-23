// make.fun hand-in builder. The playable title lives in ./game as plain static
// files for a desktop browser, and this script only assembles what the judge
// reads: a copy of the game, the render folder, and a dossier describing both.
//
// Try it locally with:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// To play the game:      node serve.ts   (then open http://localhost:8080)

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The directory holding this script doubles as the source of the hand-in.
function rootFolder(): string {
  return fileURLToPath(new URL('.', import.meta.url));
}

// Inside the grader this is /output; for local runs the variable stands in for it.
function outputFolder(): string {
  return process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
}

// Gate numbers copied from reference/gate.json. Handing these to buildDossier
// makes an invalid submission fail here at the same point the scorer would.
// Only the text ceiling influences the dossier bytes; the rest just reject.
function gateLimits() {
  return {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  };
}

// Place a folder's contents under a fresh destination directory.
function cloneFolder(from: string, to: string): void {
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
}

// Build the whole delivery tree. Renders are staged ahead of the game; the
// dossier is written last so it sees the finished output directory.
function deliver(): void {
  const home = rootFolder();
  const landing = outputFolder();
  mkdirSync(landing, { recursive: true });

  const renderSource = join(home, 'screenshots');
  const renderTarget = join(landing, 'screenshots');
  if (existsSync(renderSource)) {
    cloneFolder(renderSource, renderTarget);
  } else {
    mkdirSync(renderTarget, { recursive: true });
  }

  cloneFolder(join(home, 'game'), join(landing, 'game'));

  const manifest = buildDossier(landing, gateLimits());
  writeFileSync(join(landing, 'dossier.json'), manifest);
}

deliver();
