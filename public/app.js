// ── App State ────────────────────────────────────────────────
const appState = {
    watchlist: JSON.parse(localStorage.getItem('fpl_watchlist') || '[]')
};

// Tracking active user session memory across browser page reloads
let currentUser = JSON.parse(localStorage.getItem('fpl_user_session') || 'null');
let tempSignUpData = null;
let intendedPremiumPage = null; // Track which premium page user is trying to access

// ── Currency Exchange & Pricing ──────────────────────────────
const PREMIUM_PRICE_NGN = 3000; // NGN price

async function updatePricingDisplay() {
  try {
    // 🚀 FIXED: Clean, un-nested proxy link structure
    const response = await fetch('https://corsproxy.io', {
      mode: 'cors',
      headers: { 'Accept': 'application/json' }
    });

        // If the API endpoint fails, drop directly down into our safe hardcoded fallback logic
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        const rates = data.rates;
        
        // Extract USD conversion value cleanly
        let displayPrice = rates && rates.USD ? `$${rates.USD.toFixed(2)} USD` : '$3.00 USD';
        
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
        
        // Cache rates locally for instant retrieval references across pages
        window.exchangeRates = rates;
        console.log('Exchange rates updated cleanly from database:', rates);

    } catch (error) {
        console.warn('Handling currency fetch locally via robust backup fallback mechanism:', error);
        
        // Secure hardcoded backup templates to prevent the interface from showing blank text
        const priceConverted = document.getElementById('price-converted');
        if (priceConverted) {
            priceConverted.textContent = '$3.00 USD (approx)';
        }

        const subscribePriceDisplay = document.getElementById('subscribe-price-display');
        if (subscribePriceDisplay) {
            const ngnPrice = typeof PREMIUM_PRICE_NGN !== 'undefined' ? PREMIUM_PRICE_NGN.toLocaleString() : '3,000';
            subscribePriceDisplay.innerHTML = `
                <div style="font-size: 1.1rem; color: #999; margin: 1rem 0;">
                    <strong>Pricing in your region:</strong><br>
                    <span style="font-size: 2rem; font-weight: bold; color: #0070f3;">₦${ngnPrice}</span> (NGN)<br>
                    <span style="font-size: 0.95rem; color: #666;">≈ $3.00 USD (approx)</span>
                </div>
            `;
        }
    }
}

// Initialize pricing display safely
document.addEventListener('DOMContentLoaded', () => {
    updatePricingDisplay();
});


