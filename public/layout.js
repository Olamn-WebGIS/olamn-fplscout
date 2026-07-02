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
      <li><a href="/blog">Blog</a></li>
      <li><a href="/recommendations" class="spy-lock">Recommendations</a></li>
      <li><a href="/spy" class="spy-lock">League Spy</a></li>
      <li id="account-nav-item" class="account-hidden"><a href="/account"> Account</a></li>
    </ul>

    <button class="hamburger" aria-label="Open menu" aria-expanded="false">
      <span></span><span></span><span></span>
    </button>
  </div>
</nav>

<span class="live-indicator header-live-badge" id="live-badge" title="Server Status: Online"></span>`;

  const FONT_AWESOME_LINK = `<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" crossorigin="anonymous" referrerpolicy="no-referrer" />`;
  const GA_TRACKING_ID = 'G-CC276SDKEW';

  function readStoredUserSession() {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return null;

    try {
      const rawSession = localStorage.getItem('fpl_user_session');
      return rawSession ? JSON.parse(rawSession) : null;
    } catch (error) {
      console.warn('Unable to read premium session state:', error);
      return null;
    }
  }

  function revealAccountLinkIfLoggedIn() {
    const currentUser = readStoredUserSession();
    const accountNavItem = document.getElementById('account-nav-item');
    if (currentUser && accountNavItem) {
      accountNavItem.classList.remove('account-hidden');
    }
  }

  function isPremiumUser(user) {
    if (!user) return false;
    if (user.isPremium === true || user.is_premium === true) return true;
    if (user.subscription_status && ['Premium Member', 'premium'].includes(String(user.subscription_status))) return true;

    if (user.premium_expiry) {
      const expiryDate = new Date(user.premium_expiry);
      if (!Number.isNaN(expiryDate.getTime()) && expiryDate > new Date()) return true;
    }

    return false;
  }

  function shouldLoadAdScripts() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return false;

    const currentPath = window.location.pathname || '/';
    if (currentPath.startsWith('/recommendations') || currentPath.startsWith('/spy')) return false;

    return !isPremiumUser(readStoredUserSession());
  }

  function isAdScriptAllowedOnPage(src) {
    const currentPath = window.location.pathname || '/';
    const homeOrAffiliate = currentPath === '/' || currentPath.startsWith('/affiliate');

    if (!homeOrAffiliate) return true;
    if (src.includes('sidewalkboiling.com/c1/2e/18/c12e186c286b55079d6be2abac279806.js')) return false;
    if (src.includes('sidewalkboiling.com/a971d37adb76d2f7565f5acc30b1239e/invoke.js')) return false;
    return true;
  }

  function updateAdPlaceholderVisibility(show) {
    if (typeof document === 'undefined') return;
    const adSection = document.getElementById('home-ad-section');
    if (!adSection) return;
    adSection.style.display = show ? '' : 'none';
  }

  function removeInjectedAdScripts() {
    if (typeof document === 'undefined') return;

    document.querySelectorAll('script[data-ad-script], script[data-ad-script-inline]').forEach(script => script.remove());
    delete window.__adScriptsInjected;
    updateAdPlaceholderVisibility(false);
  }

  function injectAdScripts() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    if (!shouldLoadAdScripts()) {
      removeInjectedAdScripts();
      return;
    }

    if (window.__adScriptsInjected) return;
    window.__adScriptsInjected = true;

    const adScripts = [
      { src: 'https://sidewalkboiling.com/c1/2e/18/c12e186c286b55079d6be2abac279806.js', attrs: { async: true, 'data-ad-script': 'true' } },
      { src: 'https://5gvci.com/act/files/tag.min.js?z=11206227', attrs: { async: true, 'data-ad-script': 'true', 'data-cfasync': 'false' } },
      { src: 'https://sidewalkboiling.com/a971d37adb76d2f7565f5acc30b1239e/invoke.js', attrs: { async: true, 'data-ad-script': 'true', 'data-cfasync': 'false' } }
    ];

    const allowedScripts = adScripts.filter(({ src }) => isAdScriptAllowedOnPage(src));
    if (allowedScripts.length === 0) {
      updateAdPlaceholderVisibility(false);
      return;
    }

    updateAdPlaceholderVisibility(true);
    allowedScripts.forEach(({ src, attrs }) => {
      const script = document.createElement('script');
      Object.entries(attrs).forEach(([key, value]) => {
        if (typeof value === 'boolean') {
          if (value) script.setAttribute(key, '');
        } else {
          script.setAttribute(key, String(value));
        }
      });
      script.src = src;
      document.body.appendChild(script);
    });
  }

  function injectGlobalAnalytics() {
    if (!document.head.querySelector(`script[src*="googletagmanager.com/gtag/js?id=${GA_TRACKING_ID}"]`)) {
      const scriptTag = document.createElement('script');
      scriptTag.async = true;
      scriptTag.src = `https://www.googletagmanager.com/gtag/js?id=${GA_TRACKING_ID}`;
      document.head.appendChild(scriptTag);
    }

    if (!document.head.querySelector('script[data-gtag-init]')) {
      const initScript = document.createElement('script');
      initScript.setAttribute('data-gtag-init', 'true');
      initScript.textContent = `window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', '${GA_TRACKING_ID}');`;
      document.head.appendChild(initScript);
    }
  }

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
        <div class="footer-socials" style="margin-top:1rem; display:flex; gap:1rem; align-items:center; font-size: 1.25rem;">
  <!-- X (Twitter) Link -->
  <a href="https://x.com/OlamnFPL_scout" target="_blank" rel="noopener" aria-label="X (Twitter)" class="social-btn social-btn-twitter" style="color: currentColor; text-decoration: none;">
    <i class="fa-brands fa-x-twitter"></i>
  </a>
  
  <!-- Facebook Link -->
  <a href="https://facebook.com/olamnfplscout" target="_blank" rel="noopener" aria-label="Facebook" class="social-btn social-btn-facebook" style="color: currentColor; text-decoration: none;">
    <i class="fa-brands fa-facebook"></i>
  </a>
