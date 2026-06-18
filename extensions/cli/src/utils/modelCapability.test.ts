import { isRecommendedAgentModelForModelConfig } from "core/llm/toolSupport.js";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { isModelCapable } from "./modelCapability.js";

vi.mock("core/llm/toolSupport.js", () => ({
  isRecommendedAgentModelForModelConfig: vi.fn(),
}));

describe("isModelCapable", () => {
  beforeEach(() => {
    vi.mocked(isRecommendedAgentModelForModelConfig).mockReset();
  });

  test("passes model and name through shared helper", () => {
    vi.mocked(isRecommendedAgentModelForModelConfig).mockReturnValue(true);

    const capable = isModelCapable(
      "openai",
      "OpenAI GPT-4.1",
      "gpt-4.1-2025-04-14",
    );

    expect(capable).toBe(true);
    expect(isRecommendedAgentModelForModelConfig).toHaveBeenCalledWith({
      model: "gpt-4.1-2025-04-14",
      name: "OpenAI GPT-4.1",
    });
  });

  test("falls back to helper result when model id is missing", () => {
    vi.mocked(isRecommendedAgentModelForModelConfig).mockReturnValue(false);

    const capable = isModelCapable("anthropic", "claude-sonnet-4-20250514");

    expect(capable).toBe(false);
    expect(isRecommendedAgentModelForModelConfig).toHaveBeenCalledWith({
      model: undefined,
      name: "claude-sonnet-4-20250514",
    });
  });

  test("returns helper result when neither model id nor name is provided", () => {
    vi.mocked(isRecommendedAgentModelForModelConfig).mockReturnValue(false);

    const capable = isModelCapable("openai", "", "");

    expect(capable).toBe(false);
    expect(isRecommendedAgentModelForModelConfig).toHaveBeenCalledWith({
      model: "",
      name: "",
    });
  });

  test("ignores provider and mirrors core result", () => {
    vi.mocked(isRecommendedAgentModelForModelConfig).mockReturnValueOnce(true);
    vi.mocked(isRecommendedAgentModelForModelConfig).mockReturnValueOnce(false);

    expect(isModelCapable("openai", "same-model", "same-model")).toBe(true);
    expect(isModelCapable("custom", "same-model", "same-model")).toBe(false);
  });
});
