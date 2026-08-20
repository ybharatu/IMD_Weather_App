const express = require('express');
const path = require('path');
const dns = require('dns');
require('dotenv').config();

dns.setDefaultResultOrder('ipv4first');

const { getStationId, getStationName } = require('./lib/cityLookup');
const { fetchCityWeather } = require('./lib/imdScraper');
const { sendEmail, buildConfirmationEmail, isConfigured, describeTransport } = require('./lib/emailService');
const store = require('./lib/subscriptionStore');
const { startDailyScheduler, sendWeatherEmailsNow, sendMissedEmailsIfDue, seedOwnerSubscription } = require('./lib/emailScheduler');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'assets')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'assets/views', 'index.html'));
});

app.get('/api/health', (req, res) => {
    res.json({ ok: true });
});

app.get('/api/email/check', async (req, res) => {
    try {
        const result = await sendMissedEmailsIfDue() || {};
        res.json({ ok: true, checked: true, sent: result.sent || 0, failed: result.failed || 0 });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

app.get('/api/weather/:city', async (req, res) => {
    const { city } = req.params;

    const stationId = getStationId(city);

    if (!stationId) {
        return res.status(404).json({ error: `City "${city}" not found in IMD station list` });
    }

    try {
        const data = await fetchCityWeather(stationId);
        data.city = getStationName(stationId) || data.city;
        return res.json(data);
    } catch (err) {
        return res.status(502).json({ error: err.message });
    }
});

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.post('/api/subscribe', async (req, res) => {
    const email = String(req.body && req.body.email || '').trim();
    const city = String(req.body && req.body.city || '').trim();

    if (!EMAIL_REGEX.test(email)) {
        return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    if (!city) {
        return res.status(400).json({ error: 'Please enter a city' });
    }

    if (!getStationId(city)) {
        return res.status(400).json({ error: `City "${city}" not found in IMD station list` });
    }

    try {
        await store.upsert({ email, city });

        const confirmation = buildConfirmationEmail(city);
        if (isConfigured()) {
            sendEmail({
                to: email,
                subject: confirmation.subject,
                html: confirmation.html,
                text: confirmation.text
            }).catch(err => console.error('[subscribe] Confirmation email failed:', err.message));
        } else {
            console.warn('[subscribe] SMTP not configured — confirmation email not sent');
        }

        return res.json({ success: true, message: `Subscribed to daily weather for ${city}` });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to subscribe. Please try again.' });
    }
});

app.post('/api/unsubscribe', async (req, res) => {
    const email = String(req.body && req.body.email || '').trim();

    if (!EMAIL_REGEX.test(email)) {
        return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    const removed = await store.deactivate(email);
    return res.json({
        success: removed,
        message: removed
            ? 'You have been unsubscribed from daily weather emails'
            : 'No subscription found for that email'
    });
});

if (process.argv.includes('--send-now')) {
    sendWeatherEmailsNow().then((result) => {
        console.log(`Result: ${JSON.stringify(result)}`);
        process.exit(0);
    });
} else {
    seedOwnerSubscription();
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
        startDailyScheduler();
        console.log(`[email] Transport: ${describeTransport()}`);
        sendMissedEmailsIfDue().catch(err => {
            console.error('[email] Catch-up check failed:', err.message);
        });
    });
}