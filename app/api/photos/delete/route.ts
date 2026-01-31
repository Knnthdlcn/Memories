import { NextRequest } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { deletePhotoMeta } from '@/src/lib/photosMeta'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { key } = body

    if (!key || typeof key !== 'string') {
      return Response.json({ ok: false, error: 'Invalid key' })
    }

    // Convert API path back to file system path
    // key is like "/api/photos/raw/subfolder/photo.jpg"
    const match = key.match(/^\/api\/photos\/raw\/(.+)$/)
    if (!match) {
      return Response.json({ ok: false, error: 'Invalid photo key format' })
    }

    const encodedPath = match[1]!
    // Decode the path segments
    const segments = encodedPath.split('/').map(seg => decodeURIComponent(seg))
    
    const photosRoot = path.join(process.cwd(), 'photos')
    const filePath = path.join(photosRoot, ...segments)

    // Security check: ensure the file is within photos directory
    const normalizedPath = path.normalize(filePath)
    if (!normalizedPath.startsWith(photosRoot)) {
      return Response.json({ ok: false, error: 'Invalid path' })
    }

    // Check if file exists
    try {
      await fs.access(filePath)
    } catch {
      return Response.json({ ok: false, error: 'File not found' })
    }

    // Delete the file
    await fs.unlink(filePath)

    // Delete metadata
    await deletePhotoMeta(key)

    return Response.json({ ok: true })
  } catch (error: any) {
    console.error('Delete photo error:', error)
    return Response.json({ ok: false, error: error.message || 'Delete failed' })
  }
}
