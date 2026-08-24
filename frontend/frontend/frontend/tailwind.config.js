/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // One consistent navy family — base (#0f1b33) anchors the sidebar/header,
        // mid tones drive buttons/badges/links, light tones are tint surfaces.
        navy: {
          DEFAULT: "#0f1b33",
          50: "#eef3fa",
          100: "#dbe5f4",
          200: "#bccfe9",
          300: "#90aed9",
          400: "#5c85c2",
          500: "#3d67a8",
          600: "#2b4a82",
          700: "#223a68",
          800: "#182a4d",
          900: "#0f1b33",
          950: "#0a1226",
        },
      },
    },
  },
  plugins: [],
};
