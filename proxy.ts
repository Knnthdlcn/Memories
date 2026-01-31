import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_FILE = /\.(.*)$/

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // don't run on public files or api or static assets
  if (PUBLIC_FILE.test(pathname) || pathname.startsWith('/_next/')) return

  // Protect /admin routes except login
  if (pathname.startsWith('/admin')) {
    if (pathname === '/admin/login') return
    const admin = request.cookies.get('admin')
    if (!admin) {
      const url = request.nextUrl.clone()
      url.pathname = '/admin/login'
      return NextResponse.redirect(url)
    }
  }
}

export const config = {
  matcher: ['/admin/:path*', '/admin']
}