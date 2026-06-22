async function getAffiliateDashboard(email) {
  const response = await fetch(`/api/affiliate/dashboard?email=${encodeURIComponent(email)}`);
  if (!response.ok) throw new Error('Could not load affiliate dashboard.');
  return response.json();
}

function getCurrentUser() {
  const stored = localStorage.getItem('fpl_user_session');
  if (!stored) return null;
  try { return JSON.parse(stored); } catch (e) { return null; }
}

function showAffiliateStatus(message, isError = false) {
  const status = document.getElementById('withdrawal-status');
  if (!status) return;
  status.textContent = message;
  status.style.color = isError ? '#c02323' : '#0070f3';
}

function renderReferralHistory(referrals) {
  const container = document.getElementById('referral-history');
  if (!container) return;

  if (!Array.isArray(referrals) || referrals.length === 0) {
    container.innerHTML = '<p class="affiliate-empty">No referrals yet. Share your link to start earning.</p>';
    return;
  }

  container.innerHTML = `
    <div class="referral-grid header-grid">
      <div>Name</div>
      <div>Email</div>
      <div>Joined</div>
      <div>Status</div>
    </div>
    ${referrals.map(ref => `
      <div class="referral-grid">
        <div>${ref.referredName || 'Unknown'}</div>
        <div>${ref.referredEmail || 'Unknown'}</div>
        <div>${new Date(ref.joinedAt).toLocaleDateString()}</div>
        <div>${ref.commissionPaid ? 'Paid' : 'Pending'}</div>
      </div>
    `).join('')}
  `;
}

function renderLeaderboard(leaderboard) {
  const container = document.getElementById('affiliate-leaderboard');
  if (!container) return;

  if (!Array.isArray(leaderboard) || leaderboard.length === 0) {
    container.innerHTML = '<p class="affiliate-empty">No leaderboard data yet.</p>';
    return;
  }

  container.innerHTML = leaderboard.map((item, index) => `
    <div class="leaderboard-row">
      <span class="leaderboard-position">#${index + 1}</span>
      <span>${item.fullName || item.email}</span>
      <span>${item.referralCount} referrals</span>
    </div>
  `).join('');
}

async function copyReferralLink() {
  const linkInput = document.getElementById('affiliate-link');
  if (!linkInput) return;

  try {
    await navigator.clipboard.writeText(linkInput.value);
    showAffiliateStatus('Referral link copied to clipboard!');
  } catch (error) {
    console.error('Copy failed', error);
    showAffiliateStatus('Could not copy referral link. Please copy it manually.', true);
  }
}

function shareReferralLink() {
  const linkInput = document.getElementById('affiliate-link');
  if (!linkInput) return;
  const referralLink = linkInput.value;
  const shareText = `Join FPL Scout and level up your FPL season. Use my referral link to get started: ${referralLink}`;

  if (navigator.share) {
    navigator.share({ title: 'FPL Scout Affiliate', text: shareText, url: referralLink })
      .catch(err => console.error('Web Share failed:', err));
    return;
  }

  copyReferralLink();
}

function shareTweet() {
  const linkInput = document.getElementById('affiliate-link');
  if (!linkInput) return;
  const text = encodeURIComponent('Boost your FPL season with FPL Scout Premium and earn better results. Sign up here:');
  const url = encodeURIComponent(linkInput.value);
  window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
}

function shareWhatsApp() {
  const linkInput = document.getElementById('affiliate-link');
  if (!linkInput) return;
  const message = encodeURIComponent(`Boost your FPL rank with FPL Scout Premium. Sign up here: ${linkInput.value}`);
  window.open(`https://wa.me/?text=${message}`, '_blank');
}

