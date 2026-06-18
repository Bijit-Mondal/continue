import { getDefaultOnboardingModelForProvider } from "core/llm/modelsDevBlockTemplate.js";
import { parse } from "yaml";

import { updateAnthropicModelInYaml } from "./yamlConfigUpdater.js";

function expectAnthropicModels(result: string, apiKey: string) {
  expect(result).toMatch(/uses: anthropic\//);
  expect(result).toContain(`ANTHROPIC_API_KEY: ${apiKey}`);
}

function countProviderModels(result: string, providerId: string): number {
  const matches = result.match(new RegExp(`uses: ${providerId}/`, "g"));
  return matches?.length ?? 0;
}

describe("updateAnthropicModelInYaml", () => {
  const testApiKey = "sk-ant-test123456789";
  const defaultAnthropicModel =
    getDefaultOnboardingModelForProvider("anthropic")?.id;

  describe("empty or invalid input", () => {
    it("should create new config from empty string", () => {
      const result = updateAnthropicModelInYaml("", testApiKey);

      expect(result).toContain("name: Main Config");
      expect(result).toContain("version: 1.0.0");
      expect(result).toContain("schema: v1");
      expect(defaultAnthropicModel).toBeTruthy();
      expect(result).toContain(`uses: anthropic/${defaultAnthropicModel}`);
      expect(countProviderModels(result, "anthropic")).toBe(1);
      expectAnthropicModels(result, testApiKey);
    });

    it("should create new config from invalid YAML", () => {
      const invalidYaml = "invalid: [yaml content";
      const result = updateAnthropicModelInYaml(invalidYaml, testApiKey);

      expect(result).toContain("name: Main Config");
      expectAnthropicModels(result, testApiKey);
    });
  });

  describe("comment preservation", () => {
    it("should preserve comments when adding new model", () => {
      const yamlWithComments = `# My Continue config
name: Main Config
version: 1.0.0
schema: v1
# List of available models
models:
  - uses: openai/gpt-4
    with:
      OPENAI_API_KEY: TEST-openai-test
`;

      const result = updateAnthropicModelInYaml(yamlWithComments, testApiKey);

      expect(result).toContain("# My Continue config");
      expect(result).toContain("# List of available models");
      expect(result).toContain("uses: openai/gpt-4");
      expectAnthropicModels(result, testApiKey);
    });

    it("should replace existing anthropic models while preserving comments", () => {
      const yamlWithComments = `# My Continue config
name: Main Config
version: 1.0.0
schema: v1
# List of available models
models:
  - uses: anthropic/claude-sonnet-4-6
    with:
      ANTHROPIC_API_KEY: old-key
`;

      const result = updateAnthropicModelInYaml(yamlWithComments, testApiKey);

      expect(result).toContain("# My Continue config");
      expect(result).toContain("# List of available models");
      expectAnthropicModels(result, testApiKey);
      expect(result).not.toContain("old-key");
    });
  });

  describe("model management", () => {
    it("should add anthropic models when none exist", () => {
      const existingConfig = `name: Main Config
version: 1.0.0
schema: v1
models:
  - uses: openai/gpt-4
    with:
      OPENAI_API_KEY: TEST-openai-test
`;

      const result = updateAnthropicModelInYaml(existingConfig, testApiKey);

      expect(result).toContain("uses: openai/gpt-4");
      expectAnthropicModels(result, testApiKey);
      expect(result).toContain("OPENAI_API_KEY: TEST-openai-test");
    });

    it("should update api key on existing anthropic models without removing them", () => {
      const existingConfig = `name: Main Config
version: 1.0.0
schema: v1
models:
  - uses: anthropic/claude-sonnet-4-6
    with:
      ANTHROPIC_API_KEY: old-anthropic-key
  - uses: anthropic/claude-opus-4-6
    with:
      ANTHROPIC_API_KEY: old-anthropic-key
  - uses: openai/gpt-4
    with:
      OPENAI_API_KEY: TEST-openai-test
`;

      const result = updateAnthropicModelInYaml(existingConfig, testApiKey);

      expect(result).toContain("uses: openai/gpt-4");
      expect(result).toContain("uses: anthropic/claude-sonnet-4-6");
      expect(result).toContain("uses: anthropic/claude-opus-4-6");
      expect(countProviderModels(result, "anthropic")).toBe(2);
      expect(result).toContain(`ANTHROPIC_API_KEY: ${testApiKey}`);
      expect(result).toContain("OPENAI_API_KEY: TEST-openai-test");
      expect(result).not.toContain("old-anthropic-key");
    });

    it("should handle config with no models array", () => {
      const configWithoutModels = `name: Main Config
version: 1.0.0
schema: v1
`;

      const result = updateAnthropicModelInYaml(
        configWithoutModels,
        testApiKey,
      );

      expect(result).toContain("name: Main Config");
      expect(result).toContain("models:");
      expectAnthropicModels(result, testApiKey);
    });

    it("should handle config with empty models array", () => {
      const configWithEmptyModels = `name: Main Config
version: 1.0.0
schema: v1
models: []
`;

      const result = updateAnthropicModelInYaml(
        configWithEmptyModels,
        testApiKey,
      );

      expect(result).toContain("name: Main Config");
      expectAnthropicModels(result, testApiKey);
    });
  });

  describe("structure validation", () => {
    it("should produce valid YAML that can be parsed", () => {
      const input = `# Test config
name: Test
models:
  - uses: existing/model
`;

      const result = updateAnthropicModelInYaml(input, testApiKey);

      expect(() => {
        parse(result);
      }).not.toThrow();
    });

    it("should maintain proper YAML structure", () => {
      const result = updateAnthropicModelInYaml("", testApiKey);

      expect(result).toMatch(/^name: /m);
      expect(result).toMatch(/^version: /m);
      expect(result).toMatch(/^schema: /m);
      expect(result).toMatch(/^models:/m);
      expect(result).toMatch(/^\s+- uses: /m);
      expect(result).toMatch(/^\s+with:/m);
      expect(result).toMatch(/^\s+ANTHROPIC_API_KEY: /m);
    });
  });

  describe("edge cases", () => {
    it("should handle malformed models array gracefully", () => {
      const malformedConfig = `name: Main Config
models: "not an array"
`;

      const result = updateAnthropicModelInYaml(malformedConfig, testApiKey);

      expectAnthropicModels(result, testApiKey);
    });

    it("should handle different API key formats", () => {
      const differentKeys = [
        "sk-ant-1234567890",
        "sk-ant-abcdefghijklmnop",
        "sk-ant-test-key-with-dashes",
      ];

      differentKeys.forEach((key) => {
        const result = updateAnthropicModelInYaml("", key);
        expect(result).toContain(`ANTHROPIC_API_KEY: ${key}`);
      });
    });
  });
});
