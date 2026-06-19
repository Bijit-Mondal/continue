import { describe, expect, it } from "vitest";

import {
  generateModelBlockYaml,
  getDefaultOnboardingModelForProvider,
  getRecommendedModelsForProvider,
  getUsesSlug,
  modelsDevProviderToContinueProvider,
  toConfigModelId,
  resolveModelFromUsesSlug,
} from "./modelsDevBlockTemplate.js";
import { getModelsForProvider } from "./modelsDevCatalog.js";

describe("modelsDevBlockTemplate", () => {
  it("generates a resolvable anthropic model block", () => {
    const yaml = generateModelBlockYaml("anthropic", "claude-sonnet-4-6");

    expect(yaml).toBeDefined();
    expect(yaml).toContain("provider: anthropic");
    expect(yaml).toContain("model: claude-sonnet-4-6");
    expect(yaml).toContain("${{ inputs.ANTHROPIC_API_KEY }}");
  });

  it("maps google provider models to gemini", () => {
    const yaml = generateModelBlockYaml("google", "gemini-2.5-pro");

    expect(yaml).toContain("provider: gemini");
    expect(yaml).toContain("${{ inputs.GEMINI_API_KEY }}");
  });

  it("maps models.dev provider IDs to the correct Continue provider names", () => {
    expect(modelsDevProviderToContinueProvider("xai")).toBe("xAI");
    expect(modelsDevProviderToContinueProvider("zai")).toBe("zAI");
    expect(modelsDevProviderToContinueProvider("moonshotai")).toBe("moonshot");
    expect(modelsDevProviderToContinueProvider("togetherai")).toBe("together");
    expect(modelsDevProviderToContinueProvider("fireworks-ai")).toBe(
      "fireworks",
    );
    expect(modelsDevProviderToContinueProvider("novita-ai")).toBe("novita");
    expect(modelsDevProviderToContinueProvider("amazon-bedrock")).toBe(
      "bedrock",
    );
    expect(modelsDevProviderToContinueProvider("deepseek")).toBe("deepseek");
    expect(modelsDevProviderToContinueProvider("google-vertex-anthropic")).toBe(
      "vertexai",
    );
  });

  it("returns one recommended model for onboarding", () => {
    const models = getRecommendedModelsForProvider("anthropic");
    expect(models.length).toBe(1);
    expect(getUsesSlug("anthropic", models[0].id)).toMatch(/^anthropic\//);
  });

  it("selects default onboarding models from models.dev metadata", () => {
    for (const providerId of ["anthropic", "openai", "google"] as const) {
      const defaultModel = getDefaultOnboardingModelForProvider(providerId);
      const rankedModels = getRecommendedModelsForProvider(providerId, 5);

      expect(defaultModel).toBeDefined();
      expect(defaultModel?.id).toBe(rankedModels[0]?.id);
      expect(defaultModel?.toolCall).toBe(true);
      expect(defaultModel?.reasoning).toBe(true);
      expect(defaultModel?.contextLength ?? 0).toBeGreaterThanOrEqual(100_000);
    }

    expect(getDefaultOnboardingModelForProvider("anthropic")?.id).toMatch(
      /claude/i,
    );
    expect(getDefaultOnboardingModelForProvider("openai")?.id).toMatch(
      /gpt|^o/i,
    );
    expect(getDefaultOnboardingModelForProvider("google")?.id).toMatch(
      /gemini/i,
    );
  });

  it("selects a default OpenRouter model from the models.dev catalog", () => {
    const defaultModel = getDefaultOnboardingModelForProvider("openrouter");

    expect(defaultModel).toBeDefined();
    expect(defaultModel?.provider).toBe("openrouter");
    expect(defaultModel?.toolCall).toBe(true);
    expect(defaultModel?.reasoning).toBe(true);
    expect(defaultModel?.id).toMatch(/^~?anthropic\//);
  });

  it("normalizes OpenRouter model ids for config slugs", () => {
    expect(
      toConfigModelId("openrouter", "~anthropic/claude-fable-latest"),
    ).toBe("anthropic/claude-fable-latest");
    expect(getUsesSlug("openrouter", "~anthropic/claude-fable-latest")).toBe(
      "anthropic/claude-fable-latest",
    );
    expect(getUsesSlug("openrouter", "z-ai/glm-5.2")).toBe("z-ai/glm-5.2");
  });

  it("resolves OpenRouter uses slugs from config inputs", () => {
    expect(
      resolveModelFromUsesSlug("anthropic/claude-fable-latest", {
        OPENROUTER_API_KEY: "sk-or-test",
      }),
    ).toEqual({
      providerId: "openrouter",
      modelId: "anthropic/claude-fable-latest",
    });
    expect(
      resolveModelFromUsesSlug("anthropic/claude-sonnet-4-6", {
        ANTHROPIC_API_KEY: "sk-ant-test",
      }),
    ).toEqual({
      providerId: "anthropic",
      modelId: "claude-sonnet-4-6",
    });
  });

  it("prefers flagship models over lightweight variants when ranking", () => {
    const openaiModels = getModelsForProvider("openai");
    const ranked = getRecommendedModelsForProvider("openai", 5);
    const lightweight = ranked.filter((model) =>
      /nano|mini|flash|haiku|lite|small/i.test(model.id),
    );

    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked[0]?.id).not.toMatch(/nano|mini|flash|haiku|lite|small/i);
    if (lightweight.length > 0) {
      expect(ranked.indexOf(lightweight[0]!)).toBeGreaterThan(0);
    }
    expect(openaiModels.length).toBeGreaterThan(ranked.length);
  });
});
