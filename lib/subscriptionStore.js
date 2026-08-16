const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const STORE_PATH = path.join(DATA_DIR, 'subscriptions.json');

const DEFAULT_DATA = { version: 1, subscriptions: [] };

let data = null;
let writeQueue = Promise.resolve();

function normalizeEmail(email) {
    return String(email || '').toLowerCase().trim();
}

function ensureDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

function load() {
    if (data !== null) {
        return data;
    }

    try {
        data = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    } catch (err) {
        data = { ...DEFAULT_DATA, subscriptions: [] };
    }

    return data;
}

function save() {
    const snapshot = JSON.stringify(data, null, 2);
    writeQueue = writeQueue.then(() => {
        ensureDir();
        const tempPath = `${STORE_PATH}.tmp`;
        fs.writeFileSync(tempPath, snapshot);
        fs.renameSync(tempPath, STORE_PATH);
    });
    return writeQueue;
}

function getByEmail(email) {
    const normalized = normalizeEmail(email);
    return load().subscriptions.find(sub => sub.email === normalized) || null;
}

function upsert({ email, city }) {
    const normalized = normalizeEmail(email);
    const existing = getByEmail(normalized);

    if (existing) {
        existing.city = city;
        existing.active = true;
        existing.updatedAt = new Date().toISOString();
    } else {
        load().subscriptions.push({
            email: normalized,
            city,
            active: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastSentAt: null
        });
    }

    return save();
}

function deactivate(email) {
    const existing = getByEmail(email);
    if (!existing) {
        return Promise.resolve(false);
    }

    existing.active = false;
    existing.updatedAt = new Date().toISOString();
    return save().then(() => true);
}

function listActive() {
    return load().subscriptions.filter(sub => sub.active);
}

function markSent(email) {
    const existing = getByEmail(email);
    if (!existing) {
        return Promise.resolve();
    }

    existing.lastSentAt = new Date().toISOString();
    return save();
}

function count() {
    return load().subscriptions.length;
}

module.exports = {
    upsert,
    deactivate,
    getByEmail,
    listActive,
    markSent,
    count
};
