import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';


class Debugger extends EventEmitter {
  constructor() {
    super();
    this.debugSessions = new Map();
    this.breakpoints = new Map();
    this.debugConfigs = new Map();
    this.activeDebuggers = new Map();
  }

  async startDebugSession(fileId, language, config) {
    try {
      const debugConfig = this._getDebugConfig(language, config);
      const debugProcess = await this._spawnDebugger(debugConfig);
      
      const session = {
        id: `debug_${Date.now()}`,
        process: debugProcess,
        language,
        config: debugConfig,
        variables: new Map(),
        callStack: [],
        status: 'initializing'
      };

      this.debugSessions.set(fileId, session);
      this._setupDebuggerEvents(session);
      
      return session.id;
    } catch (error) {
      throw new Error(`Failed to start debug session: ${error.message}`);
    }
  }

  async stopDebugSession(sessionId) {
    const session = this._getSession(sessionId);
    if (session) {
      session.process.kill();
      this.debugSessions.delete(sessionId);
      this.emit('sessionEnded', { sessionId });
    }
  }

  async setBreakpoint(sessionId, line, column, condition = '') {
    const session = this._getSession(sessionId);
    if (!session) throw new Error('Debug session not found');

    const breakpoint = {
      id: `bp_${Date.now()}`,
      line,
      column,
      condition,
      enabled: true
    };

    if (!this.breakpoints.has(sessionId)) {
      this.breakpoints.set(sessionId, new Map());
    }
    this.breakpoints.get(sessionId).set(breakpoint.id, breakpoint);
    
    await this._sendDebugCommand(session, 'setBreakpoint', breakpoint);
    return breakpoint.id;
  }

  async removeBreakpoint(sessionId, breakpointId) {
    const session = this._getSession(sessionId);
    if (!session) throw new Error('Debug session not found');

    const sessionBreakpoints = this.breakpoints.get(sessionId);
    if (sessionBreakpoints && sessionBreakpoints.has(breakpointId)) {
      sessionBreakpoints.delete(breakpointId);
      await this._sendDebugCommand(session, 'removeBreakpoint', { breakpointId });
    }
  }

  async continue(sessionId) {
    const session = this._getSession(sessionId);
    if (!session) throw new Error('Debug session not found');
    await this._sendDebugCommand(session, 'continue');
  }

  async stepOver(sessionId) {
    const session = this._getSession(sessionId);
    if (!session) throw new Error('Debug session not found');
    await this._sendDebugCommand(session, 'stepOver');
  }

  async stepInto(sessionId) {
    const session = this._getSession(sessionId);
    if (!session) throw new Error('Debug session not found');
    await this._sendDebugCommand(session, 'stepInto');
  }

  async stepOut(sessionId) {
    const session = this._getSession(sessionId);
    if (!session) throw new Error('Debug session not found');
    await this._sendDebugCommand(session, 'stepOut');
  }

  async pause(sessionId) {
    const session = this._getSession(sessionId);
    if (!session) throw new Error('Debug session not found');
    await this._sendDebugCommand(session, 'pause');
  }

  async evaluate(sessionId, expression) {
    const session = this._getSession(sessionId);
    if (!session) throw new Error('Debug session not found');
    return await this._sendDebugCommand(session, 'evaluate', { expression });
  }

  getCallStack(sessionId) {
    const session = this._getSession(sessionId);
    if (!session) throw new Error('Debug session not found');
    return session.callStack;
  }

  getVariables(sessionId) {
    const session = this._getSession(sessionId);
    if (!session) throw new Error('Debug session not found');
    return Array.from(session.variables.values());
  }

  getBreakpoints(sessionId) {
    return Array.from(this.breakpoints.get(sessionId)?.values() || []);
  }

  _getSession(sessionId) {
    for (const [, session] of this.debugSessions) {
      if (session.id === sessionId) return session;
    }
    return null;
  }

  _getDebugConfig(language, config) {
    const baseConfig = {
      javascript: {
        command: 'node',
        args: ['--inspect-brk'],
        parser: 'cdp'
      },
      python: {
        command: 'python',
        args: ['-m', 'pdb'],
        parser: 'pdb'
      },
      java: {
        command: 'jdb',
        args: [],
        parser: 'jdb'
      }
    };

    const langConfig = baseConfig[language] || baseConfig.javascript;
    return { ...langConfig, ...config };
  }

