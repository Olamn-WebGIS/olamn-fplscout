/* ── FPL Scout — Shared Navigation, Modal & Footer injector ─────────── */

(function () {
  // 1. Navigation Template Layout
  const NAV_HTML = `
<nav class="navbar">
  <div class="navbar-inner">
    <a href="/" class="logo" aria-label="FPL Scout home">
      <span class="fpl">FPL</span>
      <span class="scout">Sc<span class="logo-ball">⚽</span>ut</span>
    </a>
    
    <ul class="nav-links" role="list">
      <li><a href="/">Home</a></li>
      <li><a href="/recommendations" class="spy-lock">Recommendations</a></li>
      <li><a href="/spy" class="spy-lock">League Spy</a></li>
      <li><a href="/watchlist">Watchlist</a></li>
      <li id="account-nav-item" class="account-hidden"><a href="/account"> Account</a></li>
    </ul>

    <button class="hamburger" aria-label="Open menu" aria-expanded="false">
      <span></span><span></span><span></span>
    </button>
  </div>
</nav>

<span class="live-indicator header-live-badge" id="live-badge" title="Server Status: Online"></span>`;

  // 2. Complete Visual Footer Layout (Maintained Styles & Targets)
  const FOOTER_HTML = `
  <footer>
    <div class="footer-inner">
      <div class="footer-branding">
        <div class="footer-logo">
          <span class="logo" style="display:flex;flex-direction:column;line-height:1.1;font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:1.4rem;color:#fff;">
            <span style="color:#00c853;font-size:1rem;letter-spacing:1px;">FPL</span>
            <span style="color:#ffd600;">Sc⚽ut</span>
          </span>
        </div>
        <p style="font-size:0.875rem;max-width:260px;line-height:1.6;">Advanced data analytics for Fantasy Premier League managers.</p>
        <div class="footer-socials" style="margin-top:1rem;">
          <a href="https://x.com/OlamnFPL_scout" target="_blank" rel="noopener" aria-label="X (Twitter)">𝕏</a>
        </div>
      </div>
      <div class="footer-columns">
        <div class="footer-col">
          <div>
            <h4>Quick Links</h4>
            <ul>
              <li><a href="/">Home</a></li>
              <li><a href="/recommendations" class="spy-lock">Recommendations</a></li>
              <li><a href="/spy" class="spy-lock">League Spy</a></li>
              <li><a href="/watchlist">Watchlist</a></li>
            </ul>
          </div>
          <div>
            <h4>Resources</h4>
            <ul>
              <li><a href="/how-to-findids.html">How to Find Your IDs</a></li>
            </ul>
          </div>
        </div>
        <div class="footer-col">
          <div>
            <h4>Legal</h4>
            <ul>
              <li><a href="/about-me.html">About Me</a></li>
              <li><a href="/privacy-policy.html">Privacy Policy</a></li>
              <li><a href="/terms-of-service.html">Terms of Service</a></li>
              <li><a href="/refund-policy.html">Refund & Cancellation</a></li>
            </ul>
          </div>
          <div>
            <h4>Support</h4>
            <ul>
              <li><a href="/contact.html">Contact Us</a></li>
              <li><a href="mailto:info@fplscout.name.ng">Email Support</a></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
    <div class="footer-copy" style="max-width:var(--max-w);margin:0 auto;">
      <span>© 2026 Olamn WebGIS. All rights reserved. | Built for Fantasy Premier League Managers.</span>
      <span>
        <a href="mailto:info@fplscout.name.ng">✉ info@fplscout.name.ng</a>
        &nbsp;|&nbsp;
        <a href="mailto:olamn@fplscout.name.ng">olamn@fplscout.name.ng</a>
      </span>
    </div>
  </footer>`;

  // 3. System Toast Alerts Layout
  const TOAST_HTML = `<div id="toast" role="alert" aria-live="polite"></div>`;

  // 4. Premium Authentication Popup Modal Template
  const MODAL_HTML = `
<div id="auth-modal" class="modal-hidden">
    <div class="modal-content">
        <span id="close-modal-btn">&times;</span>
        
        <div id="auth-tabs" class="auth-tabs">
            <button id="tab-signin" class="active-tab">Sign In</button>
            <button id="tab-signup">Sign Up</button>
        </div>

        <!-- 1. SIGN IN FORM -->
        <form id="signin-form" class="auth-form">
            <h2>Welcome Back</h2>
            <div class="form-group">
                <label>Email Address</label>
                <input type="email" id="signin-email" required placeholder="Enter email">
            </div>
            <div class="form-group">
                <label>Password</label>
                <div class="password-wrapper">
                    <input type="password" id="signin-password" required placeholder="Enter password">
                    <span class="password-toggle-btn" onclick="togglePasswordVisibility('signin-password', this)">👁️</span>
                </div>
            </div>
            <button type="submit" class="auth-btn">Log In</button>
        </form>

        <!-- 2. SIGN UP FORM -->
        <form id="signup-form" class="auth-form form-hidden">
            <h2>Create Account</h2>
            <div class="form-group">
                <label>Full Name</label>
                <input type="text" id="signup-name" required placeholder="Enter your full name">
            </div>
            <div class="form-group">
                <label>Email Address</label>
                <input type="email" id="signup-email" required placeholder="Enter email">
            </div>
            <div class="form-group">
                <label>Country</label>
                <select id="signup-country" required>
                    <option value="" disabled selected>Select country</option>
                    <option value="Nigeria">Nigeria</option>
                    <option value="Ghana">Ghana</option>
                    <option value="United Kingdom">United Kingdom</option>
                    <option value="United States">United States</option>
                </select>
            </div>
            <div class="form-group">
                <label>Password</label>
                <div class="password-wrapper">
                    <input type="password" id="signup-password" required placeholder="Create password">
                    <span class="password-toggle-btn" onclick="togglePasswordVisibility('signup-password', this)">👁️</span>
                </div>
            </div>
            <button type="submit" class="auth-btn">Create Account</button>
        </form>

        <!-- 3. FORGOT PASSWORD EMAIL FORM -->
        <form id="forgot-password-form" class="auth-form form-hidden">
            <h2>Reset Password</h2>
            <p>Enter your email address and we'll send you a verification code.</p>
            <div class="form-group">
                <label>Email Address</label>
                <input type="email" id="forgot-password-email" required placeholder="Enter your email">
            </div>
            <button type="submit" class="auth-btn">Send Reset Code</button>
            <p style="text-align: center; margin-top: 1rem; font-size: 0.85rem;">
                <a href="#" id="back-to-signin-link" style="color: #0070f3; cursor: pointer; text-decoration: none;">Back to Sign In</a>
            </p>
        </form>

        <!-- 5. RESET PASSWORD OTP FORM -->
        <form id="reset-otp-form" class="auth-form form-hidden">
            <h2>Verify Your Code</h2>
            <p>We sent a 6-digit code to <b id="reset-otp-target-email" style="color: #0070f3;">your email</b>.</p>
            <p style="font-size: 0.85rem; color: #666; margin: 10px 0;">💡 <em>Tip: If you don't see the email, please check your <strong>Spam</strong> or <strong>Junk</strong> folder.</em></p>
            <div class="form-group">
                <label>6-Digit Code</label>
                <input type="text" id="reset-otp-input" maxlength="6" required placeholder="123456" style="text-align: center; font-size: 24px; letter-spacing: 5px;">
            </div>
            <button type="submit" class="auth-btn">Verify Code</button>
        </form>
    </div>
</div>
`;

  // 5. Complete Injector Logic Engine
  function inject() {
    // Nav Injection Execution
    const navTarget = document.getElementById('nav-placeholder') || document.body;
    if (document.getElementById('nav-placeholder')) {
      navTarget.innerHTML = NAV_HTML;
    } else {
      const tmp = document.createElement('div');
      tmp.innerHTML = NAV_HTML;
      document.body.insertBefore(tmp.firstElementChild, document.body.firstChild);
    }

    // Footer Injection Execution
    const footTarget = document.getElementById('footer-placeholder');
    if (footTarget) {
      footTarget.innerHTML = FOOTER_HTML;
    } else {
      const tmp = document.createElement('div');
      tmp.innerHTML = FOOTER_HTML;
      document.body.appendChild(tmp.firstElementChild);
    }

    // Toast Alerts Component Injection Execution
    document.body.insertAdjacentHTML('beforeend', TOAST_HTML);

    // Authentication Popup Component Injection Execution
    document.body.insertAdjacentHTML('beforeend', MODAL_HTML);

    // Active Tab Navigation Link Highlighting Style Engine
    const path = location.pathname.replace(/\/$/, '') || '/';
    document.querySelectorAll('.nav-links a').forEach(a => {
      const href = (a.getAttribute('href') || '').replace(/\/$/, '') || '/';
      if (href === path) a.classList.add('active');
    });

    // Hamburger Mobile UI Layout Animation Controller
    const ham = document.querySelector('.hamburger');
    const nl  = document.querySelector('.nav-links');
    const nbi = document.querySelector('.navbar-inner'); 
    
    if (ham && nl) {
      ham.addEventListener('click', () => {
        const open = nl.classList.toggle('open');
        if (nbi) nbi.classList.toggle('menu-open');
        ham.setAttribute('aria-expanded', open);
      });
    }

    // Monitor server status and network connectivity pings
    function updateIndicatorStatus() {
      const indicator = document.getElementById('live-badge');
      if (!indicator) return;

      if (!navigator.onLine) {
        indicator.className = 'live-indicator offline';
        indicator.title = 'Server Status: Offline (No Internet)';
        return;
      }

      fetch('/api/bootstrap', { method: 'HEAD', cache: 'no-store' })
        .then(response => {
          if (response.ok) {
            indicator.className = 'live-indicator online';
            indicator.title = 'Server Status: Online';
          } else {
            indicator.className = 'live-indicator error';
            indicator.title = 'Server Status: Error';
          }
        })
        .catch(() => {
          indicator.className = 'live-indicator error';
          indicator.title = 'Server Status: Offline';
        });
    }

    // Check indicator metrics on load initialization parameters
    updateIndicatorStatus();
    setInterval(updateIndicatorStatus, 10000); // Recurrent ping track

    window.addEventListener('online', updateIndicatorStatus);
    window.addEventListener('offline', updateIndicatorStatus);
  }

  // Execution pipeline attachment triggers
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
