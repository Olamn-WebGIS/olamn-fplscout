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

let adminPassword = null;
let adminAuthenticated = false;
let quill;
let editingPostId = null;
let editingPostSlug = null;

function showStatus(element, message, success = true) {
  element.textContent = message;
  element.style.color = success ? '#0070f3' : '#c02323';
}

function initializeQuill() {
  quill = new Quill('#post-content-editor', {
    theme: 'snow',
    modules: {
      toolbar: [
        ['bold', 'italic'],
        [{ list: 'bullet' }],
        ['clean']
      ]
    }
  });
}

async function loadAdminPosts() {
  try {
    const res = await fetch('/api/posts');
    if (!res.ok) throw new Error('Unable to load posts');
    const posts = await res.json();
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

document.addEventListener('DOMContentLoaded', () => {
  initializeQuill();

  loginButton.addEventListener('click', async () => {
    const password = passwordInput.value.trim();
    if (!password) {
      showStatus(loginStatus, 'Please enter the admin password.', false);
      return;
    }

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPassword: password })
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        showStatus(loginStatus, data.message || 'Invalid admin password.', false);
        return;
      }

      adminAuthenticated = true;
      adminPassword = null;
      passwordInput.value = '';
      loginCard.classList.add('hidden');
      postCard.classList.remove('hidden');
      postsListCard.classList.remove('hidden');
      showStatus(loginStatus, 'Dashboard unlocked.', true);
      await loadAdminPosts();
    } catch (error) {
      console.error(error);
      showStatus(loginStatus, 'Unable to login. Try again later.', false);
    }
  });

  logoutButton.addEventListener('click', () => {
    adminPassword = null;
    adminAuthenticated = false;
    passwordInput.value = '';
    postCard.classList.add('hidden');
    postsListCard.classList.add('hidden');
    loginCard.classList.remove('hidden');
    showStatus(loginStatus, 'Dashboard locked.', true);
    postStatus.textContent = '';
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

    const url = editingPostId ? `/api/admin/posts/${editingPostId}` : '/api/admin/posts';
    const method = editingPostId ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, slug, summary, content })
    });

    const data = await response.json();
    if (data.success) {
      showStatus(postStatus, editingPostId ? 'Post updated successfully.' : 'Post published successfully.', true);
      resetEditorState();
      await loadAdminPosts();
    } else {
      showStatus(postStatus, data.message || 'Publishing failed.', false);
    }
  });
});
