import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
  getModelName,
  updateModelName,
  getPersistedModelName,
  persistModelName,
} from "../util/modelPersistence.js";

describe("Model Persistence Integration", () => {
  let testDir: string;
  let originalContinueHome: string | undefined;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "continue-test-"));
    originalContinueHome = process.env.CONTINUE_GLOBAL_DIR;
    process.env.CONTINUE_GLOBAL_DIR = testDir;

    persistModelName(null);
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
    if (originalContinueHome) {
      process.env.CONTINUE_GLOBAL_DIR = originalContinueHome;
    } else {
      delete process.env.CONTINUE_GLOBAL_DIR;
    }
  });

  test("should persist model name when user selects a model", () => {
    updateModelName("Claude 3.5 Sonnet");

    expect(getModelName()).toBe("Claude 3.5 Sonnet");
  });

  test("should update model name when user switches models", () => {
    updateModelName("GPT-4");
    expect(getModelName()).toBe("GPT-4");

    updateModelName("Claude 3.5 Sonnet");

    expect(getModelName()).toBe("Claude 3.5 Sonnet");
  });

  test("should clear model name when set to null", () => {
    updateModelName("GPT-4");
    expect(getModelName()).toBe("GPT-4");

    updateModelName(null);

    expect(getModelName()).toBeNull();
  });

  test("should return null for model name when no model persisted", () => {
    persistModelName(null);
    expect(getModelName()).toBeNull();
  });

  test("should persist model name via GlobalContext", () => {
    updateModelName("Claude 3.5 Sonnet");

    expect(getPersistedModelName()).toBe("Claude 3.5 Sonnet");
    expect(getModelName()).toBe("Claude 3.5 Sonnet");
  });
});
