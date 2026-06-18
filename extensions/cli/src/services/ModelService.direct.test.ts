import { describe, it, expect, beforeEach } from "vitest";

import { ModelService } from "./ModelService.js";

describe("ModelService - Direct Testing", () => {
  let modelService: ModelService;

  beforeEach(() => {
    modelService = new ModelService();
  });

  it("should throw 'ModelService not initialized' when switching without initialization", async () => {
    // The service is created but not initialized
    expect(modelService.getCurrentModelIndex()).toBe(-1);

    // Try to switch model without initialization
    try {
      await modelService.switchModel(0);
      // Should not reach here
      expect(true).toBe(false);
    } catch (error: any) {
      // Should throw the specific error
      expect(error.message).toBe(
        "ModelService not initialized - assistant data missing",
      );
    }
  });

  it("should handle model switching for non-proxy models", async () => {
    const mockAssistant = {
      name: "Test Assistant",
      version: "1.0.0",
      models: [
        {
          name: "claude-3.5-sonnet",
          provider: "anthropic",
          model: "claude-3.5-sonnet",
          apiKey: "test-anthropic-key",
          roles: ["chat"],
        },
        {
          name: "GPT-4",
          provider: "openai",
          model: "gpt-4",
          apiKey: "test-openai-key",
          roles: ["chat"],
        },
      ],
    };

    const initialState = await modelService.initialize(mockAssistant as any);

    expect(initialState.assistant).toBe(mockAssistant);
    expect(initialState.model).toBeDefined();
    expect((initialState.model as any).name).toBe("claude-3.5-sonnet");

    const switchedState = await modelService.switchModel(1);
    expect(switchedState.model).toBeDefined();
    expect((switchedState.model as any).name).toBe("GPT-4");
    expect(switchedState.assistant).toBe(mockAssistant);

    const modelInfo = modelService.getModelInfo();
    expect(modelInfo?.name).toBe("GPT-4");
    expect(modelInfo?.provider).toBe("openai");
  });

  it("should successfully switch model after proper initialization", async () => {
    const mockAssistant = {
      name: "Test Assistant",
      version: "1.0.0",
      models: [
        {
          name: "GPT-4",
          provider: "openai",
          model: "gpt-4",
          apiKey: "test-key-1",
          roles: ["chat"],
        },
        {
          name: "GPT-3.5",
          provider: "openai",
          model: "gpt-3.5-turbo",
          apiKey: "test-key-2",
          roles: ["chat"],
        },
      ],
    };

    const initialState = await modelService.initialize(mockAssistant as any);

    const availableModels = modelService.getAvailableChatModels();
    expect(availableModels.length).toBe(2);
    expect(initialState.model).toBeDefined();
    expect((initialState.model as any).name).toBe("GPT-4");

    await modelService.switchModel(1);
    expect(modelService.getCurrentModelIndex()).toBe(1);

    const modelInfo = modelService.getModelInfo();
    expect(modelInfo?.name).toBe("GPT-3.5");
  });

  it("should handle switching to invalid model index", async () => {
    const mockAssistant = {
      name: "Test Assistant",
      version: "1.0.0",
      models: [
        {
          name: "GPT-4",
          provider: "openai",
          model: "gpt-4",
          apiKey: "test-key",
        },
      ],
    };

    await modelService.initialize(mockAssistant as any);

    try {
      await modelService.switchModel(5);
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error.message).toContain("Invalid model index");
    }
  });

  it("should successfully switch model when service is properly initialized via container", async () => {
    const mockAssistant = {
      name: "Test Assistant",
      version: "1.0.0",
      models: [
        {
          name: "GPT-4",
          provider: "openai",
          model: "gpt-4",
          apiKey: "test-key-1",
          roles: ["chat"],
        },
        {
          name: "GPT-3.5",
          provider: "openai",
          model: "gpt-3.5-turbo",
          apiKey: "test-key-2",
          roles: ["chat"],
        },
      ],
    };

    await modelService.initialize(mockAssistant as any);

    expect(modelService.isReady()).toBe(true);
    expect(modelService.getCurrentModelIndex()).toBe(0);

    const newState = await modelService.switchModel(1);

    expect(modelService.getCurrentModelIndex()).toBe(1);
    expect(newState.model).toBeDefined();
    expect((newState.model as any).name).toBe("GPT-3.5");

    const modelInfo = modelService.getModelInfo();
    expect(modelInfo).toEqual({
      provider: "openai",
      name: "GPT-3.5",
    });

    const successMessage = `Switched to model: ${modelInfo?.provider}/${modelInfo?.name}`;
    expect(successMessage).toBe("Switched to model: openai/GPT-3.5");
  });
});
