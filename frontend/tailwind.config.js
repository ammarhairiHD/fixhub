/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          700: "#14532d",
          800: "#166534",
        },
      },
    },
  },
  plugins: [],
};
