import pc from "picocolors";
import type { FileEvaluationResult, LinterSummary } from "../types/index.js";

/**
 * Aggregates file evaluation results into a summary object.
 */
export function summarizeResults(results: FileEvaluationResult[]): LinterSummary {
  let totalErrors = 0;
  let totalWarnings = 0;
  let scoreSum = 0;
  let totalDurationMs = 0;

  for (const res of results) {
    totalDurationMs = Math.max(totalDurationMs, res.durationMs);
    scoreSum += res.complianceScore;
    for (const diag of res.diagnostics) {
      if (diag.severity === "error") totalErrors++;
      else totalWarnings++;
    }
  }

  const averageScore = results.length > 0 ? Math.round(scoreSum / results.length) : 100;

  return {
    results,
    totalFiles: results.length,
    totalErrors,
    totalWarnings,
    averageScore,
    totalDurationMs,
  };
}

/**
 * Formats results in stylish ESLint terminal format.
 */
export function formatStylish(results: FileEvaluationResult[]): string {
  const summary = summarizeResults(results);
  const lines: string[] = [];

  for (const res of results) {
    if (res.diagnostics.length === 0) continue;

    lines.push("");
    lines.push(pc.underline(res.file));

    for (const diag of res.diagnostics) {
      const position = pc.dim(`${diag.line}:${diag.column}`);
      const severity = diag.severity === "error" ? pc.red("error") : pc.yellow("warning");
      const rule = pc.dim(`[${diag.category}]`);
      const msg = diag.message;
      const source = pc.dim("jev-lint");

      lines.push(`  ${position.padEnd(8)} ${severity.padEnd(16)} ${msg}  ${rule}  ${source}`);
    }
  }

  lines.push("");

  const totalProblems = summary.totalErrors + summary.totalWarnings;
  if (totalProblems > 0) {
    const errorText = summary.totalErrors === 1 ? "1 error" : `${summary.totalErrors} errors`;
    const warningText = summary.totalWarnings === 1 ? "1 warning" : `${summary.totalWarnings} warnings`;
    const problemText = totalProblems === 1 ? "1 problem" : `${totalProblems} problems`;

    lines.push(
      pc.red(
        pc.bold(`✖ ${problemText} (${errorText}, ${warningText})`)
      )
    );
  } else {
    lines.push(pc.green(pc.bold(`✔ No pattern violations found across ${summary.totalFiles} file(s).`)));
  }

  lines.push(
    `${pc.cyan("Compliance Score:")} ${formatScore(summary.averageScore)} | ${pc.dim(`Evaluation time: ${summary.totalDurationMs}ms`)}`
  );
  lines.push("");

  return lines.join("\n");
}

function formatScore(score: number): string {
  if (score >= 80) return pc.green(`${score}/100 (Pass)`);
  if (score >= 50) return pc.yellow(`${score}/100 (Needs Improvement)`);
  return pc.red(`${score}/100 (Failing)`);
}

/**
 * Formats results as pure JSON for CI/CD pipelines.
 */
export function formatJson(results: FileEvaluationResult[]): string {
  const summary = summarizeResults(results);
  return JSON.stringify(summary, null, 2);
}
