import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import os from 'os';
import pty from 'node-pty';

class Terminal extends EventEmitter {
  constructor() {
    super();
    this.sessions = new Map();
    this.defaultShell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
  }

  createSession(sessionId, config = {}) {
    try {
      const shell = config.shell || this.defaultShell;
      const cwd = config.cwd || process.cwd();
      const env = { ...process.env, ...config.env };

      const term = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: config.cols || 80,
        rows: config.rows || 24,
        cwd: cwd,
        env: env
      });

      const session = {
        id: sessionId,
        terminal: term,
        config: config,
        status: 'active'
      };

      this.sessions.set(sessionId, session);

      // Set up event listeners
      term.onData((data) => {
        this.emit('data', {
          sessionId: sessionId,
          data: data
        });
      });

      term.onExit(({ exitCode, signal }) => {
        this.emit('exit', {
          sessionId: sessionId,
          exitCode,
          signal
        });
        this.sessions.delete(sessionId);
      });

      return sessionId;
    } catch (error) {
      throw new Error(`Failed to create terminal session: ${error.message}`);
    }
  }

  write(sessionId, data) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Terminal session not found');
    }
    session.terminal.write(data);
  }

  resize(sessionId, cols, rows) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Terminal session not found');
    }
    session.terminal.resize(cols, rows);
  }

  kill(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.terminal.kill();
      this.sessions.delete(sessionId);
    }
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  listSessions() {
    return Array.from(this.sessions.keys());
  }

  executeCommand(sessionId, command) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Terminal session not found');
    }
    session.terminal.write(command + '\n');
  }

  setWorkingDirectory(sessionId, directory) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Terminal session not found');
    }
    this.executeCommand(sessionId, `cd "${directory}"`);
  }

  clearScreen(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Terminal session not found');
    }
    // Send clear screen command (ANSI escape sequence)
    session.terminal.write('\x1b[2J\x1b[H');
  }

  updateEnvironment(sessionId, env) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Terminal session not found');
    }
    session.config.env = { ...session.config.env, ...env };
  }
}

export default Terminal;