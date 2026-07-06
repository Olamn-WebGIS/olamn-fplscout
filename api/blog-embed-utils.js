function normalizeVideoEmbedUrl(url) {
  if (!url) return '';

  const trimmed = String(url).trim();
  if (!trimmed) return '';

  const hasProtocol = /^(https?:)?\/\//i.test(trimmed);
  const normalizedUrl = hasProtocol ? trimmed : `https://${trimmed}`;

  try {
    const parsedUrl = new URL(normalizedUrl);
    const isFacebookHost = ['www.facebook.com', 'facebook.com', 'm.facebook.com'].includes(parsedUrl.hostname);
    if (!isFacebookHost) return '';

    const encodedUrl = encodeURIComponent(normalizedUrl);
    return `https://www.facebook.com/plugins/video.php?href=${encodedUrl}&show_text=0&width=560`;
  } catch (error) {
    return '';
  }
}

function buildResponsiveVideoEmbedMarkup(url) {
  const embedUrl = normalizeVideoEmbedUrl(url);
  if (!embedUrl) return '';

  return `
    <div class="blog-video-embed-wrapper">
      <iframe
        class="blog-video-embed"
        src="${embedUrl}"
        loading="lazy"
        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
        allowfullscreen
        title="Embedded Facebook video"
      ></iframe>
    </div>`;
}

module.exports = {
  normalizeVideoEmbedUrl,
  buildResponsiveVideoEmbedMarkup
};
