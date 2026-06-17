import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        azure: {
          DEFAULT: "#1E6BFF",
          400: "#3B8DFF",
          300: "#48A0FF",
          cyan: "#48C6FF",
        },
        ink: "#0B1B33",
        muted: "#5A6B85",
        haze: "#EAF1FF",
        line: "#E6EEFC",
        dim: "#9AA8C2",
      },
      fontFamily: {
        sans: [
          "'Plus Jakarta Sans'",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        soft: "0 8px 24px -10px rgba(30,107,255,.25)",
        qa: "0 6px 18px -8px rgba(30,107,255,.30)",
        phone: "0 30px 80px -20px rgba(20,60,140,.35)",
      },
      backgroundImage: {
        hero: "linear-gradient(135deg,#1E6BFF 0%,#3B8DFF 55%,#48C6FF 100%)",
        stage: "radial-gradient(120% 60% at 50% 0%, #DCE9FF 0%, #EAF1FF 60%)",
        inbox: "linear-gradient(120deg,#0B1B33,#1E3A6B)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
    },
  },
  plugins: [],
};

export default config;
