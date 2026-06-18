# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

## Project Overview

Continue is an open-source AI code agent that runs inside IDEs (VS Code, JetBrains) and a CLI. The core logic lives in a shared `core/` package; IDE-specific adapters wrap it, and a React webview (`gui/`) provides the chat UI. A native Rust crate (`sync/`) handles codebase indexing.

## Repository Structure

```
core/                 # Shared core logic (LLM providers, tools, config, indexing, protocol)
gui/                  # React webview UI (Vite + Tailwind + Redux Toolkit)
extensions/
  vscode/             # VS Code extension (esbuild, LanguageClient)
  intellij/           # JetBrains plugin (Kotlin, Gradle)
  cli/                # CLI agent (@continuedev/cli, Ink/React TUI)
binary/               # Standalone binary packaging of core (for JetBrains)
packages/
  config-types/       # Zod schemas + TypeScript types for config
  config-yaml/        # YAML config parsing/serialization
  fetch/              # HTTP fetch with proxy support
  openai-adapters/    # Unified LLM provider adapters (OpenAI, Anthropic, Bedrock, etc.)
  terminal-security/  # Terminal command safety evaluation
  hub/                # Continue Hub client
  continue-sdk/       # OpenAPI-based SDK generator (TypeScript + Python)
sync/                 # Rust crate for Merkle-tree codebase syncing (NAPI/neon)
scripts/              # Top-level build/dev scripts
docs/                 # Documentation
eval/                 # Evaluation harness
```

## Essential Commands

### Root level

```bash
npm run tsc:watch          # Watch type-check gui, vscode, core, binary simultaneously
npm run format             # Prettier format all files
npm run format:check       # Prettier check (CI)
```

### core/

```bash
cd core
npm run vitest             # Run vitest tests
npm run test               # Run jest tests (legacy, uses --experimental-vm-modules)
npm run build              # Build for npm (tsc -p tsconfig.npm.json)
npm run tsc:check          # Type check only
npm run lint               # ESLint
npm run lint:fix           # ESLint with auto-fix
```

### gui/

```bash
cd gui
npm run dev                # Vite dev server
npm run build              # tsc + vite build
npm run test               # Vitest
npm run tsc:check          # Type check only
```

### extensions/vscode/

```bash
cd extensions/vscode
npm run esbuild            # Bundle extension with sourcemaps
npm run esbuild-watch      # Watch mode bundling
npm run tsc:check          # Type check
npm run test               # Vitest
npm run package            # Package VSIX
npm run package-all        # Package VSIX for all platforms
```

### extensions/cli/

```bash
cd extensions/cli
npm run build              # Validate aliases + bundle (esbuild)
npm run test               # Vitest
npm run test:e2e           # E2E tests (vitest)
npm run test:smoke         # Smoke test the built binary
npm run lint               # tsc --noEmit + eslint
npm run format             # Prettier --write
npm run dev                # Run via tsx (development)
```

### extensions/intellij/

```bash
cd extensions/intellij
./gradlew test             # Run tests
./gradlew runIde           # Debug in IntelliJ
```

### binary/

```bash
cd binary
npm run build              # esbuild bundle
npm run test               # Jest
```

### packages/ (each)

```bash
cd packages/<name>
npm run build              # Typically tsc
npm test                   # If available (vitest or jest)
```

## Architecture

### Message Protocol (Core ↔ IDE ↔ Webview)

All communication between the three main components uses a typed message protocol defined in `core/protocol/`:

- **`core/protocol/core.ts`** — Messages webview↔core (e.g., `llm/streamChat`, `config/addModel`, `index/forceReIndex`)
- **`core/protocol/ide.ts`** — Messages from core/webview→IDE (e.g., `readFile`, `openFile`, `runCommand`, `getSearchResults`)
- **`core/protocol/ideCore.ts`** — Messages IDE↔core
- **`core/protocol/ideWebview.ts`** — Messages IDE↔webview
- **`core/protocol/coreWebview.ts`** — Core↔webview message types
- **`core/protocol/passThrough.ts`** — Registry of webview→core messages that should be passed through (must stay in sync with `MessageTypes.kt` in JetBrains extension)

**When adding a new protocol message**, check `core/rules.md` for the checklist. Key steps:

1. Define the message type in the appropriate protocol file
2. If webview↔core: add to `core/protocol/passThrough.ts` **and** `extensions/intellij/.../MessageTypes.kt`
3. Implement the handler in `core/core.ts` (core-bound), a `useWebviewListener` (webview-bound), or IDE adapter

### Core (`core/core.ts`)

The `Core` class is the central orchestrator. It:

- Receives an `IMessenger` and `IDE` instance
- Creates `ConfigHandler`, `CodebaseIndexer`, `DocsService`, `CompletionProvider`, `NextEditProvider`
- Uses `MCPManagerSingleton` for MCP connections
- Communicates via `messenger.invoke()` / `messenger.send()` using the typed protocol

### IDE Adapters

Each IDE extension implements the `IDE` interface (defined in `core/index.d.ts`) to provide file operations, editor access, terminal, etc.:

- **VS Code**: `VsCodeIDE` in `extensions/vscode/src/VsCodeIde.ts`
- **JetBrains**: `IntelliJIde` in `extensions/intellij/.../IntelliJIde.kt`
- **CLI**: Implements IDE interface directly in `extensions/cli/`

The JetBrains extension communicates with core via **stdin/stdout JSON messages** through a binary built from `binary/`.

### GUI Webview

React app bundled as a webview, embedded in VS Code sidebar and JetBrains tool window:

