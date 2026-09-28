// =====================================================================
// PLOTRAS — Tailwind CSS Configuration
// Theme: Official Sovereign Land Registry & Legal Verification Workspace
// =====================================================================
// Pair with next/font for Inter (sans) and Fraunces (serif):
//
//   import { Inter, Fraunces } from "next/font/google";
//   const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
//   const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });
//
// Apply `${inter.variable} ${fraunces.variable}` on <body> so the
// fontFamily tokens below resolve.
// =====================================================================

import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ---- Canvas: high-density GIS terminal background ----
        canvas: {
          DEFAULT: "#141414", // primary app background
          raised: "#1A1A1A",  // cards, panels, elevated surfaces
          inset: "#0F0F0F",   // map containers, code/data wells
        },

        // ---- Institutional accent: brass / gold ----
        // Verification seals, official badges, primary CTAs.
        brass: {
          50: "#FBF3E4",
          100: "#F6E6C8",
          200: "#F0C265", // core accent — seals, badges
          300: "#DDAE59",
          400: "#B8935A", // secondary accent — borders, muted gold
          500: "#9C7A46",
          600: "#7C6138",
          700: "#5C482A",
          DEFAULT: "#F0C265",
          muted: "#B8935A",
        },

        // ---- Signal indicators: strict traffic-light system ----
        // Do not substitute other greens/yellows/reds — these map
        // directly to legal title status and must stay unambiguous.
        signal: {
          green: {
            DEFAULT: "#22C55E", // Clean Title / Safe
            bg: "#152A1E",
            border: "#1F6B3B",
          },
          yellow: {
            DEFAULT: "#EAB308", // Active Bank Lien / Encumbered
            bg: "#2A2412",
            border: "#8A6D14",
          },
          red: {
            DEFAULT: "#EF4444", // State Acquisition / High Risk Collision
            bg: "#2A1414",
            border: "#8A2222",
          },
        },

        // ---- Structural neutrals ----
        border: {
          DEFAULT: "#2A2A2A",
          subtle: "#232323",
          strong: "#3A3A3A",
        },
        foreground: {
          DEFAULT: "#EDEDED",
          muted: "#A3A3A3",
          faint: "#6B6B6B",
        },
      },

      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        serif: ["var(--font-fraunces)", "Fraunces", "Georgia", "serif"],
      },

      // Formal status cards / certificates read better with slightly
      // tighter radii than a typical consumer app — evokes stamped
      // documents rather than rounded consumer UI chrome.
      borderRadius: {
        card: "6px",
        seal: "9999px", // circular verification seals/badges
      },

      boxShadow: {
        seal: "0 0 0 1px rgba(240, 194, 101, 0.35), 0 0 24px rgba(240, 194, 101, 0.08)",
        panel: "0 1px 2px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255,255,255,0.04)",
      },

      backgroundImage: {
        // Subtle grid overlay for the GIS terminal canvas.
        "grid-overlay":
          "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
      },
      backgroundSize: {
        grid: "32px 32px",
      },
    },
  },
  plugins: [],
};

export default config;
