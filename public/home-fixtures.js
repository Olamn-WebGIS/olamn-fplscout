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

  function makeFixtureCard(f) {
    const div = document.createElement('div');
    div.className = 'fixture-card';
    div.innerHTML = `
      ${f.title ? `<div class="fixture-competition">${f.title}</div>` : ''}
      <div class="fixture-teams">
        <div class="fixture-team"><img class="fixture-team-logo" data-src="${f.home_logo_url || f.home_logo_filename || ''}" alt="${f.home_team || ''}"><span class="team-name">${f.home_team || ''}</span></div>
        <div class="vs" style="font-weight:700;">vs</div>
        <div class="fixture-team"><span class="team-name">${f.away_team || ''}</span><img class="fixture-team-logo" data-src="${f.away_logo_url || f.away_logo_filename || ''}" alt="${f.away_team || ''}"></div>
      </div>
      <div class="time">${new Date(f.match_time).toLocaleString()}</div>
      <div class="fixture-action"><a class="btn btn-primary" href="${f.live_link || '#'}" target="_blank" rel="noopener">Watch</a></div>
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

    const scroller = document.createElement('div');
    scroller.className = 'fixture-scroller';
    fixtures.slice(0, 10).forEach(f => scroller.appendChild(makeFixtureCard(f)));
    root.innerHTML = '';
    root.appendChild(scroller);

    lazyLoadImages(scroller);
  }

  document.addEventListener('DOMContentLoaded', renderHomeFixtures);
})();
