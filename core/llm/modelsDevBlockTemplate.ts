import {
  findModelMetadata,
  getModelsForProvider,
  type ModelsDevCatalogModelWithProvider,
} from "./modelsDevCatalog.js";

const PROVIDER_API_KEY_INPUTS: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GEMINI_API_KEY",
  gemini: "GEMINI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  xai: "XAI_API_KEY",
  mistral: "MISTRAL_API_KEY",
};

const CONTINUE_PROVIDER_MAP: Record<string, string> = {
  google: "gemini",
};

const LIGHTWEIGHT_MODEL_PATTERN =
  /(?:^|[.-])(nano|mini|flash|haiku|lite|small)(?:[.-]|$)/i;

const PROVIDER_FAMILY_PREFIXES: Record<string, string[]> = {
  anthropic: ["claude"],
  openai: ["gpt", "o"],
  google: ["gemini"],
  openrouter: ["anthropic/", "openai/", "google/"],
};

function getProviderFamilyRank(providerId: string, modelId: string): number {
  const families = PROVIDER_FAMILY_PREFIXES[providerId] ?? [];
  const lower = modelId.toLowerCase();

  for (let index = 0; index < families.length; index++) {
    if (lower.includes(families[index]!)) {
      return families.length - index;
    }
  }

  return 0;
}

function isAgentCapableModel(
  model: ModelsDevCatalogModelWithProvider,
): boolean {
  const contextLength = model.contextLength ?? 0;
  return !!model.toolCall && !!model.reasoning && contextLength >= 100_000;
}

function isLightweightModel(modelId: string): boolean {
  return LIGHTWEIGHT_MODEL_PATTERN.test(modelId.toLowerCase());
}

function compareModelsForOnboarding(
  left: ModelsDevCatalogModelWithProvider,
  right: ModelsDevCatalogModelWithProvider,
): number {
  const leftLightweight = isLightweightModel(left.id);
  const rightLightweight = isLightweightModel(right.id);
  if (leftLightweight !== rightLightweight) {
    return leftLightweight ? 1 : -1;
  }

  const leftFamilyRank = getProviderFamilyRank(left.provider, left.id);
  const rightFamilyRank = getProviderFamilyRank(right.provider, right.id);
  if (leftFamilyRank !== rightFamilyRank) {
    return rightFamilyRank - leftFamilyRank;
  }

  const leftRelease = left.releaseDate ?? "";
  const rightRelease = right.releaseDate ?? "";
  if (leftRelease !== rightRelease) {
    return rightRelease.localeCompare(leftRelease);
  }

  const leftContext = left.contextLength ?? 0;
  const rightContext = right.contextLength ?? 0;
  if (leftContext !== rightContext) {
    return rightContext - leftContext;
  }

  return left.id.localeCompare(right.id);
}

function rankModelsForOnboarding(
  models: ModelsDevCatalogModelWithProvider[],
): ModelsDevCatalogModelWithProvider[] {
  const agentCapable = models.filter(isAgentCapableModel);
  const candidates = agentCapable.length > 0 ? agentCapable : models;
  return [...candidates].sort(compareModelsForOnboarding);
}

export function modelsDevProviderToContinueProvider(
  providerId: string,
): string {
  return (
    CONTINUE_PROVIDER_MAP[providerId.toLowerCase()] ?? providerId.toLowerCase()
  );
}

export function continueProviderToModelsDevProvider(
  providerId: string,
): string {
  const lower = providerId.toLowerCase();
  if (lower === "gemini") {
    return "google";
  }
  return lower;
}

export function getApiKeyInputForProvider(providerId: string): string {
  const normalized = continueProviderToModelsDevProvider(providerId);
  return (
    PROVIDER_API_KEY_INPUTS[normalized] ?? `${normalized.toUpperCase()}_API_KEY`
  );
}

export function detectProviderFromApiKeyEnv(): string | undefined {
  if (process.env.ANTHROPIC_API_KEY) {
    return "anthropic";
  }
  if (process.env.OPENAI_API_KEY) {
    return "openai";
  }
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
    return "google";
  }
  if (process.env.OPENROUTER_API_KEY) {
    return "openrouter";
  }
  return undefined;
}

