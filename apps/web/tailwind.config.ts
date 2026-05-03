import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f5f5f7",
          100: "#e8e8ec",
          200: "#c8c8d1",
          300: "#9a9aa6",
          400: "#6c6c78",
          500: "#3f3f48",
          600: "#2a2a31",
          700: "#1c1c22",
          800: "#13131a",
          900: "#0a0a10",
        },
        // Accent is driven by space-separated RGB channels so Tailwind's
        // opacity modifiers (e.g. bg-accent/30) still expand correctly at
        // build time. ThemeProvider sets `--pl-accent-rgb` from the user's
        // chosen hex; `--pl-accent` (a real hex) is kept for inline styles.
        accent: {
          DEFAULT: "rgb(var(--pl-accent-rgb, 124 92 255) / <alpha-value>)",
          hover: "rgb(var(--pl-accent-hover-rgb, 111 77 255) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      boxShadow: {
        soft: "0 8px 32px -8px rgba(0,0,0,0.4)",
      },
    },
  },
  plugins: [],
} satisfies Config;
