import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../backend/src/**/*.{ts,tsx}",
    "../../packages/shared/src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"],
        display: ["Clash Display", "Inter", "sans-serif"]
      },
      colors: {
        background: "#070815",
        surface: "#101122",
        primary: {
          50: "#edf2ff",
          100: "#d7e1ff",
          200: "#b0c2ff",
          300: "#889fff",
          400: "#5f70ff",
          500: "#4040ff",
          600: "#3026db",
          700: "#2519ae",
          800: "#1c147f",
          900: "#120b4d"
        },
        accent: "#00f5d4",
        success: "#21fa90",
        warning: "#ffb347",
        danger: "#ff5c8a"
      },
      boxShadow: {
        glow: "0 0 25px rgba(64,64,255,0.35)"
      },
      backgroundImage: {
        "grid-glow": "radial-gradient(circle at top left, rgba(64,64,255,0.4), transparent 55%), radial-gradient(circle at bottom right, rgba(0,245,212,0.35), transparent 50%)"
      }
    }
  },
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/typography")
  ]
};

export default config;
