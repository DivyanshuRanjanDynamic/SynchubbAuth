import { TextDocument } from 'vscode-languageserver-textdocument';
import { CompletionItem, CompletionItemKind, Diagnostic, DiagnosticSeverity } from 'vscode-languageserver-types';
import { ESLint } from 'eslint';
import * as ts from 'typescript';
import * as path from 'path';


class CodeIntelligence {
  constructor(workingDir) {
    this.workingDir = workingDir;
    this.documents = new Map();
    this.eslint = new ESLint({
      useEslintrc: false,
      baseConfig: {
        extends: ['eslint:recommended'],
        parserOptions: {
          ecmaVersion: 2021,
          sourceType: 'module'
        }
      }
    });
  }

  // Document management
  openDocument(uri, languageId, content) {
    const document = TextDocument.create(uri, languageId, 0, content);
    this.documents.set(uri, document);
    return document;
  }

  updateDocument(uri, changes) {
    const document = this.documents.get(uri);
    if (!document) return null;

    const newVersion = document.version + 1;
    const newDocument = TextDocument.create(
      uri,
      document.languageId,
      newVersion,
      document.getText()
    );

    for (const change of changes) {
      const start = newDocument.positionAt(change.range.start);
      const end = newDocument.positionAt(change.range.end);
      const range = { start, end };
      newDocument.update([{ range, text: change.text }], newVersion);
    }

    this.documents.set(uri, newDocument);
    return newDocument;
  }

  closeDocument(uri) {
    this.documents.delete(uri);
  }

  // Code completion
  async getCompletions(uri, position) {
    const document = this.documents.get(uri);
    if (!document) return [];

    const completions = [];
    const text = document.getText();
    const offset = document.offsetAt(position);

    switch (document.languageId) {
      case 'javascript':
      case 'typescript':
        completions.push(...await this._getJavaScriptCompletions(text, offset));
        break;
      case 'python':
        completions.push(...await this._getPythonCompletions(text, offset));
        break;
      // Add more language support as needed
    }

    return completions;
  }

  async _getJavaScriptCompletions(text, offset) {
    const completions = [];
    const sourceFile = ts.createSourceFile(
      'temp.ts',
      text,
      ts.ScriptTarget.Latest,
      true
    );

    // Add basic JavaScript/TypeScript keywords
    const keywords = [
      'const', 'let', 'var', 'function', 'class', 'if', 'else', 'for', 'while',
      'do', 'switch', 'case', 'break', 'continue', 'return', 'try', 'catch',
      'finally', 'throw', 'async', 'await', 'import', 'export', 'default'
    ];

    keywords.forEach(keyword => {
      completions.push({
        label: keyword,
        kind: CompletionItemKind.Keyword,
        detail: 'Keyword'
      });
    });

    // Add identifiers from the current file
    const identifiers = new Set();
    const visitor = (node) => {
      if (ts.isIdentifier(node)) {
        identifiers.add(node.text);
      }
      ts.forEachChild(node, visitor);
    };
    ts.forEachChild(sourceFile, visitor);

    identifiers.forEach(identifier => {
      completions.push({
        label: identifier,
        kind: CompletionItemKind.Variable,
        detail: 'Identifier'
      });
    });

    return completions;
  }

  async _getPythonCompletions(text, offset) {
    // Basic Python completions
    const keywords = [
      'def', 'class', 'if', 'else', 'elif', 'for', 'while', 'try', 'except',
      'finally', 'with', 'as', 'import', 'from', 'return', 'yield', 'break',
      'continue', 'pass', 'raise', 'True', 'False', 'None'
    ];

    return keywords.map(keyword => ({
      label: keyword,
      kind: CompletionItemKind.Keyword,
      detail: 'Keyword'
    }));
  }

  // Linting
  async lint(uri) {
    const document = this.documents.get(uri);
    if (!document) return [];

    const diagnostics = [];

    switch (document.languageId) {
      case 'javascript':
        diagnostics.push(...await this._lintJavaScript(document));
        break;
      case 'typescript':
        diagnostics.push(...await this._lintTypeScript(document));
        break;
      // Add more language support as needed
    }

    return diagnostics;
  }

  async _lintJavaScript(document) {
    try {
      const results = await this.eslint.lintText(document.getText(), {
        filePath: document.uri
      });

      return results[0].messages.map(message => ({
        range: {
          start: { line: message.line - 1, character: message.column - 1 },
          end: { line: message.endLine - 1 || message.line - 1, character: message.endColumn - 1 || message.column }
        },
        severity: this._eslintSeverityToDiagnosticSeverity(message.severity),
        message: message.message,
        source: 'eslint'
      }));
    } catch (error) {
      console.error('ESLint error:', error);
      return [];
    }
  }

  async _lintTypeScript(document) {
    const program = ts.createProgram([document.uri], {
      target: ts.ScriptTarget.Latest,
      module: ts.ModuleKind.CommonJS,
      strict: true
    });

    const sourceFile = program.getSourceFile(document.uri);
    const diagnostics = [
      ...program.getSemanticDiagnostics(sourceFile),
      ...program.getSyntacticDiagnostics(sourceFile)
    ];

    return diagnostics.map(diagnostic => {
      const start = sourceFile.getLineAndCharacterOfPosition(diagnostic.start);
      const end = sourceFile.getLineAndCharacterOfPosition(diagnostic.start + diagnostic.length);

      return {
        range: { start, end },
        severity: DiagnosticSeverity.Error,
        message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
        source: 'typescript'
      };
    });
  }

  _eslintSeverityToDiagnosticSeverity(severity) {
    switch (severity) {
      case 2: return DiagnosticSeverity.Error;
      case 1: return DiagnosticSeverity.Warning;
      default: return DiagnosticSeverity.Information;
    }
  }

  // Code formatting
  async format(uri) {
    const document = this.documents.get(uri);
    if (!document) return null;

    switch (document.languageId) {
      case 'javascript':
      case 'typescript':
        return await this._formatJavaScript(document);
      // Add more language support as needed
      default:
        return document.getText();
    }
  }

  async _formatJavaScript(document) {
    try {
      const results = await this.eslint.lintText(document.getText(), {
        filePath: document.uri,
        fix: true
      });

      if (results[0].output) {
        return results[0].output;
      }
      return document.getText();
    } catch (error) {
      console.error('Formatting error:', error);
      return document.getText();
    }
  }
}

export default CodeIntelligence;