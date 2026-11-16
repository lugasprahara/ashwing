// Ashwing's handoff program (Node 22, standard library only).
//
// The game itself is the static site in game/ — plain files a desktop
// browser runs offline, no build step and no network. This program hands
// it in: it copies game/ and screenshots/ into the output directory and
// writes dossier.json there with the vendored make.fun library, under
// the scorer's own caps (reference/gate.json of the best-game-01 kit).
//
// Run it:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Play it:
//   node serve.ts        then open http://localhost:8080

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function countFiles(dir: string): number {
  let n = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    n += entry.isDirectory() ? countFiles(join(dir, entry.name)) : 1;
  }
  return n;
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

console.log(`ashwing: handed in ${countFiles(join(out, 'game'))} game files and the screenshots to ${out}`);
