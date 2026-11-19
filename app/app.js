// Leonida Trophy Guide — app.js
// A plain browser script (no build step, no libraries): it fetches
// data/trophies.json, renders the checklist, and keeps the reader's
// progress in localStorage. Everything the app loads lives under app/,
// and the only request it makes at run time is that one relative fetch.
//
// What it does, in one place:
//   - checklist: tick trophies off, saved in the browser, exportable as
//     JSON or as a plain-text checklist, importable back from JSON;
//   - next up: the easiest trophy not earned yet, picked by difficulty
//     then hours, with a button that opens its guide;
//   - surprise me: a random unearned trophy, for when the list feels too
//     long to choose from;
//   - filters: by kind, by grade, by earned / unearned, by missable, and
//     a text search across names, descriptions, guides and steps;
//   - sort: the list order, the difficulty, the estimated hours, or the
//     name — so the next trophy to chase is easy to pick;
//   - views: the flat list, or the trophies grouped by the roadmap's
//     seven phases (each phase with a button that ticks all its trophies
//     at once), so the order to earn them in is visible;
//   - stats: a dashboard with counts by grade and by kind, the hours
//     left on the unearned trophies, and a platinum readiness figure;
//   - spoiler setting: story trophies stay hidden (name, description and
//     guide) until they are earned. On by default;
//   - roadmap: the seven phases in order, each with its trophies, its
//     hours and its own progress; and a missables view listing the
//     timing-sensitive trophies with their risk notes;
//   - share: copy a short text summary of the reader's progress, ready
//     to paste anywhere;
//   - keyboard: "/" focuses the search box, "n" opens the next-up guide.
//
// Hash routes: #roadmap, #missables, #stats, #phase-<n>, and #<trophy id>
// opens one trophy's detail pane.

const DATA_URL = 'data/trophies.json';
const STORE_KEY = 'leonida-trophy-guide-v2';
const SPOILER_KEY = 'leonida-trophy-guide-v2-spoilers';

const KIND_LABELS = {
  activity: 'Activity',
  collectible: 'Collectible',
  combat: 'Combat & crime',
  economy: 'Money & property',
  exploration: 'Exploration',
  mission: 'Mission',
  partner: 'Partner',
  story: 'Story',
};

const GRADE_ORDER = ['platinum', 'gold', 'silver', 'bronze'];
const GRADE_LABELS = { platinum: 'Platinum', gold: 'Gold', silver: 'Silver', bronze: 'Bronze' };
const DIFFICULTY_LABELS = { 1: 'Easy', 2: 'Fair', 3: 'Tricky', 4: 'Hard', 5: 'Brutal' };

let DATA = null; // { phases, trophies }
let earned = new Set(); // trophy ids, from localStorage
let spoilersHidden = true;
let currentDetail = null; // trophy id open in the detail pane, or null
let currentView = 'list'; // 'list' | 'phases' | 'roadmap' | 'missables' | 'stats'

const filters = {
  kind: 'all',
  grade: 'all',
  state: 'all', // all | earned | unearned
  missable: false,
  search: '',
  sort: 'order', // order | difficulty | hours | name
};

// ---- storage ------------------------------------------------------------

function loadStored() {
  // Read the earned ids and the spoiler setting back from localStorage.
  // Anything unreadable or malformed is ignored, and the tracker starts
  // empty with spoilers hidden — a broken store never blocks the page.
  earned = new Set(readEarnedIds());
  spoilersHidden = readSpoilerFlag();
}

function readEarnedIds() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((n) => Number.isInteger(n));
  } catch {
    return [];
  }
}

function readSpoilerFlag() {
  try {
    const raw = localStorage.getItem(SPOILER_KEY);
    return raw === null ? true : raw === '1';
  } catch {
    return true;
  }
}

function saveStored() {
  try {
    const ids = [...earned].sort((a, b) => a - b);
    localStorage.setItem(STORE_KEY, JSON.stringify(ids));
    localStorage.setItem(SPOILER_KEY, spoilersHidden ? '1' : '0');
  } catch {
    // Private browsing or storage off: progress just does not persist.
  }
}

