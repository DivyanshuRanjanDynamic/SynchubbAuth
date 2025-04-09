import { webRtcTransport, router } from '../config/mediasoup.js';
import Chat from './chat.js';
import FileShare from './FileShare.js';
import Notes from './Notes.js';
import Whiteboard from './Whiteboard.js';
import Polls from './Poll,js';
import CodeEditor from './CodeEditor.js';
import GitHubSync from './GitHubSync.js';
import CodeManager from './CodeManager.js';

class Room {
    constructor(roomId, worker, io, workingDir) {
      this.id = roomId;
      this.worker = worker;
      this.io = io;
      this.router = null;
      this.peers = new Map();
      this.producers = new Map();
      this.consumers = new Map();
      this.chat = new Chat(this);
      this.files = new FileShare(this);
      this.notes = new Notes(this);
      this.whiteboard = new Whiteboard(this);
      this.polls = new Polls(this);
      this.codeEditor = new CodeEditor(this);
      this.githubSync = new GitHubSync(this);
      this.codeManager = new CodeManager(workingDir);
      this.createdAt = new Date().toISOString();
      this.lastActivity = new Date();
      this.recordings = new Map();
      this.isLocked = false;
      this.moderators = new Set();
      this.raisedHands = new Map();
      this.reactions = new Map();
      this.webhookUrl = process.env.WEBHOOK_URL || 'http://localhost:3000';
      this.webhookSecret = process.env.WEBHOOK_SECRET || 'your-webhook-secret';
    }

    async init() {
        this.router = await this.worker.createRouter({
          mediaCodecs: mediasoupConfig.router.mediaCodecs
        });
        return this.router;
      }
    
      addPeer(peerId, peer) {
        if (this.isLocked && !this.isModerator(peerId)) {
          throw new Error('Room is locked');
        }
    
        // If this is the first peer, make them a moderator
        if (this.peers.size === 0) {
          this.addModerator(peerId);
        }
    
        this.peers.set(peerId, {
          id: peerId,
          transports: new Map(),
          producers: new Map(),
          consumers: new Map(),
          joinedAt: new Date(),
          isMuted: false,
          isVideoOff: false,
          ...peer
        });
        this.updateActivity();
      }
    
      getPeer(peerId) {
        return this.peers.get(peerId);
      }
    
      removePeer(peerId) {
        const peer = this.peers.get(peerId);
        if (!peer) return;
    
        // Close all transports
        for (const transport of peer.transports.values()) {
          transport.close();
        }
    
        // Close all producers
        for (const producer of peer.producers.values()) {
          producer.close();
        }
    
        // Close all consumers
        for (const consumer of peer.consumers.values()) {
          consumer.close();
        }
    
        this.peers.delete(peerId);
    
        // Return true if room is empty
        return this.peers.size === 0;
      }
    
      async createWebRtcTransport(peerId, options = {}) {
        const transport = await this.router.createWebRtcTransport({
          ...mediasoupConfig.webRtcTransport,
          ...options
        });
    
        // Store transport
        const peer = this.getPeer(peerId);
        peer.transports.set(transport.id, transport);
    
        // Handle transport closure
        transport.on('routerclose', () => {
          transport.close();
          peer.transports.delete(transport.id);
        });
    
        return {
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters,
          sctpParameters: transport.sctpParameters
        };
      }
    
      async connectTransport(peerId, transportId, dtlsParameters) {
        const peer = this.getPeer(peerId);
        if (!peer) throw new Error(`Peer ${peerId} not found`);
    
        const transport = peer.transports.get(transportId);
        if (!transport) throw new Error(`Transport ${transportId} not found`);
    
        await transport.connect({ dtlsParameters });
        return transport;
      }
    
