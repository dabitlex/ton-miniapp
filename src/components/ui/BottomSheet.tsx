// src/components/ui/BottomSheet.tsx — Aurora OS slide-up sheet (progressive disclosure)
'use client'
import { useEffect, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

/**
 * Slide-up sheet with scrim. Spring-eased entrance, ease-out exit.
 * Stays mounted during the exit animation so the transition can play.
 */
export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const [mounted, setMounted] = useState(open)   // in DOM
  const [visible, setVisible] = useState(false)  // animated in

  useEffect(() => {
    if (open) {
      setMounted(true)
      // next frame → transition plays
      const raf = requestAnimationFrame(() => setVisible(true))
      try { (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred('light') } catch {}
      return () => cancelAnimationFrame(raf)
    } else {
      setVisible(false)
      const t = setTimeout(() => setMounted(false), 340)
      return () => clearTimeout(t)
    }
  }, [open])

  if (!mounted) return null

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={title}>
      {/* Scrim */}
      <div
        onClick={onClose}
        className="absolute inset-0 transition-opacity duration-300"
        style={{
          background: 'rgba(4,4,8,0.62)',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
          opacity: visible ? 1 : 0,
        }}
      />

      {/* Sheet */}
      <div
        className="absolute left-0 right-0 bottom-0 overflow-y-auto overscroll-contain
                   [scrollbar-width:none] [-webkit-overflow-scrolling:touch]"
        style={{
          maxHeight: '86dvh',
          background: 'linear-gradient(180deg, #13121D, #0B0B13 30%)',
          borderRadius: '28px 28px 0 0',
          borderTop: '1px solid rgba(255,255,255,0.10)',
          boxShadow: '0 -24px 70px rgba(0,0,0,0.7), inset 0 1px 0 var(--edge-light)',
          padding: '8px 20px calc(22px + env(safe-area-inset-bottom, 0px))',
          transform: visible ? 'translateY(0)' : 'translateY(105%)',
          transition: visible
            ? 'transform 0.42s var(--spring)'
            : 'transform 0.30s var(--ease-out)',
        }}
      >
        {/* Grab handle */}
        <div className="w-[38px] h-1 rounded-full mx-auto mt-1.5 mb-3.5"
          style={{ background: 'rgba(255,255,255,0.16)' }} />

        {/* Header */}
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="display text-[17px] text-white">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-[34px] h-[34px] rounded-xl flex items-center justify-center press"
            style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
          >
            <X size={16} />
          </button>
        </div>

        {children}
      </div>
    </div>
  )
}
