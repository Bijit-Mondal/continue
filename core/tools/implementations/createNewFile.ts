import { inferResolvedUriFromRelativePath } from "../../util/ideUtils";

import type { ToolImpl } from ".";
import { throwIfFileIsSecurityConcern } from "../../indexing/ignore";
import { ContinueError, ContinueErrorReason } from "../../util/errors";
import { getCleanUriPath, getUriPathBasename } from "../../util/uri";
import { getBooleanArg, getNumberArg, getStringArg } from "../parseArgs";

// Tracks the next expected chunkIndex per resolved file URI across tool calls
const nextChunkIndexByFile = new Map<string, number>();

export const createNewFileImpl: ToolImpl = async (args, extras) => {
  const filepath = getStringArg(args, "filepath");
  const contents = getStringArg(args, "contents", true);
  const chunkIndex = getNumberArg(args, "chunkIndex");
  const isComplete = getBooleanArg(args, "isComplete", true) as boolean;

  if (chunkIndex < 0) {
    throw new ContinueError(
      ContinueErrorReason.Unspecified,
      "chunkIndex must be a non-negative integer",
    );
  }

  const resolvedFileUri = await inferResolvedUriFromRelativePath(
    filepath,
    extras.ide,
  );
  if (!resolvedFileUri) {
    throw new ContinueError(
      ContinueErrorReason.PathResolutionFailed,
      "Failed to resolve path",
    );
  }

  throwIfFileIsSecurityConcern(getCleanUriPath(resolvedFileUri));

  const exists = await extras.ide.fileExists(resolvedFileUri);

  if (chunkIndex === 0) {
    if (exists) {
      throw new ContinueError(
        ContinueErrorReason.FileAlreadyExists,
        `File ${filepath} already exists. Use a different path for chunkIndex=0`,
      );
    }
    await extras.ide.writeFile(resolvedFileUri, contents);
  } else {
    if (!exists) {
      throw new ContinueError(
        ContinueErrorReason.FileNotFound,
        `File ${filepath} does not exist for chunkIndex=${chunkIndex}. Start with chunkIndex=0 first`,
      );
    }

    const expectedChunkIndex = nextChunkIndexByFile.get(resolvedFileUri);
    if (typeof expectedChunkIndex === "undefined") {
      throw new ContinueError(
        ContinueErrorReason.Unspecified,
        `No active chunk sequence found for ${filepath}. Restart from chunkIndex=0`,
      );
    }

    if (chunkIndex !== expectedChunkIndex) {
      throw new ContinueError(
        ContinueErrorReason.Unspecified,
        `Invalid chunk index for ${filepath}. Expected chunkIndex=${expectedChunkIndex}, received chunkIndex=${chunkIndex}`,
      );
    }

    const existingContents = await extras.ide.readFile(resolvedFileUri);
    await extras.ide.writeFile(resolvedFileUri, existingContents + contents);
  }

  nextChunkIndexByFile.set(resolvedFileUri, chunkIndex + 1);

  if (isComplete) {
    await extras.ide.openFile(resolvedFileUri);
    await extras.ide.saveFile(resolvedFileUri);
    if (extras.codeBaseIndexer) {
      void extras.codeBaseIndexer?.refreshCodebaseIndexFiles([resolvedFileUri]);
    }
    nextChunkIndexByFile.delete(resolvedFileUri);

    const finalContents = await extras.ide.readFile(resolvedFileUri);
    const totalBytes = Buffer.byteLength(finalContents, "utf-8");
    const chunkBytes = Buffer.byteLength(contents, "utf-8");

    return [
      {
        name: getUriPathBasename(resolvedFileUri),
        description: getCleanUriPath(resolvedFileUri),
        content: `Chunk ${chunkIndex} written (${chunkBytes} bytes). File creation complete (${totalBytes} bytes total).`,
        status: "complete",
        uri: {
          type: "file",
          value: resolvedFileUri,
        },
      },
    ];
  }

  const chunkBytes = Buffer.byteLength(contents, "utf-8");

  return [
    {
      name: getUriPathBasename(resolvedFileUri),
      description: getCleanUriPath(resolvedFileUri),
      content: `Chunk ${chunkIndex} written (${chunkBytes} bytes). Awaiting next chunk ${chunkIndex + 1}.`,
      status: "in_progress",
      uri: {
        type: "file",
        value: resolvedFileUri,
      },
    },
  ];
};
