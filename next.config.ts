import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    // Alle Telegram CDN Domains erlauben
    remotePatterns: [
      { protocol: 'https', hostname: 't.me' },
      { protocol: 'https', hostname: '*.t.me' },
      { protocol: 'https', hostname: 'telegram.org' },
      { protocol: 'https', hostname: '*.telegram.org' },
      { protocol: 'https', hostname: 'telegra.ph' },
      { protocol: 'https', hostname: '*.telegra.ph' },
      // Telegram CDN Server
      { protocol: 'https', hostname: 'cdn*.telegram-cdn.org' },
      { protocol: 'https', hostname: '*.telegram-cdn.org' },
      // Weitere mögliche Quellen
      { protocol: 'https', hostname: 'cdn.tlgr.org' },
      { protocol: 'https', hostname: '*.tlgr.org' },
    ],
    // Fallback: Alle externen Bilder erlauben (einfachste Lösung)
    dangerouslyAllowSVG: true,
    unoptimized: true,
  },
}

export default nextConfig
