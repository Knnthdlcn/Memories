# Google Drive Integration - Complete! ✅

## What's Changed

### ✅ Photos are now stored in Google Drive
- New photos uploaded through the admin panel go directly to Google Drive
- Photos are publicly accessible via direct URLs
- No more large files in Git!

### ✅ Videos remain local
- Videos still stored in `/videos` folder
- Videos NOT pushed to Google Drive (as requested)

---

## How It Works

### When you upload a new photo:
1. Photo is uploaded via admin panel
2. File is sent to Google Drive API
3. File is stored in your "Memories Photos" folder
4. Public URL is generated automatically
5. Database stores the Google Drive file ID and URL

### When photos are displayed:
- Images load directly from Google Drive CDN
- Fast, global delivery
- No server storage needed

---

## Database Changes

New fields added to `Media` table:
- `driveFileId` - Google Drive unique file identifier
- `driveUrl` - Direct public URL to the image

---

## Next Steps

### 1. Test Upload (IMPORTANT!)
Try uploading a new photo through your admin panel to verify Google Drive integration works.

### 2. Push to GitHub (Now it will work!)
```bash
git add .
git commit -m "Add Google Drive integration for photos"
git push -u origin main
```

This will be fast now - no photos in Git!

### 3. Optional: Migrate Existing Photos
If you want to upload your existing local photos to Google Drive, you can:
1. Keep them local for now (both will work)
2. Or create a migration script to bulk upload them

---

## File Structure

```
Storybook/
├── photos/               # IGNORED by Git (local only)
├── videos/              # Videos stay local
├── google-credentials.json  # IGNORED by Git (secret!)
├── .env.local           # Contains GOOGLE_DRIVE_FOLDER_ID
└── src/lib/googleDrive.ts  # Google Drive helper functions
```

---

## Important Notes

⚠️ **Never commit google-credentials.json to Git!** (Already in .gitignore)
⚠️ **Keep your .env.local private** (Already in .gitignore)
✅ **Videos are NOT uploaded to Google Drive** (as requested)
✅ **Existing local photos will still work** until you migrate them

---

## Troubleshooting

### Error: "GOOGLE_DRIVE_FOLDER_ID not set"
- Make sure `.env.local` has: `GOOGLE_DRIVE_FOLDER_ID=your_folder_id`

### Error: "Access blocked: Authorization Error" / `Error 401: disabled_client`
This means the OAuth Client ID you’re using was **disabled** (or the entire Google Cloud project was disabled).

Fix:
1. Go to Google Cloud Console (make sure you select the project that owns your OAuth Client).
2. **APIs & Services → Credentials**
	- Confirm your OAuth Client ID exists and is not deleted.
3. **APIs & Services → OAuth consent screen**
	- Ensure it is configured.
	- If the app is in “Testing”, add your Google account as a **Test user**.
4. **APIs & Services → Library**
	- Enable **Google Drive API**.

If you can’t find that Client ID in any project you control, create a new OAuth Client ID and update:
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` in `.env.local` and Vercel.

### Photos not uploading / Drive 404 for file IDs
If `/api/test-drive` shows `samplePhotoCheck.status: 404`, the refresh token can talk to Drive but cannot access your photo file IDs.

Common causes:
- You generated `GOOGLE_REFRESH_TOKEN` with a narrow scope (drive.file-only).
- You generated the token under the wrong Google account (the photos are owned by another account).

Fix:
1. Revoke old consent: https://myaccount.google.com/permissions
2. Generate a new token: `npm run google:token`
3. Update `GOOGLE_REFRESH_TOKEN` in Vercel → redeploy.

Tip: set `GOOGLE_DRIVE_USER_EMAIL` in `.env.local` to help Google pick the right account during consent.

---

## Admin Panel Upload Flow

When you upload via admin:
1. Select photo file
2. Optionally set date/month
3. Click upload
4. ✨ File goes to Google Drive automatically
5. Image appears in your gallery with Google Drive URL

---

Ready to test! Upload a photo through your admin panel to see it in action! 🚀
