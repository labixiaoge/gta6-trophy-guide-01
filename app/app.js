// Leonida Trophy Guide — app.js
// A plain browser script (no build step, no libraries): it fetches
// data/trophies.json, renders the checklist, and keeps the reader's
// progress in localStorage. Everything the app loads lives under app/,
// and the only request it makes at run time is that one relative fetch.
//
// What it does, in one place:
//   - checklist: tick trophies off, saved in the browser, exportable as
//     JSON or as a plain-text checklist, importable back from JSON;
//   - filters: by kind, by grade, by earned / unearned, by missable, and
//     a text search across names, descriptions, guides and steps;
//   - sort: the list order, the difficulty, the estimated hours, or the
//     name — so the next trophy to chase is easy to pick;
//   - views: the flat list, or the trophies grouped by the roadmap's
//     seven phases, so the order to earn them in is visible;
//   - stats: a dashboard with counts by grade and by kind, the hours
//     left on the unearned trophies, and a platinum readiness figure;
//   - spoiler setting: story trophies stay hidden (name, description and
//     guide) until they are earned. On by default;
//   - roadmap: the seven phases in order, each with its trophies, its
//     hours and its own progress; and a missables view listing the
//     timing-sensitive trophies with their risk notes;
//   - share: copy a short text summary of the reader's progress, ready
//     to paste anywhere.
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

function loadStored() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) earned = new Set(parsed.filter((n) => Number.isInteger(n)));
    }
  } catch {
    earned = new Set();
  }
  try {
    const raw = localStorage.getItem(SPOILER_KEY);
    if (raw !== null) spoilersHidden = raw === '1';
  } catch {
    spoilersHidden = true;
  }
}

function saveStored() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify([...earned].sort((a, b) => a - b)));
    localStorage.setItem(SPOILER_KEY, spoilersHidden ? '1' : '0');
  } catch {
    // Private browsing or storage off: progress just does not persist.
  }
}

function trophyById(id) {
  return DATA.trophies.find((t) => t.id === id) || null;
}

function phaseById(id) {
  return DATA.phases.find((p) => p.id === id) || { id, title: 'Phase ' + id, blurb: '' };
}

function gradeCount(grade) {
  return DATA.trophies.filter((t) => t.grade === grade).length;
}

function earnedGradeCount(grade) {
  return DATA.trophies.filter((t) => t.grade === grade && earned.has(t.id)).length;
}

