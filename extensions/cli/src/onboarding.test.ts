import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { initializeWithOnboarding } from "./onboarding.js";

describe("onboarding config flag handling", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "continue-test-"));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("should fail loudly when --config points to non-existent file", async () => {
    const configPath = path.join(tempDir, "non-existent.yaml");

    expect(fs.existsSync(configPath)).toBe(false);

    await expect(initializeWithOnboarding(configPath)).rejects.toThrow(
      /Failed to load config from ".*non-existent\.yaml": .*ENOENT/,
    );
  });

  test("should fail loudly when --config points to malformed YAML file", async () => {
    const configPath = path.join(tempDir, "malformed.yaml");

    fs.writeFileSync(
      configPath,
      `
name: "Test Config"
models:
  - name: "GPT-4"
    provider: "openai"
    invalid_yaml_syntax: [unclosed array
`,
    );

    expect(fs.existsSync(configPath)).toBe(true);

    await expect(initializeWithOnboarding(configPath)).rejects.toThrow(
      /Failed to load config from ".*malformed\.yaml": .+/,
    );
  });

  test("should fail loudly when --config points to file with missing required fields", async () => {
    const configPath = path.join(tempDir, "incomplete.yaml");

    fs.writeFileSync(
      configPath,
      `
name: "Incomplete Config"
# Missing models array and other required fields
`,
    );

    expect(fs.existsSync(configPath)).toBe(true);

    await expect(initializeWithOnboarding(configPath)).rejects.toThrow(
      /^Failed to load config from ".*": .+/,
    );
  });

  test("should handle different config path formats with proper error messages", async () => {
    const testPaths = [
      "./non-existent.yaml",
      "/absolute/path/config.yaml",
      "../relative/config.yaml",
      "simple-name.yaml",
    ];

    for (const configPath of testPaths) {
      await expect(initializeWithOnboarding(configPath)).rejects.toThrow(
        /Failed to load config from ".*": .+/,
      );
    }
  });

  test("should handle empty string config path", async () => {
    await initializeWithOnboarding("");
  });

  test("should not fall back to default config when explicit config fails", async () => {
    const configPath = path.join(tempDir, "bad-config.yaml");

    fs.writeFileSync(configPath, "invalid: yaml: content: [");

    const promise = initializeWithOnboarding(configPath);

    await expect(promise).rejects.toThrow();

    try {
      await promise;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      expect(message).toMatch(/^Failed to load config from ".*": .+/);
      expect(message).toContain(configPath);
      expect(message).not.toContain("~/.tezz/config.yaml");
      expect(message).not.toContain("default config");
      expect(message).not.toContain("fallback");
    }
  });

  test("demonstrates the fix: explicit config failure vs no config provided", async () => {
    const badConfigPath = path.join(tempDir, "bad.yaml");
    fs.writeFileSync(badConfigPath, "invalid yaml [");

    await expect(initializeWithOnboarding(badConfigPath)).rejects.toThrow(
      /^Failed to load config from "/,
    );

    try {
      await initializeWithOnboarding(undefined);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      expect(errorMessage).not.toMatch(/^Failed to load config from "/);
    }
  });
});

describe("CONTINUE_USE_BEDROCK environment variable", () => {
  const mockConsoleLog = vi.fn();
  const originalEnv = process.env.CONTINUE_USE_BEDROCK;

  const mockInitialize = vi.fn().mockResolvedValue({
    config: { name: "test-config", models: [], rules: [] },
    llmApi: {},
    model: { name: "test-model" },
    mcpService: {},
    apiClient: {},
  });

  beforeEach(() => {
    mockConsoleLog.mockClear();
    mockInitialize.mockClear();

    vi.spyOn(console, "log").mockImplementation(mockConsoleLog);

    vi.doMock("./config.js", () => ({ initialize: mockInitialize }));
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.CONTINUE_USE_BEDROCK = originalEnv;
    } else {
      delete process.env.CONTINUE_USE_BEDROCK;
    }
    vi.restoreAllMocks();
    vi.doUnmock("./config.js");
  });

  test("should bypass interactive options when CONTINUE_USE_BEDROCK=1", async () => {
    process.env.CONTINUE_USE_BEDROCK = "1";

    vi.resetModules();
    const { runOnboardingFlow } = await import("./onboarding.js");

    const result = await runOnboardingFlow(undefined);

    expect(result).toBe(true);
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining(
        "✓ Using AWS Bedrock (CONTINUE_USE_BEDROCK detected)",
      ),
    );
  });

  test("should not bypass when CONTINUE_USE_BEDROCK is not '1'", async () => {
    process.env.CONTINUE_USE_BEDROCK = "0";

    vi.resetModules();
    const { runOnboardingFlow } = await import("./onboarding.js");

    const originalIsTTY = process.stdin.isTTY;
    process.stdin.isTTY = false;

    try {
      await runOnboardingFlow(undefined);

      const allCalls = mockConsoleLog.mock.calls.flat();
      const hasBedrockMessage = allCalls.some((call) =>
        String(call).includes(
          "✓ Using AWS Bedrock (CONTINUE_USE_BEDROCK detected)",
        ),
      );
      expect(hasBedrockMessage).toBe(false);
    } finally {
      process.stdin.isTTY = originalIsTTY;
    }
  });
});
