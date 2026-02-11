/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        obsidian: {
          DEFAULT: "#050505",
          surface: "#0c0c0c",
          lighter: "#111111",
        },
        phosphor: {
          DEFAULT: "#00ff41",
          dim: "rgba(0, 255, 65, 0.15)",
          glow: "rgba(0, 255, 65, 0.3)",
          muted: "rgba(0, 255, 65, 0.05)",
        },
        loss: "#ff3e3e",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      animation: {
        pulse: "pulse 2s infinite",
        scanline: "scanline 8s linear infinite",
      },
      keyframes: {
        scanline: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
      },
    },
  },
  plugins: [],
};
