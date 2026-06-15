const express = require('express');
const fetch = require('node-fetch');
const NodeCache = require('node-cache');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const path = require('path');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config(); // Load environment variables

const app = express();
const cache = new NodeCache({ stdTTL: 120 }); // 2-min default cache

const FPL_BASE = 'https://fantasy.premierleague.com/api';

// ── Supabase Initialization ────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);
// 🔒 PREMIUM SECURITY CHECK MIDDLEWARE
// It looks up the requesting user's true profile status in Supabase before unblocking private paths
async function requirePremiumUser(req, res, next) {
    try {
        // Extract userId dynamically from headers or query parameters sent by the frontend
        const userId = req.headers['x-user-id'] || req.query.userId || req.body.userId;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required. Please log in.' });
        }

        // Fetch their live subscription tier row directly from your profiles schema
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('subscription_status')
            .eq('id', userId)
            .single();

        if (error || !profile) {
            return res.status(404).json({ success: false, message: 'User profile matrix not found.' });
        }

        // 🚨 SAFETY GATE: If they aren't premium, block them instantly right here!
        if (profile.subscription_status !== 'Premium Member') {
            return res.status(403).json({ success: false, isLocked: true, message: 'Access Denied. This feature requires a Premium Subscription.' });
        }

        // If they pass the check, allow the server to proceed cleanly to the actual endpoint data
        next();
    } catch (err) {
        console.error('Security middleware intercept crash:', err);
        return res.status(500).json({ success: false, message: 'Internal validation error occurred.' });
    }
}
// ── Middleware ────────────────────────────────────────────────
app.use(compression());
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(process.cwd(), 'public')));

