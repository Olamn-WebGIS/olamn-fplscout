const loginCard = document.getElementById('login-card');
const postCard = document.getElementById('post-card');
const postsListCard = document.getElementById('posts-list-card');
const adminPostList = document.getElementById('admin-post-list');
const loginStatus = document.getElementById('admin-login-status');
const postStatus = document.getElementById('admin-post-status');
const passwordInput = document.getElementById('admin-password');
const loginButton = document.getElementById('admin-login');
const logoutButton = document.getElementById('logout-admin');
const publishButton = document.getElementById('publish-post');
const cancelEditButton = document.getElementById('cancel-edit');
const withdrawalRequestsNote = document.getElementById('withdrawal-requests-note');
const adminTabsCard = document.getElementById('admin-tabs-card');
const withdrawalTabPanel = document.getElementById('withdrawal-tab');
const blogTabPanel = document.getElementById('blog-tab');
const tabButtons = document.querySelectorAll('.tab-btn');

let adminPassword = null;
let adminAuthenticated = false;
let quill;
let editingPostId = null;
let editingPostSlug = null;
let existingSlugs = new Set();

function showStatus(element, message, success = true) {
  element.textContent = message;
  element.style.color = success ? '#0070f3' : '#c02323';
}

function initializeQuill() {
  try {
    quill = new Quill('#post-content-editor', {
      theme: 'snow',
      modules: {
        toolbar: [
          ['bold', 'italic', 'underline', 'link'],
          [{ color: [] }],
          [{ list: 'bullet' }],
          ['clean']
        ]
      }
    });
  } catch (error) {
    console.warn('Quill editor failed to initialize:', error);
    quill = null;
  }
}

