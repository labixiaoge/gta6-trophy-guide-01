// Leonida Trophy Guide — main.ts (Node 22, standard library only).
//
// The entry point the competition runs: it stages this repository's app/
// and screenshots/ into the output directory and writes
// /output/dossier.json with the vendored make.fun library, exactly the way
// the kit's starter does. vendor/makefun-frontend.ts is the kit's own copy
// and must stay untouched: the scorer rebuilds the dossier with its copy
// and compares the two byte for byte, so any change there fails the entry.
//
// Three preflight checks run before anything is copied, so a broken entry
// fails here with a plain message instead of halfway through buildDossier:
//   1. the trophy data itself — app/data/trophies.json must hold 55
//      trophies, each with a name and a non-blank guide, and no name twice;
//   2. the scorer's size caps (reference/gate.json) — app/ holds at most
//      993 files and directories and 48 MiB in total, screenshots holds at
//      most 4 files of at most 256 KiB each. The dossier text cap
//      (163,840 bytes) is enforced by buildDossier, so it is passed
//      through as-is.
// After staging, the run reports what it staged and confirms the dossier
// was written, so a silent failure is impossible to miss.
//
// Run it outside the grader with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Inside the grader MAKEFUN_OUTPUT_DIR is unset and the output goes to /output.

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

// Caps from the scorer (reference/gate.json).
const LIMITS = {
  appEntries: 993,
  appBytes: 48 * 1024 * 1024,
  shots: 4,
  shotBytes: 256 * 1024,
  dossierTextBytes: 163840,
};

const EXPECTED_TROPHIES = 55;

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Sanity-check the trophy data before staging: the gate refuses an entry
// whose trophies.json does not name every official trophy with a guide.
function checkTrophyData(): number {
  const raw = readFileSync(join(repoRoot, 'app', 'data', 'trophies.json'), 'utf-8');
  const doc = JSON.parse(raw);
  const list = Array.isArray(doc) ? doc : doc.trophies;
  if (!Array.isArray(list)) throw new Error('app/data/trophies.json holds no trophies array');
  if (list.length !== EXPECTED_TROPHIES) {
    throw new Error(`trophies.json holds ${list.length} trophies, expected ${EXPECTED_TROPHIES}`);
  }
  const nameless = list.filter((t) => typeof t.name !== 'string' || !t.name.trim());
  if (nameless.length) throw new Error(`${nameless.length} trophies have no name`);
  const guideless = list.filter((t) => typeof t.guide !== 'string' || !t.guide.trim());
  if (guideless.length) {
    throw new Error(`${guideless.length} trophies have no guide: ${guideless.map((t) => t.name).join(', ')}`);
  }
  const seen = new Set<string>();
  for (const t of list) {
    if (seen.has(t.name)) throw new Error(`duplicate trophy name in trophies.json: ${t.name}`);
    seen.add(t.name);
  }
  return list.length;
}

// Recursively total a tree: every file and directory, plus file bytes.
function totalTree(root: string): { entries: number; bytes: number } {
  let entries = 0;
  let bytes = 0;
  const descend = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      const info = statSync(path);
      entries += 1;
      if (info.isDirectory()) descend(path);
      else if (info.isFile()) bytes += info.size;
    }
  };
  descend(root);
  return { entries, bytes };
}

function checkSizeCaps(): { app: { entries: number; bytes: number }; shots: number } {
  const app = totalTree(join(repoRoot, 'app'));
  if (app.entries > LIMITS.appEntries) {
    throw new Error(`app/ has ${app.entries} files and directories, over the ${LIMITS.appEntries} cap`);
  }
  if (app.bytes > LIMITS.appBytes) {
    throw new Error(`app/ is ${app.bytes} bytes, over the ${LIMITS.appBytes} cap`);
  }
  const shotsDir = join(repoRoot, 'screenshots');
  if (!existsSync(shotsDir)) throw new Error('screenshots/ is missing');
  const shots = readdirSync(shotsDir).filter((name) => !name.startsWith('.'));
  if (shots.length === 0 || shots.length > LIMITS.shots) {
    throw new Error(`screenshots/ holds ${shots.length} files, need 1 to ${LIMITS.shots}`);
  }
  for (const name of shots) {
    const size = statSync(join(shotsDir, name)).size;
    if (size > LIMITS.shotBytes) {
      throw new Error(`screenshots/${name} is ${size} bytes, over the ${LIMITS.shotBytes} cap`);
    }
  }
  return { app, shots: shots.length };
}

// Stage one tree into the output directory, clearing any stale copy first:
// cpSync never deletes, so a file removed from the repo would otherwise
// linger in the output and be handed in again.
function stageTree(name: 'app' | 'screenshots'): void {
  const target = join(outputDir, name);
  rmSync(target, { recursive: true, force: true });
  cpSync(join(repoRoot, name), target, { recursive: true });
}

const trophyCount = checkTrophyData();
const sizes = checkSizeCaps();

mkdirSync(outputDir, { recursive: true });
stageTree('app');
stageTree('screenshots');

// The scorer's own caps (reference/gate.json): only the text cap shapes
// the bytes; the others refuse an entry the scorer would refuse anyway
// (more than 4 screenshots or one over 256 KiB; more than 993 files and
// directories in app/ or 48 MiB of app files: app/ counts beside /output's
// own 1000-entry cap, its screenshots/ and dossier.json).
const dossierPath = join(outputDir, 'dossier.json');
writeFileSync(
  dossierPath,
  buildDossier(outputDir, {
    text_max_bytes: LIMITS.dossierTextBytes,
    screenshots: { max: LIMITS.shots, max_bytes: LIMITS.shotBytes },
    app_max_files: LIMITS.appEntries,
    app_max_bytes: LIMITS.appBytes,
  }),
);

const dossierBytes = statSync(dossierPath).size;
if (dossierBytes === 0) throw new Error('dossier.json came out empty');
console.log(
  `staged ${trophyCount} trophies into ${outputDir}: `
  + `app/ ${sizes.app.entries} entries, ${sizes.app.bytes} bytes; `
  + `${sizes.shots} screenshots; dossier.json ${dossierBytes} bytes`,
);
