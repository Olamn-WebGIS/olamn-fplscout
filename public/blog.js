const blogContainer = document.getElementById('blog-list-container');
const postContainer = document.getElementById('blog-post-container');
const subscribeModal = document.getElementById('subscribe-modal');
const newsletterEmail = document.getElementById('newsletter-email');
const newsletterSubmit = document.getElementById('newsletter-submit');
const newsletterClose = document.getElementById('newsletter-close');

const pathParts = window.location.pathname.split('/').filter(Boolean);
const slug = pathParts.length === 2 ? pathParts[1] : null;
const isPostPage = slug !== null;

function normalizeUrl(url) {
  if (!url) return '';
  const trimmed = url.trim();
  if (/^(https?:\/\/|mailto:|tel:)/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getVideoEmbedMarkup(url, title, fallbackImageUrl) {
  if (!url) return '';
  const normalizedUrl = normalizeUrl(url);
  if (!normalizedUrl) return '';

  let parsedUrl;
  try {
    parsedUrl = new URL(normalizedUrl);
  } catch (error) {
    return '';
  }

  const hostname = parsedUrl.hostname.replace(/^www\./i, '');
  const safeTitle = escapeHtml(title || 'Embedded video');
  const fallbackPoster = fallbackImageUrl ? `poster="${escapeHtml(fallbackImageUrl)}"` : '';
  const isPortrait = /facebook\.com|reels|shorts|tiktok|instagram|snapchat|streamable/i.test(normalizedUrl) || parsedUrl.searchParams.get('t') || parsedUrl.pathname.includes('/shorts/');
  const wrapperClass = isPortrait ? 'blog-video-embed-wrapper blog-video-embed-wrapper--vertical' : 'blog-video-embed-wrapper';

  if (hostname.includes('facebook.com')) {
    const facebookHref = encodeURIComponent(normalizedUrl);
    return `
      <div class="blog-embed-section">
        <div class="${wrapperClass}">
          <iframe class="blog-video-embed" src="https://www.facebook.com/plugins/video.php?href=${facebookHref}&show_text=0&width=560" title="${safeTitle}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe>
        </div>
      </div>
    `;
  }

  if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
    let videoId = '';
    if (parsedUrl.searchParams.get('v')) {
      videoId = parsedUrl.searchParams.get('v');
    } else if (parsedUrl.pathname.includes('/shorts/')) {
      videoId = parsedUrl.pathname.split('/shorts/')[1]?.split('/')[0] || '';
    } else if (parsedUrl.pathname.startsWith('/embed/')) {
      videoId = parsedUrl.pathname.split('/embed/')[1] || '';
    } else if (hostname === 'youtu.be') {
      videoId = parsedUrl.pathname.replace(/^\//, '');
    }

    if (videoId) {
      return `
        <div class="blog-embed-section">
          <div class="${wrapperClass}">
            <iframe class="blog-video-embed" src="https://www.youtube.com/embed/${encodeURIComponent(videoId)}" title="${safeTitle}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe>
          </div>
        </div>
      `;
    }
  }

  if (hostname.includes('vimeo.com')) {
    const videoId = parsedUrl.pathname.split('/').filter(Boolean)[0];
    if (videoId) {
      return `
        <div class="blog-embed-section">
          <div class="${wrapperClass}">
            <iframe class="blog-video-embed" src="https://player.vimeo.com/video/${encodeURIComponent(videoId)}" title="${safeTitle}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe>
          </div>
        </div>
      `;
    }
  }

  if (hostname.includes('streamable.com')) {
    const streamablePath = parsedUrl.pathname.replace(/^\/+|\/+$/g, '');
    const embedPath = streamablePath.startsWith('e/') ? streamablePath : `e/${streamablePath}`;
    return `
      <div class="blog-embed-section">
        <div class="${wrapperClass}">
          <iframe class="blog-video-embed" src="https://streamable.com/${embedPath}" title="${safeTitle}" allow="autoplay; fullscreen" allowfullscreen loading="lazy"></iframe>
        </div>
      </div>
    `;
  }

  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(parsedUrl.pathname)) {
    return `
      <div class="blog-embed-section">
        <div class="${wrapperClass}">
          <video class="blog-video-embed" controls preload="metadata" playsinline ${fallbackPoster}>
            <source src="${escapeHtml(normalizedUrl)}" />
          </video>
        </div>
      </div>
    `;
  }

  return '';
}

async function fetchPosts() {
  const res = await fetch('/api/posts');
  if (!res.ok) throw new Error('Unable to load posts');
  return res.json();
}

async function fetchPost(slug) {
  const res = await fetch(`/api/posts/${slug}`);
  if (!res.ok) throw new Error('Post not found');
  return res.json();
}

function createPostCard(post) {
  const card = document.createElement('div');
  card.className = 'blog-list-item';

  const title = document.createElement('h2');
  title.textContent = post.title;

  const meta = document.createElement('div');
  meta.className = 'blog-meta';
  meta.innerHTML = `<span>${new Date(post.published_at).toLocaleDateString()}</span><span>${post.author || 'FPL Scout'}</span>`;

  const summary = document.createElement('p');
  summary.textContent = post.summary;

  const imgWrap = document.createElement('div');
  if (post.image_url) {
    imgWrap.style.textAlign = 'center';
    const img = document.createElement('img');
    img.src = post.image_url;
    img.alt = post.image_alt || post.title || 'Featured image';
    img.loading = 'lazy';
    img.style.maxWidth = '100%';
    img.style.height = 'auto';
    img.className = 'blog-featured-list';
    imgWrap.appendChild(img);
  }

  const actions = document.createElement('div');
  actions.className = 'blog-actions';

  const readLink = document.createElement('a');
  readLink.href = `/blog/${post.slug}`;
  readLink.className = 'blog-read-link';
  readLink.textContent = 'Read full article';

  const shareButton = document.createElement('button');
  shareButton.type = 'button';
  shareButton.className = 'btn-icon btn-share-icon';
  shareButton.textContent = 'Share 🔗';
  shareButton.addEventListener('click', () => sharePost(post.title, post.summary, `/blog/${post.slug}`, post.image_url));

  actions.appendChild(readLink);
  actions.appendChild(shareButton);
  card.appendChild(title);
  card.appendChild(meta);
  card.appendChild(summary);
  if (post.image_url) {
    card.appendChild(imgWrap);
  }
  card.appendChild(actions);

  return card;
}

function renderList(posts) {
  blogContainer.innerHTML = '<h1><span class="heading-white">Latest</span> <span class="heading-green">FPL Scout Articles</span></h1>';
  if (!posts.length) {
    blogContainer.innerHTML += '<p>No posts are available yet.</p>';
    return;
  }
  posts.forEach(post => blogContainer.appendChild(createPostCard(post)));
}

function renderPost(post) {
  postContainer.style.display = 'block';
  blogContainer.style.display = 'none';
  const videoEmbedMarkup = getVideoEmbedMarkup(post.reel_link, post.title, post.image_url);
  const safeTitle = escapeHtml(post.title || 'Blog post');
  const safeSummary = escapeHtml(post.summary || '');
  const safeContent = post.content || '';

  postContainer.innerHTML = `
    <div class="blog-post" id="blog-article">
      <h1>${safeTitle}</h1>
      <div class="blog-meta"><span>${new Date(post.published_at).toLocaleDateString()}</span><span>${escapeHtml(post.author || 'FPL Scout')}</span></div>
      <p style="font-size:1rem;color:#555;">${safeSummary}</p>
      <div>${safeContent}</div>
      ${videoEmbedMarkup}
      <div class="blog-actions blog-actions-minimal">
        <button class="btn-icon" onclick="sharePost('${encodeURIComponent(post.title)}','${encodeURIComponent(post.summary)}','/blog/${post.slug}','${encodeURIComponent(post.image_url || '')}')">🔗<span>Share</span></button>
        <button class="btn-icon" id="like-button" onclick="toggleLike('${post.slug}')">❤️<span id="like-count">${post.likes || 0}</span></button>
      </div>
      <div class="blog-article-footer">Favour Olamilekan Adeoye, Founder of FPL Scout</div>
    </div>
    <div id="comments-container"></div>
  `;
  renderComments(post.slug);
  setTimeout(() => subscribeModal.classList.add('active'), 15000);
}

async function likePost(slug) {
  try {
    const res = await fetch(`/api/posts/${slug}/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (data.success) {
      const likeCount = document.getElementById('like-count');
      if (likeCount) likeCount.textContent = data.likes;
    }
  } catch (error) {
    console.error('Unable to like post.', error);
  }
}

function toggleLike(slug) {
  likePost(slug);
}

window.toggleLike = toggleLike;

function hasSubscribedNewsletter() {
  return localStorage.getItem('fpl_blog_newsletter_subscribed') === 'true';
}

function markNewsletterSubscribed() {
  localStorage.setItem('fpl_blog_newsletter_subscribed', 'true');
}

function setupSubscribeModal() {
  newsletterSubmit.addEventListener('click', async () => {
    if (!newsletterEmail.value) return;
    try {
      const response = await fetch('/api/subscribe-newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newsletterEmail.value })
      });
      const data = await response.json();
      if (data.success) {
        newsletterSubmit.textContent = data.message === 'This email is already subscribed.' ? 'Already Subscribed' : 'Subscribed';
        markNewsletterSubscribed();
        subscribeModal.classList.remove('active');
        return;
      }

      newsletterSubmit.textContent = data.message || 'Try Again';
    } catch (error) {
      console.error('Newsletter subscribe error:', error);
      newsletterSubmit.textContent = 'Try Again';
    }
  });

  newsletterClose.addEventListener('click', () => {
    subscribeModal.classList.remove('active');
  });
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch (error) {
    return value;
  }
}

async function sharePost(title, summary, href, imageUrl) {
  const shareData = {
    title: safeDecode(title),
    text: safeDecode(summary),
    url: `${window.location.origin}${href}`
  };

  if (navigator.share) {
    if (imageUrl && navigator.canShare) {
      try {
        const response = await fetch(imageUrl);
        if (response.ok) {
          const blob = await response.blob();
          const extension = blob.type.split('/')[1] || 'jpg';
          const file = new File([blob], `blog-image.${extension}`, { type: blob.type });
          if (navigator.canShare({ files: [file] })) {
            shareData.files = [file];
          }
        }
      } catch (error) {
        console.warn('Could not include image in share:', error);
      }
    }

    navigator.share(shareData).catch(() => {});
  } else {
    navigator.clipboard.writeText(`${shareData.title} - ${shareData.url}`);
    alert('Link copied to clipboard.');
  }
}

async function renderComments(slug) {
  const container = document.getElementById('comments-container');
  if (!container) return;

  container.innerHTML = `
    <div class="comments-section">
      <h2>Comments</h2>
      <form id="comment-form" class="comment-form">
        <div class="comment-field">
          <label for="comment-author">Author</label>
          <input id="comment-author" type="text" placeholder="Your name" required />
        </div>
        <div class="comment-field">
          <label for="comment-content">Content</label>
          <textarea id="comment-content" rows="4" placeholder="Write your comment..." required></textarea>
        </div>
        <button type="submit" class="btn-icon">💬<span>Comment</span></button>
      </form>
      <div id="comment-list" class="comment-list"></div>
    </div>
  `;

  const commentForm = document.getElementById('comment-form');
  const commentList = document.getElementById('comment-list');

  async function loadComments() {
    commentList.innerHTML = '<p>Loading comments...</p>';
    try {
      const res = await fetch(`/api/comments/${encodeURIComponent(slug)}`);
      if (!res.ok) throw new Error('Unable to load comments');
      const comments = await res.json();
      if (!Array.isArray(comments) || comments.length === 0) {
        commentList.innerHTML = '<p>No comments yet. Be the first to share your thoughts.</p>';
        return;
      }

      commentList.innerHTML = comments.map(comment => `
        <article class="comment-card">
          <div class="comment-card-header">
            <strong>${escapeHtml(comment.author_name)}</strong>
            <span>${new Date(comment.created_at).toLocaleString()}</span>
          </div>
          <p>${escapeHtml(comment.content)}</p>
        </article>
      `).join('');
    } catch (error) {
      console.error('Comments load failed:', error);
      commentList.innerHTML = '<p>Unable to load comments right now.</p>';
    }
  }

  async function submitComment(event) {
    event.preventDefault();
    const authorInput = document.getElementById('comment-author');
    const contentInput = document.getElementById('comment-content');
    const authorName = authorInput.value.trim();
    const content = contentInput.value.trim();

    if (!authorName || !content) return;

    try {
      const response = await fetch(`/api/comments/${encodeURIComponent(slug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author_name: authorName, content })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Comment submission failed');
      }

      authorInput.value = '';
      contentInput.value = '';
      await loadComments();
    } catch (error) {
      console.error('Comment submit error:', error);
      alert('Unable to submit comment right now. Please try again later.');
    }
  }

  commentForm.addEventListener('submit', submitComment);
  await loadComments();
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

window.sharePost = sharePost;

(async function () {
  setupSubscribeModal();
  try {
    if (isPostPage) {
      try {
        const post = await fetchPost(slug);
        renderPost(post);
      } catch (error) {
        if (postContainer.innerHTML.trim()) {
          postContainer.style.display = 'block';
          blogContainer.style.display = 'none';
        }
      }
      renderComments(slug);

      if (!hasSubscribedNewsletter()) {
        setTimeout(() => subscribeModal.classList.add('active'), 15000);
      }
    } else {
      if (!blogContainer.innerHTML.trim()) {
        const posts = await fetchPosts();
        renderList(posts);
      }
    }
  } catch (error) {
    console.error(error);
    blogContainer.innerHTML = '<p>Unable to load blog content at the moment.</p>';
  }
})();
