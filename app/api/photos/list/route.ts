import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'])

async function* walk(dir: string): AsyncGenerator<string> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      yield* walk(full)
    } else {
      yield full
    }
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || '80'), 1), 200)

  const root = path.join(process.cwd(), 'photos')

  // Reservoir sample to avoid loading everything into memory
  const reservoir: string[] = []
  let seen = 0

  try {
    for await (const filePath of walk(root)) {
      const ext = path.extname(filePath).toLowerCase()
      if (!ALLOWED_EXT.has(ext)) continue

      const rel = path.relative(root, filePath).split(path.sep)
      // Build a safe URL path with encoded segments
      const encoded = rel.map(s => encodeURIComponent(s)).join('/')
      const urlPath = `/api/photos/raw/${encoded}?w=420`

      seen += 1
      if (reservoir.length < limit) {
        reservoir.push(urlPath)
      } else {
        const j = Math.floor(Math.random() * seen)
        if (j < limit) reservoir[j] = urlPath
      }
    }

    return NextResponse.json({ ok: true, count: reservoir.length, items: reservoir })
  } catch {
    return NextResponse.json({ ok: true, count: 0, items: [] })
  }
}
