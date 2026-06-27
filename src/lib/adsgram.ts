// src/lib/adsgram.ts
// Adsgram Rewarded-Video SDK-Loader. Der Reward wird NICHT hier vergeben,
// sondern server-seitig über die Adsgram-Callbacks:
//   • normaler Block  -> /api/v1/ads/reward          (+50 XP)
//   • Doppel-Block    -> /api/v1/ads/double-callback  (Doppel-Gutschrift)
'use client'

type AdController = { show: () => Promise<unknown> }

declare global {
  interface Window {
    Adsgram?: { init: (opts: { blockId: string }) => AdController }
  }
}

const SDK_URL = 'https://sad.adsgram.ai/js/sad.min.js'
let sdkPromise: Promise<void> | null = null
const controllers: Record<string, AdController> = {}   // ein Controller je Block

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
export function getDoubleBlockId(): string | null {
  return process.env.NEXT_PUBLIC_ADSGRAM_DOUBLE_BLOCK_ID || null
}

async function getController(blockId: string): Promise<AdController> {
  await loadSdk()
  if (!window.Adsgram) throw new Error('Adsgram SDK nicht verfügbar')
  if (!controllers[blockId]) controllers[blockId] = window.Adsgram.init({ blockId })
  return controllers[blockId]
}

export type WatchResult = 'watched' | 'no_ad' | 'error'

async function showFor(blockId: string | null): Promise<WatchResult> {
  if (!blockId) return 'error'
  try {
    const c = await getController(blockId)
    await c.show()
    return 'watched'
  } catch (e: unknown) {
    const desc = String((e as any)?.description ?? (e as any)?.message ?? '')
    if (/no ad|not found|no_ad|empty/i.test(desc)) return 'no_ad'
    return 'error'
  }
}

// Normaler Rewarded-Ad-Block (+50 XP über den Server-Callback)
export async function showAd(): Promise<WatchResult> {
  return showFor(getBlockId())
}

// Doppel-Block: schreibt über den S2S-Callback eine Doppel-Gutschrift,
// die danach von /api/v1/quests/double verbraucht wird.
export async function showDoubleAd(): Promise<WatchResult> {
  return showFor(getDoubleBlockId())
}
