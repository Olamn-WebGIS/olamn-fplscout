function normalizeFixtureBatch(fixtures) {
  if (!Array.isArray(fixtures)) return [];

  return fixtures
    .map((fixture) => {
      const home_team = String(fixture?.home_team || '').trim();
      const away_team = String(fixture?.away_team || '').trim();
      const matchTime = fixture?.match_time;
      const live_link = String(fixture?.live_link || '').trim();
      const home_logo_url = String(fixture?.home_logo_url || fixture?.home_logo_filename || '').trim();
      const away_logo_url = String(fixture?.away_logo_url || fixture?.away_logo_filename || '').trim();
      const title = String(fixture?.title || '').trim();
      const description = String(fixture?.description || '').trim();

      if (!home_team || !away_team || !matchTime) return null;

      const parsedTime = new Date(matchTime);
      const normalizedMatchTime = Number.isNaN(parsedTime.getTime()) ? null : parsedTime.toISOString();
      if (!normalizedMatchTime) return null;

      return {
        home_team,
        away_team,
        match_time: normalizedMatchTime,
        live_link: live_link || null,
        home_logo_url: home_logo_url || null,
        away_logo_url: away_logo_url || null,
        title: title || null,
        description: description || null
      };
    })
    .filter(Boolean);
}

module.exports = {
  normalizeFixtureBatch
};