// ── Helpers ───────────────────────────────────────────────────
async function fplFetch(endpoint, ttl = 120) {
  const key = endpoint;
  const cached = cache.get(key);
  if (cached) return cached;

  const res = await fetch(`${FPL_BASE}${endpoint}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; FPLScout/1.0)',
      'Accept': 'application/json',
      'Accept-Language': 'en-GB,en;q=0.9',
      'Referer': 'https://fantasy.premierleague.com/',
    },
  });

  if (!res.ok) throw new Error(`FPL API ${res.status}: ${endpoint}`);
  const data = await res.json();
  cache.set(key, data, ttl);
  return data;
}

function apiError(res, err) {
  console.error(err.message);
  res.status(502).json({ error: err.message });
}

// ── Routes ────────────────────────────────────────────────────

// Bootstrap: players, teams, events
app.get('/api/bootstrap', async (req, res) => {
  try {
    const data = await fplFetch('/bootstrap-static/', 300);
    res.json(data);
  } catch (e) { apiError(res, e); }
});

// Single manager entry
app.get('/api/manager/:id', async (req, res) => {
  try {
    const data = await fplFetch(`/entry/${req.params.id}/`, 180);
    res.json(data);
  } catch (e) { apiError(res, e); }
});

// Manager history (all GW scores)
app.get('/api/manager/:id/history', async (req, res) => {
  try {
    const data = await fplFetch(`/entry/${req.params.id}/history/`, 180);
    res.json(data);
  } catch (e) { apiError(res, e); }
});

// Manager picks for a gameweek
app.get('/api/manager/:id/picks/:gw', async (req, res) => {
  try {
    const data = await fplFetch(`/entry/${req.params.id}/event/${req.params.gw}/picks/`, 120);
    res.json(data);
  } catch (e) { apiError(res, e); }
});

// Manager transfers
app.get('/api/manager/:id/transfers', async (req, res) => {
  try {
    const data = await fplFetch(`/entry/${req.params.id}/transfers/`, 120);
    res.json(data);
  } catch (e) { apiError(res, e); }
});

// Classic league standings
app.get('/api/league/:id', async (req, res) => {
  try {
    const page = req.query.page || 1;
    const data = await fplFetch(`/leagues-classic/${req.params.id}/standings/?page_standings=${page}`, 120);
    res.json(data);
  } catch (e) { apiError(res, e); }
});

// H2H league standings
app.get('/api/league-h2h/:id', async (req, res) => {
  try {
    const data = await fplFetch(`/leagues-h2h/${req.params.id}/standings/`, 120);
    res.json(data);
  } catch (e) { apiError(res, e); }
});

// Gameweek live scores
app.get('/api/live/:gw', async (req, res) => {
  try {
    const data = await fplFetch(`/event/${req.params.gw}/live/`, 60);
    res.json(data);
  } catch (e) { apiError(res, e); }
});

// Player element summary (fixtures + history)
app.get('/api/player/:id', async (req, res) => {
  try {
    const data = await fplFetch(`/element-summary/${req.params.id}/`, 300);
    res.json(data);
  } catch (e) { apiError(res, e); }
});

// Fixtures
app.get('/api/fixtures', async (req, res) => {
  try {
    const gw = req.query.gw;
    const endpoint = gw ? `/fixtures/?event=${gw}` : '/fixtures/';
    const data = await fplFetch(endpoint, 600);
    res.json(data);
  } catch (e) { apiError(res, e); }
});

// ── Batch: league spy (standings + all picks + all transfers) ──
app.get('/api/spy/:leagueId', async (req, res) => {
  try {
    const league = await fplFetch(`/leagues-classic/${req.params.leagueId}/standings/`, 120);
    const bootstrap = await fplFetch('/bootstrap-static/', 300);
    const currentGW = bootstrap.events.find(e => e.is_current)?.id ||
                      bootstrap.events.find(e => e.is_next)?.id - 1 || 38;

    const entries = league.standings.results.slice(0, 50);

    const [picksArr, transfersArr, detailsArr] = await Promise.all([
      Promise.all(entries.map(e =>
        fplFetch(`/entry/${e.entry}/event/${currentGW}/picks/`, 120).catch(() => null)
      )),
      Promise.all(entries.map(e =>
        fplFetch(`/entry/${e.entry}/transfers/`, 120).catch(() => null)
      )),
      Promise.all(entries.map(e =>
        fplFetch(`/entry/${e.entry}/`, 180).catch(() => null)
      ))
    ]);

    const enriched = entries.map((e, i) => ({
      ...e,
      picks: picksArr[i],
      transfers: transfersArr[i],
      detail: detailsArr[i]
    }));

    res.json({
      league: league.league,
      currentGW,
      managers: enriched,
      players: bootstrap.elements,
      teams: bootstrap.teams
    });
  } catch (err) { apiError(res, err); }
});

// ── Transfer Analysis: Manager team analysis with recommendations ──
app.get('/api/analyze-transfers/:id/:gw', async (req, res) => {
  try {
    const managerId = req.params.id;
    const currentGW = req.params.gw || 1;

    // Fetch all data in parallel
    const [bootstrap, picks, manager] = await Promise.all([
      fplFetch('/bootstrap-static/', 300),
      fplFetch(`/entry/${managerId}/event/${currentGW}/picks/`, 120),
      fplFetch(`/entry/${managerId}/`, 180)
    ]);

    const allPlayers = bootstrap.elements;
    const allTeams = bootstrap.teams;

    // Build squad from picks
    const squadPicks = picks.picks.map(pick => {
      const player = allPlayers.find(p => p.id === pick.element);
      return {
        ...player,
        is_captain: pick.is_captain,
        is_vice_captain: pick.is_vice_captain,
        position: pick.position
      };
    });

    // Helper functions
    function posName(et) { return { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' }[et] || 'UNK'; }
    
    function calcScore(player) {
      let score = 0;
      score += (parseFloat(player.form || 0) * 10) * 0.25;
      score += (parseFloat(player.event_points || 0) * 10) * 0.20;
      const goalWeight = player.element_type === 4 ? 1.0 : player.element_type === 3 ? 0.7 : 0.5;
      score += (player.goals_scored || 0) * goalWeight * 0.15;
      score += (player.assists || 0) * 0.15;
      const csPoints = player.element_type <= 2 ? (player.clean_sheets || 0) * 2 : 0;
      score += csPoints * 0.15;
      score += (player.yellow_cards || 0) * -0.05;
      const fdr = parseFloat(player.fixture_difficulty) || 2;
      score -= (fdr - 2) * 0.1; // Lower FDR is better
      if (player.status === 'u') score += -5;
      if (player.status === 'd') score += -3;
      if (player.status === 's') score += -1;
      return Math.max(0, score);
    }

    function validateSquad(players) {
      const errors = [];
      const composition = { GKP: 0, DEF: 0, MID: 0, FWD: 0 };
      let totalCost = 0;
      players.forEach(p => {
        const pos = posName(p.element_type);
        composition[pos]++;
        totalCost += p.now_cost || 0;
      });
      const rules = { GKP: 2, DEF: 5, MID: 5, FWD: 3 };
      Object.entries(rules).forEach(([pos, need]) => {
        if (composition[pos] !== need) {
          errors.push(`${pos}: have ${composition[pos]}, need ${need}`);
        }
      });
      const budgetM = totalCost / 10;
      if (budgetM > 100) errors.push(`Budget: £${budgetM.toFixed(1)}m > £100m`);
      return { isValid: errors.length === 0, errors, composition, totalCost: budgetM };
    }

    // Score all squad players
    const scored = squadPicks.map(p => ({ ...p, score: calcScore(p) }));
    const byPos = {};
    scored.forEach(p => {
      const pos = posName(p.element_type);
      if (!byPos[pos]) byPos[pos] = [];
      byPos[pos].push(p);
    });
    Object.keys(byPos).forEach(pos => byPos[pos].sort((a, b) => b.score - a.score));

    const starting = [
      ...byPos.GKP.slice(0, 1),
      ...byPos.DEF.slice(0, 4),
      ...byPos.MID.slice(0, 4),
      ...byPos.FWD.slice(0, 2)
    ];

    const bench = [
      ...byPos.GKP.slice(1),
      ...byPos.DEF.slice(4),
      ...byPos.MID.slice(4),
      ...byPos.FWD.slice(2)
    ].sort((a, b) => b.score - a.score);

    const validation = validateSquad(squadPicks);
    const squadIds = new Set(squadPicks.map(p => p.id));
    
    // Generate transfer recommendations
    function getTransferRecommendations() {
      const recommendations = { 
        players_to_sell: [],
        players_to_buy: [],
        best_captain: null
      };

      // Get weakest starters (last 2)
      const weakestStarters = starting.sort((a, b) => a.score - b.score).slice(0, 2);
      
      weakestStarters.forEach(weakPlayer => {
        const pos = posName(weakPlayer.element_type);
        const budget = 100 - (validation.totalCost - (weakPlayer.now_cost / 10));
        
        // Find best available market players of same position
        const marketPlayers = allPlayers
          .filter(p => !squadIds.has(p.id) && 
                       posName(p.element_type) === pos && 
                       p.status === 'a' &&
                       (p.now_cost / 10) <= budget)
          .map(p => ({ ...p, score: calcScore(p) }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 1);

        if (marketPlayers.length > 0) {
          const replacement = marketPlayers[0];
          recommendations.players_to_sell.push({
            name: weakPlayer.web_name,
            position: pos,
            team: allTeams.find(t => t.id === weakPlayer.team)?.name,
            price: (weakPlayer.now_cost / 10).toFixed(1),
            score: weakPlayer.score.toFixed(2),
            form: weakPlayer.form
          });
          recommendations.players_to_buy.push({
            name: replacement.web_name,
            position: pos,
            team: allTeams.find(t => t.id === replacement.team)?.name,
            price: (replacement.now_cost / 10).toFixed(1),
            score: replacement.score.toFixed(2),
            form: replacement.form,
            goals: replacement.goals_scored || 0,
            assists: replacement.assists || 0,
            clean_sheets: replacement.clean_sheets || 0,
            fdr: replacement.fixture_difficulty || 2
          });
        }
      });

      // Best captain (highest score in starting XI)
      if (starting.length > 0) {
        const captain = starting.reduce((best, p) => p.score > best.score ? p : best);
        recommendations.best_captain = {
          name: captain.web_name,
          position: posName(captain.element_type),
          team: allTeams.find(t => t.id === captain.team)?.name,
          price: (captain.now_cost / 10).toFixed(1),
          score: captain.score.toFixed(2)
        };
      }

      return recommendations;
    }

    const transfers = getTransferRecommendations();

    res.json({
      manager_id: managerId,
      manager_name: manager.player_first_name + ' ' + manager.player_last_name,
      squad_value: validation.totalCost,
      squad_composition: validation.composition,
      squad_valid: validation.isValid,
      squad_errors: validation.errors,
      starting_xi: starting.map(p => ({
        id: p.id,
        name: p.web_name,
        position: posName(p.element_type),
        team: allTeams.find(t => t.id === p.team)?.name,
        price: (p.now_cost / 10).toFixed(1),
        form: p.form,
        points: p.total_points,
        event_points: p.event_points,
        score: p.score.toFixed(2),
        status: p.status,
        is_captain: p.is_captain,
        is_vice_captain: p.is_vice_captain
      })),
      bench: bench.slice(0, 4).map(p => ({
        id: p.id,
        name: p.web_name,
        position: posName(p.element_type),
        team: allTeams.find(t => t.id === p.team)?.name,
        price: (p.now_cost / 10).toFixed(1),
        form: p.form,
        points: p.total_points,
        event_points: p.event_points,
        score: p.score.toFixed(2),
        status: p.status
      })),
      transfer_recommendations: transfers,
      analysis: {
        top_performer: starting[0] ? { name: starting[0].web_name, score: starting[0].score.toFixed(2) } : null,
        weakest_starter: starting.length > 0 ? { name: starting.sort((a,b) => a.score - b.score)[0].web_name, score: starting.sort((a,b) => a.score - b.score)[0].score.toFixed(2) } : null,
        average_starting_score: (starting.reduce((s, p) => s + p.score, 0) / starting.length).toFixed(2),
        average_bench_score: bench.length > 0 ? (bench.reduce((s, p) => s + p.score, 0) / bench.length).toFixed(2) : 0
      }
    });
  } catch (err) { apiError(res, err); }
});

// ── Health check ──────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok', ts: Date.now() }));

// ── Page routes ──────────────────────────────────────────────
app.get('/recommendations', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'recommendations.html'));
});

app.get('/spy', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'spy.html'));
});

app.get('/watchlist', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'watchlist.html'));
});

app.get('/contact', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'contact.html'));
});

app.get('/refund-policy', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'refund-policy.html'));
});

app.get('/account', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'account.html'));
});

// 1. Configure your Zoho SMTP Email Transporter
const transporter = nodemailer.createTransport({
  host: 'smtp.zoho.com',
  port: 465,
  secure: true, 
  auth: {
    user: process.env.ZOHO_EMAIL,
    pass: process.env.ZOHO_PASSWORD
  }
});

// Temporary memory to hold OTPs before they are verified (We will replace this with the database later)
let tempOtpStore = {};
let registeredUsersStore = {}; // 🆕 Temporary memory store for verified users

// 2. Create the API Route to handle Sign-Up and send the email
app.post('/api/send-otp', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required' });
        }

        // Verify transporter is working
        const verified = await transporter.verify();
        if (!verified) {
            console.error('Zoho transporter verification failed');
            return res.status(500).json({ success: false, message: 'Email service is not configured properly.' });
        }

        // Generate a random 6-digit number
        const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Save it temporarily linked to their email address
        tempOtpStore[email] = generatedOtp;
        console.log(`Generated OTP for ${email}: ${generatedOtp}`);

        // Define the email appearance
        const mailOptions = {
            from: `"League Spy Team" <${process.env.ZOHO_EMAIL || 'info@fplscout.name.ng'}>`,
            to: email,
            subject: 'Verify Your League Spy Account',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px; max-width: 500px;">
                    <h2 style="color: #0070f3;">Email Verification</h2>
                    <p>Thank you for registering. Use the 6-digit security code below to complete your verification:</p>
                    <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; text-align: center; margin: 30px 0; color: #333;">
                        ${generatedOtp}
                    </div>
                    <p style="font-size: 12px; color: #777;">If you did not request this code, please ignore this email.</p>
                </div>
            `
        };

        // Send the email physically via Zoho
        const info = await transporter.sendMail(mailOptions);
        console.log(`OTP sent successfully to ${email}. Message ID: ${info.messageId}`);
        res.json({ success: true, message: 'OTP sent successfully!' });
    } catch (error) {
        console.error('Zoho Email Error:', error.message);
        res.status(500).json({ success: false, message: `Failed to send verification email: ${error.message}` });
    }
});
// 3. Create the API Route to verify the OTP and complete account creation
app.post('/api/verify-otp', async (req, res) => {
    const { email, otp, fullName, country, password } = req.body;
    const correctOtp = tempOtpStore[email];
    
    // Remove all spaces from the entered OTP for comparison
    const cleanOtp = otp.replace(/\s+/g, '').trim();

    if (!correctOtp) {
        console.error(`OTP verification failed: No OTP found for ${email}`);
        return res.status(400).json({ success: false, message: 'OTP expired or not requested.' });
    }

    console.log(`OTP Verification - Email: ${email}, Expected: ${correctOtp}, Received (cleaned): ${cleanOtp}`);

    if (cleanOtp === correctOtp) {
        delete tempOtpStore[email]; // Clear OTP from memory

        try {
            // Check if user already exists
            const { data: existingUser, error: checkError } = await supabase
                .from('users')
                .select('*')
                .eq('email', email)
                .single();

            if (!checkError && existingUser) {
                return res.status(400).json({ success: false, message: 'User with this email already exists.' });
            }

            // Insert new user into Supabase
            const { data: newUser, error: insertError } = await supabase
                .from('users')
                .insert([
                    {
                        full_name: fullName,
                        email: email,
                        country: country,
                        password: password,
                        is_premium: false,
                        is_admin: false,
                        created_at: new Date()
                    }
                ])
                .select()
                .single();

            if (insertError) {
                console.error('Supabase insert error:', insertError);
                return res.status(500).json({ success: false, message: 'Failed to create user account.' });
            }

            // Also save to memory store for backward compatibility
            registeredUsersStore[email] = newUser;

            console.log(`User verified and registered successfully: ${email}`);

            return res.json({ 
                success: true, 
                message: 'Account verified successfully!',
                user: { id: newUser.id, fullName, email, country, isPremium: false, isAdmin: false }
            });
        } catch (error) {
            console.error('Error during user registration:', error);
            return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
        }
    } else {
        return res.status(400).json({ success: false, message: 'Invalid validation code.' });
    }
});
// 4. Create the API Route to handle Sign-In Login
app.post('/api/signin', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    try {
        // Look for the user account in Supabase
        const { data: userProfile, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (error || !userProfile) {
            return res.status(400).json({ success: false, message: 'No account found with this email address.' });
        }

        // Verify the password matches
        if (userProfile.password === password) {
            console.log(`User logged in successfully: ${email}`);

            return res.json({
                success: true,
                message: 'Login successful!',
                user: {
                    id: userProfile.id,
                    fullName: userProfile.full_name,
                    email: userProfile.email,
                    country: userProfile.country,
                    isPremium: userProfile.is_premium,
                    isAdmin: userProfile.is_admin
                }
            });
        } else {
            return res.status(400).json({ success: false, message: 'Incorrect password. Please try again.' });
        }
    } catch (error) {
        console.error('Error during sign-in:', error);
        return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
    }
});

