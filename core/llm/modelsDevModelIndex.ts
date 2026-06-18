import modelsDevModelIndexJson from "./modelsDevModelIndex.json" with { type: "json" };

export interface ModelsDevIndexedModel {
  id: string;
  contextLength?: number;
  maxCompletionTokens?: number;
  toolCall?: boolean;
  reasoning?: boolean;
}

interface ModelsDevModelIndexData {
  source: string;
  generatedAt: string;
  models: ModelsDevIndexedModel[];
}

const modelIndex = modelsDevModelIndexJson as ModelsDevModelIndexData;

const indexedModels = modelIndex.models;

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
  models: ModelsDevIndexedModel[],
  candidates: string[],
): ModelsDevIndexedModel | undefined {
  let best: ModelsDevIndexedModel | undefined;
  let bestScore = -1;

  for (const model of models) {
    const modelId = model.id.toLowerCase();

    for (const candidate of candidates) {
      if (candidate === modelId) {
        return model;
      }

      const candidateStartsWithModel =
        candidate.startsWith(`${modelId}-`) ||
        candidate.startsWith(`${modelId}.`) ||
        candidate.startsWith(`${modelId}:`);
      const modelStartsWithCandidate =
        modelId.startsWith(`${candidate}-`) ||
        modelId.startsWith(`${candidate}.`) ||
        modelId.startsWith(`${candidate}:`);

      if (!candidateStartsWithModel && !modelStartsWithCandidate) {
        continue;
      }

      const score = Math.min(candidate.length, modelId.length);
      if (score > bestScore) {
        best = model;
        bestScore = score;
      }
    }
  }

  return best;
}

export function findModelMetadataFromIndex(
  modelName: string,
): ModelsDevIndexedModel | undefined {
  const candidates = getModelCandidates(modelName);
  if (!candidates.length) {
    return undefined;
  }

  return selectBestPrefixMatch(indexedModels, candidates);
}

export function isRecommendedAgentModelFromMetadata(
  modelName: string,
): boolean {
  const model = findModelMetadataFromIndex(modelName);
  if (!model) {
    return false;
  }

  const contextLength = model.contextLength ?? 0;
  const hasAgentCapabilities = !!model.reasoning && !!model.toolCall;

  return hasAgentCapabilities && contextLength >= 100_000;
}

export function modelSupportsNativeToolsFromMetadata(
  modelName: string,
): boolean | undefined {
  const model = findModelMetadataFromIndex(modelName);
  if (!model) {
    return undefined;
  }

  return model.toolCall;
}

export function getModelsDevIndexMetadata() {
  return {
    generatedAt: modelIndex.generatedAt,
    source: modelIndex.source,
    models: indexedModels.length,
  };
}
