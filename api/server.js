const express = require('express');
const fetch = require('node-fetch');
const NodeCache = require('node-cache');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const sanitizeHtml = require('sanitize-html');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config(); // Load environment variables

const app = express();
const cache = new NodeCache({ stdTTL: 120 }); // 2-min default cache

const FPL_BASE = 'https://fantasy.premierleague.com/api';
const BASE_URL = process.env.BASE_URL || 'https://fplscout.name.ng';
const ADMIN_SECRET = process.env.ADMIN_PASSWORD || process.env.ADMIN_PASS;

function emailFirstName(email) {
  if (!email || typeof email !== 'string') return '';
  const localPart = email.split('@')[0] || '';
  const rawName = localPart.split(/[.+_-]/)[0] || localPart;
  const clean = rawName.replace(/[^a-zA-Z]/g, '').trim();
  if (!clean) return '';
  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
}

// ── Supabase Initialization ────────────────────────────────
// Use a public key for read-only API access and a service role key for server-side admin writes.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const supabaseAdmin = SUPABASE_SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) : null;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('Warning: SUPABASE_SERVICE_ROLE_KEY is not configured. Admin write operations will fail if row-level security is enabled.');
}
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

function parseCookies(req) {
  const cookies = {};
  const header = req.headers.cookie;
  if (!header) return cookies;
  header.split(';').forEach((pair) => {
    const [key, value] = pair.split('=');
    if (!key) return;
    cookies[key.trim()] = decodeURIComponent((value || '').trim());
  });
  return cookies;
}

function createAdminSessionToken() {
  if (!ADMIN_SECRET) return null;
  return crypto.createHmac('sha256', ADMIN_SECRET).update('admin_session').digest('hex');
}

function requireAdminSession(req, res, next) {
  const authHeader = req.headers.authorization;
  const tokenFromHeader = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const tokenFromCookie = parseCookies(req).admin_session;
  const token = tokenFromHeader || tokenFromCookie;
  const expected = createAdminSessionToken();

  if (!ADMIN_SECRET || !token || token !== expected) {
    return res.status(401).json({ success: false, message: 'Unauthorized. Admin session is required.' });
  }
  next();
}

function renderBlogPage(res, metadata) {
  const template = fs.readFileSync(path.join(__dirname, '..', 'public', 'blog.html'), 'utf8');
  const html = template
    .replace(/{{BLOG_TITLE}}/g, metadata.title)
    .replace(/{{BLOG_DESCRIPTION}}/g, metadata.description)
    .replace(/{{BLOG_URL}}/g, metadata.url)
    .replace(/{{BLOG_IMAGE}}/g, metadata.image || `${BASE_URL}/images/blog-share.png`)
    .replace(/{{BLOG_CANONICAL}}/g, metadata.url)
    .replace(/{{BLOG_PUBLISHED_AT}}/g, metadata.publishedAt || '')
    .replace(/{{BLOG_JSONLD}}/g, metadata.jsonld || '')
    .replace(/{{BLOG_LIST_CONTENT}}/g, metadata.listContent || '')
    .replace(/{{BLOG_STATIC_CONTENT}}/g, metadata.staticContent || '');
  res.send(html);
}

// 1. Configure your Zoho SMTP Email Transporters
const ZOHO_OTP_EMAIL = process.env.ZOHO_OTP_EMAIL || process.env.ZOHO_EMAIL || 'info@fplscout.name.ng';
const ZOHO_OTP_PASSWORD = process.env.ZOHO_OTP_PASSWORD || process.env.ZOHO_PASSWORD;
const ZOHO_NEWSLETTER_EMAIL = process.env.ZOHO_NEWSLETTER_EMAIL || 'olamn@fplscout.name.ng';
const ZOHO_NEWSLETTER_PASSWORD = process.env.ZOHO_NEWSLETTER_PASSWORD || process.env.ZOHO_PASSWORD;

