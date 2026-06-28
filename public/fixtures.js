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
    root.innerHTML = fixtures.map(f => `
      <div class="fixture">
        <img src="${f.home_logo_url || f.logo_url || '/images/default-logo.png'}" alt="${f.home_team}" />
        <div style="flex:1">
          <strong>${f.home_team}</strong> <span style="opacity:0.7">vs</span> <strong>${f.away_team}</strong>
          <div style="font-size:0.9rem;color:#444">${new Date(f.match_time).toLocaleString()}</div>
        </div>
        <img src="${f.away_logo_url || '/images/default-logo.png'}" alt="${f.away_team}" />
      </div>
    `).join('');
  } catch (err) {
    console.error('Public fixtures load failed:', err);
    root.innerHTML = '<p>Could not load fixtures.</p>';
  }
}

document.addEventListener('DOMContentLoaded', loadPublicFixtures);
