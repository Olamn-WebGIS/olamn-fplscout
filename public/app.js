// ── App State ────────────────────────────────────────────────
const appState = {};

// Tracking active user session memory across browser page reloads
let currentUser = JSON.parse(localStorage.getItem('fpl_user_session') || 'null');
let intendedPremiumPage = null; // Track which premium page user is trying to access

function isPremiumUser(user) {
    if (!user) return false;
    if (user.isPremium === true || user.is_premium === true) return true;
    const status = user.subscription_status ? String(user.subscription_status).toLowerCase().trim() : '';
    if (['premium member', 'premium', 'premium subscription'].includes(status)) return true;

    if (user.premium_expiry) {
        const expiryDate = new Date(user.premium_expiry);
        if (!Number.isNaN(expiryDate.getTime()) && expiryDate > new Date()) {
            return true;
        }
    }

    return false;
}

function applyPremiumUI() {
    const premium = isPremiumUser(currentUser);

    const homeAdSection = document.getElementById('home-ad-section');
    if (homeAdSection) {
        homeAdSection.style.display = premium ? 'none' : '';
    }

    const premiumCtaSection = document.getElementById('premium-cta-section');
    if (premiumCtaSection) {
        premiumCtaSection.style.display = premium ? 'none' : '';
    }

    const syncBtn = document.getElementById('sync-btn');
    if (syncBtn) {
        syncBtn.type = 'button';
        syncBtn.textContent = 'Sync';
        syncBtn.setAttribute('aria-label', 'Sync your FPL manager');

        if (!premium) {
            syncBtn.dataset.adRedirect = 'https://sidewalkboiling.com/g7x7a1uur?key=f8ec59492459515d2b651cdb08903baa';
            syncBtn.title = 'Free users: tap to open partner offer';
        } else {
            delete syncBtn.dataset.adRedirect;
            syncBtn.removeAttribute('title');
        }
    }
}

function getReferralCookie() {
  const cookiePairs = document.cookie.split(';').map(c => c.trim());
  for (const pair of cookiePairs) {
    const [name, value] = pair.split('=');
    if (name === 'affiliate_ref') return decodeURIComponent(value || '');
  }

  try {
    const stored = localStorage.getItem('affiliate_ref');
    if (stored) return decodeURIComponent(stored);
  } catch (error) {
    console.warn('Unable to read stored referral code:', error);
  }

  return null;
}

function setReferralCookie(refCode) {
  if (!refCode) return;
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `affiliate_ref=${encodeURIComponent(refCode)}; expires=${expires}; path=/; SameSite=Lax`;

  try {
    localStorage.setItem('affiliate_ref', refCode);
  } catch (error) {
    console.warn('Unable to store referral code:', error);
  }
}

function captureReferralFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');
  if (ref) {
    setReferralCookie(ref);
  }
}

function createHomeBlogCard(post) {
  const article = document.createElement('article');
  article.className = 'home-blog-card';

  const link = document.createElement('a');
  link.className = 'home-blog-card-link';
  link.href = `/blog/${encodeURIComponent(post.slug)}`;

  if (post.image_url) {
    const img = document.createElement('img');
    img.src = post.image_url;
    img.alt = post.image_alt || post.title || 'Blog article image';
    img.loading = 'lazy';
    link.appendChild(img);
  }

  const content = document.createElement('div');
  content.className = 'home-blog-card-content';

  const time = document.createElement('time');
  time.textContent = new Date(post.published_at).toLocaleDateString();
  content.appendChild(time);

  const title = document.createElement('h3');
  title.textContent = post.title;
  content.appendChild(title);

  const summary = document.createElement('p');
  summary.textContent = post.summary || '';
  content.appendChild(summary);

  const readMore = document.createElement('span');
  readMore.className = 'read-more';
  readMore.textContent = 'Read article →';
  content.appendChild(readMore);

  link.appendChild(content);
  article.appendChild(link);
  return article;
}