// Update user subscription status
app.post('/api/update-subscription', async (req, res) => {
    try {
        const { email, isPremium } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required.' });
        }

        // Update subscription status in Supabase
        const { data: updatedUser, error: updateError } = await supabase
            .from('users')
            .update({ is_premium: isPremium })
            .eq('email', email)
            .select()
            .single();

        if (updateError) {
            console.error('Supabase update error:', updateError);
            return res.status(500).json({ success: false, message: 'Failed to update subscription.' });
        }

        console.log(`Subscription updated for ${email}: isPremium = ${isPremium}`);
        return res.json({ 
            success: true, 
            message: 'Subscription updated successfully!',
            user: {
                fullName: updatedUser.full_name,
                email: updatedUser.email,
                country: updatedUser.country,
                isPremium: updatedUser.is_premium,
                isAdmin: updatedUser.is_admin
            }
        });
    } catch (error) {
        console.error('Error updating subscription:', error);
        return res.status(500).json({ success: false, message: 'An error occurred.' });
    }
});

// ── Password Reset Flow ─────────────────────────────────────
let passwordResetOtpStore = {}; // Store for password reset OTPs (separate from signup)

// Forgot Password - Send OTP
app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required' });
        }

        // Check if user exists in Supabase
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (userError || !user) {
            // For security, don't reveal if email exists or not
            return res.status(400).json({ success: false, message: 'If this email exists, you will receive a password reset code.' });
        }

        // Verify transporter
        const verified = await transporter.verify();
        if (!verified) {
            console.error('Zoho transporter verification failed');
            return res.status(500).json({ success: false, message: 'Email service is not configured properly.' });
        }

        // Generate OTP
        const resetOtp = Math.floor(100000 + Math.random() * 900000).toString();
        passwordResetOtpStore[email] = resetOtp;
        console.log(`Generated password reset OTP for ${email}: ${resetOtp}`);

        // Send email
        const mailOptions = {
            from: `"League Spy Team" <${process.env.ZOHO_EMAIL || 'info@fplscout.name.ng'}>`,
            to: email,
            subject: 'Reset Your League Spy Password',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px; max-width: 500px;">
                    <h2 style="color: #0070f3;">Password Reset</h2>
                    <p>We received a request to reset your password. Use the 6-digit code below:</p>
                    <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; text-align: center; margin: 30px 0; color: #333;">
                        ${resetOtp}
                    </div>
                    <p style="font-size: 12px; color: #777;">If you did not request this, please ignore this email.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`Password reset OTP sent to ${email}`);
        res.json({ success: true, message: 'Reset code sent to your email!' });
    } catch (error) {
        console.error('Forgot password error:', error.message);
        res.status(500).json({ success: false, message: `Error: ${error.message}` });
    }
});

