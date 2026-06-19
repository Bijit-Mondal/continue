import chalk from "chalk";

import { logoGradient } from "./constants/theme.js";
import { getVersion } from "./version.js";

const d = chalk.dim;

// Compact solid Tezz mark (~8 lines), filled with block chars for gradient rendering.
const TEZZ_LOGO_LINES = `     ████████████
   ██████████████████
   ██████████████████
   ██████████████████
     ████████████████
       ████████████
         ████████
           ████`;

// Minimal fallback for very narrow terminals.
const COMPACT_LOGO_LINES = `  ████████
 ██████████
  ████████
   ████`;

function renderLogo(lines: string): string {
  return logoGradient.multiline(lines);
}

export const TEZZ_ASCII_ART = `
${renderLogo(TEZZ_LOGO_LINES)}
${d("v" + getVersion())}`;

const COMPACT_ASCII_ART = `
${renderLogo(COMPACT_LOGO_LINES)}
${d("v" + getVersion())}`;

// Minimum terminal width required to display the full ASCII art properly.
const MIN_WIDTH_FOR_ASCII_ART = 22;

/**
 * Returns the ASCII art only if the terminal is wide enough to display it properly.
 * If the terminal is too narrow, returns a minimal logo.
 */
export function getDisplayableAsciiArt(): string {
  const terminalWidth = process.stdout.columns || 80;

  if (terminalWidth >= MIN_WIDTH_FOR_ASCII_ART) {
    return TEZZ_ASCII_ART;
  }

  return COMPACT_ASCII_ART;
}
