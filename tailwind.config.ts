// tailwind.config.ts
import type { Config } from 'tailwindcss'
import plugin from 'tailwindcss/plugin'

const config: Config = {
  darkMode: ['class'],
  content:  ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0c0c0f',
        foreground: '#f2f2f5',
      },
      height: {
        dvh: '100dvh',
      },
      animation: {
        'bounce-slow': 'bounce 1.5s infinite',
      },
      keyframes: {
        xpFloat: {
          '0%':   { transform: 'translateX(-50%) translateY(0)',     opacity: '1' },
          '60%':  { transform: 'translateX(-50%) translateY(-80px)', opacity: '1' },
          '100%': { transform: 'translateX(-50%) translateY(-120px)',opacity: '0' },
        },
      },
    },
  },
  plugins: [
    plugin(({ addUtilities }) => {
      addUtilities({
        '.h-dvh':        { height: '100dvh' },
        '.min-h-dvh':    { 'min-height': '100dvh' },
        '.pb-safe':      { 'padding-bottom': 'env(safe-area-inset-bottom)' },
        '.pt-safe':      { 'padding-top':    'env(safe-area-inset-top)'    },
        '.no-scrollbar': { '-ms-overflow-style': 'none', 'scrollbar-width': 'none' },
        '.no-scrollbar::-webkit-scrollbar': { display: 'none' },
      })
    }),
  ],
}

export default config 
