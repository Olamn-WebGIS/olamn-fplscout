const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeVideoEmbedUrl, buildResponsiveVideoEmbedMarkup } = require('./blog-embed-utils');

test('normalizes a Facebook video URL into an iframe-friendly embed URL', () => {
  const normalized = normalizeVideoEmbedUrl('https://www.facebook.com/watch/?v=123456789');

  assert.match(normalized, /facebook\.com\/plugins\/video\.php/);
  assert.match(normalized, /href=https%3A%2F%2Fwww\.facebook\.com%2Fwatch%2F%3Fv%3D123456789/);
});

test('builds responsive iframe markup for a Facebook video embed', () => {
  const markup = buildResponsiveVideoEmbedMarkup('https://www.facebook.com/watch/?v=123456789');

  assert.match(markup, /class="blog-video-embed"/);
  assert.match(markup, /<iframe/);
  assert.match(markup, /src="https:\/\/www\.facebook\.com\/plugins\/video\.php/);
});

test('builds responsive iframe markup for a YouTube video embed', () => {
  const markup = buildResponsiveVideoEmbedMarkup('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

  assert.match(markup, /class="blog-video-embed"/);
  assert.match(markup, /<iframe/);
  assert.match(markup, /src="https:\/\/www\.youtube\.com\/embed\/dQw4w9WgXcQ/);
});
