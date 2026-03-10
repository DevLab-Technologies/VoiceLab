import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/renderer/src/**/*.{js,ts,jsx,tsx}', './src/renderer/index.html'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['IBM Plex Sans Arabic', 'system-ui', 'sans-serif'],
        arabic: ['IBM Plex Sans Arabic', 'Tahoma', 'sans-serif']
      },
      colors: {
        surface: {
          DEFAULT: '#0f1117',
          50: '#1a1d27',
          100: '#1e2130',
          200: '#252836',
          300: '#2d313f',
          400: '#363a4a'
        },
        accent: {
          DEFAULT: '#6366f1',
          hover: '#818cf8',
          muted: '#4f46e5',
          light: '#a5b4fc'
        },
        success: '#22c55e',
        warning: '#f59e0b',
        danger: '#ef4444'
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        }
      }
    }
  },
  plugins: []
}

export default config
