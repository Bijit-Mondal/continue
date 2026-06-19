import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { TEZZ_ASCII_ART, getDisplayableAsciiArt } from "./asciiArt.js";

describe("asciiArt", () => {
  let originalColumns: number | undefined;

  beforeEach(() => {
    originalColumns = process.stdout.columns;
  });

  afterEach(() => {
    if (originalColumns === undefined) {
      delete (process.stdout as any).columns;
    } else {
      process.stdout.columns = originalColumns;
    }
  });

  describe("getDisplayableAsciiArt", () => {
    it("should return full ASCII art when terminal is wide enough", () => {
      process.stdout.columns = 80;
      const result = getDisplayableAsciiArt();
      expect(result).toBe(TEZZ_ASCII_ART);
    });

    it("should return compact ASCII art when terminal is too narrow", () => {
      process.stdout.columns = 20;
      const result = getDisplayableAsciiArt();

      expect(result).toContain("████████");
      expect(result).not.toBe(TEZZ_ASCII_ART);
      expect(result.length).toBeLessThan(TEZZ_ASCII_ART.length);
    });

    it("should return compact ASCII art just below the width threshold", () => {
      process.stdout.columns = 21;
      const result = getDisplayableAsciiArt();

      expect(result).toContain("████████");
      expect(result).not.toBe(TEZZ_ASCII_ART);
    });

    it("should return full ASCII art exactly at the width threshold", () => {
      process.stdout.columns = 22;
      const result = getDisplayableAsciiArt();

      expect(result).toBe(TEZZ_ASCII_ART);
    });

    it("should default to full ASCII art when columns is undefined", () => {
      delete (process.stdout as any).columns;
      const result = getDisplayableAsciiArt();

      expect(result).toBe(TEZZ_ASCII_ART);
    });

    it("should use solid block characters for gradient fill", () => {
      expect(TEZZ_ASCII_ART).toContain("█");
      expect(TEZZ_ASCII_ART).not.toContain("≈");
      expect(TEZZ_ASCII_ART).not.toContain("-");
    });
  });
});
