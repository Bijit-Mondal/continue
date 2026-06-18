import fs from "fs/promises";
import path from "path";
import process from "process";

const MODELS_DEV_API_URL = "https://models.dev/api.json";
const FULL_OUTPUT_PATH = path.resolve("core/llm/modelsDevCatalog.json");
const INDEX_OUTPUT_PATH = path.resolve("core/llm/modelsDevModelIndex.json");
const DIST_FULL_OUTPUT_PATH = path.resolve("core/dist/llm/modelsDevCatalog.json");
const DIST_INDEX_OUTPUT_PATH = path.resolve(
  "core/dist/llm/modelsDevModelIndex.json",
);

function toModelEntry(model) {
  return {
    id: model.id,
    contextLength: model.limit?.context,
    maxCompletionTokens: model.limit?.output,
    toolCall: model.tool_call,
    reasoning: model.reasoning,
    releaseDate: model.release_date,
  };
}

function toProviderEntry(provider) {
  return {
    id: provider.id,
    models: Object.values(provider.models ?? {})
      .map(toModelEntry)
      .sort((a, b) => a.id.localeCompare(b.id)),
  };
}

async function main() {
  const response = await fetch(MODELS_DEV_API_URL);
  if (!response.ok) {
    throw new Error(
      `Failed to download models.dev catalog: ${response.status} ${response.statusText}`,
    );
  }

  const rawCatalog = await response.json();

  const providers = Object.fromEntries(
    Object.entries(rawCatalog)
      .map(([providerId, provider]) => [providerId, toProviderEntry(provider)])
      .sort(([left], [right]) => left.localeCompare(right)),
  );

  const output = {
    source: MODELS_DEV_API_URL,
    generatedAt: new Date().toISOString(),
    providers,
  };

  await fs.writeFile(
    FULL_OUTPUT_PATH,
    `${JSON.stringify(output, null, 2)}\n`,
    "utf8",
  );
  await fs.mkdir(path.dirname(DIST_FULL_OUTPUT_PATH), { recursive: true });
  await fs.copyFile(FULL_OUTPUT_PATH, DIST_FULL_OUTPUT_PATH);

  const uniqueModelMap = new Map();
  for (const provider of Object.values(providers)) {
    for (const model of provider.models) {
      const key = model.id.toLowerCase();
      const existing = uniqueModelMap.get(key);
      if (!existing) {
        uniqueModelMap.set(key, {
          id: model.id,
          contextLength: model.contextLength,
          maxCompletionTokens: model.maxCompletionTokens,
          toolCall: !!model.toolCall,
          reasoning: !!model.reasoning,
          releaseDate: model.releaseDate,
        });
        continue;
      }

      existing.contextLength = Math.max(
        existing.contextLength ?? 0,
        model.contextLength ?? 0,
      );
      existing.maxCompletionTokens = Math.max(
        existing.maxCompletionTokens ?? 0,
        model.maxCompletionTokens ?? 0,
      );
      existing.toolCall = existing.toolCall || !!model.toolCall;
      existing.reasoning = existing.reasoning || !!model.reasoning;
      existing.releaseDate =
        [existing.releaseDate, model.releaseDate]
          .filter(Boolean)
          .sort()
          .at(-1) ?? existing.releaseDate;
    }
  }

  const modelIndex = {
    source: MODELS_DEV_API_URL,
    generatedAt: output.generatedAt,
    models: [...uniqueModelMap.values()].sort((a, b) =>
      a.id.localeCompare(b.id),
    ),
  };

  await fs.writeFile(
    INDEX_OUTPUT_PATH,
    `${JSON.stringify(modelIndex, null, 2)}\n`,
    "utf8",
  );
  await fs.copyFile(INDEX_OUTPUT_PATH, DIST_INDEX_OUTPUT_PATH);

  const providerCount = Object.keys(providers).length;
  const modelCount = Object.values(providers).reduce(
    (sum, provider) => sum + provider.models.length,
    0,
  );

  console.log(`Updated ${FULL_OUTPUT_PATH}`);
  console.log(
    `Updated ${INDEX_OUTPUT_PATH} (${providerCount} providers, ${modelCount} model entries, ${modelIndex.models.length} unique model IDs)`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
