const http = require('http');
const { spawn } = require('child_process');

const CLIENT_ID = process.argv[2];
const CLIENT_SECRET = process.argv[3];

if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('Usage: node scripts/getGmailToken.js <CLIENT_ID> <CLIENT_SECRET>');
    process.exit(1);
}

const PORT = 8080;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;
const SCOPES = 'https://www.googleapis.com/auth/gmail.send';

const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth'
    + `?client_id=${encodeURIComponent(CLIENT_ID)}`
    + `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`
    + `&response_type=code`
    + `&scope=${encodeURIComponent(SCOPES)}`
    + `&access_type=offline`
    + `&prompt=consent`;

const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    if (url.pathname !== '/oauth2callback' || !url.searchParams.get('code')) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Missing auth code');
        return;
    }

    const code = url.searchParams.get('code');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h2>Got the code! You can close this tab.</h2>');
    server.close();

    exchangeCode(code);
});

function exchangeCode(code) {
    const params = new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code'
    });

    require('node-fetch')('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
    }).then(response => response.json()).then(data => {
        if (data.error) {
            console.error('Error:', JSON.stringify(data));
            process.exit(1);
        }
        console.log('\n=== Copy these into Render/.env ===\n');
        console.log(`GMAIL_CLIENT_ID=${CLIENT_ID}`);
        console.log(`GMAIL_CLIENT_SECRET=${CLIENT_SECRET}`);
        console.log(`GMAIL_REFRESH_TOKEN=${data.refresh_token}\n`);
        console.log(`(A one-time access_token/expiry was also returned, but the refresh token keeps you logged in permanently.)`);
        process.exit(0);
    }).catch(err => {
        console.error('Token exchange failed:', err.message);
        process.exit(1);
    });
}

server.listen(PORT, () => {
    console.log(`Opening browser for Google OAuth...\nRedirection URI: ${REDIRECT_URI}\n`);
    spawn('open', [authUrl]);
});