function hoursLeft() {
  let total = 0;
  for (const t of DATA.trophies) {
    if (!earned.has(t.id)) total += t.hours || 0;
  }
  return total;
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

function isSpoilerHidden(t) {
  return spoilersHidden && t.hidden && !earned.has(t.id);
}

function matchesFilters(t) {
  if (filters.kind !== 'all' && t.kind !== filters.kind) return false;
  if (filters.grade !== 'all' && t.grade !== filters.grade) return false;
  if (filters.state === 'earned' && !earned.has(t.id)) return false;
  if (filters.state === 'unearned' && earned.has(t.id)) return false;
  if (filters.missable && !t.missable) return false;
  if (filters.search) {
    const hay = [t.name, t.description, t.guide, t.brief, t.tip, (t.steps || []).join(' ')].join(' ').toLowerCase();
    const needle = filters.search.trim().toLowerCase();
    if (needle && !hay.includes(needle)) return false;
  }
  return true;
}

function sortTrophies(list) {
  const copy = [...list];
  if (filters.sort === 'difficulty') {
    copy.sort((a, b) => (a.difficulty - b.difficulty) || (a.hours - b.hours) || (a.id - b.id));
  } else if (filters.sort === 'hours') {
    copy.sort((a, b) => (a.hours - b.hours) || (a.difficulty - b.difficulty) || (a.id - b.id));
  } else if (filters.sort === 'name') {
    copy.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    copy.sort((a, b) => a.id - b.id);
  }
  return copy;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function gradeBadge(t) {
  return '<span class="grade grade-' + t.grade + '">' + GRADE_LABELS[t.grade] + '</span>';
}

function difficultyStars(t) {
  const level = t.difficulty || 1;
  const filled = '★'.repeat(level);
  const empty = '☆'.repeat(5 - level);
  return '<span class="difficulty" title="' + DIFFICULTY_LABELS[level] + ' — about ' + (t.hours || 0) + 'h">' + filled + empty + '</span>';
}

function trophyTags(t) {
  let out = '<span class="tag">' + KIND_LABELS[t.kind] + '</span>';
  if (t.hidden) out += '<span class="tag hidden-flag">Hidden on PSN</span>';
  if (t.missable) out += '<span class="tag missable">Missable</span>';
  if (t.target) out += '<span class="target">PSN target: ' + escapeHtml(t.target) + '</span>';
  return out;
}

function renderHeader() {
  const total = DATA.trophies.length;
  const n = earned.size;
  document.getElementById('earnedCount').textContent = String(n);
  document.getElementById('progressBar').setAttribute('aria-valuenow', String(n));
  document.getElementById('progressFill').style.width = total ? (n / total * 100) + '%' : '0';
  document.getElementById('gradeCounts').textContent = GRADE_ORDER
    .filter((g) => gradeCount(g))
    .map((g) => g + ' ' + earnedGradeCount(g) + '/' + gradeCount(g))
    .join(' · ');
  const platinum = DATA.trophies.find((t) => t.grade === 'platinum');
  document.getElementById('platinumNote').textContent = platinum && earned.has(platinum.id)
    ? 'Platinum earned — you are a Leonida Legend.'
    : 'Platinum: Vice Got a Price! unlocks when the other 54 are earned.';
}

function cardHtml(t) {
  const hidden = isSpoilerHidden(t);
  const name = hidden ? 'Hidden — earn it to reveal' : t.name;
  const desc = hidden ? 'Hidden — earn it to reveal' : t.description;
  const short = hidden ? '' : '<p class="trophy-guide-short">' + escapeHtml(t.brief || '') + '</p>';
  return '<li class="trophy-card' + (earned.has(t.id) ? ' earned' : '')
    + (currentDetail === t.id ? ' selected' : '') + '" data-id="' + t.id + '">'
    + '<input type="checkbox" ' + (earned.has(t.id) ? 'checked ' : '') + 'aria-label="Earned: ' + escapeHtml(name) + '">'
    + '<div><p class="trophy-name">' + escapeHtml(name) + '</p>'
    + '<p class="trophy-desc">' + escapeHtml(desc) + '</p>'
    + '<p>' + trophyTags(t) + '</p>' + short + '</div>'
    + '<div>' + gradeBadge(t) + '<br>' + difficultyStars(t)
    + '<br><span class="hours">~' + (t.hours || 0) + 'h</span></div></li>';
}

function renderList() {
  const shown = sortTrophies(DATA.trophies.filter(matchesFilters));
  const host = document.getElementById('trophyList');
  document.getElementById('listMeta').textContent = 'Showing ' + shown.length + ' of ' + DATA.trophies.length + ' trophies'
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
    const done = DATA.trophies.filter((t) => t.phase === phase.id && earned.has(t.id)).length;
    const all = DATA.trophies.filter((t) => t.phase === phase.id).length;
    const phaseHours = DATA.trophies.filter((t) => t.phase === phase.id).reduce((a, t) => a + (t.hours || 0), 0);
    return '<section class="phase-group"><h3>Phase ' + phase.id + ' — ' + escapeHtml(phase.title)
      + ' <span class="phase-count">' + done + '/' + all + ' earned · ~' + phaseHours + 'h</span></h3>'
      + '<p class="view-intro">' + escapeHtml(phase.blurb) + '</p>'
      + (members.length ? '<ul class="trophy-list">' + members.map(cardHtml).join('') + '</ul>'
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
    return '<tr><td>' + KIND_LABELS[kind] + '</td><td>' + done + ' / ' + all + '</td>'
      + '<td><span class="mini-bar"><span style="width:' + (all ? Math.round(done / all * 100) : 0) + '%"></span></span></td></tr>';
  }).join('');
  const byGrade = GRADE_ORDER.map((g) => {
    const all = gradeCount(g);
    const done = earnedGradeCount(g);
    return '<tr><td>' + GRADE_LABELS[g] + '</td><td>' + done + ' / ' + all + '</td>'
      + '<td><span class="mini-bar"><span style="width:' + (all ? Math.round(done / all * 100) : 0) + '%"></span></span></td></tr>';
  }).join('');
  const missableDone = DATA.trophies.filter((t) => t.missable && earned.has(t.id)).length;
  const missableAll = DATA.trophies.filter((t) => t.missable).length;
  document.getElementById('statsBody').innerHTML =
    '<div class="stat-cards">'
    + '<div class="stat-card"><p class="stat-num">' + n + ' / ' + total + '</p><p>earned</p></div>'
    + '<div class="stat-card"><p class="stat-num">' + hoursLeft() + 'h</p><p>estimated time left on unearned trophies</p></div>'
    + '<div class="stat-card"><p class="stat-num">' + platinumReadiness() + '%</p><p>platinum readiness (golds and silvers weighted double)</p></div>'
    + '<div class="stat-card"><p class="stat-num">' + missableDone + ' / ' + missableAll + '</p><p>timing-sensitive trophies earned</p></div>'
    + '</div>'
    + '<h3>By grade</h3><table class="stat-table"><tbody>' + byGrade + '</tbody></table>'
    + '<h3>By kind</h3><table class="stat-table"><tbody>' + byKind + '</tbody></table>'
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
  const steps = hidden ? '' : '<h3>Steps</h3><ol class="steps">' + (t.steps || []).map((s) => '<li>' + escapeHtml(s) + '</li>').join('') + '</ol>';
  const tip = hidden ? '' : '<p class="tip"><strong>Tip:</strong> ' + escapeHtml(t.tip || '') + '</p>';
  const sources = '<p class="sources"><strong>Sources:</strong><br>' + (t.sources || []).map(escapeHtml).join('<br>') + '</p>';
  host.innerHTML = '<h2>' + escapeHtml(name) + '</h2>'
    + '<p>' + gradeBadge(t) + ' ' + trophyTags(t) + ' ' + difficultyStars(t) + ' <span class="hours">~' + (t.hours || 0) + 'h</span></p>'
    + '<p class="phase-line">Roadmap: Phase ' + phase.id + ' — ' + escapeHtml(phase.title) + '</p>'
    + '<p class="official">Official description: ' + escapeHtml(desc) + '</p>'
    + '<p class="guide-text">' + escapeHtml(guide) + '</p>'
    + steps + tip
    + (t.target ? '<p>PSN progress target: ' + escapeHtml(t.target) + '.</p>' : '')
    + '<p class="missable-note">' + escapeHtml(t.risk || '') + '</p>'
    + sources;
}

function renderRoadmap() {
  const host = document.getElementById('roadmapPhases');
  host.innerHTML = DATA.phases.map((phase) => {
    const members = DATA.trophies.filter((t) => t.phase === phase.id).sort((a, b) => a.id - b.id);
    const done = members.filter((t) => earned.has(t.id)).length;
    const phaseHours = members.reduce((a, t) => a + (t.hours || 0), 0);
    const items = members.map((t) => '<li>' + (earned.has(t.id) ? '✓ ' : '○ ')
      + escapeHtml(isSpoilerHidden(t) ? 'Hidden — earn it to reveal' : t.name) + ' — ' + t.grade + '</li>').join('');
    return '<li class="phase"><h3>' + escapeHtml(phase.title) + '</h3>'
      + '<p class="phase-count">' + done + ' of ' + members.length + ' earned in this phase · ~' + phaseHours + 'h</p>'
      + '<p>' + escapeHtml(phase.blurb) + '</p><ul>' + items + '</ul></li>';
  }).join('');
}

function renderMissables() {
  const host = document.getElementById('missablesList');
  const flagged = DATA.trophies.filter((t) => t.missable);
  const cards = flagged.map((t) => '<li><strong>' + escapeHtml(isSpoilerHidden(t) ? 'Hidden — earn it to reveal' : t.name) + '</strong> '
    + gradeBadge(t) + '<br><span>' + escapeHtml(t.risk || '') + '</span></li>').join('');
  host.innerHTML = '<div class="missable-group"><h3>Play carefully — a failed attempt costs the run (' + flagged.length + ')</h3>'
    + '<ul class="missable-list">' + cards + '</ul></div>'
    + '<div class="missable-group"><h3>Safe to leave for later</h3>'
    + '<p>Every other trophy asks for a count, a collection or an activity the official description presents as repeatable — stunts, races, meditation spots, card sets, vehicles, areas, money and property. Nothing in those descriptions says the chance passes. Story and chapter trophies are unmissable if the story can be replayed; that has not yet been confirmed in-game, so do not rely on a replay until it is.</p></div>';
}

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
    const hash = view === 'list' ? '' : '#' + view;
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
  renderList();
  renderPhases();
  renderStats();
  renderDetail();
  renderRoadmap();
  renderMissables();
}

