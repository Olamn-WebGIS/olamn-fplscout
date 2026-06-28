const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const router = express.Router();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const SPORTMONKS_API_TOKEN = process.env.SPORTMONKS_API_TOKEN || null;
const SPORTMONKS_BASE = 'https://api.sportmonks.com/v3/football';
const DEFAULT_LOGO = '/images/default-logo.png';
const SPORTMONKS_CACHE_FILE = path.join(__dirname, '..', 'supabase', 'sportmonks-logo-cache.json');
const SPORTMONKS_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

let sportmonksCache = {};

function loadSportmonksCache() {
  try {
    if (!fs.existsSync(SPORTMONKS_CACHE_FILE)) return;
    const raw = fs.readFileSync(SPORTMONKS_CACHE_FILE, 'utf8');
    sportmonksCache = raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.debug('Could not load Sportmonks logo cache:', err.message || err);
    sportmonksCache = {};
  }
}

function saveSportmonksCache() {
  try {
    fs.writeFileSync(SPORTMONKS_CACHE_FILE, JSON.stringify(sportmonksCache, null, 2), 'utf8');
  } catch (err) {
    console.warn('Could not save Sportmonks logo cache:', err.message || err);
  }
}

function normalizeTeamKey(teamName) {
  return String(teamName || '').trim().toLowerCase();
}

function getCachedLogo(teamName) {
  if (!teamName) return null;
  const key = normalizeTeamKey(teamName);
  const entry = sportmonksCache[key];
  if (!entry) return null;
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    delete sportmonksCache[key];
    saveSportmonksCache();
    return null;
  }
  return entry.url;
}

function setCachedLogo(teamName, url) {
  if (!teamName || !url) return;
  const key = normalizeTeamKey(teamName);
  sportmonksCache[key] = { url, expiresAt: Date.now() + SPORTMONKS_CACHE_TTL_MS };
  saveSportmonksCache();
}

loadSportmonksCache();

async function fetchTeamLogo(teamName) {
  if (!SPORTMONKS_API_TOKEN || !teamName) return DEFAULT_LOGO;

  const cached = getCachedLogo(teamName);
  if (cached) return cached;

  try {
    const q = encodeURIComponent(teamName);
    const searchUrl = `${SPORTMONKS_BASE}/teams/search/${q}?api_token=${SPORTMONKS_API_TOKEN}`;
    let res = await axios.get(searchUrl, { timeout: 5000 });

    let candidate = null;
    if (res && res.data) {
      if (res.data.data && Array.isArray(res.data.data) && res.data.data.length) {
        candidate = res.data.data[0];
      } else if (Array.isArray(res.data) && res.data.length) {
        candidate = res.data[0];
      } else if (res.data.data && res.data.data.attributes) {
        candidate = res.data.data;
      }
    }

    if (candidate && candidate.image_path) {
      const imagePath = candidate.image_path;
      const result = imagePath.startsWith('http') ? imagePath : (imagePath.startsWith('/') ? imagePath : `/${imagePath}`);
      setCachedLogo(teamName, result);
      return result;
    }

    const listUrl = `${SPORTMONKS_BASE}/teams?search=${q}&api_token=${SPORTMONKS_API_TOKEN}`;
    res = await axios.get(listUrl, { timeout: 5000 });
    if (res && res.data && res.data.data && Array.isArray(res.data.data) && res.data.data.length) {
      const cand = res.data.data[0];
      if (cand && cand.image_path) {
        const imagePath = cand.image_path;
        const result = imagePath.startsWith('http') ? imagePath : (imagePath.startsWith('/') ? imagePath : `/${imagePath}`);
        setCachedLogo(teamName, result);
        return result;
      }
    }
  } catch (err) {
    console.debug('Sportmonks fetch failed for', teamName, err && err.message ? err.message : err);
  }

  setCachedLogo(teamName, DEFAULT_LOGO);
  return DEFAULT_LOGO;
}

// Middleware to require admin session (reuse pattern from server.js)
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
  const crypto = require('crypto');
  const ADMIN_SECRET = process.env.ADMIN_PASSWORD || process.env.ADMIN_PASS || (process.env.NODE_ENV !== 'production' ? 'admin123' : null);
  if (!ADMIN_SECRET) return null;
  return crypto.createHmac('sha256', ADMIN_SECRET).update('admin_session').digest('hex');
}

function requireAdminSession(req, res, next) {
  const authHeader = req.headers.authorization;
  const tokenFromHeader = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const tokenFromCookie = parseCookies(req).admin_session;
  const token = tokenFromHeader || tokenFromCookie;
  const expected = createAdminSessionToken();

  if (!expected || !token || token !== expected) {
    return res.status(401).json({ success: false, message: 'Unauthorized. Admin session is required.' });
  }
  next();
}