      async createProducer(peerId, transportId, kind, rtpParameters, options = {}) {
        const peer = this.getPeer(peerId);
        if (!peer) throw new Error(`Peer ${peerId} not found`);
    
        const transport = peer.transports.get(transportId);
        if (!transport) throw new Error(`Transport ${transportId} not found`);
    
        const producer = await transport.produce({
          kind,
          rtpParameters,
          ...options
        });
    
        // Store producer
        peer.producers.set(producer.id, producer);
        this.producers.set(producer.id, producer);
    
        // Handle producer closure
        producer.on('transportclose', () => {
          producer.close();
          peer.producers.delete(producer.id);
          this.producers.delete(producer.id);
        });
    
        return producer;
      }
    
      async createConsumer(consumerPeerId, producerPeerId, producerId, rtpCapabilities) {
        const consumerPeer = this.getPeer(consumerPeerId);
        if (!consumerPeer) throw new Error(`Consumer peer ${consumerPeerId} not found`);
    
        const producer = this.producers.get(producerId);
        if (!producer) throw new Error(`Producer ${producerId} not found`);
    
        // Check if consumer can consume the producer
        if (!this.router.canConsume({
          producerId: producer.id,
          rtpCapabilities
        })) {
          throw new Error(`Consumer peer ${consumerPeerId} cannot consume producer ${producerId}`);
        }
    
        // Get transport
        const transport = Array.from(consumerPeer.transports.values()).find(t => t.appData.consuming);
        if (!transport) throw new Error(`No receiving transport found for peer ${consumerPeerId}`);
    
        // Create consumer
        const consumer = await transport.consume({
          producerId: producer.id,
          rtpCapabilities,
          paused: true // We always start consumers paused
        });
    
        // Store consumer
        consumerPeer.consumers.set(consumer.id, consumer);
        this.consumers.set(consumer.id, consumer);
    
        // Handle consumer closure
        consumer.on('transportclose', () => {
          consumer.close();
          consumerPeer.consumers.delete(consumer.id);
          this.consumers.delete(consumer.id);
        });
    
        // Handle producer closure
        consumer.on('producerclose', () => {
          consumer.close();
          consumerPeer.consumers.delete(consumer.id);
          this.consumers.delete(consumer.id);
        });
    
        return {
          id: consumer.id,
          producerId: producer.id,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters,
          type: consumer.type,
          producerPaused: consumer.producerPaused
        };
      }
    
      async pauseConsumer(consumerId) {
        const consumer = this.consumers.get(consumerId);
        if (!consumer) throw new Error(`Consumer ${consumerId} not found`);
        await consumer.pause();
      }
    
      async resumeConsumer(consumerId) {
        const consumer = this.consumers.get(consumerId);
        if (!consumer) throw new Error(`Consumer ${consumerId} not found`);
        await consumer.resume();
      }
    
      closeAll() {
        // Close all peers
        for (const peer of this.peers.values()) {
          this.removePeer(peer.id);
        }
    
        // Clear all files
        this.files.cleanup();
    
        // Clear all recordings
        this.recordings.clear();
    
        // Close router
        if (this.router) {
          this.router.close();
        }
      }
    
      updateActivity() {
        this.lastActivity = new Date();
      }
    
      getStats() {
        return {
          id: this.id,
          numPeers: this.peers.size,
          createdAt: this.createdAt,
          lastActivity: this.lastActivity,
          isLocked: this.isLocked,
          moderators: Array.from(this.moderators),
          peers: Array.from(this.peers.values()).map(peer => ({
            id: peer.id,
            joinedAt: peer.joinedAt,
            producers: peer.producers.size,
            consumers: peer.consumers.size,
            isMuted: peer.isMuted,
            isVideoOff: peer.isVideoOff,
            isModerator: this.isModerator(peer.id)
          })),
          files: this.getFiles(),
          numRecordings: this.recordings.size
        };
      }
    
      addChatMessage(peerId, message) {
        this.updateActivity();
        return this.chat.addMessage(peerId, message);
      }
    
      getChatMessages(limit) {
        return this.chat.getMessages(limit);
      }
    
