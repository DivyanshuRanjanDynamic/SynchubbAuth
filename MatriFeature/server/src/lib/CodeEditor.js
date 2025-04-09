import CodeExecutor from "./CodeExecutor.js";
import CodeCollaboration from "./CodeCollaboration.js";


class CodeEditor {
    constructor(room) {
      this.room = room;
      this.files = new Map(); // Map of fileId to file object
      this.cursors = new Map(); // Map of peerId to cursor position
      this.selections = new Map(); // Map of peerId to selection ranges
      this.maxFiles = 50;
      this.executor = new CodeExecutor();
      this.collaboration = new CodeCollaboration();
      this.supportedLanguages = [
        'javascript', 'python', 'java', 'cpp', 'ruby', 'php',
        'go', 'rust', 'typescript', 'html', 'css', 'sql'
      ];
    }
  
    createFile(peerId, fileInfo) {
      const fileId = `${peerId}-${Date.now()}`;
      const file = {
        id: fileId,
        name: fileInfo.name,
        language: fileInfo.language,
        content: fileInfo.content || '',
        createdBy: peerId,
        createdAt: new Date().toISOString(),
        lastModifiedBy: peerId,
        lastModifiedAt: new Date().toISOString(),
        version: 0,
        history: [],
        collaborators: new Set([peerId])
      };
  
      this.files.set(fileId, file);
  
      // Maintain maximum files limit
      if (this.files.size > this.maxFiles) {
        const oldestFile = Array.from(this.files.keys())[0];
        this.files.delete(oldestFile);
      }
  
      return file;
    }
  
    updateFile(fileId, peerId, changes) {
      const file = this.files.get(fileId);
      if (!file) {
        throw new Error('File not found');
      }
  
      if (!file.collaborators.has(peerId)) {
        throw new Error('Not authorized to edit this file');
      }
  
      // Save current version to history
      file.history.push({
        content: file.content,
        modifiedBy: peerId,
        timestamp: new Date().toISOString(),
        version: file.version,
        changes
      });
  
      // Keep history size in check (max 50 versions per file)
      if (file.history.length > 50) {
        file.history = file.history.slice(-50);
      }
  
      // Apply changes
      file.content = this.applyChanges(file.content, changes);
      file.version++;
      file.lastModifiedBy = peerId;
      file.lastModifiedAt = new Date().toISOString();
  
      return {
        file,
        changes
      };
    }
  
    applyChanges(content, changes) {
      // Sort changes by position in reverse order to apply from end to start
      const sortedChanges = [...changes].sort((a, b) => b.position - a.position);
  
      let newContent = content;
      for (const change of sortedChanges) {
        const before = newContent.slice(0, change.position);
        const after = newContent.slice(change.position + (change.deleted || 0));
        newContent = before + (change.inserted || '') + after;
      }
  
      return newContent;
    }
  
    updateCursor(fileId, peerId, position) {
      const file = this.files.get(fileId);
      if (!file) {
        throw new Error('File not found');
      }
  
      const cursorKey = `${fileId}-${peerId}`;
      this.cursors.set(cursorKey, {
        position,
        timestamp: new Date().toISOString()
      });
  
      return {
        fileId,
        peerId,
        position
      };
    }
  
    updateSelection(fileId, peerId, range) {
      const file = this.files.get(fileId);
      if (!file) {
        throw new Error('File not found');
      }
  
      const selectionKey = `${fileId}-${peerId}`;
      this.selections.set(selectionKey, {
        range,
        timestamp: new Date().toISOString()
      });
  
      return {
        fileId,
        peerId,
        range
      };
    }
  
    addCollaborator(fileId, peerId) {
      const file = this.files.get(fileId);
      if (!file) {
        throw new Error('File not found');
      }
  
      file.collaborators.add(peerId);
      return file;
    }
  
    removeCollaborator(fileId, peerId) {
      const file = this.files.get(fileId);
      if (!file) {
        throw new Error('File not found');
      }
  
      file.collaborators.delete(peerId);
      
      // Clean up cursor and selection
      const cursorKey = `${fileId}-${peerId}`;
      const selectionKey = `${fileId}-${peerId}`;
      this.cursors.delete(cursorKey);
      this.selections.delete(selectionKey);
  
      return file;
    }
  
    getFile(fileId) {
      const file = this.files.get(fileId);
      if (!file) {
        throw new Error('File not found');
      }
      return file;
    }
  
    getAllFiles() {
      return Array.from(this.files.values());
    }
  
    getFileHistory(fileId) {
      const file = this.files.get(fileId);
      if (!file) {
        throw new Error('File not found');
      }
      return file.history;
    }
  
