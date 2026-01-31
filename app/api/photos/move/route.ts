import { NextRequest } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { deletePhotoMeta, upsertPhotoMeta, getPhotoMeta } from '@/src/lib/photosMeta'

async function findFileByName(root: string, filename: string): Promise<string | undefined> {
  try {
    const entries = await fs.readdir(root, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(root, entry.name)
      if (entry.isDirectory()) {
        const found = await findFileByName(full, filename)
        if (found) return found
      } else if (entry.isFile()) {
        if (entry.name.toLowerCase() === filename.toLowerCase()) return full
      }
    }
  } catch {
    return undefined
  }
  return undefined
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { key, newDate, newMonth } = body

    console.log('[MOVE] ========== START MOVE REQUEST ==========')
    console.log('[MOVE] Request:', { key, newDate, newMonth })

    if (!key || typeof key !== 'string') {
      console.log('[MOVE] ERROR: Invalid key')
      return Response.json({ ok: false, error: 'Invalid key' })
    }

    if (!newDate && !newMonth) {
      console.log('[MOVE] ERROR: No date provided')
      return Response.json({ ok: false, error: 'New date or month required' })
    }

    // Parse the target date
    let targetDate: Date
    if (newDate) {
      targetDate = new Date(newDate + 'T12:00:00')
      console.log('[MOVE] Using specific date:', newDate, '→', targetDate.toISOString())
    } else if (newMonth) {
      // Month format: "YYYY-MM"
      targetDate = new Date(`${newMonth}-15T12:00:00`)
      console.log('[MOVE] Using month:', newMonth, '→', targetDate.toISOString())
    } else {
      targetDate = new Date()
    }

    if (isNaN(targetDate.getTime())) {
      console.log('[MOVE] ERROR: Invalid date format')
      return Response.json({ ok: false, error: 'Invalid date format' })
    }

    // Convert API path back to file system path
    // Remove query parameters if present (e.g., ?w=900)
    const cleanKey = key.split('?')[0]!
    console.log('[MOVE] Clean key:', cleanKey)
    
    const match = cleanKey.match(/^\/api\/photos\/raw\/(.+)$/)
    if (!match) {
      console.log('[MOVE] ERROR: Invalid key format:', key)
      return Response.json({ ok: false, error: 'Invalid photo key format' })
    }

    const encodedPath = match[1]!
    const segments = encodedPath.split('/').map(seg => decodeURIComponent(seg))
    
    console.log('[MOVE] Path segments:', segments)
    
    const photosRoot = path.join(process.cwd(), 'photos')
    let oldFilePath = path.join(photosRoot, ...segments)

    console.log('[MOVE] Photos root:', photosRoot)
    console.log('[MOVE] Old file path:', oldFilePath)

    // Security check
    let normalizedOldPath = path.normalize(oldFilePath)
    const normalizedPhotosRoot = path.normalize(photosRoot)
    
    console.log('[MOVE] Normalized old path:', normalizedOldPath)
    console.log('[MOVE] Normalized photos root:', normalizedPhotosRoot)
    
    if (!normalizedOldPath.startsWith(normalizedPhotosRoot)) {
      console.log('[MOVE] ERROR: Security check failed')
      return Response.json({ ok: false, error: 'Invalid path - security check failed' })
    }

    console.log('[MOVE] Security check passed')

    // Check if file exists
    try {
      await fs.access(oldFilePath)
      console.log('[MOVE] ✓ File exists at:', oldFilePath)
    } catch (error) {
      console.log('[MOVE] ERROR: File not found at:', oldFilePath)
      console.log('[MOVE] Attempting fallback search by filename...')
      const filenameOnly = segments[segments.length - 1] || ''
      const foundPath = await findFileByName(photosRoot, filenameOnly)
      if (!foundPath) {
        console.log('[MOVE] ERROR: File not found anywhere in photos folder')
        return Response.json({ ok: false, error: 'File not found. Please refresh the page and try again.' })
      }

      console.log('[MOVE] ✓ Found file at:', foundPath)
      oldFilePath = foundPath
      normalizedOldPath = path.normalize(oldFilePath)
      if (!normalizedOldPath.startsWith(normalizedPhotosRoot)) {
        console.log('[MOVE] ERROR: Fallback path failed security check')
        return Response.json({ ok: false, error: 'Invalid path - security check failed' })
      }
    }

    // Get existing metadata
    let existingMeta = await getPhotoMeta(cleanKey)
    console.log('[MOVE] Existing metadata:', existingMeta)

    // Create new path based on target date
    const year = targetDate.getFullYear()
    const month = String(targetDate.getMonth() + 1).padStart(2, '0')
    const day = String(targetDate.getDate()).padStart(2, '0')
    const oldFilename = path.basename(oldFilePath)
    const ext = path.extname(oldFilename)
    
    // Generate new filename with the target date
    const timestamp = Date.now()
    const newFilename = `${year}_${month}${day}_${timestamp}${ext}`
    
    const newDir = path.join(photosRoot, String(year), month)
    let newFilePath = path.join(newDir, newFilename)

    console.log('[MOVE] Target year:', year)
    console.log('[MOVE] Target month:', month)
    console.log('[MOVE] Target day:', day)
    console.log('[MOVE] Old filename:', oldFilename)
    console.log('[MOVE] New filename:', newFilename)
    console.log('[MOVE] New directory:', newDir)
    console.log('[MOVE] New file path:', newFilePath)

    // Check if already in the same location
    const normalizedNewPath = path.normalize(newFilePath)
    const sameLocation = normalizedOldPath === normalizedNewPath
    
    // Check if we need to update the date even if in same location
    const currentStats = await fs.stat(oldFilePath)
    const currentDate = currentStats.mtime
    const needsDateUpdate = Math.abs(currentDate.getTime() - targetDate.getTime()) > 60000 // More than 1 minute difference
    
    console.log('[MOVE] Same location:', sameLocation)
    console.log('[MOVE] Current file date:', currentDate.toISOString())
    console.log('[MOVE] Target date:', targetDate.toISOString())
    console.log('[MOVE] Needs date update:', needsDateUpdate)
    
    if (sameLocation && !needsDateUpdate) {
      console.log('[MOVE] Already in target location with correct date')
      return Response.json({ ok: true, message: 'Photo already in target location', key: cleanKey, date: targetDate.toISOString() })
    }
    
    // If same location but different date, just update the timestamp
    if (sameLocation && needsDateUpdate) {
      console.log('[MOVE] Updating file date without moving')
      try {
        await fs.utimes(oldFilePath, targetDate, targetDate)
        console.log('[MOVE] ✓ File date updated successfully')

        // Update metadata with date override
        await upsertPhotoMeta(cleanKey, {
          ...existingMeta,
          dateOverride: targetDate.toISOString()
        })
        
        console.log('[MOVE] ✓ Success! Date updated for:', cleanKey)
        console.log('[MOVE] ========== END MOVE REQUEST ==========')
        return Response.json({ ok: true, newKey: cleanKey, date: targetDate.toISOString() })
      } catch (error) {
        console.log('[MOVE] ERROR: Failed to update date:', error)
        return Response.json({ ok: false, error: 'Failed to update date: ' + (error as Error).message })
      }
    }

    // Ensure target directory exists
    console.log('[MOVE] Creating directory:', newDir)
    await fs.mkdir(newDir, { recursive: true })
    console.log('[MOVE] ✓ Directory created/verified')

    // The new filename is always unique due to timestamp, so no need to check for duplicates
    const finalFilePath = newFilePath
    console.log('[MOVE] Final file path:', finalFilePath)

    // Perform the move
    console.log('[MOVE] Moving file...')
    console.log('[MOVE] FROM:', normalizedOldPath)
    console.log('[MOVE] TO:', finalFilePath)
    
    try {
      await fs.rename(normalizedOldPath, finalFilePath)
      console.log('[MOVE] ✓ File moved successfully')
    } catch (error) {
      console.log('[MOVE] ERROR: Failed to move file:', error)
      return Response.json({ ok: false, error: 'Failed to move file: ' + (error as Error).message })
    }

    // Update file times
    console.log('[MOVE] Setting file times to:', targetDate.toISOString())
    try {
      await fs.utimes(finalFilePath, targetDate, targetDate)
      console.log('[MOVE] ✓ File times updated')
    } catch (error) {
      console.log('[MOVE] WARNING: Could not set file times:', error)
    }

    // Build new key
    const relativePath = path.relative(photosRoot, finalFilePath)
    const newSegments = relativePath.split(path.sep)
    const newEncodedPath = newSegments.map(s => encodeURIComponent(s)).join('/')
    const newKey = `/api/photos/raw/${newEncodedPath}`
    
    console.log('[MOVE] Relative path:', relativePath)
    console.log('[MOVE] New segments:', newSegments)
    console.log('[MOVE] New encoded path:', newEncodedPath)
    console.log('[MOVE] New key:', newKey)

    // Delete old metadata entry
    console.log('[MOVE] Deleting old metadata for:', cleanKey)
    if (Object.keys(existingMeta || {}).length === 0 && cleanKey !== newKey) {
      // If metadata was stored under a different key, try to fetch it
      const altMeta = await getPhotoMeta(newKey)
      if (Object.keys(altMeta || {}).length > 0) existingMeta = altMeta
    }

    await deletePhotoMeta(cleanKey)
    
    // Create new metadata entry with same data
    console.log('[MOVE] Creating new metadata for:', newKey)
    await upsertPhotoMeta(newKey, {
      ...existingMeta,
      dateOverride: targetDate.toISOString()
    })

    console.log('[MOVE] ✓ Success! Photo moved to:', newKey)
    console.log('[MOVE] ========== END MOVE REQUEST ==========')
    
    return Response.json({ ok: true, newKey, date: targetDate.toISOString() })
  } catch (error: any) {
    console.error('[MOVE] ========== FATAL ERROR ==========')
    console.error('[MOVE] Error:', error)
    console.error('[MOVE] Stack:', error.stack)
    console.error('[MOVE] ========================================')
    return Response.json({ ok: false, error: error.message || 'Move failed' })
  }
}
