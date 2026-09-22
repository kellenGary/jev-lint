#!/usr/bin/env node
import { Command } from "commander";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import pc from "picocolors";
import { loadPatternRules, ensureDefaultRules } from "./config/loader.js";
import { evaluateMultipleFiles } from "./evaluator/runner.js";
import { formatJson, formatStylish, summarizeResults } from "./reporter/formatter.js";

const program = new Command();

program
  .name("jev-lint")
  .description("Lightweight, sub-second semantic linter powered by TypeSafe Jev")
  .version("0.1.0")
  .argument("[files...]", "Files or glob patterns to evaluate (e.g. 'src/**/*.ts')")
  .option("-t, --threshold <number>", "Probability threshold for flagging violations", "0.85")
  .option("-r, --rules-dir <dir>", "Directory containing .md team rules", ".jev-rules")
  .option("-f, --format <format>", "Output format: stylish or json", "stylish")
  .option("--init", "Initialize default .jev-rules/patterns.md in the current workspace")
  .action(async (files: string[], options) => {
    try {
      if (options.init) {
        const created = await ensureDefaultRules(process.cwd(), options.rulesDir);
        if (created) {
          console.log(
            pc.green(`✔ Successfully created ${options.rulesDir}/patterns.md with default team guidelines.`)
          );
        } else {
          console.log(pc.yellow(`ℹ ${options.rulesDir}/patterns.md already exists in this workspace.`));
        }
        process.exit(0);
      }

      const threshold = parseFloat(options.threshold);
      if (isNaN(threshold) || threshold < 0 || threshold > 1) {
        console.error(pc.red("Error: --threshold must be a number between 0 and 1."));
        process.exit(1);
      }

      // 1. Load workspace pattern rules
      const rules = await loadPatternRules(options.rulesDir);
      if (!rules) {
        console.warn(
          pc.yellow(
            `Warning: No rules found in '${options.rulesDir}'. Add pattern markdown files to '${options.rulesDir}/*.md'.`
          )
        );
      }

      // 2. Discover target files
      const targetPaths = await resolveTargetFiles(files.length > 0 ? files : ["."]);
      if (targetPaths.length === 0) {
        if (options.format === "json") {
          console.log(formatJson([]));
        } else {
          console.log(pc.yellow("No TypeScript/JavaScript files found to lint."));
        }
        process.exit(0);
      }

      // 3. Read files into memory
      const fileEntries = await Promise.all(
        targetPaths.map(async (fp) => {
          const code = await fs.readFile(fp, "utf-8");
          const relPath = path.relative(process.cwd(), fp);
          return { filePath: relPath, code };
        })
      );

      // 4. Run parallel evaluation pass with Jev
      const results = await evaluateMultipleFiles(fileEntries, rules, threshold);

      // 5. Output report
      if (options.format === "json") {
        console.log(formatJson(results));
      } else {
        console.log(formatStylish(results));
      }

      // 6. Exit with status code
      const summary = summarizeResults(results);
      if (summary.totalErrors > 0) {
        process.exit(1);
      }
      process.exit(0);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(pc.red(`jev-lint error: ${message}`));
      process.exit(1);
    }
  });

/**
 * Resolves file paths from arguments, recursively traversing directories if needed.
 */
async function resolveTargetFiles(patterns: string[]): Promise<string[]> {
  const supportedExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);
  const matchedFiles: string[] = [];

  async function walk(dirPath: string): Promise<void> {
    const base = path.basename(dirPath);
    if (base === "node_modules" || base === "dist" || base === ".git") {
      return;
    }

    let entries;
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (supportedExtensions.has(ext)) {
          matchedFiles.push(fullPath);
        }
      }
    }
  }

  for (const inputPath of patterns) {
    const resolved = path.resolve(process.cwd(), inputPath);
    try {
      const stat = await fs.stat(resolved);
      if (stat.isDirectory()) {
        await walk(resolved);
      } else if (stat.isFile()) {
        matchedFiles.push(resolved);
      }
    } catch {
      // If path didn't resolve directly, try relative directory scan
      continue;
    }
  }

  return [...new Set(matchedFiles)];
}

program.parseAsync(process.argv);