// List fixtures
router.get('/', async (req, res) => {
  try {
    const { data, error } = await db.from('fixtures').select('*').order('match_time', { ascending: true });
    if (error) return res.status(500).json({ success: false, message: error.message });
    return res.json({ success: true, fixtures: data });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Team logo preview endpoint for admin form
router.get('/team-logo', requireAdminSession, async (req, res) => {
  try {
    const teamName = req.query.teamName || req.query.name;
    if (!teamName) return res.status(400).json({ success: false, message: 'Team name is required.' });
    const url = await fetchTeamLogo(String(teamName));
    return res.json({ success: true, url });
  } catch (err) {
    console.error('Team logo preview failed:', err);
    return res.status(500).json({ success: false, message: 'Could not fetch logo preview.' });
  }
});

// Get single fixture
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { data, error } = await db.from('fixtures').select('*').eq('id', id).single();
    if (error) return res.status(404).json({ success: false, message: 'Not found' });
    return res.json({ success: true, fixture: data });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create fixture
router.post('/', requireAdminSession, async (req, res) => {
  try {
    const { home_team, away_team, match_time, live_link, logo_url, home_logo_url, away_logo_url, title, description } = req.body;
    if (!home_team || !away_team || !match_time) return res.status(400).json({ success: false, message: 'Missing required fields' });

    // Fetch logos from Sportmonks (only once during create). Use provided logos if supplied.
    const logoPromises = [
      home_logo_url ? Promise.resolve(home_logo_url) : fetchTeamLogo(home_team),
      away_logo_url ? Promise.resolve(away_logo_url) : fetchTeamLogo(away_team)
    ];
    const [homeLogo, awayLogo] = await Promise.all(logoPromises);

    const payload = {
      home_team,
      away_team,
      match_time,
      live_link: live_link || null,
      logo_url: logo_url || null,
      home_logo_url: homeLogo || DEFAULT_LOGO,
      away_logo_url: awayLogo || DEFAULT_LOGO,
      title: title || null,
      description: description || null
    };

    let insertResult;
    try {
      insertResult = await db.from('fixtures').insert([payload]).select().single();
    } catch (insErr) {
      const msg = insErr && insErr.message ? insErr.message : String(insErr);
      console.warn('Insert failed, attempting fallback if schema is missing columns:', msg);
      // If the error indicates the new logo columns don't exist yet, retry without them
      if (/home_logo_url|away_logo_url/.test(msg)) {
        const fallbackPayload = Object.assign({}, payload);
        delete fallbackPayload.home_logo_url;
        delete fallbackPayload.away_logo_url;
        try {
          insertResult = await db.from('fixtures').insert([fallbackPayload]).select().single();
        } catch (insErr2) {
          const msg2 = insErr2 && insErr2.message ? insErr2.message : String(insErr2);
          return res.status(500).json({ success: false, message: msg2 });
        }
      } else {
        return res.status(500).json({ success: false, message: msg });
      }
    }
    const { data, error } = insertResult || {};
    if (error) return res.status(500).json({ success: false, message: error.message });
    return res.json({ success: true, fixture: data });
  } catch (err) {
    console.error('Create fixture error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update fixture
router.put('/:id', requireAdminSession, async (req, res) => {
  try {
    const id = req.params.id;
    const { home_team, away_team, match_time, live_link, logo_url, home_logo_url, away_logo_url, title, description } = req.body;
    const updates = {};
    if (home_team) updates.home_team = home_team;
    if (away_team) updates.away_team = away_team;
    if (match_time) updates.match_time = match_time;
    if (typeof live_link !== 'undefined') updates.live_link = live_link;
    if (typeof logo_url !== 'undefined') updates.logo_url = logo_url;

    // If team names changed and no explicit logos provided, try to fetch updated logos
    if ((!home_logo_url && home_team) || (!away_logo_url && away_team)) {
      const logoPromises = [
        home_logo_url ? Promise.resolve(home_logo_url) : (home_team ? fetchTeamLogo(home_team) : Promise.resolve(null)),
        away_logo_url ? Promise.resolve(away_logo_url) : (away_team ? fetchTeamLogo(away_team) : Promise.resolve(null))
      ];
      const [hLogo, aLogo] = await Promise.all(logoPromises);
      if (hLogo) updates.home_logo_url = hLogo;
      if (aLogo) updates.away_logo_url = aLogo;
      if (typeof title !== 'undefined') updates.title = title;
      if (typeof description !== 'undefined') updates.description = description;
    } else {
      if (typeof home_logo_url !== 'undefined') updates.home_logo_url = home_logo_url;
      if (typeof away_logo_url !== 'undefined') updates.away_logo_url = away_logo_url;
      if (typeof title !== 'undefined') updates.title = title;
      if (typeof description !== 'undefined') updates.description = description;
    }

    const { data, error } = await db.from('fixtures').update(updates).eq('id', id).select().single();
    if (error) return res.status(500).json({ success: false, message: error.message });
    return res.json({ success: true, fixture: data });
  } catch (err) {
    console.error('Update fixture error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete fixture
router.delete('/:id', requireAdminSession, async (req, res) => {
  try {
    const id = req.params.id;
    const { data, error } = await db.from('fixtures').delete().eq('id', id).select().single();
    if (error) return res.status(500).json({ success: false, message: error.message });
    return res.json({ success: true, fixture: data });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
