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
const signupAttemptsNote = document.getElementById('signup-attempts-note');
const signupAttemptsBody = document.getElementById('signup-attempts-body');
const signupStatusFilter = document.getElementById('signup-status-filter');
const financialOverviewCard = document.getElementById('financial-overview-card');
const financialFilter = document.getElementById('financial-filter');
const customDateRange = document.getElementById('custom-date-range');
const financialStartDate = document.getElementById('financial-start-date');
const financialEndDate = document.getElementById('financial-end-date');
const financialApplyRange = document.getElementById('financial-apply-range');
const financialAddTransactionButton = document.getElementById('financial-add-transaction');
const financialDownloadHistoryButton = document.getElementById('financial-download-history');
const financialTransactionForm = document.getElementById('financial-transaction-form');
const financialTransactionFormElement = document.getElementById('financial-transaction-form-element');
const financialTransactionFormTitle = document.getElementById('financial-transaction-form-title');
const financialTxType = document.getElementById('financial-tx-type');
const financialTxAmount = document.getElementById('financial-tx-amount');
const financialTxUser = document.getElementById('financial-tx-user');
const financialTxStatus = document.getElementById('financial-tx-status');
const financialTxReference = document.getElementById('financial-tx-reference');
const financialTxNote = document.getElementById('financial-tx-note');
const financialCancelTransaction = document.getElementById('financial-cancel-transaction');
const transactionHistoryBody = document.getElementById('transaction-history-body');
const financialRevenue = document.getElementById('financial-revenue');
const financialPayouts = document.getElementById('financial-payouts');
const financialProfit = document.getElementById('financial-profit');
const careersApplicantsBody = document.getElementById('careers-applicants-body');
const careersApplicantsNote = document.getElementById('careers-applicants-note');
const careersApplicantsCard = document.getElementById('careers-applicants-card');
const adminTabsCard = document.getElementById('admin-tabs-card');
const withdrawalTabPanel = document.getElementById('withdrawal-tab');
const financialTabPanel = document.getElementById('financial-tab');
const affiliateTabPanel = document.getElementById('affiliate-tab');
const blogTabPanel = document.getElementById('blog-tab');
const careersTabPanel = document.getElementById('careers-tab');
const affiliateManagementBody = document.getElementById('affiliate-management-body');
const affiliateManagementNote = document.getElementById('affiliate-management-note');
const affiliateManagementCard = document.getElementById('affiliate-management-card');
const tabButtons = document.querySelectorAll('.tab-btn');
// Fixtures elements
const fixturesCard = document.getElementById('fixtures-card');
const fixturesList = document.getElementById('fixtures-list');
const fixturesStatus = document.getElementById('fixtures-status');
const fixtureHome = document.getElementById('fixture-home');
const fixtureAway = document.getElementById('fixture-away');
const fixtureTime = document.getElementById('fixture-time');
const fixtureLiveLink = document.getElementById('fixture-live-link');
const fixtureHomeLogo = document.getElementById('fixture-home-logo');
const fixtureAwayLogo = document.getElementById('fixture-away-logo');
const createFixtureBtn = document.getElementById('create-fixture');
const updateFixtureBtn = document.getElementById('update-fixture');
const cancelFixtureBtn = document.getElementById('cancel-fixture');
const replaceFixturesBtn = document.getElementById('replace-fixtures');
let editingFixtureId = null;
let editingTransactionId = null;

let adminPassword = null;
let adminAuthenticated = false;
let quill;
let signupAttemptsData = [];
let editingPostId = null;
let editingPostSlug = null;
let existingSlugs = new Set();

function showStatus(element, message, success = true) {
  if (!element) return;
  element.textContent = message;
  element.classList.remove('text-error', 'text-success');
  element.classList.add(success ? 'text-success' : 'text-error');
}

