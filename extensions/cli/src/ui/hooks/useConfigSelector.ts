import { exec } from "child_process";
import * as path from "path";

import { env } from "../../env.js";
import { createOrUpdateConfig } from "../../onboarding.js";
import { services } from "../../services/index.js";
import { getProviderLabel } from "../../util/providerSetup.js";
import { useNavigation } from "../context/NavigationContext.js";
import type { ProviderSetupResult } from "../ProviderSetupSelector.js";

interface ConfigOption {
  id: string;
  name?: string;
  type: "local" | "assistant" | "create";
  slug?: string;
  organizationId?: string | null;
}

interface UseConfigSelectorProps {
  configPath?: string;
  onMessage: (message: {
    role: string;
    content: string;
    messageType: "system";
  }) => void;
  handleClear: () => void;
  onRefreshUI?: () => void;
}

const CONFIG_PATH = path.join(env.continueHome, "config.yaml");

export function useConfigSelector({
  onMessage,
  handleClear,
  onRefreshUI,
}: UseConfigSelectorProps) {
  const { closeCurrentScreen } = useNavigation();

  const reloadLocalConfig = async (messagePrefix: string) => {
    onMessage({
      role: "system",
      content: `${messagePrefix} ${CONFIG_PATH}...`,
      messageType: "system" as const,
    });

    await services.config.updateConfigPath(CONFIG_PATH);
    handleClear();
    onRefreshUI?.();

    onMessage({
      role: "system",
      content: `Successfully reloaded ${CONFIG_PATH}`,
      messageType: "system" as const,
    });
  };

  const handleConfigSelect = async (config: ConfigOption) => {
    closeCurrentScreen();

    if (config.type === "create") {
      const url = new URL("https://tezz.dev/new");
      url.searchParams.set("type", "assistant");

      try {
        let command: string;
        if (process.platform === "darwin") {
          command = `open "${url}"`;
        } else if (process.platform === "win32") {
          command = `start "${url}"`;
        } else {
          command = `xdg-open "${url}"`;
        }

        exec(command, (error) => {
          if (error) {
            console.error("Failed to open browser:", error);
          }
        });

        onMessage({
          role: "system",
          content: `Opening ${url} in your browser to create a new assistant...`,
          messageType: "system" as const,
        });
      } catch {
        onMessage({
          role: "system",
          content: `Please visit ${url} to create a new assistant`,
          messageType: "system" as const,
        });
      }
      return;
    }

    try {
      if (config.id === "reload-local") {
        await reloadLocalConfig("Reloading configuration:");
        return;
      }

      onMessage({
        role: "system",
        content: "Switching to local config.yaml...",
        messageType: "system" as const,
      });

      await services.config.updateConfigPath(CONFIG_PATH);
      handleClear();
      onRefreshUI?.();

      onMessage({
        role: "system",
        content: "Successfully switched to local config.yaml",
        messageType: "system" as const,
      });
    } catch (error: any) {
      onMessage({
        role: "system",
        content: `Failed to switch configuration: ${error.message}`,
        messageType: "system" as const,
      });
    }
  };

  const handleProviderSetup = async ({
    providerId,
    apiKey,
  }: ProviderSetupResult) => {
    await createOrUpdateConfig(apiKey, providerId);
    await services.config.updateConfigPath(CONFIG_PATH);

    closeCurrentScreen();
    onRefreshUI?.();

    onMessage({
      role: "system",
      content: `Added ${getProviderLabel(providerId)} to ${CONFIG_PATH}. Use /models to add more models for this provider.`,
      messageType: "system" as const,
    });
  };

  return {
    handleConfigSelect,
    handleProviderSetup,
  };
}
