import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sora)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-space)", "var(--font-sora)", "ui-sans-serif", "sans-serif"]
      },
      colors: {
        ink: "#09111f",
        mist: "#d9f6ff",
        glow: "#79c7ff",
        coral: "#ff8461",
        moss: "#8ad16a",
        slate: "#94a3b8"
      },
      boxShadow: {
        halo: "0 24px 80px rgba(12, 30, 58, 0.32)",
        glass: "0 14px 42px rgba(4, 10, 20, 0.24)"
      },
      backgroundImage: {
        mesh:
          "radial-gradient(circle at top left, rgba(121, 199, 255, 0.32), transparent 34%), radial-gradient(circle at top right, rgba(255, 132, 97, 0.18), transparent 28%), linear-gradient(180deg, #081019 0%, #0d1624 48%, #edf5fb 100%)"
      },
      animation: {
        drift: "drift 16s ease-in-out infinite",
        pulseSoft: "pulseSoft 3.5s ease-in-out infinite"
      },
      keyframes: {
        drift: {
          "0%, 100%": { transform: "translate3d(0, 0, 0)" },
          "50%": { transform: "translate3d(0, 18px, 0)" }
        },
        pulseSoft: {
          "0%, 100%": { opacity: "0.7", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.04)" }
        }
      }
    }
  },
  plugins: []
};

export default config;
