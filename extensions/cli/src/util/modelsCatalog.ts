import fs from "node:fs";
import path from "node:path";

import {
  continueProviderToModelsDevProvider,
  getApiKeyInputForProvider,
  toConfigModelId,
} from "core/llm/modelsDevBlockTemplate.js";
import {
  getModelsForProvider,
  type ModelsDevCatalogModelWithProvider,
} from "core/llm/modelsDevCatalog.js";
import modelsDevCatalogJson from "core/llm/modelsDevCatalog.json" with { type: "json" };
import { parse } from "yaml";

import { env } from "../env.js";

export interface ProviderWithApiKey {
  providerId: string;
  apiKey: string;
}

function getAllProviderIds(): string[] {
  const providers = (
    modelsDevCatalogJson as { providers: Record<string, unknown> }
  ).providers;
  return Object.keys(providers).sort((left, right) =>
    left.localeCompare(right),
  );
}

function readConfigYamlContent(configPath: string): string {
  if (!fs.existsSync(configPath)) {
    return "";
  }
  return fs.readFileSync(configPath, "utf8");
}

export function resolveApiKeyForProvider(
  providerId: string,
  yamlContent: string,
): string | undefined {
  const apiKeyInput = getApiKeyInputForProvider(providerId);
  const envValue = process.env[apiKeyInput];
  if (envValue?.trim()) {
    return envValue.trim();
  }

  if (!yamlContent.trim()) {
    return undefined;
  }

  try {
    const config = parse(yamlContent) as {
      models?: Array<{ uses?: string; with?: Record<string, string> }>;
    };

    for (const model of config.models ?? []) {
      const apiKey = model.with?.[apiKeyInput]?.trim();
      if (!apiKey) {
        continue;
      }

      if (providerId === "openrouter") {
        return apiKey;
      }

      if (model?.uses?.startsWith(`${providerId}/`)) {
        return apiKey;
      }
    }
  } catch {
    return undefined;
  }

  return undefined;
}

export function getProvidersWithApiKeys(
  configPath: string = path.join(env.continueHome, "config.yaml"),
): ProviderWithApiKey[] {
  const yamlContent = readConfigYamlContent(configPath);

  return getAllProviderIds()
    .map((providerId) => {
      const apiKey = resolveApiKeyForProvider(providerId, yamlContent);
      if (!apiKey) {
        return undefined;
      }
      return { providerId, apiKey };
    })
    .filter(
      (provider): provider is ProviderWithApiKey => provider !== undefined,
    );
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