      // Recording methods
      startRecording(peerId) {
        if (this.recordings.has(peerId)) {
          throw new Error('Recording already in progress');
        }
    
        const recording = {
          startTime: new Date(),
          chunks: [],
          status: 'recording'
        };
    
        this.recordings.set(peerId, recording);
        return recording;
      }
    
      addRecordingChunk(peerId, chunk) {
        const recording = this.recordings.get(peerId);
        if (!recording) {
          throw new Error('No recording in progress');
        }
    
        recording.chunks.push(chunk);
      }
    
      stopRecording(peerId) {
        const recording = this.recordings.get(peerId);
        if (!recording) {
          throw new Error('No recording in progress');
        }
    
        recording.status = 'completed';
        recording.endTime = new Date();
        return recording;
      }
    
      getRecording(peerId) {
        const recording = this.recordings.get(peerId);
        if (!recording) {
          throw new Error('Recording not found');
        }
        return recording;
      }
    
      // Room moderation methods
      lockRoom() {
        this.isLocked = true;
      }
    
      unlockRoom() {
        this.isLocked = false;
      }
    
      addModerator(peerId) {
        this.moderators.add(peerId);
      }
    
      removeModerator(peerId) {
        this.moderators.delete(peerId);
      }
    
      isModerator(peerId) {
        return this.moderators.has(peerId);
      }
    
      // Peer management methods
      mutePeer(peerId) {
        const peer = this.getPeer(peerId);
        if (!peer) return;
    
        for (const producer of peer.producers.values()) {
          if (producer.kind === 'audio') {
            producer.pause();
          }
        }
      }
    
      unmutePeer(peerId) {
        const peer = this.getPeer(peerId);
        if (!peer) return;
    
        for (const producer of peer.producers.values()) {
          if (producer.kind === 'audio') {
            producer.resume();
          }
        }
      }
    
      kickPeer(peerId) {
        const peer = this.getPeer(peerId);
        if (!peer) return;
    
        // Close all connections
        this.removePeer(peerId);
        
        // Notify the peer
        peer.socket.emit('kicked');
        peer.socket.disconnect(true);
      }
    
      // File sharing methods
      addFile(peerId, fileInfo) {
        this.updateActivity();
        return this.files.addFile(peerId, fileInfo);
      }
    
      addFileChunk(fileId, chunkIndex, chunk) {
        return this.files.addChunk(fileId, chunkIndex, chunk);
      }
    
      completeFile(fileId) {
        return this.files.markFileComplete(fileId);
      }
    
      getFiles() {
        return this.files.getFilesList();
      }
    
      removeFile(fileId) {
        return this.files.removeFile(fileId);
      }
    
      // Notes methods
      updateNotes(peerId, content) {
        if (!this.peers.has(peerId)) {
          throw new Error('Peer not found');
        }
        return this.notes.updateContent(peerId, content);
      }
    
      getNotes() {
        return this.notes.getContent();
      }
    
      getNotesHistory() {
        return this.notes.getHistory();
      }
    
      clearNotes() {
        return this.notes.clear();
      }
    
      // Whiteboard methods
      startStroke(peerId, startPoint, style) {
        if (!this.peers.has(peerId)) {
          throw new Error('Peer not found');
        }
        return this.whiteboard.startStroke(peerId, startPoint, style);
      }
    
      addStrokePoint(peerId, point) {
        if (!this.peers.has(peerId)) {
          throw new Error('Peer not found');
        }
        return this.whiteboard.addPoint(peerId, point);
      }
    
      endStroke(peerId) {
        if (!this.peers.has(peerId)) {
          throw new Error('Peer not found');
        }
        return this.whiteboard.endStroke(peerId);
      }
    
      addShape(peerId, shape) {
        if (!this.peers.has(peerId)) {
          throw new Error('Peer not found');
        }
        return this.whiteboard.addShape(peerId, shape);
      }
    
