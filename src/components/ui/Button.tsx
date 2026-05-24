// src/components/ui/Button.tsx
import { forwardRef } from 'react'
import { cn }         from '@/lib/utils'
import { Loader2 }    from 'lucide-react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:  'primary' | 'secondary' | 'ghost' | 'destructive' | 'outline'
  size?:     'sm' | 'md' | 'lg'
  loading?:  boolean
  fullWidth?:boolean
}

const V: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:     'bg-violet-500 hover:bg-violet-400 active:bg-violet-600 text-white border-transparent shadow-[0_0_20px_rgba(139,92,246,0.25)]',
  secondary:   'bg-white/[0.07] hover:bg-white/[0.12] text-white border-white/[0.09]',
  ghost:       'bg-transparent hover:bg-white/[0.07] text-white/70 border-transparent',
  destructive: 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border-red-500/20',
  outline:     'bg-transparent hover:bg-white/[0.07] text-white border-white/20',
}
const S: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-8  px-3 text-xs  rounded-lg  gap-1.5',
  md: 'h-10 px-4 text-sm  rounded-xl  gap-2',
  lg: 'h-12 px-6 text-base rounded-2xl gap-2',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, fullWidth, className, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-semibold border',
        'transition-all duration-150 select-none',
        'disabled:opacity-40 disabled:pointer-events-none active:scale-[0.97]',
        V[variant], S[size],
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {loading && <Loader2 size={13} className="animate-spin shrink-0" />}
      {children}
    </button>
  )
)
Button.displayName = 'Button'