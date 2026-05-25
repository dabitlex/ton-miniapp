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
    remotePatterns: [
      { protocol: 'https', hostname: 't.me' },
      { protocol: 'https', hostname: '*.telegram.org' },
      { protocol: 'https', hostname: 'telegram.org' },
    ],
  },
  // Keine globalen Security Headers hier --
  // werden selektiv in middleware.ts gesetzt
}

export default nextConfig