// ---- lookups and counts -------------------------------------------------

function trophyById(id) {
  return DATA.trophies.find((t) => t.id === id) || null;
}

function phaseById(id) {
  return DATA.phases.find((p) => p.id === id) || { id, title: 'Phase ' + id, blurb: '' };
}

function gradeTotal(grade) {
  return DATA.trophies.reduce((n, t) => n + (t.grade === grade ? 1 : 0), 0);
}

function gradeEarned(grade) {
  return DATA.trophies.reduce((n, t) => n + (t.grade === grade && earned.has(t.id) ? 1 : 0), 0);
}

function hoursLeft() {
  return DATA.trophies.reduce((sum, t) => sum + (earned.has(t.id) ? 0 : t.hours || 0), 0);
}

function platinumReadiness() {
  // A simple readiness figure: the share of trophies earned, weighted so
  // the two golds and the silver grinds count double. It is a guide, not
  // a promise: the platinum only pops at 55/55.
  let weight = 0;
  let got = 0;
  for (const t of DATA.trophies) {
    const w = t.grade === 'gold' || t.grade === 'silver' ? 2 : 1;
    weight += w;
    if (earned.has(t.id)) got += w;
  }
  return weight === 0 ? 0 : Math.round((got / weight) * 100);
}

function unearnedList() {
  // Every trophy not earned yet, in list order.
  return DATA.trophies.filter((t) => !earned.has(t.id));
}

function nextTrophy() {
  // The easiest trophy not earned yet: lowest difficulty, then quickest,
  // then lowest id. Null once every trophy is earned.
  const left = unearnedList();
  if (!left.length) return null;
  left.sort((a, b) => (a.difficulty - b.difficulty) || (a.hours - b.hours) || (a.id - b.id));
  return left[0];
}

function randomUnearned() {
  // A random trophy not earned yet, for when the list feels too long to
  // choose from. Null once every trophy is earned.
  const left = unearnedList();
  if (!left.length) return null;
  return left[Math.floor(Math.random() * left.length)];
}

function isSpoilerHidden(t) {
  return spoilersHidden && t.hidden && !earned.has(t.id);
}

// ---- filtering and sorting ----------------------------------------------

function matchesFilters(t) {
  // Every filter is a separate yes/no question; a trophy shows only when
  // all of them pass. The text search covers the name, the official
  // description, the guide, the brief, the tip, the prep line and the
  // steps, so a search for "save first" finds the timing-sensitive ones.
  if (filters.kind !== 'all' && t.kind !== filters.kind) return false;
  if (filters.grade !== 'all' && t.grade !== filters.grade) return false;
  const has = earned.has(t.id);
  if (filters.state === 'earned' && !has) return false;
  if (filters.state === 'unearned' && has) return false;
  if (filters.missable && !t.missable) return false;
  const needle = filters.search.trim().toLowerCase();
  if (!needle) return true;
  const hay = [t.name, t.description, t.guide, t.brief, t.tip, t.prep, (t.steps || []).join(' ')].join(' ').toLowerCase();
  return hay.includes(needle);
}

const SORT_COMPARATORS = {
  difficulty: (a, b) => (a.difficulty - b.difficulty) || (a.hours - b.hours) || (a.id - b.id),
  hours: (a, b) => (a.hours - b.hours) || (a.difficulty - b.difficulty) || (a.id - b.id),
  name: (a, b) => a.name.localeCompare(b.name),
  order: (a, b) => a.id - b.id,
};

function sortTrophies(list) {
  const copy = [...list];
  const compare = SORT_COMPARATORS[filters.sort] || SORT_COMPARATORS.order;
  copy.sort(compare);
  return copy;
}

// ---- small html builders ------------------------------------------------

