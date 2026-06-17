/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { 900: '#0a1628', 800: '#1A2E4A', 700: '#243d63', 600: '#2e4d7d' },
        amber: { 400: '#FBBF24', 500: '#F59E0B', 600: '#D97706' },
        surface: '#F8FAFC',
      },
      fontFamily: {
        mono: ['"IBM Plex Mono"', 'monospace'],
        sans: ['"IBM Plex Sans"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
