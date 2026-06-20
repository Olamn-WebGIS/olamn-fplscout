const searchInput = document.getElementById('search-input');
const positionFilter = document.getElementById('position-filter');
const teamFilter = document.getElementById('team-filter');
const tableBody = document.getElementById('player-table-body');
const comparePills = document.getElementById('compare-pills');
const compareOpen = document.getElementById('compare-open');
const compareModal = document.getElementById('compare-modal');
const compareBody = document.getElementById('compare-body');
const compareClose = document.getElementById('compare-close');
const errorMessage = document.getElementById('error-message');
const liveNotice = document.getElementById('live-notice');
const gwNote = document.getElementById('gw-note');
const pagePrev = document.getElementById('page-prev');
const pageNext = document.getElementById('page-next');
const pageInfo = document.getElementById('page-info');

let players = [];
let teams = [];
let selectedPlayers = new Set();
let currentPage = 1;
const ITEMS_PER_PAGE = 15;
let totalPages = 1;

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('fpl_user_session') || 'null');
  } catch {
    return null;
  }
}

function colorClass(value) {
  if (value >= 8) return 'proj-high';
  if (value >= 5) return 'proj-mid';
  return 'proj-low';
}

function formatPrice(value) {
  return `£${(value / 10).toFixed(1)}`;
}

function safeText(value) {
  return value || '-';
}

function getUpcomingDifficulty(fixtures, playerId, gwCount = 5) {
  const relevant = fixtures.filter(f => (f.team_h === playerId || f.team_a === playerId)).slice(0, gwCount);
  if (!relevant.length) return 0;
  const values = relevant.map(f => {
    const isHome = f.team_h === playerId;
    return Number(f.team_a === playerId || f.team_h === playerId ? (isHome ? f.team_h_difficulty : f.team_a_difficulty) : 0);
  });
  return values.reduce((sum, x) => sum + x, 0) / values.length || 0;
}

function normalizeNews(news) {
  return (news || '').toLowerCase();
}

function hasBadNews(news) {
  const normalized = normalizeNews(news);
  return [
    'injur',
    'loan',
    'expected back',
    'returning',
    'surgery',
    'hamstring',
    'dead leg',
    'calf',
    'groin',
    'knock'
  ].some(term => normalized.includes(term));
}

function expectedMinutes(player) {
  const chance = Number(player.chance_of_playing_this_round || player.chance_of_playing_next_round || 100);
  const base = Math.max(0, Math.min(100, chance)) / 100;
  return Math.round(base * 90);
}

function projectPoints(form, difficulty, gwCount, player) {
  if (!player || player.status !== 'a') return 0;
  if (hasBadNews(player.news)) return 0;

  const minutesPlayed = Number(player.minutes || 0);
  const recentForm = Number(player.form || 0);
  const pointsPerGame = Number(player.points_per_game || 0);

  if (minutesPlayed < 180 && recentForm < 1.2) {
    return 0;
  }

  const expectedMn = expectedMinutes(player) * gwCount;
  if (!expectedMn || pointsPerGame <= 0) return 0;

  const ppm = pointsPerGame / 90;
  const difficultyFactor = Math.max(0.7, 3.5 - difficulty * 0.3);
  const raw = ppm * expectedMn * difficultyFactor;

  return Number(Math.max(0, raw).toFixed(1));
}

function renderComparePills() {
  comparePills.innerHTML = '';
  selectedPlayers.forEach(id => {
    const player = players.find(p => p.id === Number(id));
    if (!player) return;
    const pill = document.createElement('span');
    pill.textContent = player.web_name;
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', () => {
      selectedPlayers.delete(id);
      renderTable();
      renderComparePills();
      compareOpen.disabled = selectedPlayers.size < 2;
    });
    pill.appendChild(removeBtn);
    comparePills.appendChild(pill);
  });
}

function updatePagination(filteredLength) {
  totalPages = Math.max(1, Math.ceil(filteredLength / ITEMS_PER_PAGE));
  currentPage = Math.min(currentPage, totalPages);

  if (pageInfo) pageInfo.textContent = `Page ${currentPage} / ${totalPages}`;
  if (pagePrev) pagePrev.disabled = currentPage <= 1;
  if (pageNext) pageNext.disabled = currentPage >= totalPages;
}

