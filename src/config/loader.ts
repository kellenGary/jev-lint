import * as fs from "node:fs/promises";
import * as path from "node:path";

let cachedRules: { dir: string; content: string; timestamp: number } | null = null;
const CACHE_TTL_MS = 5000;

/**
 * Loads and aggregates all Markdown rule files from the target directory.
 * Defaults to `.jev-rules`.
 */
export async function loadPatternRules(rulesDir: string = ".jev-rules"): Promise<string> {
  const resolvedDir = path.resolve(process.cwd(), rulesDir);

  const now = Date.now();
  if (
    cachedRules &&
    cachedRules.dir === resolvedDir &&
    now - cachedRules.timestamp < CACHE_TTL_MS
  ) {
    return cachedRules.content;
  }

  try {
    const entries = await fs.readdir(resolvedDir, { withFileTypes: true });
    const IGNORED_RULE_FILES = new Set(["guidelines.md", "README.md", "readme.md"]);
    const mdFiles = entries
      .filter(
        (e) =>
          e.isFile() &&
          e.name.endsWith(".md") &&
          !IGNORED_RULE_FILES.has(e.name) &&
          !e.name.startsWith("_")
      )
      .map((e) => path.join(resolvedDir, e.name));

    if (mdFiles.length === 0) {
      return "";
    }

    const contents = await Promise.all(
      mdFiles.map(async (filePath) => {
        const text = await fs.readFile(filePath, "utf-8");
        const rel = path.relative(process.cwd(), filePath);
        return `### File: ${rel}\n\n${text.trim()}`;
      })
    );

    const unified = contents.join("\n\n---\n\n");
    cachedRules = {
      dir: resolvedDir,
      content: unified,
      timestamp: now,
    };

    return unified;
  } catch (err: unknown) {
    const nodeErr = err as NodeJS.ErrnoException;
    if (nodeErr.code === "ENOENT") {
      return "";
    }
    throw err;
  }
}

/**
 * Clears the in-memory rules cache.
 */
export function invalidateRulesCache(): void {
  cachedRules = null;
}

export const DEFAULT_PATTERNS_TEMPLATE = `RULE_ASYNC:
- BAN floating promises: every Promise must be awaited or .catch()'d
- MUST wrap async I/O in try/catch
- BAN async callbacks in forEach/reduce (use for-of)

RULE_NAMING:
- camelCase: variables, functions
- PascalCase: types, interfaces, classes
- UPPER_SNAKE_CASE: constants
- BAN single-letter identifiers (except loop i, j)

RULE_STRUCTURE:
- Named exports only (no default exports)
- BAN 'any'
- BAN type casting ('as', 'as unknown as')
`;

/**
 * Ensures that .jev-rules/patterns.md exists in the target workspace.
 * Automatically creates the directory and writes the default patterns file if absent.
 * @returns true if newly created, false if already present.
 */
export async function ensureDefaultRules(
  workspaceRoot: string = process.cwd(),
  rulesDirName: string = ".jev-rules"
): Promise<boolean> {
  const targetDir = path.resolve(workspaceRoot, rulesDirName);
  const targetFile = path.join(targetDir, "patterns.md");

  try {
    await fs.access(targetFile);
    return false;
  } catch {
    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(targetFile, DEFAULT_PATTERNS_TEMPLATE, "utf-8");
    invalidateRulesCache();
    return true;
  }
}

