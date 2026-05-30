// src/components/ton/WalletConnect.tsx
'use client'
import { useEffect, useRef, useState }   from 'react'
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react'
import { useAuthStore }   from '@/stores/useAuthStore'
import { useUserStore }   from '@/stores/useUserStore'
import { useUIStore }     from '@/stores/useUIStore'
import { Button }         from '@/components/ui/Button'
import { CheckCircle, Wallet, LogOut, Copy, ChevronDown } from 'lucide-react'
import type { UserProfile } from '@/types/game'

// Konvertiert raw TON Adresse zu EQ... (bounceable) oder UQ... (non-bounceable)
function rawToFriendly(rawAddress: string, bounceable: boolean): string {
  try {
    const [workchainStr, hexHash] = rawAddress.split(':')
    if (!workchainStr || !hexHash || hexHash.length !== 64) return rawAddress

    const workchain = parseInt(workchainStr)
    const hash = new Uint8Array(32)
    for (let i = 0; i < 32; i++) {
      hash[i] = parseInt(hexHash.slice(i * 2, i * 2 + 2), 16)!
    }

    const tag = bounceable ? 0x11 : 0x51
    const addr = new Uint8Array(36)
    addr[0] = tag
    addr[1] = workchain & 0xff
    addr.set(hash, 2)

    let crc = 0
    for (let i = 0; i < 34; i++) {
      crc ^= addr[i]! << 8
      for (let j = 0; j < 8; j++) {
        crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1
        crc &= 0xffff
      }
    }
    addr[34] = (crc >> 8) & 0xff
    addr[35] = crc & 0xff

    return btoa(String.fromCharCode(...addr))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  } catch {
    return rawAddress
  }
}

