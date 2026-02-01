const fs = require('fs');
const path = require('path');
const readline = require('readline');

function loadEnvFile(p) {
  try {
    const txt = fs.readFileSync(p, 'utf8');
    for (const line of txt.split(/\r?\n/)) {
      const l = line.trim();
      if (!l || l.startsWith('#')) continue;
      const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      let v = m[2];
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      // Don't override values already provided by the shell.
      if (process.env[m[1]] == null) process.env[m[1]] = v;
    }
  } catch {
    // ignore
  }
}

// Allow running the script without manually exporting env vars.
// NOTE: Next.js loads .env.local automatically, but plain `node` scripts do not.
loadEnvFile(path.resolve(process.cwd(), '.env'));
loadEnvFile(path.resolve(process.cwd(), '.env.local'));

// Uses OAuth Client credentials from environment variables.
// IMPORTANT:
// - Use drive.readonly so the token can READ existing Drive files.
// - Include drive.file so uploads/permissions still work in admin routes.
// The narrower drive.file-only scope can lead to 404 "File not found" for files not created/opened by this app.

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required (set it in .env.local or your shell)`);
  return v;
}

const CLIENT_ID = requireEnv('GOOGLE_CLIENT_ID');
const CLIENT_SECRET = requireEnv('GOOGLE_CLIENT_SECRET');
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth2callback';

const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file',
];

const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authUrl.searchParams.set('client_id', CLIENT_ID);
authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('scope', SCOPES.join(' '));
authUrl.searchParams.set('access_type', 'offline');
authUrl.searchParams.set('prompt', 'consent');

// Optional: nudge Google to use the intended account.
// This doesn't guarantee selection, but helps a lot when multiple accounts are logged in.
if (process.env.GOOGLE_DRIVE_USER_EMAIL) {
  authUrl.searchParams.set('login_hint', process.env.GOOGLE_DRIVE_USER_EMAIL);
}

console.log('\n🔐 STEP 1: Authorize this app by visiting this URL:\n');
console.log(authUrl);
console.log('\n📝 STEP 2: After authorization, copy the CODE from the URL and paste it here:\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('Enter the code: ', async (code) => {
  try {
    const body = new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
      code: code.trim(),
    });

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text);
    }

    const tokens = await response.json();
    console.log('\n✅ SUCCESS! Add these to your .env.local file:\n');
    console.log(`GOOGLE_CLIENT_ID=${CLIENT_ID}`);
    console.log(`GOOGLE_CLIENT_SECRET=${CLIENT_SECRET}`);
    console.log(`GOOGLE_REDIRECT_URI=${REDIRECT_URI}`);

    if (!tokens.refresh_token) {
      console.log('\n⚠️  Google did NOT return a refresh_token. This usually means you already granted consent before.');
      console.log('Fix: Go to https://myaccount.google.com/permissions and remove this app, then run this script again.');
      console.log('Also make sure you click through the consent screen (prompt=consent) and you are logged into the correct Google account.\n');
    } else {
      console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
    }
    console.log('\n');
  } catch (error) {
    console.error('❌ Error retrieving tokens:', error.message);
  }
  rl.close();
});
