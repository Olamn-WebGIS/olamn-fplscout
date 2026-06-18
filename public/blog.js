const blogContainer = document.getElementById('blog-list-container');
const postContainer = document.getElementById('blog-post-container');
const subscribeModal = document.getElementById('subscribe-modal');
const newsletterEmail = document.getElementById('newsletter-email');
const newsletterSubmit = document.getElementById('newsletter-submit');
const newsletterClose = document.getElementById('newsletter-close');

const pathParts = window.location.pathname.split('/').filter(Boolean);
const slug = pathParts.length === 2 ? pathParts[1] : null;
const isPostPage = slug !== null;

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
  card.innerHTML = `
    <h2>${post.title}</h2>
    <div class="blog-meta"><span>${new Date(post.published_at).toLocaleDateString()}</span><span>${post.author || 'FPL Scout'}</span></div>
    <p>${post.summary}</p>
    <div class="blog-actions">
      <a href="/blog/${post.slug}" class="btn-share">Read full article</a>
      <button type="button" class="btn-share" onclick="sharePost('${encodeURIComponent(post.title)}','${encodeURIComponent(post.summary)}','/blog/${post.slug}')">Share</button>
    </div>
  `;
  return card;
}

function renderList(posts) {
  blogContainer.innerHTML = '<h1>Latest FPL Scout Articles</h1>';
  if (!posts.length) {
    blogContainer.innerHTML += '<p>No posts are available yet.</p>';
    return;
  }
  posts.forEach(post => blogContainer.appendChild(createPostCard(post)));
}

function renderPost(post) {
  postContainer.style.display = 'block';
  blogContainer.style.display = 'none';
  postContainer.innerHTML = `
    <div class="blog-post">
      <h1>${post.title}</h1>
      <div class="blog-meta"><span>${new Date(post.published_at).toLocaleDateString()}</span><span>${post.author || 'FPL Scout'}</span></div>
      <p style="font-size:1rem;color:#555;">${post.summary}</p>
      <div>${post.content.replace(/\n/g, '<br>')}</div>
      <div class="blog-actions">
        <button class="btn-share" onclick="sharePost('${encodeURIComponent(post.title)}','${encodeURIComponent(post.summary)}','/blog/${post.slug}')">Share this article</button>
      </div>
    </div>
    <div id="giscus-container"></div>
  `;
  renderGiscus(post.slug);
  setTimeout(() => subscribeModal.classList.add('active'), 15000);
}

function setupSubscribeModal() {
  newsletterSubmit.addEventListener('click', async () => {
    if (!newsletterEmail.value) return;
    const response = await fetch('/api/subscribe-newsletter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newsletterEmail.value })
    });
    const data = await response.json();
    newsletterSubmit.textContent = data.success ? 'Subscribed' : 'Try Again';
  });

  newsletterClose.addEventListener('click', () => {
    subscribeModal.classList.remove('active');
  });
}

function sharePost(title, summary, href) {
  const shareData = {
    title: decodeURIComponent(title),
    text: decodeURIComponent(summary),
    url: `${window.location.origin}${href}`
  };

  if (navigator.share) {
    navigator.share(shareData).catch(() => {});
  } else {
    navigator.clipboard.writeText(`${shareData.title} - ${shareData.url}`);
    alert('Link copied to clipboard.');
  }
}

function renderGiscus(slug) {
  const container = document.getElementById('giscus-container');
  if (!container) return;
  container.innerHTML = '';
  const script = document.createElement('script');
  script.src = 'https://giscus.app/client.js';
  script.async = true;
  script.setAttribute('data-repo', 'YOUR_GITHUB_USER/YOUR_REPO');
  script.setAttribute('data-repo-id', 'YOUR_REPO_ID');
  script.setAttribute('data-category', 'Blog Comments');
  script.setAttribute('data-category-id', 'YOUR_CATEGORY_ID');
  script.setAttribute('data-mapping', 'pathname');
  script.setAttribute('data-reactions-enabled', '1');
  script.setAttribute('data-emit-metadata', '0');
  script.setAttribute('data-input-position', 'bottom');
  script.setAttribute('data-theme', 'light');
  script.setAttribute('data-lang', 'en');
  script.crossOrigin = 'anonymous';
  container.appendChild(script);
}

window.sharePost = sharePost;

(async function () {
  setupSubscribeModal();
  try {
    if (isPostPage) {
      const post = await fetchPost(slug);
      renderPost(post);
    } else {
      const posts = await fetchPosts();
      renderList(posts);
    }
  } catch (error) {
    console.error(error);
    blogContainer.innerHTML = '<p>Unable to load blog content at the moment.</p>';
  }
})();
