import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Test 1: Check env vars
    const hasClientId = !!process.env.GOOGLE_CLIENT_ID
    const hasClientSecret = !!process.env.GOOGLE_CLIENT_SECRET
    const hasRefreshToken = !!process.env.GOOGLE_REFRESH_TOKEN
    const hasFolderId = !!process.env.GOOGLE_DRIVE_FOLDER_ID

    if (!hasClientId || !hasClientSecret || !hasRefreshToken) {
      return NextResponse.json({
        ok: false,
        error: 'Missing env vars',
        hasClientId,
        hasClientSecret,
        hasRefreshToken,
        hasFolderId
      })
    }

    // Test 2: Try to refresh OAuth token
    const body = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
      grant_type: 'refresh_token',
    })

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })

    const tokenData = await tokenResponse.json()

    if (!tokenResponse.ok) {
      return NextResponse.json({
        ok: false,
        error: 'OAuth refresh failed',
        status: tokenResponse.status,
        tokenData
      })
    }

    if (!tokenData.access_token) {
      return NextResponse.json({
        ok: false,
        error: 'No access token in response',
        tokenData
      })
    }

    // Test 3: Try a simple Drive API call (list items in root folder)
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID
    const driveUrl = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents&fields=files(id,name)&pageSize=5`
    
    const driveResponse = await fetch(driveUrl, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    })

    const driveData = await driveResponse.json()

    if (!driveResponse.ok) {
      return NextResponse.json({
        ok: false,
        error: 'Drive API call failed',
        status: driveResponse.status,
        driveData
      })
    }

    // Test 4: Verify we can access at least one migrated photo file ID from photos-meta.json.
    // If this fails with 404, it usually means the refresh token is for the wrong Google account
    // OR it was generated with an overly narrow scope (e.g. drive.file).
    let samplePhotoCheck: any = { ok: true, checked: false }
    try {
      const storePath = path.join(process.cwd(), 'photos-meta.json')
      const raw = await fs.readFile(storePath, 'utf8')
      const meta = JSON.parse(raw)
      const urls: string[] = []
      for (const v of Object.values(meta)) {
        if (v && typeof v === 'object' && typeof (v as any).migratedToDriveUrl === 'string') {
          urls.push((v as any).migratedToDriveUrl)
        }
        if (urls.length >= 20) break
      }

      const getId = (u: string) => {
        try {
          return new URL(u).searchParams.get('id')
        } catch {
          return null
        }
      }

      const fileId = urls.map(getId).find(Boolean)
      if (fileId) {
        samplePhotoCheck.checked = true
        const fileUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType&supportsAllDrives=true`
        const fileRes = await fetch(fileUrl, {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        })

        if (!fileRes.ok) {
          const text = await fileRes.text()
          samplePhotoCheck.ok = false
          samplePhotoCheck.status = fileRes.status
          samplePhotoCheck.response = text
          samplePhotoCheck.hint =
            'Your token can talk to Drive, but cannot access your photo file IDs. This usually means GOOGLE_REFRESH_TOKEN was generated with drive.file scope or for a different Google account than the one that owns the photos. Regenerate a refresh token with https://www.googleapis.com/auth/drive.readonly using scripts/get-google-token.js, then update Vercel env and redeploy.'
        }
      }
    } catch (e: any) {
      samplePhotoCheck = { ok: false, checked: false, error: e?.message || String(e) }
    }

    return NextResponse.json({
      ok: true,
      message: 'All checks passed!',
      fileCount: driveData.files?.length || 0,
      sampleFiles: driveData.files?.slice(0, 3).map((f: any) => f.name) || [],
      samplePhotoCheck
    })

  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      error: 'Unexpected error',
      message: error.message,
      stack: error.stack
    })
  }
}
