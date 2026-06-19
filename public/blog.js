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
    <div class="blog-post" id="blog-article">
      <h1>${post.title}</h1>
      <div class="blog-meta"><span>${new Date(post.published_at).toLocaleDateString()}</span><span>${post.author || 'FPL Scout'}</span></div>
      <p style="font-size:1rem;color:#555;">${post.summary}</p>
      <div>${post.content}</div>
      <div class="blog-actions blog-actions-minimal">
        <button class="btn-icon" onclick="sharePost('${encodeURIComponent(post.title)}','${encodeURIComponent(post.summary)}','/blog/${post.slug}')">🔗<span>Share</span></button>
        <button class="btn-icon" id="like-button" onclick="toggleLike('${post.slug}')">❤️<span id="like-count">${post.likes || 0}</span></button>
      </div>
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
        <button type="submit" class="btn-share">Post Comment</button>
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
      if (postContainer.innerHTML.trim()) {
        postContainer.style.display = 'block';
        blogContainer.style.display = 'none';
        renderComments(slug);
        setTimeout(() => subscribeModal.classList.add('active'), 15000);
      } else {
        const post = await fetchPost(slug);
        renderPost(post);
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
