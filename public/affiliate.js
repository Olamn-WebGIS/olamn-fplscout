async function getAffiliateDashboard(user) {
  const params = new URLSearchParams();
  if (user?.id) params.set('userId', user.id);
  else if (user?.email) params.set('email', user.email);

  const response = await fetch(`/api/affiliate/dashboard?${params.toString()}`);
  if (!response.ok) throw new Error('Could not load affiliate dashboard.');
  return response.json();
}

function getCurrentUser() {
  const stored = localStorage.getItem('fpl_user_session');
  if (!stored) return null;
  try { return JSON.parse(stored); } catch (e) { return null; }
}

async function checkAffiliateRegion() {
  try {
    const response = await fetch('/api/affiliate/region');
    if (!response.ok) return { success: false };
    return await response.json();
  } catch (error) {
    console.error('Region lookup failed:', error);
    return { success: false };
  }
}

function showAffiliateRegionBlocked(country) {
  const blockedSection = document.getElementById('affiliate-region-block-section');
  const blockedMessage = document.getElementById('affiliate-region-block-message');
  const joinSection = document.getElementById('affiliate-join-section');
  const affiliateTabs = document.querySelector('.affiliate-tabs');

  if (blockedSection) blockedSection.hidden = false;
  if (blockedMessage) blockedMessage.textContent = country
      ? `This program is available only to users in Nigeria. Access is blocked in your region (${country}).`
      : 'This program is available only to users in Nigeria. Access is blocked in your region.';
  if (joinSection) joinSection.hidden = true;
  if (affiliateTabs) affiliateTabs.hidden = true;
}

function showAffiliateJoinSection(message) {
  const joinSection = document.getElementById('affiliate-join-section');
  const affiliateTabs = document.querySelector('.affiliate-tabs');
  const joinMessage = document.getElementById('affiliate-join-message');
  if (joinSection) joinSection.hidden = false;
  if (affiliateTabs) affiliateTabs.hidden = true;
  if (joinMessage) joinMessage.textContent = message;
}

function openSharedAuthModal(defaultTab = 'signup') {
  const authModal = document.getElementById('auth-modal');
  const tabSignIn = document.getElementById('tab-signin');
  const tabSignUp = document.getElementById('tab-signup');
  const signInForm = document.getElementById('signin-form');
  const signUpForm = document.getElementById('signup-form');
  const authTabsDiv = document.getElementById('auth-tabs');
  const forgotPasswordForm = document.getElementById('forgot-password-form');
  const resetOtpForm = document.getElementById('reset-otp-form');
  const newPasswordForm = document.getElementById('new-password-form');

  if (authTabsDiv) {
    authTabsDiv.classList.remove('form-hidden');
  }
  if (forgotPasswordForm) forgotPasswordForm.classList.add('form-hidden');
  if (resetOtpForm) resetOtpForm.classList.add('form-hidden');
  if (newPasswordForm) newPasswordForm.classList.add('form-hidden');

  if (tabSignIn && tabSignUp && signInForm && signUpForm) {
    if (defaultTab === 'signin') {
      tabSignIn.classList.add('active-tab');
      tabSignUp.classList.remove('active-tab');
      signInForm.classList.remove('form-hidden');
      signUpForm.classList.add('form-hidden');
    } else {
      tabSignUp.classList.add('active-tab');
      tabSignIn.classList.remove('active-tab');
      signUpForm.classList.remove('form-hidden');
      signInForm.classList.add('form-hidden');
    }
  }

  if (authModal) {
    authModal.classList.remove('modal-hidden');
  }
}

function updateAffiliateJoinButton() {
  const button = document.getElementById('affiliate-join-button');
  const currentUser = getCurrentUser();
  if (!button) return;
  
  if (!currentUser || !currentUser.id) {
    button.textContent = 'Join Affiliate Program';
    button.disabled = false;
    return;
  }
  
  if (currentUser.refCode) {
    button.textContent = 'Visit Affiliate Program Dashboard';
  } else {
    button.textContent = 'Join Affiliate Program';
  }
  button.disabled = false;
}

async function onAffiliateJoinClick() {
  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.email) {
    localStorage.setItem('affiliate_join_pending', 'true');
    openSharedAuthModal('signup');
    return;
  }

  if (currentUser.refCode) {
    loadAffiliateDashboard();
    return;
  }

  await joinAffiliateProgram();
}

