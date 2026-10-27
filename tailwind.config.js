/** @type {import('tailwindcss').Config} */
// ATHAR official palette (brand guidelines). Tints/shades marked "derived" exist for surfaces and accessible small text.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sand: "#E8E1D6",        // رملي Ramly / Creamy Sand: page background
        paper: "#F3EEE6",       // derived: raised cards on sand
        ramly: "#DDD5C8",       // derived: deeper sand for image slots and hover fills
        topy: "#A67B5B",        // طوبي Toby / Earthy Terracotta: buttons, accents, highlights
        "topy-dark": "#7D5A40", // derived: toby for small text on sand and white-text fills
        "topy-deep": "#9A7253", // derived: toby for large headings and the logo on sand
        fahmy: "#1A1A1A",       // فحمي Fahmy / Deep Charcoal: text, dark sections, footer
        ink: "#1A1A1A",         // same as fahmy, used for full dark sections
        zeyti: "#6B705C",       // زيتي Zeyti / Muted Olive: secondary badges and accents
        "zeyti-dark": "#575B4A",// derived: olive for small text on sand
        ramady: "#B7B0A6",      // رمادي Ramady / Soft Gray: borders, secondary text on dark
        stone: "#66615A",       // derived from ramady: secondary text on light backgrounds
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', '"IBM Plex Sans Arabic"', "system-ui", "sans-serif"],
        display: ['"IBM Plex Sans"', '"Reem Kufi"', '"IBM Plex Sans Arabic"', "system-ui", "sans-serif"],
        kufi: ['"Reem Kufi"', '"IBM Plex Sans Arabic"', "sans-serif"],
        ar: ['"IBM Plex Sans Arabic"', '"IBM Plex Sans"', "Tahoma", "sans-serif"],
      },
    },
  },
  plugins: [],
};
