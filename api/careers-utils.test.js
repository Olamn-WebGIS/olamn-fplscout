const test = require('node:test');
const assert = require('node:assert/strict');
const { isCareerSubmissionOpen, validateCareerVideo, normalizeEmail, buildCareerStatusEmail } = require('./careers-utils');

test('accepts submissions before the deadline', () => {
  assert.equal(isCareerSubmissionOpen(new Date('2026-07-31T12:00:00.000Z')), true);
});

test('blocks submissions after the deadline', () => {
  assert.equal(isCareerSubmissionOpen(new Date('2026-08-02T12:00:00.000Z')), false);
});

test('rejects over-sized or unsupported video uploads', () => {
  const oversized = { size: 24 * 1024 * 1024, originalname: 'demo.mp4' };
  const unsupported = { size: 1024, originalname: 'demo.txt' };

  assert.equal(validateCareerVideo(oversized).valid, false);
  assert.equal(validateCareerVideo(unsupported).valid, false);
});

test('normalizes applicant emails to lowercase', () => {
  assert.equal(normalizeEmail('Applicant@Example.com'), 'applicant@example.com');
});

test('builds a status email for approved applicants', () => {
  const email = buildCareerStatusEmail({ name: 'Ada', status: 'approved', uploadLink: 'https://example.com/upload' });
  assert.match(email.subject, /Approved/);
  assert.match(email.html, /https:\/\/example\.com\/upload/);
});
