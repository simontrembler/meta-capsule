/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Option 1 — Archive graphite: cold paper + dry copper
        ink: {
          50: '#F3F1EC',
          100: '#E8E5DF',
          200: '#D4CFC6',
          300: '#B5AFA4',
          400: '#8E877C',
          500: '#6F6A63',
          600: '#56524C',
          700: '#433F3B',
          800: '#2F2C29',
          900: '#242220',
          950: '#1C1B1A',
        },
        brand: {
          50: '#F7F1EA',
          100: '#EDE0D1',
          200: '#DBC0A3',
          300: '#C59A70',
          400: '#B07F52',
          500: '#9A6B3F',
          600: '#825835',
          700: '#6A472C',
          800: '#563B27',
          900: '#473222',
          950: '#261A12',
        },
      },
      fontFamily: {
        display: ['"Fraunces"', 'ui-serif', 'Georgia', 'serif'],
        sans: ['"Satoshi"', '"General Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'capsule-in': {
          '0%': { opacity: '0', transform: 'translateY(12px) scale(0.97)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'brand-in': {
          '0%': { opacity: '0', transform: 'translateX(-10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'grid-fade': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'ring-pulse': {
          '0%, 100%': { opacity: '0.35' },
          '50%': { opacity: '0.7' },
        },
      },
      animation: {
        'capsule-in': 'capsule-in 700ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'brand-in': 'brand-in 600ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'grid-fade': 'grid-fade 900ms ease-out both',
        'ring-pulse': 'ring-pulse 3.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
