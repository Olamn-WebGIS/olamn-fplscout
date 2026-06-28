function escapeHtml(s) {
  if (!s && s !== 0) return '';
  return String(s).replace(/[&"'<>]/g, function (c) {
    return { '&': '&amp;', '"': '&quot;', "'": '&#39;', '<': '&lt;', '>': '&gt;' }[c];
  });
}

function escapeAttr(s) {
  if (!s && s !== 0) return '';
  return String(s).replace(/"/g, '&quot;');
}

async function loadPublicFixtures() {
  const root = document.getElementById('fixtures-root');
  try {
    const res = await fetch('/api/fixtures');
    if (!res.ok) throw new Error('Failed to load');
    const data = await res.json();
    const fixtures = (data && data.fixtures) || [];
    if (fixtures.length === 0) {
      root.innerHTML = '<p>No fixtures at the moment.</p>';
      return;
    }
    // Render simplified hero match cards
    root.innerHTML = `<div class="fixture-list">` + fixtures.map(f => `
      <div class="card fixture-card hero">
        ${f.title ? `<div class="fixture-competition">${escapeHtml(f.title)}</div>` : ''}
        ${f.description ? `<div class="fixture-description">${escapeHtml(f.description)}</div>` : ''}
        <div class="fixture-teams">
          <span class="team-name">${escapeHtml(f.home_team)}</span>
          <span class="vs">vs</span>
          <span class="team-name">${escapeHtml(f.away_team)}</span>
        </div>
        <div class="time">${new Date(f.match_time).toLocaleString()}</div>
        <div class="fixture-action">${f.live_link ? `<a class="btn btn-primary" href="${escapeAttr(f.live_link)}" target="_blank" rel="noopener">Watch</a>` : ''}</div>
      </div>
    `).join('') + `</div>`;
  } catch (err) {
    console.error('Public fixtures load failed:', err);
    root.innerHTML = '<p>Could not load fixtures.</p>';
  }
}

document.addEventListener('DOMContentLoaded', loadPublicFixtures);