function esc(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function gradeBadge(t) {
  return `<span class="grade grade-${t.grade}">${GRADE_LABELS[t.grade]}</span>`;
}

function difficultyStars(t) {
  const level = t.difficulty || 1;
  const filled = '★'.repeat(level);
  const empty = '☆'.repeat(5 - level);
  return `<span class="difficulty" title="${DIFFICULTY_LABELS[level]} — about ${t.hours || 0}h">${filled}${empty}</span>`;
}

function trophyTags(t) {
  let out = `<span class="tag">${KIND_LABELS[t.kind]}</span>`;
  if (t.hidden) out += '<span class="tag hidden-flag">Hidden on PSN</span>';
  if (t.missable) out += '<span class="tag missable">Missable</span>';
  if (t.target) out += `<span class="target">PSN target: ${esc(t.target)}</span>`;
  return out;
}

function cardHtml(t) {
  const hidden = isSpoilerHidden(t);
  const name = hidden ? 'Hidden — earn it to reveal' : t.name;
  const desc = hidden ? 'Hidden — earn it to reveal' : t.description;
  const short = hidden ? '' : `<p class="trophy-guide-short">${esc(t.brief || '')}</p>`;
  const cls = `trophy-card${earned.has(t.id) ? ' earned' : ''}${currentDetail === t.id ? ' selected' : ''}`;
  return `<li class="${cls}" data-id="${t.id}">`
    + `<input type="checkbox" ${earned.has(t.id) ? 'checked ' : ''}aria-label="Earned: ${esc(name)}">`
    + `<div><p class="trophy-name">${esc(name)}</p>`
    + `<p class="trophy-desc">${esc(desc)}</p>`
    + `<p>${trophyTags(t)}</p>${short}</div>`
    + `<div>${gradeBadge(t)}<br>${difficultyStars(t)}`
    + `<br><span class="hours">~${t.hours || 0}h</span></div></li>`;
}

// ---- renderers ----------------------------------------------------------

function renderHeader() {
  const total = DATA.trophies.length;
  const n = earned.size;
  const bar = document.getElementById('progressBar');
  const fill = document.getElementById('progressFill');
  document.getElementById('earnedCount').textContent = String(n);
  bar.setAttribute('aria-valuenow', String(n));
  fill.style.width = total ? `${(n / total) * 100}%` : '0';
  const parts = [];
  for (const g of GRADE_ORDER) {
    const totalG = gradeTotal(g);
    if (totalG) parts.push(`${g} ${gradeEarned(g)}/${totalG}`);
  }
  document.getElementById('gradeCounts').textContent = parts.join(' · ');
  const platinum = DATA.trophies.find((t) => t.grade === 'platinum');
  const note = document.getElementById('platinumNote');
  if (platinum && earned.has(platinum.id)) {
    note.textContent = 'Platinum earned — you are a Leonida Legend.';
  } else {
    note.textContent = 'Platinum: Vice Got a Price! unlocks when the other 54 are earned.';
  }
}

function renderNextUp() {
  const text = document.getElementById('nextUpText');
  const btn = document.getElementById('nextUpOpen');
  const surprise = document.getElementById('surpriseBtn');
  const next = nextTrophy();
  if (!next) {
    text.textContent = 'All 55 trophies earned — the platinum is yours.';
    btn.style.display = 'none';
    surprise.style.display = 'none';
    return;
  }
  btn.style.display = '';
  surprise.style.display = '';
  const hidden = isSpoilerHidden(next);
  const name = hidden ? 'A hidden story trophy' : next.name;
  const head = `${name} — ${GRADE_LABELS[next.grade]}, difficulty ${next.difficulty || 1}/5, about ${next.hours || 0}h`;
  text.textContent = hidden ? `${head} (hidden until earned)` : `${head}: ${next.brief || ''}`;
  btn.dataset.trophyId = String(next.id);
}

function renderList() {
  const shown = sortTrophies(DATA.trophies.filter(matchesFilters));
  const host = document.getElementById('trophyList');
  document.getElementById('listMeta').textContent = `Showing ${shown.length} of ${DATA.trophies.length} trophies`
    + (spoilersHidden ? ' · story spoilers hidden until earned' : ' · spoilers shown');
  if (!shown.length) {
    host.innerHTML = '<p class="empty-note">No trophies match these filters.</p>';
    return;
  }
  host.innerHTML = shown.map(cardHtml).join('');
}

function renderPhases() {
  const host = document.getElementById('phaseGroups');
  host.innerHTML = DATA.phases.map((phase) => {
    const members = sortTrophies(DATA.trophies.filter((t) => t.phase === phase.id && matchesFilters(t)));
    const all = DATA.trophies.filter((t) => t.phase === phase.id);
    const done = all.filter((t) => earned.has(t.id)).length;
    const phaseHours = all.reduce((a, t) => a + (t.hours || 0), 0);
    const allDone = done === all.length && all.length > 0;
    return `<section class="phase-group"><h3>Phase ${phase.id} — ${esc(phase.title)}`
      + ` <span class="phase-count">${done}/${all.length} earned · ~${phaseHours}h</span></h3>`
      + `<p class="view-intro">${esc(phase.blurb)}</p>`
      + `<p><button type="button" class="phase-toggle-btn" data-phase="${phase.id}">`
      + `${allDone ? 'Clear all in this phase' : 'Mark all in this phase as earned'}</button></p>`
      + (members.length ? `<ul class="trophy-list">${members.map(cardHtml).join('')}</ul>`
        : '<p class="empty-note">No trophies in this phase match the filters.</p>')
      + '</section>';
  }).join('');
}

function renderStats() {
  const total = DATA.trophies.length;
  const n = earned.size;
  const byKind = Object.keys(KIND_LABELS).map((kind) => {
    const all = DATA.trophies.filter((t) => t.kind === kind).length;
    const done = DATA.trophies.filter((t) => t.kind === kind && earned.has(t.id)).length;
    const pct = all ? Math.round((done / all) * 100) : 0;
    return `<tr><td>${KIND_LABELS[kind]}</td><td>${done} / ${all}</td>`
      + `<td><span class="mini-bar"><span style="width:${pct}%"></span></span></td></tr>`;
  }).join('');
  const byGrade = GRADE_ORDER.map((g) => {
    const all = gradeTotal(g);
    const done = gradeEarned(g);
    const pct = all ? Math.round((done / all) * 100) : 0;
    return `<tr><td>${GRADE_LABELS[g]}</td><td>${done} / ${all}</td>`
      + `<td><span class="mini-bar"><span style="width:${pct}%"></span></span></td></tr>`;
  }).join('');
  const missableDone = DATA.trophies.filter((t) => t.missable && earned.has(t.id)).length;
  const missableAll = DATA.trophies.filter((t) => t.missable).length;
  document.getElementById('statsBody').innerHTML =
    '<div class="stat-cards">'
    + `<div class="stat-card"><p class="stat-num">${n} / ${total}</p><p>earned</p></div>`
    + `<div class="stat-card"><p class="stat-num">${hoursLeft()}h</p><p>estimated time left on unearned trophies</p></div>`
    + `<div class="stat-card"><p class="stat-num">${platinumReadiness()}%</p><p>platinum readiness (golds and silvers weighted double)</p></div>`
    + `<div class="stat-card"><p class="stat-num">${missableDone} / ${missableAll}</p><p>timing-sensitive trophies earned</p></div>`
    + '</div>'
    + `<h3>By grade</h3><table class="stat-table"><tbody>${byGrade}</tbody></table>`
    + `<h3>By kind</h3><table class="stat-table"><tbody>${byKind}</tbody></table>`
    + '<p class="view-intro">Hours are rough estimates from the trophy counts and the guides on this page — a grind done alongside other trophies costs less than the sum suggests, since one drive can feed several counts at once.</p>';
}

function renderDetail() {
  const host = document.getElementById('detailPane');
  const t = currentDetail === null ? null : trophyById(currentDetail);
  if (!t) {
    host.innerHTML = '<p class="detail-empty">Pick a trophy to read its full guide, steps, tip and sources.</p>';
    return;
  }
  const hidden = isSpoilerHidden(t);
  const name = hidden ? 'Hidden — earn it to reveal' : t.name;
  const desc = hidden ? 'Hidden — earn it to reveal' : t.description;
  const guide = hidden ? 'Hidden — earn it to reveal' : t.guide;
  const phase = phaseById(t.phase);
  const steps = hidden ? '' : `<h3>Steps</h3><ol class="steps">${(t.steps || []).map((s) => `<li>${esc(s)}</li>`).join('')}</ol>`;
  const tip = hidden ? '' : `<p class="tip"><strong>Tip:</strong> ${esc(t.tip || '')}</p>`;
  const prep = hidden ? '' : `<p class="prep"><strong>Before you start:</strong> ${esc(t.prep || '')}</p>`;
  const sources = `<p class="sources"><strong>Sources:</strong><br>${(t.sources || []).map(esc).join('<br>')}</p>`;
  host.innerHTML = `<h2>${esc(name)}</h2>`
    + `<p>${gradeBadge(t)} ${trophyTags(t)} ${difficultyStars(t)} <span class="hours">~${t.hours || 0}h</span></p>`
    + `<p class="phase-line">Roadmap: Phase ${phase.id} — ${esc(phase.title)}</p>`
    + `<p class="official">Official description: ${esc(desc)}</p>`
    + `<p class="guide-text">${esc(guide)}</p>`
    + steps + tip + prep
    + (t.target ? `<p>PSN progress target: ${esc(t.target)}.</p>` : '')
    + `<p class="missable-note">${esc(t.risk || '')}</p>`
    + sources;
}

function renderRoadmap() {
  const host = document.getElementById('roadmapPhases');
  host.innerHTML = DATA.phases.map((phase) => {
    const members = DATA.trophies.filter((t) => t.phase === phase.id).sort((a, b) => a.id - b.id);
    const done = members.filter((t) => earned.has(t.id)).length;
    const phaseHours = members.reduce((a, t) => a + (t.hours || 0), 0);
    const items = members.map((t) => `<li>${earned.has(t.id) ? '✓ ' : '○ '}`
      + `${esc(isSpoilerHidden(t) ? 'Hidden — earn it to reveal' : t.name)} — ${t.grade}</li>`).join('');
    return `<li class="phase"><h3>${esc(phase.title)}</h3>`
      + `<p class="phase-count">${done} of ${members.length} earned in this phase · ~${phaseHours}h</p>`
      + `<p>${esc(phase.blurb)}</p>`
      + `<p class="phase-goal"><strong>Goal:</strong> ${esc(phase.goal || '')}</p><ul>${items}</ul></li>`;
  }).join('');
}

function renderMissables() {
  const host = document.getElementById('missablesList');
  const flagged = DATA.trophies.filter((t) => t.missable);
  const cards = flagged.map((t) => `<li><strong>${esc(isSpoilerHidden(t) ? 'Hidden — earn it to reveal' : t.name)}</strong> `
    + `${gradeBadge(t)}<br><span>${esc(t.risk || '')}</span></li>`).join('');
  host.innerHTML = `<div class="missable-group"><h3>Play carefully — a failed attempt costs the run (${flagged.length})</h3>`
    + `<ul class="missable-list">${cards}</ul></div>`
    + '<div class="missable-group"><h3>Safe to leave for later</h3>'
    + '<p>Every other trophy asks for a count, a collection or an activity the official description presents as repeatable — stunts, races, meditation spots, card sets, vehicles, areas, money and property. Nothing in those descriptions says the chance passes. Story and chapter trophies are unmissable if the story can be replayed; that has not yet been confirmed in-game, so do not rely on a replay until it is.</p></div>';
}

// ---- views ----------------------------------------------------------------

const VIEWS = ['list', 'phases', 'roadmap', 'missables', 'stats'];

function showView(view, updateHash) {
  if (!VIEWS.includes(view)) view = 'list';
  currentView = view;
  for (const btn of document.querySelectorAll('.view-btn')) {
    btn.classList.toggle('active', btn.dataset.view === view);
  }
  document.getElementById('viewList').hidden = view !== 'list';
  document.getElementById('viewPhases').hidden = view !== 'phases';
  document.getElementById('viewRoadmap').hidden = view !== 'roadmap';
  document.getElementById('viewMissables').hidden = view !== 'missables';
  document.getElementById('viewStats').hidden = view !== 'stats';
  if (updateHash) {
    const hash = view === 'list' ? '' : `#${view}`;
    history.replaceState(null, '', hash || location.pathname);
  }
}

function viewFromHash() {
  const hash = location.hash.replace('#', '');
  if (VIEWS.includes(hash)) return hash;
  const phaseMatch = hash.match(/^phase-(\d+)$/);
  if (phaseMatch) return 'phases';
  const byId = Number(hash);
  if (Number.isInteger(byId) && trophyById(byId)) return 'list';
  return 'list';
}

function refreshAll() {
  renderHeader();
  renderNextUp();
  renderList();
  renderPhases();
  renderStats();
  renderDetail();
  renderRoadmap();
  renderMissables();
}

// ---- progress actions -----------------------------------------------------

function toggleEarned(id) {
  if (earned.has(id)) earned.delete(id);
  else earned.add(id);
  saveStored();
  refreshAll();
}

function togglePhase(phaseId) {
  const members = DATA.trophies.filter((t) => t.phase === phaseId);
  const allDone = members.length > 0 && members.every((t) => earned.has(t.id));
  for (const t of members) {
    if (allDone) earned.delete(t.id);
    else earned.add(t.id);
  }
  saveStored();
  refreshAll();
}

function download(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportJSON() {
  download('gta6-trophy-progress.json', JSON.stringify({
    game: 'Grand Theft Auto VI',
    exported: new Date().toISOString(),
    earned: [...earned].sort((a, b) => a - b),
  }, null, 2), 'application/json');
}

function exportText() {
  const lines = ['Leonida Trophy Guide — GTA VI — my progress', ''];
  for (const phase of DATA.phases) {
    lines.push(`Phase ${phase.id} — ${phase.title}`);
    for (const t of DATA.trophies.filter((x) => x.phase === phase.id).sort((a, b) => a.id - b.id)) {
      lines.push(`${earned.has(t.id) ? '[x] ' : '[ ] '}${t.name} (${t.grade})`);
    }
    lines.push('');
  }
  lines.push(`Earned ${earned.size} of ${DATA.trophies.length} · about ${hoursLeft()}h left`);
  download('gta6-trophy-progress.txt', lines.join('\n'), 'text/plain');
}

function progressSummary() {
  const byGrade = GRADE_ORDER.filter((g) => gradeTotal(g)).map((g) => `${GRADE_LABELS[g]} ${gradeEarned(g)}/${gradeTotal(g)}`).join(', ');
  return `GTA VI trophies: ${earned.size}/${DATA.trophies.length} earned (${byGrade}). About ${hoursLeft()}h left. Platinum readiness ${platinumReadiness()}%.`;
}

async function copySummary() {
  const text = progressSummary();
  const btn = document.getElementById('copyBtn');
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = 'Copied!';
  } catch {
    // Clipboard unavailable (offline file use): fall back to a prompt.
    window.prompt('Copy your progress summary:', text);
    btn.textContent = 'Copy summary';
  }
  setTimeout(() => { btn.textContent = 'Copy summary'; }, 2000);
}

async function importJSON(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    alert('That file is not valid JSON.');
    return;
  }
  const ids = Array.isArray(data) ? data : data.earned;
  if (!Array.isArray(ids)) {
    alert('That file holds no trophy list.');
    return;
  }
  const known = new Set(DATA.trophies.map((t) => t.id));
  const kept = ids.filter((n) => known.has(n));
  const dropped = ids.length - kept.length;
  earned = new Set(kept);
  saveStored();
  refreshAll();
  alert(`Imported ${kept.length} earned trophies${dropped ? ` (${dropped} unknown ids ignored).` : '.'}`);
}

