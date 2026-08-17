/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        graphite: "var(--bg)",
        void: "var(--bg)",
        surface: "var(--surface-solid)",
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
        display: ["Geist", "Geist Sans", "system-ui", "sans-serif"],
        sans: ["Geist", "Geist Sans", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
        label: ["Fira Sans", "sans-serif"],
      },
      boxShadow: {
        glass: "var(--shadow-glass)",
        canary: "0 10px 36px rgba(255, 255, 255, 0.14)",
        active: "0 0 28px rgba(255, 255, 255, 0.1)",
      },
      backdropBlur: {
        glass: "28px",
      },
      borderRadius: {
        soft: "1.25rem",
        glass: "1.25rem",
        control: "0.9rem",
      },
      maxWidth: {
        shell: "1440px",
      },
    },
  },
  plugins: [],
};
