import fs from "node:fs";
import path from "node:path";

import {
  continueProviderToModelsDevProvider,
  getApiKeyInputForProvider,
  toConfigModelId,
} from "core/llm/modelsDevBlockTemplate.js";
import {
  getAllProviderIds,
  getModelsForProvider,
  type ModelsDevCatalogModelWithProvider,
} from "core/llm/modelsDevCatalog.js";
import { parse } from "yaml";

import { env } from "../env.js";
import {
  modelBelongsToProvider,
  type ModelUsesConfig,
} from "./yamlConfigUpdater.js";

export interface ProviderWithApiKey {
  providerId: string;
  apiKey: string;
}

function readConfigYamlContent(configPath: string): string {
  if (!fs.existsSync(configPath)) {
    return "";
  }
  return fs.readFileSync(configPath, "utf8");
}

function resolveApiKeyFromEnv(providerId: string): string | undefined {
  const apiKeyInput = getApiKeyInputForProvider(providerId);
  const envValue = process.env[apiKeyInput]?.trim();
  if (envValue) {
    return envValue;
  }

  if (providerId === "google") {
    return process.env.GOOGLE_API_KEY?.trim();
  }

  return undefined;
}

export function getConfiguredProvidersFromYaml(
  yamlContent: string,
): ProviderWithApiKey[] {
  if (!yamlContent.trim()) {
    return [];
  }

  const providers = new Map<string, string>();

  try {
    const config = parse(yamlContent) as { models?: ModelUsesConfig[] };

    for (const model of config.models ?? []) {
      for (const providerId of getAllProviderIds()) {
        if (!modelBelongsToProvider(model, providerId)) {
          continue;
        }

        const apiKey =
          model.with?.[getApiKeyInputForProvider(providerId)]?.trim();
        if (apiKey) {
          providers.set(providerId, apiKey);
        }
      }
    }
  } catch {
    return [];
  }

  return [...providers.entries()]
    .map(([providerId, apiKey]) => ({ providerId, apiKey }))
    .sort((left, right) => left.providerId.localeCompare(right.providerId));
}

export function resolveApiKeyForProvider(
  providerId: string,
  yamlContent: string,
): string | undefined {
  const fromEnv = resolveApiKeyFromEnv(providerId);
  if (fromEnv) {
    return fromEnv;
  }

  return getConfiguredProvidersFromYaml(yamlContent).find(
    (provider) => provider.providerId === providerId,
  )?.apiKey;
}

export function getProvidersWithApiKeys(
  configPath: string = path.join(env.continueHome, "config.yaml"),
): ProviderWithApiKey[] {
  const yamlContent = readConfigYamlContent(configPath);
  const providers = new Map<string, string>();

  for (const provider of getConfiguredProvidersFromYaml(yamlContent)) {
    providers.set(provider.providerId, provider.apiKey);
  }

  for (const providerId of getAllProviderIds()) {
    const apiKey = resolveApiKeyFromEnv(providerId);
    if (apiKey) {
      providers.set(providerId, apiKey);
    }
  }

  return [...providers.entries()]
    .map(([providerId, apiKey]) => ({ providerId, apiKey }))
    .sort((left, right) => left.providerId.localeCompare(right.providerId));
}

export function listCatalogModelsForProvider(
  providerId: string,
): ModelsDevCatalogModelWithProvider[] {
  const modelsDevProviderId = continueProviderToModelsDevProvider(providerId);
  return getModelsForProvider(modelsDevProviderId)
    .map((model) => ({
      ...model,
      id: toConfigModelId(modelsDevProviderId, model.id),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function formatModelCatalogLabel(
  model: ModelsDevCatalogModelWithProvider,
): string {
  const tags: string[] = [];
  if (model.toolCall) {
    tags.push("tools");
  }
  if (model.reasoning) {
    tags.push("reasoning");
  }
  if (model.contextLength) {
    tags.push(`${Math.round(model.contextLength / 1000)}k ctx`);
  }

  if (tags.length === 0) {
    return model.id;
  }

  return `${model.id} (${tags.join(", ")})`;
}

export function filterCatalogModels(
  models: ModelsDevCatalogModelWithProvider[],
  query: string,
): ModelsDevCatalogModelWithProvider[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return models;
  }

  return models.filter((model) =>
    model.id.toLowerCase().includes(normalizedQuery),
  );
}

export function resolveProviderArg(providerArg?: string): string | undefined {
  if (!providerArg?.trim()) {
    return undefined;
  }

  const normalized = continueProviderToModelsDevProvider(
    providerArg.trim().toLowerCase(),
  );
  const providers = getAllProviderIds();
  const exact = providers.find((providerId) => providerId === normalized);
  if (exact) {
    return exact;
  }

  return providers.find((providerId) => providerId.startsWith(normalized));
}
