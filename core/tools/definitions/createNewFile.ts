import { ToolPolicy } from "@continuedev/terminal-security";
import { Tool } from "../..";
import { ResolvedPath, resolveInputPath } from "../../util/pathResolver";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";
import { evaluateFileAccessPolicy } from "../policies/fileAccess";

export const createNewFileTool: Tool = {
  type: "function",
  displayTitle: "Create New File",
  wouldLikeTo: "write chunk {{{ chunkIndex }}} to {{{ filepath }}}",
  isCurrently: "writing chunk {{{ chunkIndex }}} to {{{ filepath }}}",
  hasAlready: "wrote chunk {{{ chunkIndex }}} to {{{ filepath }}}",
  group: BUILT_IN_GROUP_NAME,
  readonly: false,
  isInstant: true,
  function: {
    name: BuiltInToolNames.CreateNewFile,
    description:
      "Create a new file in chunks. chunkIndex=0 creates the file, later chunk indices append content, and isComplete=true marks the final chunk",
    parameters: {
      type: "object",
      required: ["filepath", "contents", "chunkIndex", "isComplete"],
      properties: {
        filepath: {
          type: "string",
          description:
            "The path where the new file should be created. Can be a relative path (from workspace root), absolute path, tilde path (~/...), or file:// URI.",
        },
        contents: {
          type: "string",
          description:
            "The chunk contents to write. Keep chunks small (5-10 KB) to avoid network timeouts during streaming",
        },
        chunkIndex: {
          type: "number",
          description:
            "0-based chunk index. chunkIndex=0 creates the file, chunkIndex>0 appends",
        },
        isComplete: {
          type: "boolean",
          description:
            "True only on the final chunk. False when more chunks will follow",
        },
      },
    },
  },
  defaultToolPolicy: "allowedWithPermission",
  systemMessageDescription: {
    prefix: `To create a NEW file, use the ${BuiltInToolNames.CreateNewFile} tool with chunked writes. Keep each chunk small (5-10 KB) to avoid network timeouts. Start with chunkIndex=0 and isComplete=false, continue incrementing chunkIndex, and set isComplete=true only on the final chunk. For example, first chunk for 'path/to/file.txt':`,
    exampleArgs: [
      ["filepath", "path/to/the_file.txt"],
      ["contents", "First chunk of file content"],
      ["chunkIndex", 0],
      ["isComplete", "false"],
    ],
  },
  preprocessArgs: async (args, { ide }) => {
    const filepath = args.filepath as string;
    const resolvedPath = await resolveInputPath(ide, filepath);

    // Store the resolved path info in args for policy evaluation
    return {
      resolvedPath,
    };
  },
  evaluateToolCallPolicy: (
    basePolicy: ToolPolicy,
    _: Record<string, unknown>,
    processedArgs?: Record<string, unknown>,
  ): ToolPolicy => {
    const resolvedPath = processedArgs?.resolvedPath as
      | ResolvedPath
      | null
      | undefined;
    if (!resolvedPath) return basePolicy;

    return evaluateFileAccessPolicy(basePolicy, resolvedPath.isWithinWorkspace);
  },
};
