const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeFixtureBatch } = require('./fixtures-utils');

test('normalizes a batch of fixtures for replacement', () => {
  const fixtures = [
    {
      home_team: ' Arsenal ',
      away_team: ' Chelsea ',
      match_time: '2026-06-30T20:00',
      live_link: 'https://example.com',
      home_logo_url: 'arsenal.png',
      away_logo_url: 'chelsea.png',
      title: '  Friendly  ',
      description: '  Test match  '
    }
  ];

  const normalized = normalizeFixtureBatch(fixtures);

  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].home_team, 'Arsenal');
  assert.equal(normalized[0].away_team, 'Chelsea');
  assert.equal(normalized[0].match_time, new Date('2026-06-30T20:00').toISOString());
  assert.equal(normalized[0].live_link, 'https://example.com');
  assert.equal(normalized[0].home_logo_url, 'arsenal.png');
  assert.equal(normalized[0].away_logo_url, 'chelsea.png');
  assert.equal(normalized[0].title, 'Friendly');
  assert.equal(normalized[0].description, 'Test match');
});

test('drops incomplete fixtures from a batch', () => {
  const fixtures = [
    { home_team: 'Arsenal', away_team: 'Chelsea', match_time: '2026-06-30T20:00' },
    { home_team: 'Liverpool', away_team: '', match_time: '' }
  ];

  const normalized = normalizeFixtureBatch(fixtures);

  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].home_team, 'Arsenal');
});
