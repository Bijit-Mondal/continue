import { Box } from "ink";

import { theme } from "../constants/theme.js";

export const baseBoxStyles: React.ComponentProps<typeof Box> = {
  flexDirection: "column",
  paddingX: 2,
  paddingY: 1,
  borderStyle: "round",
};

const BORDER_COLOR_MAP: Record<string, string> = {
  blue: theme.primary,
  cyan: theme.accent,
  magenta: theme.destructive,
  yellow: theme.primary,
  green: theme.primary,
  red: theme.destructive,
};

export const defaultBoxStyles = (
  borderColor?: string,
  overrides?: Partial<React.ComponentProps<typeof Box>>,
): React.ComponentProps<typeof Box> => ({
  ...baseBoxStyles,
  borderColor:
    borderColor && BORDER_COLOR_MAP[borderColor]
      ? BORDER_COLOR_MAP[borderColor]
      : (borderColor ?? theme.border),
  ...overrides,
});
