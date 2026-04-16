import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        brand: {
          crimson: "#C8102E",
          "crimson-dk": "#A50D26",
          "crimson-lt": "#FDEAED",
          sidebar: "#1A1A1A",
          surface: "#F7F7F5",
          card: "#FFFFFF",
          border: "#E8E6E0",
          text: "#1A1A1A",
          muted: "#6B6B6B",
          ink: "#111111",
        },
        track: {
          "not-ready": "#FFF3E0",
          "not-ready-border": "#D4882A",
          "not-ready-text": "#7A4D00",
          "franchise-ready": "#EDFAF3",
          "franchise-ready-border": "#1B8A4A",
          "franchise-ready-text": "#0D4D28",
          "recruitment": "#E8F0FD",
          "recruitment-border": "#1A5CB8",
          "recruitment-text": "#0C3570",
        },
        status: {
          "new-bg": "#EEF2FF",
          "new-text": "#4338CA",
          "scoring-bg": "#FEF9C3",
          "scoring-text": "#854D0E",
          "nurture-bg": "#FFF3E0",
          "nurture-text": "#7A4D00",
          "active-bg": "#EDFAF3",
          "active-text": "#0D4D28",
          "signed-bg": "#F0FDF4",
          "signed-text": "#14532D",
          "dead-bg": "#F1F5F9",
          "dead-text": "#475569",
        },
        score: {
          "weak-bg": "#FEE2E2",
          "weak-text": "#B91C1C",
          "fair-bg": "#FEF9C3",
          "fair-text": "#854D0E",
          "good-bg": "#EDFAF3",
          "good-text": "#0D4D28",
          "ready-bg": "#C8102E",
          "ready-text": "#FFFFFF",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
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
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        shimmer: "shimmer 1.5s infinite linear",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
