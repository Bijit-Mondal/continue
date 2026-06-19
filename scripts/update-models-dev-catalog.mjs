import fs from "fs/promises";
import path from "path";
import process from "process";
import { fileURLToPath } from "url";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const MODELS_DEV_API_URL = "https://models.dev/api.json";
const FULL_OUTPUT_PATH = path.resolve(
  REPO_ROOT,
  "core/llm/modelsDevCatalog.json",
);
const INDEX_OUTPUT_PATH = path.resolve(
  REPO_ROOT,
  "core/llm/modelsDevModelIndex.json",
);
const DIST_FULL_OUTPUT_PATH = path.resolve(
  REPO_ROOT,
  "core/dist/llm/modelsDevCatalog.json",
);
const DIST_INDEX_OUTPUT_PATH = path.resolve(
  REPO_ROOT,
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

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function copyToDist() {
  await fs.mkdir(path.dirname(DIST_FULL_OUTPUT_PATH), { recursive: true });
  if (await fileExists(FULL_OUTPUT_PATH)) {
    await fs.copyFile(FULL_OUTPUT_PATH, DIST_FULL_OUTPUT_PATH);
  }
  if (await fileExists(INDEX_OUTPUT_PATH)) {
    await fs.copyFile(INDEX_OUTPUT_PATH, DIST_INDEX_OUTPUT_PATH);
  }
}

async function fetchCatalog() {
  const response = await fetch(MODELS_DEV_API_URL);
  if (!response.ok) {
    throw new Error(
      `Failed to download models.dev catalog: ${response.status} ${response.statusText}`,
    );
  }
  return response.json();
}

async function writeCatalog(rawCatalog) {
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

async function main() {
  const canFetch = process.env.SKIP_CATALOG_FETCH !== "1";
  let fetched = false;

  if (canFetch) {
    try {
      const rawCatalog = await fetchCatalog();
      await writeCatalog(rawCatalog);
      fetched = true;
    } catch (error) {
      const hasExisting =
        (await fileExists(FULL_OUTPUT_PATH)) &&
        (await fileExists(INDEX_OUTPUT_PATH));
      if (hasExisting) {
        console.warn(
          `Warning: could not refresh models.dev catalog (${error.message}). Using existing bundled catalog.`,
        );
      } else {
        throw new Error(
          `Failed to download models.dev catalog and no existing catalog found: ${error.message}`,
        );
      }
    }
  }

  await copyToDist();

  if (!fetched && canFetch) {
    // Already logged warning above; just confirm dist is in place.
    console.log(`Using existing catalog at ${FULL_OUTPUT_PATH}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
