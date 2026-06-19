import chalk from "chalk";
import gradient from "gradient-string";

/**
 * Tezz CLI color theme, mapped from the Tailwind CSS variables used by the
 * webview/ui. Values are hex so they work with both Ink components and chalk.
 */
export const theme = {
  primary: "#c9fe32",
  primaryForeground: "#1f240d",
  secondary: "#efefef",
  secondaryForeground: "#333333",
  accent: "#e6fbd5",
  accentForeground: "#1f240d",
  destructive: "#ff897f",
  destructiveForeground: "#ffffff",
  muted: "#f5f5f5",
  mutedForeground: "#666666",
  border: "#dfdfdf",
  background: "#fdfcfe",
  foreground: "#333333",
} as const;

/**
 * Chalk shortcuts for the theme, useful in non-Ink code (plain console output).
 */
export const c = {
  primary: chalk.hex(theme.primary),
  primaryForeground: chalk.hex(theme.primaryForeground),
  secondary: chalk.hex(theme.secondary),
  accent: chalk.hex(theme.accent),
  destructive: chalk.hex(theme.destructive),
  mutedForeground: chalk.hex(theme.mutedForeground),
  foreground: chalk.hex(theme.foreground),
  white: chalk.white,
  gray: chalk.gray,
};

/**
 * Multi-stop gradient for the Tezz ASCII logo — light accent through deep green,
 * applied horizontally across solid block characters (similar to Antigravity-style fills).
 */
export const logoGradient = gradient(
  "#f4ffe0",
  theme.accent,
  theme.primary,
  "#9fd618",
  "#4a7a0a",
);
