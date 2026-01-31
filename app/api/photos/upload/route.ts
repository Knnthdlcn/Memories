import { NextRequest } from 'next/server'
import path from 'path'
import { uploadToGoogleDrive } from '@/src/lib/googleDrive'
import { upsertPhotoMeta } from '@/src/lib/photosMeta'

function parseCustomDate(dateStr: string): Date {
  // Expect format like "2025-04" for month or "2025-04-15" for specific date
  const parsed = new Date(dateStr)
  if (!isNaN(parsed.getTime())) {
    return parsed
  }
  return new Date()
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const dateValue = formData.get('date') as string | null
    const monthValue = formData.get('month') as string | null

    if (!file) {
      return Response.json({ ok: false, error: 'No file provided' })
    }

    // Determine the target date
    let targetDate: Date
    if (dateValue) {
      targetDate = parseCustomDate(dateValue)
    } else if (monthValue) {
      // Month format: "YYYY-MM", set to first day of month
      targetDate = parseCustomDate(`${monthValue}-01`)
    } else {
      targetDate = new Date()
    }

    // Get file extension
    const originalName = file.name
    const ext = path.extname(originalName).toLowerCase()
    
    if (!['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'].includes(ext)) {
      return Response.json({ ok: false, error: 'Unsupported file type' })
    }

    // Generate unique filename with date info
    const year = targetDate.getFullYear()
    const month = String(targetDate.getMonth() + 1).padStart(2, '0')
    const timestamp = Date.now()
    const basename = path.basename(originalName, ext)
    const sanitizedBasename = basename.replace(/[^a-zA-Z0-9_-]/g, '_')
    const filename = `${year}_${month}_${sanitizedBasename}_${timestamp}${ext}`

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Determine MIME type
    const mimeTypeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.avif': 'image/avif',
    }
    const mimeType = mimeTypeMap[ext] || 'application/octet-stream'

    // Build Drive folder name: YYYY-MM or YYYY-MM-DD (single folder)
    const yearStr = String(targetDate.getFullYear())
    const monthStr = String(targetDate.getMonth() + 1).padStart(2, '0')
    const dayStr = String(targetDate.getDate()).padStart(2, '0')
    const folderName = dateValue ? `${yearStr}-${monthStr}-${dayStr}` : `${yearStr}-${monthStr}`
    const folderPath = [folderName]

    // Upload to Google Drive
    const { fileId, directUrl } = await uploadToGoogleDrive(buffer, filename, mimeType, { folderPath })

    // Return the Google Drive URL as the key
    const key = directUrl

    // Save metadata to photos-meta.json
    await upsertPhotoMeta(key, {
      dateOverride: targetDate.toISOString(),
      updatedAt: new Date().toISOString(),
    })

    return Response.json({ 
      ok: true, 
      key,
      filename,
      driveFileId: fileId,
      driveUrl: directUrl,
    })
  } catch (error: any) {
    console.error('Upload error:', error)
    return Response.json({ 
      ok: false, 
      error: error.message || 'Upload failed' 
    }, { status: 500 })
  }
}
