import { describe, expect, it } from "vitest";

import { ModelsDevRegistryClient } from "./modelsDevRegistry.js";

describe("ModelsDevRegistryClient", () => {
  it("resolves provider/model slugs from the models.dev catalog", async () => {
    const registry = new ModelsDevRegistryClient();
    const content = await registry.getContent({
      uriType: "slug",
      fullSlug: {
        ownerSlug: "anthropic",
        packageSlug: "claude-sonnet-4-6",
        versionSlug: "latest",
      },
    });

    expect(content).toContain("provider: anthropic");
    expect(content).toContain("model: claude-sonnet-4-6");
  });

  it("throws for unknown model slugs", async () => {
    const registry = new ModelsDevRegistryClient();

    await expect(
      registry.getContent({
        uriType: "slug",
        fullSlug: {
          ownerSlug: "anthropic",
          packageSlug: "definitely-not-a-real-model-id",
          versionSlug: "latest",
        },
      }),
    ).rejects.toThrow(/not found in the models.dev catalog/);
  });

  it("resolves OpenRouter slugs from config inputs", async () => {
    const registry = new ModelsDevRegistryClient();
    const content = await registry.getContent(
      {
        uriType: "slug",
        fullSlug: {
          ownerSlug: "anthropic",
          packageSlug: "claude-fable-latest",
          versionSlug: "latest",
        },
      },
      {
        inputs: {
          OPENROUTER_API_KEY: "sk-or-test-key",
        },
      },
    );

    expect(content).toContain("provider: openrouter");
    expect(content).toContain("model: anthropic/claude-fable-latest");
  });
});
