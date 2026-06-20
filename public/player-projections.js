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

let players = [];
let teams = [];
let selectedPlayers = new Set();

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

function projectPoints(form, difficulty, gwCount) {
  const normalized = Math.min(Math.max(form || 0, 0), 10);
  return Number((normalized * (6 - difficulty / 2) * Math.sqrt(gwCount)).toFixed(1));
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

  if (!filtered.length) {
    tableBody.innerHTML = `<tr><td colspan="7" style="padding:2rem; text-align:center; color:#a5b4fc;">No players match your search or filters.</td></tr>`;
    return;
  }

  tableBody.innerHTML = filtered.map(player => {
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
    const res = await fetch('/api/player-projections');
    if (!res.ok) throw new Error('Unable to load projections.');
    const json = await res.json();
    players = json.players || [];
    teams = Array.from(new Set(players.map(p => p.team_name))).sort();

    teamFilter.innerHTML = `<option value="">All teams</option>${teams.map(t => `<option value="${t}">${t}</option>`).join('')}`;
    renderTable();
  } catch (err) {
    console.error(err);
    showError('Failed to load player projections. Please refresh the page or try again later.');
  }
}

searchInput.addEventListener('input', renderTable);
positionFilter.addEventListener('change', renderTable);
teamFilter.addEventListener('change', renderTable);
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