function renderTable() {
  const query = searchInput.value.trim().toLowerCase();
  const position = positionFilter.value;
  const team = teamFilter.value;

  const filtered = players.filter(player => {
    const teamMatch = !team || (player.team_name || '').toLowerCase() === team.toLowerCase();
    const posMatch = !position || player.type_name === position;
    const text = `${player.web_name} ${player.team_name} ${player.type_name}`.toLowerCase();
    const searchMatch = !query || text.includes(query);
    return teamMatch && posMatch && searchMatch;
  });

  updatePagination(filtered.length);

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageItems = filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  if (!pageItems.length) {
    tableBody.innerHTML = `<tr><td colspan="7" style="padding:2rem; text-align:center; color:#a5b4fc;">No players match your search or filters.</td></tr>`;
    return;
  }

  tableBody.innerHTML = pageItems.map(player => {
    const isSelected = selectedPlayers.has(String(player.id));
    const rowClass = isSelected ? 'selected-row' : '';
    return `
      <tr class="${rowClass}">
        <td><input type="checkbox" data-player-id="${player.id}" ${isSelected ? 'checked' : ''} aria-label="Select ${player.web_name} for comparison" /></td>
        <td>${safeText(player.web_name)}<div style="font-size:.8rem;color:#9ca3af;">${safeText(player.team_name)}</div></td>
        <td>${safeText(player.type_name)}</td>
        <td>${formatPrice(player.now_cost)}</td>
        <td class="projection-cell ${colorClass(player.projection_1gw)}">${player.projection_1gw}</td>
        <td class="projection-cell ${colorClass(player.projection_5gw)}">${player.projection_5gw}</td>
        <td class="projection-cell ${colorClass(player.projection_10gw)}">${player.projection_10gw}</td>
      </tr>`;
  }).join('');

  tableBody.querySelectorAll('input[type="checkbox"]').forEach(input => {
    input.addEventListener('change', (event) => {
      const playerId = event.target.getAttribute('data-player-id');
      if (!playerId) return;
      if (event.target.checked) {
        selectedPlayers.add(playerId);
      } else {
        selectedPlayers.delete(playerId);
      }
      renderComparePills();
      compareOpen.disabled = selectedPlayers.size < 2;
    });
  });
}

function buildComparisonContent() {
  const selected = Array.from(selectedPlayers)
    .slice(0, 4)
    .map(id => players.find(p => p.id === Number(id)))
    .filter(Boolean);

  if (!selected.length) return `<p style="color:#cbd5e1;">Select at least two players to compare.</p>`;

  const totals = selected.reduce((acc, player) => {
    acc.one += Number(player.projection_1gw || 0);
    acc.five += Number(player.projection_5gw || 0);
    acc.ten += Number(player.projection_10gw || 0);
    return acc;
  }, { one: 0, five: 0, ten: 0 });

  const average = {
    one: (totals.one / selected.length).toFixed(1),
    five: (totals.five / selected.length).toFixed(1),
    ten: (totals.ten / selected.length).toFixed(1)
  };

  return `
    <div style="margin-bottom:1rem; display:flex; gap:1rem; flex-wrap:wrap;">
      <div style="background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.08); border-radius:18px; padding:1rem; flex:1; min-width:180px;">
        <div style="color:#9ca3af; font-size:.8rem; text-transform:uppercase; letter-spacing:.1em; margin-bottom:.5rem;">Players compared</div>
        <div style="font-size:1.5rem; font-weight:700;">${selected.length}</div>
      </div>
      <div style="background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.08); border-radius:18px; padding:1rem; flex:1; min-width:180px;">
        <div style="color:#9ca3af; font-size:.8rem; text-transform:uppercase; letter-spacing:.1em; margin-bottom:.5rem;">Average 1GW</div>
        <div style="font-size:1.5rem; font-weight:700;">${average.one}</div>
      </div>
      <div style="background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.08); border-radius:18px; padding:1rem; flex:1; min-width:180px;">
        <div style="color:#9ca3af; font-size:.8rem; text-transform:uppercase; letter-spacing:.1em; margin-bottom:.5rem;">Average 5GW</div>
        <div style="font-size:1.5rem; font-weight:700;">${average.five}</div>
      </div>
      <div style="background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.08); border-radius:18px; padding:1rem; flex:1; min-width:180px;">
        <div style="color:#9ca3af; font-size:.8rem; text-transform:uppercase; letter-spacing:.1em; margin-bottom:.5rem;">Average 10GW</div>
        <div style="font-size:1.5rem; font-weight:700;">${average.ten}</div>
      </div>
    </div>
    <div class="comparison-grid">${selected.map(player => `
      <div class="comparison-card">
        <h3>${player.web_name}</h3>
        <dl>
          <dt>Team</dt><dd>${player.team_name}</dd>
          <dt>Position</dt><dd>${player.type_name}</dd>
          <dt>Price</dt><dd>${formatPrice(player.now_cost)}</dd>
          <dt>Form</dt><dd>${player.form || '0.0'}</dd>
          <dt>Fixture</dt><dd>${player.fixture_difficulty || 'N/A'}</dd>
          <dt>1GW</dt><dd class="${colorClass(player.projection_1gw)}">${player.projection_1gw}</dd>
          <dt>5GW</dt><dd class="${colorClass(player.projection_5gw)}">${player.projection_5gw}</dd>
          <dt>10GW</dt><dd class="${colorClass(player.projection_10gw)}">${player.projection_10gw}</dd>
        </dl>
      </div>`).join('')}</div>`;
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.style.display = 'block';
}