    getCursors(fileId) {
      const cursors = new Map();
      for (const [key, value] of this.cursors.entries()) {
        if (key.startsWith(`${fileId}-`)) {
          const peerId = key.split('-')[1];
          cursors.set(peerId, value);
        }
      }
      return cursors;
    }
  
    getSelections(fileId) {
      const selections = new Map();
      for (const [key, value] of this.selections.entries()) {
        if (key.startsWith(`${fileId}-`)) {
          const peerId = key.split('-')[1];
          selections.set(peerId, value);
        }
      }
      return selections;
    }
  
    deleteFile(fileId, peerId) {
      const file = this.files.get(fileId);
      if (!file) {
        throw new Error('File not found');
      }
  
      if (file.createdBy !== peerId) {
        throw new Error('Not authorized to delete this file');
      }
  
      // Clean up related data
      for (const key of this.cursors.keys()) {
        if (key.startsWith(`${fileId}-`)) {
          this.cursors.delete(key);
        }
      }
  
      for (const key of this.selections.keys()) {
        if (key.startsWith(`${fileId}-`)) {
          this.selections.delete(key);
        }
      }
  
      return this.files.delete(fileId);
    }
   // Code execution methods
   async executeCode(fileId, input = '') {
    const file = this.files.get(fileId);
    if (!file) {
      throw new Error('File not found');
    }

    return await this.executor.executeCode(file.language, file.content, input);
  }

  // Code formatting methods
  async formatCode(fileId) {
    const file = this.files.get(fileId);
    if (!file) {
      throw new Error('File not found');
    }

    const formatted = await this.executor.formatCode(file.language, file.content);
    file.content = formatted;
    file.lastModifiedAt = new Date().toISOString();
    return formatted;
  }
  // Syntax highlighting
  highlightCode(fileId) {
    const file = this.files.get(fileId);
    if (!file) {
      throw new Error('File not found');
    }

    return this.executor.highlightCode(file.language, file.content);
  }
   // File import/export methods
   async importFile(filePath) {
    const fileInfo = await this.executor.importFile(filePath);
    return this.createFile('system', fileInfo);
  }

  async exportFile(fileId, filePath) {
    const file = this.files.get(fileId);
    if (!file) {
      throw new Error('File not found');
    }

    await this.executor.exportFile(filePath, file.content);
    return true;
  }
  // Code review methods
  createReview(fileId, reviewData) {
    const file = this.files.get(fileId);
    if (!file) {
      throw new Error('File not found');
    }

    return this.collaboration.createReview(fileId, reviewData);
  }

  updateReviewStatus(reviewId, status, resolution = null) {
    return this.collaboration.updateReviewStatus(reviewId, status, resolution);
  }
  addComment(fileId, commentData) {
    const file = this.files.get(fileId);
    if (!file) {
      throw new Error('File not found');
    }

    return this.collaboration.addComment(fileId, commentData);
  }

  addReply(commentId, replyData) {
    return this.collaboration.addReply(commentId, replyData);
  }

  addSuggestion(fileId, suggestionData) {
    const file = this.files.get(fileId);
    if (!file) {
      throw new Error('File not found');
    }

    return this.collaboration.addSuggestion(fileId, suggestionData);
  }


  updateSuggestionStatus(suggestionId, status, resolution = null) {
    return this.collaboration.updateSuggestionStatus(suggestionId, status, resolution);
  }

  getFileComments(fileId) {
    const file = this.files.get(fileId);
    if (!file) {
      throw new Error('File not found');
    }

    return this.collaboration.getFileComments(fileId);
  }

  getCommentThread(commentId) {
    return this.collaboration.getCommentThread(commentId);
  }

  getFileSuggestions(fileId) {
    const file = this.files.get(fileId);
    if (!file) {
      throw new Error('File not found');
    }

    return this.collaboration.getFileSuggestions(fileId);
  }
  getFileReviews(fileId) {
    const file = this.files.get(fileId);
    if (!file) {
      throw new Error('File not found');
    }

    return this.collaboration.getFileReviews(fileId);
  }

  deleteComment(commentId) {
    return this.collaboration.deleteComment(commentId);
  }

  deleteSuggestion(suggestionId) {
    return this.collaboration.deleteSuggestion(suggestionId);
  }

  deleteReview(reviewId) {
    return this.collaboration.deleteReview(reviewId);
  }
    clear() {
      this.files.clear();
      this.cursors.clear();
      this.selections.clear();
      this.collaboration.clear();
    }
  }
  
  export default CodeEditor;