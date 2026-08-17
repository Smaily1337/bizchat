/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        graphite: "var(--bg)",
        void: "var(--bg)",
        surface: "var(--surface)",
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
        glass: "none",
        canary: "0 0 20px rgba(255, 255, 255, 0.08)",
        active: "0 0 16px rgba(255, 255, 255, 0.05)",
      },
      backdropBlur: {
        glass: "16px",
      },
      borderRadius: {
        soft: "4px",
        glass: "4px",
        control: "8px",
      },
      maxWidth: {
        shell: "1440px",
      },
    },
  },
  plugins: [],
};
