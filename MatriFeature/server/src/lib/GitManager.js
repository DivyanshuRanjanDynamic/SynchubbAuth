import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import { promises as fs } from 'fs';


class GitManager extends EventEmitter {
  constructor(workingDir) {
    super();
    this.workingDir = workingDir;
    this.operations = new Map();
  }

  async _executeGitCommand(args, options = {}) {
    return new Promise((resolve, reject) => {
      const git = spawn('git', args, {
        cwd: this.workingDir,
        ...options
      });

      let stdout = '';
      let stderr = '';

      git.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      git.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      git.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
        } else {
          reject(new Error(`Git command failed: ${stderr}`));
        }
      });
    });
  }

  async init() {
    try {
      await this._executeGitCommand(['init']);
      return { success: true, message: 'Git repository initialized' };
    } catch (error) {
      throw new Error(`Failed to initialize repository: ${error.message}`);
    }
  }

  async clone(url, directory) {
    try {
      const targetDir = directory || this.workingDir;
      await this._executeGitCommand(['clone', url, targetDir]);
      return { success: true, message: 'Repository cloned successfully' };
    } catch (error) {
      throw new Error(`Failed to clone repository: ${error.message}`);
    }
  }

  async status() {
    try {
      const { stdout } = await this._executeGitCommand(['status', '--porcelain', '-b']);
      const lines = stdout.split('\n');
      const branch = lines[0].match(/## (.+)/)[1];
      const changes = lines.slice(1).map(line => ({
        status: line.slice(0, 2).trim(),
        file: line.slice(3)
      }));
      return { branch, changes };
    } catch (error) {
      throw new Error(`Failed to get status: ${error.message}`);
    }
  }

  async add(files) {
    try {
      const fileList = Array.isArray(files) ? files : [files];
      await this._executeGitCommand(['add', ...fileList]);
      return { success: true, message: 'Files staged successfully' };
    } catch (error) {
      throw new Error(`Failed to stage files: ${error.message}`);
    }
  }

  async commit(message) {
    try {
      await this._executeGitCommand(['commit', '-m', message]);
      return { success: true, message: 'Changes committed successfully' };
    } catch (error) {
      throw new Error(`Failed to commit changes: ${error.message}`);
    }
  }

  async push(remote = 'origin', branch = 'main') {
    try {
      await this._executeGitCommand(['push', remote, branch]);
      return { success: true, message: 'Changes pushed successfully' };
    } catch (error) {
      throw new Error(`Failed to push changes: ${error.message}`);
    }
  }

  async pull(remote = 'origin', branch = 'main') {
    try {
      await this._executeGitCommand(['pull', remote, branch]);
      return { success: true, message: 'Changes pulled successfully' };
    } catch (error) {
      throw new Error(`Failed to pull changes: ${error.message}`);
    }
  }

  async checkout(branch, create = false) {
    try {
      const args = create ? ['checkout', '-b', branch] : ['checkout', branch];
      await this._executeGitCommand(args);
      return { success: true, message: `Switched to branch ${branch}` };
    } catch (error) {
      throw new Error(`Failed to checkout branch: ${error.message}`);
    }
  }

  async branch() {
    try {
      const { stdout } = await this._executeGitCommand(['branch']);
      const branches = stdout.split('\n')
        .map(b => b.trim())
        .filter(b => b.length > 0)
        .map(b => ({
          name: b.replace('* ', ''),
          current: b.startsWith('*')
        }));
      return branches;
    } catch (error) {
      throw new Error(`Failed to list branches: ${error.message}`);
    }
  }

  async log(maxCount = 10) {
    try {
      const { stdout } = await this._executeGitCommand([
        'log',
        `--max-count=${maxCount}`,
        '--pretty=format:{"hash":"%h","author":"%an","date":"%ad","message":"%s"}'
      ]);
      const commits = stdout.split('\n').map(line => JSON.parse(line));
      return commits;
    } catch (error) {
      throw new Error(`Failed to get commit log: ${error.message}`);
    }
  }

  async diff(file) {
    try {
      const args = file ? ['diff', file] : ['diff'];
      const { stdout } = await this._executeGitCommand(args);
      return stdout;
    } catch (error) {
      throw new Error(`Failed to get diff: ${error.message}`);
    }
  }

  async stash(action = 'save', message = '') {
    try {
      const args = ['stash'];
      switch (action) {
        case 'save':
          if (message) args.push('save', message);
          break;
        case 'pop':
          args.push('pop');
          break;
        case 'apply':
          args.push('apply');
          break;
        case 'list':
          args.push('list');
          break;
        default:
          throw new Error('Invalid stash action');
      }
      const { stdout } = await this._executeGitCommand(args);
      return { success: true, message: stdout };
    } catch (error) {
      throw new Error(`Failed to perform stash operation: ${error.message}`);
    }
  }

  async reset(file, hard = false) {
    try {
      const args = hard ? ['reset', '--hard'] : ['reset'];
      if (file) args.push(file);
      await this._executeGitCommand(args);
      return { success: true, message: 'Reset successful' };
    } catch (error) {
      throw new Error(`Failed to reset: ${error.message}`);
    }
  }

  async merge(branch) {
    try {
      await this._executeGitCommand(['merge', branch]);
      return { success: true, message: `Merged ${branch} successfully` };
    } catch (error) {
      throw new Error(`Failed to merge branch: ${error.message}`);
    }
  }

  async remote(action = 'list', name = '', url = '') {
    try {
      const args = ['remote'];
      switch (action) {
        case 'list':
          args.push('-v');
          break;
        case 'add':
          if (!name || !url) throw new Error('Name and URL required for adding remote');
          args.push('add', name, url);
          break;
        case 'remove':
          if (!name) throw new Error('Name required for removing remote');
          args.push('remove', name);
          break;
        default:
          throw new Error('Invalid remote action');
      }
      const { stdout } = await this._executeGitCommand(args);
      return { success: true, message: stdout };
    } catch (error) {
      throw new Error(`Failed to perform remote operation: ${error.message}`);
    }
  }

  async config(action = 'list', key = '', value = '') {
    try {
      const args = ['config'];
      switch (action) {
        case 'list':
          args.push('--list');
          break;
        case 'get':
          if (!key) throw new Error('Key required for getting config');
          args.push('--get', key);
          break;
        case 'set':
          if (!key || !value) throw new Error('Key and value required for setting config');
          args.push(key, value);
          break;
        default:
          throw new Error('Invalid config action');
      }
      const { stdout } = await this._executeGitCommand(args);
      return { success: true, message: stdout };
    } catch (error) {
      throw new Error(`Failed to perform config operation: ${error.message}`);
    }
  }

  async blame(file) {
    try {
      if (!file) throw new Error('File path required for blame');
      const { stdout } = await this._executeGitCommand(['blame', file]);
      return stdout;
    } catch (error) {
      throw new Error(`Failed to get blame information: ${error.message}`);
    }
  }

  async tag(action = 'list', tagName = '', message = '') {
    try {
      const args = ['tag'];
      switch (action) {
        case 'list':
          break;
        case 'create':
          if (!tagName) throw new Error('Tag name required for creating tag');
          args.push('-a', tagName, '-m', message || tagName);
          break;
        case 'delete':
          if (!tagName) throw new Error('Tag name required for deleting tag');
          args.push('-d', tagName);
          break;
        default:
          throw new Error('Invalid tag action');
      }
      const { stdout } = await this._executeGitCommand(args);
      return { success: true, message: stdout };
    } catch (error) {
      throw new Error(`Failed to perform tag operation: ${error.message}`);
    }
  }
}

export default GitManager;