/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        azure: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#0078d4',
          600: '#005a9e',
          700: '#004578',
        },
        sidebar: {
          DEFAULT: '#1a1a2e',
          light: '#16213e',
        }
      }
    },
  },
  plugins: [],
}