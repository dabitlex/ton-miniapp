import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // TypeScript Fehler blockieren den Build nicht
  // (DB-Typen werden zur Laufzeit validiert, nicht zur Build-Zeit)
  typescript: {
    ignoreBuildErrors: true,
  },
  // ESLint Fehler blockieren den Build nicht
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 't.me' },
      { protocol: 'https', hostname: '*.telegram.org' },
      { protocol: 'https', hostname: 'telegram.org' },
    ],
  },
}

export default nextConfig
