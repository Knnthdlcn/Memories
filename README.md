# Photo Story — Setup

Basic steps:

1. Install dependencies

```bash
npm install
```

2. Copy environment

```bash
cp .env.example .env
# edit .env to set ADMIN_PASSWORD and HER_NAME
```

3. Run Prisma migrate & generate

```bash
npm run prisma:migrate
npm run prisma:generate
```

4. Ingest media (scans `public/media/photos` and `public/media/videos`)

```bash
npm run ingest
```

5. Run dev

```bash
npm run dev
```

Notes:
- The ingestion script extracts EXIF DateTimeOriginal when available and creates/upserts records in SQLite.
- For production on Vercel: static media should be in the `public` folder and DB may need an external provider; SQLite is fine for simple deployments but consider cloud DB for scaling.

Important notes and limitations:
- The `/api/media/upload` route writes files to the local `public/media` folder and uses SQLite. This works for local development but on serverless platforms (like Vercel) filesystem writes are ephemeral. For production, upload to external storage (S3, Cloud Storage, or Vercel-compatible storage) and use a persistent DB.
- The ingestion script uses `exif-parser` and `sharp` to create small placeholders. Sharp is a native dependency; allow time to install on first `npm install`.

