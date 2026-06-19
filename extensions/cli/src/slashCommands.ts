import fs from "fs";

import { type AssistantConfig } from "@continuedev/sdk";
import chalk from "chalk";

import { c } from "./constants/theme.js";
import type { Session } from "core/index.js";
import historyManager from "core/util/history.js";
import { v4 as uuidv4 } from "uuid";

import { getAllSlashCommands } from "./commands/commands.js";
import { handleInit } from "./commands/init.js";
import { handleInfoSlashCommand } from "./infoScreen.js";
import { getCurrentSession, updateSessionTitle } from "./session.js";
import { telemetryService } from "./telemetry/telemetryService.js";
import { buildImportSkillPrompt } from "./tools/skills.js";
import { SlashCommandResult } from "./ui/hooks/useChat.types.js";
import {
  getSkillSlashCommandName,
  loadMarkdownSkills,
} from "./util/loadMarkdownSkills.js";
import { resolveProviderArg } from "./util/modelsCatalog.js";

type CommandHandler = (
  args: string[],
  assistant: AssistantConfig,
) => Promise<SlashCommandResult> | SlashCommandResult;

async function handleHelp(_args: string[], _assistant: AssistantConfig) {
  const helpMessage = [
    c.white.bold("Keyboard Shortcuts:"),
    "",
    c.white("Navigation:"),
    `  ${c.accent("↑/↓")}        Navigate command/file suggestions or history`,
    `  ${c.accent("Tab")}        Complete command or file selection`,
    `  ${c.accent("Enter")}      Submit message`,
    `  ${c.accent("Shift+Enter")} New line`,
    `  ${c.accent("\\")}          Line continuation (at end of line)`,
    `  ${c.accent("!")}          Shell mode - run shell commands`,
    "",
    c.white("Controls:"),
    `  ${c.accent("Ctrl+C")}     Clear input`,
    `  ${c.accent("Ctrl+D")}     Exit application`,
    `  ${c.accent("Ctrl+L")}     Clear screen`,
    `  ${c.accent("Shift+Tab")}  Cycle permission modes (normal/plan/auto)`,
    `  ${c.accent("Esc")}        Cancel streaming or close suggestions`,
    "",
    c.white("Special Characters:"),
    `  ${c.accent("@")}          Search and attach files for context`,
    `  ${c.accent("/")}          Access slash commands`,
    `  ${c.accent("!")}          Execute bash commands directly`,
    "",
    c.white("Available Commands:"),
    `  Type ${c.accent("/")} to see available slash commands`,
    `  Type ${c.accent("!")} followed by a command to execute bash directly`,
  ].join("\n");
  return { output: helpMessage };
}

async function handleFork() {
  try {
    const currentSession = getCurrentSession();
    const forkCommand = `tezz --fork ${currentSession.sessionId}`;
    // Try to copy to clipboard dynamically to avoid hard dependency in tests
    try {
      const clipboardy = await import("clipboardy");
      await clipboardy.default.write(forkCommand);
      return {
        exit: false,
        output: c.mutedForeground(`${forkCommand} (copied to clipboard)`),
      };
    } catch {
      return {
        exit: false,
        output: c.mutedForeground(`${forkCommand}`),
      };
    }
  } catch (error: any) {
    return {
      exit: false,
      output: c.destructive(`Failed to create fork command: ${error.message}`),
    };
  }
}

function handleTitle(args: string[]) {
  const title = args.join(" ").trim();
  if (!title) {
    return {
      exit: false,
      output: c.primary("Please provide a title. Usage: /title <your title>"),
    };
  }

  try {
    updateSessionTitle(title);
    return {
      exit: false,
      output: c.primary(`Session title updated to: "${title}"`),
    };
  } catch (error: any) {
    return {
      exit: false,
      output: c.destructive(`Failed to update title: ${error.message}`),
    };
  }
}

function handleJobs() {
  return { openJobsSelector: true };
}

async function handleSkills(): Promise<SlashCommandResult> {
  const { skills } = await loadMarkdownSkills();

  if (!skills.length) {
    return {
      exit: false,
      output: c.primary(
        "No skills found. Add skills under .tezz/skills or .claude/skills.",
      ),
    };
  }

  const header = c.white.bold("Available skills:");
  const lines = skills.map(
    (skill) =>
      `${c.accent(skill.name)} - ${skill.description} ${c.mutedForeground(
        `(${skill.path})`,
      )}`,
  );

  return {
    exit: false,
    output: [header, "", ...lines].join("\n"),
  };
}

async function handleImportSkill(args: string[]): Promise<SlashCommandResult> {
  const query = args.join(" ").trim();

  if (!query) {
    return {
      exit: false,
      output: c.primary(
        "Please provide a skill URL or name. Usage: /import-skill <url-or-name>",
      ),
    };
  }

  return {
    newInput: buildImportSkillPrompt(query),
  };
}

function handleSessions() {
  return { openSessionSelector: true };
}

const EXPORTED_SESSION_VERSION = 1;

interface ExportedSession {
  version: number;
  exportedAt: string;
  session: Session;
}

function isValidExportedSession(data: unknown): data is ExportedSession {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const obj = data as Record<string, unknown>;
  return (
    obj.version === EXPORTED_SESSION_VERSION &&
    typeof obj.exportedAt === "string" &&
    typeof obj.session === "object" &&
    obj.session !== null &&
    typeof (obj.session as Record<string, unknown>).sessionId === "string" &&
    typeof (obj.session as Record<string, unknown>).title === "string" &&
    Array.isArray((obj.session as Record<string, unknown>).history)
  );
}

