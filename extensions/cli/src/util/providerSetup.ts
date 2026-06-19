import { getApiKeyInputForProvider } from "core/llm/modelsDevBlockTemplate.js";
import { getAllProviderIds } from "core/llm/modelsDevCatalog.js";

import {
  getApiKeyValidationError,
  isValidAnthropicApiKey,
  isValidOpenAiApiKey,
} from "./apiKeyValidation.js";

export const POPULAR_PROVIDERS = [
  "anthropic",
  "openai",
  "google",
  "openrouter",
  "xai",
  "groq",
  "mistral",
  "deepseek",
  "togetherai",
  "moonshotai",
  "fireworks-ai",
  "novita-ai",
  "nebius",
  "cerebras",
  "nvidia",
  "lmstudio",
];

function buildProviderList(): string[] {
  const allProviders = new Set(getAllProviderIds());
  const popular = POPULAR_PROVIDERS.filter((provider) =>
    allProviders.has(provider),
  );
  const rest = [...allProviders]
    .filter((provider) => !popular.includes(provider))
    .sort((left, right) => left.localeCompare(right));

  return [...popular, ...rest];
}

const MODELSDEV_PROVIDERS = buildProviderList();

/**
 * All providers available from the bundled models.dev catalog, with popular
 * providers listed first.
 */
export const ONBOARDING_PROVIDERS = MODELSDEV_PROVIDERS;

export type OnboardingProvider = string;

export function isOnboardingProvider(
  value: string,
): value is OnboardingProvider {
  return MODELSDEV_PROVIDERS.includes(value);
}

const KNOWN_PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google (Gemini)",
  openrouter: "OpenRouter",
  xai: "xAI",
  zai: "Z AI",
};

function titleCaseProviderId(providerId: string): string {
  return providerId
    .split(/[-_.]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getProviderLabel(providerId: string): string {
  return KNOWN_PROVIDER_LABELS[providerId] ?? titleCaseProviderId(providerId);
}

export function getProviderApiKeyInput(providerId: string): string {
  return getApiKeyInputForProvider(providerId);
}

export function validateProviderApiKey(
  providerId: string,
  apiKey: string,
): void {
  if (!apiKey.trim()) {
    throw new Error(`${getProviderLabel(providerId)} API key cannot be empty`);
  }

  if (providerId === "anthropic" && !isValidAnthropicApiKey(apiKey)) {
    throw new Error(getApiKeyValidationError(apiKey));
  }

  if (providerId === "openai" && !isValidOpenAiApiKey(apiKey)) {
    throw new Error(getApiKeyValidationError(apiKey));
  }
}
