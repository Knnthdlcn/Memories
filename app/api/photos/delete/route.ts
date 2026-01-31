import { NextRequest } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { deletePhotoMeta } from '@/src/lib/photosMeta'
import { deleteFromGoogleDrive } from '@/src/lib/googleDrive'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { key, driveFileId } = body

    if (!key || typeof key !== 'string') {
      return Response.json({ ok: false, error: 'Invalid key' })
    }

    // Check if key is a Google Drive URL
    if (key.startsWith('https://drive.google.com')) {
      // Extract file ID from URL: https://drive.google.com/uc?export=view&id=FILE_ID
      const urlMatch = key.match(/[?&]id=([^&]+)/)
      const fileId = driveFileId || (urlMatch ? urlMatch[1] : null)
      
      if (fileId) {
        try {
          await deleteFromGoogleDrive(fileId)
          console.log('Deleted from Google Drive:', fileId)
        } catch (error: any) {
          console.error('Failed to delete from Google Drive:', error)
          return Response.json({ 
            ok: false, 
            error: `Failed to delete from Google Drive: ${error.message}` 
          })
        }
      }
    } else if (driveFileId) {
      // Legacy: If driveFileId is provided separately
      try {
        await deleteFromGoogleDrive(driveFileId)
      } catch (error: any) {
        console.error('Failed to delete from Google Drive:', error)
        // Continue to delete metadata even if Drive deletion fails
      }
    } else {
      // Delete local file (for old photos not in Google Drive)
      // Convert API path back to file system path
      // key is like "/api/photos/raw/subfolder/photo.jpg"
      const match = key.match(/^\/api\/photos\/raw\/(.+)$/)
      if (match) {
        const encodedPath = match[1]!
        // Decode the path segments
        const segments = encodedPath.split('/').map(seg => decodeURIComponent(seg))
        
        const photosRoot = path.join(process.cwd(), 'photos')
        const filePath = path.join(photosRoot, ...segments)

        // Security check: ensure the file is within photos directory
        const normalizedPath = path.normalize(filePath)
        if (normalizedPath.startsWith(photosRoot)) {
          // Check if file exists and delete
          try {
            await fs.access(filePath)
            await fs.unlink(filePath)
          } catch (error) {
            console.warn('Local file not found or already deleted:', filePath)
          }
        }
      }
    }

    // Delete metadata
    await deletePhotoMeta(key)

    return Response.json({ ok: true })
  } catch (error: any) {
    console.error('Delete photo error:', error)
    return Response.json({ ok: false, error: error.message || 'Delete failed' })
  }
}
