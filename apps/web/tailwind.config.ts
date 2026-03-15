import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "wiz-blue": "#0254EC",
        "purplish-pink": "#FFBFFF",
        "cloudy-white": "#FFFFFF",
        "serious-blue": "#00123F",
        "blue-shadow": "#173AAA",
        "sky-blue": "#6197FF",
        "light-sky-blue": "#978BFF",
        "pink-shadow": "#C64BA4",
        "vibrant-pink": "#FF0BBE",
        "frosting-pink": "#FFBFD6",
        "surprising-yellow": "#FFFF00",
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
        sans: ["Inter", "sans-serif"],
      },
      animation: {
        flip: "flip 0.6s ease-in-out",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "card-hover": "card-hover 0.2s ease-out forwards",
      },
      keyframes: {
        flip: {
          "0%": { transform: "rotateY(0deg)" },
          "100%": { transform: "rotateY(180deg)" },
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 8px 2px currentColor" },
          "50%": { boxShadow: "0 0 20px 6px currentColor" },
        },
        "card-hover": {
          "0%": { transform: "translateY(0px) scale(1)" },
          "100%": { transform: "translateY(-4px) scale(1.02)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
