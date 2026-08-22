/* ── FPL Scout — Shared JS utilities ────────────────────────── */

// Coalesce identical in-flight requests to avoid duplicate network calls
const _pendingRequests = new Map();
function coalescedFetch(url, opts = {}, parseJson = true) {
  const key = `${opts.method || 'GET'}::${url}`;
  if (_pendingRequests.has(key)) return _pendingRequests.get(key);

  const p = fetch(url, opts).then(async (r) => {
    if (!r.ok) throw new Error(`API Error: ${r.status}`);
    if (parseJson) return r.json();
    return r;
  }).finally(() => _pendingRequests.delete(key));

  _pendingRequests.set(key, p);
  return p;
}

const API = {
  bootstrap:       ()     => fetch('/api/bootstrap').then(r => {
    if (!r.ok) throw new Error(`API Error: ${r.status}`);
    return r.json();
  }).then(data => {
    try { localStorage.setItem('fpl_bootstrap_cache', JSON.stringify(data)); } catch (e) { }
    return data;
  }).catch(e => {
    console.error('Bootstrap fetch failed:', e);
    try {
      const cached = localStorage.getItem('fpl_bootstrap_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        try { showToast('Using cached data (offline mode)', 'error'); } catch(e){}
        return parsed;
      }
    } catch (err) { /* ignore */ }
    throw e;
  }),
  manager:         (id)   => coalescedFetch(`/api/manager/${id}`),
  managerHistory:  (id)   => coalescedFetch(`/api/manager/${id}/history`),
  managerPicks:    (id,gw)=> coalescedFetch(`/api/manager/${id}/picks/${gw}`),
  managerTransfers:(id)   => coalescedFetch(`/api/manager/${id}/transfers`),
  analyzeTransfers:(id,gw)=> coalescedFetch(`/api/analyze-transfers/${id}/${gw}`),
  league:          (id,p) => coalescedFetch(`/api/league/${id}?page=${p||1}`),
  leagueSummary:   (id)   => coalescedFetch(`/api/league-summary/${id}`),
  spy:             (id, page = 1, pageSize = 20) => coalescedFetch(`/api/spy/${id}?page=${page}&pageSize=${pageSize}`),
  spySearch:       (id, q, maxPages = 5) => coalescedFetch(`/api/spy-search/${id}?q=${encodeURIComponent(q)}&maxPages=${maxPages}`).catch(e => { console.error(`Spy search ${id} query '${q}' failed:`, e); throw e; }),
  live:            (gw)   => coalescedFetch(`/api/live/${gw}`),
  player:          (id)   => coalescedFetch(`/api/player/${id}`),
  fixtures:        (gw)   => coalescedFetch(`/api/fixtures${gw?`?gw=${gw}`:''}`),
};

/* ── LocalStorage helpers ────────────────────────────────────── */
const Store = {
  get:    (k, def) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } },
  set:    (k, v)   => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  remove: (k)      => { try { localStorage.removeItem(k); } catch {} },

  getManagerId:  ()  => Store.get('fpl_manager_id', null),
  setManagerId:  (id)=> Store.set('fpl_manager_id', id),
  getLeagueId:   ()  => Store.get('fpl_league_id', null),
  setLeagueId:   (id)=> Store.set('fpl_league_id', id),
  getWatching:       ()  => Store.get('fpl_watching_ids', []),
  setWatching:       (w) => Store.set('fpl_watching_ids', w),
  getSavedLeagueId:  ()  => Store.get('fpl_saved_league_id', null),
  setSavedLeagueId:  (id)=> Store.set('fpl_saved_league_id', id),
};

/* ── Toast ───────────────────────────────────────────────────── */
function showToast(msg, type = 'success') {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.className = `show ${type}`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3200);
}

/* ── Position helpers ────────────────────────────────────────── */
function posBadge(pos) {
  const map = { 1:'GKP', 2:'DEF', 3:'MID', 4:'FWD' };
  const cls = { 1:'gkp', 2:'def', 3:'mid', 4:'fwd' };
  return `<span class="badge badge-${cls[pos]||'mid'}" style="color:#ffffff !important;">${map[pos]||'?'}</span>`;
}
function posName(pos) { return {1:'GKP',2:'DEF',3:'MID',4:'FWD'}[pos]||'?'; }

/* ── Chip label ──────────────────────────────────────────────── */
function chipLabel(chip) {
  return { wildcard:'Wildcard', bboost:'Bench Boost', freehit:'Free Hit', '3xc':'Triple Captain' }[chip] || chip;
}

/* ── Player photo URL ────────────────────────────────────────── */
function photoUrl(code) {
  const normalized = String(code || '')
    .replace(/\.(jpg|png|jpeg)$/i, '')
    .replace(/^p/i, '')
    .padStart(5, '0');
  return normalized ? `https://resources.premierleague.com/premierleague/photos/players/110x140/p${normalized}.png` : '';
}

/* ── Team badge URL ─────────────────────────────────────────── */
function teamBadge(code) {
  return `https://resources.premierleague.com/premierleague/badges/t${code}.png`;
}

/* ── Rank medal HTML ────────────────────────────────────────── */
function rankMedal(rank) {
  const cls = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : 'rank-n';
  return `<span class="rank-medal ${cls}">${rank}</span>`;
}

/* ── Format large numbers ────────────────────────────────────── */
function fmt(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

/* ── Debounce ────────────────────────────────────────────────── */
function debounce(fn, ms) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/* ── Hamburger nav ───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const ham = document.querySelector('.hamburger');
  const navLinks = document.querySelector('.nav-links');
  if (ham && navLinks) {
    ham.addEventListener('click', () => navLinks.classList.toggle('open'));
  }
  // Mark active nav link
  const path = location.pathname.replace(/\/$/, '');
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = a.getAttribute('href').replace(/\/$/, '');
    if (href === path || (path === '' && href === '/') || (path === '/index.html' && href === '/')) {
      a.classList.add('active');
    }
  });
});