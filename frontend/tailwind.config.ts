import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        accent: {
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
        },
        risk: {
          excellent: '#10b981',
          good:      '#3b82f6',
          warning:   '#f59e0b',
          high_risk: '#f97316',
          critical:  '#ef4444',
        },
        sidebar: {
          bg:         '#0b1120',
          hover:      '#162032',
          active:     '#1a2d4f',
          border:     '#1e293b',
          text:       '#94a3b8',
          textActive: '#f1f5f9',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'card':    '0 1px 3px rgba(0,0,0,.04), 0 4px 20px rgba(0,0,0,.06)',
        'card-md': '0 4px 6px rgba(0,0,0,.05), 0 10px 36px rgba(0,0,0,.10)',
        'card-lg': '0 10px 20px rgba(0,0,0,.06), 0 24px 56px rgba(0,0,0,.14)',
        'glow':    '0 0 28px rgba(99,102,241,.22)',
      },
      animation: {
        'fade-in':      'fadeIn .35s ease-out both',
        'fade-in-up':   'fadeInUp .45s ease-out both',
        'slide-right':  'slideRight .35s ease-out both',
        'slide-up':     'slideUp .4s ease-out both',
        'scale-in':     'scaleIn .3s ease-out both',
        'shimmer':      'shimmer 1.8s linear infinite',
        'ping-slow':    'ping 2s cubic-bezier(0,0,.2,1) infinite',
        'float':        'float 5s ease-in-out infinite',
        'float-slow':   'float 8s ease-in-out infinite',
        'glow-pulse':   'glowPulse 2.5s ease-in-out infinite',
        'spin-slow':    'spin 8s linear infinite',
        'border-spin':      'borderSpin 4s linear infinite',
        'slide-in-right':   'slideInRight .3s ease-out both',
        'shrink':           'shrink 4.5s linear forwards',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        fadeInUp: {
          from: { opacity: '0', transform: 'translateY(18px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        slideRight: {
          from: { opacity: '0', transform: 'translateX(-14px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(28px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.94)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-10px)' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '.5', transform: 'scale(1)' },
          '50%':      { opacity: '.9', transform: 'scale(1.08)' },
        },
        borderSpin: {
          '0%':   { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        slideInRight: {
          from: { opacity: '0', transform: 'translateX(60px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        shrink: {
          from: { width: '100%' },
          to:   { width: '0%' },
        },
      },
    },
  },
  plugins: [],
}

export default config
