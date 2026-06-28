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

function initialsFromTeam(team) {
  if (!team) return 'VS';
  return String(team)
    .split(/\s+/)
    .map(word => word.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function renderTeamLogo(team, logoUrl) {
  const initials = initialsFromTeam(team);
  if (logoUrl) {
    return `
      <div class="team-logo-wrapper">
        <img class="team-logo" src="${escapeAttr(logoUrl)}" alt="${escapeAttr(team)}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'" />
        <span class="team-logo-placeholder" style="display:none">${escapeHtml(initials)}</span>
      </div>`;
  }

  return `<div class="team-logo-wrapper"><span class="team-logo-placeholder">${escapeHtml(initials)}</span></div>`;
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
    // Render hero-style centered match cards
    root.innerHTML = `<div class="fixture-list">` + fixtures.map(f => `
      <div class="card fixture-card hero">
        ${f.title ? `<div class="fixture-competition">${escapeHtml(f.title)}</div>` : ''}
        ${f.description ? `<div class="fixture-description">${escapeHtml(f.description)}</div>` : ''}
        <div class="fixture-teams">
          <div class="team-block">
            ${renderTeamLogo(f.home_team, f.home_logo_url || f.logo_url)}
            <span class="team-name">${escapeHtml(f.home_team)}</span>
          </div>
          <span class="vs">vs</span>
          <div class="team-block">
            ${renderTeamLogo(f.away_team, f.away_logo_url)}
            <span class="team-name">${escapeHtml(f.away_team)}</span>
          </div>
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
