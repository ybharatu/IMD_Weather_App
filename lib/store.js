const redisStore = require('./redisStore');
const fileStore = require('./subscriptionStore');

function getBackend() {
    if (redisStore.isAvailable()) {
        return redisStore;
    }
    return fileStore;
}

async function upsert(args) {
    return getBackend().upsert(args);
}

async function deactivate(email) {
    return getBackend().deactivate(email);
}

async function getByEmail(email) {
    return getBackend().getByEmail(email);
}

async function listActive() {
    return getBackend().listActive();
}

async function markSent(email) {
    return getBackend().markSent(email);
}

async function count() {
    return getBackend().count();
}

module.exports = { upsert, deactivate, getByEmail, listActive, markSent, count };
