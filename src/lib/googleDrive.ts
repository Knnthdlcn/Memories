import { google } from 'googleapis'
import fs from 'fs'
import path from 'path'
import { Readable } from 'stream'

// Initialize Google Drive API with OAuth2
function getDriveClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )

  // Set credentials from refresh token
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  })

  return google.drive({ version: 'v3', auth: oauth2Client })
}

/**
 * Upload a file to Google Drive
 * @param buffer File buffer
 * @param filename Desired filename
 * @param mimeType MIME type of the file
 * @returns Object with fileId and webViewLink
 */
export async function uploadToGoogleDrive(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  options?: { folderPath?: string[] }
): Promise<{ fileId: string; webViewLink: string; directUrl: string }> {
  const drive = getDriveClient()
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID

  if (!folderId) {
    throw new Error('GOOGLE_DRIVE_FOLDER_ID not set in environment variables')
  }

  // Resolve target folder (optional nested path)
  let targetFolderId = folderId
  if (options?.folderPath && options.folderPath.length) {
    targetFolderId = await ensureFolderPath(drive, folderId, options.folderPath)
  }

  // Convert buffer to readable stream
  const stream = Readable.from(buffer)

  // Upload file
  const response = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [targetFolderId],
    },
    media: {
      mimeType,
      body: stream,
    },
    fields: 'id, webViewLink',
    supportsAllDrives: true,  // Support shared drives
  })

  const fileId = response.data.id!
  const webViewLink = response.data.webViewLink!

  // Make the file publicly accessible
  await drive.permissions.create({
    fileId,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
    supportsAllDrives: true,
  })

  // Generate direct download URL
  const directUrl = `https://drive.google.com/uc?export=view&id=${fileId}`

  return {
    fileId,
    webViewLink,
    directUrl,
  }
}

async function findFolderId(
  drive: ReturnType<typeof google.drive>,
  parentId: string,
  name: string
): Promise<string | null> {
  const res = await drive.files.list({
    q: `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`,
    fields: 'files(id, name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })

  const first = res.data.files?.[0]
  return first?.id || null
}

async function ensureFolderPath(
  drive: ReturnType<typeof google.drive>,
  rootId: string,
  pathParts: string[]
): Promise<string> {
  let currentId = rootId

  for (const part of pathParts) {
    const safeName = part.trim()
    if (!safeName) continue

    const existingId = await findFolderId(drive, currentId, safeName)
    if (existingId) {
      currentId = existingId
      continue
    }

    const created = await drive.files.create({
      requestBody: {
        name: safeName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [currentId],
      },
      fields: 'id',
      supportsAllDrives: true,
    })

    currentId = created.data.id || currentId
  }

  return currentId
}

/**
 * Delete a file from Google Drive
 * @param fileId Google Drive file ID
 */
export async function deleteFromGoogleDrive(fileId: string): Promise<void> {
  const drive = getDriveClient()
  await drive.files.delete({ fileId })
}

/**
 * Get direct download URL for a Google Drive file
 * @param fileId Google Drive file ID
 * @returns Direct URL to view/download the file
 */
export function getGoogleDriveDirectUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=view&id=${fileId}`
}

/**
 * Move an existing Drive file into a folder path under the root folder.
 * @param fileId Google Drive file ID
 * @param folderPath Array of folder names
 */
export async function moveDriveFileToFolder(fileId: string, folderPath: string[]): Promise<void> {
  const drive = getDriveClient()
  const rootId = process.env.GOOGLE_DRIVE_FOLDER_ID

  if (!rootId) {
    throw new Error('GOOGLE_DRIVE_FOLDER_ID not set in environment variables')
  }

  const targetFolderId = await ensureFolderPath(drive, rootId, folderPath)

  const current = await drive.files.get({
    fileId,
    fields: 'parents',
    supportsAllDrives: true,
  })

  const prevParents = current.data.parents?.join(',') || ''

  await drive.files.update({
    fileId,
    addParents: targetFolderId,
    removeParents: prevParents || undefined,
    supportsAllDrives: true,
  })
}

/**
 * Download a file from Google Drive
 * @param fileId Google Drive file ID
 * @returns Buffer of the file
 */
export async function downloadFromGoogleDrive(fileId: string): Promise<Buffer> {
  const drive = getDriveClient()
  
  const response = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  )

  return Buffer.from(response.data as ArrayBuffer)
}
