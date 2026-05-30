// src/components/ton/WalletConnect.tsx
'use client'
import { useEffect, useRef }               from 'react'
import { useTonConnectUI, useTonWallet }   from '@tonconnect/ui-react'
import { useAuthStore }   from '@/stores/useAuthStore'
import { useUserStore }   from '@/stores/useUserStore'
import { useUIStore }     from '@/stores/useUIStore'
import { Button }         from '@/components/ui/Button'
import { CheckCircle, Wallet, LogOut } from 'lucide-react'
import type { UserProfile } from '@/types/game'

interface Props {
  onConnected?: () => void
}

export function WalletConnect({ onConnected }: Props) {
  const [tonConnectUI]     = useTonConnectUI()
  const wallet             = useTonWallet()
  const token              = useAuthStore(s => s.accessToken)
  const profile            = useUserStore(s => s.profile)
  const { setProfile }     = useUserStore()
  const { toast, haptic }  = useUIStore()
  const savedRef           = useRef<string | null>(null)

  // Wallet-Adresse automatisch in Supabase speichern wenn verbunden
  useEffect(() => {
    if (!wallet || !token) return

    const address = wallet.account.address
    const addressFriendly = (wallet.account as any).friendlyAddress ?? null

    // Nicht nochmal speichern wenn schon gleiche Adresse
    if (savedRef.current === address) return
    if (profile?.wallet?.address === address) {
      savedRef.current = address
      return
    }

    savedRef.current = address

    const save = async () => {
      try {
        const res  = await fetch('/api/v1/users/wallet', {
          method:  'POST',
          headers: {
            Authorization:  `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            address,
            addressFriendly,
            walletVersion: wallet.device?.appName ?? null,
            publicKey:     wallet.account.publicKey ?? null,
          }),
        })
        const json = await res.json()
        if (!json.success) throw new Error(json.error)

        // Profil neu laden
        const profileRes  = await fetch('/api/v1/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const profileJson = await profileRes.json()
        if (profileJson.success) setProfile(profileJson.data as UserProfile)

        toast('success', '✅ Wallet verbunden!')
        haptic('success')
        onConnected?.()
      } catch (e: any) {
        console.error('[Wallet] Save failed:', e.message)
        toast('error', 'Wallet konnte nicht gespeichert werden')
      }
    }

    save()
  }, [wallet?.account.address]) // eslint-disable-line

  // Wallet trennen
  async function disconnect() {
    try {
      await tonConnectUI.disconnect()
      await fetch('/api/v1/users/wallet', {
        method:  'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      savedRef.current = null
      // Profil neu laden
      const res  = await fetch('/api/v1/users/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (json.success) setProfile(json.data as UserProfile)
      toast('info', 'Wallet getrennt')
    } catch { /* silent */ }
  }

  // ── Verbunden ──────────────────────────────────────────────
  if (wallet) {
    const addr     = wallet.account.address
    const friendly = (wallet.account as any).friendlyAddress ?? addr
    const short    = `${friendly.slice(0, 6)}…${friendly.slice(-6)}`
    const appName  = wallet.device?.appName ?? 'Wallet'

    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.07] p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={14} className="text-emerald-400 shrink-0" />
            <span className="text-xs font-semibold text-emerald-300">
              {appName} verbunden
            </span>
          </div>

          {/* Wallet App Icon + Name */}
          <div className="flex items-center gap-3 mb-2">
            {wallet.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={wallet.imageUrl} alt={appName}
                className="w-8 h-8 rounded-xl" />
            )}
            <div>
              <p className="text-xs font-mono text-white/70">{short}</p>
              <p className="text-[10px] text-white/30">
                {wallet.account.chain === '-239' ? 'TON Mainnet' : 'TON Testnet'}
              </p>
            </div>
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

  // ── Nicht verbunden ────────────────────────────────────────
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
            <p className="text-xs text-white/40 mt-0.5">
              Verbinde deine Wallet um Saison-Belohnungen zu empfangen
            </p>
          </div>
        </div>

        <div className="space-y-1.5 text-left">
          {[
            { icon: '💰', text: 'Token-Belohnungen am Saison-Ende' },
            { icon: '🔓', text: 'Referral-System freischalten' },
            { icon: '⚡', text: 'Ecosystem XP-Boost aktivieren' },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-2 text-xs text-white/40">
              <span>{icon}</span><span>{text}</span>
            </div>
          ))}
        </div>
      </div>

      <Button fullWidth onClick={() => tonConnectUI.openModal()}>
        <Wallet size={14} />
        Wallet verbinden
      </Button>

      <p className="text-center text-[10px] text-white/20">
        Unterstützt Tonkeeper, MyTonWallet, Wallet und alle TON Wallets
      </p>
    </div>
  )
}
