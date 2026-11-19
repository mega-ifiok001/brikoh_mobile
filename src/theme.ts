// Brikoh design tokens — lifted from the web app's Tailwind theme.
// `C` is a live object: applyMode() swaps its values between the light and dark palettes.
const LIGHT = {
  brand: "#ec6405",
  brandDark: "#c24f00",
  brand50: "#fdf1ea",
  brand100: "#fadfcc",
  ink900: "#0A100D",
  ink800: "#2e2620",
  ink700: "#3a312a",
  ink500: "#6b5f55",
  ink400: "#6f6358",
  ink300: "#85796d",
  cream50: "#fbf9f5",
  cream100: "#f5f0e8",
  cream200: "#ece3d5",
  cream300: "#dfd2bd",
  white: "#ffffff",
  leaf500: "#1e7a4f",
  leaf100: "#e2f1e9",
  gold600: "#b45309",
  gold100: "#fbf0dc",
  danger500: "#c2402f",
  danger100: "#fbe7e3",
  // extra semantic tokens
  solid: "#0A100D", // strong filled surface (selected chip, dark button)
  onSolid: "#ffffff", // text/icons on `solid`
  onBrand: "#ffffff", // text/icons on the orange brand colour
  night: "#0A100D", // surfaces that stay dark in both themes (login, hero card, cart bar)
  onNight: "#fbf9f5",
  nightMuted: "#b3a79a",
  warnBg: "#fffdf7",
  warnBorder: "#f0dcae",
};

export type Palette = { [K in keyof typeof LIGHT]: string };

const DARK: Palette = {
  brand: "#ec6405",
  brandDark: "#c24f00",
  brand50: "#2b1a0f",
  brand100: "#4a2a14",
  ink900: "#f4f0e9",
  ink800: "#e4ddd2",
  ink700: "#cfc7bb",
  ink500: "#a3998d",
  ink400: "#8d8478",
  ink300: "#837a6f",
  cream50: "#0b100d",
  cream100: "#1a221e",
  cream200: "#252e29",
  cream300: "#35413a",
  white: "#121915",
  leaf500: "#4cc38a",
  leaf100: "#133222",
  gold600: "#f0b25e",
  gold100: "#3a2a10",
  danger500: "#f0705f",
  danger100: "#3b1b17",
  solid: "#f4f0e9",
  onSolid: "#0A100D",
  onBrand: "#ffffff",
  night: "#18211c",
  onNight: "#fbf9f5",
  nightMuted: "#b3a79a",
  warnBg: "#2a2410",
  warnBorder: "#5a4a1a",
};

export type Mode = "light" | "dark";

export const C: Palette = { ...LIGHT };

export function applyMode(mode: Mode) {
  Object.assign(C, mode === "dark" ? DARK : LIGHT);
}

// Remembers where the user was when the theme changes, so the app can put them back there.
export const themeSwitch = { pending: false, path: "/" };

export const F = {
  display: "BricolageGrotesque_800ExtraBold",
  displayBold: "BricolageGrotesque_700Bold",
  regular: "Manrope_500Medium",
  semi: "Manrope_600SemiBold",
  bold: "Manrope_700Bold",
  extra: "Manrope_800ExtraBold",
};

export const R = { sm: 10, md: 14, lg: 18, xl: 24, pill: 999 };

export const shadow = {
  card: {
    shadowColor: "#211a15",
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  float: {
    shadowColor: "#0A100D",
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  brand: {
    shadowColor: "#ec6405",
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
};