function openTrophyDetail(id) {
  const t = trophyById(id);
  if (!t) return;
  currentDetail = id;
  showView('list', false);
  renderList();
  renderPhases();
  renderDetail();
  document.getElementById('detailPane').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function openSurprise() {
  const t = randomUnearned();
  if (!t) return;
  openTrophyDetail(t.id);
}

// ---- events ---------------------------------------------------------------

function wireEvents() {
  for (const btn of document.querySelectorAll('.view-btn')) {
    btn.addEventListener('click', () => showView(btn.dataset.view, true));
  }
  window.addEventListener('hashchange', () => {
    const hash = location.hash.replace('#', '');
    const byId = Number(hash);
    if (Number.isInteger(byId) && trophyById(byId)) {
      currentDetail = byId;
      showView('list', false);
      renderDetail();
      return;
    }
    showView(viewFromHash(), false);
  });
  document.getElementById('nextUpOpen').addEventListener('click', (e) => {
    const id = Number(e.target.dataset.trophyId);
    if (id) openTrophyDetail(id);
  });
  document.getElementById('surpriseBtn').addEventListener('click', openSurprise);
  document.addEventListener('keydown', (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
    if (e.key === '/') {
      e.preventDefault();
      document.getElementById('search').focus();
    } else if (e.key === 'n' || e.key === 'N') {
      const next = nextTrophy();
      if (next) openTrophyDetail(next.id);
    }
  });
  const rerender = () => { renderList(); renderPhases(); };
  document.getElementById('search').addEventListener('input', (e) => {
    filters.search = e.target.value;
    rerender();
  });
  document.getElementById('kindFilter').addEventListener('change', (e) => {
    filters.kind = e.target.value;
    rerender();
  });
  document.getElementById('gradeFilter').addEventListener('change', (e) => {
    filters.grade = e.target.value;
    rerender();
  });
  document.getElementById('earnedFilter').addEventListener('change', (e) => {
    filters.state = e.target.value;
    rerender();
  });
  document.getElementById('missableFilter').addEventListener('change', (e) => {
    filters.missable = e.target.checked;
    rerender();
  });
  document.getElementById('sortSelect').addEventListener('change', (e) => {
    filters.sort = e.target.value;
    rerender();
  });
  document.getElementById('spoilerToggle').addEventListener('change', (e) => {
    spoilersHidden = e.target.checked;
    saveStored();
    refreshAll();
  });
  document.getElementById('exportBtn').addEventListener('click', exportJSON);
  document.getElementById('exportTextBtn').addEventListener('click', exportText);
  document.getElementById('copyBtn').addEventListener('click', copySummary);
  document.getElementById('importInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) importJSON(file);
    e.target.value = '';
  });
  document.getElementById('resetBtn').addEventListener('click', () => {
    if (!confirm('Clear all earned trophies?')) return;
    earned = new Set();
    saveStored();
    refreshAll();
  });
  // One listener for the whole page: a checkbox toggles, a card opens,
  // a phase button ticks a whole phase at once.
  document.addEventListener('click', (e) => {
    const phaseBtn = e.target.closest('.phase-toggle-btn');
    if (phaseBtn) {
      togglePhase(Number(phaseBtn.dataset.phase));
      return;
    }
    const card = e.target.closest('.trophy-card');
    if (!card) return;
    const id = Number(card.dataset.id);
    if (!trophyById(id)) return;
    if (e.target.matches('input[type="checkbox"]')) {
      toggleEarned(id);
      return;
    }
    openTrophyDetail(id);
  });
}

async function boot() {
  const response = await fetch(DATA_URL);
  DATA = await response.json();
  loadStored();
  document.getElementById('spoilerToggle').checked = spoilersHidden;
  wireEvents();
  const hash = location.hash.replace('#', '');
  const byId = Number(hash);
  if (Number.isInteger(byId) && trophyById(byId)) currentDetail = byId;
  showView(viewFromHash(), false);
  refreshAll();
  window.__shotReady = true;
}

boot();
