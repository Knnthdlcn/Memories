const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { google } = require('googleapis');

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

function getDriveClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });
  return google.drive({ version: 'v3', auth: oauth2Client });
}

async function findFolderId(drive, parentId, name) {
  const res = await drive.files.list({
    q: `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`,
    fields: 'files(id, name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const first = res.data.files && res.data.files[0];
  return first ? first.id : null;
}

async function ensureFolder(drive, parentId, name) {
  const existingId = await findFolderId(drive, parentId, name);
  if (existingId) return existingId;
  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
    supportsAllDrives: true,
  });
  return created.data.id;
}

async function makePublic(drive, fileId) {
  await drive.permissions.create({
    fileId,
    requestBody: { role: 'reader', type: 'anyone' },
    supportsAllDrives: true,
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

  const drive = getDriveClient();
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

    const targetFolderId = await ensureFolder(drive, rootFolderId, folderName);

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

    const stream = fs.createReadStream(filePath);
    const response = await drive.files.create({
      requestBody: {
        name: filename,
        parents: [targetFolderId],
      },
      media: { mimeType, body: stream },
      fields: 'id',
      supportsAllDrives: true,
    });

    const fileId = response.data.id;
    if (!fileId) continue;
    await makePublic(drive, fileId);

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
