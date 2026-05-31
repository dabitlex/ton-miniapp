// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const config = {
  matcher: ['/admin/:path*'],
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname

  // Login-Seite immer erlauben
  if (path === '/admin/login') return NextResponse.next()

  // Session Token aus Cookie
  const token = req.cookies.get('admin_session')?.value

  if (!token) {
    return NextResponse.redirect(new URL('/admin/login', req.url))
  }

  // Token in Supabase prüfen
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: session } = await supabase
      .from('admin_sessions')
      .select('telegram_id, expires_at')
      .eq('token', token)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (!session) {
      const response = NextResponse.redirect(new URL('/admin/login', req.url))
      response.cookies.delete('admin_session')
      return response
    }

    // Telegram ID in Header weitergeben
    const requestHeaders = new Headers(req.headers)
    requestHeaders.set('x-admin-telegram-id', session.telegram_id.toString())

    return NextResponse.next({ request: { headers: requestHeaders } })

  } catch {
    return NextResponse.redirect(new URL('/admin/login', req.url))
  }
}
