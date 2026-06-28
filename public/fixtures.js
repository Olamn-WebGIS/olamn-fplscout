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

function readStoredUserSession() {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return null;
  try {
    const rawSession = localStorage.getItem('fpl_user_session');
    return rawSession ? JSON.parse(rawSession) : null;
  } catch (error) {
    return null;
  }
}

function isPremiumUser(user) {
  if (!user) return false;
  if (user.isPremium === true || user.is_premium === true) return true;
  if (user.subscription_status && ['Premium Member', 'premium', 'premium member', 'premium subscription'].includes(String(user.subscription_status).toLowerCase().trim())) return true;
  if (user.premium_expiry) {
    const expiryDate = new Date(user.premium_expiry);
    return !Number.isNaN(expiryDate.getTime()) && expiryDate > new Date();
  }
  return false;
}

function getWatchHref(liveLink, premium) {
  const adLink = 'https://sidewalkboiling.com/g7x7a1uur?key=f8ec59492459515d2b651cdb08903baa';
  if (!liveLink) return adLink;
  return premium ? liveLink : adLink;
}

function injectFixtureAdScript(premium) {
  if (premium) return;
  if (document.querySelector('script[data-sidewalk-boiling]')) return;
  const script = document.createElement('script');
  script.src = 'https://sidewalkboiling.com/c1/2e/18/c12e186c286b55079d6be2abac279806.js';
  script.async = true;
  script.setAttribute('data-sidewalk-boiling', 'true');
  document.body.appendChild(script);
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
    const currentUser = readStoredUserSession();
    const premium = isPremiumUser(currentUser);
    injectFixtureAdScript(premium);

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
        <div class="fixture-action">${`<a class="btn btn-primary" href="${escapeAttr(getWatchHref(f.live_link, premium))}" target="_blank" rel="noopener">Watch</a>`}</div>
      </div>
    `).join('') + `</div>`;
  } catch (err) {
    console.error('Public fixtures load failed:', err);
    root.innerHTML = '<p>Could not load fixtures.</p>';
  }
}

document.addEventListener('DOMContentLoaded', loadPublicFixtures);
