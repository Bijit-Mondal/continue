import { Box, Text, useInput } from "ink";
import React, { useCallback, useEffect, useState } from "react";

import { getClipboardText } from "../util/clipboard.js";
import {
  getProviderApiKeyInput,
  getProviderLabel,
  ONBOARDING_PROVIDERS,
  type OnboardingProvider,
  validateProviderApiKey,
} from "../util/providerSetup.js";

import { defaultBoxStyles } from "./styles.js";
import { TextBuffer } from "./TextBuffer.js";

export interface ProviderSetupResult {
  providerId: OnboardingProvider;
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

export const ProviderSetupSelector: React.FC<ProviderSetupSelectorProps> = ({
  onComplete,
  onCancel,
  saveError,
}) => {
  const [step, setStep] = useState<"provider" | "api-key">("provider");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedProviderId, setSelectedProviderId] =
    useState<OnboardingProvider>("anthropic");
  const [textBuffer] = useState(() => new TextBuffer());
  const [maskedLength, setMaskedLength] = useState(0);
  const [error, setError] = useState<string | null>(null);

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
          current === 0 ? ONBOARDING_PROVIDERS.length - 1 : current - 1,
        );
        return;
      }

      if (key.downArrow) {
        setSelectedIndex((current) =>
          current === ONBOARDING_PROVIDERS.length - 1 ? 0 : current + 1,
        );
        return;
      }

      if (key.return) {
        const providerId = ONBOARDING_PROVIDERS[selectedIndex] ?? "anthropic";
        setSelectedProviderId(providerId);
        resetApiKeyEntry();
        setStep("api-key");
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
          Choose a provider to configure
        </Text>
        <Box flexDirection="column" marginTop={1}>
          {ONBOARDING_PROVIDERS.map((providerId, index) => {
            const isSelected = index === selectedIndex;
            return (
              <Text
                key={providerId}
                color={isSelected ? "blue" : "white"}
                bold={isSelected}
              >
                {isSelected ? "➤ " : "  "}
                {getProviderLabel(providerId)}
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
