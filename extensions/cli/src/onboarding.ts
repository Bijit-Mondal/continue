import * as fs from "fs";
import * as path from "path";

import { continueProviderToModelsDevProvider } from "core/llm/modelsDevBlockTemplate.js";
import { setConfigFilePermissions } from "core/util/paths.js";

import { c } from "./constants/theme.js";
import { getApiClient } from "./config.js";
import { loadConfiguration } from "./configLoader.js";
import { env } from "./env.js";
import { question } from "./util/prompt.js";
import {
  isOnboardingProvider,
  type OnboardingProvider,
  POPULAR_PROVIDERS,
  validateProviderApiKey,
  getProviderApiKeyInput,
  getProviderLabel,
} from "./util/providerSetup.js";
import {
  getDefaultProviderFromEnv,
  updateConfigFromEnvApiKeys,
  updateProviderModelsInYaml,
} from "./util/yamlConfigUpdater.js";

const CONFIG_PATH = path.join(env.continueHome, "config.yaml");

export async function checkHasAcceptableModel(
  configPath: string,
): Promise<boolean> {
  try {
    if (!fs.existsSync(configPath)) {
      return false;
    }

    const content = fs.readFileSync(configPath, "utf8");
    return /uses:\s+\w+\//.test(content) || /provider:\s+\w+/.test(content);
  } catch {
    return false;
  }
}

export async function createOrUpdateConfig(
  apiKey: string,
  providerId: string = "anthropic",
): Promise<void> {
  const configDir = path.dirname(CONFIG_PATH);

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  const existingContent = fs.existsSync(CONFIG_PATH)
    ? fs.readFileSync(CONFIG_PATH, "utf8")
    : "";

  const updatedContent = updateProviderModelsInYaml(
    existingContent,
    continueProviderToModelsDevProvider(providerId),
    apiKey,
  );
  fs.writeFileSync(CONFIG_PATH, updatedContent);
  setConfigFilePermissions(CONFIG_PATH);
}

async function promptForProvider(): Promise<OnboardingProvider> {
  console.log(c.primary("Popular providers:"));
  POPULAR_PROVIDERS.forEach((provider, index) => {
    console.log(
      c.white(`  ${index + 1}. ${getProviderLabel(provider)} (${provider})`),
    );
  });
  console.log(
    c.mutedForeground(
      "\nYou can also enter any models.dev provider ID (e.g. xai).",
    ),
  );

  while (true) {
    const answer = await question(c.white("\nProvider ID [anthropic]: "));
    const provider = answer.trim() || "anthropic";

    if (isOnboardingProvider(provider)) {
      return provider;
    }

    console.log(
      c.destructive(`"${provider}" is not a known models.dev provider ID.`),
    );
  }
}

export async function runOnboardingFlow(
  configPath: string | undefined,
): Promise<boolean> {
  if (configPath !== undefined) {
    return false;
  }

  if (process.env.CONTINUE_USE_BEDROCK === "1") {
    console.log(
      c.primary("✓ Using AWS Bedrock (CONTINUE_USE_BEDROCK detected)"),
    );
    return true;
  }

  const isTestEnv =
    process.env.NODE_ENV === "test" ||
    process.env.CI === "true" ||
    process.env.VITEST === "true" ||
    process.env.GITHUB_ACTIONS === "true" ||
    !process.stdin.isTTY;

  if (isTestEnv) {
    const envProvider = getDefaultProviderFromEnv();
    if (envProvider && isOnboardingProvider(envProvider)) {
      const apiKeyEnv = getProviderApiKeyInput(envProvider);
      const apiKey = process.env[apiKeyEnv];
      if (apiKey) {
        console.log(c.primary(`✓ Using ${apiKeyEnv} from environment`));
        await createOrUpdateConfig(apiKey, envProvider);
        console.log(c.mutedForeground(`  Config saved to: ${CONFIG_PATH}`));
        return false;
      }
    }

    if (
      process.env.ANTHROPIC_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.OPENROUTER_API_KEY
    ) {
      const existingContent = fs.existsSync(CONFIG_PATH)
        ? fs.readFileSync(CONFIG_PATH, "utf8")
        : "";
      const updatedContent = updateConfigFromEnvApiKeys(existingContent);
      fs.writeFileSync(CONFIG_PATH, updatedContent);
      setConfigFilePermissions(CONFIG_PATH);
      console.log(c.primary("✓ Updated config from environment API keys"));
      return false;
    }

    return false;
  }

  const provider = await promptForProvider();
  const apiKeyInput = getProviderApiKeyInput(provider);

  console.log(
    c.primary(
      `\nEnter your ${getProviderLabel(provider)} API key (${apiKeyInput}).`,
    ),
  );

  const apiKey = await question(c.white("\nAPI key: "));
  validateProviderApiKey(provider, apiKey);

  await createOrUpdateConfig(apiKey, provider);
  console.log(
    c.primary(`✓ Config file updated successfully at ${CONFIG_PATH}`),
  );

  return true;
}

export async function isFirstTime(): Promise<boolean> {
  return !fs.existsSync(path.join(env.continueHome, ".onboarding_complete"));
}

export async function markOnboardingComplete(): Promise<void> {
  const flagPath = path.join(env.continueHome, ".onboarding_complete");
  const flagDir = path.dirname(flagPath);

  if (!fs.existsSync(flagDir)) {
    fs.mkdirSync(flagDir, { recursive: true });
  }

  fs.writeFileSync(flagPath, new Date().toISOString());
}

export async function initializeWithOnboarding(configPath: string | undefined) {
  const firstTime = await isFirstTime();

  if (configPath !== undefined) {
    try {
      await loadConfiguration(configPath, getApiClient(undefined), [], false);
    } catch (errorMessage) {
      throw new Error(
        `Failed to load config from "${configPath}": ${errorMessage}`,
      );
    }
  }

  if (!firstTime) return;

  const wasOnboarded = await runOnboardingFlow(configPath);
  if (wasOnboarded) {
    await markOnboardingComplete();
  }
}
