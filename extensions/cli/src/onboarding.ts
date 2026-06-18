import * as fs from "fs";
import * as path from "path";

import chalk from "chalk";
import { continueProviderToModelsDevProvider } from "core/llm/modelsDevBlockTemplate.js";
import { setConfigFilePermissions } from "core/util/paths.js";

import type { AuthConfig } from "./auth/workos.js";
import { getApiClient } from "./config.js";
import { loadConfiguration } from "./configLoader.js";
import { env } from "./env.js";
import { question } from "./util/prompt.js";
import {
  isOnboardingProvider,
  type OnboardingProvider,
  validateProviderApiKey,
  getProviderApiKeyInput,
  getProviderLabel,
  ONBOARDING_PROVIDERS,
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
  providerId: OnboardingProvider = "anthropic",
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
  console.log(chalk.yellow("Choose a provider to configure:"));
  ONBOARDING_PROVIDERS.forEach((provider, index) => {
    console.log(chalk.white(`  ${index + 1}. ${getProviderLabel(provider)}`));
  });

  const answer = await question(chalk.white("\nEnter provider number [1]: "));
  const selectedIndex = Number.parseInt(answer || "1", 10) - 1;
  const provider = ONBOARDING_PROVIDERS[selectedIndex] ?? "anthropic";
  return provider;
}

export async function runOnboardingFlow(
  configPath: string | undefined,
): Promise<boolean> {
  if (configPath !== undefined) {
    return false;
  }

  if (process.env.CONTINUE_USE_BEDROCK === "1") {
    console.log(
      chalk.blue("✓ Using AWS Bedrock (CONTINUE_USE_BEDROCK detected)"),
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
        console.log(chalk.blue(`✓ Using ${apiKeyEnv} from environment`));
        await createOrUpdateConfig(apiKey, envProvider);
        console.log(chalk.gray(`  Config saved to: ${CONFIG_PATH}`));
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
      console.log(chalk.blue("✓ Updated config from environment API keys"));
      return false;
    }

    return false;
  }

  const provider = await promptForProvider();
  const apiKeyInput = getProviderApiKeyInput(provider);

  console.log(
    chalk.yellow(
      `\nEnter your ${getProviderLabel(provider)} API key (${apiKeyInput}).`,
    ),
  );

  const apiKey = await question(chalk.white("\nAPI key: "));
  validateProviderApiKey(provider, apiKey);

  await createOrUpdateConfig(apiKey, provider);
  console.log(
    chalk.green(`✓ Config file updated successfully at ${CONFIG_PATH}`),
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

export async function initializeWithOnboarding(
  authConfig: AuthConfig,
  configPath: string | undefined,
) {
  const firstTime = await isFirstTime();

  if (configPath !== undefined) {
    try {
      await loadConfiguration(
        authConfig,
        configPath,
        getApiClient(undefined),
        [],
        false,
      );
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
