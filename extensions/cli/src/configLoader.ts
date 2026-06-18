import * as fs from "fs";
import { dirname } from "node:path";
import * as path from "path";

import {
  AssistantUnrolled,
  mergeUnrolledAssistants,
  PackageIdentifier,
  unrollAssistant,
  unrollAssistantFromContent,
} from "@continuedev/config-yaml";
import { DefaultApiInterface } from "@continuedev/sdk/dist/api/dist/index.js";
import chalk from "chalk";

import { uriToPath, uriToSlug } from "./auth/uriUtils.js";
import { CLIPlatformClient } from "./CLIPlatformClient.js";
import { env } from "./env.js";
import { ModelsDevRegistryClient } from "./modelsDevRegistry.js";

function createRegistry(rootPath?: string) {
  return new ModelsDevRegistryClient({ rootPath });
}

export interface ConfigLoadResult {
  config: AssistantUnrolled;
  source: ConfigSource;
}

export type ConfigSource =
  | { type: "cli-flag"; path: string }
  | { type: "saved-uri"; uri: string }
  | { type: "user-assistant"; slug: string }
  | { type: "local-config-yaml" }
  | { type: "remote-default-config" }
  | { type: "no-config" };

/**
 * Streamlined configuration loader that implements the specification
 * with clear precedence and fallback logic in a single testable function.
 */
export async function loadConfiguration(
  cliConfigPath: string | undefined,
  apiClient: DefaultApiInterface,
  injectBlocks: PackageIdentifier[],
  isHeadless: boolean | undefined,
): Promise<ConfigLoadResult> {
  const configSource = determineConfigSource(cliConfigPath, isHeadless);

  const config = await loadFromSource(configSource, apiClient, injectBlocks);

  return { config, source: configSource };
}

/**
 * Determines the configuration source using the specification's precedence rules:
 * 1. CLI --config flag (highest priority)
 * 2. Saved config URI (if no CLI flag)
 * 3. Default resolution (if no flag and no saved URI)
 */
function determineConfigSource(
  cliConfigPath: string | undefined,
  _isHeadless: boolean | undefined,
): ConfigSource {
  // Priority 1: CLI --config flag
  if (cliConfigPath) {
    return { type: "cli-flag", path: cliConfigPath };
  }

  // Priority 2: Check for default config.yaml, then fallback to default config
  const defaultConfigPath = path.join(env.continueHome, "config.yaml");
  if (fs.existsSync(defaultConfigPath)) {
    return { type: "local-config-yaml" };
  }
  return { type: "remote-default-config" };
}

/**
 * Loads configuration from the determined source with appropriate error handling
 */
async function loadFromSource(
  source: ConfigSource,
  apiClient: DefaultApiInterface,
  injectBlocks: PackageIdentifier[],
): Promise<AssistantUnrolled> {
  try {
    switch (source.type) {
      case "cli-flag":
        return await loadFromCliFlag(source.path, apiClient, injectBlocks);

      case "saved-uri":
        return await loadFromSavedUri(source.uri, apiClient, injectBlocks);

      case "user-assistant":
        return await loadUserAssistantWithFallback(apiClient, injectBlocks);

      case "local-config-yaml":
        return await loadLocalConfigYaml(apiClient, injectBlocks);

      case "remote-default-config":
        return await loadDefaultConfig(apiClient, injectBlocks);

      // TODO this is currently skipped because we are forcing default config
      // Because models add on won't work for injected blocks e.g. default model, (only default config)
      case "no-config":
        return await unrollPackageIdentifiersAsConfigYaml(
          injectBlocks,
          apiClient,
        );
      default:
        throw new Error(`Unknown config source type: ${(source as any).type}`);
    }
  } catch (error) {
    // If we're trying user assistants and it fails, fall back to default agent
    if (source.type === "user-assistant") {
      console.warn(
        chalk.yellow(
          "Failed to load user assistants, falling back to default agent",
        ),
      );
      return await loadDefaultConfig(apiClient, injectBlocks);
    }
    throw error;
  }
}

