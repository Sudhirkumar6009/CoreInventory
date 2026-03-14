/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          dark:   "#1a1a2e",
          mid:    "#16213e",
          accent: "#e94560",
          light:  "#f5f5f5",
        },
        status: {
          draft:     "#94a3b8",
          waiting:   "#f59e0b",
          ready:     "#3b82f6",
          done:      "#22c55e",
          cancelled: "#ef4444",
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    }
  },
  plugins: [],
}
