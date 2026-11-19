// Leonida Trophy Guide: checklist, filters, spoiler setting, roadmap and missables.
// All trophy data comes from data/trophies.json, fetched from this app's own files.
// Progress lives in localStorage under KEY; export/import move it as JSON.
const KEY = 'gta6-trophy-guide-progress-v1';
const SPOILER_KEY = 'gta6-trophy-guide-spoilers-v1';
const DATA_URL = 'data/trophies.json';

const listEl = document.getElementById('trophyList');
const detailEl = document.getElementById('detailPane');
const searchEl = document.getElementById('search');
const kindEl = document.getElementById('kindFilter');
const gradeEl = document.getElementById('gradeFilter');
const earnedEl = document.getElementById('earnedFilter');
const spoilerEl = document.getElementById('spoilerToggle');
const metaEl = document.getElementById('listMeta');

const state = {
  trophies: [],
  earned: new Set(),
  spoilers: true,
  view: 'checklist',
  selected: null,
};

function loadEarned() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (Array.isArray(raw)) return new Set(raw.filter((n) => typeof n === 'string'));
  } catch { /* a corrupt save starts empty */ }
  return new Set();
}

function saveEarned() {
  localStorage.setItem(KEY, JSON.stringify([...state.earned]));
}

function loadSpoilers() {
  const raw = localStorage.getItem(SPOILER_KEY);
  return raw === null ? true : raw === 'true';
}

function saveSpoilers() {
  localStorage.setItem(SPOILER_KEY, String(state.spoilers));
}

function isStory(t) {
  return t.kind === 'story' || t.kind === 'mission';
}

function isHiddenFromSpoilers(t) {
  return state.spoilers && isStory(t) && !state.earned.has(t.name);
}

function displayName(t) {
  return isHiddenFromSpoilers(t) ? 'Hidden — earn it to reveal' : t.name;
}

function displayDescription(t) {
  return isHiddenFromSpoilers(t) ? 'Hidden — earn it to reveal' : t.description;
}

function medal(t) {
  const span = document.createElement('span');
  span.className = 'medal ' + t.grade;
  span.textContent = t.grade;
  return span;
}

function tag(text, cls) {
  const span = document.createElement('span');
  span.className = 'tag' + (cls ? ' ' + cls : '');
  span.textContent = text;
  return span;
}

function renderProgress() {
  const total = state.trophies.length;
  const n = state.earned.size;
  document.getElementById('earnedCount').textContent = String(n);
  const bar = document.getElementById('progressBar');
  bar.setAttribute('aria-valuenow', String(n));
  document.getElementById('progressFill').style.width = total ? (n / total * 100) + '%' : '0';
  const counts = {};
  for (const t of state.trophies) counts[t.grade] = (counts[t.grade] || 0) + 1;
  const earnedByGrade = {};
  for (const t of state.trophies) {
    if (state.earned.has(t.name)) earnedByGrade[t.grade] = (earnedByGrade[t.grade] || 0) + 1;
  }
  const order = ['platinum', 'gold', 'silver', 'bronze'];
  document.getElementById('gradeCounts').textContent = order
    .filter((g) => counts[g])
    .map((g) => g + ' ' + (earnedByGrade[g] || 0) + '/' + counts[g])
    .join(' · ');
  const platinum = state.trophies.find((t) => t.grade === 'platinum');
  document.getElementById('platinumNote').textContent = platinum && state.earned.has(platinum.name)
    ? 'Platinum earned — you are a Leonida Legend.'
    : 'Platinum: Vice Got a Price! unlocks when the other 54 are earned.';
}

function filteredTrophies() {
  const q = searchEl.value.trim().toLowerCase();
  return state.trophies.filter((t) => {
    if (kindEl.value !== 'all' && t.kind !== kindEl.value) return false;
    if (gradeEl.value !== 'all' && t.grade !== gradeEl.value) return false;
    if (earnedEl.value === 'earned' && !state.earned.has(t.name)) return false;
    if (earnedEl.value === 'unearned' && state.earned.has(t.name)) return false;
    if (q && !(t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q))) return false;
    return true;
  });
}

