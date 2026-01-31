import { NextRequest, NextResponse } from 'next/server'

// Cache Drive images for 1 year
const CACHE_DURATION = 31536000

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  
  if (!url || !url.startsWith('https://drive.google.com')) {
    return new NextResponse('Invalid URL', { status: 400 })
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
      // Don't use Next.js fetch cache here. Some images are >2MB and Next will refuse
      // to store them, causing noisy errors during dev.
      cache: 'no-store'
    })

    if (!response.ok) {
      return new NextResponse('Failed to fetch image', { status: response.status })
    }

    const imageBuffer = await response.arrayBuffer()
    const contentType = response.headers.get('content-type') || 'image/jpeg'

    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': `public, max-age=${CACHE_DURATION}, immutable`,
        'CDN-Cache-Control': `public, max-age=${CACHE_DURATION}`,
        'Vercel-CDN-Cache-Control': `public, max-age=${CACHE_DURATION}`,
      },
    })
  } catch (error) {
    console.error('Drive proxy error:', error)
    return new NextResponse('Error fetching image', { status: 500 })
  }
}
