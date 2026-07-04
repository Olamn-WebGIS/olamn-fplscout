/* Home page fixtures scroller */
(function () {
  async function fetchFixtures() {
    try {
      const res = await fetch('/api/fixtures');
      if (!res.ok) throw new Error('Failed to load fixtures');
      const data = await res.json();
      return (data && data.fixtures) || [];
    } catch (e) {
      console.error('Home fixtures fetch failed:', e);
      return [];
    }
  }

  function resolveLogoUrl(value) {
    if (!value) return '/images/default-logo.png';
    const v = String(value).trim();
    if (!v) return '/images/default-logo.png';
    if (/^https?:\/\//i.test(v) || v.startsWith('/')) return v;
    return `/images/teams/${encodeURIComponent(v)}`;
  }

  const FIXTURE_AD_LINK = 'https://sidewalkboiling.com/g7x7a1uur?key=f8ec59492459515d2b651cdb08903baa';
  const FIXTURE_AD_CLICK_COUNT_KEY = 'fpl_fixture_watch_clicks';
  const FIXTURE_AD_CLICK_THRESHOLD = 3;

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

  function makeFixtureCard(f) {
    const homeLogo = resolveLogoUrl(f.home_logo_url || f.home_logo_filename || f.logo_url || '');
    const awayLogo = resolveLogoUrl(f.away_logo_url || f.away_logo_filename || '');

    const div = document.createElement('div');
    div.className = 'fixture-card';
    div.innerHTML = `
      ${f.title ? `<div class="fixture-competition">${f.title}</div>` : ''}
      <div class="fixture-teams">
        <div class="fixture-team"><img class="fixture-team-logo" data-src="${homeLogo}" alt="${f.home_team || ''}"><span class="team-name">${f.home_team || ''}</span></div>
        <div class="vs" style="font-weight:700;">vs</div>
        <div class="fixture-team"><span class="team-name">${f.away_team || ''}</span><img class="fixture-team-logo" data-src="${awayLogo}" alt="${f.away_team || ''}"></div>
      </div>
      <div class="time">${new Date(f.match_time).toLocaleString()}</div>
      <div class="fixture-action"><a class="btn btn-green fixture-watch-btn" href="${f.live_link || '#'}" data-live-link="${f.live_link || ''}" data-ad-link="${FIXTURE_AD_LINK}" target="_blank" rel="noopener">Watch</a></div>
    `;
    return div;
  }

  function lazyLoadImages(root) {
    const imgs = root.querySelectorAll('img[data-src]');
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries, obs) => {
        entries.forEach(e => {
          if (!e.isIntersecting) return;
          const img = e.target;
          img.src = img.dataset.src || img.getAttribute('src') || '';
          img.removeAttribute('data-src');
          obs.unobserve(img);
        });
      }, { rootMargin: '200px' });
      imgs.forEach(i => io.observe(i));
    } else {
      imgs.forEach(i => { i.src = i.dataset.src || ''; i.removeAttribute('data-src'); });
    }
  }

  async function renderHomeFixtures() {
    const root = document.getElementById('fixtures-root');
    if (!root) return;
    root.innerHTML = '<div class="fixture-empty">Loading fixtures…</div>';
    const fixtures = await fetchFixtures();
    if (!fixtures || fixtures.length === 0) {
      root.innerHTML = '<div class="fixture-empty">No fixtures at the moment.</div>';
      return;
    }

    const currentUser = readStoredUserSession();
    const premium = isPremiumUser(currentUser);
    injectFixtureAdScript(premium);

    const scroller = document.createElement('div');
    scroller.className = 'fixture-scroller';
    fixtures.slice(0, 10).forEach(f => scroller.appendChild(makeFixtureCard(f)));
    root.innerHTML = '';
    root.appendChild(scroller);

    lazyLoadImages(scroller);
    document.querySelectorAll('.fixture-watch-btn').forEach(btn => btn.addEventListener('click', handleFixtureWatchClick));
  }

  document.addEventListener('DOMContentLoaded', renderHomeFixtures);
})();
