import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["IBM Plex Sans", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],   // 11px
        xs:   ["0.75rem",   { lineHeight: "1rem" }],    // 12px
        sm:   ["0.875rem",  { lineHeight: "1.25rem" }], // 14px
        base: ["1rem",      { lineHeight: "1.5rem" }],  // 16px
        lg:   ["1.125rem",  { lineHeight: "1.75rem" }], // 18px
        xl:   ["1.375rem",  { lineHeight: "1.75rem" }], // 22px
        "2xl":["1.75rem",   { lineHeight: "2rem" }],    // 28px
        "3xl":["2.25rem",   { lineHeight: "2.5rem" }],  // 36px
      },
      colors: {
        brand: {
          DEFAULT: "#facc15",
          hover:   "#eab308",
          subtle:  "rgba(250,204,21,0.10)",
          border:  "rgba(250,204,21,0.30)",
        },
        // Semantic — consumed via CSS variables in globals.css
        // Used as: bg-cb-page, text-cb-primary etc.
        cb: {
          // backgrounds
          page:     "var(--cb-bg-page)",
          surface:  "var(--cb-bg-surface)",
          elevated: "var(--cb-bg-elevated)",
          hover:    "var(--cb-bg-hover)",
          active:   "var(--cb-bg-active)",
          // borders
          border:        "var(--cb-border)",
          "border-strong": "var(--cb-border-strong)",
          // text
          primary:   "var(--cb-text-primary)",
          secondary: "var(--cb-text-secondary)",
          muted:     "var(--cb-text-muted)",
          disabled:  "var(--cb-text-disabled)",
        },
        // Status
        success: { DEFAULT: "#22c55e", subtle: "rgba(34,197,94,0.10)"  },
        warning: { DEFAULT: "#f59e0b", subtle: "rgba(245,158,11,0.10)" },
        danger:  { DEFAULT: "#ef4444", subtle: "rgba(239,68,68,0.10)"  },
        info:    { DEFAULT: "#3b82f6", subtle: "rgba(59,130,246,0.10)" },
      },
      borderRadius: {
        sm:   "4px",
        md:   "6px",
        lg:   "8px",
        xl:   "12px",
        "2xl":"16px",
        full: "9999px",
      },
      spacing: {
        1: "4px",
        2: "8px",
        3: "12px",
        4: "16px",
        5: "20px",
        6: "24px",
        7: "28px",
        8: "32px",
        9: "36px",
        10: "40px",
        12: "48px",
        14: "56px",
        16: "64px",
      },
      boxShadow: {
        sm: "0 1px 2px rgba(0,0,0,0.05)",
        md: "0 4px 12px rgba(0,0,0,0.08)",
        lg: "0 8px 24px rgba(0,0,0,0.12)",
        "brand-sm": "0 0 0 3px rgba(250,204,21,0.15)",
      },
      ringColor: {
        brand: "#facc15",
      },
    },
  },
  plugins: [],
};

export default config;