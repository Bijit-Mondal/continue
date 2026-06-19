import { Box, Text, useInput } from "ink";
import React, { useMemo, useState } from "react";

import { getProviderLabel } from "../util/providerSetup.js";
import {
  filterCatalogModels,
  formatModelCatalogLabel,
  getProvidersWithApiKeys,
  listCatalogModelsForProvider,
  type ProviderWithApiKey,
} from "../util/modelsCatalog.js";

import { defaultBoxStyles } from "./styles.js";

export interface ModelsCatalogSelection {
  providerId: string;
  modelId: string;
}

interface ModelsCatalogSelectorProps {
  initialProviderId?: string;
  onSelect: (selection: ModelsCatalogSelection) => void;
  onCancel: () => void;
}

const MAX_VISIBLE_OPTIONS = 12;

function formatProviderLabel(provider: ProviderWithApiKey): string {
  return `${getProviderLabel(provider.providerId)} (${provider.providerId})`;
}

export const ModelsCatalogSelector: React.FC<ModelsCatalogSelectorProps> = ({
  initialProviderId,
  onSelect,
  onCancel,
}) => {
  const providers = useMemo(() => getProvidersWithApiKeys(), []);
  const resolvedInitialProvider = providers.find(
    (provider) => provider.providerId === initialProviderId,
  )?.providerId;

  const [step, setStep] = useState<"provider" | "model">(
    resolvedInitialProvider ? "model" : "provider",
  );
  const [selectedProviderId, setSelectedProviderId] = useState<
    string | undefined
  >(resolvedInitialProvider);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filter, setFilter] = useState("");

  const providerOptions = providers;
  const modelOptions = useMemo(() => {
    if (!selectedProviderId) {
      return [];
    }
    return filterCatalogModels(
      listCatalogModelsForProvider(selectedProviderId),
      filter,
    );
  }, [filter, selectedProviderId]);

  const visibleModelOptions = modelOptions.slice(0, MAX_VISIBLE_OPTIONS);

  useInput((input, key) => {
    if (key.escape || (key.ctrl && input === "c")) {
      if (step === "model" && !resolvedInitialProvider) {
        setStep("provider");
        setFilter("");
        setSelectedIndex(0);
        return;
      }
      onCancel();
      return;
    }

    if (step === "provider") {
      if (key.upArrow) {
        setSelectedIndex((current) =>
          current === 0 ? providerOptions.length - 1 : current - 1,
        );
        return;
      }

      if (key.downArrow) {
        setSelectedIndex((current) =>
          current === providerOptions.length - 1 ? 0 : current + 1,
        );
        return;
      }

      if (key.return) {
        const provider = providerOptions[selectedIndex];
        if (!provider) {
          return;
        }
        setSelectedProviderId(provider.providerId);
        setSelectedIndex(0);
        setFilter("");
        setStep("model");
      }
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((current) =>
        current === 0 ? Math.max(modelOptions.length - 1, 0) : current - 1,
      );
      return;
    }

    if (key.downArrow) {
      setSelectedIndex((current) =>
        current === modelOptions.length - 1 ? 0 : current + 1,
      );
      return;
    }

    if (key.return) {
      const model = modelOptions[selectedIndex];
      if (!model || !selectedProviderId) {
        return;
      }

      onSelect({
        providerId: selectedProviderId,
        modelId: model.id,
      });
      return;
    }

    if (key.backspace || key.delete) {
      setFilter((current) => current.slice(0, -1));
      setSelectedIndex(0);
      return;
    }

    if (input && !key.ctrl && !key.meta && input.length === 1) {
      setFilter((current) => current + input);
      setSelectedIndex(0);
    }
  });

  if (providerOptions.length === 0) {
    return (
      <Box {...defaultBoxStyles("blue")}>
        <Text color="blue" bold>
          Add Model from models.dev
        </Text>
        <Text> </Text>
        <Text color="yellow">
          No provider API keys found. Use /config to add a provider API key, or
          set an environment variable such as ANTHROPIC_API_KEY.
        </Text>
        <Text color="gray" dimColor>
          Press Esc to cancel
        </Text>
      </Box>
    );
  }

  if (step === "provider") {
    return (
      <Box {...defaultBoxStyles("blue")}>
        <Text color="blue" bold>
          Select Provider
        </Text>
        <Text color="gray" dimColor>
          Choose a provider with a configured API key
        </Text>
        <Box flexDirection="column" marginTop={1}>
          {providerOptions.map((provider, index) => {
            const isSelected = index === selectedIndex;
            return (
              <Text
                key={provider.providerId}
                color={isSelected ? "blue" : "white"}
                bold={isSelected}
              >
                {isSelected ? "➤ " : "  "}
                {formatProviderLabel(provider)}
              </Text>
            );
          })}
        </Box>
        <Box marginTop={1}>
          <Text color="gray" dimColor>
            ↑/↓ to navigate, Enter to select, Esc to cancel
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box {...defaultBoxStyles("blue")}>
      <Text color="blue" bold>
        Add Model ({selectedProviderId})
      </Text>
      <Text color="gray" dimColor>
        Type to filter models.dev catalog entries
      </Text>
      <Text color="white">Filter: {filter || "(none)"}</Text>
      <Box flexDirection="column" marginTop={1}>
        {visibleModelOptions.length === 0 ? (
          <Text color="yellow">No models match this filter.</Text>
        ) : (
          visibleModelOptions.map((model, index) => {
            const isSelected = index === selectedIndex;
            return (
              <Text
                key={model.id}
                color={isSelected ? "blue" : "white"}
                bold={isSelected}
              >
                {isSelected ? "➤ " : "  "}
                {formatModelCatalogLabel(model)}
              </Text>
            );
          })
        )}
      </Box>
      {modelOptions.length > MAX_VISIBLE_OPTIONS && (
        <Text color="gray" dimColor>
          Showing {MAX_VISIBLE_OPTIONS} of {modelOptions.length} matches
        </Text>
      )}
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          Type to filter, ↑/↓ to navigate, Enter to add, Esc to go back
        </Text>
      </Box>
    </Box>
  );
};
