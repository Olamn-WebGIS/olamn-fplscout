function normalizeVideoEmbedUrl(url) {
  if (!url) return '';

  const trimmed = String(url).trim();
  if (!trimmed) return '';

  const hasProtocol = /^(https?:)?\/\//i.test(trimmed);
  const normalizedUrl = hasProtocol ? trimmed : `https://${trimmed}`;

  try {
    const parsedUrl = new URL(normalizedUrl);
    const host = parsedUrl.hostname.toLowerCase();

    if (['www.facebook.com', 'facebook.com', 'm.facebook.com'].includes(host)) {
      const encodedUrl = encodeURIComponent(normalizedUrl);
      return `https://www.facebook.com/plugins/video.php?href=${encodedUrl}&show_text=0&width=560`;
    }

    if (['www.youtube.com', 'youtube.com', 'youtu.be'].includes(host)) {
      const videoId = getYouTubeVideoId(parsedUrl);
      if (!videoId) return '';
      return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&showinfo=0`; 
    }

    return '';
  } catch (error) {
    return '';
  }
}

function getYouTubeVideoId(parsedUrl) {
  if (!parsedUrl) return '';
  const host = parsedUrl.hostname.toLowerCase();

  if (host === 'youtu.be') {
    return parsedUrl.pathname.slice(1);
  }

  if (host === 'www.youtube.com' || host === 'youtube.com') {
    if (parsedUrl.pathname === '/watch') {
      return parsedUrl.searchParams.get('v') || '';
    }
    if (parsedUrl.pathname.startsWith('/shorts/')) {
      return parsedUrl.pathname.split('/')[2] || '';
    }
    if (parsedUrl.pathname.startsWith('/embed/')) {
      return parsedUrl.pathname.split('/')[2] || '';
    }
  }

  return '';
}

function getVideoWrapperClass(url) {
  if (!url) return 'blog-video-embed-wrapper';

  try {
    const normalizedUrl = String(url).trim();
    const parsedUrl = new URL(normalizedUrl);
    const host = parsedUrl.hostname.toLowerCase();

    if (/\/reel\/|\/reels\//i.test(parsedUrl.pathname)) {
      return 'blog-video-embed-wrapper blog-video-embed-wrapper--vertical';
    }

    if (['www.youtube.com', 'youtube.com', 'youtu.be'].includes(host)) {
      return 'blog-video-embed-wrapper blog-video-embed-wrapper--youtube';
    }

    return 'blog-video-embed-wrapper';
  } catch (error) {
    return 'blog-video-embed-wrapper';
  }
}

function buildResponsiveVideoEmbedMarkup(url) {
  const embedUrl = normalizeVideoEmbedUrl(url);
  if (!embedUrl) return '';

  const wrapperClass = getVideoWrapperClass(url);

  return `
    <div class="${wrapperClass}">
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