async function loadData() {
  try {
    const res = await fetch('/api/fpl-data');
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const errorMessage = body?.message || 'Unable to load projections.';
      throw new Error(errorMessage);
    }

    const json = await res.json();
    const bootstrap = json.bootstrap;
    const fixtures = json.fixtures || [];
    const currentGW = bootstrap?.events?.find(e => e.is_current)?.id || bootstrap?.events?.find(e => e.is_next)?.id - 1 || '—';

    if (!bootstrap || !bootstrap.elements) {
      throw new Error('Invalid FPL response from server.');
    }

    players = bootstrap.elements.map(player => {
      const teamName = bootstrap.teams.find(team => team.id === player.team)?.name || 'Unknown';
      const difficulty1 = getUpcomingDifficulty(fixtures, player.team, 1);
      const difficulty5 = getUpcomingDifficulty(fixtures, player.team, 5);
      const difficulty10 = getUpcomingDifficulty(fixtures, player.team, 10);
      const form = parseFloat(player.form || '0') || 0;

      return {
        id: player.id,
        web_name: player.web_name,
        type_name: { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }[player.element_type] || 'UNK',
        team_name: teamName,
        now_cost: player.now_cost,
        form: form.toFixed(1),
        fixture_difficulty: difficulty1.toFixed(1),
        status: player.status,
        news: player.news,
        minutes: player.minutes,
        points_per_game: player.points_per_game,
        chance_of_playing_this_round: player.chance_of_playing_this_round,
        chance_of_playing_next_round: player.chance_of_playing_next_round,
        projection_1gw: projectPoints(form, difficulty1, 1, player),
        projection_5gw: projectPoints(form, difficulty5, 5, player),
        projection_10gw: projectPoints(form, difficulty10, 10, player)
      };
    });

    teams = Array.from(new Set(players.map(p => p.team_name))).sort();

    if (liveNotice) {
      liveNotice.textContent = `Live data loaded — GW ${currentGW}`;
    }
    if (gwNote) {
      gwNote.textContent = `GW ${currentGW}`;
    }

    teamFilter.innerHTML = `<option value="">All teams</option>${teams.map(t => `<option value="${t}">${t}</option>`).join('')}`;
    renderTable();
  } catch (err) {
    console.error(err);
    showError(err.message || 'Failed to load player projections. Please refresh the page or try again later.');
    if (liveNotice) liveNotice.textContent = 'Live data not available';
    if (gwNote) gwNote.textContent = 'GW —';
  }
}

searchInput.addEventListener('input', () => {
  currentPage = 1;
  renderTable();
});
positionFilter.addEventListener('change', () => {
  currentPage = 1;
  renderTable();
});
teamFilter.addEventListener('change', () => {
  currentPage = 1;
  renderTable();
});
if (pagePrev) pagePrev.addEventListener('click', () => {
  if (currentPage > 1) {
    currentPage -= 1;
    renderTable();
  }
});
if (pageNext) pageNext.addEventListener('click', () => {
  if (currentPage < totalPages) {
    currentPage += 1;
    renderTable();
  }
});
compareOpen.addEventListener('click', () => {
  compareBody.innerHTML = buildComparisonContent();
  compareModal.classList.add('active');
  compareModal.setAttribute('aria-hidden', 'false');
});
compareClose.addEventListener('click', () => {
  compareModal.classList.remove('active');
  compareModal.setAttribute('aria-hidden', 'true');
});
compareModal.addEventListener('click', (event) => {
  if (event.target === compareModal) {
    compareModal.classList.remove('active');
    compareModal.setAttribute('aria-hidden', 'true');
  }
});

window.addEventListener('DOMContentLoaded', loadData);
