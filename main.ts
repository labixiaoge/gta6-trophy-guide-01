// Leonida Trophy Guide — main.ts (Node 22, standard library only).
// Hands the entry in: copies this repo's app/ and screenshots/ into the
// output directory and writes /output/dossier.json with the vendored
// make.fun library, the way the kit's starter does. vendor/makefun-frontend.ts
// is the kit's own copy and must not be touched: the scorer rebuilds the
// dossier with its copy and compares the two byte for byte.
//
// Before copying, this file checks the scorer's caps itself
// (reference/gate.json) and fails fast with a plain message instead of
// letting buildDossier refuse halfway through: app/ holds at most 993
// files and directories and 48 MiB in total, screenshots holds at most
// 4 files of at most 256 KiB each. The dossier text cap (163,840 bytes)
// is enforced by buildDossier, so it is passed through as-is.
//
// Run it outside the grader with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Inside the grader MAKEFUN_OUTPUT_DIR is unset and the output goes to /output.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const APP_MAX_ENTRIES = 993;
const APP_MAX_BYTES = 50331648;
const SHOTS_MAX_FILES = 4;
const SHOTS_MAX_BYTES = 262144;
const TEXT_MAX_BYTES = 163840;

const here = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Walk a directory tree, counting every file and directory, plus file bytes.
function measureTree(root: string): { entries: number; bytes: number } {
  let entries = 0;
  let bytes = 0;
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      const stats = statSync(path);
      entries += 1;
      if (stats.isDirectory()) walk(path);
      else if (stats.isFile()) bytes += stats.size;
    }
  };
  walk(root);
  return { entries, bytes };
}

function checkCaps(): void {
  const app = measureTree(join(here, 'app'));
  if (app.entries > APP_MAX_ENTRIES) {
    throw new Error(`app/ has ${app.entries} files and directories, over the ${APP_MAX_ENTRIES} cap`);
  }
  if (app.bytes > APP_MAX_BYTES) {
    throw new Error(`app/ is ${app.bytes} bytes, over the ${APP_MAX_BYTES} cap`);
  }
  const shotsDir = join(here, 'screenshots');
  if (!existsSync(shotsDir)) throw new Error('screenshots/ is missing');
  const shots = readdirSync(shotsDir).filter((name) => !name.startsWith('.'));
  if (shots.length === 0 || shots.length > SHOTS_MAX_FILES) {
    throw new Error(`screenshots/ holds ${shots.length} files, need 1 to ${SHOTS_MAX_FILES}`);
  }
  for (const name of shots) {
    const size = statSync(join(shotsDir, name)).size;
    if (size > SHOTS_MAX_BYTES) {
      throw new Error(`screenshots/${name} is ${size} bytes, over the ${SHOTS_MAX_BYTES} cap`);
    }
  }
}

checkCaps();

mkdirSync(outDir, { recursive: true });
// A re-run must not carry stale files forward: cpSync never deletes, so a
// screenshot removed from the repo would linger in the output and be handed
// in again. Clear the two copied trees first, then copy them fresh.
rmSync(join(outDir, 'app'), { recursive: true, force: true });
rmSync(join(outDir, 'screenshots'), { recursive: true, force: true });
cpSync(join(here, 'app'), join(outDir, 'app'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
cpSync(join(here, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes
// the bytes; the others refuse an entry the scorer would refuse anyway
// (more than 4 screenshots or one over 256 KiB; more than 993 files and
// directories in app/ or 48 MiB of app files: app/ counts beside /output's
// own 1000-entry cap, its screenshots/ and dossier.json).
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: TEXT_MAX_BYTES,
    screenshots: { max: SHOTS_MAX_FILES, max_bytes: SHOTS_MAX_BYTES },
    app_max_files: APP_MAX_ENTRIES,
    app_max_bytes: APP_MAX_BYTES,
  }),
);
