/* ── FPL Scout — Shared JS utilities ────────────────────────── */

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
  manager:         (id)   => fetch(`/api/manager/${id}`).then(r => {
    if (!r.ok) throw new Error(`API Error: ${r.status}`);
    return r.json();
  }).catch(e => {
    console.error(`Manager ${id} fetch failed:`, e);
    throw e;
  }),
  managerHistory:  (id)   => fetch(`/api/manager/${id}/history`).then(r => {
    if (!r.ok) throw new Error(`API Error: ${r.status}`);
    return r.json();
  }).catch(e => {
    console.error(`Manager history ${id} fetch failed:`, e);
    throw e;
  }),
  managerPicks:    (id,gw)=> fetch(`/api/manager/${id}/picks/${gw}`).then(r => {
    if (!r.ok) throw new Error(`API Error: ${r.status}`);
    return r.json();
  }).catch(e => {
    console.error(`Manager picks ${id} GW${gw} fetch failed:`, e);
    throw e;
  }),
  managerTransfers:(id)   => fetch(`/api/manager/${id}/transfers`).then(r => {
    if (!r.ok) throw new Error(`API Error: ${r.status}`);
    return r.json();
  }).catch(e => {
    console.error(`Manager transfers ${id} fetch failed:`, e);
    throw e;
  }),
  analyzeTransfers:(id,gw)=> fetch(`/api/analyze-transfers/${id}/${gw}`).then(r => {
    if (!r.ok) throw new Error(`API Error: ${r.status}`);
    return r.json();
  }).catch(e => {
    console.error(`Analyze transfers ${id} GW${gw} fetch failed:`, e);
    throw e;
  }),
  league:          (id,p) => fetch(`/api/league/${id}?page=${p||1}`).then(r => {
    if (!r.ok) throw new Error(`API Error: ${r.status}`);
    return r.json();
  }).catch(e => {
    console.error(`League ${id} fetch failed:`, e);
    throw e;
  }),
  spy:             (id)   => fetch(`/api/spy/${id}`).then(r => {
    if (!r.ok) throw new Error(`API Error: ${r.status}`);
    return r.json();
  }).catch(e => {
    console.error(`Spy ${id} fetch failed:`, e);
    throw e;
  }),
  live:            (gw)   => fetch(`/api/live/${gw}`).then(r => {
    if (!r.ok) throw new Error(`API Error: ${r.status}`);
    return r.json();
  }).catch(e => {
    console.error(`Live GW${gw} fetch failed:`, e);
    throw e;
  }),
  player:          (id)   => fetch(`/api/player/${id}`).then(r => {
    if (!r.ok) throw new Error(`API Error: ${r.status}`);
    return r.json();
  }).catch(e => {
    console.error(`Player ${id} fetch failed:`, e);
    throw e;
  }),
  fixtures:        (gw)   => fetch(`/api/fixtures${gw?`?gw=${gw}`:''}`).then(r => {
    if (!r.ok) throw new Error(`API Error: ${r.status}`);
    return r.json();
  }).catch(e => {
    console.error(`Fixtures fetch failed:`, e);
    throw e;
  }),
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