/**
 * Loads configuration from CLI --config flag
 * Supports both file paths and assistant slugs
 */
async function loadFromCliFlag(
  configPath: string,
  apiClient: DefaultApiInterface,
  injectBlocks: PackageIdentifier[],
): Promise<AssistantUnrolled> {
  if (isFilePath(configPath)) {
    return await loadConfigYaml(configPath, apiClient, injectBlocks);
  }

  return await loadAssistantSlug(configPath, apiClient, injectBlocks);
}

/**
 * Loads configuration from saved URI
 */
async function loadFromSavedUri(
  uri: string,
  apiClient: DefaultApiInterface,
  injectBlocks: PackageIdentifier[],
): Promise<AssistantUnrolled> {
  const filePath = uriToPath(uri);
  if (filePath) {
    return await loadConfigYaml(filePath, apiClient, injectBlocks);
  }

  const slug = uriToSlug(uri);
  if (slug) {
    return await loadAssistantSlug(slug, apiClient, injectBlocks);
  }

  throw new Error(`Invalid saved config URI: ${uri}`);
}

/**
 * Loads first available user assistant with fallback to default agent
 */
async function loadUserAssistantWithFallback(
  apiClient: DefaultApiInterface,
  injectBlocks: PackageIdentifier[],
): Promise<AssistantUnrolled> {
  const assistants = await apiClient.listAssistants({
    alwaysUseProxy: "false",
  });

  if (assistants.length > 0) {
    const result = assistants[0].configResult;
    if (!result.config) {
      throw new Error(result.errors?.join("\n") ?? "Failed to load assistant.");
    }

    const errors = result.errors;
    if (errors?.some((e: any) => e.fatal)) {
      throw new Error(
        errors.map((e: any) => e.message).join("\n") ??
          "Failed to load assistant.",
      );
    }
    let apiConfig = result.config as AssistantUnrolled;
    if (injectBlocks.length > 0) {
      const injectedConfig = await unrollPackageIdentifiersAsConfigYaml(
        injectBlocks,
        apiClient,
      );
      apiConfig = mergeUnrolledAssistants(apiConfig, injectedConfig);
    }

    return apiConfig;
  }

  return await loadDefaultConfig(apiClient, injectBlocks);
}

/**
 * Loads default config.yaml from ~/.tezz/config.yaml
 */
async function loadLocalConfigYaml(
  apiClient: DefaultApiInterface,
  injectBlocks: PackageIdentifier[],
): Promise<AssistantUnrolled> {
  const defaultConfigPath = path.join(env.continueHome, "config.yaml");
  return await loadConfigYaml(defaultConfigPath, apiClient, injectBlocks);
}

/**
 * Loads the default continuedev/default-config
 */
async function loadDefaultConfig(
  apiClient: DefaultApiInterface,
  injectBlocks: PackageIdentifier[],
): Promise<AssistantUnrolled> {
  const resp = await apiClient.getAssistant({
    ownerSlug: "continuedev",
    packageSlug: "default-cli-config",
  });

  if (!resp.configResult.config) {
    throw new Error(
      `Failed to load default agent. Body:\n${JSON.stringify(resp)}`,
    );
  }
  let apiConfig = resp.configResult.config as AssistantUnrolled;
  if (injectBlocks.length > 0) {
    const injectedConfig = await unrollPackageIdentifiersAsConfigYaml(
      injectBlocks,
      apiClient,
    );
    apiConfig = mergeUnrolledAssistants(apiConfig, injectedConfig);
  }

  return apiConfig;
}

export async function unrollPackageIdentifiersAsConfigYaml(
  packageIdentifiers: PackageIdentifier[],
  apiClient: DefaultApiInterface,
): Promise<AssistantUnrolled> {
  const unrollResult = await unrollAssistantFromContent(
    {
      uriType: "file",
      fileUri: "",
    },
    "name: Agent\nschema: v1\nversion: 0.0.1",
    createRegistry(undefined),
    {
      currentUserSlug: "",
      platformClient: new CLIPlatformClient(null, apiClient),
      renderSecrets: true,
      injectBlocks: packageIdentifiers,
    },
  );
  if (unrollResult.errors) {
    const fatalError = unrollResult.errors?.find((e) => e.fatal);
    if (fatalError) {
      throw new Error(`Failed to load config: ${fatalError.message}`);
    }
  }
  if (!unrollResult?.config) {
    throw new Error(`Failed to load config`);
  }

  return unrollResult.config;
}

