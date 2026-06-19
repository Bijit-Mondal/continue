import { execSync } from "child_process";

import { c } from "./constants/theme.js";
import { services } from "./services/index.js";
import {
  getCurrentSession,
  getSessionFilePath,
  getSessionUsage,
} from "./session.js";
import { logger } from "./util/logger.js";
import { getVersion } from "./version.js";

function getVersionInfo(): string[] {
  const version = getVersion();
  const cwd = process.cwd();

  return [
    c.white("CLI Information:"),
    `  Version: ${c.primary(version)}`,
    `  Working Directory: ${c.primary(cwd)}`,
  ];
}

function getConfigInfo(): string[] {
  const lines: string[] = ["", c.white("Configuration:")];

  try {
    const configState = services.config.getState();
    if (configState.config) {
      lines.push(`  ${c.mutedForeground(`Using ${configState.config?.name}`)}`);
    } else {
      lines.push(`  ${c.destructive(`Config not found`)}`);
    }
    if (configState.configPath) {
      lines.push(`  Path: ${c.primary(configState.configPath)}`);
    }

    // Add current model info
    try {
      const modelInfo = services.model?.getModelInfo();
      if (modelInfo) {
        lines.push(`  Model: ${c.accent(modelInfo.name)}`);
      } else {
        lines.push(`  Model: ${c.destructive("Not available")}`);
      }
    } catch {
      lines.push(`  Model: ${c.destructive("Error retrieving model info")}`);
    }
  } catch {
    lines.push(`  ${c.destructive("Configuration service not available")}`);
  }

  return lines;
}

function getSessionInfo(): string[] {
  const lines: string[] = ["", c.white("Session:")];

  try {
    const currentSession = getCurrentSession();
    const sessionFilePath = getSessionFilePath();
    lines.push(
      `  Title: ${c.primary(currentSession.title)}`,
      `  ID: ${c.mutedForeground(currentSession.sessionId)}`,
      `  File: ${c.primary(sessionFilePath)}`,
    );
  } catch {
    lines.push(`  ${c.destructive("Session not available")}`);
  }

  return lines;
}

function getUsageInfo(): string[] {
  const lines: string[] = ["", c.white("Usage:")];

  try {
    const usage = getSessionUsage();
    if (usage.totalCost > 0) {
      lines.push(
        `  Total Cost: ${c.primary(`$${usage.totalCost.toFixed(6)}`)}`,
      );
      lines.push(
        `  Input Tokens: ${c.accent(usage.promptTokens.toLocaleString())}`,
      );
      lines.push(
        `  Output Tokens: ${c.accent(usage.completionTokens.toLocaleString())}`,
      );

      if (usage.promptTokensDetails?.cachedTokens) {
        lines.push(
          `  Cache Read Tokens: ${c.accent(usage.promptTokensDetails.cachedTokens.toLocaleString())}`,
        );
      }

      if (usage.promptTokensDetails?.cacheWriteTokens) {
        lines.push(
          `  Cache Write Tokens: ${c.accent(usage.promptTokensDetails.cacheWriteTokens.toLocaleString())}`,
        );
      }

      const totalTokens = usage.promptTokens + usage.completionTokens;
      lines.push(`  Total Tokens: ${c.accent(totalTokens.toLocaleString())}`);
    } else {
      lines.push(`  ${c.mutedForeground("No usage data yet")}`);
    }
  } catch (error) {
    logger.warn("Failed to get session usage:", error);
    lines.push(`  ${c.destructive("Usage data not available")}`);
  }

  return lines;
}

function getDiagnosticInfo(): string[] {
  const nodePath = process.execPath;
  const invokedPath = process.argv[1];

  // Get npm version
  let npmVersion = "unknown";
  try {
    npmVersion = execSync("npm --version", {
      encoding: "utf8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
  } catch (error) {
    logger.warn("Failed to get npm version:", error);
  }

  return [
    "",
    c.white("Diagnostic Info"),
    `  Currently running: npm-global (${c.primary(npmVersion)})`,
    `  Path: ${c.primary(nodePath)}`,
    `  Invoked: ${c.primary(invokedPath)}`,
  ];
}

export async function handleInfoSlashCommand() {
  const infoLines = [
    ...getVersionInfo(),
    ...getConfigInfo(),
    ...getSessionInfo(),
    ...getUsageInfo(),
    ...getDiagnosticInfo(),
  ];

  return {
    exit: false,
    output: infoLines.join("\n"),
  };
}
