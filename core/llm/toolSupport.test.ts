import {
  isRecommendedAgentModel,
  isRecommendedAgentModelForModelConfig,
  modelSupportsNativeTools,
  PROVIDER_TOOL_SUPPORT,
} from "./toolSupport";

function modelDescription(
  provider: string,
  model: string,
  capabilities?: { tools?: boolean },
) {
  return {
    title: "test-model",
    provider,
    underlyingProviderName: provider,
    model,
    capabilities,
  };
}

describe("PROVIDER_TOOL_SUPPORT", () => {
  it("should expose continue-proxy support", () => {
    expect(typeof PROVIDER_TOOL_SUPPORT["continue-proxy"]).toBe("function");
  });

  it("should expose metadata-backed provider support", () => {
    expect(typeof PROVIDER_TOOL_SUPPORT.openai).toBe("function");
    expect(typeof PROVIDER_TOOL_SUPPORT.anthropic).toBe("function");
    expect(typeof PROVIDER_TOOL_SUPPORT.bedrock).toBe("function");
    expect(typeof PROVIDER_TOOL_SUPPORT.openrouter).toBe("function");
  });

  it("should return metadata-backed values for direct providers", () => {
    expect(PROVIDER_TOOL_SUPPORT.openai("gpt-5")).toBe(true);
    expect(PROVIDER_TOOL_SUPPORT.openai("text-embedding-3-large")).toBe(false);

    expect(PROVIDER_TOOL_SUPPORT.anthropic("claude-opus-4")).toBe(true);
    expect(PROVIDER_TOOL_SUPPORT.anthropic("claude-2")).toBe(false);
  });

  it("should handle provider-prefixed identifiers", () => {
    expect(PROVIDER_TOOL_SUPPORT.openrouter("openai/gpt-5")).toBe(true);
    expect(PROVIDER_TOOL_SUPPORT.openrouter("moonshotai/kimi-k2:free")).toBe(
      true,
    );
  });

  it("should support bedrock-style identifiers using metadata normalization", () => {
    expect(
      PROVIDER_TOOL_SUPPORT.bedrock(
        "anthropic.claude-3-5-sonnet-20240620-v1:0",
      ),
    ).toBe(true);
  });

  it("continue-proxy should delegate to parsed provider when present", () => {
    expect(
      PROVIDER_TOOL_SUPPORT["continue-proxy"](
        "ownerSlug/packageSlug/openai/gpt-5",
      ),
    ).toBe(true);
    expect(
      PROVIDER_TOOL_SUPPORT["continue-proxy"](
        "ownerSlug/packageSlug/openai/text-embedding-3-large",
      ),
    ).toBe(false);
  });

  it("continue-proxy should fallback to model metadata for unknown providers", () => {
    expect(
      PROVIDER_TOOL_SUPPORT["continue-proxy"](
        "ownerSlug/packageSlug/unknown-provider/gpt-5",
      ),
    ).toBe(true);
  });

  it("should return false for unknown model/provider combinations", () => {
    expect(PROVIDER_TOOL_SUPPORT.openai("random-model")).toBe(false);
    expect(PROVIDER_TOOL_SUPPORT["continue-proxy"]("random-model")).toBe(false);
  });
});

describe("modelSupportsNativeTools", () => {
  it("should prioritize explicit capability override", () => {
    expect(
      modelSupportsNativeTools(
        modelDescription("openai", "text-embedding-3-large", {
          tools: true,
        }),
      ),
    ).toBe(true);

    expect(
      modelSupportsNativeTools(
        modelDescription("openai", "gpt-5", {
          tools: false,
        }),
      ),
    ).toBe(false);
  });

  it("should use provider support for known providers", () => {
    expect(modelSupportsNativeTools(modelDescription("openai", "gpt-5"))).toBe(
      true,
    );
    expect(
      modelSupportsNativeTools(
        modelDescription("openai", "text-embedding-3-large"),
      ),
    ).toBe(false);
  });

  it("should fall back to metadata lookup for unknown providers", () => {
    expect(modelSupportsNativeTools(modelDescription("unknown", "gpt-5"))).toBe(
      true,
    );
    expect(
      modelSupportsNativeTools(modelDescription("unknown", "random-model")),
    ).toBe(false);
  });
});

describe("isRecommendedAgentModel", () => {
  it("should return true for models with metadata-backed agent capabilities", () => {
    expect(isRecommendedAgentModel("gpt-5")).toBe(true);
    expect(isRecommendedAgentModel("claude-opus-4")).toBe(true);
    expect(isRecommendedAgentModel("gemini-2.5-pro")).toBe(true);
    expect(isRecommendedAgentModel("grok-code")).toBe(true);
  });

  it("should return false for non-agent or unknown models", () => {
    expect(isRecommendedAgentModel("gpt-4")).toBe(false);
    expect(isRecommendedAgentModel("text-embedding-3-large")).toBe(false);
    expect(isRecommendedAgentModel("random-model")).toBe(false);
    expect(isRecommendedAgentModel("")).toBe(false);
  });

  it("should be case-insensitive", () => {
    expect(isRecommendedAgentModel("GPT-5")).toBe(true);
    expect(isRecommendedAgentModel("CLAUDE-OPUS-4")).toBe(true);
  });
});

describe("isRecommendedAgentModelForModelConfig", () => {
  it("should prioritize model over display name", () => {
    expect(
      isRecommendedAgentModelForModelConfig({
        model: "gpt-5",
        name: "text-embedding-3-large",
      }),
    ).toBe(true);
  });

  it("should fall back to name when model is empty", () => {
    expect(
      isRecommendedAgentModelForModelConfig({
        model: "",
        name: "claude-opus-4",
      }),
    ).toBe(true);
  });

  it("should return false when neither model nor name is usable", () => {
    expect(
      isRecommendedAgentModelForModelConfig({
        model: "",
        name: "",
      }),
    ).toBe(false);
  });
});