function toggleEarned(id) {
  if (earned.has(id)) earned.delete(id);
  else earned.add(id);
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
    lines.push('Phase ' + phase.id + ' — ' + phase.title);
    for (const t of DATA.trophies.filter((x) => x.phase === phase.id).sort((a, b) => a.id - b.id)) {
      lines.push((earned.has(t.id) ? '[x] ' : '[ ] ') + t.name + ' (' + t.grade + ')');
    }
    lines.push('');
  }
  lines.push('Earned ' + earned.size + ' of ' + DATA.trophies.length + ' · about ' + hoursLeft() + 'h left');
  download('gta6-trophy-progress.txt', lines.join('\n'), 'text/plain');
}

function progressSummary() {
  const byGrade = GRADE_ORDER.filter((g) => gradeCount(g)).map((g) => GRADE_LABELS[g] + ' ' + earnedGradeCount(g) + '/' + gradeCount(g)).join(', ');
  return 'GTA VI trophies: ' + earned.size + '/' + DATA.trophies.length + ' earned (' + byGrade + '). About ' + hoursLeft() + 'h left. Platinum readiness ' + platinumReadiness() + '%.';
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
  alert('Imported ' + kept.length + ' earned trophies' + (dropped ? ' (' + dropped + ' unknown ids ignored).' : '.'));
}

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
  document.getElementById('search').addEventListener('input', (e) => {
    filters.search = e.target.value;
    renderList();
    renderPhases();
  });
  document.getElementById('kindFilter').addEventListener('change', (e) => {
    filters.kind = e.target.value;
    renderList();
    renderPhases();
  });
  document.getElementById('gradeFilter').addEventListener('change', (e) => {
    filters.grade = e.target.value;
    renderList();
    renderPhases();
  });
  document.getElementById('earnedFilter').addEventListener('change', (e) => {
    filters.state = e.target.value;
    renderList();
    renderPhases();
  });
  document.getElementById('missableFilter').addEventListener('change', (e) => {
    filters.missable = e.target.checked;
    renderList();
    renderPhases();
  });
  document.getElementById('sortSelect').addEventListener('change', (e) => {
    filters.sort = e.target.value;
    renderList();
    renderPhases();
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
  // One listener for the whole list: a checkbox toggles, a card opens.
  document.addEventListener('click', (e) => {
    const card = e.target.closest('.trophy-card');
    if (!card) return;
    const id = Number(card.dataset.id);
    if (!trophyById(id)) return;
    if (e.target.matches('input[type="checkbox"]')) {
      toggleEarned(id);
      return;
    }
    currentDetail = id;
    renderList();
    renderPhases();
    renderDetail();
    document.getElementById('detailPane').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
