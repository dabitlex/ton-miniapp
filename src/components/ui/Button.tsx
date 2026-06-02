// src/components/ui/Button.tsx — Redesigned (Aurora OS)
'use client'
import { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'gold'
  size?:    'sm' | 'md' | 'lg'
  loading?: boolean
  fullWidth?:boolean
  children: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'primary', size = 'md', loading = false,
  fullWidth = false, children, className, disabled, ...props
}, ref) => {

  const base = 'relative inline-flex items-center justify-center gap-2 font-bold rounded-2xl transition-transform duration-200 active:scale-[0.96] disabled:opacity-40 disabled:pointer-events-none cursor-pointer select-none overflow-hidden'

  const sizes = {
    sm: 'h-9 px-3.5 text-xs',
    md: 'h-11 px-5 text-sm',
    lg: 'h-[52px] px-6 text-base',
  }

  const variants = {
    primary:     'text-white',
    secondary:   'text-white/85',
    ghost:       'text-white/60',
    destructive: 'text-rose-200',
    gold:        'text-amber-50',
  }

  const styles: Record<string, React.CSSProperties> = {
    primary: {
      background: 'var(--aurora)',
      boxShadow:  '0 8px 24px rgba(124,58,237,0.34), inset 0 1px 0 rgba(255,255,255,0.22)',
    },
    secondary: {
      background: 'var(--surface-2)',
      boxShadow:  'inset 0 1px 0 var(--edge-light)',
    },
    ghost: {
      background: 'transparent',
      boxShadow:  'inset 0 0 0 1px var(--border)',
    },
    destructive: {
      background: 'rgba(244,63,94,0.14)',
      boxShadow:  'inset 0 0 0 1px rgba(244,63,94,0.28)',
    },
    gold: {
      background: 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)',
      boxShadow:  '0 8px 24px rgba(245,158,11,0.3), inset 0 1px 0 rgba(255,255,255,0.25)',
    },
  }

  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(base, sizes[size], variants[variant], fullWidth && 'w-full', className)}
      style={styles[variant]}
      {...props}
    >
      {loading
        ? <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
        : children
      }
    </button>
  )
})
Button.displayName = 'Button'
