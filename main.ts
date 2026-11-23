// Hand-in entrypoint. Run `node main.ts` with MAKEFUN_OUTPUT_DIR set to the folder that
// should receive the entry (the grader uses /output). Standard library only; the TypeScript
// here is erasable, so Node 22+ runs this file directly with no build step.
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');

// A fresh hand-in each time: no stale files from a previous copy can survive.
mkdirSync(out, { recursive: true });
for (const name of ['game', 'screenshots']) {
  rmSync(join(out, name), { recursive: true, force: true });
  cpSync(join(here, name), join(out, name), { recursive: true });
}

const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);
console.log(`Hand-in written to ${out}: game/, screenshots/, dossier.json (${dossier.length} bytes)`);
