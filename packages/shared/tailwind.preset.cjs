/** PolyDial design tokens — shared by both portals. */
module.exports = {
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#1E2A44", soft: "#4A5672", mute: "#7C869C" },
        paper: "#F6F7FA",
        line: "#DFE3EB",
        signal: { DEFAULT: "#0F7C72", 300: "#6FD3C6", 700: "#0A5E56" },
        live: "#F2B54B",
        danger: "#C2412D",
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ['"Instrument Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
};
