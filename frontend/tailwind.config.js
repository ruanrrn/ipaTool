/** @type {import('tailwindcss').Config} */
export default {
  content: {
    files: [
      './frontend/index.html',
      './frontend/**/*.{vue,js,ts,jsx,tsx}',
    ],
    transform: {
      js: (content) => content.replace(/\/\[[^\n]*?\]\//g, ''),
      ts: (content) => content.replace(/\/\[[^\n]*?\]\//g, ''),
    },
  },
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        /* Orbit v3 Brand */
        brand: {
          DEFAULT: '#10a37f',
          hover: '#0e8c6b',
          active: '#0c7a5e',
          soft: '#ecfdf5',
          border: '#a7f3d0',
        },
        /* Semantic */
        success: {
          DEFAULT: '#10a37f',
          soft: '#ecfdf5',
          border: '#a7f3d0',
        },
        warning: {
          DEFAULT: '#f59e0b',
          hover: '#d97706',
          soft: '#fef3c7',
          border: '#fde68a',
          bg: '#fff8e1',
        },
        danger: {
          DEFAULT: '#ef4444',
          hover: '#dc2626',
          soft: '#fef2f2',
        },
        /* Text */
        txt: {
          DEFAULT: '#0d0d0d',
          secondary: '#6e6e80',
          tertiary: '#c0c0c0',
          disabled: '#d1d5db',
          link: '#10a37f',
          tag: '#065f46',
          dark: '#f5f5f5',
          'dark-secondary': '#a1a1aa',
          'dark-tertiary': '#71717a',
        },
        /* Surface */
        surface: {
          DEFAULT: '#f7f7f8',
          hover: '#ececec',
          white: '#ffffff',
          page: '#f0f0f0',
          tag: '#e5e7eb',
          dark: '#18181b',
          'dark-muted': '#27272a',
          'dark-page': '#09090b',
        },
        /* Border */
        bdr: {
          light: '#f0f0f0',
          DEFAULT: '#ebebeb',
          divider: '#d1d1d6',
          subtle: '#d1d5db',
          dark: '#3f3f46',
          'dark-light': '#27272a',
        },
        /* Overlay */
        overlay: {
          sheet: 'rgba(0, 0, 0, 0.4)',
          dialog: 'rgba(0, 0, 0, 0.5)',
        },
        /* Accent color options (for theme picker) */
        accent: {
          green: '#10a37f',
          blue: '#3b82f6',
          purple: '#8b5cf6',
          amber: '#f59e0b',
          red: '#ef4444',
          black: '#0d0d0d',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'SF Pro Display', 'Helvetica Neue', 'sans-serif'],
      },
      fontSize: {
        'nano': ['10px', { lineHeight: '1.2' }],
        'micro': ['11px', { lineHeight: '1.3' }],
        'caption': ['12px', { lineHeight: '1.3' }],
        'label': ['13px', { lineHeight: '1.4' }],
        'body': ['14px', { lineHeight: '1.45' }],
        'section': ['15px', { lineHeight: '1.4' }],
        'heading': ['17px', { lineHeight: '1.3' }],
        'title': ['26px', { lineHeight: '1.3' }],
        'status-bar': ['15px', { lineHeight: '1' }],
      },
      fontWeight: {
        regular: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
      },
      borderRadius: {
        'xs': '2px',
        'sm': '4px',
        'md': '6px',
        'DEFAULT': '8px',
        'lg': '10px',
        'xl': '12px',
        '2xl': '14px',
        '3xl': '18px',
        'sheet': '20px',
      },
      spacing: {
        '0.5': '2px',
        '1': '4px',
        '1.5': '6px',
        '2': '8px',
        '2.5': '10px',
        '3': '12px',
        '3.5': '14px',
        '4': '16px',
        '5': '20px',
        '6': '24px',
        '7': '28px',
        '8': '32px',
        '10': '40px',
      },
      boxShadow: {
        'dialog': '0 20px 40px rgba(0, 0, 0, 0.15)',
        'search-focus': '0 0 0 3px rgba(16, 163, 127, 0.1)',
        'segment-active': '0 1px 3px rgba(0, 0, 0, 0.08)',
      },
      keyframes: {
        'sheet-slide-up': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'dialog-fade-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'skeleton-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
      },
      animation: {
        'sheet-slide-up': 'sheet-slide-up 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
        'dialog-fade-in': 'dialog-fade-in 0.2s ease-out',
        'skeleton-pulse': 'skeleton-pulse 1.5s ease-in-out infinite',
      },
      transitionTimingFunction: {
        DEFAULT: 'ease',
      },
    },
  },
  plugins: [],
}
