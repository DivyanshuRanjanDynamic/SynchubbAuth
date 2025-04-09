class Chat {
    constructor(room) {
      this.room = room;
      this.messages = [];
      this.maxMessages = 100; // Keep last 100 messages
    }
  
    addMessage(peerId, message) {
      const messageObj = {
        id: Date.now(),
        peerId,
        message,
        timestamp: new Date().toISOString()
      };
  
      this.messages.push(messageObj);
  
      // Keep only the last maxMessages
      if (this.messages.length > this.maxMessages) {
        this.messages = this.messages.slice(-this.maxMessages);
      }
  
      return messageObj;
    }
  
    getMessages(limit = 50) {
      return this.messages.slice(-limit);
    }
  
    clearMessages() {
      this.messages = [];
    }
  }
  
  export default Chat;