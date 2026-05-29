// src/app/not-found.tsx 
import Link   from 'next/link'

export default function NotFound() {
  return (
    <div className="h-dvh flex flex-col items-center justify-center px-6 text-center gap-4">
      <p className="text-7xl font-black text-white/[0.06] select-none">404</p>
      <h1 className="text-lg font-bold text-white">Page not found</h1>
      <Link href="/home"
        className="px-5 py-2 rounded-xl bg-violet-500 text-white text-sm font-semibold
                   active:scale-95 transition-transform">
        Go Home
      </Link>
    </div>
  )
}
