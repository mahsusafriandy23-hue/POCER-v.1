import type { Config } from "tailwindcss";

// POCER Admin — indigo "control panel" identity (distinct from the azure client app).
// Token NAMES are kept the same as the other apps (azure/ink/haze/…) so shared
// components restyle automatically; only the VALUES shift to indigo/slate.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // "azure" token now carries the indigo accent.
        azure: {
          DEFAULT: "#4F46E5", // indigo-600
          400: "#6366F1", // indigo-500
          300: "#818CF8", // indigo-400
          cyan: "#7C3AED", // violet-600 (gradient tail)
        },
        ink: "#0B1020", // near-black slate for sidebar/dark chrome
        muted: "#5A6478",
        haze: "#EEF0FF", // soft indigo tint for chips/soft buttons
        line: "#E7E9F5",
        dim: "#9AA1BC",
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
        soft: "0 8px 24px -10px rgba(79,70,229,.22)",
        qa: "0 6px 18px -8px rgba(79,70,229,.30)",
        phone: "0 30px 80px -20px rgba(20,24,60,.35)",
        card: "0 1px 2px rgba(16,20,40,.04), 0 8px 24px -16px rgba(16,20,40,.12)",
      },
      backgroundImage: {
        hero: "linear-gradient(135deg,#4F46E5 0%,#6366F1 55%,#7C3AED 100%)",
        stage: "radial-gradient(120% 60% at 50% 0%, #EDEEFB 0%, #F5F6FB 60%)",
        inbox: "linear-gradient(120deg,#0B1020,#27235C)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
    },
  },
  plugins: [],
};

export default config;
