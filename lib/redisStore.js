const fetch = require('node-fetch');

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const KEY = 'subscriptions';

let available = null;

function isAvailable() {
    if (available !== null) {
        return available;
    }
    available = !!(UPSTASH_URL && UPSTASH_TOKEN);
    if (!available) {
        console.warn('[redis] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set — using file store');
    }
    return available;
}

async function redisCommand(command, ...args) {
    const body = [command, ...args];
    const res = await fetch(`${UPSTASH_URL}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${UPSTASH_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body),
        timeout: 10000
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Upstash error ${res.status}: ${text}`);
    }

    return res.json();
}

function normalizeEmail(email) {
    return String(email || '').toLowerCase().trim();
}

async function upsert({ email, city }) {
    const normalized = normalizeEmail(email);
    const now = new Date().toISOString();
    const existing = await getByEmail(normalized);

    let sub;
    if (existing) {
        sub = { ...existing, city, active: true, updatedAt: now };
    } else {
        sub = { email: normalized, city, active: true, createdAt: now, updatedAt: now, lastSentAt: null };
    }

    await redisCommand('HSET', KEY, normalized, JSON.stringify(sub));
    return sub;
}

async function deactivate(email) {
    const normalized = normalizeEmail(email);
    const existing = await getByEmail(normalized);
    if (!existing) {
        return false;
    }

    existing.active = false;
    existing.updatedAt = new Date().toISOString();
    await redisCommand('HSET', KEY, normalized, JSON.stringify(existing));
    return true;
}

async function getByEmail(email) {
    const normalized = normalizeEmail(email);
    const result = await redisCommand('HGET', KEY, normalized);
    if (!result || !result.result) {
        return null;
    }
    try {
        return JSON.parse(result.result);
    } catch {
        return null;
    }
}

async function listActive() {
    const result = await redisCommand('HGETALL', KEY);
    if (!result || !result.result) {
        return [];
    }

    const entries = result.result;
    const subs = [];
    for (let i = 0; i < entries.length; i += 2) {
        try {
            const sub = JSON.parse(entries[i + 1]);
            if (sub.active) {
                subs.push(sub);
            }
        } catch {
            // skip corrupted entries
        }
    }
    return subs;
}

async function markSent(email) {
    const normalized = normalizeEmail(email);
    const existing = await getByEmail(normalized);
    if (!existing) {
        return;
    }

    existing.lastSentAt = new Date().toISOString();
    existing.updatedAt = existing.lastSentAt;
    await redisCommand('HSET', KEY, normalized, JSON.stringify(existing));
}

async function count() {
    const result = await redisCommand('HLEN', KEY);
    return (result && result.result) || 0;
}

module.exports = {
    isAvailable,
    upsert,
    deactivate,
    getByEmail,
    listActive,
    markSent,
    count
};