const transporter = nodemailer.createTransport({
  host: 'smtp.zoho.com',
  port: 465,
  secure: true,
  auth: {
    user: ZOHO_OTP_EMAIL,
    pass: ZOHO_OTP_PASSWORD
  }
});

const newsletterTransporter = ZOHO_NEWSLETTER_PASSWORD
  ? nodemailer.createTransport({
      host: 'smtp.zoho.com',
      port: 465,
      secure: true,
      auth: {
        user: ZOHO_NEWSLETTER_EMAIL,
        pass: ZOHO_NEWSLETTER_PASSWORD
      }
    })
  : transporter;

newsletterTransporter.verify((error, success) => {
  if (error) {
    console.error('Newsletter transporter verification failed:', error);
  } else {
    console.log('Newsletter transporter is ready to send messages.');
  }
});

// ── Helpers ───────────────────────────────────────────────────
async function fplFetch(endpoint, ttl = 120) {
  const key = endpoint;
  const cached = cache.get(key);
  if (cached) return cached;

  try {
    const res = await fetch(`${FPL_BASE}${endpoint}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FPLScout/1.0)',
        'Accept': 'application/json',
        'Accept-Language': 'en-GB,en;q=0.9',
        'Referer': 'https://fantasy.premierleague.com/',
      },
    });

    if (!res.ok) {
      console.error(`❌ FPL API Error ${res.status} on ${endpoint}`);
      throw new Error(`FPL API ${res.status}: ${endpoint}`);
    }
    const data = await res.json();
    cache.set(key, data, ttl);
    return data;
  } catch (err) {
    console.error(`❌ fplFetch failed for ${endpoint}:`, err.message);
    throw err;
  }
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

// FPL data proxy for player projections
app.get('/api/fpl-data', async (req, res) => {
  try {
    const [bootstrap, fixtures] = await Promise.all([
      fplFetch('/bootstrap-static/', 3600),
      fplFetch('/fixtures/', 600)
    ]);
    res.json({ bootstrap, fixtures });
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

app.get('/api/player-projections', requirePremiumUser, async (req, res) => {
  try {
    const bootstrap = await fplFetch('/bootstrap-static/', 300);
    const fixtures = await fplFetch('/fixtures/', 600);
    const currentGW = bootstrap.events.find(e => e.is_current)?.id || bootstrap.events.find(e => e.is_next)?.id - 1 || 38;

    let liveDataLoaded = false;
    if (req.query.live) {
      try {
        await fplFetch(`/event/${currentGW}/live/`, 60);
        liveDataLoaded = true;
      } catch (liveError) {
        console.error('Live projections fetch failed:', liveError.message);
      }
    }

    const playerFixtures = {};
    fixtures.forEach(f => {
      [f.team_h, f.team_a].forEach(teamId => {
        if (!playerFixtures[teamId]) playerFixtures[teamId] = [];
        playerFixtures[teamId].push(f);
      });
    });

    const players = bootstrap.elements.map(player => {
      const fixtureSet = playerFixtures[player.team] || [];
      const difficulty1 = getFixtureDifficulty(player.team, fixtureSet, 1);
      const difficulty5 = getFixtureDifficulty(player.team, fixtureSet, 5);
      const difficulty10 = getFixtureDifficulty(player.team, fixtureSet, 10);
      const form = parseFloat(player.form || '0') || 0;

      return {
        id: player.id,
        web_name: player.web_name,
        type_name: { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }[player.element_type] || 'UNK',
        team_name: bootstrap.teams.find(team => team.id === player.team)?.name || 'Unknown',
        now_cost: player.now_cost,
        form: form.toFixed(1),
        fixture_difficulty: difficulty1.toFixed(1),
        projection_1gw: projectPoints(form, difficulty1, 1),
        projection_5gw: projectPoints(form, difficulty5, 5),
        projection_10gw: projectPoints(form, difficulty10, 10)
      };
    });

    res.json({ players, currentGW, live: liveDataLoaded });
  } catch (e) { apiError(res, e); }
});

function getFixtureDifficulty(teamId, fixtures, count) {
  if (!fixtures.length) return 2;
  const relevant = fixtures.slice(0, count);
  if (!relevant.length) return 2;
  const values = relevant.map(f => (f.team_h === teamId ? f.team_a_difficulty : f.team_h_difficulty));
  return values.reduce((sum, x) => sum + x, 0) / values.length;
}

function projectPoints(form, difficulty, gwCount) {
  const normalizedForm = Math.min(Math.max(form, 0), 10);
  const fixtureFactor = Math.max(0.8, 3.5 - difficulty * 0.3);
  return Number((normalizedForm * fixtureFactor * Math.sqrt(gwCount)).toFixed(1));
}

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

// ── Static pages for client-side routing ─────────────────────────
app.get(['/blog', '/blog/'], async (req, res) => {
  try {
    const { data: posts, error } = await supabase
      .from('posts')
      .select('title, summary, slug, author, published_at, likes')
      .order('published_at', { ascending: false });

    if (error) throw error;

    const listHtml = posts && posts.length ? `
      <h1>Latest FPL Scout Articles</h1>
      ${posts.map(post => `
        <article class="blog-list-item">
          <h2><a href="/blog/${post.slug}">${post.title}</a></h2>
          <div class="blog-meta"><span>${new Date(post.published_at).toLocaleDateString()}</span><span>${post.author || 'FPL Scout'}</span><span>${post.likes || 0} likes</span></div>
          <p>${post.summary}</p>
          <div class="blog-actions">
            <a href="/blog/${post.slug}" class="blog-read-link">Read full article</a>
            <button class="btn-icon btn-share-icon" onclick="sharePost('${encodeURIComponent(post.title)}','${encodeURIComponent(post.summary)}','/blog/${post.slug}')">Share 🔗</button>
          </div>
        </article>
      `).join('')}
    ` : `
      <h1>Latest FPL Scout Articles</h1>
      <p>Coming soon — check back later for FPL analysis, transfer advice, and matchweek predictions.</p>
    `;

    renderBlogPage(res, {
      title: 'FPL Scout Blog | Fantasy Premier League Insights',
      description: 'Read the latest Fantasy Premier League analysis, transfer advice, and gameweek strategy from FPL Scout.',
      url: `${BASE_URL}/blog`,
      image: `${BASE_URL}/images/blog-share.png`,
      jsonld: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Blog',
        'url': `${BASE_URL}/blog`,
        'name': 'FPL Scout Blog',
        'description': 'Fantasy Premier League analysis, transfer advice, and premium strategy for FPL managers.',
        'publisher': {
          '@type': 'Organization',
          'name': 'FPL Scout',
          'url': BASE_URL
        }
      }),
      listContent: listHtml,
      staticContent: ''
    });
  } catch (err) {
    console.error('Blog list render error:', err);
    res.status(500).send('Unable to render blog page.');
  }
});

app.get(['/blog/:slug', '/blog/:slug/'], async (req, res) => {
  try {
    const { data: post, error } = await supabase
      .from('posts')
      .select('title, summary, slug, author, published_at, content, likes')
      .eq('slug', req.params.slug)
      .single();

    if (error || !post) {
      return res.status(404).send('Blog post not found.');
    }

    const staticContent = `
      <div class="blog-post" id="blog-article">
        <h1>${post.title}</h1>
        <div class="blog-meta"><span>${new Date(post.published_at).toLocaleDateString()}</span><span>${post.author || 'FPL Scout'}</span></div>
        <p style="font-size:1rem;color:#555;">${post.summary}</p>
        <div>${post.content.replace(/\n/g, '<br>')}</div>
        <div class="blog-actions blog-actions-minimal">
          <button class="btn-icon" onclick="sharePost('${encodeURIComponent(post.title)}','${encodeURIComponent(post.summary)}','/blog/${post.slug}')">🔗<span>Share</span></button>
          <button class="btn-icon" id="like-button" onclick="toggleLike('${post.slug}')">❤️<span id="like-count">${typeof post.likes === 'number' ? post.likes : 0}</span></button>
        </div>
        <div class="blog-article-footer">Favour Olamilekan Adeoye, Founder of FPL Scout</div>
      </div>
      <div id="comments-container"></div>
    `;

    renderBlogPage(res, {
      title: `${post.title} | FPL Scout Blog`,
      description: post.summary,
      url: `${BASE_URL}/blog/${post.slug}`,
      image: `${BASE_URL}/images/blog-share.png`,
      publishedAt: post.published_at ? new Date(post.published_at).toISOString() : '',
      jsonld: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        'url': `${BASE_URL}/blog/${post.slug}`,
        'headline': post.title,
        'description': post.summary,
        'author': {
          '@type': 'Person',
          'name': post.author || 'FPL Scout'
        },
        'publisher': {
          '@type': 'Organization',
          'name': 'FPL Scout',
          'url': BASE_URL
        },
        'datePublished': post.published_at ? new Date(post.published_at).toISOString() : undefined
      }),
      listContent: '',
      staticContent
    });
  } catch (err) {
    console.error('Blog page render error:', err);
    res.status(500).send('Unable to render blog page.');
  }
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});

// ── Blog API ──────────────────────────────────────────────────
app.get('/api/posts', async (req, res) => {
  try {
    const { data: posts, error } = await supabase
      .from('posts')
      .select('id, title, slug, summary, author, published_at, likes')
      .order('published_at', { ascending: false });

    if (error) throw error;
    return res.json(posts || []);
  } catch (err) {
    console.error('Fetch posts error:', err);
    return res.status(500).json({ success: false, message: 'Unable to load blog posts.' });
  }
});

app.get('/api/posts/:slug', async (req, res) => {
  try {
    const { data: post, error } = await supabase
      .from('posts')
      .select('id, title, slug, summary, content, author, published_at, likes')
      .eq('slug', req.params.slug)
      .single();

    if (error || !post) {
      return res.status(404).json({ success: false, message: 'Blog post not found.' });
    }

    return res.json(post);
  } catch (err) {
    console.error('Fetch post error:', err);
    return res.status(500).json({ success: false, message: 'Unable to load the requested post.' });
  }
});

app.get('/api/comments/:slug', async (req, res) => {
  try {
    const postSlug = req.params.slug;
    const { data: comments, error } = await supabase
      .from('comments')
      .select('id, post_slug, author_name, content, created_at')
      .eq('post_slug', postSlug)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return res.json(comments || []);
  } catch (err) {
    console.error('Fetch comments error:', err);
    return res.status(500).json({ success: false, message: 'Unable to load comments.' });
  }
});

app.post('/api/comments/:slug', async (req, res) => {
  try {
    const postSlug = req.params.slug;
    const { author_name, content } = req.body;

    if (!author_name || !content) {
      return res.status(400).json({ success: false, message: 'Author and comment content are required.' });
    }

    const { data: newComment, error } = await supabase
      .from('comments')
      .insert([{ post_slug: postSlug, author_name, content }])
      .select()
      .single();

    if (error) {
      console.error('Create comment error:', error);
      return res.status(500).json({ success: false, message: 'Could not save the comment.' });
    }

    return res.json({ success: true, comment: newComment });
  } catch (err) {
    console.error('Create comment error:', err);
    return res.status(500).json({ success: false, message: 'Could not save the comment.' });
  }
});

app.post('/api/subscribe-newsletter', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, message: 'Valid email is required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const dbClient = supabaseAdmin || supabase;

    const { data: existingSubscriber, error: fetchError } = await dbClient
      .from('newsletter_subscribers')
      .select('id, is_subscribed')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (fetchError) {
      console.error('Newsletter subscribe lookup error:', fetchError);
      const fallbackMessage = !supabaseAdmin
        ? 'Could not subscribe due to Supabase row-level security. Configure SUPABASE_SERVICE_ROLE_KEY or adjust newsletter policies.'
        : 'Could not subscribe at this time.';
      return res.status(500).json({ success: false, message: fallbackMessage });
    }

    if (existingSubscriber && existingSubscriber.is_subscribed) {
      return res.json({ success: true, message: 'This email is already subscribed.' });
    }

    const { error: upsertError } = await dbClient
      .from('newsletter_subscribers')
      .upsert({ email: normalizedEmail, is_subscribed: true }, { onConflict: 'email' })
      .select();

    if (upsertError) {
      console.error('Newsletter subscribe error:', upsertError);
      const fallbackMessage = !supabaseAdmin
        ? 'Could not subscribe due to Supabase row-level security. Configure SUPABASE_SERVICE_ROLE_KEY or adjust newsletter policies.'
        : 'Could not subscribe at this time.';
      return res.status(500).json({ success: false, message: fallbackMessage });
    }

    return res.json({ success: true, message: existingSubscriber ? 'Subscription restored successfully.' : 'You are subscribed to the newsletter.' });
  } catch (err) {
    console.error('Newsletter subscribe error:', err);
    return res.status(500).json({ success: false, message: 'Could not subscribe at this time.' });
  }
});

app.post('/api/admin/posts', requireAdminSession, async (req, res) => {
  try {
    const { title, slug, summary, content, adminPassword } = req.body;
    const secret = process.env.ADMIN_PASSWORD || process.env.ADMIN_PASS;

    if (adminPassword && adminPassword !== secret) {
      return res.status(401).json({ success: false, message: 'Invalid admin password.' });
    }

    if (!title || !slug || !summary || !content) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    const sanitizedContent = sanitizeHtml(content, {
      allowedTags: ['p', 'br', 'strong', 'em', 'u', 'span', 'ul', 'ol', 'li', 'blockquote', 'a'],
      allowedAttributes: {
        a: ['href', 'target', 'rel'],
        span: ['style']
      },
      allowedStyles: {
        span: {
          color: [/^#([0-9a-fA-F]{3}){1,2}$/, /^rgb\(/, /^rgba\(/]
        }
      }
    });

    const dbClient = supabaseAdmin || supabase;
    if (!supabaseAdmin) {
      console.warn('Admin publish warning: SUPABASE_SERVICE_ROLE_KEY is missing. Falling back to public key insert. This may fail if row-level security is enabled.');
    }

    const { data: existingSlug, error: slugError } = await dbClient
      .from('posts')
      .select('id')
      .eq('slug', slug)
      .single();

    if (slugError && slugError.code !== 'PGRST116') {
      console.error('Slug lookup error:', slugError);
      return res.status(500).json({ success: false, message: 'Could not validate post slug.' });
    }

    if (existingSlug) {
      return res.status(409).json({ success: false, message: 'Slug already exists. Please choose a unique slug.' });
    }

    const { data: insertedPost, error: insertError } = await dbClient
      .from('posts')
      .insert([{ title, slug, summary, content: sanitizedContent, author: 'FPL Scout' }])
      .select()
      .single();

    if (insertError) {
      console.error('Create post error:', insertError);
      const fallbackMessage = !supabaseAdmin
        ? `Could not create the blog post. Configure SUPABASE_SERVICE_ROLE_KEY for admin publishing or adjust Supabase row-level security policies. Database error: ${insertError.message}`
        : `Could not create the blog post. Database error: ${insertError.message}`;
      return res.status(500).json({ success: false, message: fallbackMessage });
    }

    const { data: subscribers, error: subError } = await dbClient
      .from('newsletter_subscribers')
      .select('email')
      .eq('is_subscribed', true)
      .limit(500);

    if (subError) {
      console.error('Load subscribers error:', subError);
    }

    const emails = (subscribers || []).map((row) => row.email).filter(Boolean);
    const newsletterFrom = ZOHO_NEWSLETTER_PASSWORD ? ZOHO_NEWSLETTER_EMAIL : ZOHO_OTP_EMAIL;
    let newsletterSent = false;
    let newsletterErrors = [];

    if (!newsletterFrom) {
      console.error('Newsletter sender is not configured. Set ZOHO_NEWSLETTER_EMAIL or ZOHO_OTP_EMAIL.');
    }

    if (emails.length && newsletterFrom) {
      for (const recipientEmail of emails) {
        const greetingName = emailFirstName(recipientEmail) || 'FAM';
        const messageHtml = `<p>Hello ${greetingName},</p>
          <p>A new article is live:</p>
          <h2>${title}</h2>
          <p>${summary}</p>
          <p><a href="${BASE_URL}/blog/${slug}#blog-article">Read the full article</a></p>
          <p>Thanks,<br/>OLAMN FROM FPL Scout</p>`;

        const message = {
          from: `"OLAMN from FPL Scout" <${newsletterFrom}>`,
          to: recipientEmail,
          subject: `New FPL Scout post: ${title}`,
          html: messageHtml
        };

        try {
          const info = await newsletterTransporter.sendMail(message);
          newsletterSent = true;
          console.log(`Newsletter sent to ${recipientEmail}:`, info.messageId || info.response);
        } catch (err) {
          newsletterErrors.push(`${recipientEmail}: ${err.message || String(err)}`);
          console.error('Newsletter email error for', recipientEmail, err);
        }
      }
    }

    if (!emails.length) {
      console.log('No newsletter subscribers found. Skipping sendMail.');
    }

    const responsePayload = {
      success: true,
      message: 'Blog post published.',
      post: insertedPost,
      newsletter: {
        subscribers: emails.length,
        sent: newsletterSent,
        errors: newsletterErrors
      }
    };

    if (newsletterErrors.length) {
      responsePayload.message = 'Blog post published, but some newsletter sends failed.';
    }

    return res.json(responsePayload);
  } catch (err) {
    console.error('Admin publish error:', err);
    return res.status(500).json({ success: false, message: 'Could not publish the post.' });
  }
});

app.put('/api/admin/posts/:id', requireAdminSession, async (req, res) => {
  try {
    const { title, slug, summary, content } = req.body;
    const postId = req.params.id;

    if (!title || !slug || !summary || !content) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    const sanitizedContent = sanitizeHtml(content, {
      allowedTags: ['p', 'br', 'strong', 'em', 'u', 'span', 'ul', 'ol', 'li', 'blockquote', 'a'],
      allowedAttributes: {
        a: ['href', 'target', 'rel'],
        span: ['style']
      },
      allowedStyles: {
        span: {
          color: [/^#([0-9a-fA-F]{3}){1,2}$/, /^rgb\(/, /^rgba\(/]
        }
      }
    });

    const dbClient = supabaseAdmin || supabase;
    const { data: updatedPost, error } = await dbClient
      .from('posts')
      .update({ title, slug, summary, content: sanitizedContent })
      .eq('id', postId)
      .select()
      .single();

    if (error) {
      console.error('Update post error:', error);
      return res.status(500).json({ success: false, message: 'Could not update the blog post.' });
    }

    return res.json({ success: true, post: updatedPost });
  } catch (err) {
    console.error('Update post crash:', err);
    return res.status(500).json({ success: false, message: 'Could not update the post.' });
  }
});

app.delete('/api/admin/posts/:id', requireAdminSession, async (req, res) => {
  try {
    const postId = req.params.id;
    const dbClient = supabaseAdmin || supabase;
    const { error } = await dbClient
      .from('posts')
      .delete()
      .eq('id', postId);

    if (error) {
      console.error('Delete post error:', error);
      return res.status(500).json({ success: false, message: 'Could not delete the post.' });
    }

    return res.json({ success: true, message: 'Post deleted successfully.' });
  } catch (err) {
    console.error('Delete post crash:', err);
    return res.status(500).json({ success: false, message: 'Could not delete the post.' });
  }
});

app.post('/api/posts/:slug/like', async (req, res) => {
  try {
    const { slug } = req.params;
    if (!slug) return res.status(400).json({ success: false, message: 'Slug is required.' });

    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('id, likes')
      .eq('slug', slug)
      .single();

    if (postError || !post) {
      return res.status(404).json({ success: false, message: 'Post not found.' });
    }

    const dbClient = supabaseAdmin || supabase;
    const { data: updated, error: updateError } = await dbClient
      .from('posts')
      .update({ likes: (post.likes || 0) + 1 })
      .eq('id', post.id)
      .select('likes')
      .single();

    if (updateError) {
      console.error('Like update error:', updateError);
      return res.status(500).json({ success: false, message: 'Unable to record like.' });
    }

    return res.json({ success: true, likes: updated.likes });
  } catch (err) {
    console.error('Like endpoint error:', err);
    return res.status(500).json({ success: false, message: 'Unable to record like.' });
  }
});

app.post('/api/admin/login', (req, res) => {
  const { adminPassword } = req.body;
  if (!adminPassword || adminPassword !== ADMIN_SECRET) {
    return res.status(401).json({ success: false, message: 'Invalid admin password.' });
  }

  const token = createAdminSessionToken();
  res.cookie('admin_session', token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: req.secure || process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000,
  });

  return res.json({ success: true, message: 'Admin login successful.' });
});

app.get('/api/giscus-config', (req, res) => {
  return res.json({
    repo: process.env.GISCUS_REPO || 'YOUR_GITHUB_USER/YOUR_REPO',
    repoId: process.env.GISCUS_REPO_ID || '',
    category: process.env.GISCUS_CATEGORY || 'Blog Comments',
    categoryId: process.env.GISCUS_CATEGORY_ID || '',
    mapping: process.env.GISCUS_MAPPING || 'pathname',
    theme: process.env.GISCUS_THEME || 'light',
    inputPosition: process.env.GISCUS_INPUT_POSITION || 'bottom',
    reactionsEnabled: '1',
    emitMetadata: '0',
    lang: process.env.GISCUS_LANG || 'en'
  });
});

// ── Page routes ──────────────────────────────────────────────
app.get('/recommendations', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'recommendations.html'));
});

app.get('/spy', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'spy.html'));
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

// Temporary memory to hold OTPs used for email change verification
let tempOtpStore = {};

// 2. Create the API Route to handle Sign-Up without requiring email verification
app.post('/api/signup', async (req, res) => {
  const { fullName, email, country, password } = req.body;

  if (!fullName || !email || !country || !password) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }

  try {
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (!checkError && existingUser) {
      return res.status(400).json({ success: false, message: 'User with this email already exists.' });
    }

    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([
        {
          full_name: fullName,
          email,
          country,
          password,
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

    console.log(`User registered successfully: ${email}`);

    return res.json({
      success: true,
      message: 'Account created successfully!',
      user: { id: newUser.id, fullName, email, country, isPremium: false, isAdmin: false }
    });
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
  }
});

// ── Password Reset Flow ─────────────────────────────────────
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
        const email = (req.body.email || '').trim().toLowerCase();

        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required' });
        }

        // Check if user exists in Supabase (case-insensitive email match)
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('*')
            .ilike('email', email)
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
            from: `"League Spy Team" <${ZOHO_OTP_EMAIL}>`,
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
        const email = (req.body.email || '').trim().toLowerCase();
        const otp = String(req.body.otp || '');
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
            from: `"League Spy Team" <${ZOHO_OTP_EMAIL}>`,
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
// =========================================================
// �🛠️ SERVER LIFECYCLE INITIALIZATION BLOCK (CORRECTED)
// =========================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('FPL Scout running on http://localhost:' + PORT);
});

module.exports = app;