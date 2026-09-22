# Jev Pattern & File Structure Guidelines

This guide explains how to define team coding patterns for **jev-lint** and provides the official file structure template for TypeScript code in this workspace.

---

## 1. How to Author Rules (`.jev-rules/*.md`)

`jev-lint` uses TypeSafe's Jev (a System One model). It performs best with **ultra-compact tagged directives** rather than prose.

### Recommended Rule Syntax

Group rules by their category key, using imperative directives (`BAN`, `MUST`):

```markdown
RULE_ASYNC:
- BAN floating promises: every Promise must be awaited or .catch()'d
- MUST wrap throwing async I/O in try/catch
- BAN async callbacks in forEach/reduce (use for-of instead)

RULE_NAMING:
- camelCase: variables, functions
- PascalCase: types, interfaces, classes
- UPPER_SNAKE_CASE: global/module constants
- BAN single-letter identifiers (except loop indices i, j)

RULE_STRUCTURE:
- Named exports only (no default exports)
- BAN 'any'
- BAN type casting ('as', 'as unknown as')
```

### Rule Authoring Best Practices
1. **Omit Prose & Headers:** Avoid meta explanations, markdown dividers (`---`), or narrative paragraphs. Keep it strictly directive-based.
2. **Use Clear Predicates:** Use strong constraints like `BAN <pattern>` or `MUST <pattern>`.
3. **Category Matching:** Ensure headers match the Jev Choice categories (`RULE_ASYNC:`, `RULE_NAMING:`, `RULE_STRUCTURE:`).
4. **File Splitting:** You can split rules across multiple files (e.g. `api.md`, `react.md`, `patterns.md`). `jev-lint` compiles all `.md` files together (except `guidelines.md` and `README.md`).

---

## 2. Standard TypeScript File Structure

All source files in this workspace should follow this 6-section structure:

```text
1. External & Node Imports
2. Internal / Workspace Imports
3. Types & Interfaces
4. Module-Level Constants
5. Internal / Helper Functions
6. Public Exported Functions & Classes
```

---

## 3. Copy-Paste File Template (`template.ts`)

Use this template as the starting point when creating new TypeScript modules:

```ts
// 1. External & Node Imports
import * as path from "node:path";
import * as fs from "node:fs/promises";

// 2. Internal / Workspace Imports
import type { UserProfile } from "./types.js";
import { formatTimestamp } from "./utils/date.js";

// 3. Types & Interfaces (PascalCase)
export interface SessionConfig {
  sessionId: string;
  timeoutMs: number;
  retryAttempts: number;
}

export interface SessionResult {
  isSuccess: boolean;
  user: UserProfile | null;
  errorMessage?: string;
}

// 4. Module Constants (UPPER_SNAKE_CASE)
const DEFAULT_TIMEOUT_MS = 5000;
const MAX_ALLOWED_RETRIES = 3;

// 5. Internal Helper Functions (camelCase, not exported)
function validateSessionConfig(config: SessionConfig): boolean {
  return config.timeoutMs > 0 && config.sessionId.trim().length > 0;
}

// 6. Public Exported Functions (camelCase, named exports only)
export async function initializeUserSession(
  config: SessionConfig
): Promise<SessionResult> {
  if (!validateSessionConfig(config)) {
    return {
      isSuccess: false,
      user: null,
      errorMessage: "Invalid session configuration provided.",
    };
  }

  try {
    // Asynchronous I/O must be explicitly awaited and wrapped in try/catch
    const response = await fetch(`https://api.example.com/sessions/${config.sessionId}`, {
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch session: ${response.statusText}`);
    }

    const userData = (await response.json()) as UserProfile;

    return {
      isSuccess: true,
      user: userData,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown session error";
    console.error(`[SessionManager] Initialization failed: ${message}`);
    
    return {
      isSuccess: false,
      user: null,
      errorMessage: message,
    };
  }
}
```

---

## 4. Quick Verification

Before committing changes, run the semantic linter:

```bash
# Lint specific file
npx jev-lint src/my-new-file.ts

# Lint entire project
npx jev-lint "src/**/*.ts"
```