// Verify Password Reset OTP
app.post('/api/verify-reset-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        const correctOtp = passwordResetOtpStore[email];
        const cleanOtp = otp.replace(/\s+/g, '').trim();

        if (!correctOtp) {
            return res.status(400).json({ success: false, message: 'Code expired or not requested.' });
        }

        console.log(`Reset OTP Verification - Email: ${email}, Expected: ${correctOtp}, Received: ${cleanOtp}`);

        if (cleanOtp === correctOtp) {
            delete passwordResetOtpStore[email];
            return res.json({ success: true, message: 'Code verified successfully!' });
        } else {
            return res.status(400).json({ success: false, message: 'Invalid code. Please try again.' });
        }
    } catch (error) {
        console.error('Error verifying reset OTP:', error);
        return res.status(500).json({ success: false, message: 'An error occurred.' });
    }
});

// Update Password
app.post('/api/update-password', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required.' });
        }

        // Update password in Supabase
        const { data: updatedUser, error: updateError } = await supabase
            .from('users')
            .update({ password: password })
            .eq('email', email)
            .select()
            .single();

        if (updateError) {
            console.error('Supabase update error:', updateError);
            return res.status(500).json({ success: false, message: 'Failed to update password.' });
        }

        console.log(`Password updated successfully for ${email}`);
        return res.json({ success: true, message: 'Password updated successfully!' });
    } catch (error) {
        console.error('Error updating password:', error);
        return res.status(500).json({ success: false, message: 'An error occurred.' });
    }
});