function renderList() {
  const shown = filteredTrophies();
  listEl.replaceChildren();
  metaEl.textContent = 'Showing ' + shown.length + ' of ' + state.trophies.length + ' trophies'
    + (state.spoilers ? ' · story spoilers hidden until earned' : ' · spoilers shown');
  if (!shown.length) {
    const p = document.createElement('p');
    p.className = 'empty-note';
    p.textContent = 'No trophies match these filters.';
    listEl.append(p);
    return;
  }
  for (const t of shown) {
    const li = document.createElement('li');
    li.className = 'trophy-card' + (state.earned.has(t.name) ? ' earned' : '')
      + (state.selected === t.name ? ' selected' : '');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = state.earned.has(t.name);
    box.setAttribute('aria-label', 'Earned: ' + t.name);
    box.addEventListener('click', (event) => event.stopPropagation());
    box.addEventListener('change', () => {
      if (box.checked) state.earned.add(t.name);
      else state.earned.delete(t.name);
      saveEarned();
      renderProgress();
      renderList();
      renderDetail();
      renderRoadmap();
      renderMissables();
    });
    const body = document.createElement('div');
    const name = document.createElement('p');
    name.className = 'trophy-name';
    name.textContent = displayName(t);
    const desc = document.createElement('p');
    desc.className = 'trophy-desc';
    desc.textContent = displayDescription(t);
    const tags = document.createElement('p');
    tags.append(tag(t.kind));
    if (t.hidden) tags.append(tag('Hidden on PSN', 'hidden-flag'));
    if (t.missable) tags.append(tag('Missable', 'missable'));
    if (t.target) {
      const target = document.createElement('span');
      target.className = 'target';
      target.textContent = 'PSN target: ' + t.target;
      tags.append(target);
    }
    body.append(name, desc, tags);
    if (!isHiddenFromSpoilers(t)) {
      const short = document.createElement('p');
      short.className = 'trophy-guide-short';
      short.textContent = t.guide.split('\n')[0];
      body.append(short);
    }
    const right = document.createElement('div');
    right.append(medal(t));
    li.append(box, body, right);
    li.addEventListener('click', () => {
      state.selected = t.name;
      renderList();
      renderDetail();
      detailEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    listEl.append(li);
  }
}

function renderDetail() {
  const t = state.trophies.find((x) => x.name === state.selected);
  if (!t) {
    detailEl.innerHTML = '';
    const p = document.createElement('p');
    p.className = 'detail-empty';
    p.textContent = 'Pick a trophy to read its full guide, sources and missable note.';
    detailEl.append(p);
    return;
  }
  detailEl.innerHTML = '';
  const h = document.createElement('h2');
  h.textContent = displayName(t);
  const meta = document.createElement('p');
  meta.append(medal(t), document.createTextNode(' '), tag(t.kind));
  if (t.missable) meta.append(tag('Missable', 'missable'));
  if (t.hidden) meta.append(tag('Hidden on PSN', 'hidden-flag'));
  const official = document.createElement('p');
  official.className = 'official';
  official.textContent = 'Official description: ' + displayDescription(t);
  const guide = document.createElement('p');
  guide.className = 'guide-text';
  guide.textContent = isHiddenFromSpoilers(t) ? 'Hidden — earn it to reveal' : t.guide;
  detailEl.append(h, meta, official, guide);
  if (t.target) {
    const target = document.createElement('p');
    target.textContent = 'PSN progress target: ' + t.target + '.';
    detailEl.append(target);
  }
  const note = document.createElement('p');
  note.className = 'missable-note';
  note.textContent = t.missable_note || 'Not missable from its official description: it asks for a count or an activity you can return to.';
  detailEl.append(note);
  const sources = document.createElement('p');
  sources.className = 'sources';
  sources.textContent = t.sources;
  detailEl.append(sources);
}

const ROADMAP = [
  { title: 'Play the story', text: 'Start with Gone Fishing and the four chapters, then the named missions and the final mission. These trophies come naturally from finishing the story.', ids: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] },
  { title: 'Stranger mission strands', text: 'Finish the final mission for each stranger — Andy, Kenton, Billy, Randy and Tyrone — and complete eight stranger strands across Leonida.', ids: [22, 23, 24, 25, 26, 27] },
  { title: 'Activities and skills', text: 'Work through the activities the list names: stunts, the Shooting Range, drone races, races, fishing against Cal, an arcade game, meditation spots and the 50 challenges.', ids: [15, 16, 17, 18, 19, 20, 21, 28, 29, 32, 46] },
  { title: 'Collectibles and exploration', text: 'Sweep Leonida for the collectible sets, the WAiNK spots and the vehicles, and explore every area. These are long grinds — chip at them between story beats.', ids: [30, 31, 35, 42] },
  { title: 'Crime and your partner', text: 'Robberies, vaults, armored trucks and gang operations, plus the partner trophies. Read each missable note first: several of these set a condition that fails the attempt.', ids: [33, 34, 36, 37, 38, 39, 40, 41, 43, 45, 51] },
  { title: 'Money, property and odd moments', text: 'Launder the marked bills, spend across the shops, buy the garages, register vehicles, and pick up the small scene trophies — the cocktail on Ocean Beach, the choices, the second try and the strange sighting.', ids: [44, 47, 48, 49, 50, 52, 53, 54, 55] },
  { title: 'Cleanup and the platinum', text: 'Check the 100% completion requirements and finish whatever is left. The platinum, Vice Got a Price!, unlocks when the other 54 are earned.', ids: [14, 1] },
];

function renderRoadmap() {
  const host = document.getElementById('roadmapPhases');
  host.replaceChildren();
  for (const phase of ROADMAP) {
    const li = document.createElement('li');
    li.className = 'phase';
    const h = document.createElement('h3');
    h.textContent = phase.title;
    const count = document.createElement('p');
    count.className = 'phase-count';
    const earned = phase.ids.filter((id) => {
      const t = state.trophies.find((x) => x.id === id);
      return t && state.earned.has(t.name);
    }).length;
    count.textContent = earned + ' of ' + phase.ids.length + ' earned in this phase';
    const text = document.createElement('p');
    text.textContent = phase.text;
    const ul = document.createElement('ul');
    for (const id of phase.ids) {
      const t = state.trophies.find((x) => x.id === id);
      if (!t) continue;
      const item = document.createElement('li');
      item.textContent = (state.earned.has(t.name) ? '✓ ' : '○ ')
        + displayName(t) + ' — ' + t.grade;
      ul.append(item);
    }
    li.append(h, count, text, ul);
    host.append(li);
  }
}

function renderMissables() {
  const host = document.getElementById('missablesList');
  host.replaceChildren();
  const flagged = state.trophies.filter((t) => t.missable);
  const group = document.createElement('div');
  group.className = 'missable-group';
  const h = document.createElement('h3');
  h.textContent = 'Play carefully — a failed attempt costs the run (' + flagged.length + ')';
  const ul = document.createElement('ul');
  ul.className = 'missable-list';
  for (const t of flagged) {
    const li = document.createElement('li');
    const name = document.createElement('strong');
    name.textContent = displayName(t) + ' ';
    const note = document.createElement('span');
    note.textContent = '— ' + (t.missable_note || '');
    li.append(name, medal(t), document.createElement('br'), note);
    ul.append(li);
  }
  group.append(h, ul);
  host.append(group);
  const safe = document.createElement('div');
  safe.className = 'missable-group';
  const h2 = document.createElement('h3');
  h2.textContent = 'Safe to leave for later';
  const p = document.createElement('p');
  p.textContent = 'Every other trophy asks for a count, a collection or an activity the official description presents as repeatable — stunts, races, meditation spots, card sets, vehicles, areas, money and property. Nothing in those descriptions says the chance passes. Story and chapter trophies (Gone Fishing, Chapters 1–4, the named missions and the final mission) are unmissable if the story can be replayed; that has not yet been confirmed in-game, so do not rely on a replay until it is.';
  safe.append(h2, p);
  host.append(safe);
}

function showView(view) {
  state.view = view;
  for (const btn of document.querySelectorAll('.view-btn')) {
    btn.classList.toggle('active', btn.dataset.view === view);
  }
  document.getElementById('viewChecklist').hidden = view !== 'checklist';
  document.getElementById('viewRoadmap').hidden = view !== 'roadmap';
  document.getElementById('viewMissables').hidden = view !== 'missables';
}

function exportProgress() {
  const data = {
    game: 'Grand Theft Auto VI',
    exported: new Date().toISOString(),
    earned: [...state.earned].sort(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'gta6-trophy-progress.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

async function importProgress(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    alert('That file is not valid JSON.');
    return;
  }
  const names = Array.isArray(data) ? data : data.earned;
  if (!Array.isArray(names)) {
    alert('That file holds no trophy list.');
    return;
  }
  const known = new Set(state.trophies.map((t) => t.name));
  const kept = names.filter((n) => known.has(n));
  const dropped = names.length - kept.length;
  state.earned = new Set(kept);
  saveEarned();
  renderProgress();
  renderList();
  renderDetail();
  renderRoadmap();
  renderMissables();
  alert('Imported ' + kept.length + ' earned trophies'
    + (dropped ? ' (' + dropped + ' unknown names ignored).' : '.'));
}

async function boot() {
  const response = await fetch(DATA_URL);
  const doc = await response.json();
  state.trophies = doc.trophies;
  state.earned = loadEarned();
  state.spoilers = loadSpoilers();
  spoilerEl.checked = state.spoilers;
  for (const btn of document.querySelectorAll('.view-btn')) {
    btn.addEventListener('click', () => showView(btn.dataset.view));
  }
  searchEl.addEventListener('input', renderList);
  kindEl.addEventListener('change', renderList);
  gradeEl.addEventListener('change', renderList);
  earnedEl.addEventListener('change', renderList);
  spoilerEl.addEventListener('change', () => {
    state.spoilers = spoilerEl.checked;
    saveSpoilers();
    renderList();
    renderDetail();
    renderRoadmap();
    renderMissables();
  });
  document.getElementById('exportBtn').addEventListener('click', exportProgress);
  document.getElementById('importInput').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) importProgress(file);
    event.target.value = '';
  });
  document.getElementById('resetBtn').addEventListener('click', () => {
    if (!confirm('Clear all earned trophies?')) return;
    state.earned = new Set();
    saveEarned();
    renderProgress();
    renderList();
    renderDetail();
    renderRoadmap();
    renderMissables();
  });
  renderProgress();
  renderList();
  renderDetail();
  renderRoadmap();
  renderMissables();
}

boot();
