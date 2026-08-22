// Partner tracking snippet
// Usage example on partner pages:
// <script src="/partner-snippet.js"></script>
// <script>sendPartnerEvent('king','signup',{email:'a@b.com'}, 'PARTNER_KEY_HERE')</script>

async function sendPartnerEvent(partnerId, type, metadata = {}, key) {
  try {
    const body = { type, metadata };
    const headers = { 'Content-Type': 'application/json' };
    if (key) headers['x-partner-key'] = key;
    const res = await fetch(`/api/partner/${partnerId}/event`, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!res.ok) {
      const txt = await res.text();
      console.warn('Partner event failed', res.status, txt);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error('sendPartnerEvent error', err);
    return null;
  }
}

window.sendPartnerEvent = sendPartnerEvent;
