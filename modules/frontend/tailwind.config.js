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
        discord: {
          base: "var(--atm-bg-base)",
          surface: "var(--atm-bg-surface)",
          sidebar: "var(--atm-bg-sidebar)",
          hover: "var(--atm-bg-hover)",
          blurple: "#5865F2",
          blurpleHover: "#4752C4",
          green: "#57F287",
          amber: "#FEE75C",
          red: "#ED4245",
          textNormal: "var(--atm-text-normal)",
          textMuted: "var(--atm-text-muted)",
          textPure: "var(--atm-text-pure)",
          border: "var(--atm-border)",
        }
      },
      fontFamily: {
        sans: ['"Inter"', '"gg sans"', 'sans-serif'],
      },
      boxShadow: {
        'kiosk': '0 8px 24px rgba(0, 0, 0, 0.45)',
        'glow': '0 0 15px rgba(88, 101, 242, 0.45)',
      }
    },
  },
  plugins: [],
}