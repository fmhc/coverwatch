/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', "system-ui", "sans-serif"],
      },
      colors: {
        ink: "#0a0a0c",
        panel: "rgba(20,20,24,0.72)",
      },
    },
  },
  plugins: [],
};
