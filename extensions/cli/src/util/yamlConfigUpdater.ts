import {
  detectProviderFromApiKeyEnv,
  getApiKeyInputForProvider,
  getDefaultOnboardingModelForProvider,
  getUsesSlug,
  toConfigModelId,
} from "core/llm/modelsDevBlockTemplate.js";
import { parseDocument } from "yaml";

export interface ModelUsesConfig {
  uses: string;
  with: Record<string, string>;
}

export interface ConfigStructure {
  name: string;
  version: string;
  schema: string;
  models: ModelUsesConfig[];
}

const DEFAULT_CONFIG: Omit<ConfigStructure, "models"> = {
  name: "Main Config",
  version: "1.0.0",
  schema: "v1",
};

function createModelUsesConfig(
  providerId: string,
  modelId: string,
  apiKey: string,
): ModelUsesConfig {
  const configModelId = toConfigModelId(providerId, modelId);
  return {
    uses: getUsesSlug(providerId, configModelId),
    with: {
      [getApiKeyInputForProvider(providerId)]: apiKey,
    },
  };
}

function modelBelongsToProvider(
  model: ModelUsesConfig,
  providerId: string,
): boolean {
  const apiKeyInput = getApiKeyInputForProvider(providerId);
  if (!model.with?.[apiKeyInput]?.trim()) {
    return false;
  }

  if (providerId === "openrouter") {
    return true;
  }

  return model.uses?.startsWith(`${providerId}/`) ?? false;
}

function upsertProviderModels(
  models: ModelUsesConfig[],
  providerId: string,
  apiKey: string,
): ModelUsesConfig[] {
  const apiKeyInput = getApiKeyInputForProvider(providerId);
  let hasProviderModel = false;

  const updatedModels = models.map((model) => {
    if (!modelBelongsToProvider(model, providerId)) {
      return model;
    }

    hasProviderModel = true;
    return {
      ...model,
      with: {
        ...(model.with ?? {}),
        [apiKeyInput]: apiKey,
      },
    };
  });

  if (!hasProviderModel) {
    const defaultModel = getDefaultOnboardingModelForProvider(providerId);
    if (defaultModel) {
      updatedModels.push(
        createModelUsesConfig(providerId, defaultModel.id, apiKey),
      );
    }
  }

  return updatedModels;
}

function writeConfig(config: ConfigStructure): string {
  const doc = parseDocument("");
  Object.entries(config).forEach(([key, value]) => doc.set(key, value));
  return doc.toString();
}

/**
 * Updates or adds model configurations for a provider in a YAML string while
 * preserving comments and formatting where possible.
 */
export function updateProviderModelsInYaml(
  yamlContent: string,
  providerId: string,
  apiKey: string,
): string {
  try {
    const doc = parseDocument(yamlContent);

    if (!doc.contents || doc.contents === null) {
      const defaultModel = getDefaultOnboardingModelForProvider(providerId);
      return writeConfig({
        ...DEFAULT_CONFIG,
        models: defaultModel
          ? [createModelUsesConfig(providerId, defaultModel.id, apiKey)]
          : [],
      });
    }

    const config = doc.toJS() as ConfigStructure;
    config.models = upsertProviderModels(
      config.models ?? [],
      providerId,
      apiKey,
    );
    doc.set("models", config.models);
    return doc.toString();
  } catch {
    const defaultModel = getDefaultOnboardingModelForProvider(providerId);
    return writeConfig({
      ...DEFAULT_CONFIG,
      models: defaultModel
        ? [createModelUsesConfig(providerId, defaultModel.id, apiKey)]
        : [],
    });
  }
}

/**
 * Updates or adds Anthropic model configurations in a YAML string.
 */
export function updateAnthropicModelInYaml(
  yamlContent: string,
  apiKey: string,
): string {
  return updateProviderModelsInYaml(yamlContent, "anthropic", apiKey);
}

/**
 * Applies provider models for any API keys present in the environment.
 */
export function updateConfigFromEnvApiKeys(yamlContent: string): string {
  let updated = yamlContent;

  const providers: Array<{ providerId: string; apiKey: string }> = [];
  if (process.env.ANTHROPIC_API_KEY) {
    providers.push({
      providerId: "anthropic",
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  if (process.env.OPENAI_API_KEY) {
    providers.push({
      providerId: "openai",
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
    providers.push({
      providerId: "google",
      apiKey: process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY!,
    });
  }
  if (process.env.OPENROUTER_API_KEY) {
    providers.push({
      providerId: "openrouter",
      apiKey: process.env.OPENROUTER_API_KEY,
    });
  }

  for (const { providerId, apiKey } of providers) {
    updated = updateProviderModelsInYaml(updated, providerId, apiKey);
  }

  return updated;
}

export function getDefaultProviderFromEnv(): string | undefined {
  return detectProviderFromApiKeyEnv();
}

export function addModelUsesToYaml(
  yamlContent: string,
  providerId: string,
  modelId: string,
  apiKey: string,
): { yaml: string; added: boolean } {
  const usesSlug = getUsesSlug(providerId, modelId);
  const newEntry = createModelUsesConfig(providerId, modelId, apiKey);

  try {
    const doc = parseDocument(yamlContent);

    if (!doc.contents || doc.contents === null) {
      return {
        yaml: writeConfig({
          ...DEFAULT_CONFIG,
          models: [newEntry],
        }),
        added: true,
      };
    }

    const config = doc.toJS() as ConfigStructure;
    const models = config.models ?? [];
    const existingIndex = models.findIndex((model) => model?.uses === usesSlug);

    if (existingIndex >= 0) {
      models[existingIndex] = newEntry;
      doc.set("models", models);
      return { yaml: doc.toString(), added: false };
    }

    models.push(newEntry);
    doc.set("models", models);
    return { yaml: doc.toString(), added: true };
  } catch {
    return {
      yaml: writeConfig({
        ...DEFAULT_CONFIG,
        models: [newEntry],
      }),
      added: true,
    };
  }
}
