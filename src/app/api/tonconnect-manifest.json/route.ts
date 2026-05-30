// src/app/api/tonconnect-manifest.json/route.ts
// Manifest mit korrekten CORS-Headern ausliefern
import { NextResponse } from 'next/server'

export const dynamic = 'force-static'

export function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ton-miniapp-bice.vercel.app'

  const manifest = {
    url:             appUrl,
    name:            process.env.NEXT_PUBLIC_APP_NAME ?? 'TON MiniApp',
    iconUrl:         `${appUrl}/icon-192.png`,
    termsOfUseUrl:   `${appUrl}/terms`,
    privacyPolicyUrl:`${appUrl}/privacy`,
  }

  return new NextResponse(JSON.stringify(manifest), {
    headers: {
      'Content-Type':                'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods':'GET, OPTIONS',
      'Cache-Control':               'public, max-age=3600',
    },
  })
}

export function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods':'GET, OPTIONS',
    },
  })
}
