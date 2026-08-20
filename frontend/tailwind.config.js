/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--bg)",
        surface: "var(--surface)",
        "surface-container-lowest": "#010f1f",
        "surface-container-low": "#0d1c2d",
        "surface-container": "#122131",
        "surface-container-high": "#1c2b3c",
        "surface-container-highest": "#273647",
        "surface-variant": "#273647",
        "surface-bright": "#2c3a4c",
        primary: "#b7c4ff",
        "primary-container": "#3e63dd",
        "on-primary": "#002681",
        "on-primary-container": "#eeeeff",
        secondary: "#dfb7ff",
        "secondary-container": "#65219c",
        "on-secondary": "#4b007e",
        "on-secondary-container": "#d3a0ff",
        tertiary: "#c5c6ce",
        "tertiary-container": "#6b6c74",
        "on-surface": "#d4e4fa",
        "on-surface-variant": "#c4c5d6",
        "outline-variant": "#444654",
        outline: "#8e909f",
        error: "#ffb4ab",
        "error-container": "#93000a",
        graphite: "var(--bg)",
        void: "var(--bg)",
        canary: "var(--accent)",
        accent: "var(--accent)",
        frost: "var(--text)",
        glass: {
          border: "var(--glass-border)",
          fill: "var(--glass-fill)",
          fillStrong: "var(--glass-fill-strong)",
        },
      },
      fontFamily: {
        display: ["IBM Plex Sans", "system-ui", "sans-serif"],
        sans: ["IBM Plex Sans", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "JetBrains Mono", "ui-monospace", "monospace"],
        label: ["IBM Plex Sans", "sans-serif"],
      },
      boxShadow: {
        glass: "var(--shadow-glass)",
        canary: "var(--shadow-accent)",
        active: "var(--shadow-active)",
      },
      backdropBlur: {
        glass: "22px",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "pulse-glow": {
          "0%, 100%": {
            opacity: "1",
            transform: "scale(1)",
            filter: "drop-shadow(0 0 8px rgba(62, 99, 221, 0.35))",
          },
          "50%": {
            opacity: "0.85",
            transform: "scale(1.02)",
            filter: "drop-shadow(0 0 18px rgba(62, 99, 221, 0.65))",
          },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-5px)" },
        },
        "pop-in": {
          "0%": { transform: "scale(0.96) translateY(8px)", opacity: "0" },
          "100%": { transform: "scale(1) translateY(0)", opacity: "1" },
        },
        "slide-up": {
          "0%": { transform: "translateY(12px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "slide-down": {
          "0%": { transform: "translateY(-12px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "spin-slow": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
      },
      animation: {
        shimmer: "shimmer 2.2s infinite linear",
        "pulse-glow": "pulse-glow 3s infinite ease-in-out",
        float: "float 4s infinite ease-in-out",
        pop: "pop-in 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "slide-up": "slide-up 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "slide-down": "slide-down 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "spin-slow": "spin-slow 10s linear infinite",
      },
      borderRadius: {
        soft: "1rem",
        glass: "1rem",
        control: "0.65rem",
      },
    },
  },
  plugins: [],
};

