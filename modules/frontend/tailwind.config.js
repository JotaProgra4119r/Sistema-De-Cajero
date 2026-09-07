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
          base: "#202225",      // Deep Charcoal
          surface: "#2F3136",   // Elevated Slate
          sidebar: "#36393F",   // Muted Slate
          hover: "#40444B",     // Interactive Hover
          blurple: "#5865F2",   // Primary Trigger / Confirm
          blurpleHover: "#4752C4",
          green: "#57F287",     // Success / Enter / Mint
          amber: "#FEE75C",     // Warning / Limit Approaching
          red: "#ED4245",       // Danger / Cancel / Clear
          textNormal: "#DCDDDE",
          textMuted: "#B9BBBE",
          textPure: "#FFFFFF",
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