  async _spawnDebugger(config) {
    const debugProcess = spawn(config.command, config.args, {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    return debugProcess;
  }

  _setupDebuggerEvents(session) {
    session.process.stdout.on('data', (data) => {
      this._handleDebuggerOutput(session, data);
    });

    session.process.stderr.on('data', (data) => {
      this.emit('error', {
        sessionId: session.id,
        error: data.toString()
      });
    });

    session.process.on('exit', (code) => {
      this.emit('sessionEnded', {
        sessionId: session.id,
        code
      });
      this.debugSessions.delete(session.id);
    });
  }

  _handleDebuggerOutput(session, data) {
    const output = data.toString();
    const parser = this._getOutputParser(session.config.parser);
    const parsed = parser(output);

    if (parsed.type === 'breakpoint') {
      session.status = 'paused';
      this.emit('breakpointHit', {
        sessionId: session.id,
        ...parsed.data
      });
    } else if (parsed.type === 'variables') {
      session.variables = new Map(Object.entries(parsed.data));
      this.emit('variablesUpdated', {
        sessionId: session.id,
        variables: parsed.data
      });
    } else if (parsed.type === 'callStack') {
      session.callStack = parsed.data;
      this.emit('callStackUpdated', {
        sessionId: session.id,
        callStack: parsed.data
      });
    }
  }

  _getOutputParser(type) {
    const parsers = {
      cdp: this._parseChromeDevProtocol,
      pdb: this._parsePDB,
      jdb: this._parseJDB
    };
    return parsers[type] || parsers.cdp;
  }

  _parseChromeDevProtocol(output) {
    // Implementation for parsing Chrome DevTools Protocol output
    try {
      const data = JSON.parse(output);
      if (data.method === 'Debugger.paused') {
        return {
          type: 'breakpoint',
          data: {
            location: data.params.callFrames[0].location,
            reason: data.params.reason
          }
        };
      }
      // Add more CDP message handling as needed
      return { type: 'unknown', data: {} };
    } catch (e) {
      return { type: 'unknown', data: {} };
    }
  }

  _parsePDB(output) {
    // Implementation for parsing Python debugger output
    const lines = output.split('\n');
    if (lines[0].startsWith('> ')) {
      return {
        type: 'breakpoint',
        data: {
          location: {
            line: parseInt(lines[0].split(':')[1]),
            file: lines[0].split(':')[0].substring(2)
          }
        }
      };
    }
    return { type: 'unknown', data: {} };
  }

  _parseJDB(output) {
    // Implementation for parsing Java debugger output
    if (output.includes('Breakpoint hit:')) {
      const match = output.match(/Breakpoint hit: (.*):(\d+)/);
      if (match) {
        return {
          type: 'breakpoint',
          data: {
            location: {
              file: match[1],
              line: parseInt(match[2])
            }
          }
        };
      }
    }
    return { type: 'unknown', data: {} };
  }

  async _sendDebugCommand(session, command, args = {}) {
    return new Promise((resolve, reject) => {
      try {
        const cmd = this._formatDebugCommand(session.config.parser, command, args);
        session.process.stdin.write(cmd + '\n');
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  _formatDebugCommand(parser, command, args) {
    const formatters = {
      cdp: this._formatCDPCommand,
      pdb: this._formatPDBCommand,
      jdb: this._formatJDBCommand
    };
    return (formatters[parser] || formatters.cdp)(command, args);
  }

  _formatCDPCommand(command, args) {
    const commands = {
      continue: 'Runtime.resume',
      stepOver: 'Debugger.stepOver',
      stepInto: 'Debugger.stepInto',
      stepOut: 'Debugger.stepOut',
      pause: 'Debugger.pause',
      setBreakpoint: 'Debugger.setBreakpoint',
      removeBreakpoint: 'Debugger.removeBreakpoint',
      evaluate: 'Runtime.evaluate'
    };
    return JSON.stringify({
      id: Date.now(),
      method: commands[command],
      params: args
    });
  }

  _formatPDBCommand(command, args) {
    const commands = {
      continue: 'continue',
      stepOver: 'next',
      stepInto: 'step',
      stepOut: 'return',
      pause: 'break',
      setBreakpoint: `break ${args.line}`,
      removeBreakpoint: `clear ${args.breakpointId}`,
      evaluate: `p ${args.expression}`
    };
    return commands[command];
  }

  _formatJDBCommand(command, args) {
    const commands = {
      continue: 'cont',
      stepOver: 'next',
      stepInto: 'step',
      stepOut: 'step up',
      pause: 'suspend',
      setBreakpoint: `stop at ${args.line}`,
      removeBreakpoint: `clear ${args.breakpointId}`,
      evaluate: `print ${args.expression}`
    };
    return commands[command];
  }
}

export default  Debugger;