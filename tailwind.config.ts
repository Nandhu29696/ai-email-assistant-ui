import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      keyframes: {
        "slide-in-right": {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
      },
      animation: {
        "slide-in-right": "slide-in-right 0.25s ease-out",
      },
      colors: {
        brand: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
        },
        sentiment: {
          positive: "#22c55e",
          neutral: "#94a3b8",
          negative: "#ef4444",
        },
        priority: {
          critical: "#dc2626",
          high: "#f97316",
          medium: "#eab308",
          low: "#22c55e",
        },
      },
    },
  },
  plugins: [],
};

export default config;
