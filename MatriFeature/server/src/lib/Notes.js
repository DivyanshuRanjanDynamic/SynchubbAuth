class Notes {
    constructor(room) {
      this.room = room;
      this.content = '';
      this.history = [];
      this.maxHistorySize = 50;
      this.editors = new Set();
      this.lastEdit = null;
    }
  
    addEditor(peerId) {
      this.editors.add(peerId);
    }
  
    removeEditor(peerId) {
      this.editors.delete(peerId);
    }
  
    isEditor(peerId) {
      return this.editors.has(peerId);
    }
  
    updateContent(peerId, newContent, delta) {
      if (!this.isEditor(peerId)) {
        throw new Error('Not authorized to edit notes');
      }
  
      // Save current state to history
      this.history.push({
        content: this.content,
        editedBy: peerId,
        timestamp: new Date().toISOString(),
        delta
      });
  
      // Keep history size in check
      if (this.history.length > this.maxHistorySize) {
        this.history = this.history.slice(-this.maxHistorySize);
      }
  
      this.content = newContent;
      this.lastEdit = {
        peerId,
        timestamp: new Date().toISOString()
      };
  
      return {
        content: this.content,
        editedBy: peerId,
        timestamp: this.lastEdit.timestamp,
        delta
      };
    }
  
    getContent() {
      return {
        content: this.content,
        lastEdit: this.lastEdit,
        editors: Array.from(this.editors)
      };
    }
  
    getHistory() {
      return this.history;
    }
  
    clear() {
      this.content = '';
      this.history = [];
      this.editors.clear();
      this.lastEdit = null;
    }
  }
  
 export default Notes;