import modelsDevCatalogJson from "./modelsDevCatalog.json" with { type: "json" };

export interface ModelsDevCatalogModel {
  id: string;
  contextLength?: number;
  maxCompletionTokens?: number;
  toolCall?: boolean;
  reasoning?: boolean;
  releaseDate?: string;
}

export interface ModelsDevCatalogProvider {
  id: string;
  models: ModelsDevCatalogModel[];
}

export interface ModelsDevCatalogData {
  source: string;
  generatedAt: string;
  providers: Record<string, ModelsDevCatalogProvider>;
}

export type ModelsDevCatalogModelWithProvider = ModelsDevCatalogModel & {
  provider: string;
};

const catalog = modelsDevCatalogJson as ModelsDevCatalogData;

const PROVIDER_ALIASES: Record<string, string[]> = {
  gemini: ["google"],
  vertexai: ["google"],
  xai: ["xai"],
  zai: ["z-ai", "zai"],
};

const providers = Object.values(catalog.providers);

const allModels = providers.flatMap((provider) =>
  provider.models.map((model) => ({
    ...model,
    provider: provider.id,
  })),
);

function getProviderCandidates(providerId?: string): string[] {
  if (!providerId) {
    return [];
  }

  const lower = providerId.toLowerCase();
  return [lower, ...(PROVIDER_ALIASES[lower] ?? [])];
}

function normalizeModelIdForLookup(modelId: string): string {
  return modelId.trim().toLowerCase().replace(/^~+/, "");
}

function modelIdsMatch(left: string, right: string): boolean {
  return normalizeModelIdForLookup(left) === normalizeModelIdForLookup(right);
}

function getModelCandidates(modelName: string): string[] {
  const lower = modelName.trim().toLowerCase();
  if (!lower) {
    return [];
  }

  const candidates = new Set<string>();

  const addCandidate = (candidate: string) => {
    if (!candidate) {
      return;
    }

    const trimmed = candidate.trim().toLowerCase();
    if (!trimmed) {
      return;
    }

    candidates.add(trimmed);
    candidates.add(trimmed.replace(/:(free|extended|beta)$/i, ""));
    candidates.add(trimmed.replace(/:\d+$/, ""));
    candidates.add(trimmed.replace(/-v\d+(?::\d+)?$/, ""));
    candidates.add(trimmed.replace(/^~+/, ""));
  };

  addCandidate(lower);

  if (lower.includes("/")) {
    addCandidate(lower.substring(lower.lastIndexOf("/") + 1));
  }

  if (lower.includes(".")) {
    addCandidate(lower.replace(/^[^.]+\./, ""));
  }

  return [...candidates].filter(Boolean);
}

function selectBestPrefixMatch(
  models: ModelsDevCatalogModelWithProvider[],
  candidates: string[],
): ModelsDevCatalogModelWithProvider | undefined {
  let best: ModelsDevCatalogModelWithProvider | undefined;
  let bestScore = -1;

  for (const model of models) {
    for (const candidate of candidates) {
      if (modelIdsMatch(candidate, model.id)) {
        return model;
      }

      const normalizedModelId = normalizeModelIdForLookup(model.id);
      const normalizedCandidate = normalizeModelIdForLookup(candidate);

      const candidateStartsWithModel =
        normalizedCandidate.startsWith(`${normalizedModelId}-`) ||
        normalizedCandidate.startsWith(`${normalizedModelId}.`) ||
        normalizedCandidate.startsWith(`${normalizedModelId}:`);
      const modelStartsWithCandidate =
        normalizedModelId.startsWith(`${normalizedCandidate}-`) ||
        normalizedModelId.startsWith(`${normalizedCandidate}.`) ||
        normalizedModelId.startsWith(`${normalizedCandidate}:`);

      if (!candidateStartsWithModel && !modelStartsWithCandidate) {
        continue;
      }

      const score = Math.min(
        normalizedCandidate.length,
        normalizedModelId.length,
      );
      if (score > bestScore) {
        best = model;
        bestScore = score;
      }
    }
  }

  return best;
}

export function getModelsForProvider(
  providerId: string,
): ModelsDevCatalogModelWithProvider[] {
  const candidates = getProviderCandidates(providerId);
  if (!candidates.length) {
    return [];
  }

  return providers
    .filter((provider) => candidates.includes(provider.id.toLowerCase()))
    .flatMap((provider) =>
      provider.models.map((model) => ({
        ...model,
        provider: provider.id,
      })),
    );
}

export function findModelMetadata(
  modelName: string,
  preferProviderId?: string,
): ModelsDevCatalogModelWithProvider | undefined {
  const candidates = getModelCandidates(modelName);
  if (!candidates.length) {
    return undefined;
  }

  const providerCandidates = getProviderCandidates(preferProviderId);
  if (providerCandidates.length) {
    const providerModels = providers
      .filter((provider) =>
        providerCandidates.includes(provider.id.toLowerCase()),
      )
      .flatMap((provider) =>
        provider.models.map((model) => ({
          ...model,
          provider: provider.id,
        })),
      );

    const inProviderMatch = selectBestPrefixMatch(providerModels, candidates);
    if (inProviderMatch) {
      return inProviderMatch;
    }
  }

  return selectBestPrefixMatch(allModels, candidates);
}

export function getModelsDevCatalogMetadata() {
  return {
    generatedAt: catalog.generatedAt,
    source: catalog.source,
    providers: Object.keys(catalog.providers).length,
    models: allModels.length,
  };
}

export function getAllProviderIds(): string[] {
  return Object.keys(catalog.providers).sort((left, right) =>
    left.localeCompare(right),
  );
}