      addText(peerId, textObj) {
        if (!this.peers.has(peerId)) {
          throw new Error('Peer not found');
        }
        return this.whiteboard.addText(peerId, textObj);
      }
    
      undoWhiteboard(peerId) {
        if (!this.peers.has(peerId)) {
          throw new Error('Peer not found');
        }
        return this.whiteboard.undo(peerId);
      }
    
      clearWhiteboard() {
        return this.whiteboard.clear();
      }
    
      getWhiteboardState() {
        return this.whiteboard.getState();
      }
    
      // Polls methods
      createPoll(peerId, pollData) {
        if (!this.peers.has(peerId)) {
          throw new Error('Peer not found');
        }
        return this.polls.createPoll(peerId, pollData);
      }
    
      vote(pollId, peerId, optionIds) {
        if (!this.peers.has(peerId)) {
          throw new Error('Peer not found');
        }
        return this.polls.vote(pollId, peerId, optionIds);
      }
    
      closePoll(pollId) {
        return this.polls.closePoll(pollId);
      }
    
      getPoll(pollId) {
        return this.polls.getPoll(pollId);
      }
    
      getActivePolls() {
        return this.polls.getActivePolls();
      }
    
      getAllPolls() {
        return this.polls.getAllPolls();
      }
    
      deletePoll(pollId) {
        return this.polls.deletePoll(pollId);
      }
    
      // Code Editor methods
      createCodeFile(peerId, fileInfo) {
        if (!this.peers.has(peerId)) {
          throw new Error('Peer not found');
        }
        return this.codeEditor.createFile(peerId, fileInfo);
      }
    
      updateCodeFile(fileId, peerId, changes) {
        if (!this.peers.has(peerId)) {
          throw new Error('Peer not found');
        }
        return this.codeEditor.updateFile(fileId, peerId, changes);
      }
    
      updateCursor(fileId, peerId, position) {
        if (!this.peers.has(peerId)) {
          throw new Error('Peer not found');
        }
        return this.codeEditor.updateCursor(fileId, peerId, position);
      }
    
      updateSelection(fileId, peerId, range) {
        if (!this.peers.has(peerId)) {
          throw new Error('Peer not found');
        }
        return this.codeEditor.updateSelection(fileId, peerId, range);
      }
    
      addCodeCollaborator(fileId, peerId) {
        if (!this.peers.has(peerId)) {
          throw new Error('Peer not found');
        }
        return this.codeEditor.addCollaborator(fileId, peerId);
      }
    
      removeCodeCollaborator(fileId, peerId) {
        if (!this.peers.has(peerId)) {
          throw new Error('Peer not found');
        }
        return this.codeEditor.removeCollaborator(fileId, peerId);
      }
    
      getCodeFile(fileId) {
        return this.codeEditor.getFile(fileId);
      }
    
      getAllCodeFiles() {
        return this.codeEditor.getAllFiles();
      }
    
      getCodeFileHistory(fileId) {
        return this.codeEditor.getFileHistory(fileId);
      }
    
      getCodeCursors(fileId) {
        return this.codeEditor.getCursors(fileId);
      }
    
      getCodeSelections(fileId) {
        return this.codeEditor.getSelections(fileId);
      }
    
      deleteCodeFile(fileId, peerId) {
        if (!this.peers.has(peerId)) {
          throw new Error('Peer not found');
        }
        return this.codeEditor.deleteFile(fileId, peerId);
      }
    
      // New code execution methods
      async executeCode(fileId, peerId, input = '') {
        if (!this.peers.has(peerId)) {
          throw new Error('Peer not found');
        }
        return await this.codeEditor.executeCode(fileId, input);
      }
    
      async formatCode(fileId, peerId) {
        if (!this.peers.has(peerId)) {
          throw new Error('Peer not found');
        }
        return await this.codeEditor.formatCode(fileId);
      }
    
