import fs from 'fs/promises';
import path from 'path';
import { ESLint } from 'eslint';
import prettier from 'prettier';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class CodeManager {
  constructor(workingDir) {
    this.workingDir = workingDir;
    this.documents = new Map();
    this.eslint = new ESLint({
      useEslintrc: false,
      overrideConfig: {
        env: { es6: true, node: true },
        parserOptions: { ecmaVersion: 2021 },
        extends: ['eslint:recommended']
      }
    });
  }

  async openDocument(filename) {
    const filePath = path.join(this.workingDir, filename);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      this.documents.set(filename, {
        content,
        version: Date.now()
      });
      return content;
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, create empty document
        this.documents.set(filename, {
          content: '',
          version: Date.now()
        });
        return '';
      }
      throw error;
    }
  }

  async saveDocument(filename, content) {
    const filePath = path.join(this.workingDir, filename);
    await fs.writeFile(filePath, content, 'utf-8');
    this.documents.set(filename, {
      content,
      version: Date.now()
    });
  }

  async updateDocument(filename, content, version) {
    const doc = this.documents.get(filename);
    if (!doc || doc.version < version) {
      this.documents.set(filename, {
        content,
        version
      });
    }
  }

  async formatDocument(filename) {
    const doc = this.documents.get(filename);
    if (!doc) throw new Error('Document not found');

    try {
      const formatted = await prettier.format(doc.content, {
        parser: this.getParserForFile(filename),
        singleQuote: true,
        trailingComma: 'es5',
        tabWidth: 2
      });

      await this.saveDocument(filename, formatted);
      return formatted;
    } catch (error) {
      throw new Error(`Failed to format document: ${error.message}`);
    }
  }

  async lintDocument(filename) {
    const doc = this.documents.get(filename);
    if (!doc) throw new Error('Document not found');

    try {
      const results = await this.eslint.lintText(doc.content, {
        filePath: path.join(this.workingDir, filename)
      });

      return results[0].messages.map(message => ({
        startLineNumber: message.line,
        startColumn: message.column,
        endLineNumber: message.endLine || message.line,
        endColumn: message.endColumn || message.column,
        message: message.message,
        severity: message.severity === 2 ? 8 : 4
      }));
    } catch (error) {
      throw new Error(`Failed to lint document: ${error.message}`);
    }
  }

  async runCode(filename) {
    const doc = this.documents.get(filename);
    if (!doc) throw new Error('Document not found');

    const filePath = path.join(this.workingDir, filename);
    try {
      const { stdout, stderr } = await execAsync(`node "${filePath}"`, {
        cwd: this.workingDir,
        timeout: 5000 // 5 second timeout
      });
      return { stdout, stderr };
    } catch (error) {
      throw new Error(`Failed to run code: ${error.message}`);
    }
  }

  getParserForFile(filename) {
    const ext = path.extname(filename);
    switch (ext) {
      case '.js':
        return 'babel';
      case '.ts':
        return 'typescript';
      case '.json':
        return 'json';
      case '.css':
        return 'css';
      case '.html':
        return 'html';
      default:
        return 'babel';
    }
  }

  async debugCode(filename) {
    const doc = this.documents.get(filename);
    if (!doc) throw new Error('Document not found');

    const filePath = path.join(this.workingDir, filename);
    try {
      // Start Node.js in debug mode
      const debugProcess = exec(`node --inspect-brk "${filePath}"`, {
        cwd: this.workingDir
      });

      return new Promise((resolve, reject) => {
        let output = '';
        debugProcess.stdout.on('data', data => {
          output += data;
        });
        debugProcess.stderr.on('data', data => {
          output += data;
        });
        debugProcess.on('close', code => {
          resolve({ code, output });
        });
        debugProcess.on('error', reject);

        // Kill the debug process after 30 seconds
        setTimeout(() => {
          debugProcess.kill();
          reject(new Error('Debug session timed out'));
        }, 30000);
      });
    } catch (error) {
      throw new Error(`Failed to start debug session: ${error.message}`);
    }
  }

  closeDocument(filename) {
    this.documents.delete(filename);
  }
}

export default CodeManager;