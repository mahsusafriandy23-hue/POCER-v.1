import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // POCER Agen — dark OLED amber (tone: penanggak.net)
        azure: {
          DEFAULT: "#D4AF37",   // classic gold
          400:     "#E0C050",
          300:     "#EBCF6A",
          cyan:    "#F0D878",
        },
        ink:   "#F0F0FF",        // teks utama (terang di atas gelap)
        muted: "#9999AA",        // teks sekunder
        haze:  "#1A1A25",        // surface hover / card bg
        line:  "#2A2A3A",        // border
        dim:   "#55556A",        // placeholder / sangat redup
        oled:  "#0A0A0F",        // bg utama
        surface: "#111118",      // card / panel
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
        soft:  "0 8px 24px -10px rgba(212,175,55,.25)",
        qa:    "0 6px 18px -8px rgba(212,175,55,.35)",
        phone: "0 30px 80px -20px rgba(0,0,0,.60)",
      },
      backgroundImage: {
        hero:  "linear-gradient(135deg,#1C1700 0%,#2E2400 55%,#1C1700 100%)",
        stage: "radial-gradient(120% 60% at 50% 0%, #111118 0%, #0A0A0F 60%)",
        inbox: "linear-gradient(135deg,#1C1700 0%,#2E2400 60%,#1C1700 100%)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
    },
  },
  plugins: [],
};

export default config;
