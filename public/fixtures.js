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

function getLocalTeamLogoUrl(logoValue) {
  if (!logoValue) return '/images/default-logo.png';
  const normalized = String(logoValue).trim();
  if (!normalized) return '/images/default-logo.png';
  if (/^https?:\/\//i.test(normalized) || normalized.startsWith('/')) return normalized;
  return `/images/teams/${encodeURIComponent(normalized)}`;
}

function renderFixtureTeamLogo(logoValue, altText) {
  const imageUrl = getLocalTeamLogoUrl(logoValue);
  return `<span class="fixture-team-logo-wrapper"><img class="fixture-team-logo" src="${escapeAttr(imageUrl)}" alt="${escapeAttr(altText)}" onerror="this.onerror=null;this.src='/images/default-logo.png';" /></span>`;
}

const FIXTURE_AD_LINK = 'https://sidewalkboiling.com/g7x7a1uur?key=f8ec59492459515d2b651cdb08903baa';
const FIXTURE_AD_CLICK_COUNT_KEY = 'fpl_fixture_watch_clicks';
const FIXTURE_AD_CLICK_THRESHOLD = 3;

function getWatchHref(liveLink, premium) {
  if (premium) return liveLink || FIXTURE_AD_LINK;
  const clickCount = getFixtureWatchClickCount();
  if (clickCount >= FIXTURE_AD_CLICK_THRESHOLD) return liveLink || FIXTURE_AD_LINK;
  return FIXTURE_AD_LINK;
}

function getFixtureWatchNotice(premium) {
  if (premium) return '';
  const clickCount = getFixtureWatchClickCount();
  const remaining = Math.max(FIXTURE_AD_CLICK_THRESHOLD - clickCount, 0);
  if (remaining === 0) {
    return 'You have reached the free live link threshold. The next click will open the live match directly.';
  }
  return `Free users see the ad link first. Click ${remaining} more time${remaining === 1 ? '' : 's'} to open the live match directly.`;
}

function getFixtureWatchClickCount() {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return 0;
  const rawValue = localStorage.getItem(FIXTURE_AD_CLICK_COUNT_KEY);
  const count = parseInt(rawValue, 10);
  return Number.isNaN(count) ? 0 : count;
}

function setFixtureWatchClickCount(value) {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  localStorage.setItem(FIXTURE_AD_CLICK_COUNT_KEY, String(value));
}

function handleFixtureWatchClick(event) {
  const currentUser = readStoredUserSession();
  if (isPremiumUser(currentUser)) return;

  const anchor = event.currentTarget;
  const liveLink = anchor.dataset.liveLink;
  const adLink = anchor.dataset.adLink || FIXTURE_AD_LINK;
  const currentCount = getFixtureWatchClickCount();
  const nextCount = currentCount + 1;
  setFixtureWatchClickCount(nextCount);

  const targetUrl = nextCount >= FIXTURE_AD_CLICK_THRESHOLD ? (liveLink || adLink) : adLink;
  if (!targetUrl) return;

  event.preventDefault();
  window.open(targetUrl, '_blank', 'noopener');

  if (nextCount >= FIXTURE_AD_CLICK_THRESHOLD && liveLink) {
    anchor.href = liveLink;
  }
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

    const fixtureCards = fixtures.map(f => {
      const watchHref = getWatchHref(f.live_link, premium);
      const adLink = FIXTURE_AD_LINK;
      return `
      <div class="card fixture-card hero">
        ${f.title ? `<div class="fixture-competition">${escapeHtml(f.title)}</div>` : ''}
        ${f.description ? `<div class="fixture-description">${escapeHtml(f.description)}</div>` : ''}
        <div class="fixture-teams">
          <div class="fixture-team home-team">
            ${renderFixtureTeamLogo(f.home_logo_url || f.home_logo_filename || f.logo_url, f.home_team)}
            <span class="team-name">${escapeHtml(f.home_team)}</span>
          </div>
          <span class="vs">vs</span>
          <div class="fixture-team away-team">
            ${renderFixtureTeamLogo(f.away_logo_url || f.away_logo_filename || '', f.away_team)}
            <span class="team-name">${escapeHtml(f.away_team)}</span>
          </div>
        </div>
        <div class="time">${new Date(f.match_time).toLocaleString()}</div>
        <div class="fixture-action">
          <a class="btn btn-primary fixture-watch-btn"
             href="${escapeAttr(watchHref)}"
             data-live-link="${escapeAttr(f.live_link || '')}"
             data-ad-link="${escapeAttr(adLink)}"
             target="_blank"
             rel="noopener">
            Watch
          </a>
        </div>
        ${premium ? '' : `<div class="fixture-watch-note">${escapeHtml(getFixtureWatchNotice(premium))}</div>`}
      </div>
    `;
    });

    root.innerHTML = `<div class="fixture-list">` + fixtureCards.join('') + `</div>`;
    document.querySelectorAll('.fixture-watch-btn').forEach(btn => btn.addEventListener('click', handleFixtureWatchClick));
  } catch (err) {
    console.error('Public fixtures load failed:', err);
    root.innerHTML = '<p>Could not load fixtures.</p>';
  }
}

document.addEventListener('DOMContentLoaded', loadPublicFixtures);
