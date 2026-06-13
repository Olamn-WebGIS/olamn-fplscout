/* ── FPL Scout — Shared JS utilities ────────────────────────── */

const API = {
  bootstrap:       ()     => fetch('/api/bootstrap').then(r => r.json()),
  manager:         (id)   => fetch(`/api/manager/${id}`).then(r => r.json()),
  managerHistory:  (id)   => fetch(`/api/manager/${id}/history`).then(r => r.json()),
  managerPicks:    (id,gw)=> fetch(`/api/manager/${id}/picks/${gw}`).then(r => r.json()),
  managerTransfers:(id)   => fetch(`/api/manager/${id}/transfers`).then(r => r.json()),
  analyzeTransfers:(id,gw)=> fetch(`/api/analyze-transfers/${id}/${gw}`).then(r => r.json()),
  league:          (id,p) => fetch(`/api/league/${id}?page=${p||1}`).then(r => r.json()),
  spy:             (id)   => fetch(`/api/spy/${id}`).then(r => r.json()),
  live:            (gw)   => fetch(`/api/live/${gw}`).then(r => r.json()),
  player:          (id)   => fetch(`/api/player/${id}`).then(r => r.json()),
  fixtures:        (gw)   => fetch(`/api/fixtures${gw?`?gw=${gw}`:''}`).then(r => r.json()),
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
  getWatchlist:  ()  => Store.get('fpl_watchlist', []),
  setWatchlist:  (w) => Store.set('fpl_watchlist', w),
  getWatching:   ()  => Store.get('fpl_watching_ids', []),
  setWatching:   (w) => Store.set('fpl_watching_ids', w),
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
  return `<span class="badge badge-${cls[pos]||'mid'}">${map[pos]||'?'}</span>`;
}
function posName(pos) { return {1:'GKP',2:'DEF',3:'MID',4:'FWD'}[pos]||'?'; }

/* ── Chip label ──────────────────────────────────────────────── */
function chipLabel(chip) {
  return { wildcard:'Wildcard', bboost:'Bench Boost', freehit:'Free Hit', '3xc':'Triple Captain' }[chip] || chip;
}

/* ── Player photo URL ────────────────────────────────────────── */
function photoUrl(code) {
  return `https://resources.premierleague.com/premierleague/photos/players/110x140/p${code}.png`;
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