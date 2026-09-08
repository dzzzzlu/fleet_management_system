/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // One consistent teal-navy family. Deep tones (#15919B, #0C6478, #213A58)
        // anchor backgrounds, shadows, buttons and dark surfaces; lighter tones
        // tint surfaces and badges.
        navy: {
          DEFAULT: "#213A58",
          50: "#eef4f6",
          100: "#dce9ec",
          200: "#bcd5da",
          300: "#90b6bd",
          400: "#15919B",
          500: "#15919B",
          600: "#0C6478",
          700: "#0b5263",
          800: "#213A58",
          900: "#1c314c",
          950: "#162943",
        },
        // Teal-green gradient accents: bright teal (#09D1C7) primary, with
        // spring green (#46DFB1) and light mint (#80EE98) as highlights.
        brand: {
          50: "#effbf8",
          100: "#d9f7ef",
          200: "#b3efdd",
          300: "#80EE98",
          400: "#46DFB1",
          500: "#09D1C7",
          600: "#07a9a1",
          700: "#0C8C8F",
        },
      },
    },
  },
  plugins: [],
};
