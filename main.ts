// Leonida Trophy Guide — main.ts (Node 22, standard library only).
//
// The entry point the competition runs: it stages this repository's app/
// and screenshots/ into the output directory and writes
// /output/dossier.json with the vendored make.fun library, exactly the way
// the kit's starter does. vendor/makefun-frontend.ts is the kit's own copy
// and must stay untouched: the scorer rebuilds the dossier with its copy
// and compares the two byte for byte, so any change there fails the entry.
//
// Preflight checks run before anything is copied, so a broken entry fails
// here with a plain message instead of halfway through buildDossier:
//   1. the trophy data itself — app/data/trophies.json must hold 55
//      trophies, each with a name and a non-blank guide, no name twice,
//      every phase in 1..7, every difficulty in 1..5, every hours >= 0,
//      and every guide field the detail pane renders (brief, prep line,
//      at least two steps, tip, risk note, at least one source);
//   2. the scorer's size caps (reference/gate.json) — app/ holds at most
//      993 files and directories and 48 MiB in total, app/index.html is a
//      regular file under 1 MiB, screenshots holds at most 4 files of at
//      most 256 KiB each, and every screenshot is a real JPEG or PNG
//      (checked by its magic bytes, not its extension). The dossier text
//      cap (163,840 bytes) is enforced by buildDossier, so it is passed
//      through as-is.
// After staging, the run reports what it staged — trophies per roadmap
// phase included — and confirms the dossier was written, so a silent
// failure is impossible to miss.
//
// Run it outside the grader with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Inside the grader MAKEFUN_OUTPUT_DIR is unset and the output goes to /output.

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

// Caps from the scorer (reference/gate.json).
const CAPS = {
  appEntries: 993,
  appBytes: 48 * 1024 * 1024,
  indexBytes: 1024 * 1024,
  shots: 4,
  shotBytes: 256 * 1024,
  dossierTextBytes: 163840,
};

const TROPHY_TOTAL = 55;
const PHASE_TOTAL = 7;

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Check the trophy data before staging: the gate refuses an entry whose
// trophies.json does not name every official trophy with a guide, and a
// trophy with a phase or difficulty outside its range would break the
// roadmap and the sort. Returns the per-phase counts for the stage report.
function validateTrophies(): { count: number; perPhase: number[] } {
  const raw = readFileSync(join(repoRoot, 'app', 'data', 'trophies.json'), 'utf-8');
  const doc = JSON.parse(raw);
  const list = Array.isArray(doc) ? doc : doc.trophies;
  if (!Array.isArray(list)) throw new Error('app/data/trophies.json holds no trophies array');
  if (list.length !== TROPHY_TOTAL) {
    throw new Error(`trophies.json holds ${list.length} trophies, expected ${TROPHY_TOTAL}`);
  }
  const nameless = list.filter((t) => typeof t.name !== 'string' || !t.name.trim());
  if (nameless.length) throw new Error(`${nameless.length} trophies have no name`);
  const guideless = list.filter((t) => typeof t.guide !== 'string' || !t.guide.trim());
  if (guideless.length) {
    throw new Error(`${guideless.length} trophies have no guide: ${guideless.map((t) => t.name).join(', ')}`);
  }
  const seen = new Set<string>();
  const perPhase = Array.from({ length: PHASE_TOTAL }, () => 0);
  for (const t of list) {
    if (seen.has(t.name)) throw new Error(`duplicate trophy name in trophies.json: ${t.name}`);
    seen.add(t.name);
    if (!Number.isInteger(t.phase) || t.phase < 1 || t.phase > PHASE_TOTAL) {
      throw new Error(`trophy ${t.name} has phase ${t.phase}, expected 1..${PHASE_TOTAL}`);
    }
    if (!Number.isInteger(t.difficulty) || t.difficulty < 1 || t.difficulty > 5) {
      throw new Error(`trophy ${t.name} has difficulty ${t.difficulty}, expected 1..5`);
    }
    if (typeof t.hours !== 'number' || t.hours < 0) {
      throw new Error(`trophy ${t.name} has hours ${t.hours}, expected a number >= 0`);
    }
    // The guide fields the detail pane renders: a short brief, the
    // "before you start" prep line, at least two steps, a tip, a risk
    // note and at least one source. A trophy missing any of them would
    // render an empty section, so the build refuses it here.
    if (typeof t.brief !== 'string' || !t.brief.trim()) {
      throw new Error(`trophy ${t.name} has no brief`);
    }
    if (typeof t.prep !== 'string' || !t.prep.trim()) {
      throw new Error(`trophy ${t.name} has no prep line`);
    }
    if (!Array.isArray(t.steps) || t.steps.length < 2 || t.steps.some((s: unknown) => typeof s !== 'string' || !s.trim())) {
      throw new Error(`trophy ${t.name} needs at least two non-blank steps`);
    }
    if (typeof t.tip !== 'string' || !t.tip.trim()) {
      throw new Error(`trophy ${t.name} has no tip`);
    }
    if (typeof t.risk !== 'string' || !t.risk.trim()) {
      throw new Error(`trophy ${t.name} has no risk note`);
    }
    if (!Array.isArray(t.sources) || t.sources.length === 0 || t.sources.some((s: unknown) => typeof s !== 'string' || !s.trim())) {
      throw new Error(`trophy ${t.name} has no sources`);
    }
    perPhase[t.phase - 1] += 1;
  }
  return { count: list.length, perPhase };
}

