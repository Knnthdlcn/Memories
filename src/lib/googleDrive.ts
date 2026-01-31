import { google } from 'googleapis'
import fs from 'fs'
import path from 'path'
import { Readable } from 'stream'

// Initialize Google Drive API
function getDriveClient() {
  const credentials = JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), 'google-credentials.json'),
      'utf-8'
    )
  )

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  })

  return google.drive({ version: 'v3', auth })
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
  mimeType: string
): Promise<{ fileId: string; webViewLink: string; directUrl: string }> {
  const drive = getDriveClient()
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID

  if (!folderId) {
    throw new Error('GOOGLE_DRIVE_FOLDER_ID not set in environment variables')
  }

  // Convert buffer to readable stream
  const stream = Readable.from(buffer)

  // Upload file
  const response = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: stream,
    },
    fields: 'id, webViewLink',
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
  })

  // Generate direct download URL
  const directUrl = `https://drive.google.com/uc?export=view&id=${fileId}`

  return {
    fileId,
    webViewLink,
    directUrl,
  }
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