async function loadHomeLatestBlogPosts() {
  const grid = document.getElementById('home-latest-blog-grid');
  if (!grid) return;

  try {
    const response = await fetch('/api/posts');
    if (!response.ok) throw new Error('Unable to load latest posts');
    const posts = await response.json();
    if (!Array.isArray(posts) || posts.length === 0) {
      grid.innerHTML = '<div class="home-latest-blog-empty">No blog posts are available yet.</div>';
      return;
    }

    grid.innerHTML = '';
    posts.slice(0, 3).forEach(post => grid.appendChild(createHomeBlogCard(post)));
  } catch (error) {
    console.error('Failed to load homepage blog teasers:', error);
    grid.innerHTML = '<div class="home-latest-blog-empty">Unable to load latest posts right now.</div>';
  }
}

function reconcileLocalSubscriptionExpiry() {
    if (!currentUser || !currentUser.premium_expiry) return;
    const expiryDate = new Date(currentUser.premium_expiry);
    if (expiryDate <= new Date()) {
        currentUser.isPremium = false;
        currentUser.subscription_status = 'Free Member';
        currentUser.premium_expiry = null;
        localStorage.setItem('fpl_user_session', JSON.stringify(currentUser));
        console.log('Local user subscription expired and downgraded');
    }
}

function registerServiceWorkerForNotifications() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => {
                console.log('Service Worker registered in app.js:', reg);
            })
            .catch(err => {
                console.warn('Service Worker registration failed in app.js:', err);
            });
    }
}

function updateAffiliateHomeLink() {
  const affiliateLink = document.querySelector('.affiliate-home-highlight a');
  if (!affiliateLink) return;
  
  if (currentUser && currentUser.id && currentUser.refCode) {
    affiliateLink.textContent = 'View Affiliate Program Dashboard';
    affiliateLink.href = '/affiliate';
  } else {
    affiliateLink.textContent = 'Join the Affiliate Program';
    affiliateLink.href = '/affiliate';
  }
}

// ── Currency Exchange & Pricing ──────────────────────────────
const PREMIUM_PRICE_NGN = 3000; // NGN price

async function updatePricingDisplay() {
  try {
    // Use hardcoded pricing - removed broken corsproxy.io dependency
    const displayPrice = '$3.00 USD';
    
    // Update on both homepage and subscribe page containers
    const priceConverted = document.getElementById('price-converted');
    const subscribePriceDisplay = document.getElementById('subscribe-price-display');
    
    if (priceConverted) {
        priceConverted.textContent = displayPrice;
    }
    
    if (subscribePriceDisplay) {
        const ngnPrice = typeof PREMIUM_PRICE_NGN !== 'undefined' ? PREMIUM_PRICE_NGN.toLocaleString() : '3,000';
        subscribePriceDisplay.innerHTML = `
            <div style="font-size: 1.1rem; color: #999; margin: 1rem 0;">
                <strong>Pricing in your region:</strong><br>
                <span style="font-size: 2rem; font-weight: bold; color: #0070f3;">₦${ngnPrice}</span> (NGN)<br>
                <span style="font-size: 0.95rem; color: #666;">≈ ${displayPrice}</span>
            </div>
        `;
    }

    console.log('✅ Pricing display updated');

  } catch (error) {
    console.error('Error updating pricing:', error);
  }
}

// Initialize pricing display safely
document.addEventListener('DOMContentLoaded', () => {
    updatePricingDisplay();
});


// ── Watchlist Management ─────────────────────────────────────
async function loadUserDataFromSupabase(email) {
    try {
        // Fetch user's stored account data from Supabase
        const response = await fetch('/api/user-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Restore synced team data from Supabase
            if (data.syncedTeam) {
                localStorage.setItem('fpl_synced_team', JSON.stringify(data.syncedTeam));
                console.log('📥 Synced team restored from Supabase:', data.syncedTeam);
            }
            
            // Restore other user preferences
            if (data.preferences) {
                localStorage.setItem('fpl_user_prefs', JSON.stringify(data.preferences));
            }
        }
    } catch (error) {
        console.error('Error loading user data from Supabase:', error);
        // Silently fail - use local data as fallback
    }
}

