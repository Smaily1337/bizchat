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
        display: ["Fraunces", "Outfit", "Georgia", "serif"],
        sans: ["Outfit", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
        label: ["Outfit", "sans-serif"],
      },
      boxShadow: {
        glass: "var(--shadow-glass)",
        canary: "var(--shadow-accent)",
        active: "var(--shadow-active)",
      },
      backdropBlur: {
        glass: "12px",
      },
      borderRadius: {
        soft: "1rem",
        glass: "1rem",
        control: "0.65rem",
      },
      maxWidth: {
        shell: "1180px",
      },
    },
  },
  plugins: [],
};
