import { AssistantUnrolled, ModelConfig } from "@continuedev/config-yaml";
import { describe, expect, test, beforeEach } from "vitest";

import { getLlmApi } from "./config.js";

describe("config", () => {
  beforeEach(() => {
    // No auth setup needed
  });

  describe("getLlmApi()", () => {
    test("should throw error when models array is empty", () => {
      const assistant: AssistantUnrolled = {
        name: "test-assistant",
        version: "1.0.0",
        models: [],
      };

      expect(() => getLlmApi(assistant)).toThrow(
        "No models found in the configured assistant",
      );
    });

    test("should throw error when no chat models available", () => {
      const assistant: AssistantUnrolled = {
        name: "test-assistant",
        version: "1.0.0",
        models: [
          {
            provider: "openai",
            model: "text-embedding-ada-002",
            name: "Ada Embeddings",
            roles: ["embed"],
          } as ModelConfig,
        ],
      };

      expect(() => getLlmApi(assistant)).toThrow(
        "No models with the chat role found in the configured assistant",
      );
    });
  });
});