export function WalletConnect({ onConnected }: { onConnected?: () => void }) {
  const [tonConnectUI]    = useTonConnectUI()
  const wallet            = useTonWallet()
  const token             = useAuthStore(s => s.accessToken)
  const profile           = useUserStore(s => s.profile)
  const { setProfile }    = useUserStore()
  const { toast, haptic } = useUIStore()
  const savedRef          = useRef<string | null>(null)
  const [copied, setCopied]       = useState(false)
  const [showBoth, setShowBoth]   = useState(false)
  // Nutzer-Präferenz: welches Format anzeigen (EQ oder UQ)
  const [showBounceable, setShowBounceable] = useState(false)

  useEffect(() => {
    if (!wallet || !token) return
    const rawAddress = wallet.account.address
    if (savedRef.current === rawAddress) return
    if (profile?.wallet?.address === rawAddress) {
      savedRef.current = rawAddress; return
    }
    savedRef.current = rawAddress

    const eqAddress = rawToFriendly(rawAddress, true)   // EQ...
    const uqAddress = rawToFriendly(rawAddress, false)  // UQ...

    const save = async () => {
      try {
        const res = await fetch('/api/v1/users/wallet', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            address:         rawAddress,
            addressFriendly: eqAddress,   // EQ... als Standard in DB
            walletVersion:   wallet.device?.appName ?? null,
            publicKey:       wallet.account.publicKey ?? null,
          }),
        })
        const json = await res.json()
        if (!json.success) throw new Error(json.error)
        const profileRes  = await fetch('/api/v1/users/me', { headers: { Authorization: `Bearer ${token}` } })
        const profileJson = await profileRes.json()
        if (profileJson.success) setProfile(profileJson.data as UserProfile)
        toast('success', '✅ Wallet verbunden!')
        haptic('success')
        onConnected?.()
      } catch (e: any) {
        toast('error', 'Wallet konnte nicht gespeichert werden')
      }
    }
    save()
  }, [wallet?.account.address]) // eslint-disable-line

  async function disconnect() {
    try {
      await tonConnectUI.disconnect()
      await fetch('/api/v1/users/wallet', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      savedRef.current = null
      const res  = await fetch('/api/v1/users/me', { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      if (json.success) setProfile(json.data as UserProfile)
      toast('info', 'Wallet getrennt')
    } catch { /* silent */ }
  }

  function copyAddress(addr: string) {
    navigator.clipboard.writeText(addr).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }

  // ── Verbunden ───────────────────────────────────────────────
  if (wallet) {
    const raw       = wallet.account.address
    const eqAddr    = rawToFriendly(raw, true)   // EQ... bounceable
    const uqAddr    = rawToFriendly(raw, false)  // UQ... non-bounceable
    const displayed = showBounceable ? eqAddr : uqAddr
    const short     = `${displayed.slice(0, 8)}…${displayed.slice(-6)}`
    const appName   = wallet.device?.appName ?? 'Wallet'
    const isMainnet = wallet.account.chain === '-239'

    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.07] p-4">
          {/* Header */}
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={14} className="text-emerald-400 shrink-0" />
            <span className="text-xs font-semibold text-emerald-300">{appName} verbunden</span>
            {isMainnet
              ? <span className="ml-auto text-[10px] text-emerald-400/70">Mainnet ✓</span>
              : <span className="ml-auto text-[10px] text-amber-400">⚠ Testnet</span>}
          </div>

          {/* Wallet App + Adresse */}
          <div className="flex items-center gap-3 mb-3">
            {wallet.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={wallet.imageUrl} alt={appName} className="w-9 h-9 rounded-xl shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-mono font-bold text-white leading-tight">{short}</p>
              <p className="text-[10px] text-white/30 font-mono truncate">{displayed}</p>
            </div>
            <button onClick={() => copyAddress(displayed)}
              className="shrink-0 p-1.5 rounded-lg bg-white/[0.06] text-white/40
                         hover:text-white/70 transition-colors">
              {copied
                ? <CheckCircle size={13} className="text-emerald-400" />
                : <Copy size={13} />}
            </button>
          </div>

          {/* Format-Umschalter */}
          <div className="border-t border-white/[0.06] pt-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/30">Format:</span>
              <div className="flex rounded-lg overflow-hidden border border-white/[0.08]">
                <button
                  onClick={() => setShowBounceable(false)}
                  className={`px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                    !showBounceable
                      ? 'bg-violet-500/30 text-violet-200'
                      : 'text-white/30 hover:text-white/50'
                  }`}>
                  UQ… <span className="opacity-50">(Tonkeeper)</span>
                </button>
                <button
                  onClick={() => setShowBounceable(true)}
                  className={`px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                    showBounceable
                      ? 'bg-violet-500/30 text-violet-200'
                      : 'text-white/30 hover:text-white/50'
                  }`}>
                  EQ… <span className="opacity-50">(Smart Contracts)</span>
                </button>
              </div>
            </div>
            <p className="text-[10px] text-white/20 mt-1.5 leading-relaxed">
              {showBounceable
                ? 'EQ-Adressen werden für Smart Contract Interaktionen genutzt'
                : 'UQ-Adressen werden in Tonkeeper & Wallets angezeigt'}
            </p>
          </div>
        </div>

        <button onClick={disconnect}
          className="w-full flex items-center justify-center gap-2
                     text-xs text-white/25 hover:text-white/50 py-1 transition-colors">
          <LogOut size={11} /> Wallet trennen
        </button>
      </div>
    )
  }

  // ── Nicht verbunden ─────────────────────────────────────────
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-3">
        <div className="text-center space-y-2">
          <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20
                          flex items-center justify-center mx-auto">
            <Wallet size={18} className="text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">TON Wallet verbinden</p>
            <p className="text-xs text-white/40 mt-0.5 leading-relaxed">
              Verbinde deine Wallet um Saison-Belohnungen zu empfangen
            </p>
          </div>
        </div>
        <div className="space-y-1.5 text-left">
          {[
            { icon: '💰', text: 'Token-Belohnungen am Saison-Ende' },
            { icon: '🔓', text: 'Referral-System freischalten (ab 2.000 XP)' },
            { icon: '⚡', text: 'Ecosystem XP-Boost aktivieren' },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-2 text-xs text-white/40">
              <span>{icon}</span><span>{text}</span>
            </div>
          ))}
        </div>
      </div>
      <Button fullWidth onClick={() => tonConnectUI.openModal()}>
        <Wallet size={14} /> Wallet verbinden
      </Button>
      <p className="text-center text-[10px] text-white/20">
        Tonkeeper · MyTonWallet · Wallet · OpenMask · und mehr
      </p>
    </div>
  )
}
