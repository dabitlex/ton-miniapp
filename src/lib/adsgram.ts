// src/lib/adsgram.ts
// Adsgram Rewarded-Video SDK-Loader. Der Reward wird NICHT hier vergeben,
// sondern server-seitig über den Adsgram-Callback (/api/v1/ads/reward).
'use client'

type AdController = { show: () => Promise<unknown> }

declare global {
  interface Window {
    Adsgram?: { init: (opts: { blockId: string }) => AdController }
  }
}

const SDK_URL = 'https://sad.adsgram.ai/js/sad.min.js'
let sdkPromise: Promise<void> | null = null
let controller: AdController | null = null

function loadSdk(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'))
  if (window.Adsgram) return Promise.resolve()
  if (sdkPromise) return sdkPromise
  sdkPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = SDK_URL
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => { sdkPromise = null; reject(new Error('Adsgram SDK load failed')) }
    document.head.appendChild(s)
  })
  return sdkPromise
}

export function getBlockId(): string | null {
  return process.env.NEXT_PUBLIC_ADSGRAM_BLOCK_ID || null
}

async function getController(): Promise<AdController> {
  await loadSdk()
  const blockId = getBlockId()
  if (!blockId) throw new Error('NEXT_PUBLIC_ADSGRAM_BLOCK_ID fehlt')
  if (!window.Adsgram) throw new Error('Adsgram SDK nicht verfügbar')
  if (!controller) controller = window.Adsgram.init({ blockId })
  return controller
}

export type WatchResult = 'watched' | 'no_ad' | 'error'

// Spielt eine Rewarded-Ad ab. resolved = bis zum Ende geschaut.
export async function showAd(): Promise<WatchResult> {
  try {
    const c = await getController()
    await c.show()
    return 'watched'
  } catch (e: unknown) {
    const desc = String((e as any)?.description ?? (e as any)?.message ?? '')
    if (/no ad|not found|no_ad|empty/i.test(desc)) return 'no_ad'
    return 'error'
  }
}
