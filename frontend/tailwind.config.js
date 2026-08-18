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
        display: ["IBM Plex Sans", "system-ui", "sans-serif"],
        sans: ["IBM Plex Sans", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
        label: ["IBM Plex Sans", "sans-serif"],
      },
      boxShadow: {
        glass: "none",
        canary: "none",
        active: "var(--shadow-active)",
      },
      backdropBlur: {
        glass: "0px",
      },
      borderRadius: {
        soft: "0.5rem",
        glass: "0.5rem",
        control: "0.375rem",
      },
      maxWidth: {
        shell: "1120px",
      },
    },
  },
  plugins: [],
};