async function submitWithdrawalRequest(event) {
  event.preventDefault();

  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.email) {
    showAffiliateStatus('Please log in before requesting a withdrawal.', true);
    return;
  }

  const bankName = document.getElementById('bank-name').value.trim();
  const accountName = document.getElementById('account-name').value.trim();
  const accountNumber = document.getElementById('account-number').value.trim();
  let amount = Number(document.getElementById('withdrawal-amount').value || '0');

  if (!bankName || !accountName || !accountNumber) {
    showAffiliateStatus('All bank details are required.', true);
    return;
  }

  if (amount <= 0) {
    showAffiliateStatus('Enter a valid withdrawal amount.', true);
    return;
  }

  const button = document.getElementById('withdrawal-submit');
  if (button) {
    button.disabled = true;
    button.textContent = 'Submitting...';
  }

  try {
    const response = await fetch('/api/affiliate/withdrawal-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: currentUser.email,
        amount: amount,
        bank_name: bankName,
        account_name: accountName,
        account_number: accountNumber
      })
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      showAffiliateStatus(data.message || 'Withdrawal request failed.', true);
      return;
    }

    showAffiliateStatus('Withdrawal request submitted successfully.');
    loadAffiliateDashboard();
  } catch (error) {
    console.error('Withdrawal request failed', error);
    showAffiliateStatus('Could not reach the server. Please try again later.', true);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = 'Request Withdrawal';
    }
  }
}

async function loadAffiliateDashboard() {
  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.email) {
    window.location.href = '/';
    return;
  }

  const balanceElem = document.getElementById('affiliate-balance');
  const linkInput = document.getElementById('affiliate-link');
  const withdrawalAmount = document.getElementById('withdrawal-amount');
  const submitButton = document.getElementById('withdrawal-submit');
  const status = document.getElementById('withdrawal-status');

  if (status) {
    status.textContent = '';
    status.style.color = ''; 
  }

  if (balanceElem) balanceElem.textContent = 'Loading...';
  if (linkInput) linkInput.value = `${window.location.origin}/?ref=${currentUser.refCode || ''}`;

  try {
    const data = await getAffiliateDashboard(currentUser.email);
    if (!data.success) {
      if (balanceElem) balanceElem.textContent = 'Unable to load data';
      console.error('Affiliate dashboard load failed:', data.message);
      return;
    }

    if (balanceElem) balanceElem.textContent = `₦${data.availableBalance.toLocaleString()}`;
    if (linkInput) linkInput.value = data.referralLink;
    if (withdrawalAmount) withdrawalAmount.value = data.availableBalance >= 10000 ? data.availableBalance : '10000';
    if (submitButton) submitButton.disabled = data.availableBalance < 10000;
    const referralCount = document.getElementById('affiliate-referral-count');
    if (referralCount) referralCount.textContent = data.referrals ? data.referrals.length : 0;

    renderReferralHistory(data.referrals);
    renderLeaderboard(data.leaderboard);
  } catch (error) {
    console.error('Dashboard load failed', error);
    if (balanceElem) balanceElem.textContent = 'Unable to load data';
  }
}

function switchAffiliateTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabId));
  document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.toggle('active', panel.id === tabId));
}

function activateAffiliateTabFromHash() {
  const hash = window.location.hash;
  if (hash === '#terms') {
    switchAffiliateTab('tab-terms');
    const termsSection = document.getElementById('terms');
    if (termsSection) {
      termsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const copyButton = document.getElementById('copy-referral-link');
  if (copyButton) copyButton.addEventListener('click', copyReferralLink);
  const shareButton = document.getElementById('share-referral-link');
  if (shareButton) shareButton.addEventListener('click', shareReferralLink);
  const twitterButton = document.getElementById('share-twitter');
  if (twitterButton) twitterButton.addEventListener('click', shareTweet);
  const whatsappButton = document.getElementById('share-whatsapp');
  if (whatsappButton) whatsappButton.addEventListener('click', shareWhatsApp);

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchAffiliateTab(btn.dataset.tab));
  });

  const withdrawalForm = document.getElementById('withdrawal-form');
  if (withdrawalForm) withdrawalForm.addEventListener('submit', submitWithdrawalRequest);

  const accountNavItem = document.getElementById('account-nav-item');
  if (accountNavItem && getCurrentUser()) {
    accountNavItem.classList.remove('account-hidden');
  }

  activateAffiliateTabFromHash();
  loadAffiliateDashboard();
});
