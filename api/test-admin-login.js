require('dotenv').config();
const fetch = require('node-fetch');
(async () => {
  try {
    const loginRes = await fetch('http://localhost:3000/api/admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ adminPassword: process.env.ADMIN_PASSWORD || 'admin123' })
    });
    console.log('login status', loginRes.status);
    const loginBody = await loginRes.text();
    console.log('login body', loginBody);
    const cookie = loginRes.headers.get('set-cookie');
    console.log('cookie', cookie);
    if (!cookie) {
      return;
    }

    const requestRes = await fetch('http://localhost:3000/api/admin/withdrawal-requests', {
      method: 'GET',
      headers: {
        cookie
      }
    });
    console.log('withdrawal status', requestRes.status);
    console.log('withdrawal body', await requestRes.text());
  } catch (err) {
    console.error(err);
  }
})();
