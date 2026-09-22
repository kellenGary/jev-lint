import * as vscode from "vscode";
import * as path from "node:path";
import { loadPatternRules, invalidateRulesCache, ensureDefaultRules } from "./config/loader.js";
import { evaluateCodeFile } from "./evaluator/runner.js";

let diagnosticCollection: vscode.DiagnosticCollection;

/**
 * Activates the Jev Lint VS Code extension.
 */
export function activate(context: vscode.ExtensionContext): void {
  diagnosticCollection = vscode.languages.createDiagnosticCollection("jev-lint");
  context.subscriptions.push(diagnosticCollection);

  // Automatically scaffold .jev-rules/patterns.md in open workspaces if missing
  const autoCreate = vscode.workspace.getConfiguration("jevLint").get<boolean>("autoCreateRules", true);
  if (autoCreate && vscode.workspace.workspaceFolders) {
    for (const folder of vscode.workspace.workspaceFolders) {
      ensureDefaultRules(folder.uri.fsPath).then((created) => {
        if (created) {
          vscode.window.showInformationMessage(
            "jev-lint: Initialized default .jev-rules/patterns.md in workspace."
          );
        }
      });
    }
  }

  // Also auto-scaffold if new workspace folders are added
  if (autoCreate) {
    context.subscriptions.push(
      vscode.workspace.onDidChangeWorkspaceFolders(async (e) => {
        for (const folder of e.added) {
          const created = await ensureDefaultRules(folder.uri.fsPath);
          if (created) {
            vscode.window.showInformationMessage(
              "jev-lint: Initialized default .jev-rules/patterns.md in workspace."
            );
          }
        }
      })
    );
  }

  // Watch for changes to .jev-rules/ to invalidate cache
  const watcher = vscode.workspace.createFileSystemWatcher("**/.jev-rules/*.md");
  watcher.onDidChange(() => invalidateRulesCache());
  watcher.onDidCreate(() => invalidateRulesCache());
  watcher.onDidDelete(() => invalidateRulesCache());
  context.subscriptions.push(watcher);

  // Lint active file on save
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (document) => {
      if (isSupportedLanguage(document.languageId)) {
        await lintDocument(document);
      }
    })
  );

  // Clear diagnostics on document close
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((document) => {
      diagnosticCollection.delete(document.uri);
    })
  );

  // Register manual trigger command
  context.subscriptions.push(
    vscode.commands.registerCommand("jev-lint.lintCurrentFile", async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor && isSupportedLanguage(editor.document.languageId)) {
        await lintDocument(editor.document, true);
      }
    })
  );

  // Register command to set TypeSafe API key
  context.subscriptions.push(
    vscode.commands.registerCommand("jev-lint.setApiKey", async () => {
      const input = await vscode.window.showInputBox({
        password: true,
        title: "TypeSafe API Key",
        prompt: "Enter your TypeSafe API Key (from console.typesafe.ai)",
        placeHolder: "ts_live_...",
      });

      if (input && input.trim()) {
        const config = vscode.workspace.getConfiguration("jevLint");
        await config.update("apiKey", input.trim(), vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage("jev-lint: TypeSafe API Key saved successfully.");
      }
    })
  );
}

function isSupportedLanguage(languageId: string): boolean {
  return (
    languageId === "typescript" ||
    languageId === "typescriptreact" ||
    languageId === "javascript" ||
    languageId === "javascriptreact"
  );
}

/**
 * Evaluates document using Jev and publishes diagnostics to VS Code.
 */
async function lintDocument(document: vscode.TextDocument, notifyClean = false): Promise<void> {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
  const rulesDir = workspaceFolder
    ? path.join(workspaceFolder.uri.fsPath, ".jev-rules")
    : ".jev-rules";

  const rules = await loadPatternRules(rulesDir);
  if (!rules) {
    return;
  }

  const config = vscode.workspace.getConfiguration("jevLint");
  const threshold = config.get<number>("threshold", 0.85);
  const apiKey = config.get<string>("apiKey")?.trim() || process.env.TYPESAFE_API_KEY;

  if (!apiKey && !process.env.TYPESAFE_MOCK) {
    if (notifyClean) {
      const action = await vscode.window.showWarningMessage(
        "jev-lint: TypeSafe API Key not found. Please set your API key to enable linting.",
        "Set API Key",
        "Open Settings"
      );
      if (action === "Set API Key") {
        await vscode.commands.executeCommand("jev-lint.setApiKey");
      } else if (action === "Open Settings") {
        await vscode.commands.executeCommand("workbench.action.openSettings", "jevLint.apiKey");
      }
    }
    return;
  }

  try {
    const result = await evaluateCodeFile({
      filePath: document.uri.fsPath,
      code: document.getText(),
      rules,
      threshold,
      apiKey,
    });

    const diagnostics: vscode.Diagnostic[] = [];

    for (const diag of result.diagnostics) {
      // Create diagnostic spanning the first line/character (or error target)
      const range = new vscode.Range(
        new vscode.Position(Math.max(0, diag.line - 1), Math.max(0, diag.column - 1)),
        new vscode.Position(Math.max(0, diag.line - 1), 80)
      );

      const diagnostic = new vscode.Diagnostic(
        range,
        `[jev-lint] ${diag.message} (Score: ${result.complianceScore}/100)`,
        diag.severity === "error"
          ? vscode.DiagnosticSeverity.Error
          : vscode.DiagnosticSeverity.Warning
      );

      diagnostic.source = "jev-lint";
      diagnostic.code = diag.category;
      diagnostics.push(diagnostic);
    }

    diagnosticCollection.set(document.uri, diagnostics);

    if (notifyClean && diagnostics.length === 0) {
      vscode.window.showInformationMessage(
        `jev-lint: No pattern violations found (Compliance score: ${result.complianceScore}/100)`
      );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[jev-lint] Evaluation failed: ${message}`);
  }
}

/**
 * Deactivates the extension.
 */
export function deactivate(): void {
  diagnosticCollection?.clear();
}