async function saveSyncedTeamToSupabase(email, syncedTeam) {
    try {
        await fetch('/api/save-user-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, syncedTeam })
        });
        console.log('📤 Synced team saved to Supabase');
    } catch (error) {
        console.error('Error saving synced team to Supabase:', error);
    }
}

// ── Data Fetching (Bridge to your API) ──────────────────────
async function fetchSpyData(leagueId) {
    const container = document.getElementById('spy-container');
    if (!container) return;
    container.innerHTML = 'Fetching live data...';
    
    try {
        const response = await fetch(`/api/spy/${leagueId}`);
        const data = await response.json();
        
        container.innerHTML = `
            <h3>${data.league.name}</h3>
            <table>
                ${data.managers.map(m => `
                    <tr>
                        <td>${m.player_name}</td>
                        <td>${m.total} pts</td>
                        <td></td>
                    </tr>
                `).join('')}
            </table>
        `;
    } catch (err) {
        container.innerHTML = 'Failed to load league data.';
        console.error(err);
    }
}

// ── Initialization Hook ──
document.addEventListener('DOMContentLoaded', () => {
    reconcileLocalSubscriptionExpiry();
    registerServiceWorkerForNotifications();
    captureReferralFromUrl();
    setupPremiumLocks();       
    setupModalInterface();    
    setupAccountNav();
    updateAffiliateHomeLink();
    applyPremiumUI();
    loadHomeLatestBlogPosts();
    
    // Explicit visibility verification loop tracker
    function verifyAccountLinkVisibility() {
        const accountNavItem = document.getElementById('account-nav-item');
        if (currentUser && accountNavItem) {
            accountNavItem.classList.remove('account-hidden');
            console.log("Session memory validated: Revealed Account link.");
        }
    }

    // Run multiple safety checks at different intervals to catch late injections
    verifyAccountLinkVisibility();
    setTimeout(verifyAccountLinkVisibility, 50);
    setTimeout(verifyAccountLinkVisibility, 200);
    setTimeout(verifyAccountLinkVisibility, 500); 
});


// ── Authentication Protection Framework (Dynamic Click Tracker) ──
function setupPremiumLocks() {
    document.body.addEventListener('click', (e) => {
        const lockButton = e.target.closest('.spy-lock');
        if (!lockButton) return;

        e.preventDefault();
        const targetHref = lockButton.getAttribute('href');
        console.log("Premium restriction click intercepted. Target href:", targetHref);

        if (!currentUser) {
            const authModal = document.getElementById('auth-modal');
            const tabSignUp = document.getElementById('tab-signup');
            const tabSignIn = document.getElementById('tab-signin');
            const signInForm = document.getElementById('signin-form');
            const signUpForm = document.getElementById('signup-form');
            const authTabsDiv = document.getElementById('auth-tabs');

            if (authTabsDiv) authTabsDiv.classList.remove('form-hidden');
            if (signInForm) signInForm.classList.add('form-hidden');
            if (signUpForm) signUpForm.classList.remove('form-hidden');
            if (tabSignUp) tabSignUp.classList.add('active-tab');
            if (tabSignIn) tabSignIn.classList.remove('active-tab');
            if (authModal) authModal.classList.remove('modal-hidden');
            console.log("Auth modal opened for signup");
            return;
        }

        if (currentUser && !isPremiumUser(currentUser)) {
            alert("Redirecting you to the subscription payment page...");
            window.location.href = "/subscribe.html"; 
            return;
        }

        if (currentUser && isPremiumUser(currentUser)) {
            if (targetHref && targetHref.startsWith('/')) {
                window.location.href = targetHref;
            } else {
                window.location.href = "/spy";
            }
        }
    });
}

