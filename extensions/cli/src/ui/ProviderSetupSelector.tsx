import { Box, Text, useInput } from "ink";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import { getClipboardText } from "../util/clipboard.js";
import {
  getProviderApiKeyInput,
  getProviderLabel,
  ONBOARDING_PROVIDERS,
  validateProviderApiKey,
} from "../util/providerSetup.js";

import { defaultBoxStyles } from "./styles.js";
import { TextBuffer } from "./TextBuffer.js";

export interface ProviderSetupResult {
  providerId: string;
  apiKey: string;
}

export function sanitizeApiKeyPaste(text: string): string {
  return text.trim().replace(/[\r\n\t]/g, "");
}

interface ProviderSetupSelectorProps {
  onComplete: (result: ProviderSetupResult) => void | Promise<void>;
  onCancel: () => void;
  saveError?: string | null;
}

const MAX_VISIBLE_OPTIONS = 12;

function filterProviderIds(
  providerIds: readonly string[],
  query: string,
): string[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return [...providerIds];
  }

  return providerIds.filter((providerId) =>
    providerId.toLowerCase().includes(normalizedQuery),
  );
}

export const ProviderSetupSelector: React.FC<ProviderSetupSelectorProps> = ({
  onComplete,
  onCancel,
  saveError,
}) => {
  const [step, setStep] = useState<"provider" | "api-key">("provider");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedProviderId, setSelectedProviderId] = useState("anthropic");
  const [filter, setFilter] = useState("");
  const [textBuffer] = useState(() => new TextBuffer());
  const [maskedLength, setMaskedLength] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const providerOptions = useMemo(
    () => filterProviderIds(ONBOARDING_PROVIDERS, filter),
    [filter],
  );

  const visibleProviderOptions = useMemo(
    () => providerOptions.slice(0, MAX_VISIBLE_OPTIONS),
    [providerOptions],
  );

  const syncMaskedLength = useCallback(() => {
    setMaskedLength(textBuffer.text.length);
  }, [textBuffer]);

  useEffect(() => {
    textBuffer.setStateChangeCallback(syncMaskedLength);

    return () => {
      textBuffer.clear();
    };
  }, [syncMaskedLength, textBuffer]);

  const resetApiKeyEntry = useCallback(() => {
    textBuffer.clear();
    setMaskedLength(0);
    setError(null);
  }, [textBuffer]);

  const pasteApiKeyFromClipboard = useCallback(async () => {
    const clipboardText = await getClipboardText();
    if (!clipboardText) {
      return;
    }

    const sanitized = sanitizeApiKeyPaste(clipboardText);
    if (!sanitized) {
      return;
    }

    textBuffer.insertText(sanitized);
    syncMaskedLength();
    setError(null);
  }, [syncMaskedLength, textBuffer]);

  useInput((input, key) => {
    if (key.escape || (key.ctrl && input === "c")) {
      if (step === "api-key") {
        setStep("provider");
        resetApiKeyEntry();
        return;
      }
      onCancel();
      return;
    }

    if (step === "provider") {
      if (key.upArrow) {
        setSelectedIndex((current) =>
          current === 0 ? Math.max(providerOptions.length - 1, 0) : current - 1,
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
        const providerId = providerOptions[selectedIndex];
        if (!providerId) {
          return;
        }
        setSelectedProviderId(providerId);
        setFilter("");
        setSelectedIndex(0);
        resetApiKeyEntry();
        setStep("api-key");
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

      return;
    }

    if (key.ctrl && input === "v") {
      void pasteApiKeyFromClipboard();
      return;
    }

    if (key.return) {
      textBuffer.expandAllPasteBlocks();
      const apiKey = sanitizeApiKeyPaste(textBuffer.text);
      try {
        validateProviderApiKey(selectedProviderId, apiKey);
        onComplete({ providerId: selectedProviderId, apiKey });
      } catch (validationError: any) {
        setError(validationError.message ?? "Invalid API key");
      }
      return;
    }

    if (key.backspace || key.delete || input) {
      textBuffer.handleInput(input, key);
      syncMaskedLength();
      setError(null);
    }
  });

  if (step === "provider") {
    return (
      <Box {...defaultBoxStyles("blue")}>
        <Text color="blue" bold>
          Add Provider
        </Text>
        <Text color="gray" dimColor>
          Choose a provider from the models.dev catalog
        </Text>
        <Text color="white">Filter: {filter || "(none)"}</Text>
        <Box flexDirection="column" marginTop={1}>
          {visibleProviderOptions.length === 0 ? (
            <Text color="yellow">No providers match this filter.</Text>
          ) : (
            visibleProviderOptions.map((providerId, index) => {
              const isSelected = index === selectedIndex;
              return (
                <Text
                  key={providerId}
                  color={isSelected ? "blue" : "white"}
                  bold={isSelected}
                >
                  {isSelected ? "➤ " : "  "}
                  {getProviderLabel(providerId)} ({providerId})
                </Text>
              );
            })
          )}
        </Box>
        {providerOptions.length > MAX_VISIBLE_OPTIONS && (
          <Text color="gray" dimColor>
            Showing {MAX_VISIBLE_OPTIONS} of {providerOptions.length} matches
          </Text>
        )}
        <Box marginTop={1}>
          <Text color="gray" dimColor>
            Type to filter, ↑/↓ to navigate, Enter to select, Esc to cancel
          </Text>
        </Box>
      </Box>
    );
  }

  const apiKeyInput = getProviderApiKeyInput(selectedProviderId);

  return (
    <Box {...defaultBoxStyles("blue")}>
      <Text color="blue" bold>
        Add {getProviderLabel(selectedProviderId)} API Key
      </Text>
      <Text color="gray" dimColor>
        Enter your {apiKeyInput} value
      </Text>
      <Box marginTop={1}>
        <Text color="white">
          {apiKeyInput}: {"*".repeat(maskedLength)}
        </Text>
      </Box>
      {error && (
        <Box marginTop={1}>
          <Text color="red">{error}</Text>
        </Box>
      )}
      {saveError && !error && (
        <Box marginTop={1}>
          <Text color="red">{saveError}</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          Type or Ctrl+V to paste, Enter to save, Esc to go back
        </Text>
      </Box>
    </Box>
  );
};
