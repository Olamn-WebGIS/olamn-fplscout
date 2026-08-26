const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveGameweek } = require('../public/utils.js');

test('prefers the next upcoming gameweek when current is missing or stale', () => {
  const now = new Date();
  const events = [
    { id: 1, finished: true, is_current: false, is_next: false, deadline_time: new Date(now.getTime() - 86400000).toISOString() },
    { id: 2, finished: false, is_current: false, is_next: true, deadline_time: new Date(now.getTime() + 86400000).toISOString() },
    { id: 3, finished: false, is_current: false, is_next: false, deadline_time: new Date(now.getTime() + 172800000).toISOString() }
  ];

  assert.equal(resolveGameweek(events).id, 2);
});

test('ignores a finished current gameweek and picks the next upcoming one', () => {
  const now = new Date();
  const events = [
    { id: 1, finished: true, is_current: true, is_next: false, deadline_time: new Date(now.getTime() - 86400000).toISOString() },
    { id: 2, finished: false, is_current: false, is_next: true, deadline_time: new Date(now.getTime() + 86400000).toISOString() },
    { id: 3, finished: false, is_current: false, is_next: false, deadline_time: new Date(now.getTime() + 172800000).toISOString() }
  ];

  assert.equal(resolveGameweek(events).id, 2);
});

test('falls back to the latest incomplete gameweek when no upcoming event exists', () => {
  const now = new Date();
  const events = [
    { id: 1, finished: true, is_current: false, is_next: false, deadline_time: new Date(now.getTime() - 86400000).toISOString() },
    { id: 2, finished: false, is_current: false, is_next: false, deadline_time: new Date(now.getTime() + 86400000).toISOString() }
  ];

  assert.equal(resolveGameweek(events).id, 2);
});
