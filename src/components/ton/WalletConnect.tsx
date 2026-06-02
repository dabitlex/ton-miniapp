// src/components/ton/WalletConnect.tsx
'use client'
import { useEffect, useRef, useState }   from 'react'
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react'
import { useAuthStore }   from '@/stores/useAuthStore'
import { useUserStore }   from '@/stores/useUserStore'
import { useUIStore }     from '@/stores/useUIStore'
import { Button }         from '@/components/ui/Button'
import { CheckCircle, Wallet, LogOut, Copy } from 'lucide-react'
import type { UserProfile } from '@/types/game'

// Raw (0:hex) → UQ... (non-bounceable, Tonkeeper-Standard)
function rawToUQ(rawAddress: string): string {
  try {
    const [workchainStr, hexHash] = rawAddress.split(':')
    if (!workchainStr || !hexHash || hexHash.length !== 64) return rawAddress

    const workchain = parseInt(workchainStr)
    const hash = new Uint8Array(32)
    for (let i = 0; i < 32; i++) {
      hash[i] = parseInt(hexHash.slice(i * 2, i * 2 + 2), 16)!
    }

    // 0x51 = non-bounceable tag (UQ...)
    const addr = new Uint8Array(36)
    addr[0] = 0x51
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
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!wallet || !token) return
    const rawAddress = wallet.account.address
    if (savedRef.current === rawAddress) return
    if (profile?.wallet?.address === rawAddress) {
      savedRef.current = rawAddress; return
    }
    savedRef.current = rawAddress

    const uqAddress = rawToUQ(rawAddress)

    const save = async () => {
      try {
        const res = await fetch('/api/v1/users/wallet', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            address:         rawAddress,
            addressFriendly: uqAddress,
            walletVersion:   wallet.device?.appName ?? null,
            publicKey:       wallet.account.publicKey ?? null,
          }),
        })
        const json = await res.json()
        if (!json.success) throw new Error(json.error)

        const profileRes  = await fetch('/api/v1/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const profileJson = await profileRes.json()
        if (profileJson.success) setProfile(profileJson.data as UserProfile)

        toast('success', '✅ Wallet connected!')
        haptic('success')
        onConnected?.()
      } catch {
        toast('error', 'Could not save wallet')
      }
    }
    save()
  }, [wallet?.account.address]) // eslint-disable-line

  async function disconnect() {
    try {
      await tonConnectUI.disconnect()
      await fetch('/api/v1/users/wallet', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      savedRef.current = null
      const res  = await fetch('/api/v1/users/me', { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      if (json.success) setProfile(json.data as UserProfile)
      toast('info', 'Wallet disconnected')
    } catch { /* silent */ }
  }

  // ── Connected ───────────────────────────────────────────────
  if (wallet) {
    const uqAddr   = rawToUQ(wallet.account.address)
    const short    = `${uqAddr.slice(0, 8)}…${uqAddr.slice(-6)}`
    const appName  = wallet.device?.appName ?? 'Wallet'
    const isMainnet= wallet.account.chain === '-239'

    return (
      <div className="space-y-3">
        <div className="surface p-4" style={{ background: "rgba(52,211,153,0.08)", boxShadow: "inset 0 0 0 1px rgba(52,211,153,0.25)" }}>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={14} className="text-emerald-400 shrink-0" />
            <span className="text-xs font-semibold text-emerald-300">{appName} connected</span>
            {isMainnet
              ? <span className="ml-auto text-[10px] text-emerald-400/70">Mainnet ✓</span>
              : <span className="ml-auto text-[10px] text-amber-400">⚠ Testnet</span>
            }
          </div>

          <div className="flex items-center gap-3">
            {wallet.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={wallet.imageUrl} alt={appName}
                className="w-9 h-9 rounded-xl shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-mono font-bold text-white">{short}</p>
              <p className="text-[10px] text-white/30 font-mono truncate">{uqAddr}</p>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(uqAddr).then(() => {
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                })
              }}
              className="shrink-0 p-1.5 rounded-lg bg-white/[0.06]
                         text-white/40 hover:text-white/70 transition-colors">
              {copied
                ? <CheckCircle size={13} className="text-emerald-400" />
                : <Copy size={13} />
              }
            </button>
          </div>
        </div>

        <button onClick={disconnect}
          className="w-full flex items-center justify-center gap-2
                     text-xs text-white/25 hover:text-white/50 py-1 transition-colors">
          <LogOut size={11} /> Disconnect Wallet
        </button>
      </div>
    )
  }

  // ── Nicht connected ─────────────────────────────────────────
  return (
    <div className="space-y-3">
      <div className="surface p-4 space-y-3">
        <div className="text-center space-y-2">
          <div className="w-11 h-11 rounded-2xl
                          flex items-center justify-center mx-auto"
            style={{ background: 'rgba(91,141,239,0.12)', boxShadow: 'inset 0 0 0 1px rgba(91,141,239,0.25)' }}>
            <Wallet size={18} style={{ color: '#5B8DEF' }} />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Connect TON Wallet</p>
            <p className="text-xs text-white/40 mt-0.5 leading-relaxed">
              Connect your wallet to receive season rewards
            </p>
          </div>
        </div>

        <div className="space-y-1.5 text-left">
          {[
            { icon: '💰', text: 'Token rewards at season end' },
            { icon: '🔓', text: 'Unlock referral system (from 2,000 XP)' },
            { icon: '⚡', text: 'Activate Ecosystem XP Boost' },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-2 text-xs text-white/40">
              <span>{icon}</span><span>{text}</span>
            </div>
          ))}
        </div>
      </div>

      <Button fullWidth onClick={() => tonConnectUI.openModal()}>
        <Wallet size={14} /> Connect Wallet
      </Button>

      <p className="text-center text-[10px] text-white/20">
        Tonkeeper · MyTonWallet · Wallet · OpenMask · und mehr
      </p>
    </div>
  )
}
