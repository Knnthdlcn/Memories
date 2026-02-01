const fs = require('fs');

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
      process.env[m[1]] = v;
    }
  } catch {
    // ignore
  }
}

loadEnvFile('.env');
loadEnvFile('.env.local');

const meta = JSON.parse(fs.readFileSync('photos-meta.json', 'utf8'));

function getId(u) {
  try {
    return new URL(u).searchParams.get('id');
  } catch {
    return null;
  }
}

const ids = [];
for (const v of Object.values(meta)) {
  if (v && typeof v === 'object' && typeof v.migratedToDriveUrl === 'string') {
    const id = getId(v.migratedToDriveUrl);
    if (id) ids.push(id);
  }
  if (ids.length >= 25) break;
}

async function main() {
  console.log('Testing IDs:', ids.slice(0, 5));

  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    grant_type: 'refresh_token',
  });

  const tr = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const td = await tr.json();
  if (!tr.ok) {
    console.error('token refresh failed', tr.status, td);
    process.exit(1);
  }

  const token = td.access_token;
  console.log('token ok');

  for (const id of ids.slice(0, 10)) {
    const url = `https://www.googleapis.com/drive/v3/files/${id}?fields=id,name,mimeType&supportsAllDrives=true`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const t = await r.text();
    console.log(id, r.status, t.slice(0, 160).replace(/\s+/g, ' '));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
