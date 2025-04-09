import { v4 as uuidv4 } from 'uuid';


class FileShare {
  constructor(room) {
    this.room = room;
    this.files = new Map();
    this.maxFileSize = 100 * 1024 * 1024; // 100MB limit
    this.allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif',
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
  }

  validateFile(fileInfo) {
    if (fileInfo.size > this.maxFileSize) {
      throw new Error('File size exceeds limit');
    }
    if (!this.allowedTypes.includes(fileInfo.type)) {
      throw new Error('File type not allowed');
    }
  }

  addFile(peerId, fileInfo) {
    this.validateFile(fileInfo);

    const fileId = uuidv4();
    const file = {
      id: fileId,
      name: fileInfo.name,
      type: fileInfo.type,
      size: fileInfo.size,
      uploadedBy: peerId,
      uploadedAt: new Date().toISOString(),
      chunks: new Map(),
      isComplete: false
    };

    this.files.set(fileId, file);
    return fileId;
  }

  addChunk(fileId, chunkIndex, chunk) {
    const file = this.files.get(fileId);
    if (!file) {
      throw new Error('File not found');
    }

    file.chunks.set(chunkIndex, chunk);
  }

  markFileComplete(fileId) {
    const file = this.files.get(fileId);
    if (!file) {
      throw new Error('File not found');
    }

    file.isComplete = true;
    return file;
  }

  getFile(fileId) {
    const file = this.files.get(fileId);
    if (!file) {
      throw new Error('File not found');
    }
    return file;
  }

  getFilesList() {
    return Array.from(this.files.values())
      .filter(file => file.isComplete)
      .map(({ chunks, ...fileInfo }) => fileInfo);
  }

  removeFile(fileId) {
    const file = this.files.get(fileId);
    if (!file) {
      throw new Error('File not found');
    }
    this.files.delete(fileId);
    return true;
  }

  cleanup() {
    this.files.clear();
  }
}

export default FileShare;