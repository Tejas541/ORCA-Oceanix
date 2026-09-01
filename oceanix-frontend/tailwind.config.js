/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        oceanix: {
          blue: '#2563eb',
          emerald: '#10b981',
          bg: '#F9FAFB',
        }
      },
      backgroundImage: {
        'grid-dot': "radial-gradient(#cbd5e1 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
}