function normalizeUrl(url) {
  if (!url) return '';
  const trimmed = url.trim();
  if (/^(https?:\/\/|mailto:|tel:)/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
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

async function loadAffiliateManagement() {
  if (!affiliateManagementBody || !affiliateManagementNote) return;

  if (affiliateManagementCard) {
    affiliateManagementCard.classList.remove('hidden');
  }

  affiliateManagementNote.textContent = 'Loading affiliates...';
  affiliateManagementBody.innerHTML = '<tr><td colspan="6">Loading affiliates...</td></tr>';

  try {
    const res = await fetch('/api/admin/affiliates', {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.success) {
      const message = data?.message || `Unable to load affiliates. (HTTP ${res.status})`;
      affiliateManagementNote.textContent = message;
      affiliateManagementBody.innerHTML = `<tr><td colspan="6">${message}</td></tr>`;
      return;
    }

    const affiliates = Array.isArray(data.affiliates) ? data.affiliates : [];
    if (!affiliates.length) {
      affiliateManagementNote.textContent = 'No affiliates found.';
      affiliateManagementBody.innerHTML = '<tr><td colspan="6">No affiliates found.</td></tr>';
      return;
    }

    affiliateManagementNote.textContent = `Showing ${affiliates.length} affiliate(s).`;
    affiliateManagementBody.innerHTML = affiliates.map((affiliate) => {
      const user = affiliate.user || affiliate.profile || affiliate.owner || {};
      const fullName = user.full_name || user.name || affiliate.full_name || affiliate.name || '—';
      const email = user.email || affiliate.email || '—';
      const refCode = affiliate.ref_code || affiliate.refCode || '—';
      const balance = Number(affiliate.balance ?? affiliate.amount ?? 0);
      const createdAt = affiliate.created_at || affiliate.createdAt || '';
      return `
        <tr>
          <td>${fullName}</td>
          <td>${email}</td>
          <td>${refCode}</td>
          <td>
            <input type="number" min="0" step="0.01" value="${balance}" data-affiliate-id="${affiliate.id}" class="affiliate-balance-input" style="width:100%; padding:0.55rem 0.7rem; border-radius:8px; border:1px solid #d5dbe4;" />
          </td>
          <td>${formatDate(createdAt)}</td>
          <td>
            <button class="btn-secondary btn-sm" data-action="save-affiliate-balance" data-id="${affiliate.id}">Save</button>
          </td>
        </tr>
      `;
    }).join('');

    affiliateManagementBody.querySelectorAll('button[data-action="save-affiliate-balance"]').forEach((button) => {
      button.addEventListener('click', async (event) => {
        const affiliateId = event.currentTarget?.dataset?.id;
        const row = event.currentTarget.closest('tr');
        const input = row?.querySelector('.affiliate-balance-input');
        if (!affiliateId || !input) return;

        const amount = input.value;
        try {
          const res = await fetch(`/api/admin/affiliates/${encodeURIComponent(affiliateId)}/balance`, {
            method: 'PUT',
            credentials: 'same-origin',
            cache: 'no-store',
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
            body: JSON.stringify({ amount })
          });
          const result = await res.json().catch(() => null);
          if (!res.ok || !result?.success) {
            alert(result?.message || 'Unable to update affiliate balance.');
            return;
          }
          alert('Affiliate balance updated successfully.');
          await loadAffiliateManagement();
        } catch (error) {
          console.error('Affiliate balance update failed:', error);
          alert('Could not update affiliate balance.');
        }
      });
    });
  } catch (error) {
    console.error('Affiliate management load failed:', error);
    affiliateManagementNote.textContent = 'Could not load affiliates.';
    affiliateManagementBody.innerHTML = '<tr><td colspan="6">Could not load affiliates.</td></tr>';
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
      container.classList.remove('hidden');
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
          ${request.status === 'pending' ? `<button class="btn-secondary btn-sm" data-action="mark-paid" data-id="${request.id}">Approve Payout</button>` : '—'}
        </td>
      </tr>
    `).join('');

    tableBody.querySelectorAll('button[data-action="mark-paid"]').forEach(button => {
      button.addEventListener('click', async (event) => {
        const targetButton = event.currentTarget;
        const requestId = targetButton.dataset.id;
        if (!requestId || targetButton.disabled || !confirm('Mark this withdrawal request as paid?')) return;

        targetButton.disabled = true;
        targetButton.textContent = 'Approving...';

        try {
          const markRes = await fetch(`/api/admin/withdrawal-requests/${encodeURIComponent(requestId)}/pay`, {
            method: 'POST',
            credentials: 'same-origin'
          });
          const result = await markRes.json();
          if (!markRes.ok || !result.success) {
            targetButton.disabled = false;
            targetButton.textContent = 'Approve Payout';
            alert(result.message || 'Unable to mark as paid.');
            return;
          }
          await loadWithdrawalRequests();
        } catch (err) {
          console.error('Mark paid error:', err);
          targetButton.disabled = false;
          targetButton.textContent = 'Approve Payout';
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

function formatCurrency(value) {
  return `₦${Number(value || 0).toLocaleString()}`;
}

function updateFinancialSummaryValue(element, value, forcedClass = '') {
  if (!element) return;

  const numericValue = Number(value || 0);
  element.textContent = formatCurrency(value);
  element.classList.remove('financial-value-positive', 'financial-value-negative', 'financial-value-neutral');

  if (numericValue === 0) {
    element.classList.add('financial-value-neutral');
  } else if (forcedClass) {
    element.classList.add(forcedClass);
  } else if (numericValue > 0) {
    element.classList.add('financial-value-positive');
  } else if (numericValue < 0) {
    element.classList.add('financial-value-negative');
  } else {
    element.classList.add('financial-value-neutral');
  }
}

function formatDate(dateValue) {
  try {
    return new Date(dateValue).toLocaleString();
  } catch {
    return dateValue || '';
  }
}

function getFinancialFilterParams(options = { period: 'all', startDate: '', endDate: '' }) {
  const params = new URLSearchParams();
  params.set('period', options.period || 'all');
  if (options.period === 'custom' && options.startDate && options.endDate) {
    params.set('start_date', options.startDate);
    params.set('end_date', options.endDate);
  }
  return params;
}

async function fetchFinancialOverviewData(options = { period: 'all', startDate: '', endDate: '' }) {
  const params = getFinancialFilterParams(options);
  const res = await fetch(`/api/admin/profit?${params.toString()}`, {
    credentials: 'same-origin'
  });
  return res.json();
}

function buildTransactionHistoryReportHtml(data, options = { period: 'all', startDate: '', endDate: '' }) {
  const safeTransactions = Array.isArray(data?.transactions) ? data.transactions : [];
  const revenue = Number(data?.revenue || 0);
  const payouts = Number(data?.payouts || 0);
  const profit = Number(data?.profit || 0);
  const filterLabel = options.period === 'custom' && options.startDate && options.endDate
    ? `${options.startDate} to ${options.endDate}`
    : options.period === 'month'
      ? 'This Month'
      : options.period === 'season'
        ? 'This Season'
        : 'All Time';

  const rows = safeTransactions.map((tx) => {
    const isCredit = isRevenueTransaction(tx.type);
    const typeLabel = getTransactionTypeLabel(tx.type);
    const amountValue = Number(tx.amount || 0);
    const amountDisplay = `${isCredit ? '+' : '-'}${formatCurrency(amountValue)}`;
    const amountClass = isCredit ? 'positive' : 'negative';
    const userLabel = tx.user?.full_name || tx.user?.email || '';
    return `
      <tr>
        <td>${typeLabel}</td>
        <td class="${amountClass}">${amountDisplay}</td>
        <td>${userLabel || '—'}</td>
        <td>${tx.status || '—'}</td>
        <td>${formatDate(tx.created_at)}</td>
        <td>${(tx.note || '').replace(/</g, '&lt;').replace(/>/g, '&gt;') || '—'}</td>
      </tr>
    `;
  }).join('');

  return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>Transaction History Report</title>
      <style>
        body { font-family: Arial, sans-serif; color: #0f172a; margin: 0; padding: 24px; background: #f8fafc; }
        .report { background: #ffffff; padding: 28px; border-radius: 16px; box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08); }
        .header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-bottom: 16px; border-bottom: 2px solid #e2e8f0; margin-bottom: 18px; }
        .brand { display: flex; align-items: center; gap: 12px; }
        .brand img { width: 56px; height: 56px; border-radius: 12px; object-fit: contain; background: #f8fafc; padding: 6px; }
        .brand h1 { margin: 0 0 4px; font-size: 24px; color: #0f172a; }
        .brand p { margin: 0; color: #64748b; font-size: 13px; }
        .meta { text-align: right; font-size: 12px; color: #64748b; line-height: 1.5; }
        .subtle { color: #64748b; margin-bottom: 18px; }
        .summary-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 20px 0; }
        .summary-card { background: linear-gradient(135deg, #f8fafc, #eef2ff); border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; }
        .summary-card strong { display: block; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 4px; }
        .summary-card span { font-size: 18px; font-weight: 700; color: #0f172a; }
        .section-title { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #334155; margin: 16px 0 8px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
        th, td { padding: 10px 8px; border-bottom: 1px solid #e2e8f0; text-align: left; vertical-align: top; }
        th { background: #f8fafc; color: #334155; font-weight: 700; }
        .positive { color: #15803d; font-weight: 700; }
        .negative { color: #dc2626; font-weight: 700; }
        .muted { color: #64748b; }
        .footer { margin-top: 24px; padding-top: 14px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px; display: flex; justify-content: space-between; gap: 12px; }
        @media print { body { background: #ffffff; padding: 0; } .report { box-shadow: none; border-radius: 0; } }
      </style>
    </head>
    <body>
      <div class="report">
        <div class="header">
          <div class="brand">
            <img src="https://fplscout.name.ng/images/logo.png" alt="FPL Scout logo" />
            <div>
              <h1>FPL Scout</h1>
              <p>Transaction History Report</p>
            </div>
          </div>
          <div class="meta">
            <div>Prepared for: Admin</div>
            <div>Generated: ${formatDate(new Date().toISOString())}</div>
            <div>Filter: ${filterLabel}</div>
          </div>
        </div>
        <div class="subtle">This report summarizes financial activity for the selected period with a professional overview of revenue, payouts, and profit.</div>
        <div class="summary-grid">
          <div class="summary-card"><strong>Total Revenue</strong><span>${formatCurrency(revenue)}</span></div>
          <div class="summary-card"><strong>Total Payouts</strong><span>${formatCurrency(payouts)}</span></div>
          <div class="summary-card"><strong>Net Profit</strong><span>${formatCurrency(profit)}</span></div>
        </div>
        <div class="section-title">Transaction Details</div>
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Amount</th>
              <th>User</th>
              <th>Status</th>
              <th>Date</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="6" class="muted">No transactions found.</td></tr>'}</tbody>
        </table>
        <div class="footer">
          <span>FPL Scout • Financial Reporting</span>
          <span>Confidential Internal Report</span>
        </div>
      </div>
    </body>
    </html>`;
}

function isRevenueTransaction(type) {
  const normalizedType = String(type || '').trim().toLowerCase();
  return normalizedType === 'subscription' || normalizedType === 'other_income';
}

function getTransactionTypeLabel(type) {
  const normalizedType = String(type || '').trim().toLowerCase();
  switch (normalizedType) {
    case 'subscription':
      return 'Subscription';
    case 'other_income':
      return 'Other Income';
    case 'refund':
      return 'Refund';
    case 'affiliate_payout':
      return 'Affiliate Payout';
    case 'other_expense':
      return 'Other Expense';
    case 'manual':
      return 'Other Expense';
    default:
      return 'Transaction';
  }
}

function resetFinancialTransactionForm() {
  if (financialTransactionFormElement) financialTransactionFormElement.reset();
  editingTransactionId = null;
  if (financialTransactionFormTitle) financialTransactionFormTitle.textContent = 'Add Transaction';
  if (financialTransactionForm) financialTransactionForm.classList.add('hidden');
}

async function submitFinancialTransaction(event) {
  event.preventDefault();
  if (!adminAuthenticated) {
    alert('Unlock the dashboard first.');
    return;
  }

  const payload = {
    type: financialTxType?.value || 'manual',
    amount: financialTxAmount?.value,
    user_email: financialTxUser?.value?.trim() || '',
    status: financialTxStatus?.value || 'completed',
    payment_reference: financialTxReference?.value?.trim() || '',
    note: financialTxNote?.value?.trim() || ''
  };

  const method = editingTransactionId ? 'PUT' : 'POST';
  const url = editingTransactionId
    ? `/api/admin/transactions/${encodeURIComponent(editingTransactionId)}`
    : '/api/admin/transactions';

  try {
    const res = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      alert(data?.message || 'Unable to save transaction.');
      return;
    }

    resetFinancialTransactionForm();
    await loadFinancialOverview({ period: financialFilter?.value || 'all' });
  } catch (error) {
    console.error('Save transaction failed:', error);
    alert('Could not save transaction.');
  }
}

function renderSignupAttempts() {
  if (!signupAttemptsBody || !signupAttemptsNote) return;

  const selectedStatus = (signupStatusFilter?.value || 'all').toLowerCase();
  const filteredAttempts = signupAttemptsData.filter((attempt) => {
    const status = (attempt.status || 'registered').toLowerCase();
    return selectedStatus === 'all' || status === selectedStatus;
  });

  if (filteredAttempts.length === 0) {
    const emptyMessage = selectedStatus === 'all'
      ? 'No signup attempts recorded yet.'
      : `No ${selectedStatus} signups found.`;
    signupAttemptsNote.textContent = emptyMessage;
    signupAttemptsBody.innerHTML = '<tr><td colspan="4">No data to display.</td></tr>';
    return;
  }

  const label = selectedStatus === 'all'
    ? `Showing ${filteredAttempts.length} signup(s).`
    : `Showing ${filteredAttempts.length} ${selectedStatus} signup(s).`;
  signupAttemptsNote.textContent = label;
  signupAttemptsBody.innerHTML = filteredAttempts.map((attempt) => `
    <tr>
      <td>${attempt.name || attempt.full_name || '—'}</td>
      <td>${attempt.status || 'unknown'}</td>
      <td>${attempt.country || '—'}</td>
      <td>${attempt.ref_code || attempt.refCode || '—'}</td>
    </tr>
  `).join('');
}

async function loadCareersApplicants() {
  if (!careersApplicantsBody || !careersApplicantsNote) return;

  const card = careersApplicantsCard;
  if (card) card.classList.remove('hidden');

  try {
    const res = await fetch('/api/careers/applicants', { credentials: 'same-origin' });
    const data = await res.json();

    if (!res.ok || !data.success) {
      careersApplicantsNote.textContent = data?.message || 'Unable to load careers applicants.';
      careersApplicantsBody.innerHTML = '<tr><td colspan="5">No data to display.</td></tr>';
      return;
    }

    const applicants = Array.isArray(data.applicants) ? data.applicants : [];
    if (!applicants.length) {
      careersApplicantsNote.textContent = 'No careers applicants yet.';
      careersApplicantsBody.innerHTML = '<tr><td colspan="5">No careers applicants yet.</td></tr>';
      return;
    }

    careersApplicantsNote.textContent = `Showing ${applicants.length} applicant(s).`;
    careersApplicantsBody.innerHTML = applicants.map((applicant) => `
      <tr>
        <td>${applicant.name || '—'}</td>
        <td>${applicant.email || '—'}</td>
        <td>${applicant.phone || '—'}</td>
        <td>
          <select data-id="${applicant.id}" class="careers-status-select">
            <option value="Pending" ${applicant.status === 'Pending' ? 'selected' : ''}>Pending</option>
            <option value="Under Review" ${applicant.status === 'Under Review' ? 'selected' : ''}>Under Review</option>
            <option value="Declined" ${applicant.status === 'Declined' ? 'selected' : ''}>Declined</option>
            <option value="Approved" ${applicant.status === 'Approved' ? 'selected' : ''}>Approved</option>
            <option value="Successful" ${applicant.status === 'Successful' ? 'selected' : ''}>Successful</option>
          </select>
        </td>
        <td>${formatDate(applicant.submitted_at)}</td>
      </tr>
    `).join('');

    careersApplicantsBody.querySelectorAll('.careers-status-select').forEach((select) => {
      select.addEventListener('change', async (event) => {
        const applicantId = event.target.dataset.id;
        const status = event.target.value;
        try {
          const updateRes = await fetch(`/api/admin/careers-applicants/${encodeURIComponent(applicantId)}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ status }),
          });
          const result = await updateRes.json();
          if (!updateRes.ok || !result.success) {
            alert(result?.message || 'Unable to update status.');
            return;
          }
          await loadCareersApplicants();
        } catch (error) {
          console.error('Career status update failed:', error);
          alert('Unable to update status.');
        }
      });
    });
  } catch (error) {
    console.error('Careers applicants load failed:', error);
    careersApplicantsNote.textContent = 'Could not load careers applicants.';
    careersApplicantsBody.innerHTML = '<tr><td colspan="5">Could not load careers applicants.</td></tr>';
  }
}

async function loadSignupAttempts() {
  if (!signupAttemptsBody || !signupAttemptsNote) return;

  const card = document.getElementById('signup-attempts-card');
  if (card) card.classList.remove('hidden');

  try {
    const res = await fetch('/api/admin/signup-attempts', { credentials: 'same-origin' });
    const data = await res.json();

    if (!res.ok || !data.success) {
      signupAttemptsData = [];
      signupAttemptsNote.textContent = data?.message || 'Unable to load signup attempts.';
      signupAttemptsBody.innerHTML = '<tr><td colspan="4">No data to display.</td></tr>';
      return;
    }

    signupAttemptsData = Array.isArray(data.attempts) ? data.attempts : [];
    renderSignupAttempts();
  } catch (error) {
    console.error('Signup attempts load failed:', error);
    signupAttemptsData = [];
    signupAttemptsNote.textContent = 'Could not load signup attempts.';
    signupAttemptsBody.innerHTML = '<tr><td colspan="4">Could not load signup attempts.</td></tr>';
  }
}

async function loadFinancialOverview(options = { period: 'all', startDate: '', endDate: '' }) {
  if (!financialOverviewCard || !transactionHistoryBody || !financialRevenue || !financialPayouts || !financialProfit) return;

  try {
    const res = await fetch(`/api/admin/profit?${getFinancialFilterParams(options).toString()}`, {
      credentials: 'same-origin'
    });
    const data = await res.json();

    financialOverviewCard.classList.remove('hidden');

    if (!res.ok || !data.success) {
      updateFinancialSummaryValue(financialRevenue, 0);
      updateFinancialSummaryValue(financialPayouts, 0, 'financial-value-negative');
      updateFinancialSummaryValue(financialProfit, 0);
      transactionHistoryBody.innerHTML = `<tr><td colspan="6">${(data && data.message) || 'Unable to load financial overview.'}</td></tr>`;
      return;
    }

    updateFinancialSummaryValue(financialRevenue, data.revenue);
    updateFinancialSummaryValue(financialPayouts, data.payouts, 'financial-value-negative');
    updateFinancialSummaryValue(financialProfit, data.profit);

    if (!data.transactions || data.transactions.length === 0) {
      transactionHistoryBody.innerHTML = '<tr><td colspan="6">No transactions found.</td></tr>';
      return;
    }

    transactionHistoryBody.innerHTML = data.transactions.map(tx => {
      const isCredit = isRevenueTransaction(tx.type);
      const typeLabel = getTransactionTypeLabel(tx.type);
      const amountLabel = `${isCredit ? '+' : '-'}${formatCurrency(tx.amount)}`;
      const rowClass = isCredit ? 'transaction-credit' : 'transaction-debit';
      const amountClass = isCredit ? 'transaction-credit' : 'transaction-debit';
      const userLabel = tx.user?.full_name || tx.user?.email || '';

      return `
        <tr class="${rowClass}">
          <td>${typeLabel}</td>
          <td class="${amountClass}">${amountLabel}</td>
          <td>${userLabel}</td>
          <td>${tx.status || ''}</td>
          <td>${formatDate(tx.created_at)}</td>
          <td>${tx.note || ''}</td>
          <td>
            <button class="btn-secondary btn-sm" data-action="edit-tx" data-id="${tx.id}">Edit</button>
            <button class="btn-secondary btn-sm" data-action="delete-tx" data-id="${tx.id}">Delete</button>
          </td>
        </tr>
      `;
    }).join('');

    transactionHistoryBody.querySelectorAll('button[data-action="edit-tx"]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        const transactionId = event.currentTarget?.dataset?.id;
        if (transactionId) {
          startEditTransaction(transactionId);
        }
      });
    });
    transactionHistoryBody.querySelectorAll('button[data-action="delete-tx"]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        const transactionId = event.currentTarget?.dataset?.id;
        if (transactionId) {
          deleteTransaction(transactionId);
        }
      });
    });
  } catch (error) {
    console.error('Financial overview load failed:', error);
    updateFinancialSummaryValue(financialRevenue, 0);
    updateFinancialSummaryValue(financialPayouts, 0, 'financial-value-negative');
    updateFinancialSummaryValue(financialProfit, 0);
    transactionHistoryBody.innerHTML = '<tr><td colspan="6">Could not load financial overview.</td></tr>';
  }
}

async function downloadTransactionHistory() {
  if (!adminAuthenticated) {
    alert('Unlock the dashboard first.');
    return;
  }

  const options = {
    period: financialFilter?.value || 'all',
    startDate: financialStartDate?.value || '',
    endDate: financialEndDate?.value || ''
  };

  if (options.period === 'custom' && (!options.startDate || !options.endDate)) {
    alert('Choose both start and end dates for the custom range before exporting.');
    return;
  }

  try {
    const res = await fetch(`/api/admin/profit?${getFinancialFilterParams(options).toString()}`, {
      credentials: 'same-origin'
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      alert(data?.message || 'Unable to export transaction history.');
      return;
    }

    const reportWindow = window.open('', '_blank', 'width=1000,height=800');
    if (!reportWindow) {
      alert('Please allow pop-ups to download the transaction history PDF.');
      return;
    }

    reportWindow.document.write(buildTransactionHistoryReportHtml(data, options));
    reportWindow.document.close();
    reportWindow.focus();
    reportWindow.print();
  } catch (error) {
    console.error('Transaction history export failed:', error);
    alert('Could not export transaction history.');
  }
}

async function startEditTransaction(transactionId) {
  try {
    const res = await fetch(`/api/admin/transactions/${encodeURIComponent(transactionId)}`, { credentials: 'same-origin' });
    const data = await res.json();
    if (!res.ok || !data.success || !data.transaction) {
      alert(data?.message || 'Unable to load transaction.');
      return;
    }

    const tx = data.transaction;
    editingTransactionId = transactionId;
    if (financialTransactionFormTitle) financialTransactionFormTitle.textContent = 'Edit Transaction';
    if (financialTransactionForm) financialTransactionForm.classList.remove('hidden');
    if (financialTxType) {
      const supportedType = ['subscription', 'other_income', 'affiliate_payout', 'other_expense'].includes(tx.type)
        ? tx.type
        : 'other_expense';
      financialTxType.value = supportedType;
    }
    if (financialTxAmount) financialTxAmount.value = tx.amount || 0;
    if (financialTxUser) financialTxUser.value = tx.user?.email || tx.user_id || '';
    if (financialTxStatus) financialTxStatus.value = tx.status || 'completed';
    if (financialTxReference) financialTxReference.value = tx.payment_reference || '';
    if (financialTxNote) financialTxNote.value = tx.note || '';
    if (financialTxAmount) financialTxAmount.focus();
  } catch (error) {
    console.error('Failed to load transaction for edit:', error);
    alert('Could not load transaction.');
  }
}

async function deleteTransaction(transactionId) {
  if (!transactionId || !confirm('Delete this transaction from the financial overview?')) return;

  try {
    const res = await fetch(`/api/admin/transactions/${encodeURIComponent(transactionId)}`, {
      method: 'DELETE',
      credentials: 'same-origin'
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      alert(data?.message || 'Unable to delete transaction.');
      return;
    }
    await loadFinancialOverview({ period: financialFilter?.value || 'all' });
  } catch (error) {
    console.error('Delete transaction failed:', error);
    alert('Could not delete transaction.');
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

// ── Fixtures management ───────────────────────────────────
function validateUrl(url) {
  try {
    if (!url) return true; // optional
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch (e) { return false; }
}

async function loadFixtures() {
  if (fixturesCard) fixturesCard.classList.remove('hidden');
  fixturesStatus.textContent = 'Loading fixtures...';
  try {
    const res = await fetch('/api/fixtures');
    if (!res.ok) throw new Error('Failed to load fixtures');
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Failed to load fixtures');
    renderFixturesList(Array.isArray(data.fixtures) ? data.fixtures : []);
    fixturesStatus.textContent = `Loaded ${data.fixtures.length} fixture(s).`;
  } catch (err) {
    console.error('Load fixtures error:', err);
    fixturesStatus.textContent = 'Could not load fixtures.';
    fixturesList.innerHTML = '<p>No fixtures found.</p>';
  }
}

function dedupeFixtures(fixtures) {
  if (!Array.isArray(fixtures)) return [];
  const seen = new Set();
  return fixtures.filter((fixture) => {
    const id = fixture?.id ?? `${fixture?.home_team || ''}|${fixture?.away_team || ''}|${fixture?.match_time || ''}|${fixture?.live_link || ''}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function renderFixturesList(fixtures) {
  if (!fixturesList) return;
  const uniqueFixtures = dedupeFixtures(fixtures);
  if (!uniqueFixtures || uniqueFixtures.length === 0) {
    fixturesList.innerHTML = '<p>No fixtures added yet.</p>';
    return;
  }

  fixturesList.innerHTML = uniqueFixtures.map(f => `
    <div class="admin-post-item" data-id="${f.id}">
      <div style="display:flex;align-items:center;gap:0.75rem">
        <img class="admin-fixture-logo" src="${f.home_logo_url || f.logo_url || '/images/default-logo.png'}" alt="${f.home_team}" />
        <div style="flex:1">
          <h3 style="margin:0">${f.home_team} <small style="opacity:0.6">vs</small> ${f.away_team}</h3>
          <div style="font-size:0.9rem;color:#444">${new Date(f.match_time).toLocaleString()}</div>
        </div>
        <img class="admin-fixture-logo" src="${f.away_logo_url || '/images/default-logo.png'}" alt="${f.away_team}" />
      </div>
      <p>Live Link: <a href="${f.live_link || '#'}" target="_blank">${f.live_link || '—'}</a></p>
      <div class="admin-post-actions">
        <button class="btn-secondary" data-action="edit" data-id="${f.id}">Edit</button>
        <button class="btn-secondary" data-action="delete" data-id="${f.id}">Delete</button>
      </div>
    </div>
  `).join('');

  fixturesList.querySelectorAll('button[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.id;
      try {
        const res = await fetch(`/api/fixtures/${encodeURIComponent(id)}`);
        if (!res.ok) throw new Error('Could not load fixture');
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Could not load fixture');
        const f = data.fixture;
        fixtureHome.value = f.home_team || '';
        fixtureAway.value = f.away_team || '';
        document.getElementById('fixture-title').value = f.title || '';
        document.getElementById('fixture-description').value = f.description || '';
        fixtureHomeLogo.value = f.home_logo_url || '';
        fixtureAwayLogo.value = f.away_logo_url || '';
        // Convert UTC ISO string to local datetime-local value
        fixtureTime.value = f.match_time ? new Date(f.match_time).toISOString().slice(0,16) : '';
        fixtureLiveLink.value = f.live_link || '';
        editingFixtureId = f.id;
        createFixtureBtn.classList.add('hidden');
        updateFixtureBtn.classList.remove('hidden');
        cancelFixtureBtn.classList.remove('hidden');
        fixturesStatus.textContent = 'Editing fixture ' + f.id;
      } catch (err) {
        console.error('Edit fixture failed:', err);
        alert('Could not load fixture for editing.');
      }
    });
  });

  fixturesList.querySelectorAll('button[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.id;
      if (!confirm('Delete this fixture?')) return;
      try {
        const res = await fetch(`/api/fixtures/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'same-origin' });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Delete failed');
        await loadFixtures();
      } catch (err) {
        console.error('Delete fixture failed:', err);
        alert('Could not delete fixture.');
      }
    });
  });
}

function clearFixtureForm() {
  fixtureHome.value = '';
  fixtureAway.value = '';
  fixtureTime.value = '';
  fixtureLiveLink.value = '';
  fixtureHomeLogo.value = '';
  fixtureAwayLogo.value = '';
  document.getElementById('fixture-title').value = '';
  document.getElementById('fixture-description').value = '';
  editingFixtureId = null;
  createFixtureBtn.classList.remove('hidden');
  updateFixtureBtn.classList.add('hidden');
  cancelFixtureBtn.classList.add('hidden');
}

async function submitReplaceFixtures() {
  if (!adminAuthenticated) { alert('Unlock the dashboard first.'); return; }
  if (!replaceFixturesBtn) return;

  const promptText = prompt('Paste a JSON array of fixtures to replace the existing list. Example: [{"home_team":"Arsenal","away_team":"Chelsea","match_time":"2026-06-30T20:00:00.000Z","live_link":"https://example.com","home_logo_url":"arsenal.png","away_logo_url":"chelsea.png","title":"Friendly","description":"Test match"}]');
  if (!promptText) return;

  let parsedFixtures;
  try {
    parsedFixtures = JSON.parse(promptText);
  } catch (err) {
    alert('Invalid JSON. Please paste a valid array of fixtures.');
    return;
  }

  if (!Array.isArray(parsedFixtures)) {
    alert('The value must be a JSON array of fixtures.');
    return;
  }

  const confirmed = confirm('This will delete all existing fixtures and replace them with the fixtures you pasted. Continue?');
  if (!confirmed) return;

  replaceFixturesBtn.disabled = true;
  const originalText = replaceFixturesBtn.textContent;
  replaceFixturesBtn.textContent = 'Replacing...';

  try {
    const res = await fetch('/api/fixtures/replace-all', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fixtures: parsedFixtures })
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Replace failed');
    await loadFixtures();
    fixturesStatus.textContent = `Replaced fixtures with ${data.fixtures?.length || 0} item(s).`;
  } catch (err) {
    console.error('Replace fixtures failed:', err);
    alert('Could not replace fixtures.');
  } finally {
    replaceFixturesBtn.disabled = false;
    replaceFixturesBtn.textContent = originalText;
  }
}

async function submitCreateFixture() {
  if (!adminAuthenticated) { alert('Unlock the dashboard first.'); return; }
  if (!createFixtureBtn) return;

  const home = fixtureHome.value.trim();
  const away = fixtureAway.value.trim();
  const timeLocal = fixtureTime.value;
  const live = fixtureLiveLink.value.trim();
  const homeLogo = fixtureHomeLogo?.value?.trim() || '';
  const awayLogo = fixtureAwayLogo?.value?.trim() || '';
  const title = (document.getElementById('fixture-title') || {}).value?.trim() || '';
  const description = (document.getElementById('fixture-description') || {}).value?.trim() || '';

  if (!home || !away || !timeLocal) { alert('Home, away and time are required.'); return; }
  if (live && !validateUrl(live)) { alert('Live link must be a valid URL.'); return; }

  createFixtureBtn.disabled = true;
  const originalText = createFixtureBtn.textContent;
  createFixtureBtn.textContent = 'Creating...';

  const utcIso = new Date(timeLocal).toISOString();

  try {
    const bodyPayload = {
      home_team: home,
      away_team: away,
      match_time: utcIso,
      live_link: live || null,
      home_logo_url: homeLogo || null,
      away_logo_url: awayLogo || null
    };
    if (title) bodyPayload.title = title;
    if (description) bodyPayload.description = description;

    const res = await fetch('/api/fixtures', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload)
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Create failed');
    clearFixtureForm();
    await loadFixtures();
  } catch (err) {
    console.error('Create fixture failed:', err);
    alert('Could not create fixture. Make sure you are authenticated as admin.');
  } finally {
    createFixtureBtn.disabled = false;
    createFixtureBtn.textContent = originalText;
  }
}

async function submitUpdateFixture() {
  if (!adminAuthenticated || !editingFixtureId) { alert('No fixture selected.'); return; }
  const home = fixtureHome.value.trim();
  const away = fixtureAway.value.trim();
  const timeLocal = fixtureTime.value;
  const live = fixtureLiveLink.value.trim();
  const homeLogo = fixtureHomeLogo?.value?.trim() || '';
  const awayLogo = fixtureAwayLogo?.value?.trim() || '';

  if (!home || !away || !timeLocal) { alert('Home, away and time are required.'); return; }
  if (live && !validateUrl(live)) { alert('Live link must be a valid URL.'); return; }

  const utcIso = new Date(timeLocal).toISOString();

  try {
    const bodyPayload = {
      home_team: home,
      away_team: away,
      match_time: utcIso,
      live_link: live || null,
      home_logo_url: homeLogo || null,
      away_logo_url: awayLogo || null
    };

    const res = await fetch(`/api/fixtures/${encodeURIComponent(editingFixtureId)}`, {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload)
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Update failed');
    clearFixtureForm();
    await loadFixtures();
  } catch (err) {
    console.error('Update fixture failed:', err);
    alert('Could not update fixture.');
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
    document.getElementById('post-reel').value = post.reel_link || '';
    document.getElementById('post-image-alt').value = post.image_alt || '';
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
  document.getElementById('post-reel').value = '';
  document.getElementById('post-image-alt').value = '';
  if (quill) quill.root.innerHTML = '';
  editingPostId = null;
  editingPostSlug = null;
  cancelEditButton.classList.add('hidden');
  publishButton.textContent = 'Publish Post';
}

document.addEventListener('DOMContentLoaded', async () => {
  initializeQuill();
  if (replaceFixturesBtn) {
    replaceFixturesBtn.addEventListener('click', submitReplaceFixtures);
  }
  if (signupStatusFilter) {
    signupStatusFilter.addEventListener('change', renderSignupAttempts);
  }
  financialAddTransactionButton?.addEventListener('click', () => {
    resetFinancialTransactionForm();
    if (financialTransactionForm) financialTransactionForm.classList.remove('hidden');
    financialTxType?.focus();
  });
  financialCancelTransaction?.addEventListener('click', () => {
    resetFinancialTransactionForm();
  });
  financialDownloadHistoryButton?.addEventListener('click', downloadTransactionHistory);
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
          await loadSignupAttempts();
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

      if (target === 'affiliate-tab') {
        if (!adminAuthenticated) {
          affiliateManagementNote.textContent = 'Checking admin session...';
          try {
            const res = await fetch('/api/admin/withdrawal-requests', {
              credentials: 'same-origin',
              cache: 'no-store',
              headers: { 'Cache-Control': 'no-cache' }
            });
            const data = await res.json().catch(() => null);
            if (res.ok && data?.success) {
              adminAuthenticated = true;
              affiliateManagementNote.textContent = 'Loading affiliates...';
            } else {
              affiliateManagementNote.textContent = 'Unlock the dashboard to view affiliate data.';
              return;
            }
          } catch (error) {
            console.error('Affiliate session check failed:', error);
            affiliateManagementNote.textContent = 'Unlock the dashboard to view affiliate data.';
            return;
          }
        }
        await loadAffiliateManagement();
      }
      if (target === 'withdrawal-tab') {
        if (!adminAuthenticated) {
          withdrawalRequestsNote.textContent = 'Unlock the dashboard to view withdrawal requests.';
          return;
        }
        await loadWithdrawalRequests();
      }
      if (target === 'financial-tab') {
        if (!adminAuthenticated) {
          transactionHistoryBody.innerHTML = '<tr><td colspan="6">Unlock the dashboard to view financial data.</td></tr>';
          updateFinancialSummaryValue(financialRevenue, 0);
          updateFinancialSummaryValue(financialPayouts, 0, 'financial-value-negative');
          updateFinancialSummaryValue(financialProfit, 0);
          return;
        }

        if (financialFilter.value === 'custom') {
          await loadFinancialOverview({
            period: 'custom',
            startDate: financialStartDate.value,
            endDate: financialEndDate.value
          });
        } else {
          await loadFinancialOverview({ period: financialFilter.value });
        }
      }
      if (target === 'signup-attempts-tab') {
        if (!adminAuthenticated) {
          signupAttemptsNote.textContent = 'Unlock the dashboard to view signup attempts.';
          signupAttemptsBody.innerHTML = '<tr><td colspan="6">Unlock the dashboard to view signup attempts.</td></tr>';
          return;
        }
        await loadSignupAttempts();
      }
      if (target === 'fixtures-tab') {
        if (!adminAuthenticated) {
          fixturesStatus.textContent = 'Unlock the dashboard to manage fixtures.';
          fixturesList.innerHTML = '<p>Unlock the dashboard to manage fixtures.</p>';
          return;
        }
        await loadFixtures();
      }
      if (target === 'careers-tab') {
        if (!adminAuthenticated) {
          careersApplicantsNote.textContent = 'Unlock the dashboard to review careers applicants.';
          careersApplicantsBody.innerHTML = '<tr><td colspan="5">Unlock the dashboard to review careers applicants.</td></tr>';
          return;
        }
        await loadCareersApplicants();
      }
    });

  if (financialFilter) {
    financialFilter.addEventListener('change', async () => {
      if (financialFilter.value === 'custom') {
        customDateRange?.classList.remove('hidden');
        return;
      }
      customDateRange?.classList.add('hidden');
      if (!adminAuthenticated) return;
      await loadFinancialOverview({ period: financialFilter.value });
    });
  }

  financialApplyRange?.addEventListener('click', async (event) => {
    event.preventDefault();

    if (!financialStartDate.value || !financialEndDate.value) {
      alert('Please select both a start and end date.');
      return;
    }

    if (new Date(financialStartDate.value) > new Date(financialEndDate.value)) {
      alert('Start date must be before or equal to end date.');
      return;
    }

    if (!adminAuthenticated) return;
    await loadFinancialOverview({
      period: 'custom',
      startDate: financialStartDate.value,
      endDate: financialEndDate.value
    });
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
      document.getElementById('financial-tab').classList.remove('active');
      document.getElementById('careers-tab').classList.remove('active');
      showStatus(loginStatus, 'Dashboard unlocked.', true);
      await loadAdminPosts();
      await loadSignupAttempts();
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
    financialTabPanel.classList.add('hidden');
    careersTabPanel.classList.add('hidden');
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
    const reelLink = document.getElementById('post-reel') ? document.getElementById('post-reel').value.trim() : '';
    const imageAlt = document.getElementById('post-image-alt') ? document.getElementById('post-image-alt').value.trim() : '';
    const imageInput = document.getElementById('post-image');
    let uploadedImageUrl = null;

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

    // If an image file was selected, compress and upload it to server which will forward to Supabase
    try {
      if (imageInput && imageInput.files && imageInput.files[0]) {
        const file = imageInput.files[0];
        // Use browser-image-compression if available to reduce upload size
        let compressedFile = file;
        try {
          if (window.imageCompression) {
            compressedFile = await imageCompression(file, { maxSizeMB: 0.6, maxWidthOrHeight: 1600, useWebWorker: true });
          }
        } catch (err) {
          console.warn('Image compression failed, uploading original file.', err);
          compressedFile = file;
        }

        // convert to base64
        const dataUrl = await imageCompression.getDataUrlFromFile(compressedFile);
        const base64 = dataUrl.split(',')[1];

        const uploadRes = await fetch('/api/admin/upload-image', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: compressedFile.name || file.name, contentType: compressedFile.type || file.type, base64 })
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok || !uploadData.success) {
          console.error('Image upload failed', uploadData);
          showStatus(postStatus, 'Image upload failed. Post not published.', false);
          return;
        }
        uploadedImageUrl = uploadData.url;
      }
    } catch (err) {
      console.error('Image processing/upload error:', err);
      showStatus(postStatus, 'Image upload failed. Post not published.', false);
      return;
    }

    const bodyPayload = { title, slug, summary, content };
    if (uploadedImageUrl) bodyPayload.image_url = uploadedImageUrl;
    const normalizedReelLink = normalizeUrl(reelLink);
    if (normalizedReelLink) bodyPayload.reel_link = normalizedReelLink;
    if (imageAlt) bodyPayload.image_alt = imageAlt;

    const response = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload)
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
  // Fixtures buttons
  createFixtureBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
    await submitCreateFixture();
  });

  updateFixtureBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
    await submitUpdateFixture();
  });

  cancelFixtureBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    clearFixtureForm();
  });
});
