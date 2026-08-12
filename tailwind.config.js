/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Warm/friendly nostalgic theme
        brand: {
          50: '#fdf8f6',
          100: '#fbeee9',
          200: '#f7ddd3',
          300: '#f0c2b1',
          400: '#e59c84',
          500: '#d97457',
          600: '#ca583b',
          700: '#aa442c',
          800: '#8c3a27',
          900: '#723223',
          950: '#3e1810',
        }
      }
    },
  },
  plugins: [],
}