// Recursively total a tree: every file and directory, plus file bytes.
function measureTree(root: string): { entries: number; bytes: number } {
  let entries = 0;
  let bytes = 0;
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      const info = statSync(path);
      entries += 1;
      if (info.isDirectory()) walk(path);
      else if (info.isFile()) bytes += info.size;
    }
  };
  walk(root);
  return { entries, bytes };
}

// A real JPEG starts FFD8FF and a real PNG starts 89504E47: an extension
// alone proves nothing, and a broken image would fail the gate.
function isImageFile(path: string): boolean {
  const head = readFileSync(path).subarray(0, 4);
  const jpeg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  const png = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
  return jpeg || png;
}

function checkCaps(): { app: { entries: number; bytes: number }; shots: number } {
  const app = measureTree(join(repoRoot, 'app'));
  if (app.entries > CAPS.appEntries) {
    throw new Error(`app/ has ${app.entries} files and directories, over the ${CAPS.appEntries} cap`);
  }
  if (app.bytes > CAPS.appBytes) {
    throw new Error(`app/ is ${app.bytes} bytes, over the ${CAPS.appBytes} cap`);
  }
  const indexPath = join(repoRoot, 'app', 'index.html');
  if (!existsSync(indexPath)) throw new Error('app/index.html is missing');
  const indexBytes = statSync(indexPath).size;
  if (indexBytes > CAPS.indexBytes) {
    throw new Error(`app/index.html is ${indexBytes} bytes, over the ${CAPS.indexBytes} cap`);
  }
  const shotsDir = join(repoRoot, 'screenshots');
  if (!existsSync(shotsDir)) throw new Error('screenshots/ is missing');
  const shots = readdirSync(shotsDir).filter((name) => !name.startsWith('.'));
  if (shots.length === 0 || shots.length > CAPS.shots) {
    throw new Error(`screenshots/ holds ${shots.length} files, need 1 to ${CAPS.shots}`);
  }
  for (const name of shots) {
    const shotPath = join(shotsDir, name);
    const size = statSync(shotPath).size;
    if (size > CAPS.shotBytes) {
      throw new Error(`screenshots/${name} is ${size} bytes, over the ${CAPS.shotBytes} cap`);
    }
    if (!isImageFile(shotPath)) {
      throw new Error(`screenshots/${name} is not a JPEG or PNG file`);
    }
  }
  return { app, shots: shots.length };
}

// Copy one tree into the output directory, clearing any stale copy first:
// cpSync never deletes, so a file removed from the repo would otherwise
// linger in the output and be handed in again.
function copyTree(name: 'app' | 'screenshots'): void {
  const target = join(outputDir, name);
  rmSync(target, { recursive: true, force: true });
  cpSync(join(repoRoot, name), target, { recursive: true });
}

const { count: trophyCount, perPhase } = validateTrophies();
const sizes = checkCaps();

mkdirSync(outputDir, { recursive: true });
copyTree('app');
copyTree('screenshots');

// The scorer's own caps (reference/gate.json): only the text cap shapes
// the bytes; the others refuse an entry the scorer would refuse anyway
// (more than 4 screenshots or one over 256 KiB; more than 993 files and
// directories in app/ or 48 MiB of app files: app/ counts beside /output's
// own 1000-entry cap, its screenshots/ and dossier.json).
const dossierPath = join(outputDir, 'dossier.json');
writeFileSync(
  dossierPath,
  buildDossier(outputDir, {
    text_max_bytes: CAPS.dossierTextBytes,
    screenshots: { max: CAPS.shots, max_bytes: CAPS.shotBytes },
    app_max_files: CAPS.appEntries,
    app_max_bytes: CAPS.appBytes,
  }),
);

const dossierBytes = statSync(dossierPath).size;
if (dossierBytes === 0) throw new Error('dossier.json came out empty');
console.log(
  `staged ${trophyCount} trophies into ${outputDir}: `
  + `app/ ${sizes.app.entries} entries, ${sizes.app.bytes} bytes; `
  + `${sizes.shots} screenshots; dossier.json ${dossierBytes} bytes`,
);
console.log(`trophies per roadmap phase: ${perPhase.map((n, i) => `P${i + 1}:${n}`).join(' ')}`);