// ── Modal Actions & Input Listeners Setup ──────────────────
function setupModalInterface() {
    const authModal = document.getElementById('auth-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const tabSignIn = document.getElementById('tab-signin');
    const tabSignUp = document.getElementById('tab-signup');
    const signInForm = document.getElementById('signin-form');
    const signUpForm = document.getElementById('signup-form');
    const authTabsDiv = document.getElementById('auth-tabs');

    if (closeModalBtn && authModal) {
        closeModalBtn.addEventListener('click', () => authModal.classList.add('modal-hidden'));
    }

    if (tabSignIn && tabSignUp && signInForm && signUpForm) {
        tabSignIn.addEventListener('click', () => {
            tabSignIn.classList.add('active-tab'); tabSignUp.classList.remove('active-tab');
            signInForm.classList.remove('form-hidden'); signUpForm.classList.add('form-hidden');
        });
        tabSignUp.addEventListener('click', () => {
            tabSignUp.classList.add('active-tab'); tabSignIn.classList.remove('active-tab');
            signUpForm.classList.remove('form-hidden'); signInForm.classList.add('form-hidden');
        });
    }

    // Handle signup form submission without sending a verification OTP
    if (signUpForm) {
        signUpForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const fullName = document.getElementById('signup-name').value;
            const email = document.getElementById('signup-email').value;
            const country = document.getElementById('signup-country').value;
            const password = document.getElementById('signup-password').value;
            const submitBtn = signUpForm.querySelector('.auth-btn');
            const authModal = document.getElementById('auth-modal');

            submitBtn.innerText = "Creating account...";
            submitBtn.disabled = true;

            try {
                const urlParams = new URLSearchParams(window.location.search);
                const referralCode = urlParams.get('ref_code') || urlParams.get('ref') || getReferralCookie() || null;
                const bodyPayload = {
                    fullName,
                    email,
                    country,
                    password,
                    ...(referralCode ? { ref_code: referralCode, ref: referralCode } : {})
                };
                const refInput = document.getElementById('signup-ref-code');
                if (refInput && refInput.value) {
                    bodyPayload.ref_code = refInput.value;
                    bodyPayload.ref = refInput.value;
                }

                const response = await fetch('/api/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(bodyPayload)
                });

                const data = await response.json();

                if (data.success) {
                    alert("Account created successfully!");
                    currentUser = data.user;
                    localStorage.setItem('fpl_user_session', JSON.stringify(data.user));
                    applyPremiumUI();
                    updateAffiliateHomeLink();

                    const pendingAffiliate = localStorage.getItem('affiliate_join_pending') === 'true';
                    if (pendingAffiliate) {
                        localStorage.removeItem('affiliate_join_pending');
                        if (authModal) authModal.classList.add('modal-hidden');
                        window.dispatchEvent(new Event('affiliate-auth-success'));
                        submitBtn.innerText = "Create Account";
                        submitBtn.disabled = false;
                        return;
                    }

                    if (authModal) authModal.classList.add('modal-hidden');
                    window.location.href = "/subscribe.html";
                } else {
                    alert("Signup failed: " + data.message);
                    submitBtn.innerText = "Create Account";
                    submitBtn.disabled = false;
                }
            } catch (error) {
                console.error("Signup Error:", error);
                alert("Could not connect to the server.");
                submitBtn.innerText = "Create Account";
                submitBtn.disabled = false;
            }
        });
    }

    // Handle Login Account Form Actions
    if (signInForm) {
        signInForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('signin-email').value;
            const password = document.getElementById('signin-password').value;

            const submitBtn = signInForm.querySelector('.auth-btn');
            submitBtn.innerText = "Logging in...";
            submitBtn.disabled = true;

            try {
                const response = await fetch('/api/signin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();

                                if (data.success) {
                    alert("Welcome back! Login successful.");
                    currentUser = data.user;
                    localStorage.setItem('fpl_user_session', JSON.stringify(data.user));
                    applyPremiumUI();

                    const accountNavItem = document.getElementById('account-nav-item');
                    if (accountNavItem) accountNavItem.classList.remove('account-hidden');

                    updateAffiliateHomeLink();

                    const pendingAffiliate = localStorage.getItem('affiliate_join_pending') === 'true';
                    if (pendingAffiliate) {
                        localStorage.removeItem('affiliate_join_pending');
                        if (authModal) authModal.classList.add('modal-hidden');
                        window.dispatchEvent(new Event('affiliate-auth-success'));
                        submitBtn.innerText = "Log In";
                        submitBtn.disabled = false;
                        return;
                    }

                    if (authModal) authModal.classList.add('modal-hidden');
                    // If user is premium and came from a premium page click, go to that page
                    if (currentUser && isPremiumUser(currentUser)) {
                        if (intendedPremiumPage && intendedPremiumPage.startsWith('/')) {
                            window.location.href = intendedPremiumPage;
                        } else {
                            window.location.href = "/spy";
                        }
                    } else {
                        // User is not premium, redirect to subscribe
                        alert("Redirecting you to the subscription payment page...");
                        window.location.href = "/subscribe.html";
                    }
                } else {
                    alert("Login Failed: " + data.message);
                    submitBtn.innerText = "Log In";
                    submitBtn.disabled = false;
                }
            } catch (error) {
                console.error("Login Connection Error:", error);
                alert("Could not connect to the server.");
                submitBtn.innerText = "Log In";
                submitBtn.disabled = false;
            }
        });
    }

    // ── Forgot Password Flow ──────────────────────────────────────────
    let tempForgotPasswordData = {};

    const forgotPasswordLink = document.getElementById('forgot-password-link');
    const backToSigninLink = document.getElementById('back-to-signin-link');
    const forgotPasswordForm = document.getElementById('forgot-password-form');
    const resetOtpForm = document.getElementById('reset-otp-form');
    const newPasswordForm = document.getElementById('new-password-form');

    // Show forgot password form
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (signInForm) signInForm.classList.add('form-hidden');
            if (tabSignIn && tabSignUp) {
                tabSignIn.classList.add('hidden');
                tabSignUp.classList.add('hidden');
            }
            if (authTabsDiv) authTabsDiv.classList.add('form-hidden');
            if (forgotPasswordForm) forgotPasswordForm.classList.remove('form-hidden');
        });
    }

    // Back to sign in
    if (backToSigninLink) {
        backToSigninLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (forgotPasswordForm) forgotPasswordForm.classList.add('form-hidden');
            if (resetOtpForm) resetOtpForm.classList.add('form-hidden');
            if (newPasswordForm) newPasswordForm.classList.add('form-hidden');
            if (authTabsDiv) authTabsDiv.classList.remove('form-hidden');
            if (signInForm) signInForm.classList.remove('form-hidden');
        });
    }

    // Handle forgot password email submission
    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('forgot-password-email').value;
            
            const submitBtn = forgotPasswordForm.querySelector('.auth-btn');
            submitBtn.innerText = "Sending code...";
            submitBtn.disabled = true;

            try {
                const normalizedEmail = email.trim().toLowerCase();
            const response = await fetch('/api/forgot-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: normalizedEmail })
                });

                const data = await response.json();

                if (data.success) {
                    tempForgotPasswordData = { email };
                    document.getElementById('reset-otp-target-email').innerText = email;
                    if (forgotPasswordForm) forgotPasswordForm.classList.add('form-hidden');
                    if (resetOtpForm) resetOtpForm.classList.remove('form-hidden');
                } else {
                    alert("Error: " + data.message);
                    submitBtn.innerText = "Send Reset Code";
                    submitBtn.disabled = false;
                }
            } catch (error) {
                console.error("Connection Error:", error);
                alert("Could not connect to the server.");
                submitBtn.innerText = "Send Reset Code";
                submitBtn.disabled = false;
            }
        });
    }

    // Handle reset OTP verification
    if (resetOtpForm) {
        resetOtpForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const otp = document.getElementById('reset-otp-input').value;

            try {
                const response = await fetch('/api/verify-reset-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: tempForgotPasswordData.email,
                        otp: otp
                    })
                });

                const data = await response.json();

                if (data.success) {
                    if (resetOtpForm) resetOtpForm.classList.add('form-hidden');
                    if (newPasswordForm) newPasswordForm.classList.remove('form-hidden');
                } else {
                    alert(data.message || "Invalid code. Please try again.");
                    console.warn('Reset OTP failure:', data);
                }
            } catch (error) {
                console.error("Verification Error:", error);
                alert("Something went wrong during verification.");
            }
        });
    }

    // Handle new password submission
    if (newPasswordForm) {
        newPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newPassword = document.getElementById('new-password-input').value;
            const confirmPassword = document.getElementById('confirm-password-input').value;

            if (newPassword !== confirmPassword) {
                alert("Passwords do not match. Please try again.");
                return;
            }

            const submitBtn = newPasswordForm.querySelector('.auth-btn');
            submitBtn.innerText = "Updating...";
            submitBtn.disabled = true;

            try {
                const response = await fetch('/api/update-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: tempForgotPasswordData.email,
                        password: newPassword
                    })
                });

                const data = await response.json();

                if (data.success) {
                    alert("Password updated successfully! Please log in with your new password.");
                    if (newPasswordForm) newPasswordForm.classList.add('form-hidden');
                    if (authTabsDiv) authTabsDiv.classList.remove('form-hidden');
                    if (signInForm) signInForm.classList.remove('form-hidden');
                    // Clear form fields
                    document.getElementById('signin-email').value = '';
                    document.getElementById('signin-password').value = '';
                } else {
                    alert("Error: " + data.message);
                    submitBtn.innerText = "Update Password";
                    submitBtn.disabled = false;
                }
            } catch (error) {
                console.error("Update Error:", error);
                alert("Something went wrong.");
                submitBtn.innerText = "Update Password";
                submitBtn.disabled = false;
            }
        });
    }
}

