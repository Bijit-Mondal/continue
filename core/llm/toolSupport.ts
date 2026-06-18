import { parseProxyModelName } from "@continuedev/config-yaml";

import type { ModelDescription } from "..";
import {
  isRecommendedAgentModelFromMetadata,
  modelSupportsNativeToolsFromMetadata,
} from "./modelsDevModelIndex.js";

const metadataBackedSupport = (model: string): boolean =>
  modelSupportsNativeToolsFromMetadata(model) ?? false;

function getContinueProxySupport(model: string): boolean {
  try {
    const { provider, model: parsedModel } = parseProxyModelName(model);
    if (provider && parsedModel && provider !== "continue-proxy") {
      const providerSupport = PROVIDER_TOOL_SUPPORT[provider];
      if (providerSupport) {
        return providerSupport(parsedModel);
      }

      const metadataSupport = modelSupportsNativeToolsFromMetadata(parsedModel);
      if (metadataSupport !== undefined) {
        return metadataSupport;
      }
    }
  } catch {
    // Fall back to metadata lookup below.
  }

  const metadataSupport = modelSupportsNativeToolsFromMetadata(model);
  if (metadataSupport !== undefined) {
    return metadataSupport;
  }

  const tail = model.split("/").pop() ?? model;
  return modelSupportsNativeToolsFromMetadata(tail) ?? false;
}

const providerToolSupportTarget: Record<string, (model: string) => boolean> = {
  "continue-proxy": getContinueProxySupport,
};

export const PROVIDER_TOOL_SUPPORT: Record<string, (model: string) => boolean> =
  new Proxy(providerToolSupportTarget, {
    get(target, property, receiver) {
      if (typeof property !== "string") {
        return Reflect.get(target, property, receiver);
      }

      if (Object.hasOwn(target, property)) {
        return target[property];
      }

      return metadataBackedSupport;
    },
  });

export function isRecommendedAgentModel(modelName: string): boolean {
  const normalizedModelName = modelName.trim();
  if (!normalizedModelName) {
    return false;
  }

  return isRecommendedAgentModelFromMetadata(normalizedModelName);
}

export function isRecommendedAgentModelForModelConfig(params: {
  model?: string;
  name?: string;
}): boolean {
  const modelName = [params.model, params.name].find(
    (value) => value?.trim().length,
  );
  if (!modelName) {
    return false;
  }

  return isRecommendedAgentModel(modelName);
}

export function modelSupportsNativeTools(modelDescription: ModelDescription) {
  if (modelDescription.capabilities?.tools !== undefined) {
    return modelDescription.capabilities.tools;
  }

  const providerSupport = PROVIDER_TOOL_SUPPORT[modelDescription.provider];
  if (providerSupport) {
    return providerSupport(modelDescription.model);
  }

  return modelSupportsNativeToolsFromMetadata(modelDescription.model) ?? false;
}
