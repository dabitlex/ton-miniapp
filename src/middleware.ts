// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const response = NextResponse.next({ request })

  // WICHTIG: X-Frame-Options NICHT setzen für Telegram MiniApp
  // Telegram WebView bettet die App ein -- DENY würde das blockieren
  // Sicherheit wird durch Telegram initData HMAC-Validierung gewährleistet

  // Content-Type Schutz
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // Kein Cache für API Routes
  if (pathname.startsWith('/api/')) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|tonconnect-manifest.json|.*\\.png|.*\\.svg|.*\\.jpg|.*\\.webp).*)',
  ],
}
