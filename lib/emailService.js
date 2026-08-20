const dns = require('dns');
const nodemailer = require('nodemailer');

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = Number.parseInt(process.env.SMTP_PORT || '465', 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM || SMTP_USER;
const EMAIL_ENABLED = process.env.EMAIL_ENABLED !== 'false';

function isConfigured() {
    return Boolean(SMTP_USER && SMTP_PASS);
}

function resolveIPv4(host) {
    return new Promise((resolve, reject) => {
        dns.resolve4(host, (err, addresses) => {
            if (err) {
                reject(err);
            } else if (!addresses || addresses.length === 0) {
                reject(new Error(`No IPv4 address found for ${host}`));
            } else {
                resolve(addresses[0]);
            }
        });
    });
}

async function createTransporter() {
    if (!isConfigured()) {
        throw new Error('SMTP not configured. Set SMTP_USER and SMTP_PASS in .env');
    }

    let host = SMTP_HOST;

    try {
        host = await resolveIPv4(SMTP_HOST);
    } catch (err) {
        console.warn(`[email] IPv4 lookup failed for ${SMTP_HOST}, falling back to hostname: ${err.message}`);
    }

    return nodemailer.createTransport({
        host,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465,
        tls: {
            servername: SMTP_HOST
        },
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS
        }
    });
}

function escapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function formatNumber(value, suffix) {
    return value != null ? `${value}${suffix}` : '--';
}

function getWarningColor(day) {
    const color = (day.warning_color || '').toLowerCase();
    if (['yellow', 'orange', 'red'].includes(color)) {
        return color;
    }

    const text = (day.warning || '').toLowerCase();
    if (text.includes('thunderstorm') || text.includes('heavy rain')) {
        return 'red';
    }
    if (text.includes('strong wind') || text.includes('heat')) {
        return 'orange';
    }
    return 'yellow';
}