// ── Watchlist Management ─────────────────────────────────────
async function loadUserDataFromSupabase(email) {
    try {
        // Fetch user's watchlist and sync data from Supabase
        const response = await fetch('/api/user-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Restore watchlist from Supabase
            if (data.watchlist && Array.isArray(data.watchlist)) {
                appState.watchlist = data.watchlist;
                localStorage.setItem('fpl_watchlist', JSON.stringify(data.watchlist));
                console.log('📥 Watchlist restored from Supabase:', data.watchlist);
            }
            
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

async function saveWatchlistToSupabase(email, watchlist) {
    try {
        await fetch('/api/save-user-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, watchlist })
        });
        console.log('📤 Watchlist saved to Supabase');
    } catch (error) {
        console.error('Error saving watchlist to Supabase:', error);
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

function addToWatchlist(managerId, managerName) {
    if (!appState.watchlist.find(m => m.id == managerId)) {
        appState.watchlist.push({ id: managerId, name: managerName });
        localStorage.setItem('fpl_watchlist', JSON.stringify(appState.watchlist));
        
        // Sync to Supabase if user is logged in
        if (currentUser && currentUser.email) {
            saveWatchlistToSupabase(currentUser.email, appState.watchlist);
        }
        
        alert(`${managerName} added to Watch List!`);
        renderWatchlist();
    }
}

function renderWatchlist() {
    const container = document.getElementById('watchlist-container');
    if (!container) return;
    
    container.innerHTML = appState.watchlist.length === 0 
        ? '<p>No rivals added yet.</p>'
        : appState.watchlist.map(m => `<div>${m.name} <button onclick="removeRival(${m.id})">Remove</button></div>`).join('');
}

function removeRival(managerId) {
    appState.watchlist = appState.watchlist.filter(m => m.id !== managerId);
    localStorage.setItem('fpl_watchlist', JSON.stringify(appState.watchlist));
    
    // Sync to Supabase if user is logged in
    if (currentUser && currentUser.email) {
        saveWatchlistToSupabase(currentUser.email, appState.watchlist);
    }
    
    renderWatchlist();
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
                        <td><button onclick="addToWatchlist(${m.entry}, '${m.player_name}')">Spy</button></td>
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
    setupPremiumLocks();       
    setupModalInterface();    
    setupAccountNav();     
    
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
    // 💡 Watch clicks globally across the body so elements injected late are ALWAYS caught!
    document.body.addEventListener('click', (e) => {
        // Find if the clicked item (or its text wrapper link) has the spy-lock class name
        const lockButton = e.target.closest('.spy-lock');
        if (!lockButton) return;

        e.preventDefault(); // Stop standard links jumping pages instantly

        // Get the target href to determine where to redirect if premium
        const targetHref = lockButton.getAttribute('href');
        console.log("Premium restriction click intercepted. Target href:", targetHref);

        // Condition 1: User is not logged in -> Force registration modal open
        if (!currentUser) {
            const authModal = document.getElementById('auth-modal');
            const tabSignUp = document.getElementById('tab-signup');
            const tabSignIn = document.getElementById('tab-signin');
            const signInForm = document.getElementById('signin-form');
            const signUpForm = document.getElementById('signup-form');
            const otpForm = document.getElementById('otp-form');
            const authTabsDiv = document.getElementById('auth-tabs');
            
            // Reset modal to show signup tab
            if (authTabsDiv) authTabsDiv.classList.remove('form-hidden');
            if (signInForm) signInForm.classList.add('form-hidden');
            if (signUpForm) signUpForm.classList.remove('form-hidden');
            if (otpForm) otpForm.classList.add('form-hidden');
            if (tabSignUp) tabSignUp.classList.add('active-tab');
            if (tabSignIn) tabSignIn.classList.remove('active-tab');
            
            // Show modal
            if (authModal) authModal.classList.remove('modal-hidden');
            console.log("Auth modal opened for signup");
            return;
        }

        // Condition 2: Logged in, but has not completed premium package payment yet
        if (currentUser && currentUser.isPremium !== true) {
            alert("Redirecting you to the subscription payment page...");
            window.location.href = "/subscribe.html"; 
            return;
        }

        // Condition 3: Logged in AND Premium Verified -> Grant Entry Access
        if (currentUser && currentUser.isPremium === true) {
            // Redirect to the actual target page (recommendations or spy)
            if (targetHref && targetHref.startsWith('/')) {
                window.location.href = targetHref;
            } else {
                // Default to spy if no specific href
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
    const otpForm = document.getElementById('otp-form');
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

    // Handle Zoho Email OTP Signup Trigger
    if (signUpForm) {
        signUpForm.addEventListener('submit', async (e) => {
            e.preventDefault(); 

            const fullName = document.getElementById('signup-name').value;
            const email = document.getElementById('signup-email').value;
            const country = document.getElementById('signup-country').value;
            const password = document.getElementById('signup-password').value;

            tempSignUpData = { fullName, email, country, password };

            const submitBtn = signUpForm.querySelector('.auth-btn');
            submitBtn.innerText = "Sending code...";
            submitBtn.disabled = true;

            try {
                const response = await fetch('/api/send-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: email })
                });

                const data = await response.json();

                if (data.success) {
                    document.getElementById('otp-target-email').innerText = email;
                    if (signInForm) signInForm.classList.add('form-hidden');
                    if (signUpForm) signUpForm.classList.add('form-hidden');
                    if (authTabsDiv) authTabsDiv.classList.add('form-hidden');
                    if (otpForm) otpForm.classList.remove('form-hidden');
                } else {
                    alert("Error sending email: " + data.message);
                    submitBtn.innerText = "Send Verification OTP";
                    submitBtn.disabled = false;
                }
            } catch (error) {
                console.error("Connection Error:", error);
                alert("Could not connect to the server.");
                submitBtn.innerText = "Send Verification OTP";
                submitBtn.disabled = false;
            }
        });
    }

    // Handle OTP Code Match Verification
    if (otpForm) {
        otpForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const typedOtp = document.getElementById('otp-input').value;

            try {
                const response = await fetch('/api/verify-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: tempSignUpData.email,
                        otp: typedOtp,
                        fullName: tempSignUpData.fullName,
                        country: tempSignUpData.country,
                        password: tempSignUpData.password 
                    })
                });

                const data = await response.json();

                if (data.success) {
                    alert("Account verified and created successfully!");
                    currentUser = data.user;
                    localStorage.setItem('fpl_user_session', JSON.stringify(data.user));
                    
                    const accountNavItem = document.getElementById('account-nav-item');
                    if (accountNavItem) accountNavItem.classList.remove('account-hidden');
                    if (authModal) authModal.classList.add('modal-hidden');
                    
                    // New users are not premium by default, redirect to subscription
                    // If they came from a premium page click, they'll need to subscribe first
                    window.location.href = "/subscribe.html"; 
                } else {
                    alert("Invalid OTP code. Please check your email and try again.");
                }
            } catch (error) {
                console.error("Verification Error:", error);
                alert("Something went wrong during verification.");
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

                    const accountNavItem = document.getElementById('account-nav-item');
                    if (accountNavItem) accountNavItem.classList.remove('account-hidden');
                    if (authModal) authModal.classList.add('modal-hidden');

                    // Load user's watchlist and sync data from Supabase
                    await loadUserDataFromSupabase(currentUser.email);

                    // If user is premium and came from a premium page click, go to that page
                    if (currentUser && currentUser.isPremium === true) {
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
                const response = await fetch('/api/forgot-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
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
                    alert("Invalid code. Please try again.");
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
    if (banner) banner.classList.remove('show');
    // Save preference so banner stays closed for this specific user profile session
    localStorage.setItem('fpl_ios_banner_dismissed', 'true');
}

// Wire the check directly into your existing DOMContentLoaded listener loop
document.addEventListener('DOMContentLoaded', checkIosInstallationPrompt);
