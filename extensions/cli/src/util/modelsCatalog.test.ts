import { describe, expect, it } from "vitest";

import {
  filterCatalogModels,
  listCatalogModelsForProvider,
  resolveApiKeyForProvider,
  resolveProviderArg,
} from "./modelsCatalog.js";
import { addModelUsesToYaml } from "./yamlConfigUpdater.js";

describe("modelsCatalog", () => {
  it("resolves provider args", () => {
    expect(resolveProviderArg("anthropic")).toBe("anthropic");
    expect(resolveProviderArg("anth")).toBe("anthropic");
    expect(resolveProviderArg("openrouter")).toBe("openrouter");
  });

  it("lists models for OpenRouter", () => {
    const models = listCatalogModelsForProvider("openrouter");
    expect(models.length).toBeGreaterThan(0);
    expect(models.some((model) => model.id.includes("/"))).toBe(true);
  });

  it("lists models for a provider", () => {
    const models = listCatalogModelsForProvider("anthropic");
    expect(models.some((model) => model.id.includes("claude"))).toBe(true);
  });

  it("filters catalog models by query", () => {
    const models = listCatalogModelsForProvider("anthropic");
    const filtered = filterCatalogModels(models, "sonnet");
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((model) => model.id.includes("sonnet"))).toBe(true);
  });

  it("reads api keys from config yaml", () => {
    const previous = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    try {
      const yaml = `models:
  - uses: anthropic/claude-sonnet-4-6
    with:
      ANTHROPIC_API_KEY: sk-ant-test123456789
`;
      expect(resolveApiKeyForProvider("anthropic", yaml)).toBe(
        "sk-ant-test123456789",
      );
    } finally {
      if (previous !== undefined) {
        process.env.ANTHROPIC_API_KEY = previous;
      }
    }
  });
});

describe("addModelUsesToYaml", () => {
  it("adds a new model uses entry", () => {
    const { yaml, added } = addModelUsesToYaml(
      "",
      "anthropic",
      "claude-sonnet-4-6",
      "sk-ant-test123456789",
    );

    expect(added).toBe(true);
    expect(yaml).toContain("uses: anthropic/claude-sonnet-4-6");
    expect(yaml).toContain("ANTHROPIC_API_KEY: sk-ant-test123456789");
  });

  it("updates an existing model uses entry", () => {
    const existing = `models:
  - uses: anthropic/claude-sonnet-4-6
    with:
      ANTHROPIC_API_KEY: old-key
`;

    const { yaml, added } = addModelUsesToYaml(
      existing,
      "anthropic",
      "claude-sonnet-4-6",
      "sk-ant-new-key",
    );

    expect(added).toBe(false);
    expect(yaml).toContain("ANTHROPIC_API_KEY: sk-ant-new-key");
    expect(yaml).not.toContain("old-key");
  });

  it("adds an OpenRouter model uses entry", () => {
    const { yaml, added } = addModelUsesToYaml(
      "",
      "openrouter",
      "anthropic/claude-sonnet-4",
      "sk-or-test-key",
    );

    expect(added).toBe(true);
    expect(yaml).toContain("uses: anthropic/claude-sonnet-4");
    expect(yaml).toContain("OPENROUTER_API_KEY: sk-or-test-key");
  });

  it("adds an OpenRouter model uses entry without a provider prefix", () => {
    const { yaml, added } = addModelUsesToYaml(
      "",
      "openrouter",
      "z-ai/glm-5.2",
      "sk-or-test-key",
    );

    expect(added).toBe(true);
    expect(yaml).toContain("uses: z-ai/glm-5.2");
    expect(yaml).not.toContain("uses: openrouter/");
    expect(yaml).toContain("OPENROUTER_API_KEY: sk-or-test-key");
  });
});
