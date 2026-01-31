import fs from 'fs/promises'
import path from 'path'

export type PhotoMeta = {
  message?: string
  featured?: boolean
  order?: number
  dateOverride?: string
  updatedAt?: string
}

export type PhotoMetaStore = Record<string, PhotoMeta>

const STORE_PATH = path.join(process.cwd(), 'photos-meta.json')

async function readJsonFile(): Promise<PhotoMetaStore> {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8')
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as PhotoMetaStore
  } catch {
    return {}
  }
}

async function writeJsonFile(store: PhotoMetaStore): Promise<void> {
  const tmp = `${STORE_PATH}.tmp`
  const json = JSON.stringify(store, null, 2)
  await fs.writeFile(tmp, json, 'utf8')
  await fs.rename(tmp, STORE_PATH)
}

export async function getPhotoMetaStore(): Promise<PhotoMetaStore> {
  return readJsonFile()
}

export async function getPhotoMeta(key: string): Promise<PhotoMeta> {
  const store = await readJsonFile()
  return store[key] || {}
}

export async function upsertPhotoMeta(key: string, patch: PhotoMeta): Promise<PhotoMeta> {
  if (!key || typeof key !== 'string' || key.length > 2048) return {}

  const store = await readJsonFile()
  const prev = store[key] || {}

  const next: PhotoMeta = {
    ...prev,
    ...patch,
    updatedAt: new Date().toISOString()
  }

  // Normalize message
  if (typeof next.message === 'string') next.message = next.message.trim()

  store[key] = next
  await writeJsonFile(store)
  return next
}

export async function deletePhotoMeta(key: string): Promise<boolean> {
  if (!key || typeof key !== 'string') return false

  const store = await readJsonFile()
  
  if (!store[key]) return false
  
  delete store[key]
  await writeJsonFile(store)
  return true
}
