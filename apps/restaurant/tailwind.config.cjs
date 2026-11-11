module.exports = {
  presets: [require("../../packages/shared/tailwind.preset.cjs")],
  content: ["./index.html", "./src/**/*.{ts,tsx}", "../../packages/shared/src/**/*.{ts,tsx}"],
};
