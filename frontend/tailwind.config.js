/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        white: "var(--text-bright)",
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
        display: ["Sora", "Geist", "system-ui", "sans-serif"],
        sans: ["Sora", "Geist", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
        label: ["Sora", "sans-serif"],
      },
      boxShadow: {
        glass: "none",
        canary: "none",
        active: "none",
      },
      backdropBlur: {
        glass: "0px",
      },
      borderRadius: {
        soft: "0.75rem",
        glass: "0.75rem",
        control: "0.5rem",
      },
      maxWidth: {
        shell: "1120px",
      },
    },
  },
  plugins: [],
};
