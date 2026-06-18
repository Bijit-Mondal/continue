import { getApiKeyInputForProvider } from "core/llm/modelsDevBlockTemplate.js";

import {
  getApiKeyValidationError,
  isValidAnthropicApiKey,
  isValidOpenAiApiKey,
} from "./apiKeyValidation.js";

export const ONBOARDING_PROVIDERS = [
  "anthropic",
  "openai",
  "google",
  "openrouter",
] as const;

export type OnboardingProvider = (typeof ONBOARDING_PROVIDERS)[number];

export function isOnboardingProvider(
  value: string,
): value is OnboardingProvider {
  return (ONBOARDING_PROVIDERS as readonly string[]).includes(value);
}

export function getProviderLabel(providerId: OnboardingProvider): string {
  switch (providerId) {
    case "anthropic":
      return "Anthropic";
    case "openai":
      return "OpenAI";
    case "google":
      return "Gemini";
    case "openrouter":
      return "OpenRouter";
    default:
      return providerId;
  }
}

export function getProviderApiKeyInput(providerId: OnboardingProvider): string {
  return getApiKeyInputForProvider(providerId);
}

export function validateProviderApiKey(
  providerId: OnboardingProvider,
  apiKey: string,
): void {
  if (providerId === "anthropic" && !isValidAnthropicApiKey(apiKey)) {
    throw new Error(getApiKeyValidationError(apiKey));
  }

  if (providerId === "openai" && !isValidOpenAiApiKey(apiKey)) {
    throw new Error(getApiKeyValidationError(apiKey));
  }

  if (providerId === "google" && !apiKey.trim()) {
    throw new Error("Gemini API key cannot be empty");
  }

  if (providerId === "openrouter" && !apiKey.trim()) {
    throw new Error("OpenRouter API key cannot be empty");
  }
}