function formatModelDisplayName(modelId: string): string {
  return modelId
    .split(/[-_/]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildCapabilities(
  metadata: ModelsDevCatalogModelWithProvider,
): string[] {
  const capabilities: string[] = [];
  if (metadata.toolCall) {
    capabilities.push("tool_use");
  }
  return capabilities;
}

export function toConfigModelId(
  providerId: string,
  catalogModelId: string,
): string {
  if (providerId.toLowerCase() === "openrouter") {
    return catalogModelId.replace(/^~+/, "");
  }

  return catalogModelId;
}

export function generateModelBlockYaml(
  providerId: string,
  modelId: string,
): string | undefined {
  const metadata = findModelMetadata(modelId, providerId);
  if (!metadata) {
    return undefined;
  }

  const continueProvider = modelsDevProviderToContinueProvider(providerId);
  const apiKeyInput = getApiKeyInputForProvider(providerId);
  const configModelId = toConfigModelId(providerId, metadata.id);
  const displayName = formatModelDisplayName(configModelId);
  const capabilities = buildCapabilities(metadata);

  const lines = [
    `name: ${displayName}`,
    "version: 0.0.1",
    "schema: v1",
    "",
    "models:",
    `  - name: ${displayName}`,
    `    provider: ${continueProvider}`,
    `    model: ${configModelId}`,
    `    apiKey: \${{ inputs.${apiKeyInput} }}`,
    "    roles: [chat, edit, apply]",
  ];

  if (metadata.contextLength || metadata.maxCompletionTokens) {
    lines.push("    defaultCompletionOptions:");
    if (metadata.contextLength) {
      lines.push(`      contextLength: ${metadata.contextLength}`);
    }
    if (metadata.maxCompletionTokens) {
      lines.push(`      maxTokens: ${metadata.maxCompletionTokens}`);
    }
  }

  if (capabilities.length > 0) {
    lines.push(`    capabilities: [${capabilities.join(", ")}]`);
  }

  return `${lines.join("\n")}\n`;
}

export function getRecommendedModelsForProvider(
  providerId: string,
  limit = 1,
): ModelsDevCatalogModelWithProvider[] {
  return rankModelsForOnboarding(getModelsForProvider(providerId)).slice(
    0,
    limit,
  );
}

export function getDefaultOnboardingModelForProvider(
  providerId: string,
): ModelsDevCatalogModelWithProvider | undefined {
  return getRecommendedModelsForProvider(providerId, 1)[0];
}

export function detectProviderFromConfigInputs(
  inputs?: Record<string, string | undefined>,
): string | undefined {
  if (!inputs) {
    return undefined;
  }

  for (const [providerId, apiKeyInput] of Object.entries(
    PROVIDER_API_KEY_INPUTS,
  )) {
    if (inputs[apiKeyInput]?.trim()) {
      return continueProviderToModelsDevProvider(providerId);
    }
  }

  return undefined;
}

export function resolveModelFromUsesSlug(
  usesSlug: string,
  inputs?: Record<string, string | undefined>,
): { providerId: string; modelId: string } {
  const providerFromInputs = detectProviderFromConfigInputs(inputs);
  const slashIndex = usesSlug.indexOf("/");

  if (providerFromInputs === "openrouter") {
    return {
      providerId: "openrouter",
      modelId: usesSlug,
    };
  }

  if (slashIndex === -1) {
    return {
      providerId: providerFromInputs ?? usesSlug,
      modelId: usesSlug,
    };
  }

  const ownerSlug = usesSlug.slice(0, slashIndex);
  const packageSlug = usesSlug.slice(slashIndex + 1);

  return {
    providerId: providerFromInputs ?? ownerSlug,
    modelId: packageSlug,
  };
}

export function getUsesSlug(providerId: string, modelId: string): string {
  const configModelId = toConfigModelId(providerId, modelId);
  if (providerId.toLowerCase() === "openrouter") {
    return configModelId;
  }

  return `${providerId}/${configModelId}`;
}
