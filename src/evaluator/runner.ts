import { noul, choice, score } from "@typesafe-ai/sdk";
import { getTypeSafeClient } from "./client.js";
import type { FileEvaluationResult, JevDiagnostic, RuleCategory } from "../types/index.js";

export interface EvaluateFileOptions {
  filePath: string;
  code: string;
  rules: string;
  threshold?: number;
  apiKey?: string;
}

/**
 * Evaluates a single code file against aggregated team patterns using TypeSafe Jev System One.
 */
export async function evaluateCodeFile({
  filePath,
  code,
  rules,
  threshold = 0.85,
  apiKey,
}: EvaluateFileOptions): Promise<FileEvaluationResult> {
  const startTime = performance.now();

  // Support local test mock mode if TYPESAFE_MOCK is set
  if (process.env.TYPESAFE_MOCK === "true" || process.env.TYPESAFE_MOCK === "1") {
    const isMockViolation = code.includes("fetch(") && !code.includes("await fetch(");
    const violatesNoul = isMockViolation ? 0.94 : 0.05;
    const chosenCategory: RuleCategory = isMockViolation ? "RULE_ASYNC" : "NONE";
    const rawScore = isMockViolation ? 1 : 3;
    const normalizedScore = Math.round((rawScore / 3) * 100);
    const durationMs = 42;
    const isViolation = violatesNoul >= threshold && chosenCategory !== "NONE";
    const diagnostics: JevDiagnostic[] = [];

    if (isViolation) {
      diagnostics.push({
        file: filePath,
        line: 5,
        column: 3,
        severity: "error",
        category: chosenCategory,
        probability: violatesNoul,
        message: `Team rule violation [${chosenCategory}]: Floating promise or unhandled async call detected.`,
      });
    }

    return {
      file: filePath,
      violates: isViolation,
      probability: violatesNoul,
      category: chosenCategory,
      complianceScore: normalizedScore,
      durationMs,
      diagnostics,
    };
  }

  const client = getTypeSafeClient(apiKey);

  // Fire parallel Jev primitives in a single System One snapshot call (<200ms)
  const response = await client.systemOne({
    state: {
      rules,
      targetFile: filePath,
      targetCode: code,
    },
    questions: {
      violatesTeamPatterns: noul(
        "Does `targetCode` violate any team coding patterns defined in `rules`?"
      ),
      category: choice(
        "Which category best describes the primary rule violation in `targetCode`?",
        {
          RULE_ASYNC: "Violations related to async/await, unhandled promises, or missing catch handlers",
          RULE_NAMING: "Violations related to casing, descriptive identifiers, or naming conventions",
          RULE_STRUCTURE: "Violations related to exports, circular imports, modular layout, or typing escapes",
          NONE: "No pattern violations detected; code follows all workspace rules",
        }
      ),
      complianceScore: score(
        "Rate the overall pattern compliance of `targetCode` against `rules`:",
        [
          "Gross violations across core guidelines",
          "Substantial violations of patterns",
          "Minor or stylistic deviations",
          "Fully compliant with workspace standards",
        ]
      ),
    },
  });

  const durationMs = Math.round(performance.now() - startTime);
  const violatesNoul = response.answers.violatesTeamPatterns.noul;
  const chosenCategory = response.answers.category.choice as RuleCategory;
  const rawScore = response.answers.complianceScore.score; // 0 to 3 scale mapped to 0-100
  const normalizedScore = Math.round((rawScore / 3) * 100);

  const isViolation = violatesNoul >= threshold && chosenCategory !== "NONE";

  const diagnostics: JevDiagnostic[] = [];
  if (isViolation) {
    const confidencePct = Math.round(violatesNoul * 100);
    diagnostics.push({
      file: filePath,
      line: 1,
      column: 1,
      severity: "error",
      category: chosenCategory,
      probability: violatesNoul,
      message: `Team rule violation [${chosenCategory}]: Code violates pattern with ${confidencePct}% confidence.`,
    });
  }

  return {
    file: filePath,
    violates: isViolation,
    probability: violatesNoul,
    category: chosenCategory,
    complianceScore: normalizedScore,
    durationMs,
    diagnostics,
  };
}

/**
 * Evaluates multiple files in parallel using TypeSafe Jev.
 */
export async function evaluateMultipleFiles(
  files: Array<{ filePath: string; code: string }>,
  rules: string,
  threshold = 0.85
): Promise<FileEvaluationResult[]> {
  return Promise.all(
    files.map((file) =>
      evaluateCodeFile({
        filePath: file.filePath,
        code: file.code,
        rules,
        threshold,
      })
    )
  );
}