async function loadWithdrawalRequests() {
  const container = document.getElementById('withdrawal-requests-card');
  const tableBody = document.querySelector('#withdrawal-requests-table tbody');

  if (!container || !tableBody) return;

  try {
    const res = await fetch('/api/admin/withdrawal-requests', {
      credentials: 'same-origin'
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      withdrawalRequestsNote.textContent = res.status === 401 || res.status === 403
        ? 'Unlock the dashboard to view withdrawal requests.'
        : (data && data.message) ? `Unable to load withdrawal requests: ${data.message}` : 'Unable to load withdrawal requests.';
      tableBody.innerHTML = '<tr><td colspan="6">No data to display.</td></tr>';
      return;
    }

    if (!data.requests || data.requests.length === 0) {
      withdrawalRequestsNote.textContent = 'No withdrawal requests available yet.';
      tableBody.innerHTML = '<tr><td colspan="6">No withdrawal requests available.</td></tr>';
      return;
    }

    container.classList.remove('hidden');
    withdrawalRequestsNote.textContent = `Loaded ${data.requests.length} withdrawal request(s).`;
    tableBody.innerHTML = data.requests.map(request => `
      <tr>
        <td>${request.affiliate?.full_name || 'Unknown'}<br><small>${request.affiliate?.email || ''}</small></td>
        <td>₦${Number(request.amount_ngn).toLocaleString()}</td>
        <td>${request.bank_name}<br>${request.account_name}<br>${request.account_number}</td>
        <td>${request.status}</td>
        <td>${new Date(request.requested_at).toLocaleString()}</td>
        <td>
          ${request.status === 'pending' ? `<button class="btn-secondary btn-sm" data-action="mark-paid" data-id="${request.id}">Mark as Paid</button>` : '—'}
        </td>
      </tr>
    `).join('');

    tableBody.querySelectorAll('button[data-action="mark-paid"]').forEach(button => {
      button.addEventListener('click', async (event) => {
        const requestId = event.target.dataset.id;
        if (!requestId || !confirm('Mark this withdrawal request as paid?')) return;

        try {
          const markRes = await fetch(`/api/admin/withdrawal-requests/${encodeURIComponent(requestId)}/pay`, {
            method: 'POST',
            credentials: 'same-origin'
          });
          const result = await markRes.json();
          if (!markRes.ok || !result.success) {
            alert(result.message || 'Unable to mark as paid.');
            return;
          }
          await loadWithdrawalRequests();
        } catch (err) {
          console.error('Mark paid error:', err);
          alert('Could not complete payment action.');
        }
      });
    });
  } catch (error) {
    console.error('Admin withdrawal load failed:', error);
    withdrawalRequestsNote.textContent = 'Could not load withdrawal requests. Unlock the dashboard to refresh.';
    tableBody.innerHTML = '<tr><td colspan="6">No data to display.</td></tr>';
  }
}

async function loadAdminPosts() {
  try {
    const res = await fetch('/api/posts');
    if (!res.ok) throw new Error('Unable to load posts');
    const posts = await res.json();
    existingSlugs = new Set(posts.map(post => post.slug));
    adminPostList.innerHTML = posts.map(post => `
      <div class="admin-post-item">
        <h3>${post.title}</h3>
        <p>${post.summary}</p>
        <div class="admin-post-actions">
          <button class="btn-secondary" data-action="edit" data-id="${post.id}" data-slug="${post.slug}">Edit</button>
          <button class="btn-secondary" data-action="delete" data-id="${post.id}" data-slug="${post.slug}">Delete</button>
        </div>
      </div>
    `).join('');

    adminPostList.querySelectorAll('button').forEach(button => {
      button.addEventListener('click', async (event) => {
        const action = event.target.dataset.action;
        const postId = event.target.dataset.id;
        const postSlug = event.target.dataset.slug;
        if (action === 'edit') return startEditPost(postId, postSlug);
        if (action === 'delete') return deletePost(postId, postSlug);
      });
    });
  } catch (error) {
    console.error('Admin post load failed:', error);
    adminPostList.innerHTML = '<p>Unable to load admin posts.</p>';
  }
}

async function startEditPost(id, slug) {
  try {
    const res = await fetch(`/api/posts/${encodeURIComponent(slug)}`);
    if (!res.ok) throw new Error('Unable to load post');
    const post = await res.json();
    document.getElementById('post-title').value = post.title;
    document.getElementById('post-slug').value = post.slug;
    document.getElementById('post-summary').value = post.summary;
    quill.root.innerHTML = post.content;
    editingPostId = id;
    editingPostSlug = post.slug;
    cancelEditButton.classList.remove('hidden');
    publishButton.textContent = 'Update Post';
    showStatus(postStatus, 'Editing post: ' + post.title, true);
  } catch (error) {
    console.error('Edit post error:', error);
    showStatus(postStatus, 'Unable to load post for editing.', false);
  }
}

async function deletePost(id, slug) {
  const confirmed = confirm('Delete this post? This action cannot be undone.');
  if (!confirmed) return;

  try {
    const res = await fetch(`/api/admin/posts/${id}`, {
      method: 'DELETE',
      credentials: 'same-origin'
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Delete failed');
    showStatus(postStatus, 'Post deleted successfully.', true);
    await loadAdminPosts();
  } catch (error) {
    console.error('Delete post error:', error);
    showStatus(postStatus, error.message || 'Unable to delete post.', false);
  }
}

function resetEditorState() {
  document.getElementById('post-title').value = '';
  document.getElementById('post-slug').value = '';
  document.getElementById('post-summary').value = '';
  if (quill) quill.root.innerHTML = '';
  editingPostId = null;
  editingPostSlug = null;
  cancelEditButton.classList.add('hidden');
  publishButton.textContent = 'Publish Post';
}

document.addEventListener('DOMContentLoaded', async () => {
  initializeQuill();

  // Try to auto-unlock dashboard if admin session cookie exists
  async function tryAutoUnlock() {
    try {
      const res = await fetch('/api/admin/withdrawal-requests', { credentials: 'same-origin' });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        // If endpoint returns success, consider admin authenticated
        if (data && data.success) {
          adminAuthenticated = true;
          adminTabsCard.classList.remove('hidden');
          postCard.classList.remove('hidden');
          postsListCard.classList.remove('hidden');
          loginCard.classList.add('hidden');
          showStatus(loginStatus, 'Dashboard unlocked (session detected).', true);
          await loadAdminPosts();
          // Ensure withdrawal tab stays inactive until selected, but preload data
          await loadWithdrawalRequests();
        }
      }
    } catch (err) {
      // ignore — user will need to login manually
      console.debug('Auto-unlock check failed:', err);
    }
  }

  tryAutoUnlock();

  tabButtons.forEach(button => {
    button.addEventListener('click', async () => {
      tabButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      const target = button.dataset.tab;
      document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
      document.getElementById(target).classList.add('active');

      if (target === 'withdrawal-tab') {
        if (!adminAuthenticated) {
          withdrawalRequestsNote.textContent = 'Unlock the dashboard to view withdrawal requests.';
          return;
        }
        await loadWithdrawalRequests();
      }
    });
  });

  loginButton.addEventListener('click', async () => {
    const password = passwordInput.value.trim();
    if (!password) {
      showStatus(loginStatus, 'Please enter the admin password.', false);
      return;
    }

    loginButton.disabled = true;
    loginButton.textContent = 'Unlocking...';
    showStatus(loginStatus, 'Attempting login...', true);

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPassword: password })
      });

      let data = null;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('Login response parse error:', parseError);
      }

      if (!response.ok) {
        const message = (data && data.message) || 'Server login failed. Make sure the server is running.';
        showStatus(loginStatus, message, false);
        return;
      }

      if (!data || !data.success) {
        showStatus(loginStatus, (data && data.message) || 'Invalid admin password.', false);
        return;
      }

      adminAuthenticated = true;
      adminPassword = null;
      passwordInput.value = '';
      loginCard.classList.add('hidden');
      adminTabsCard.classList.remove('hidden');
      postCard.classList.remove('hidden');
      postsListCard.classList.remove('hidden');
      document.getElementById('blog-tab').classList.add('active');
      document.getElementById('withdrawal-tab').classList.remove('active');
      showStatus(loginStatus, 'Dashboard unlocked.', true);
      await loadAdminPosts();
    } catch (error) {
      console.error('Admin login failed:', error);
      showStatus(loginStatus, 'Unable to login. Try again later.', false);
    } finally {
      loginButton.disabled = false;
      loginButton.textContent = 'Unlock Dashboard';
    }
  });

  logoutButton.addEventListener('click', () => {
    adminPassword = null;
    adminAuthenticated = false;
    passwordInput.value = '';
    adminTabsCard.classList.add('hidden');
    postCard.classList.add('hidden');
    postsListCard.classList.add('hidden');
    withdrawalTabPanel.classList.add('hidden');
    loginCard.classList.remove('hidden');
    showStatus(loginStatus, 'Dashboard locked.', true);
    postStatus.textContent = '';
    withdrawalRequestsNote.textContent = 'Unlock the dashboard and open this tab to load withdrawal requests.';
    resetEditorState();
  });

  cancelEditButton.addEventListener('click', () => {
    resetEditorState();
  });

  publishButton.addEventListener('click', async () => {
    const title = document.getElementById('post-title').value.trim();
    const slug = document.getElementById('post-slug').value.trim();
    const summary = document.getElementById('post-summary').value.trim();
    const content = quill ? quill.root.innerHTML.trim() : '';

    if (!adminAuthenticated) {
      showStatus(postStatus, 'Please unlock the dashboard first.', false);
      return;
    }
    if (!title || !slug || !summary || !content) {
      showStatus(postStatus, 'All fields are required.', false);
      return;
    }

    if (!editingPostId && existingSlugs.has(slug)) {
      showStatus(postStatus, 'Slug already exists. Please choose a unique slug.', false);
      return;
    }

    if (editingPostId && slug !== editingPostSlug && existingSlugs.has(slug)) {
      showStatus(postStatus, 'Slug already exists. Please choose a unique slug.', false);
      return;
    }

    const url = editingPostId ? `/api/admin/posts/${editingPostId}` : '/api/admin/posts';
    const method = editingPostId ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, slug, summary, content })
    });

    const data = await response.json();
    const newsletterStatus = document.getElementById('newsletter-status');
    newsletterStatus.textContent = '';

    if (data.success) {
      let statusMessage = editingPostId ? 'Post updated successfully.' : 'Post published successfully.';
      let newsletterMessage = '';
      let newsletterSuccess = true;

      if (data.newsletter) {
        if (data.newsletter.errors && data.newsletter.errors.length) {
          newsletterMessage = `Newsletter send failed for ${data.newsletter.errors.length} batch(es).`;
          newsletterSuccess = false;
        } else if (data.newsletter.subscribers > 0 && data.newsletter.sent) {
          newsletterMessage = `Newsletter sent to ${data.newsletter.subscribers} subscriber(s).`;
        } else if (data.newsletter.subscribers > 0 && !data.newsletter.sent) {
          newsletterMessage = 'Newsletter was not sent.';
          newsletterSuccess = false;
        }
      }

      showStatus(postStatus, statusMessage, true);
      if (newsletterMessage) {
        showStatus(newsletterStatus, newsletterMessage, newsletterSuccess);
      }
      resetEditorState();
      await loadAdminPosts();
    } else {
      let errorMessage = data.message || 'Publishing failed.';
      if (data.newsletter && data.newsletter.errors && data.newsletter.errors.length) {
        errorMessage += ` Newsletter send failed: ${data.newsletter.errors.join('; ')}`;
      }
      showStatus(postStatus, errorMessage, false);
    }
  });
});
