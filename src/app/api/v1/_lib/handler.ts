// src/app/api/v1/_lib/handler.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'
import crypto from 'crypto'

export interface AuthCtx {
  userId:     string
  telegramId: number
  ipHash:     string
  req:        NextRequest
  params:     Record<string, string>  // ← URL-Parameter (z.B. clanId)
}

export function ok<T>(data: T, meta?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ success: true, data, ...(meta ? { meta } : {}) })
}

export function err(message: string, code: string, status = 400): NextResponse {
  return NextResponse.json({ success: false, error: message, code }, { status })
}

function hashIP(req: NextRequest): string {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown'
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16)
}

// FIX: withAuth akzeptiert jetzt routeCtx und übergibt params an ctx
export function withAuth(
  handler: (ctx: AuthCtx) => Promise<NextResponse>
) {
  return async (
    req: NextRequest,
    routeCtx?: { params?: Record<string, string> | Promise<Record<string, string>> }
  ): Promise<NextResponse> => {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : null

    if (!token) return err('Missing Authorization header', 'UNAUTHORIZED', 401)

    try {
      const db = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      )

      const { data: { user }, error } = await db.auth.getUser(token)
      if (error || !user) return err('Invalid or expired token', 'INVALID_TOKEN', 401)

      const { data: profile } = await db
        .from('users').select('is_banned').eq('id', user.id).single()
      if ((profile as any)?.is_banned) return err('Account suspended', 'ACCOUNT_BANNED', 403)

      // Params aus routeCtx auflösen (Next.js 15 kann Promise zurückgeben)
      let resolvedParams: Record<string, string> = {}
      if (routeCtx?.params) {
        resolvedParams = routeCtx.params instanceof Promise
          ? await routeCtx.params
          : routeCtx.params
      }

      const ctx: AuthCtx = {
        userId:     user.id,
        telegramId: Number(user.user_metadata?.['telegram_id'] ?? 0),
        ipHash:     hashIP(req),
        req,
        params:     resolvedParams,
      }

      return await handler(ctx)
    } catch (e) {
      console.error(`[API Error] ${req.method} ${req.nextUrl.pathname}:`, e)
      return err('Internal server error', 'INTERNAL_ERROR', 500)
    }
  }
}

export function withWebhook(
  handler: (req: NextRequest, body: string) => Promise<NextResponse>,
  secretEnvKey: string
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const signature = req.headers.get('x-signature') ?? ''
    const body      = await req.text()
    const secret    = process.env[secretEnvKey] ?? ''

    if (!secret) return err('Webhook secret not configured', 'CONFIG_ERROR', 500)

    const expected = crypto.createHmac('sha256', secret).update(body).digest('hex')

    let sigBuffer: Buffer, expBuffer: Buffer
    try {
      sigBuffer = Buffer.from(signature, 'hex')
      expBuffer = Buffer.from(expected, 'hex')
    } catch {
      return err('Invalid signature format', 'INVALID_SIGNATURE', 401)
    }

    if (sigBuffer.length !== expBuffer.length ||
        !crypto.timingSafeEqual(sigBuffer, expBuffer)) {
      return err('Invalid webhook signature', 'INVALID_SIGNATURE', 401)
    }

    return handler(req, body)
  }
}