function handleExport(_args: string[]): SlashCommandResult {
  return {
    exit: false,
    openExportSelector: true,
  };
}

function handleImport(args: string[]): SlashCommandResult {
  const filePath = args.join(" ").trim();
  if (!filePath) {
    return {
      exit: false,
      output: c.primary(
        "Please provide a file path. Usage: /import <file-path>",
      ),
    };
  }

  if (!fs.existsSync(filePath)) {
    return {
      exit: false,
      output: c.destructive(`File not found: ${filePath}`),
    };
  }

  try {
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const exportedData: unknown = JSON.parse(fileContent);

    if (!isValidExportedSession(exportedData)) {
      return {
        exit: false,
        output: c.destructive(
          "Invalid session file: expected a valid Tezz exported session (version 1).",
        ),
      };
    }

    let session = exportedData.session;

    const existing = historyManager.load(session.sessionId);
    const sessionExists = existing.history.length > 0;

    if (sessionExists) {
      const originalId = session.sessionId;
      session = {
        ...session,
        sessionId: uuidv4(),
      };
      historyManager.save(session);
      return {
        exit: false,
        output: c.primary(
          `Session imported with new ID: ${session.sessionId}\n` +
            c.mutedForeground(`(original ID: ${originalId} already existed)`),
        ),
      };
    }

    historyManager.save(session);
    return {
      exit: false,
      output: c.primary(
        `Session imported: ${session.sessionId} (${session.title})`,
      ),
    };
  } catch (error: any) {
    return {
      exit: false,
      output: c.destructive(`Failed to import session: ${error.message}`),
    };
  }
}

function handleModels(args: string[]) {
  const providerArg = args.join(" ").trim();
  const providerId = resolveProviderArg(providerArg);

  if (providerArg && !providerId) {
    return {
      exit: false,
      output: c.primary(
        `Unknown provider "${providerArg}". Run /models to choose from providers with configured API keys.`,
      ),
    };
  }

  return {
    openModelsCatalogSelector: true,
    modelsCatalogProvider: providerId,
  };
}

const commandHandlers: Record<string, CommandHandler> = {
  help: handleHelp,
  clear: () => {
    return { clear: true, output: "Chat history cleared" };
  },
  exit: () => {
    return { exit: true, output: "Goodbye!" };
  },
  config: () => {
    return { openConfigSelector: true };
  },
  info: handleInfoSlashCommand,
  model: () => ({ openModelSelector: true }),
  models: (args) => handleModels(args),
  compact: () => {
    return { compact: true };
  },
  mcp: () => {
    return { openMcpSelector: true };
  },
  resume: () => {
    return { openSessionSelector: true };
  },
  fork: handleFork,
  title: handleTitle,
  rename: handleTitle,
  init: (args, assistant) => {
    return handleInit(args, assistant);
  },
  update: () => {
    return { openUpdateSelector: true };
  },
  jobs: handleJobs,
  skills: () => handleSkills(),
  "import-skill": (args) => handleImportSkill(args),
  sessions: handleSessions,
  export: handleExport,
  import: handleImport,
};

export async function handleSlashCommands(
  input: string,
  assistant: AssistantConfig,
): Promise<SlashCommandResult | null> {
  // Only trigger slash commands if slash is the very first character
  if (!input.startsWith("/") || !input.trim().startsWith("/")) {
    return null;
  }

  const [command, ...args] = input.slice(1).split(" ");

  telemetryService.recordSlashCommand(command);

  const handler = commandHandlers[command];
  if (handler) {
    return await handler(args, assistant);
  }

  // Check for custom assistant prompts
  const assistantPrompt = assistant.prompts?.find(
    (prompt) => prompt?.name === command,
  );
  if (assistantPrompt) {
    const newInput = assistantPrompt.prompt + args.join(" ");
    return { newInput };
  }

  // Check for invokable rules
  const invokableRule = assistant.rules?.find((rule) => {
    // Handle both string rules and rule objects
    if (!rule || typeof rule === "string") {
      return false;
    }
    const ruleObj = rule as any;
    return ruleObj.invokable === true && ruleObj.name === command;
  });
  if (invokableRule) {
    const ruleObj = invokableRule as any;
    const newInput = ruleObj.rule + " " + args.join(" ");
    return { newInput };
  }

  const { skills } = await loadMarkdownSkills();
  if (skills.length) {
    const normalizedCommand = command.trim().toLowerCase();
    const matchingSkill = skills.find(
      (skill) => getSkillSlashCommandName(skill) === normalizedCommand,
    );

    if (matchingSkill) {
      return {
        newInput: `Load the skill using the **Skills** tool and then set the **skill_name** parameter to "${matchingSkill.name}".`,
      };
    }
  }

  // Check if this command would match any available commands (same logic as UI)
  const allCommands = await getAllSlashCommands(assistant);
  const hasMatches = allCommands.some((cmd) =>
    cmd.name.toLowerCase().includes(command.toLowerCase()),
  );

  // If no commands match, treat this as regular text instead of an unknown command
  if (!hasMatches) {
    return null;
  }

  return { output: `Unknown command: ${command}` };
}