// Send Contact Form Email
app.post('/api/send-contact', async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;

        if (!name || !email || !subject || !message) {
            return res.status(400).json({ success: false, message: 'All fields are required.' });
        }

        // Send email via Zoho to info@fplscout.name.ng
        const mailOptions = {
            from: process.env.ZOHO_EMAIL || 'info@fplscout.name.ng',
            to: 'info@fplscout.name.ng',
            subject: `New Contact Form Submission: ${subject}`,
            html: `
                <h2>New Contact Form Submission</h2>
                <p><strong>From:</strong> ${name}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Subject:</strong> ${subject}</p>
                <hr>
                <p><strong>Message:</strong></p>
                <p>${message.replace(/\n/g, '<br>')}</p>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`Contact form submission received from ${name} (${email})`);
        return res.json({ success: true, message: 'Your message has been sent successfully!' });
    } catch (error) {
        console.error('Error sending contact email:', error);
        return res.status(500).json({ success: false, message: 'Failed to send message. Please try again.' });
    }
});

// Update Profile
app.post('/api/update-profile', async (req, res) => {
    try {
        const { email, name, country } = req.body;

        if (!email || !name) {
            return res.status(400).json({ success: false, message: 'Name is required.' });
        }

        const { data, error } = await supabase
            .from('users')
            .update({ full_name: name, country: country || null })
            .eq('email', email)
            .select()
            .single();

        if (error) throw error;
        return res.json({ success: true, user: data });
    } catch (error) {
        console.error('Error updating profile:', error);
        return res.status(500).json({ success: false, message: 'Failed to update profile.' });
    }
});

// Send Email Change OTP
app.post('/api/send-email-change-otp', async (req, res) => {
    try {
        const { email, newEmail } = req.body;

        if (!email || !newEmail) {
            return res.status(400).json({ success: false, message: 'Both email addresses are required.' });
        }

        // Check if new email already exists
        const { data: existing } = await supabase
            .from('users')
            .select('email')
            .eq('email', newEmail)
            .single();

        if (existing) {
            return res.status(400).json({ success: false, message: 'This email is already in use.' });
        }

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        tempOtpStore[newEmail] = otp;

        // Send OTP to new email
        const mailOptions = {
            from: process.env.ZOHO_EMAIL || 'info@fplscout.name.ng',
            to: newEmail,
            subject: 'Verify Your New Email - FPL Scout',
            html: `
                <h2>Email Verification</h2>
                <p>You requested to change your email address. Please use the following OTP to verify:</p>
                <h3 style="color: #0070f3; letter-spacing: 2px;">${otp}</h3>
                <p>This OTP will expire in 10 minutes.</p>
                <p>If you didn't request this, ignore this email.</p>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`Email change OTP sent to ${newEmail}`);
        return res.json({ success: true, message: 'OTP sent to your new email.' });
    } catch (error) {
        console.error('Error sending email change OTP:', error);
        return res.status(500).json({ success: false, message: 'Failed to send OTP.' });
    }
});

// Verify Email Change OTP
app.post('/api/verify-email-change-otp', async (req, res) => {
    try {
        const { email, newEmail, otp } = req.body;

        if (!email || !newEmail || !otp) {
            return res.status(400).json({ success: false, message: 'All fields are required.' });
        }

        const storedOtp = tempOtpStore[newEmail];
        if (!storedOtp || storedOtp !== otp.replace(/\s+/g, '').trim()) {
            return res.status(400).json({ success: false, message: 'Invalid OTP.' });
        }

        // Update email in Supabase
        const { data, error } = await supabase
            .from('users')
            .update({ email: newEmail })
            .eq('email', email)
            .select()
            .single();

        if (error) throw error;
        delete tempOtpStore[newEmail];

        return res.json({ success: true, user: data });
    } catch (error) {
        console.error('Error verifying email change OTP:', error);
        return res.status(500).json({ success: false, message: 'Failed to verify OTP.' });
    }
});

// Change Password (with current password verification)
app.post('/api/change-password', async (req, res) => {
    try {
        const { email, currentPassword, newPassword } = req.body;

        if (!email || !currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'All fields are required.' });
        }

        // Verify current password
        const { data: user, error: queryError } = await supabase
            .from('users')
            .select('password')
            .eq('email', email)
            .single();

        if (queryError || !user || user.password !== currentPassword) {
            return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
        }

        // Update password
        const { error: updateError } = await supabase
            .from('users')
            .update({ password: newPassword })
            .eq('email', email);

        if (updateError) throw updateError;
        return res.json({ success: true, message: 'Password updated successfully!' });
    } catch (error) {
        console.error('Error changing password:', error);
        return res.status(500).json({ success: false, message: 'Failed to change password.' });
    }
});