async function unrollAssistantWithConfig(
  packageIdentifier: PackageIdentifier,
  apiClient: DefaultApiInterface,
  injectBlocks: PackageIdentifier[],
): Promise<AssistantUnrolled> {
  const unrollResult = await unrollAssistant(
    packageIdentifier,
    createRegistry(
      packageIdentifier.uriType === "file"
        ? dirname(packageIdentifier.fileUri)
        : undefined,
    ),
    {
      currentUserSlug: "",
      alwaysUseProxy: false,
      renderSecrets: true,
      platformClient: new CLIPlatformClient(null, apiClient),
      injectBlocks,
    },
  );

  const errorDetails = unrollResult.errors;
  if (!unrollResult.config) {
    throw new Error(`Failed to load config:\n${errorDetails}`);
  } else if (errorDetails?.length) {
    const warnings =
      errorDetails?.length > 1
        ? errorDetails.map((d) => `\n- ${d.message}`)
        : errorDetails[0].message;
    console.warn(chalk.dim(`Warning: ${warnings}`));
  }

  return unrollResult.config;
}

/**
 * Loads a local YAML configuration file
 */
async function loadConfigYaml(
  filePath: string,
  apiClient: DefaultApiInterface,
  injectBlocks: PackageIdentifier[],
): Promise<AssistantUnrolled> {
  return await unrollAssistantWithConfig(
    { fileUri: filePath, uriType: "file" },
    apiClient,
    injectBlocks,
  );
}

/**
 * Loads an assistant by slug from the Continue platform
 */
async function loadAssistantSlug(
  slug: string,
  apiClient: DefaultApiInterface,
  injectBlocks: PackageIdentifier[],
): Promise<AssistantUnrolled> {
  const [ownerSlug, packageSlug] = slug.split("/");
  if (!ownerSlug || !packageSlug) {
    throw new Error(
      `Invalid assistant slug format. Expected "owner/package", got: ${slug}`,
    );
  }

  if (!(apiClient as any).configuration.accessToken) {
    return await unrollAssistantWithConfig(
      {
        uriType: "slug",
        fullSlug: { ownerSlug, packageSlug, versionSlug: "latest" },
      },
      apiClient,
      injectBlocks,
    );
  }

  const resp = await apiClient.getAssistant({
    ownerSlug,
    packageSlug,
    alwaysUseProxy: "false",
  });

  const result = resp.configResult;
  const errors = result.errors;
  if (errors?.some((e: any) => e.fatal)) {
    throw new Error(
      errors.map((e: any) => e.message).join("\n") ??
        "Failed to load assistant.",
    );
  }
  let apiConfig = result.config as AssistantUnrolled;
  if (injectBlocks.length > 0) {
    const injectedConfig = await unrollPackageIdentifiersAsConfigYaml(
      injectBlocks,
      apiClient,
    );
    apiConfig = mergeUnrolledAssistants(apiConfig, injectedConfig);
  }

  return apiConfig;
}

/**
 * Determines if a config path is a file path vs assistant slug
 */
function isFilePath(configPath: string): boolean {
  return (
    configPath.startsWith(".") ||
    configPath.startsWith("/") ||
    configPath.startsWith("~") ||
    // Windows absolute paths (C:\, D:\, etc.)
    /^[A-Za-z]:[/\\]/.test(configPath) ||
    // UNC paths (\\server\share)
    configPath.startsWith("\\\\") ||
    // Contains file extension
    configPath.includes(".yaml") ||
    configPath.includes(".yml") ||
    configPath.includes(".json")
  );
}
