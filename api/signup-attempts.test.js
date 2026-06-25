const test = require('node:test');
const assert = require('node:assert/strict');
const { createSignupAttemptStore } = require('./signup-attempts');

test('stores signup attempts in reverse chronological order', () => {
  const store = createSignupAttemptStore(5);

  store.record({ email: 'first@example.com', status: 'failed' });
  store.record({ email: 'second@example.com', status: 'success' });

  const attempts = store.list();
  assert.equal(attempts.length, 2);
  assert.equal(attempts[0].email, 'second@example.com');
  assert.equal(attempts[1].email, 'first@example.com');
});

test('drops the oldest entries when the limit is exceeded', () => {
  const store = createSignupAttemptStore(2);

  store.record({ email: 'one@example.com', status: 'failed' });
  store.record({ email: 'two@example.com', status: 'success' });
  store.record({ email: 'three@example.com', status: 'failed' });

  const attempts = store.list();
  assert.equal(attempts.length, 2);
  assert.deepEqual(attempts.map((attempt) => attempt.email), ['three@example.com', 'two@example.com']);
});
