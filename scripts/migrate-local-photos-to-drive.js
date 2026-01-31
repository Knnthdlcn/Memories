const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';

let tokenCache = null;

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  raw.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  });
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name} in .env.local`);
  }
  return value;
}

async function getAccessToken() {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.accessToken;
  }

  const body = new URLSearchParams({
    client_id: requireEnv('GOOGLE_CLIENT_ID'),
    client_secret: requireEnv('GOOGLE_CLIENT_SECRET'),
    refresh_token: requireEnv('GOOGLE_REFRESH_TOKEN'),
    grant_type: 'refresh_token',
  });

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to refresh access token: ${text}`);
  }

  const data = await response.json();
  const accessToken = data.access_token;
  const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 3600;

  if (!accessToken) {
    throw new Error('Missing access token from Google OAuth response');
  }

  tokenCache = {
    accessToken,
    expiresAt: Date.now() + expiresIn * 1000,
  };

  return accessToken;
}

function buildUrl(base, pathname, params) {
  const url = new URL(pathname, base);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) url.searchParams.set(key, value);
    });
  }
  return url.toString();
}

async function driveFetch(url, init = {}) {
  const token = await getAccessToken();
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}

async function driveFetchJson(url, init = {}) {
  const response = await driveFetch(url, init);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Drive API error: ${response.status} ${text}`);
  }
  return response.json();
}

async function findFolderId(parentId, name) {
  const safeName = name.replace(/'/g, "\\'");
  const listUrl = buildUrl(DRIVE_API_BASE, '/files', {
    q: `name='${safeName}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`,
    fields: 'files(id, name)',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  });
  const res = await driveFetchJson(listUrl);
  const first = res.files && res.files[0];
  return first ? first.id : null;
}

async function ensureFolder(parentId, name) {
  const existingId = await findFolderId(parentId, name);
  if (existingId) return existingId;
  const createUrl = buildUrl(DRIVE_API_BASE, '/files', {
    supportsAllDrives: 'true',
    fields: 'id',
  });
  const created = await driveFetchJson(createUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
  });
  return created.id;
}

async function makePublic(fileId) {
  const url = buildUrl(DRIVE_API_BASE, `/files/${fileId}/permissions`, {
    supportsAllDrives: 'true',
  });
  await driveFetchJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  });
}

function getDirectUrl(fileId) {
  return `https://drive.google.com/uc?export=view&id=${fileId}`;
}

async function readMeta() {
  const metaPath = path.join(process.cwd(), 'photos-meta.json');
  try {
    const raw = await fsp.readFile(metaPath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function writeMeta(store) {
  const metaPath = path.join(process.cwd(), 'photos-meta.json');
  const tmp = `${metaPath}.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(store, null, 2), 'utf8');
  await fsp.rename(tmp, metaPath);
}

async function* walk(dir) {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else {
      yield full;
    }
  }
}

function inferDateFromPathOrStat(filePath) {
  const rel = path.relative(path.join(process.cwd(), 'photos'), filePath).split(path.sep);
  if (rel.length >= 2) {
    const year = rel[0];
    const month = rel[1];
    if (/^\d{4}$/.test(year) && /^\d{2}$/.test(month)) {
      return new Date(`${year}-${month}-01T00:00:00.000Z`);
    }
  }
  const st = fs.statSync(filePath);
  return st.mtime instanceof Date ? st.mtime : new Date();
}

async function main() {
  loadEnv();
  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!rootFolderId) {
    console.error('Missing GOOGLE_DRIVE_FOLDER_ID in .env.local');
    process.exit(1);
  }

  const meta = await readMeta();
  const photosRoot = path.join(process.cwd(), 'photos');

  if (!fs.existsSync(photosRoot)) {
    console.log('No local photos/ folder found. Nothing to migrate.');
    return;
  }

  let uploaded = 0;
  for await (const filePath of walk(photosRoot)) {
    const ext = path.extname(filePath).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'].includes(ext)) continue;

    const date = inferDateFromPathOrStat(filePath);
    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const folderName = `${year}-${month}`;

    const targetFolderId = await ensureFolder(rootFolderId, folderName);

    const filename = path.basename(filePath);
    const mimeTypeMap = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.avif': 'image/avif',
    };
    const mimeType = mimeTypeMap[ext] || 'application/octet-stream';

    const buffer = await fsp.readFile(filePath);
    const boundary = `----memories-${Date.now()}`;
    const multipartBody = Buffer.concat([
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from('Content-Type: application/json; charset=UTF-8\r\n\r\n'),
      Buffer.from(JSON.stringify({ name: filename, parents: [targetFolderId] })),
      Buffer.from(`\r\n--${boundary}\r\n`),
      Buffer.from(`Content-Type: ${mimeType}\r\n\r\n`),
      buffer,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const uploadUrl = buildUrl(DRIVE_UPLOAD_BASE, '/files', {
      uploadType: 'multipart',
      supportsAllDrives: 'true',
      fields: 'id',
    });

    const response = await driveFetchJson(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body: multipartBody,
    });

    const fileId = response.id;
    if (!fileId) continue;
    await makePublic(fileId);

    const directUrl = getDirectUrl(fileId);
    meta[directUrl] = {
      dateOverride: date.toISOString(),
      updatedAt: new Date().toISOString(),
    };

    uploaded += 1;
    if (uploaded % 10 === 0) {
      console.log(`Uploaded ${uploaded} photos...`);
      await writeMeta(meta);
    }
  }

  await writeMeta(meta);
  console.log(`Done. Uploaded ${uploaded} photos to Google Drive.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
