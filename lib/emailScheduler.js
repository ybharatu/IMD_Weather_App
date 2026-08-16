const cron = require('node-cron');

const { getStationId } = require('./cityLookup');
const { fetchCityWeather } = require('./imdScraper');
const { sendEmail, buildWeatherEmail, isConfigured } = require('./emailService');
const store = require('./subscriptionStore');

const EMAIL_TIME = process.env.EMAIL_TIME || '07:00';
const EMAIL_ENABLED = process.env.EMAIL_ENABLED !== 'false';
const EMAIL_TO = process.env.EMAIL_TO;
const EMAIL_CITY = process.env.EMAIL_CITY;
const IST_TIMEZONE = 'Asia/Kolkata';

let sendInProgress = false;

function toCronExpression(timeOrCron) {
    const value = String(timeOrCron || '').trim();
    if (/\s/.test(value) || value.includes('*')) {
        return value;
    }

    const match = value.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) {
        throw new Error(`Invalid EMAIL_TIME "${value}". Use HH:mm (e.g. 07:00)`);
    }

    const hour = Number.parseInt(match[1], 10);
    const minute = Number.parseInt(match[2], 10);
    if (hour > 23 || minute > 59) {
        throw new Error(`Invalid EMAIL_TIME "${value}". Use HH:mm (e.g. 07:00)`);
    }

    return `${minute} ${hour} * * *`;
}

function getISTDateKey(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: IST_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(date);

    const get = (type) => {
        const part = parts.find(p => p.type === type);
        return part ? part.value : '';
    };

    return `${get('year')}-${get('month')}-${get('day')}`;
}

function getISTMinutesOfDay() {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: IST_TIMEZONE,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(new Date());

    const get = (type) => {
        const part = parts.find(p => p.type === type);
        return part ? Number.parseInt(part.value, 10) : 0;
    };

    return get('hour') * 60 + get('minute');
}

function parseCronField(field) {
    if (/^\d+$/.test(field)) {
        const value = Number.parseInt(field, 10);
        return value < 60 ? value : null;
    }
    return null;
}

function parseCatchUpTime() {
    const value = String(EMAIL_TIME).trim();
    const hhmm = value.match(/^(\d{1,2}):(\d{2})$/);
    if (hhmm) {
        return Number.parseInt(hhmm[1], 10) * 60 + Number.parseInt(hhmm[2], 10);
    }

    const fields = value.split(/\s+/);
    if (fields.length >= 2) {
        const minute = parseCronField(fields[0]);
        const hour = parseCronField(fields[1]);
        if (minute != null && hour != null) {
            return hour * 60 + minute;
        }
    }

    return null;
}

function isSentToday(subscription, todayKey) {
    if (!subscription.lastSentAt) {
        return false;
    }
    return getISTDateKey(new Date(subscription.lastSentAt)) === todayKey;
}

function seedOwnerSubscription() {
    if (!EMAIL_TO || !EMAIL_CITY) {
        return;
    }
    store.upsert({ email: EMAIL_TO, city: EMAIL_CITY }).catch((err) => {
        console.error('[email] Failed to seed owner subscription:', err.message);
    });
}

async function sendToSubscription(subscription) {
    const stationId = getStationId(subscription.city);
    if (!stationId) {
        console.warn(`[email] No station found for city "${subscription.city}" — skipping ${subscription.email}`);
        return;
    }

    const data = await fetchCityWeather(stationId);
    const email = buildWeatherEmail(subscription.city, data);

    await sendEmail({
        to: subscription.email,
        subject: email.subject,
        html: email.html,
        text: email.text
    });

    await store.markSent(subscription.email);
    console.log(`[email] Sent to ${subscription.email} (${subscription.city})`);
}

async function sendToSubscriptions(subscriptions) {
    if (sendInProgress) {
        console.log('[email] Send already in progress — skipping');
        return { sent: 0, failed: 0, skipped: 1 };
    }

    if (!isConfigured()) {
        console.error('[email] SMTP not configured. Set SMTP_USER and SMTP_PASS in .env');
        return { sent: 0, failed: 0, skipped: 0 };
    }

    sendInProgress = true;

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    try {
        for (const subscription of subscriptions) {
            try {
                await sendToSubscription(subscription);
                sent += 1;
            } catch (err) {
                failed += 1;
                console.error(`[email] Failed for ${subscription.email}:`, err.message);
            }
        }
    } finally {
        sendInProgress = false;
    }

    console.log(`[email] Done — sent: ${sent}, failed: ${failed}, skipped: ${skipped}`);
    return { sent, failed, skipped };
}

async function sendWeatherEmailsNow() {
    const subscriptions = store.listActive();
    if (subscriptions.length === 0) {
        console.log('[email] No active subscriptions to email');
        return { sent: 0, failed: 0, skipped: 0 };
    }

    return sendToSubscriptions(subscriptions);
}

async function sendMissedEmailsIfDue() {
    if (!EMAIL_ENABLED) {
        console.log('[email] Scheduler disabled (EMAIL_ENABLED=false) — skipping catch-up');
        return;
    }

    if (!isConfigured()) {
        console.warn('[email] SMTP not configured — skipping catch-up');
        return;
    }

    const scheduledMinutes = parseCatchUpTime();
    if (scheduledMinutes == null) {
        console.log('[email] EMAIL_TIME not parseable for catch-up — skipping missed send');
        return;
    }

    if (getISTMinutesOfDay() < scheduledMinutes) {
        return;
    }

    const todayKey = getISTDateKey();
    const due = store.listActive().filter(sub => !isSentToday(sub, todayKey));

    if (due.length === 0) {
        console.log('[email] Catch-up: everyone already got today\'s email');
        return;
    }

    console.log(`[email] Catch-up: sending ${due.length} missed email(s)`);
    return sendToSubscriptions(due);
}

function startDailyScheduler() {
    if (!EMAIL_ENABLED) {
        console.log('[email] Scheduler disabled (EMAIL_ENABLED=false)');
        return null;
    }

    const cronExpression = toCronExpression(EMAIL_TIME);
    const task = cron.schedule(cronExpression, () => {
        sendWeatherEmailsNow().catch(err => {
            console.error('[email] Scheduled run failed:', err.message);
        });
    }, { timezone: IST_TIMEZONE });

    console.log(`[email] Daily scheduler started — cron "${cronExpression}" (${IST_TIMEZONE})`);
    return task;
}

module.exports = {
    startDailyScheduler,
    sendWeatherEmailsNow,
    sendMissedEmailsIfDue,
    seedOwnerSubscription,
    toCronExpression
};
