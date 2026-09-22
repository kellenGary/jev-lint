export type RuleCategory =
  | "RULE_ASYNC"
  | "RULE_NAMING"
  | "RULE_STRUCTURE"
  | "NONE";

export interface JevDiagnostic {
  file: string;
  line: number;
  column: number;
  severity: "error" | "warning";
  category: RuleCategory;
  probability: number;
  message: string;
}

export interface FileEvaluationResult {
  file: string;
  violates: boolean;
  probability: number;
  category: RuleCategory;
  complianceScore: number;
  durationMs: number;
  diagnostics: JevDiagnostic[];
}

export interface LinterOptions {
  threshold?: number;
  rulesDir?: string;
  format?: "stylish" | "json";
}

export interface LinterSummary {
  results: FileEvaluationResult[];
  totalFiles: number;
  totalErrors: number;
  totalWarnings: number;
  averageScore: number;
  totalDurationMs: number;
}
