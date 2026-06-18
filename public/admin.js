const loginCard = document.getElementById('login-card');
const postCard = document.getElementById('post-card');
const loginStatus = document.getElementById('admin-login-status');
const postStatus = document.getElementById('admin-post-status');
const passwordInput = document.getElementById('admin-password');
const loginButton = document.getElementById('admin-login');
const logoutButton = document.getElementById('logout-admin');
const publishButton = document.getElementById('publish-post');

let adminPassword = null;
let adminAuthenticated = false;

function showStatus(element, message, success = true) {
  element.textContent = message;
  element.style.color = success ? '#0070f3' : '#c02323';
}

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
    showStatus(loginStatus, 'Dashboard unlocked.', true);
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
  loginCard.classList.remove('hidden');
  showStatus(loginStatus, 'Dashboard locked.', true);
  postStatus.textContent = '';
});

publishButton.addEventListener('click', async () => {
  const title = document.getElementById('post-title').value.trim();
  const slug = document.getElementById('post-slug').value.trim();
  const summary = document.getElementById('post-summary').value.trim();
  const content = document.getElementById('post-content').value.trim();

  if (!adminAuthenticated) {
    showStatus(postStatus, 'Please unlock the dashboard first.', false);
    return;
  }
  if (!title || !slug || !summary || !content) {
    showStatus(postStatus, 'All fields are required.', false);
    return;
  }

  const response = await fetch('/api/admin/posts', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, slug, summary, content })
  });

  const data = await response.json();
  if (data.success) {
    showStatus(postStatus, 'Post published successfully. Newsletter sent to subscribers.', true);
    document.getElementById('post-title').value = '';
    document.getElementById('post-slug').value = '';
    document.getElementById('post-summary').value = '';
    document.getElementById('post-content').value = '';
  } else {
    showStatus(postStatus, data.message || 'Publishing failed.', false);
  }
});
