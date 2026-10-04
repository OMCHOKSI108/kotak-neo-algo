/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: "#0B0E14",
          card: "#151922",
          border: "#232936",
          hover: "#1D2330",
          text: "#E2E8F0",
          muted: "#94A3B8"
        },
        trade: {
          green: "#10B981",
          greenMuted: "rgba(16, 185, 129, 0.15)",
          red: "#EF4444",
          redMuted: "rgba(239, 68, 68, 0.15)",
          blue: "#3B82F6",
          blueMuted: "rgba(59, 130, 246, 0.15)",
          yellow: "#F59E0B"
        }
      }
    },
  },
  plugins: [],
}
