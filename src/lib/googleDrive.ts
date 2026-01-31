const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3'

type DriveFileListResponse = {
  files?: Array<{ id?: string; name?: string }>
}

let tokenCache: { accessToken: string; expiresAt: number } | null = null

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} not set in environment variables`)
  }
  return value
}

function buildUrl(base: string, pathname: string, params?: Record<string, string | undefined>) {
  const url = new URL(pathname, base)
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) url.searchParams.set(key, value)
    })
  }
  return url.toString()
}

async function getAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.accessToken
  }

  const body = new URLSearchParams({
    client_id: requireEnv('GOOGLE_CLIENT_ID'),
    client_secret: requireEnv('GOOGLE_CLIENT_SECRET'),
    refresh_token: requireEnv('GOOGLE_REFRESH_TOKEN'),
    grant_type: 'refresh_token',
  })

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Failed to refresh access token: ${text}`)
  }

  const data = await response.json()
  const accessToken = data.access_token as string | undefined
  const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 3600

  if (!accessToken) {
    throw new Error('Missing access token from Google OAuth response')
  }

  tokenCache = {
    accessToken,
    expiresAt: Date.now() + expiresIn * 1000,
  }

  return accessToken
}

async function driveFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken()
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${token}`)
  return fetch(url, { ...init, headers })
}

async function driveFetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await driveFetch(url, init)
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Drive API error: ${response.status} ${text}`)
  }
  return response.json() as Promise<T>
}

async function driveFetchArrayBuffer(url: string, init: RequestInit = {}): Promise<ArrayBuffer> {
  const response = await driveFetch(url, init)
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Drive API error: ${response.status} ${text}`)
  }
  return response.arrayBuffer()
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
  const folderId = requireEnv('GOOGLE_DRIVE_FOLDER_ID')

  // Resolve target folder (optional nested path)
  let targetFolderId = folderId
  if (options?.folderPath && options.folderPath.length) {
    targetFolderId = await ensureFolderPath(folderId, options.folderPath)
  }

  const boundary = `----memories-${Date.now()}`
  const metadata = {
    name: filename,
    parents: [targetFolderId],
  }

  const multipartBody = Buffer.concat([
    Buffer.from(`--${boundary}\r\n`),
    Buffer.from('Content-Type: application/json; charset=UTF-8\r\n\r\n'),
    Buffer.from(JSON.stringify(metadata)),
    Buffer.from(`\r\n--${boundary}\r\n`),
    Buffer.from(`Content-Type: ${mimeType}\r\n\r\n`),
    buffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ])

  const uploadUrl = buildUrl(DRIVE_UPLOAD_BASE, '/files', {
    uploadType: 'multipart',
    supportsAllDrives: 'true',
    fields: 'id,webViewLink',
  })

  const uploadResponse = await driveFetchJson<{ id?: string; webViewLink?: string }>(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  })

  const fileId = uploadResponse.id
  const webViewLink = uploadResponse.webViewLink

  if (!fileId || !webViewLink) {
    throw new Error('Drive upload response missing file id or link')
  }

  const permissionUrl = buildUrl(DRIVE_API_BASE, `/files/${fileId}/permissions`, {
    supportsAllDrives: 'true',
  })

  await driveFetchJson(permissionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  })

  // Generate direct download URL
  const directUrl = `https://drive.google.com/uc?export=view&id=${fileId}`

  return {
    fileId,
    webViewLink,
    directUrl,
  }
}

async function findFolderId(parentId: string, name: string): Promise<string | null> {
  const safeName = name.replace(/'/g, "\\'")
  const listUrl = buildUrl(DRIVE_API_BASE, '/files', {
    q: `name='${safeName}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`,
    fields: 'files(id, name)',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  })

  const res = await driveFetchJson<DriveFileListResponse>(listUrl)
  const first = res.files?.[0]
  return first?.id || null
}

async function ensureFolderPath(rootId: string, pathParts: string[]): Promise<string> {
  let currentId = rootId

  for (const part of pathParts) {
    const safeName = part.trim()
    if (!safeName) continue

    const existingId = await findFolderId(currentId, safeName)
    if (existingId) {
      currentId = existingId
      continue
    }

    const createUrl = buildUrl(DRIVE_API_BASE, '/files', {
      supportsAllDrives: 'true',
      fields: 'id',
    })

    const created = await driveFetchJson<{ id?: string }>(createUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({
        name: safeName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [currentId],
      }),
    })

    currentId = created.id || currentId
  }

  return currentId
}

/**
 * Delete a file from Google Drive
 * @param fileId Google Drive file ID
 */
export async function deleteFromGoogleDrive(fileId: string): Promise<void> {
  const deleteUrl = buildUrl(DRIVE_API_BASE, `/files/${fileId}`, {
    supportsAllDrives: 'true',
  })
  const response = await driveFetch(deleteUrl, { method: 'DELETE' })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Drive delete failed: ${response.status} ${text}`)
  }
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
  const rootId = requireEnv('GOOGLE_DRIVE_FOLDER_ID')
  const targetFolderId = await ensureFolderPath(rootId, folderPath)

  const currentUrl = buildUrl(DRIVE_API_BASE, `/files/${fileId}`, {
    fields: 'parents',
    supportsAllDrives: 'true',
  })

  const current = await driveFetchJson<{ parents?: string[] }>(currentUrl)
  const prevParents = current.parents?.join(',') || ''

  const updateUrl = buildUrl(DRIVE_API_BASE, `/files/${fileId}`, {
    addParents: targetFolderId,
    removeParents: prevParents || undefined,
    supportsAllDrives: 'true',
  })

  const response = await driveFetch(updateUrl, { method: 'PATCH' })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Drive move failed: ${response.status} ${text}`)
  }
}

/**
 * Download a file from Google Drive
 * @param fileId Google Drive file ID
 * @returns Buffer of the file
 */
export async function downloadFromGoogleDrive(fileId: string): Promise<Buffer> {
  const downloadUrl = buildUrl(DRIVE_API_BASE, `/files/${fileId}`, {
    alt: 'media',
    supportsAllDrives: 'true',
  })

  const data = await driveFetchArrayBuffer(downloadUrl)
  return Buffer.from(data)
}
