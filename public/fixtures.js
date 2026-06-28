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
    root.innerHTML = `<div class="fixture-list">` + fixtures.map(f => `
      <div class="card fixture-card">
        <img src="${f.home_logo_url || f.logo_url || '/images/default-logo.png'}" alt="${f.home_team}" />
        <div class="meta">
          <div class="teams">${escapeHtml(f.home_team)} <span style="opacity:0.65;font-weight:500">vs</span> ${escapeHtml(f.away_team)}</div>
          <div class="time">${new Date(f.match_time).toLocaleString()}</div>
        </div>
        <img src="${f.away_logo_url || '/images/default-logo.png'}" alt="${f.away_team}" />
        <div style="margin-left:12px">
          ${f.live_link ? `<a class="btn btn-primary" href="${escapeAttr(f.live_link)}" target="_blank" rel="noopener">Watch</a>` : ''}
        </div>
      </div>
    `).join('') + `</div>`;
  } catch (err) {
    console.error('Public fixtures load failed:', err);
    root.innerHTML = '<p>Could not load fixtures.</p>';
  }
}

document.addEventListener('DOMContentLoaded', loadPublicFixtures);
