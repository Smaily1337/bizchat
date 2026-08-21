/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        graphite: "var(--bg)",
        canary: "var(--accent)",
        glass: {
          border: "var(--glass-border)",
          fill: "var(--glass-fill)",
          fillStrong: "var(--glass-fill-strong)",
        },
      },
      fontFamily: {
        display: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glass:
          "0 8px 32px rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.14)",
      },
      backdropBlur: {
        glass: "22px",
      },
      borderRadius: {
        glass: "1.25rem",
      },
    },
  },
  plugins: [],
};
