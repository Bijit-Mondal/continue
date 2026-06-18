import { RegistryClient } from "@continuedev/config-yaml";
import type {
  PackageIdentifier,
  RegistryGetContentOptions,
} from "@continuedev/config-yaml";
import {
  generateModelBlockYaml,
  resolveModelFromUsesSlug,
} from "core/llm/modelsDevBlockTemplate.js";

/**
 * Resolves provider/model slugs (e.g. anthropic/claude-sonnet-4-6) using the
 * bundled models.dev catalog. Falls back to file-based resolution for local paths.
 */
export class ModelsDevRegistryClient extends RegistryClient {
  async getContent(
    id: PackageIdentifier,
    options?: RegistryGetContentOptions,
  ): Promise<string> {
    if (id.uriType === "slug") {
      const usesSlug = `${id.fullSlug.ownerSlug}/${id.fullSlug.packageSlug}`;
      const { providerId, modelId } = resolveModelFromUsesSlug(
        usesSlug,
        options?.inputs,
      );
      const blockYaml = generateModelBlockYaml(providerId, modelId);
      if (blockYaml) {
        return blockYaml;
      }

      throw new Error(
        `Model block "${usesSlug}" was not found in the models.dev catalog`,
      );
    }

    return super.getContent(id, options);
  }
}
