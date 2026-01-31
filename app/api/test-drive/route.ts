import { NextResponse } from 'next/server'

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

    // Test 3: Try a simple Drive API call (list files in root folder)
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

    return NextResponse.json({
      ok: true,
      message: 'All checks passed!',
      fileCount: driveData.files?.length || 0,
      sampleFiles: driveData.files?.slice(0, 3).map((f: any) => f.name) || []
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