- **State**: Redux Toolkit with slices (`sessionSlice`, `configSlice`, `uiSlice`, `editState`, `tabsSlice`, `indexingSlice`, `profilesSlice`)
- **Async**: Thunks in `gui/src/redux/thunks/`
- **IDE communication**: `IdeMessenger` context + `useWebviewListener`/`useIdeMessengerRequest` hooks
- **Routing**: `createMemoryRouter` with `Chat`, `History`, `Stats`, `ConfigPage` routes
- **Editor**: TipTap for rich input

### Tool System

Tools have two layers:

- **Definitions** (`core/tools/definitions/`): Each tool exports a `Tool` object with metadata, JSON-schema parameters, display strings, security policy, and `preprocessArgs` hook
- **Implementations** (`core/tools/implementations/`): Each exports a `ToolImpl` async function `(args, extras) => Promise<ToolOutput[]>`

Some tools are "client tools" (implementations live in the IDE extension, not core) — listed in `CLIENT_TOOLS_IMPLS` in `core/tools/builtIn.ts` (currently `editExistingFile`, `singleFindAndReplace`, `multiEdit`).

### LLM Providers

~55 providers in `core/llm/llms/`, each extending `BaseLLM`:

- Set `static providerName` (used for lookup)
- Override streaming methods (`streamChat`, `streamComplete`, `streamFim`)
- Register in `core/llm/llms/index.ts` via the `LLMClasses` array
- Provider lookup: `cls.providerName === desc.provider`

### Config System

- **Types/schemas**: `packages/config-types/` (Zod schemas)
- **YAML parsing**: `packages/config-yaml/`
- **Config loading**: `core/config/ConfigHandler.ts` — loads from `~/.continue/config.yaml` (global) and `.continue/config.yaml` (workspace)
- **JSON config** (legacy): `~/.continue/config.json`
- **Profile lifecycle**: `core/config/ProfileLifecycleManager.ts`

## Key Conventions

### Code Style

- **Formatting**: Prettier with `tabWidth: 2`, trailing commas, double quotes, semicolons
- **ESLint**: Shared config in `.eslintrc.shared.json` — enforces `import/order` (alphabetized, newlines between groups), `eqeqeq`, `curly`, `no-throw-literal`
- **Import order**: builtin → external → internal → parent → sibling → index → object → type, alphabetized within groups, newlines between groups
- **Tailwind**: Uses `prettier-plugin-tailwindcss` for class sorting
- **Node.js**: ≥ 20.20.1 required (engine-strict in core, gui, vscode)
- **TypeScript**: `"type": "module"` (ESM) in core and gui

### Testing

- **Vitest** is the primary test runner (core, gui, vscode, cli)
- **Jest** is used in core for legacy tests and in binary
- Test files use `.vitest.ts` or `.test.ts` extensions
- Core vitest config: `core/vitest.config.ts`; Jest config: `core/jest.config.js`
- Tests run with `npm run vitest` (core) or `npm test` (gui, vscode, cli)
- **Always run tests after making changes** — verify they pass before finishing

### File References

- `file:` dependencies link packages within the monorepo (e.g., `"core": "file:../core"`, `"@continuedev/config-yaml": "file:../packages/config-yaml"`)
- **No workspace protocol** — uses `file:` paths, so `npm install` resolves from local directories
- When building CLI locally with dependency changes, use `npm run build:local-deps` which rebuilds all packages in dependency order

### GUI Links

When adding links in the GUI that direct to `continue.dev`, use `ideMessenger.request("controlPlane/openUrl", { path, orgSlug: undefined })` instead of direct `href` links. See `gui/rules.md`.

## Gotchas

### Monorepo Dependency Order

Packages must be built in order because of `file:` dependencies:

1. `packages/config-types` → 2. `packages/fetch` + `packages/terminal-security` → 3. `packages/config-yaml` → 4. `packages/openai-adapters` → 5. `core` → 6. `extensions/*`

For CLI, use `npm run build:local-deps` to rebuild everything in order.

### Protocol Message Consistency

When adding/modifyng protocol messages, you must update **three places** for webview↔core messages:

1. The protocol type definition in `core/protocol/`
2. `core/protocol/passThrough.ts`
3. `extensions/intellij/.../MessageTypes.kt`

Failure to update all three causes the JetBrains extension to break silently.

### Core is Bundleable as a Binary

Core is designed to be bundlable as a standalone binary (used by JetBrains). Avoid importing code from `core/` directly in IDE extensions where possible — use `core.invoke` / the protocol messenger to send messages. See `extensions/vscode/rules.md`.

### CLI Import Paths

The CLI uses ESNext with NodeNext module resolution. Relative imports require explicit `.js` extensions (e.g., `from "./test.js"` not `from "./test"`).

### E2E Tests

- VS Code E2E tests are in `extensions/vscode/e2e/` and require a full build + VSIX packaging
- CLI E2E tests skip on Windows (stdout flush issues)
- JetBrains E2E tests use `intellij-ui-test-robot`

### Pre-commit Hooks

Husky + lint-staged runs Prettier on staged files. If a commit fails, it's likely a formatting issue — run `npm run format` and retry.

### esbuild vs tsc

- VS Code extension uses **esbuild** for bundling (not tsc for output)
- Core uses **tsc** for the npm build
- CLI uses **esbuild** for bundling
- GUI uses **Vite** (which uses esbuild internally)
- Type checking is always done separately via `tsc --noEmit`

## Build & Development Workflow

1. `npm install` at root (install shared devDependencies)
2. Build packages in dependency order, or use component-level `npm install` + `npm run build`
3. For VS Code development: `cd extensions/vscode && npm run esbuild-watch` + F5 to launch Extension Development Host
4. For GUI development: `cd gui && npm run dev`
5. For CLI development: `cd extensions/cli && npm run dev`
