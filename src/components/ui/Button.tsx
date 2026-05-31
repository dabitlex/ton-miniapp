// src/components/ui/Button.tsx
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

  const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer select-none'

  const sizes = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-10 px-4 text-sm',
    lg: 'h-12 px-6 text-base',
  }

  const variants = {
    primary:     'text-white',
    secondary:   'text-white/80',
    ghost:       'text-white/60',
    destructive: 'text-rose-300',
    gold:        'text-amber-100',
  }

  const styles: Record<string, React.CSSProperties> = {
    primary: {
      background: 'linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)',
      boxShadow:  '0 4px 20px rgba(124,58,237,0.35)',
    },
    secondary: {
      background: 'rgba(255,255,255,0.07)',
      border:     '1px solid rgba(255,255,255,0.1)',
    },
    ghost: {
      background: 'transparent',
      border:     '1px solid rgba(255,255,255,0.08)',
    },
    destructive: {
      background: 'rgba(244,63,94,0.12)',
      border:     '1px solid rgba(244,63,94,0.25)',
    },
    gold: {
      background: 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)',
      boxShadow:  '0 4px 20px rgba(245,158,11,0.3)',
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