// Cancel Subscription
app.post('/api/cancel-subscription', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required.' });
        }

        const { data, error } = await supabase
            .from('users')
            .update({ is_premium: false })
            .eq('email', email)
            .select()
            .single();

        if (error) throw error;

        // Send cancellation confirmation email
        const mailOptions = {
            from: process.env.ZOHO_EMAIL || 'info@fplscout.name.ng',
            to: email,
            subject: 'Subscription Cancelled - FPL Scout',
            html: `
                <h2>Subscription Cancelled</h2>
                <p>Your premium subscription has been cancelled successfully.</p>
                <p>You will retain access to premium features until the end of your current billing cycle.</p>
                <p>We'd love to have you back! If you have any feedback, please let us know.</p>
                <p><a href="https://fplscout.name.ng/contact">Contact Support</a></p>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`Subscription cancelled for ${email}`);
        return res.json({ success: true, message: 'Subscription cancelled.' });
    } catch (error) {
        console.error('Error cancelling subscription:', error);
        return res.status(500).json({ success: false, message: 'Failed to cancel subscription.' });
    }
});

// Renew Subscription
app.post('/api/renew-subscription', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required.' });
        }

        const { data, error } = await supabase
            .from('users')
            .update({ is_premium: true })
            .eq('email', email)
            .select()
            .single();

        if (error) throw error;

        // Send renewal confirmation email
        const mailOptions = {
            from: process.env.ZOHO_EMAIL || 'info@fplscout.name.ng',
            to: email,
            subject: 'Subscription Renewed - FPL Scout',
            html: `
                <h2>Subscription Renewed Successfully</h2>
                <p>Your premium subscription has been renewed for another month.</p>
                <p>You now have full access to all premium features:</p>
                <ul>
                    <li>League Spy - Real-time rival tracking</li>
                    <li>Advanced Transfer Recommendations</li>
                    <li>Real-time Player Predictions</li>
                    <li>Real-time Rival Alerts</li>
                    <li>Priority Support</li>
                </ul>
                <p>Thank you for your support!</p>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`Subscription renewed for ${email}`);
        return res.json({ success: true, message: 'Subscription renewed successfully!' });
    } catch (error) {
        console.error('Error renewing subscription:', error);
        return res.status(500).json({ success: false, message: 'Failed to renew subscription.' });
    }
});

