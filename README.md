# jev-lint

> **Semantic ESLint Companion via TypeSafe Jev**  
> A lightweight, sub-second semantic linter CLI and VS Code background gatekeeper that enforces team conventions written in plain English markdown.

---

## Overview

Traditional linters rely on rigid AST parsers and brittle regex patterns. **`jev-lint`** bridges the gap between static analysis and human code reviews:

1. **Markdown-Driven Rules:** Define your team's coding conventions in `.jev-rules/patterns.md`.
2. **Sub-200ms Parallel Evaluation:** Uses TypeSafe's **Jev** System One model (`@typesafe-ai/sdk`) to evaluate files against guidelines simultaneously.
3. **Deterministic Output:** Formatted ESLint-style terminal output, CI-ready JSON summaries, and inline VS Code diagnostic markers. Zero prose generation or schema parsing.

```text
test-fixtures/violation.ts
  5:3   error   Team rule violation [RULE_ASYNC]: Floating promise detected   [RULE_ASYNC]   jev-lint

✖ 1 problem (1 error, 0 warnings)
Compliance Score: 33/100 (Failing) | Evaluation time: 42ms
```

---

## Features

- ⚡ **Sub-Second Execution:** Queries Jev primitives (`noul`, `choice`, `score`) in a single parallel snapshot round trip ($<200\text{ ms}$ per file).
- 📐 **Zero AST Boilerplate:** Write your coding standards as high-signal directives instead of custom ESLint plugins.
- 🚦 **Calibrated Confidence Gating:** Only flags diagnostics when confidence exceeds your specified threshold (default: `0.85`).
- 🖥️ **Dual Interface:** Use as a standalone CLI tool or as a background VS Code gatekeeper extension.
- 📦 **Automated Scaffolding:** Run `npx jev-lint --init` or enable the VS Code extension to bootstrap `.jev-rules/patterns.md` automatically.

---

## Quick Start

### 1. Prerequisites
- **Node.js**: `v20+`
- **TypeSafe AI API Key**: Get one at [console.typesafe.ai](https://console.typesafe.ai).

### 2. Installation

```bash
# Clone the repository
git clone https://github.com/your-org/jev-lint.git
cd jev-lint

# Install dependencies
npm install

# Build the project
npm run build
```

### 3. Configure Your API Key

Set `TYPESAFE_API_KEY` in your environment or in a `.env` file:

```bash
export TYPESAFE_API_KEY="ts_live_your_api_key_here"
```

---

## CLI Usage

### Basic Linting
Lint individual files or glob patterns:

```bash
# Lint a single file
npx jev-lint src/index.ts

# Lint an entire folder or glob
npx jev-lint "src/**/*.ts"
```

### CLI Options

| Flag | Description | Default |
| :--- | :--- | :--- |
| `-t, --threshold <number>` | Minimum confidence probability to flag an error (`0.0` – `1.0`) | `0.85` |
| `-r, --rules-dir <path>` | Directory containing `.md` pattern rules | `.jev-rules` |
| `-f, --format <format>` | Output format: `stylish` or `json` | `stylish` |
| `--init` | Scaffolds `.jev-rules/patterns.md` with default guidelines | — |
| `-h, --help` | Display CLI help menu | — |

### CI / CD Pipeline Integration
Generate machine-readable JSON reports for automated PR gating:

```bash
npx jev-lint "src/**/*.ts" --format json
```

Exits with code `0` when clean, and code `1` when violations are detected.

---

## Writing Team Rules (`.jev-rules/patterns.md`)

`jev-lint` reads all `.md` files in `.jev-rules/` (ignoring documentation like `guidelines.md`).

For optimal System One evaluation speed and accuracy, format rules as **ultra-compact tagged directives** categorized by rule keys:

```markdown
RULE_ASYNC:
- BAN floating promises: every Promise must be awaited or .catch()'d
- MUST wrap throwing async I/O in try/catch
- BAN async callbacks in forEach/reduce (use for-of instead)

RULE_NAMING:
- camelCase: variables, functions
- PascalCase: types, interfaces, classes
- UPPER_SNAKE_CASE: constants
- BAN single-letter identifiers (except loop indices i, j)

RULE_STRUCTURE:
- Named exports only (no default exports)
- BAN 'any'
- BAN type casting ('as', 'as unknown as')
```

> 📖 See [.jev-rules/guidelines.md](file:///.jev-rules/guidelines.md) for full syntax rules and a standard TypeScript starter template.

---

## VS Code Extension Integration

The background gatekeeper (`src/extension.ts`) evaluates files directly inside VS Code:

- **On Save Evaluation:** Triggers when saving TypeScript/JavaScript files.
- **Diagnostic Markers:** Adds red squiggly underlines and populates the **Problems** tab with rule category tags and compliance scores.
- **Auto-Bootstrapping:** Automatically creates `.jev-rules/patterns.md` if an opened workspace lacks rules.
- **Hot Reloading:** Watches `.jev-rules/*.md` and automatically reloads active patterns when modified.

---

## How It Works Under the Hood

When `jev-lint` evaluates a source file:

```
[ Active Code File ] + [ .jev-rules/*.md Context ]
                         │
                         ▼
        client.systemOne({ state, questions })
                         │
      ┌──────────────────┼──────────────────┐
      ▼                  ▼                  ▼
    noul()            choice()            score()
(isViolation?)      (whichRule?)     (compliance 0-100)
      │                  │                  │
      └──────────────────┼──────────────────┘
                         ▼
              [ Filter by Confidence ]
                         │
                         ▼
         [ Terminal / CI / VS Code Markers ]
```

1. **State Aggregation:** Consolidates target source code and team rules into an evaluation state.
2. **Parallel Questions:** Simultaneously runs:
   - `noul`: Binary compliance assessment (`violatesTeamPatterns`).
   - `choice`: Assigns the primary violated category (`RULE_ASYNC`, `RULE_NAMING`, `RULE_STRUCTURE`, `NONE`).
   - `score`: Continuum rubric rating code pattern compliance ($0\text{--}100$).
3. **Gating & Reporting:** If `noul >= 0.85`, it generates an ESLint-style diagnostic entry tagged with the rule category.

---

## Development & Testing

```bash
# Run in development mode
npm run dev

# Run type checking
npx tsc --noEmit

# Test with local mock evaluation (no API key required)
TYPESAFE_MOCK=1 node dist/src/index.js src/index.ts
```

---

## License

MIT © 2026
