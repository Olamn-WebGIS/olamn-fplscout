const express = require('express');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const { normalizeFixtureBatch } = require('./fixtures-utils');

const router = express.Router();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const DEFAULT_LOGO = '/images/default-logo.png';

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
    const { home_team, away_team, match_time, live_link, home_logo_url, away_logo_url, title, description } = req.body;
    if (!home_team || !away_team || !match_time) return res.status(400).json({ success: false, message: 'Missing required fields' });

    const payload = {
      home_team,
      away_team,
      match_time,
      live_link: live_link || null,
      home_logo_url: home_logo_url || null,
      away_logo_url: away_logo_url || null,
      title: title || null,
      description: description || null
    };

    let insertResult;
    try {
      // Try inserting, and iteratively remove columns mentioned in schema errors and retry.
      let attemptPayload = Object.assign({}, payload);
      while (true) {
        try {
          insertResult = await db.from('fixtures').insert([attemptPayload]).select().single();
          break; // success
        } catch (insErr) {
          const msg = insErr && insErr.message ? insErr.message : String(insErr);
          console.warn('Insert attempt failed:', msg);
          // Identify problematic column names and remove them if present, else rethrow
          if (/home_logo_url/.test(msg) && Object.prototype.hasOwnProperty.call(attemptPayload, 'home_logo_url')) {
            delete attemptPayload.home_logo_url;
            continue;
          }
          if (/away_logo_url/.test(msg) && Object.prototype.hasOwnProperty.call(attemptPayload, 'away_logo_url')) {
            delete attemptPayload.away_logo_url;
            continue;
          }
          if (/title/.test(msg) && Object.prototype.hasOwnProperty.call(attemptPayload, 'title')) {
            delete attemptPayload.title;
            continue;
          }
          if (/description/.test(msg) && Object.prototype.hasOwnProperty.call(attemptPayload, 'description')) {
            delete attemptPayload.description;
            continue;
          }
          // If we reach here, error isn't a known missing-column problem — return it
          throw insErr;
        }
      }
    } catch (finalErr) {
      const msg = finalErr && finalErr.message ? finalErr.message : String(finalErr);
      return res.status(500).json({ success: false, message: msg });
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
    const { home_team, away_team, match_time, live_link, home_logo_url, away_logo_url, title, description } = req.body;
    const updates = {};
    if (home_team) updates.home_team = home_team;
    if (away_team) updates.away_team = away_team;
    if (match_time) updates.match_time = match_time;
    if (typeof live_link !== 'undefined') updates.live_link = live_link;
    if (typeof home_logo_url !== 'undefined') updates.home_logo_url = home_logo_url || null;
    if (typeof away_logo_url !== 'undefined') updates.away_logo_url = away_logo_url || null;
    if (typeof title !== 'undefined') updates.title = title;
    if (typeof description !== 'undefined') updates.description = description;

    let updateResult;
    try {
      let attemptUpdates = Object.assign({}, updates);
      while (true) {
        try {
          updateResult = await db.from('fixtures').update(attemptUpdates).eq('id', id).select().single();
          break;
        } catch (upErr) {
          const msg = upErr && upErr.message ? upErr.message : String(upErr);
          console.warn('Update attempt failed:', msg);
          if (/home_logo_url/.test(msg) && Object.prototype.hasOwnProperty.call(attemptUpdates, 'home_logo_url')) {
            delete attemptUpdates.home_logo_url; continue;
          }
          if (/away_logo_url/.test(msg) && Object.prototype.hasOwnProperty.call(attemptUpdates, 'away_logo_url')) {
            delete attemptUpdates.away_logo_url; continue;
          }
          if (/title/.test(msg) && Object.prototype.hasOwnProperty.call(attemptUpdates, 'title')) {
            delete attemptUpdates.title; continue;
          }
          if (/description/.test(msg) && Object.prototype.hasOwnProperty.call(attemptUpdates, 'description')) {
            delete attemptUpdates.description; continue;
          }
          throw upErr;
        }
      }
    } catch (finalUpErr) {
      const msg = finalUpErr && finalUpErr.message ? finalUpErr.message : String(finalUpErr);
      return res.status(500).json({ success: false, message: msg });
    }
    const { data, error } = updateResult || {};
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

// Replace all fixtures in one batch
router.post('/replace-all', requireAdminSession, async (req, res) => {
  try {
    const fixtures = normalizeFixtureBatch(req.body?.fixtures || []);
    if (!Array.isArray(req.body?.fixtures) || !fixtures.length) {
      return res.status(400).json({ success: false, message: 'Provide at least one valid fixture to replace the existing list.' });
    }

    const { error: clearError } = await db.from('fixtures').delete().neq('id', 0);
    if (clearError) {
      return res.status(500).json({ success: false, message: clearError.message });
    }

    const { data, error } = await db.from('fixtures').insert(fixtures).select();
    if (error) return res.status(500).json({ success: false, message: error.message });

    return res.json({ success: true, fixtures: data, replaced: true });
  } catch (err) {
    console.error('Replace fixtures error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
