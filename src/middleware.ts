// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server'

const SECURITY_HEADERS: Record<string, string> = {
  'X-Frame-Options':           'DENY',
  'X-Content-Type-Options':    'nosniff',
  'Referrer-Policy':           'strict-origin-when-cross-origin',
  'Permissions-Policy':        'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
}

// Routes that require the game shell (authenticated)
const GAME_ROUTES = ['/home', '/quests', '/leaderboard', '/profile', '/ecosystem', '/clans', '/season']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const response = NextResponse.next({ request })

  // ── Apply security headers to all responses ─────────────────────
  Object.entries(SECURITY_HEADERS).forEach(([k, v]) => response.headers.set(k, v))

  // ── No cache for all API routes ──────────────────────────────────
  if (pathname.startsWith('/api/')) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
  }

  // ── Webhook HMAC checked in route handlers, not here ─────────────
  // Skipping auth check on webhooks and auth routes

  // ── API routes: Bearer token validated inside withAuth() HOF ─────
  // No JWT check at middleware level — keeps edge bundle small

  return response
}

export const config = {
  matcher: [
    // Match everything except static assets and _next internals
    '/((?!_next/static|_next/image|favicon.ico|tonconnect-manifest.json|.*\\.png|.*\\.svg|.*\\.jpg|.*\\.webp).*)',
  ],
}