async function joinAffiliateProgram() {
  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.email) {
    showAffiliateJoinStatus('Please log in first to join the affiliate program.', true);
    return;
  }

  const button = document.getElementById('affiliate-join-button');
  if (button) {
    button.disabled = true;
    button.textContent = 'Joining...';
  }

  try {
    const response = await fetch('/api/affiliate/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id, email: currentUser.email })
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      showAffiliateJoinStatus(data.message || 'Could not join the affiliate program.', true);
      return;
    }

    currentUser.refCode = data.refCode;
    localStorage.setItem('fpl_user_session', JSON.stringify(currentUser));
    showAffiliateJoinStatus('Affiliate program joined! Your referral link is ready.');
    updateAffiliateJoinButton();
    await loadAffiliateDashboard();
  } catch (error) {
    console.error('Join affiliate error', error);
    showAffiliateJoinStatus('Could not join the affiliate program. Please try again later.', true);
  } finally {
    const button = document.getElementById('affiliate-join-button');
    if (button) {
      button.disabled = false;
    }
  }
}

function showAffiliateJoinStatus(message, isError = false) {
  const status = document.getElementById('affiliate-join-status');
  if (!status) return;
  status.textContent = message;
  status.style.color = isError ? '#c02323' : '#0070f3';
}

function showAffiliatePageStatus(message, isError = false) {
  const status = document.getElementById('withdrawal-status');
  if (!status) return;
  status.textContent = message;
  status.classList.toggle('error', isError);
  status.classList.toggle('success', !isError);
}

function formatHistoryDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (error) {
    return value;
  }
}

function renderReferralHistory(entries) {
  const container = document.getElementById('referral-history');
  if (!container) return;

  if (!Array.isArray(entries) || entries.length === 0) {
    container.innerHTML = '<p class="affiliate-empty">No referral history found yet.</p>';
    return;
  }

  container.innerHTML = `
    <div class="affiliate-history-table-wrap">
      <table class="affiliate-history-table">
        <thead>
          <tr>
            <th>Amount</th>
            <th>Description</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          ${entries.map(entry => `
            <tr>
              <td>₦${Number(entry.amountNgN || 0).toLocaleString()}</td>
              <td>${entry.description || 'Referral reward'}</td>
              <td>${formatHistoryDate(entry.earnedAt)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
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
    showAffiliateCopyStatus('Referral link copied to clipboard!');
  } catch (error) {
    console.error('Copy failed', error);
    showAffiliateCopyStatus('Could not copy referral link. Please copy it manually.', true);
  }
}

function showAffiliateCopyStatus(message, isError = false) {
  const status = document.getElementById('affiliate-copy-status');
  if (!status) return;
  status.textContent = message;
  status.style.color = isError ? '#c02323' : '#0070f3';
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

let affiliateBalance = 0;

async function submitWithdrawalRequest(event) {
  event.preventDefault();
  switchAffiliateTab('tab-withdraw');

  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.email) {
    showAffiliatePageStatus('Please log in before requesting a withdrawal.', true);
    return;
  }

  const bankName = document.getElementById('bank-name').value.trim();
  const accountName = document.getElementById('account-name').value.trim();
  const accountNumber = document.getElementById('account-number').value.trim();
  let amount = Number(document.getElementById('withdrawal-amount').value || '0');

  if (!bankName || !accountName || !accountNumber) {
    showAffiliatePageStatus('All bank details are required.', true);
    return;
  }

  if (amount <= 0) {
    showAffiliatePageStatus('Enter a valid withdrawal amount.', true);
    return;
  }

  if (affiliateBalance < 10000) {
    showAffiliatePageStatus('Balance not up to minimum withdrawal of ₦10,000.', true);
    return;
  }

  if (amount < 10000) {
    showAffiliatePageStatus('Withdrawal amount must be at least ₦10,000.', true);
    return;
  }

  if (amount > affiliateBalance) {
    showAffiliatePageStatus('Withdrawal amount cannot exceed your current balance.', true);
    return;
  }

  const button = document.getElementById('withdrawal-submit');
  if (button) {
    button.disabled = true;
    button.textContent = 'Submitting...';
  }

  showAffiliatePageStatus('Withdrawal pending. Your request has been submitted and is awaiting review.');

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
      showAffiliatePageStatus(data.message || 'Withdrawal request failed.', true);
      return;
    }

    showAffiliatePageStatus('Withdrawal pending. Your request has been submitted and is awaiting review.');
    await loadAffiliateDashboard();
  } catch (error) {
    console.error('Withdrawal request failed', error);
    showAffiliatePageStatus('Could not reach the server. Please try again later.', true);
  } finally {
    if (button) {
      button.disabled = true;
      button.textContent = 'Pending...';
    }
  }
}