function buildWeatherEmail(cityName, data) {
    const observed = data.observed || {};
    const forecast = data.forecast || [];
    const today = forecast[0] || {};

    const warnings = forecast.filter(day =>
        day.warning && day.warning.toLowerCase() !== 'no warning'
    );

    const warningRows = warnings.map(day => {
        const color = getWarningColor(day);
        return `<tr>
            <td style="padding:8px 12px;background:#fff3cd;border:1px solid ${color};border-radius:6px;color:#7a5c00;margin:4px 0;display:block;">
                <strong>${escapeHtml(day.date)}:</strong> ${escapeHtml(day.warning)}
            </td>
        </tr>`;
    }).join('');

    const forecastRows = forecast.map(day => {
        const color = getWarningColor(day);
        const warningBadge = day.warning && day.warning.toLowerCase() !== 'no warning'
            ? `<span style="display:inline-block;margin-top:4px;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;background:${color};color:#fff;">${escapeHtml(day.warning)}</span>`
            : '';
        return `<tr>
            <td style="padding:10px 12px;border-bottom:1px solid #eee;">${escapeHtml(day.date)}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #eee;">${formatNumber(day.max_temp, '°')} / ${formatNumber(day.min_temp, '°')}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #eee;">${escapeHtml(day.condition || 'N/A')}${warningBadge}</td>
        </tr>`;
    }).join('');

    const dateLabel = data.date || 'Today';
    const tempLabel = today.max_temp != null && today.min_temp != null
        ? `${today.max_temp}° / ${today.min_temp}°`
        : '--';

    const observedRows = [
        ['Rainfall (24h)', formatNumber(observed.rainfall, ' mm')],
        ['Humidity (08:30)', formatNumber(observed.humidity_0830, '%')],
        ['Humidity (17:30)', formatNumber(observed.humidity_1730, '%')],
        ['Sunrise', observed.sunrise || '--'],
        ['Sunset', observed.sunset || '--']
    ].map(([label, value]) => `
        <tr>
            <td style="padding:6px 12px;color:#666;">${label}</td>
            <td style="padding:6px 12px;font-weight:600;">${value}</td>
        </tr>
    `).join('');

    const html = `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;background:#f7f8fa;padding:24px;border-radius:12px;">
            <div style="text-align:center;margin-bottom:20px;">
                <h1 style="margin:0;color:#1a1a2e;font-size:24px;">${escapeHtml(cityName)} Weather</h1>
                <p style="margin:4px 0 0;color:#8892b0;font-size:14px;">India Meteorological Department · ${escapeHtml(dateLabel)}</p>
            </div>

            <div style="background:#ffffff;border-radius:10px;padding:20px;margin-bottom:16px;border:1px solid #e6e8eb;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <div style="font-size:16px;font-weight:700;color:#1a1a2e;">${escapeHtml(today.condition || 'N/A')}</div>
                        <div style="color:#8892b0;font-size:13px;margin-top:4px;">Max / Min</div>
                    </div>
                    <div style="font-size:40px;font-weight:700;color:#1a1a2e;">${tempLabel}</div>
                </div>
            </div>

            ${warnings.length > 0 ? `
            <div style="background:#ffffff;border-radius:10px;padding:16px 20px;margin-bottom:16px;border:1px solid #e6e8eb;">
                <h2 style="margin:0 0 8px;font-size:14px;color:#7a5c00;text-transform:uppercase;">⚠ Warnings</h2>
                ${warningRows}
            </div>` : ''}

            <div style="background:#ffffff;border-radius:10px;padding:16px 20px;margin-bottom:16px;border:1px solid #e6e8eb;">
                <h2 style="margin:0 0 8px;font-size:14px;color:#8892b0;text-transform:uppercase;">Observed (Past 24h)</h2>
                <table style="width:100%;border-collapse:collapse;font-size:14px;">${observedRows}</table>
            </div>

            <div style="background:#ffffff;border-radius:10px;padding:16px 20px;margin-bottom:16px;border:1px solid #e6e8eb;">
                <h2 style="margin:0 0 8px;font-size:14px;color:#8892b0;text-transform:uppercase;">7-Day Forecast</h2>
                <table style="width:100%;border-collapse:collapse;font-size:14px;">
                    <thead>
                        <tr style="text-align:left;color:#8892b0;font-size:12px;text-transform:uppercase;">
                            <th style="padding:8px 12px;">Date</th>
                            <th style="padding:8px 12px;">Max / Min</th>
                            <th style="padding:8px 12px;">Condition</th>
                        </tr>
                    </thead>
                    <tbody>${forecastRows}</tbody>
                </table>
            </div>

            <p style="text-align:center;color:#8892b0;font-size:12px;">
                Sent by IMD Weather App · <a href="${escapeHtml(process.env.APP_URL || '')}" style="color:#8892b0;">Unsubscribe</a>
            </p>
        </div>
    `;

    const text = [
        `${cityName} Weather — ${dateLabel}`,
        '',
        `Condition: ${today.condition || 'N/A'}`,
        `Max / Min: ${tempLabel}`,
        '',
        'Observed (Past 24h):',
        `  Rainfall: ${formatNumber(observed.rainfall, ' mm')}`,
        `  Humidity (08:30): ${formatNumber(observed.humidity_0830, '%')}`,
        `  Humidity (17:30): ${formatNumber(observed.humidity_1730, '%')}`,
        `  Sunrise: ${observed.sunrise || '--'}`,
        `  Sunset: ${observed.sunset || '--'}`,
        '',
        '7-Day Forecast:',
        ...forecast.map(day =>
            `  ${day.date}: ${formatNumber(day.max_temp, '°')} / ${formatNumber(day.min_temp, '°')} ${day.condition || 'N/A'}${day.warning && day.warning.toLowerCase() !== 'no warning' ? ` [${day.warning}]` : ''}`
        ),
        ''
    ].join('\n');

    return {
        subject: `Today's Weather: ${cityName}`,
        html,
        text
    };
}

function buildConfirmationEmail(cityName) {
    const html = `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;background:#f7f8fa;padding:24px;border-radius:12px;">
            <div style="background:#ffffff;border-radius:10px;padding:24px;border:1px solid #e6e8eb;">
                <h1 style="margin:0 0 12px;color:#1a1a2e;font-size:22px;">You're subscribed! ✅</h1>
                <p style="color:#444;font-size:14px;line-height:1.6;">
                    You'll receive the daily weather forecast for <strong>${escapeHtml(cityName)}</strong>
                    in your inbox every morning.
                </p>
                <p style="color:#8892b0;font-size:13px;line-height:1.6;">
                    To unsubscribe anytime, reply to this email or use the unsubscribe link in any weather email.
                </p>
            </div>
        </div>
    `;

    return {
        subject: `Daily weather subscription confirmed (${cityName})`,
        html,
        text: `You're subscribed! You'll receive the daily weather forecast for ${cityName} every morning.`
    };
}

async function sendEmail({ to, subject, html, text }) {
    if (!EMAIL_ENABLED) {
        console.log(`[email] Skipped (EMAIL_ENABLED=false): to=${to} subject="${subject}"`);
        return { skipped: true };
    }

    const transporter = await createTransporter();
    const info = await transporter.sendMail({
        from: `"IMD Weather" <${EMAIL_FROM}>`,
        to,
        subject,
        html,
        text
    });

    return info;
}

module.exports = {
    isConfigured,
    sendEmail,
    buildWeatherEmail,
    buildConfirmationEmail
};