      highlightCode(fileId, peerId) {
        if (!this.peers.has(peerId)) {
          throw new Error('Peer not found');
        }
        return this.codeEditor.highlightCode(fileId);
      }
    
      async importFile(peerId, filePath) {
        if (!this.peers.has(peerId)) {
          throw new Error('Peer not found');
        }
        return await this.codeEditor.importFile(filePath);
      }
    
      async exportFile(fileId, peerId, filePath) {
        if (!this.peers.has(peerId)) {
          throw new Error('Peer not found');
        }
        return await this.codeEditor.exportFile(fileId, filePath);
      }
    
      // Code review methods
      createCodeReview(fileId, peerId, reviewData) {
        if (!this.peers.has(peerId)) {
          throw new Error('Peer not found');
        }
        return this.codeEditor.createReview(fileId, reviewData);
      }
    
      updateCodeReviewStatus(reviewId, peerId, status, resolution = null) {
        if (!this.peers.has(peerId)) {
          throw new Error('Peer not found');
        }
        return this.codeEditor.updateReviewStatus(reviewId, status, resolution);
      }
    
      addCodeComment(fileId, peerId, commentData) {
        if (!this.peers.has(peerId)) {
          throw new Error('Peer not found');
        }
        return this.codeEditor.addComment(fileId, commentData);
      }
    
      addCommentReply(commentId, peerId, replyData) {
        if (!this.peers.has(peerId)) {
          throw new Error('Peer not found');
        }
        return this.codeEditor.addReply(commentId, replyData);
      }
    
      addCodeSuggestion(fileId, peerId, suggestionData) {
        if (!this.peers.has(peerId)) {
          throw new Error('Peer not found');
        }
        return this.codeEditor.addSuggestion(fileId, suggestionData);
      }
    
      updateCodeSuggestionStatus(suggestionId, peerId, status, resolution = null) {
        if (!this.peers.has(peerId)) {
          throw new Error('Peer not found');
        }
        return this.codeEditor.updateSuggestionStatus(suggestionId, status, resolution);
      }
    
      getCodeFileComments(fileId) {
        return this.codeEditor.getFileComments(fileId);
      }
    
      getCodeCommentThread(commentId) {
        return this.codeEditor.getCommentThread(commentId);
      }
    
      getCodeFileSuggestions(fileId) {
        return this.codeEditor.getFileSuggestions(fileId);
      }
    
      getCodeFileReviews(fileId) {
        return this.codeEditor.getFileReviews(fileId);
      }
    
      deleteCodeComment(commentId, peerId) {
        if (!this.peers.has(peerId)) {
          throw new Error('Peer not found');
        }
        return this.codeEditor.deleteComment(commentId);
      }
    
      deleteCodeSuggestion(suggestionId, peerId) {
        if (!this.peers.has(peerId)) {
          throw new Error('Peer not found');
        }
        return this.codeEditor.deleteSuggestion(suggestionId);
      }
    
      deleteCodeReview(reviewId, peerId) {
        if (!this.peers.has(peerId)) {
          throw new Error('Peer not found');
        }
        return this.codeEditor.deleteReview(reviewId);
      }
    
      // New hand raising and reaction methods
      raiseHand(peerId) {
        if (!this.peers.has(peerId)) {
          throw new Error('Peer not found');
        }
        this.raisedHands.set(peerId, Date.now());
        this.updateActivity();
        return {
          peerId,
          timestamp: this.raisedHands.get(peerId)
        };
      }
    
      lowerHand(peerId) {
        if (!this.peers.has(peerId)) {
          throw new Error('Peer not found');
        }
        const wasRaised = this.raisedHands.has(peerId);
        this.raisedHands.delete(peerId);
        this.updateActivity();
        return wasRaised;
      }
    
      getRaisedHands() {
        return Array.from(this.raisedHands.entries()).map(([peerId, timestamp]) => ({
          peerId,
          timestamp
        }));
      }
    