async function loadAffiliateEarningsHistory(userId) {
  try {
    const response = await fetch(`/api/affiliate/earnings?userId=${encodeURIComponent(userId)}`);
    if (!response.ok) {
      throw new Error('Could not load referral history.');
    }
    const data = await response.json();
    if (!data.success) {
      renderReferralHistory([]);
      return;
    }
    renderReferralHistory(data.earnings || []);
  } catch (error) {
    console.error('Referral history load failed', error);
    renderReferralHistory([]);
  }
}

async function loadAffiliateDashboard() {
  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.email) {
    showAffiliateJoinSection('Please log in or sign up to access the affiliate dashboard.');
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
    const response = await fetch(`/api/affiliate/dashboard?userId=${encodeURIComponent(currentUser.id)}`);
    if (!response.ok) {
      if (response.status === 404) {
        showAffiliateJoinSection('You are not yet an affiliate. Click Join to create your referral link.');
        return;
      }
      throw new Error(`Dashboard request failed with status ${response.status}`);
    }

    const data = await response.json();
    if (!data.success || data.isAffiliate === false) {
      showAffiliateJoinSection('You are not yet an affiliate. Click Join to create your referral link.');
      return;
    }

    currentUser.refCode = data.ref_code;
    localStorage.setItem('fpl_user_session', JSON.stringify(currentUser));
    updateAffiliateJoinButton();

    showAffiliateDashboardSection();
    switchAffiliateTab('tab-overview');
    affiliateBalance = Number(data.balance || 0);
    if (balanceElem) balanceElem.textContent = `₦${affiliateBalance.toLocaleString()}`;
    if (linkInput) linkInput.value = data.referralLink || `${window.location.origin}/?ref=${currentUser.refCode || ''}`;
    if (withdrawalAmount) withdrawalAmount.value = affiliateBalance >= 10000 ? affiliateBalance : '10000';
    if (submitButton) submitButton.disabled = false;
    const referralCount = document.getElementById('affiliate-referral-count');
    if (referralCount) referralCount.textContent = (data.referrals && data.referrals.length) || '0';
    
    await loadAffiliateEarningsHistory(currentUser.id);
  } catch (error) {
    console.error('Dashboard load failed', error);
    if (balanceElem) balanceElem.textContent = '₦0';
    const referralCount = document.getElementById('affiliate-referral-count');
    if (referralCount) referralCount.textContent = '0';
    showAffiliateDashboardSection();
  }
}

function showAffiliateDashboardSection() {
  const joinSection = document.getElementById('affiliate-join-section');
  const affiliateTabs = document.querySelector('.affiliate-tabs');
  if (joinSection) joinSection.hidden = true;
  if (affiliateTabs) affiliateTabs.hidden = false;
}

function switchAffiliateTab(tabId) {
  // Hide all tab panels
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.remove('active');
  });
  
  // Deactivate all tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Show the selected tab panel
  const selectedPanel = document.getElementById(tabId);
  if (selectedPanel) {
    selectedPanel.classList.add('active');
  }
  
  // Activate the corresponding button
  const selectedButton = document.querySelector(`[data-tab="${tabId}"]`);
  if (selectedButton) {
    selectedButton.classList.add('active');
  }
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

document.addEventListener('DOMContentLoaded', async () => {
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

  const joinButton = document.getElementById('affiliate-join-button');
  if (joinButton) joinButton.addEventListener('click', onAffiliateJoinClick);

    const loginRedirect = document.getElementById('affiliate-login-redirect');
  if (loginRedirect) {
    loginRedirect.addEventListener('click', () => {
      localStorage.setItem('affiliate_join_pending', 'true');
      openSharedAuthModal('signin');
    });
  }

  const signinLink = document.getElementById('affiliate-signin-link');
  if (signinLink) {
    signinLink.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.setItem('affiliate_join_pending', 'true');
      openSharedAuthModal('signin');
    });
  }

  activateAffiliateTabFromHash();

  const region = await checkAffiliateRegion();
  if (!region.success || !region.allowed) {
    showAffiliateRegionBlocked(region.country || null);
    return;
  }

  updateAffiliateJoinButton();
  loadAffiliateDashboard();
  
  // Set first tab as default
  switchAffiliateTab('tab-overview');

  window.addEventListener('affiliate-auth-success', async () => {
    const currentUser = getCurrentUser();
    if (currentUser && currentUser.id && !currentUser.refCode) {
      // User just signed up but hasn't joined yet - auto-join them
      await joinAffiliateProgram();
    } else {
      updateAffiliateJoinButton();
      await loadAffiliateDashboard();
    }
    
    // Scroll to dashboard after auth
    setTimeout(() => {
      const affiliateTabs = document.querySelector('.affiliate-tabs');
      if (affiliateTabs && !affiliateTabs.hidden) {
        affiliateTabs.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 300);
  });
});