// ── Log-Out Session Lifecycle Manager ───────────────────────
function setupAccountNav() {
    const accountNavItem = document.getElementById('account-nav-item');

    // 💡 Check browser session state automatically regardless of injection timing
    if (currentUser && accountNavItem) {
        accountNavItem.classList.remove('account-hidden');
    }
}

// ── Password Show / Hide Visibility Controller ──────────────
function togglePasswordVisibility(inputFieldId, toggleElement) {
    const passwordInput = document.getElementById(inputFieldId);
    if (!passwordInput) return;

    if (passwordInput.type === "password") {
        passwordInput.type = "text";
        toggleElement.innerText = "🙈"; 
    } else {
        passwordInput.type = "password";
        toggleElement.innerText = "👁️"; 
    }
}
// 📱 SMART SMARTPHONE DETECTION FOR IPHONE WEB APP APP INSTALLS
function checkIosInstallationPrompt() {
    // 1. Detect if the device running is an iPhone or iPad matrix hardware setup
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    
    // 2. Detect if the user is already viewing the site as an installed app (Standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

    // 3. Detect if the user previously clicked 'close' so we don't spam them
    const isBannerDismissed = localStorage.getItem('fpl_ios_banner_dismissed') === 'true';

    // 🚀 Only show the banner if they are on iOS, haven't installed it yet, and haven't closed the tip box
    if (isIos && !isStandalone && !isBannerDismissed) {
        // Wait 3 seconds after page loads to slide it up gracefully
        setTimeout(() => {
            const banner = document.getElementById('ios-pwa-banner');
            if (banner) banner.classList.add('show');
        }, 3000);
    }
}

// Close helper handler
function closeIosBanner() {
    const banner = document.getElementById('ios-pwa-banner');
    if (banner) {
        // 🚀 FORCE IMMEDIATE HIDDEN STATE
        banner.classList.remove('show');
        banner.style.display = 'none'; 
    }
    // Lock preference so it stays hidden forever on this device tab session
    localStorage.setItem('fpl_ios_banner_dismissed', 'true');
}
// Wire the check directly into your existing DOMContentLoaded listener loop
document.addEventListener('DOMContentLoaded', checkIosInstallationPrompt);