      addReaction(peerId, reaction) {
        if (!this.peers.has(peerId)) {
          throw new Error('Peer not found');
        }
    
        // Validate reaction type
        const validReactions = ['👍', '👏', '❤️', '😂', '✋', '🎉', '👋', '🤔'];
        if (!validReactions.includes(reaction)) {
          throw new Error('Invalid reaction type');
        }
    
        const reactionObj = {
          id: `reaction_${Date.now()}`,
          peerId,
          reaction,
          timestamp: Date.now()
        };
    
        this.reactions.set(reactionObj.id, reactionObj);
        this.updateActivity();
    
        // Clean up old reactions (older than 10 seconds)
        const tenSecondsAgo = Date.now() - 10000;
        for (const [id, reaction] of this.reactions.entries()) {
          if (reaction.timestamp < tenSecondsAgo) {
            this.reactions.delete(id);
          }
        }
    
        return reactionObj;
      }
    
      getReactions() {
        return Array.from(this.reactions.values());
      }
    
      // GitHub Integration Methods
      async initializeGitHub(config) {
        await this.githubSync.initialize(config);
      }
    
      async addGitHubRepository(owner, repo) {
        return await this.githubSync.addRepository(owner, repo);
      }
    
      async removeGitHubRepository(owner, repo) {
        return await this.githubSync.removeRepository(owner, repo);
      }
    
      async syncGitHubIssues(owner, repo) {
        return await this.githubSync.syncIssues(owner, repo);
      }
    
      async createGitHubIssue(owner, repo, data) {
        return await this.githubSync.createIssue(owner, repo, data);
      }
    
      async updateGitHubIssue(owner, repo, issueNumber, data) {
        return await this.githubSync.updateIssue(owner, repo, issueNumber, data);
      }
    
      async syncGitHubProjects(owner, repo) {
        return await this.githubSync.syncProjects(owner, repo);
      }
    
      async createGitHubProject(owner, repo, data) {
        return await this.githubSync.createProject(owner, repo, data);
      }
    
      async syncGitHubMilestones(owner, repo) {
        return await this.githubSync.syncMilestones(owner, repo);
      }
    
      async migrateGitHubMilestone(sourceOwner, sourceRepo, milestoneNumber, targetOwner, targetRepo) {
        return await this.githubSync.migrateMilestone(
          sourceOwner,
          sourceRepo,
          milestoneNumber,
          targetOwner,
          targetRepo
        );
      }
    
      async getGitHubContributions(owner, repo, since) {
        return await this.githubSync.getContributions(owner, repo, since);
      }
    
      async searchGitHubIssues(query, filters) {
        return await this.githubSync.searchIssues(query, filters);
      }
    
      handleGitHubWebhook(event, payload) {
        this.githubSync.handleWebhookEvent(event, payload);
      }
    
      // Override the existing close method to include GitHub cleanup
      close() {
        this.githubSync.clear();
        this.notes.clear();
        this.whiteboard.clear();
        this.polls.clear();
        this.files.clear();
        this.codeEditor.clear();
        this.closeAll();
      }
    
      // Code Editor Methods
      async openDocument(filename) {
        return await this.codeManager.openDocument(filename);
      }
    
      async saveDocument(filename, content) {
        await this.codeManager.saveDocument(filename, content);
      }
    
      async updateDocument(filename, content, version) {
        await this.codeManager.updateDocument(filename, content, version);
      }
    
      async formatDocument(filename) {
        return await this.codeManager.formatDocument(filename);
      }
    
      async lintDocument(filename) {
        return await this.codeManager.lintDocument(filename);
      }
    
      async runCode(filename) {
        return await this.codeManager.runCode(filename);
      }
    
      async debugCode(filename) {
        return await this.codeManager.debugCode(filename);
      }
    
      closeDocument(filename) {
        this.codeManager.closeDocument(filename);
      }
    }
    
    export default  Room; 