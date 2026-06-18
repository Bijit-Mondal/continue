import * as fs from "fs";
import * as path from "path";

import React, { useEffect, useMemo, useState } from "react";

import { env } from "../env.js";
import { services } from "../services/index.js";

import {
  ProviderSetupSelector,
  type ProviderSetupResult,
} from "./ProviderSetupSelector.js";
import { Selector, SelectorOption } from "./Selector.js";
import type { ConfigOption } from "./types/selectorTypes.js";

interface ConfigMenuOption extends SelectorOption {
  action: "add-provider" | "local" | "reload-local";
}

interface ConfigSelectorProps {
  onSelect: (config: ConfigOption) => void;
  onProviderSetup: (result: ProviderSetupResult) => Promise<void>;
  onCancel: () => void;
}

const CONFIG_PATH = path.join(env.continueHome, "config.yaml");

const ConfigSelector: React.FC<ConfigSelectorProps> = ({
  onSelect,
  onProviderSetup,
  onCancel,
}) => {
  const [view, setView] = useState<"menu" | "add-provider">("menu");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentConfigId, setCurrentConfigId] = useState<string | null>(null);
  const [isSavingProvider, setIsSavingProvider] = useState(false);

  const menuOptions = useMemo(() => {
    const options: ConfigMenuOption[] = [
      {
        id: "add-provider",
        name: "Add provider API key",
        action: "add-provider",
      },
    ];

    if (fs.existsSync(CONFIG_PATH)) {
      options.push({
        id: "local",
        name: "Use local config.yaml",
        action: "local",
      });
      options.push({
        id: "reload-local",
        name: "Reload local config.yaml",
        action: "reload-local",
      });
    }

    return options;
  }, [loading]);

  useEffect(() => {
    try {
      const currentConfigState = services.config.getState();
      if (
        currentConfigState.configPath === CONFIG_PATH &&
        fs.existsSync(CONFIG_PATH)
      ) {
        setCurrentConfigId("local");
      }
      setLoading(false);
    } catch (err: any) {
      setError(err.message || "Failed to load configuration state");
      setLoading(false);
    }
  }, []);

  if (view === "add-provider") {
    if (isSavingProvider) {
      return (
        <Selector
          title="Add Provider"
          options={[]}
          selectedIndex={0}
          loading
          error={null}
          loadingMessage="Saving provider configuration..."
          onCancel={onCancel}
          onNavigate={() => {}}
          onSelect={() => {}}
        />
      );
    }

    return (
      <ProviderSetupSelector
        saveError={error}
        onCancel={() => {
          setError(null);
          setView("menu");
        }}
        onComplete={async (result) => {
          setIsSavingProvider(true);
          setError(null);
          try {
            await onProviderSetup(result);
          } catch (saveError: any) {
            setError(saveError.message ?? "Failed to add provider");
            setIsSavingProvider(false);
          }
        }}
      />
    );
  }

  return (
    <Selector
      title="Configuration"
      options={menuOptions}
      selectedIndex={selectedIndex}
      loading={loading}
      error={error}
      loadingMessage="Loading configurations..."
      currentId={currentConfigId}
      onCancel={onCancel}
      onNavigate={setSelectedIndex}
      onSelect={(option) => {
        if (option.action === "add-provider") {
          setView("add-provider");
          setError(null);
          return;
        }

        if (option.action === "local") {
          onSelect({ id: "local", name: "Local config.yaml", type: "local" });
          return;
        }

        onSelect({
          id: "reload-local",
          name: "Local config.yaml",
          type: "local",
        });
      }}
    />
  );
};

export { ConfigSelector };