// Send Support Request
app.post('/api/send-support-request', async (req, res) => {
    try {
        const { email, name, issue, message } = req.body;

        if (!email || !name || !issue || !message) {
            return res.status(400).json({ success: false, message: 'All fields are required.' });
        }

        // Send support request to support email
        const mailOptions = {
            from: process.env.ZOHO_EMAIL || 'info@fplscout.name.ng',
            to: 'info@fplscout.name.ng',
            subject: `Support Request: ${issue} - from ${name}`,
            html: `
                <h2>New Support Request</h2>
                <p><strong>From:</strong> ${name}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Issue Type:</strong> ${issue}</p>
                <hr>
                <p><strong>Message:</strong></p>
                <p>${message.replace(/\n/g, '<br>')}</p>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`Support request received from ${name} (${email}) - Issue: ${issue}`);
        return res.json({ success: true, message: 'Support request sent successfully!' });
    } catch (error) {
        console.error('Error sending support request:', error);
        return res.status(500).json({ success: false, message: 'Failed to send support request.' });
    }
});

// ── Save User Data (Watchlist, Synced Team) ───────────────────
app.post('/api/save-user-data', async (req, res) => {
  try {
    const { email, watchlist, syncedTeam, preferences } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email required' });
    }

    // Update user's user_data table with watchlist and synced team
    const { data, error } = await supabase
      .from('user_data')
      .update({
        watchlist: watchlist || null,
        synced_team: syncedTeam || null,
        preferences: preferences || null,
        updated_at: new Date().toISOString()
      })
      .eq('email', email);

    if (error) {
      console.error('Supabase update error:', error);
      // Try to insert if row doesn't exist
      const { error: insertError } = await supabase
        .from('user_data')
        .insert([{
          email,
          watchlist: watchlist || null,
          synced_team: syncedTeam || null,
          preferences: preferences || null
        }]);
      
      if (insertError) {
        return res.status(500).json({ success: false, message: insertError.message });
      }
    }

    res.json({ success: true, message: 'User data saved successfully' });
  } catch (error) {
    console.error('Error saving user data:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── Load User Data (Watchlist, Synced Team) ───────────────────
app.post('/api/user-data', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email required' });
    }

    // Fetch user's watchlist and synced team from Supabase
    const { data, error } = await supabase
      .from('user_data')
      .select('watchlist, synced_team, preferences')
      .eq('email', email)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Supabase query error:', error);
      return res.status(500).json({ success: false, message: error.message });
    }

    if (data) {
      res.json({
        success: true,
        watchlist: data.watchlist || [],
        syncedTeam: data.synced_team || null,
        preferences: data.preferences || {}
      });
    } else {
      // No data found for this user yet
      res.json({
        success: true,
        watchlist: [],
        syncedTeam: null,
        preferences: {}
      });
    }
  } catch (error) {
    console.error('Error loading user data:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── SPA fallback ──────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// =========================================================
// 🚀 WATCHLIST ENDPOINTS (PASTED HERE)
// =========================================================

// 1. SAVE OR REMOVE WATCHED TEAM FROM CLOUD STORAGE
app.post('/api/watchlist', async (req, res) => {
    try {
        const { userId, managerId, teamData, action } = req.body;

        if (!userId || !managerId) {
            return res.status(400).json({ success: false, message: 'Missing user ID or manager ID' });
        }

        if (action === 'remove') {
            // Delete from database matching both keys
            const { error } = await supabase
                .from('watchlists')
                .delete()
                .eq('user_id', userId)
                .eq('player_id', String(managerId)); // Cast to string to prevent type issues

            if (error) throw error;
            return res.json({ success: true, message: 'Removed successfully' });
        } else {
            // Insert full serialized JSON payload or individual columns matching your table setup
            const { error } = await supabase
                .from('watchlists')
                .insert([{ 
                    user_id: userId, 
                    player_id: String(managerId),
                    // If you added extra columns in your migration, you can map them here. 
                    // Otherwise, we store it safely as a row pointer.
                }]);

            if (error) throw error;
            return res.json({ success: true, message: 'Added successfully' });
        }
    } catch (err) {
        console.error('Watchlist endpoint crash:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

// =========================================================
// 🔒 SECURED WATCHLIST RETRIEVAL ENDPOINT (WITH MIDDLEWARE)
// =========================================================
app.get('/api/watchlist/:userId', requirePremiumUser, async (req, res) => {
    try {
        const { userId } = req.params;
        const { data, error } = await supabase
            .from('watchlists')
            .select('*')
            .eq('user_id', userId);

        if (error) throw error;
        return res.json({ success: true, watchlist: data });
    } catch (err) {
        console.error('Secured watchlist retrieval crash:', err);
        return res.status(500).json({ success: false, watchlist: [] });
    }
});


// =========================================================
// 🚀 BACKEND PROXY ROUTE: Bypasses CORS blocks to fetch live exchange rates safely
// =========================================================
app.get('/api/exchange-rates', async (req, res) => {
    try {
        // Look closely: this has "api." and "/v1/latest" which is missing in your screenshot
        const apiResponse = await fetch('https://frankfurter.dev');
        
        if (!apiResponse.ok) {
            throw new Error('Frankfurter server responded with code: ' + apiResponse.status);
        }
        
        const data = await apiResponse.json();
        return res.json({ success: true, rates: data.rates });
    } catch (err) {
        console.error('Backend exchange lookup crash:', err);
        return res.status(500).json({ success: false, message: 'Currency lookup failure' });
    }
});

const crypto = require('crypto'); // Built-in Node.js module, no install needed

// 🚀 SECURED PAYSTACK BACKGROUND WEBHOOK RECEIVER
app.post('/api/paystack-webhook', async (req, res) => {
    try {
        // 1. PRODUCTION SECURITY: Validate the Paystack digital signature
        const hash = crypto
            .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
            .update(JSON.stringify(req.body))
            .digest('hex');

        // Block request instantly if the signature header doesn't match your secret key
        if (hash !== req.headers['x-paystack-signature']) {
            console.warn('Unauthorized payment spoof attempt blocked from IP:', req.ip);
            return res.status(401).json({ success: false, message: 'Invalid transaction signature token' });
        }

        const payload = req.body;

        // 2. Process a successfully captured subscription charge
        if (payload && payload.event === 'charge.success') {
            const customerEmail = payload.data.customer.email;
            const amountPaidInKobo = payload.data.amount;
            
            console.log(`Verified Paystack Payment capture for: ${customerEmail}. Amount: ₦${amountPaidInKobo / 100}`);

            // 3. DATABASE UPDATE: Automatically upgrade the specific profile row
            const { data, error } = await supabase
                .from('profiles') 
                .update({ 
                    subscription_status: 'Premium Member', 
                    premium_expiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // Sets a 30-day access window
                })
                .eq('email', customerEmail);

            if (error) {
                console.error("Database update failed inside secure webhook loop:", error);
                return res.status(500).json({ received: false });
            }

            console.log(`Account permissions unblocked for user: ${customerEmail}`);
        }

        // Return an immediate 200 OK so Paystack knows the message was successfully logged
        return res.status(200).json({ received: true });

    } catch (err) {
        console.error('Paystack webhook engine breakdown crash:', err);
        return res.status(500).json({ received: false });
    }
});

// =========================================================
// 🚀 PAYSTACK TRANSACTION INITIALIZATION ENDPOINT (FIXED)
// =========================================================
app.post('/api/initialize-payment', async (req, res) => {
    try {
        const { email, amount } = req.body;

        if (!email || !amount) {
            return res.status(400).json({ success: false, message: 'Missing email or amount' });
        }

        const amountInKobo = Math.round(parseFloat(amount) * 100);

        const response = await fetch('https://api.paystack.co/transaction/initialize', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + process.env.PAYSTACK_SECRET_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: email,
                amount: amountInKobo,
                callback_url: 'http://localhost:3000/account.html' 
            })
        });

        const data = await response.json();

        if (data.status) {
            return res.json({ success: true, authorization_url: data.data.authorization_url });
        } else {
            throw new Error(data.message || 'Paystack initialization failed');
        }

    } catch (err) {
        console.error('Paystack transaction crash:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
});
async function payWithPaystack() {
    if (!currentUser || !currentUser.email) return alert('Please log in first.');
    try {
        const res = await fetch('/api/initialize-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: currentUser.email, amount: 3000 })
        });
        const data = await res.json();
        if (data.success) window.location.href = data.authorization_url; // Redirects to Paystack
    } catch (e) { console.error(e); }
}

// =========================================================
// � WATCHLIST ACTIVITY TRACKING ENDPOINTS
// =========================================================

// Get rival activity snapshot (for change detection)
app.post('/api/watchlist/check-activity', async (req, res) => {
    try {
        let { userId, managerId, email } = req.body;
        
        // Allow email fallback when userId not present in client session
        if ((!userId || userId === null) && email) {
            try {
                const { data: userRow, error: uErr } = await supabase
                    .from('users')
                    .select('id')
                    .eq('email', email)
                    .single();
                if (userRow && userRow.id) userId = userRow.id;
            } catch (e) {
                console.warn('Unable to resolve user id from email:', e.message);
            }
        }

        const localOnly = !userId;

        if (!managerId) {
            return res.status(400).json({ success: false, message: 'Missing managerId' });
        }

        if (localOnly) {
            console.log('Watchlist activity check: local-only user (no userId), returning current activity without DB writes');
            try {
                const currentGW = cache.get('current_gw') || 1;
                const [picks, transfers, history] = await Promise.all([
                    fplFetch(`/entry/${managerId}/event/${currentGW}/picks/`),
                    fplFetch(`/entry/${managerId}/transfers/`),
                    fplFetch(`/entry/${managerId}/history/`)
                ]);

                return res.json({
                    success: true,
                    isLocal: true,
                    currentActivity: {
                        captains: picks,
                        transfers: transfers,
                        chips: history?.chips || []
                    }
                });
            } catch (e) {
                console.error('Error fetching FPL data for local-only activity check:', e);
                return res.status(500).json({ success: false, message: e.message });
            }
        }
        
        // Fetch current activity from FPL API
        const currentGW = cache.get('current_gw') || 1;
        
        try {
            const [picks, transfers, history] = await Promise.all([
                fplFetch(`/entry/${managerId}/picks/${currentGW}/`),
                fplFetch(`/entry/${managerId}/transfers/`),
                fplFetch(`/entry/${managerId}/history/`)
            ]);
            
            // Get or create activity record
            let { data: activityRecord, error: fetchError } = await supabase
                .from('watchlist_activity')
                .select('*')
                .eq('user_id', userId)
                .eq('rival_manager_id', managerId)
                .single();
            
            if (!activityRecord) {
                // Create new activity record
                const { data: newRecord } = await supabase
                    .from('watchlist_activity')
                    .insert({
                        user_id: userId,
                        rival_manager_id: managerId,
                        rival_name: 'Rival',
                        last_checked_at: new Date(),
                        recent_transfers: transfers || [],
                        recent_captains: [picks],
                        recent_chips: history?.chips || []
                    })
                    .select()
                    .single();
                
                return res.json({
                    success: true,
                    isNew: true,
                    currentActivity: {
                        captains: picks,
                        transfers: transfers,
                        chips: history?.chips || []
                    }
                });
            }
            
            // Check for changes
            const changes = {
                newTransfers: [],
                newCaptain: null,
                newChip: null
            };
            
            // Check for new transfers
            const lastTransferCount = activityRecord.last_transfer_count || 0;
            if (transfers && transfers.length > lastTransferCount) {
                changes.newTransfers = transfers.slice(0, transfers.length - lastTransferCount);
            }
            
            // Check for captain change
            if (picks && activityRecord.last_captain_element_id !== picks.picks[0]?.element) {
                changes.newCaptain = picks.picks[0]?.element;
            }
            
            // Check for new chips
            if (history?.chips && history.chips.length > 0) {
                const lastChip = history.chips[0];
                if (activityRecord.last_chip_used !== lastChip.name || activityRecord.last_chip_used_gw !== lastChip.event) {
                    changes.newChip = lastChip;
                }
            }
            
            // Update activity record
            await supabase
                .from('watchlist_activity')
                .update({
                    last_checked_at: new Date(),
                    last_transfer_count: transfers ? transfers.length : 0,
                    last_captain_element_id: picks?.picks[0]?.element,
                    last_chip_used: history?.chips?.[0]?.name,
                    last_chip_used_gw: history?.chips?.[0]?.event,
                    recent_transfers: transfers || [],
                    recent_captains: [picks],
                    recent_chips: history?.chips || []
                })
                .eq('user_id', userId)
                .eq('rival_manager_id', managerId);
            
            return res.json({
                success: true,
                hasChanges: Object.values(changes).some(c => c),
                changes: changes,
                currentActivity: {
                    captains: picks,
                    transfers: transfers,
                    chips: history?.chips || []
                }
            });
            
        } catch (fplError) {
            console.error('FPL API error:', fplError);
            throw fplError;
        }
        
    } catch (error) {
        console.error('Error checking watchlist activity:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get all watched rivals for a user
app.get('/api/watchlist/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const { data: activities, error } = await supabase
            .from('watchlist_activity')
            .select('*')
            .eq('user_id', userId)
            .order('last_checked_at', { ascending: false });
        
        if (error) throw error;
        
        res.json({ success: true, activities: activities || [] });
    } catch (error) {
        console.error('Error fetching watchlist:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Record sent notification
app.post('/api/watchlist/notify-sent', async (req, res) => {
    try {
        const { userId, managerId, type, timestamp } = req.body;
        
        const { data: activity, error: fetchError } = await supabase
            .from('watchlist_activity')
            .select('notifications_sent')
            .eq('user_id', userId)
            .eq('rival_manager_id', managerId)
            .single();
        
        if (activity) {
            const notifications = activity.notifications_sent || [];
            notifications.push({
                type: type, // 'transfer', 'captain', 'chip'
                sentAt: timestamp
            });
            
            await supabase
                .from('watchlist_activity')
                .update({
                    notifications_sent: notifications,
                    last_notified_at: new Date()
                })
                .eq('user_id', userId)
                .eq('rival_manager_id', managerId);
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error recording notification:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// =========================================================
// �🛠️ SERVER LIFECYCLE INITIALIZATION BLOCK (CORRECTED)
// =========================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('FPL Scout running on http://localhost:' + PORT);
});

module.exports = app;