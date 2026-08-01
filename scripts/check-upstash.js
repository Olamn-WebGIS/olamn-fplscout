#!/usr/bin/env node
require('dotenv').config();

async function main() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.error('Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN in environment.');
    process.exit(2);
  }

  try {
    const { Redis } = require('@upstash/redis');
    const redis = new Redis({ url, token });

    const testKey = `fplscout:upstash_test:${Date.now()}`;
    const testVal = `ok-${Date.now()}`;

    console.log('Setting test key...');
    await redis.set(testKey, testVal, { ex: 60 });
    console.log('Getting test key...');
    const got = await redis.get(testKey);
    // Ensure client is cleanly disconnected before exiting
    async function safeDisconnect() {
      try {
        if (redis && typeof redis.disconnect === 'function') await redis.disconnect();
        else if (redis && typeof redis.quit === 'function') await redis.quit();
      } catch (e) {
        // ignore
      }
    }

    if (got === testVal) {
      console.log('✅ Upstash connectivity OK — value:', got);
      await safeDisconnect();
      return;
    } else {
      console.error('❌ Upstash returned unexpected value:', got);
      await safeDisconnect();
      return;
    }
  } catch (err) {
    console.error('Error connecting to Upstash:', err && err.message ? err.message : err);
    // Attempt to disconnect if possible to avoid libuv assertions on Windows
    try { if (err && typeof err.redis?.disconnect === 'function') await err.redis.disconnect(); } catch (_){ }
    return;
  }
}

main();
