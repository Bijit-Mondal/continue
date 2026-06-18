import { isRecommendedAgentModelForModelConfig } from "core/llm/toolSupport.js";

/**
 * Determines whether a model should use agent-class tooling in Tezz CLI.
 *
 * This intentionally mirrors core's MultiEdit gating logic.
 */
export function isModelCapable(
  _provider: string,
  name: string,
  model?: string,
): boolean {
  return isRecommendedAgentModelForModelConfig({ name, model });
}
