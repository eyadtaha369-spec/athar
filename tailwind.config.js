/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sand: "#EFECE6",      // page base
        paper: "#F7F4EE",     // raised surfaces
        ramly: "#E6DED1",     // رملي soft sand
        topy: "#A85B3E",      // terracotta
        "topy-dark": "#8C4A31",
        fahmy: "#1D1B19",     // فحمي charcoal
        ink: "#141311",       // vault black
        ramady: "#ABA59C",    // رمادي warm grey
        zeyti: "#6B7560",     // زيتي olive
        stone: "#7A736A",     // warm muted text
      },
      fontFamily: {
        display: ['"Archivo Variable"', '"Archivo"', "system-ui", "sans-serif"],
        body: ['"Archivo Variable"', '"Archivo"', "system-ui", "sans-serif"],
        ruqaa: ['"Aref Ruqaa"', '"Amiri"', "serif"],
        ar: ['"IBM Plex Sans Arabic"', "Tahoma", "sans-serif"],
      },
    },
  },
  plugins: [],
};
