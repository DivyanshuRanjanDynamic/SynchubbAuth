import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import prettier from 'prettier';
import hljs from 'highlight.js';
import Docker from 'dockerode';


class CodeExecutor {
  constructor() {
    this.docker = new Docker();
    this.containers = new Map();
    this.languageConfigs = {
      javascript: {
        image: 'node:16',
        command: ['node'],
        fileExtension: '.js',
        formatter: 'babel',
      },
      python: {
        image: 'python:3.9',
        command: ['python'],
        fileExtension: '.py',
        formatter: 'python',
      },
      java: {
        image: 'openjdk:11',
        command: ['java'],
        fileExtension: '.java',
        formatter: 'java',
      },
      cpp: {
        image: 'gcc:latest',
        command: ['g++'],
        fileExtension: '.cpp',
        formatter: 'cpp',
      },
      ruby: {
        image: 'ruby:latest',
        command: ['ruby'],
        fileExtension: '.rb',
        formatter: 'ruby',
      },
      go: {
        image: 'golang:latest',
        command: ['go', 'run'],
        fileExtension: '.go',
        formatter: 'golang',
      },
    };
  }

  async executeCode(language, code, input = '') {
    const config = this.languageConfigs[language];
    if (!config) {
      throw new Error(`Unsupported language: ${language}`);
    }

    try {
      // Create temporary directory for code execution
      const tempDir = path.join(__dirname, '../../temp', Date.now().toString());
      await fs.mkdir(tempDir, { recursive: true });

      // Write code to file
      const fileName = `main${config.fileExtension}`;
      const filePath = path.join(tempDir, fileName);
      await fs.writeFile(filePath, code);

      // Create container
      const container = await this.docker.createContainer({
        Image: config.image,
        Cmd: [...config.command, fileName],
        WorkingDir: '/app',
        Tty: true,
        HostConfig: {
          Binds: [`${tempDir}:/app`],
          Memory: 512 * 1024 * 1024, // 512MB memory limit
          MemorySwap: 512 * 1024 * 1024,
          CpuPeriod: 100000,
          CpuQuota: 50000, // 50% CPU limit
          NetworkMode: 'none', // Disable network access
        },
      });

      // Start container
      await container.start();

      // Write input if provided
      if (input) {
        const stream = await container.attach({ stream: true, stdin: true });
        stream.write(input);
        stream.end();
      }

      // Wait for container to finish
      const result = await container.wait();

      // Get output
      const output = await container.logs({
        stdout: true,
        stderr: true,
      });

      // Clean up
      await container.remove();
      await fs.rm(tempDir, { recursive: true, force: true });

      return {
        success: result.StatusCode === 0,
        output: output.toString(),
        error: result.StatusCode !== 0 ? output.toString() : null,
      };
    } catch (error) {
      throw new Error(`Execution failed: ${error.message}`);
    }
  }

  async formatCode(language, code) {
    const config = this.languageConfigs[language];
    if (!config) {
      throw new Error(`Unsupported language: ${language}`);
    }

    try {
      const formatted = await prettier.format(code, {
        parser: config.formatter,
        semi: true,
        singleQuote: true,
        trailingComma: 'es5',
      });

      return formatted;
    } catch (error) {
      throw new Error(`Formatting failed: ${error.message}`);
    }
  }

  highlightCode(language, code) {
    try {
      const highlighted = hljs.highlight(code, { language }).value;
      return highlighted;
    } catch (error) {
      throw new Error(`Syntax highlighting failed: ${error.message}`);
    }
  }

  async importFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const extension = path.extname(filePath);
      const language = Object.entries(this.languageConfigs).find(
        ([, config]) => config.fileExtension === extension
      )?.[0];

      if (!language) {
        throw new Error(`Unsupported file type: ${extension}`);
      }

      return {
        content,
        language,
        name: path.basename(filePath),
      };
    } catch (error) {
      throw new Error(`File import failed: ${error.message}`);
    }
  }

  async exportFile(filePath, content) {
    try {
      await fs.writeFile(filePath, content);
    } catch (error) {
      throw new Error(`File export failed: ${error.message}`);
    }
  }
}

export default  CodeExecutor;