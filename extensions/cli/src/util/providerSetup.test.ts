import { describe, expect, it } from "vitest";

import {
  getProviderLabel,
  isOnboardingProvider,
  ONBOARDING_PROVIDERS,
  validateProviderApiKey,
} from "./providerSetup.js";

describe("providerSetup", () => {
  it("lists supported onboarding providers", () => {
    expect(ONBOARDING_PROVIDERS).toEqual([
      "anthropic",
      "openai",
      "google",
      "openrouter",
    ]);
  });

  it("validates provider ids", () => {
    expect(isOnboardingProvider("openrouter")).toBe(true);
    expect(isOnboardingProvider("unknown")).toBe(false);
  });

  it("returns provider labels", () => {
    expect(getProviderLabel("openrouter")).toBe("OpenRouter");
  });

  it("validates anthropic api keys", () => {
    expect(() =>
      validateProviderApiKey("anthropic", "sk-ant-test123456789"),
    ).not.toThrow();
    expect(() => validateProviderApiKey("anthropic", "bad-key")).toThrow();
  });
});
