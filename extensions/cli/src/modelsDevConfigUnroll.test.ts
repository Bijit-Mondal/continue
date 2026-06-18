import { unrollAssistantFromContent } from "@continuedev/config-yaml";
import { describe, expect, it } from "vitest";

import { CLIPlatformClient } from "./CLIPlatformClient.js";
import { ModelsDevRegistryClient } from "./modelsDevRegistry.js";

describe("models.dev config unroll", () => {
  it("unrolls uses: slugs from local config yaml", async () => {
    const yaml = `name: Main Config
version: 1.0.0
schema: v1
models:
  - uses: anthropic/claude-sonnet-4-6
    with:
      ANTHROPIC_API_KEY: sk-ant-test123456789
`;

    const result = await unrollAssistantFromContent(
      { uriType: "file", fileUri: "" },
      yaml,
      new ModelsDevRegistryClient(),
      {
        currentUserSlug: "",
        platformClient: new CLIPlatformClient(null, {} as any),
        renderSecrets: true,
        injectBlocks: [],
      },
    );

    expect(result.config?.models?.[0]).toMatchObject({
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      apiKey: "sk-ant-test123456789",
    });
  });

  it("unrolls OpenRouter uses slugs with nested model paths", async () => {
    const yaml = `name: Main Config
version: 1.0.0
schema: v1
models:
  - uses: anthropic/claude-fable-latest
    with:
      OPENROUTER_API_KEY: sk-or-test-key
`;

    const result = await unrollAssistantFromContent(
      { uriType: "file", fileUri: "" },
      yaml,
      new ModelsDevRegistryClient(),
      {
        currentUserSlug: "",
        platformClient: new CLIPlatformClient(null, {} as any),
        renderSecrets: true,
        injectBlocks: [],
      },
    );

    expect(result.config?.models?.[0]).toMatchObject({
      provider: "openrouter",
      model: "anthropic/claude-fable-latest",
      apiKey: "sk-or-test-key",
    });
  });
});
