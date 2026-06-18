import fs from "node:fs";
import path from "node:path";

import { getUsesSlug } from "core/llm/modelsDevBlockTemplate.js";
import { setConfigFilePermissions } from "core/util/paths.js";

import { env } from "../../env.js";
import { services } from "../../services/index.js";
import { resolveApiKeyForProvider } from "../../util/modelsCatalog.js";
import { addModelUsesToYaml } from "../../util/yamlConfigUpdater.js";
import { useNavigation } from "../context/NavigationContext.js";
import type { ModelsCatalogSelection } from "../ModelsCatalogSelector.js";

interface UseModelsCatalogSelectorProps {
  onMessage: (message: {
    role: string;
    content: string;
    messageType: "system";
  }) => void;
  onRefreshUI?: () => void;
}

const CONFIG_PATH = path.join(env.continueHome, "config.yaml");

export function useModelsCatalogSelector({
  onMessage,
  onRefreshUI,
}: UseModelsCatalogSelectorProps) {
  const { closeCurrentScreen } = useNavigation();

  const handleModelsCatalogSelect = async (
    selection: ModelsCatalogSelection,
  ) => {
    closeCurrentScreen();

    try {
      const existingContent = fs.existsSync(CONFIG_PATH)
        ? fs.readFileSync(CONFIG_PATH, "utf8")
        : "";

      const apiKey = resolveApiKeyForProvider(
        selection.providerId,
        existingContent,
      );
      if (!apiKey) {
        throw new Error(
          `No API key found for provider "${selection.providerId}". Add one to ${CONFIG_PATH} or set the provider environment variable.`,
        );
      }

      const { yaml, added } = addModelUsesToYaml(
        existingContent,
        selection.providerId,
        selection.modelId,
        apiKey,
      );

      const configDir = path.dirname(CONFIG_PATH);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      fs.writeFileSync(CONFIG_PATH, yaml);
      setConfigFilePermissions(CONFIG_PATH);

      const currentConfigPath =
        services.config.getState().configPath ?? CONFIG_PATH;
      await services.config.updateConfigPath(currentConfigPath);

      const usesSlug = getUsesSlug(selection.providerId, selection.modelId);
      onMessage({
        role: "system",
        content: added
          ? `Added model ${usesSlug} to ${CONFIG_PATH}`
          : `Updated model ${usesSlug} in ${CONFIG_PATH}`,
        messageType: "system",
      });

      onRefreshUI?.();
    } catch (error: any) {
      onMessage({
        role: "system",
        content: `Failed to add model: ${error.message}`,
        messageType: "system",
      });
    }
  };

  return {
    handleModelsCatalogSelect,
  };
}
