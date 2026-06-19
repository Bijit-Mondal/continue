import { describe, expect, it } from "vitest";

import {
  getProviderApiKeyInput,
  getProviderLabel,
  isOnboardingProvider,
  ONBOARDING_PROVIDERS,
  POPULAR_PROVIDERS,
  validateProviderApiKey,
} from "./providerSetup.js";

describe("providerSetup", () => {
  it("includes all models.dev providers with popular ones listed first", () => {
    expect(ONBOARDING_PROVIDERS[0]).toBe("anthropic");
    expect(ONBOARDING_PROVIDERS).toContain("xai");
    expect(ONBOARDING_PROVIDERS).toContain("deepseek");
    expect(ONBOARDING_PROVIDERS).toContain("openrouter");
    expect(ONBOARDING_PROVIDERS.length).toBeGreaterThan(100);
  });

  it("validates provider ids against the bundled catalog", () => {
    expect(isOnboardingProvider("openrouter")).toBe(true);
    expect(isOnboardingProvider("xai")).toBe(true);
    expect(isOnboardingProvider("not-a-provider")).toBe(false);
  });

  it("returns provider labels", () => {
    expect(getProviderLabel("openrouter")).toBe("OpenRouter");
    expect(getProviderLabel("xai")).toBe("xAI");
    expect(getProviderLabel("deepseek")).toBe("Deepseek");
  });

  it("returns API key input for any provider", () => {
    expect(getProviderApiKeyInput("anthropic")).toBe("ANTHROPIC_API_KEY");
    expect(getProviderApiKeyInput("xai")).toBe("XAI_API_KEY");
    expect(getProviderApiKeyInput("deepseek")).toBe("DEEPSEEK_API_KEY");
  });

  it("validates anthropic api keys", () => {
    expect(() =>
      validateProviderApiKey("anthropic", "sk-ant-test123456789"),
    ).not.toThrow();
    expect(() => validateProviderApiKey("anthropic", "bad-key")).toThrow();
  });

  it("requires non-empty API keys for all providers", () => {
    expect(() => validateProviderApiKey("xai", "")).toThrow(
      /API key cannot be empty/,
    );
    expect(() => validateProviderApiKey("deepseek", "   ")).toThrow(
      /API key cannot be empty/,
    );
  });

  it("does not apply strict format checks to non-anthropic/openai providers", () => {
    expect(() =>
      validateProviderApiKey("deepseek", "arbitrary-key-value"),
    ).not.toThrow();
  });

  it("defines a curated list of popular providers", () => {
    expect(POPULAR_PROVIDERS).toContain("anthropic");
    expect(POPULAR_PROVIDERS).toContain("xai");
    expect(POPULAR_PROVIDERS).toContain("deepseek");
  });
});