</div>
      </div>
      <div class="footer-columns">
        <div class="footer-col">
          <div>
            <h4>Quick Links</h4>
            <ul>
              <li><a href="/">Home</a></li>
              <li><a href="/blog">Blog</a></li>
              <li><a href="/recommendations" class="spy-lock">Recommendations</a></li>
              <li><a href="/spy" class="spy-lock">League Spy</a></li>
              <li><a href="/fixtures">Live Fixtures</a></li>
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
              <li><a href="/affiliate">Affiliate Program</a></li>
              <li><a href="/affiliate#terms">Affiliate Terms</a></li>
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
            <p style="text-align: center; margin-top: 1rem; font-size: 0.85rem;">
                <a href="#" id="forgot-password-link" style="color: #0070f3; cursor: pointer; text-decoration: none;">Forgot Password?</a>
            </p>
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
                    <option value="Afghanistan">Afghanistan</option>
                    <option value="Albania">Albania</option>
                    <option value="Algeria">Algeria</option>
                    <option value="Andorra">Andorra</option>
                    <option value="Angola">Angola</option>
                    <option value="Antigua and Barbuda">Antigua and Barbuda</option>
                    <option value="Argentina">Argentina</option>
                    <option value="Armenia">Armenia</option>
                    <option value="Australia">Australia</option>
                    <option value="Austria">Austria</option>
                    <option value="Azerbaijan">Azerbaijan</option>
                    <option value="Bahamas">Bahamas</option>
                    <option value="Bahrain">Bahrain</option>
                    <option value="Bangladesh">Bangladesh</option>
                    <option value="Barbados">Barbados</option>
                    <option value="Belarus">Belarus</option>
                    <option value="Belgium">Belgium</option>
                    <option value="Belize">Belize</option>
                    <option value="Benin">Benin</option>
                    <option value="Bhutan">Bhutan</option>
                    <option value="Bolivia">Bolivia</option>
                    <option value="Bosnia and Herzegovina">Bosnia and Herzegovina</option>
                    <option value="Botswana">Botswana</option>
                    <option value="Brazil">Brazil</option>
                    <option value="Brunei">Brunei</option>
                    <option value="Bulgaria">Bulgaria</option>
                    <option value="Burkina Faso">Burkina Faso</option>
                    <option value="Burundi">Burundi</option>
                    <option value="Cabo Verde">Cabo Verde</option>
                    <option value="Cambodia">Cambodia</option>
                    <option value="Cameroon">Cameroon</option>
                    <option value="Canada">Canada</option>
                    <option value="Central African Republic">Central African Republic</option>
                    <option value="Chad">Chad</option>
                    <option value="Chile">Chile</option>
                    <option value="China">China</option>
                    <option value="Colombia">Colombia</option>
                    <option value="Comoros">Comoros</option>
                    <option value="Congo">Congo</option>
                    <option value="Costa Rica">Costa Rica</option>
                    <option value="Côte d'Ivoire">Côte d'Ivoire</option>
                    <option value="Croatia">Croatia</option>
                    <option value="Cuba">Cuba</option>
                    <option value="Cyprus">Cyprus</option>
                    <option value="Czechia">Czechia</option>
                    <option value="Democratic Republic of the Congo">Democratic Republic of the Congo</option>
                    <option value="Denmark">Denmark</option>
                    <option value="Djibouti">Djibouti</option>
                    <option value="Dominica">Dominica</option>
                    <option value="Dominican Republic">Dominican Republic</option>
                    <option value="Ecuador">Ecuador</option>
                    <option value="Egypt">Egypt</option>
                    <option value="El Salvador">El Salvador</option>
                    <option value="Equatorial Guinea">Equatorial Guinea</option>
                    <option value="Eritrea">Eritrea</option>
                    <option value="Estonia">Estonia</option>
                    <option value="Eswatini">Eswatini</option>
                    <option value="Ethiopia">Ethiopia</option>
                    <option value="Fiji">Fiji</option>
                    <option value="Finland">Finland</option>
                    <option value="France">France</option>
                    <option value="Gabon">Gabon</option>
                    <option value="Gambia">Gambia</option>
                    <option value="Georgia">Georgia</option>
                    <option value="Germany">Germany</option>
                    <option value="Ghana">Ghana</option>
                    <option value="Greece">Greece</option>
                    <option value="Grenada">Grenada</option>
                    <option value="Guatemala">Guatemala</option>
                    <option value="Guinea">Guinea</option>
                    <option value="Guinea-Bissau">Guinea-Bissau</option>
                    <option value="Guyana">Guyana</option>
                    <option value="Haiti">Haiti</option>
                    <option value="Honduras">Honduras</option>
                    <option value="Hungary">Hungary</option>
                    <option value="Iceland">Iceland</option>
                    <option value="India">India</option>
                    <option value="Indonesia">Indonesia</option>
                    <option value="Iran">Iran</option>
                    <option value="Iraq">Iraq</option>
                    <option value="Ireland">Ireland</option>
                    <option value="Israel">Israel</option>
                    <option value="Italy">Italy</option>
                    <option value="Jamaica">Jamaica</option>
                    <option value="Japan">Japan</option>
                    <option value="Jordan">Jordan</option>
                    <option value="Kazakhstan">Kazakhstan</option>
                    <option value="Kenya">Kenya</option>
                    <option value="Kiribati">Kiribati</option>
                    <option value="Kuwait">Kuwait</option>
                    <option value="Kyrgyzstan">Kyrgyzstan</option>
                    <option value="Laos">Laos</option>
                    <option value="Latvia">Latvia</option>
                    <option value="Lebanon">Lebanon</option>
                    <option value="Lesotho">Lesotho</option>
                    <option value="Liberia">Liberia</option>
                    <option value="Libya">Libya</option>
                    <option value="Liechtenstein">Liechtenstein</option>
                    <option value="Lithuania">Lithuania</option>
                    <option value="Luxembourg">Luxembourg</option>
                    <option value="Madagascar">Madagascar</option>
                    <option value="Malawi">Malawi</option>
                    <option value="Malaysia">Malaysia</option>
                    <option value="Maldives">Maldives</option>
                    <option value="Mali">Mali</option>
                    <option value="Malta">Malta</option>
                    <option value="Marshall Islands">Marshall Islands</option>
                    <option value="Mauritania">Mauritania</option>
                    <option value="Mauritius">Mauritius</option>
                    <option value="Mexico">Mexico</option>
                    <option value="Micronesia">Micronesia</option>
                    <option value="Moldova">Moldova</option>
                    <option value="Monaco">Monaco</option>
                    <option value="Mongolia">Mongolia</option>
                    <option value="Montenegro">Montenegro</option>
                    <option value="Morocco">Morocco</option>
                    <option value="Mozambique">Mozambique</option>
                    <option value="Myanmar">Myanmar</option>
                    <option value="Namibia">Namibia</option>
                    <option value="Nauru">Nauru</option>
                    <option value="Nepal">Nepal</option>
                    <option value="Netherlands">Netherlands</option>
                    <option value="New Zealand">New Zealand</option>
                    <option value="Nicaragua">Nicaragua</option>
                    <option value="Niger">Niger</option>
                    <option value="Nigeria">Nigeria</option>
                    <option value="North Korea">North Korea</option>
                    <option value="North Macedonia">North Macedonia</option>
                    <option value="Norway">Norway</option>
                    <option value="Oman">Oman</option>
                    <option value="Pakistan">Pakistan</option>
                    <option value="Palau">Palau</option>
                    <option value="Palestine">Palestine</option>
                    <option value="Panama">Panama</option>
                    <option value="Papua New Guinea">Papua New Guinea</option>
                    <option value="Paraguay">Paraguay</option>
                    <option value="Peru">Peru</option>
                    <option value="Philippines">Philippines</option>
                    <option value="Poland">Poland</option>
                    <option value="Portugal">Portugal</option>
                    <option value="Qatar">Qatar</option>
                    <option value="Romania">Romania</option>
                    <option value="Russia">Russia</option>
                    <option value="Rwanda">Rwanda</option>
                    <option value="Saint Kitts and Nevis">Saint Kitts and Nevis</option>
                    <option value="Saint Lucia">Saint Lucia</option>
                    <option value="Saint Vincent and the Grenadines">Saint Vincent and the Grenadines</option>
                    <option value="Samoa">Samoa</option>
                    <option value="San Marino">San Marino</option>
                    <option value="Sao Tome and Principe">Sao Tome and Principe</option>
                    <option value="Saudi Arabia">Saudi Arabia</option>
                    <option value="Senegal">Senegal</option>
                    <option value="Serbia">Serbia</option>
                    <option value="Seychelles">Seychelles</option>
                    <option value="Sierra Leone">Sierra Leone</option>
                    <option value="Singapore">Singapore</option>
                    <option value="Slovakia">Slovakia</option>
                    <option value="Slovenia">Slovenia</option>
                    <option value="Solomon Islands">Solomon Islands</option>
                    <option value="Somalia">Somalia</option>
                    <option value="South Africa">South Africa</option>
                    <option value="South Korea">South Korea</option>
                    <option value="South Sudan">South Sudan</option>
                    <option value="Spain">Spain</option>
                    <option value="Sri Lanka">Sri Lanka</option>
                    <option value="Sudan">Sudan</option>
                    <option value="Suriname">Suriname</option>
                    <option value="Sweden">Sweden</option>
                    <option value="Switzerland">Switzerland</option>
                    <option value="Syria">Syria</option>
                    <option value="Taiwan">Taiwan</option>
                    <option value="Tajikistan">Tajikistan</option>
                    <option value="Tanzania">Tanzania</option>
                    <option value="Thailand">Thailand</option>
                    <option value="Timor-Leste">Timor-Leste</option>
                    <option value="Togo">Togo</option>
                    <option value="Tonga">Tonga</option>
                    <option value="Trinidad and Tobago">Trinidad and Tobago</option>
                    <option value="Tunisia">Tunisia</option>
                    <option value="Turkey">Turkey</option>
                    <option value="Turkmenistan">Turkmenistan</option>
                    <option value="Tuvalu">Tuvalu</option>
                    <option value="Uganda">Uganda</option>
                    <option value="Ukraine">Ukraine</option>
                    <option value="United Arab Emirates">United Arab Emirates</option>
                    <option value="United Kingdom">United Kingdom</option>
                    <option value="United States">United States</option>
                    <option value="Uruguay">Uruguay</option>
                    <option value="Uzbekistan">Uzbekistan</option>
                    <option value="Vanuatu">Vanuatu</option>
                    <option value="Vatican City">Vatican City</option>
                    <option value="Venezuela">Venezuela</option>
                    <option value="Vietnam">Vietnam</option>
                    <option value="Yemen">Yemen</option>
                    <option value="Zambia">Zambia</option>
                    <option value="Zimbabwe">Zimbabwe</option>
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

        <!-- 6. NEW PASSWORD FORM -->
        <form id="new-password-form" class="auth-form form-hidden">
            <h2>Create New Password</h2>
            <div class="form-group">
                <label>New Password</label>
                <div class="password-wrapper">
                    <input type="password" id="new-password-input" required placeholder="Enter new password">
                    <span class="password-toggle-btn" onclick="togglePasswordVisibility('new-password-input', this)">👁️</span>
                </div>
            </div>
            <div class="form-group">
                <label>Confirm Password</label>
                <div class="password-wrapper">
                    <input type="password" id="confirm-password-input" required placeholder="Confirm new password">
                    <span class="password-toggle-btn" onclick="togglePasswordVisibility('confirm-password-input', this)">👁️</span>
                </div>
            </div>
            <button type="submit" class="auth-btn">Update Password</button>
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

    injectAdScripts();
    injectGlobalAnalytics();

    // Load Font Awesome if not already loaded
    if (!document.querySelector('link[href*="font-awesome"][rel="stylesheet"]') && !document.querySelector('link[href*="fontawesome"][rel="stylesheet"]')) {
      document.head.insertAdjacentHTML('beforeend', FONT_AWESOME_LINK);
    }

    revealAccountLinkIfLoggedIn();

    // Active Tab Navigation Link Highlighting Style Engine
    const path = location.pathname.replace(/\/$/, '') || '/';
    document.querySelectorAll('.nav-links a').forEach(a => {
      const href = (a.getAttribute('href') || '').replace(/\/$/, '') || '/';
      if (href === path) a.classList.add('active');
      a.addEventListener('click', () => {
        if (nl.classList.contains('open')) {
          nl.classList.remove('open');
          ham.setAttribute('aria-expanded', 'false');
          if (nbi) nbi.classList.remove('menu-open');
        }
      });
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

      fetch('/api/health', { method: 'HEAD', cache: 'no-store' })
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
