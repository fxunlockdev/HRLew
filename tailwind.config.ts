import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx,js,jsx,mdx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "ui-monospace", "monospace"],
      },
      colors: {
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        // HRLew raw tokens (use directly: text-brand, bg-brand-soft, etc.)
        brand: {
          DEFAULT: "var(--hl-accent)",
          soft: "var(--hl-accent-soft)",
          ink: "var(--hl-accent-ink)",
        },
        ok: "var(--hl-ok)",
        warn: "var(--hl-warn)",
        err: "var(--hl-err)",
        info: "var(--hl-info)",
      },
      borderRadius: {
        xs: "6px",
        sm: "10px",
        md: "14px",
        lg: "var(--radius)",
        xl: "28px",
        pill: "999px",
      },
      boxShadow: {
        xs: "0 1px 2px oklch(0.2 0.01 260 / 0.04)",
        sm: "0 1px 2px oklch(0.2 0.01 260 / 0.05), 0 2px 6px oklch(0.2 0.01 260 / 0.04)",
        md: "0 2px 4px oklch(0.2 0.01 260 / 0.04), 0 8px 24px oklch(0.2 0.01 260 / 0.06)",
        lg: "0 4px 12px oklch(0.2 0.01 260 / 0.06), 0 16px 40px oklch(0.2 0.01 260 / 0.08)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
