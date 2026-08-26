const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveCurrentGameweek, resolveNextGameweek } = require('../public/utils.js');

test('uses the marked current event for live squad data', () => {
  const now = new Date();
  const events = [
    { id: 1, finished: true, is_current: true, is_next: false, deadline_time: new Date(now.getTime() - 86400000).toISOString() },
    { id: 2, finished: false, is_current: false, is_next: true, deadline_time: new Date(now.getTime() + 86400000).toISOString() },
    { id: 3, finished: false, is_current: false, is_next: false, deadline_time: new Date(now.getTime() + 172800000).toISOString() }
  ];

  assert.equal(resolveCurrentGameweek(events).id, 1);
});

test('uses the next unfinished event for transfer availability', () => {
  const now = new Date();
  const events = [
    { id: 1, finished: true, is_current: true, is_next: false, deadline_time: new Date(now.getTime() - 86400000).toISOString() },
    { id: 2, finished: false, is_current: false, is_next: true, deadline_time: new Date(now.getTime() + 86400000).toISOString() },
    { id: 3, finished: false, is_current: false, is_next: false, deadline_time: new Date(now.getTime() + 172800000).toISOString() }
  ];

  assert.equal(resolveNextGameweek(events).id, 2);
});

test('keeps the current event for live squad data while using the next event for transfers', () => {
  const now = new Date();
  const events = [
    { id: 1, finished: true, is_current: true, is_next: false, deadline_time: new Date(now.getTime() - 86400000).toISOString() },
    { id: 2, finished: false, is_current: false, is_next: true, deadline_time: new Date(now.getTime() + 86400000).toISOString() }
  ];

  assert.equal(resolveCurrentGameweek(events).id, 1);
  assert.equal(resolveNextGameweek(events).id, 2);
});

test('defaults to one available transfer when FPL omits transfers_balance', () => {
  const now = new Date();
  const events = [
    { id: 1, finished: true, is_current: true, is_next: false, deadline_time: new Date(now.getTime() - 86400000).toISOString() },
    { id: 2, finished: false, is_current: false, is_next: true, deadline_time: new Date(now.getTime() + 86400000).toISOString() }
  ];

  const { resolveAvailableTransfers } = require('../public/utils.js');
  assert.equal(resolveAvailableTransfers({ current_event: 1, transfers: 0 }, events), 1);
});

test('falls back to the latest unfinished gameweek when there is no current or next marker', () => {
  const now = new Date();
  const events = [
    { id: 1, finished: true, is_current: false, is_next: false, deadline_time: new Date(now.getTime() - 86400000).toISOString() },
    { id: 2, finished: false, is_current: false, is_next: false, deadline_time: new Date(now.getTime() + 86400000).toISOString() }
  ];

  assert.equal(resolveCurrentGameweek(events).id, 2);
});
