class CodeCollaboration {
    constructor() {
      this.reviews = new Map(); // Map of fileId to review objects
      this.comments = new Map(); // Map of fileId to comment arrays
      this.threads = new Map(); // Map of commentId to reply arrays
      this.suggestions = new Map(); // Map of fileId to suggestion arrays
    }
  
    createReview(fileId, reviewData) {
      const reviewId = `${fileId}-${Date.now()}`;
      const review = {
        id: reviewId,
        fileId,
        status: 'open',
        ...reviewData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        comments: [],
        suggestions: [],
        resolution: null
      };
  
      this.reviews.set(reviewId, review);
      return review;
    }
  
    updateReviewStatus(reviewId, status, resolution = null) {
      const review = this.reviews.get(reviewId);
      if (!review) {
        throw new Error('Review not found');
      }
  
      review.status = status;
      review.updatedAt = new Date().toISOString();
      if (resolution) {
        review.resolution = resolution;
      }
  
      return review;
    }
  
    addComment(fileId, commentData) {
      const commentId = `${fileId}-${Date.now()}`;
      const comment = {
        id: commentId,
        fileId,
        ...commentData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        replies: []
      };
  
      if (!this.comments.has(fileId)) {
        this.comments.set(fileId, []);
      }
      this.comments.get(fileId).push(comment);
  
      // If comment is part of a review, add it to the review
      if (commentData.reviewId) {
        const review = this.reviews.get(commentData.reviewId);
        if (review) {
          review.comments.push(comment);
        }
      }
  
      return comment;
    }
  
    addReply(commentId, replyData) {
      const reply = {
        id: `${commentId}-${Date.now()}`,
        commentId,
        ...replyData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
  
      if (!this.threads.has(commentId)) {
        this.threads.set(commentId, []);
      }
      this.threads.get(commentId).push(reply);
  
      // Add reply to parent comment
      for (const comments of this.comments.values()) {
        const parentComment = comments.find(c => c.id === commentId);
        if (parentComment) {
          parentComment.replies.push(reply);
          break;
        }
      }
  
      return reply;
    }
  
    addSuggestion(fileId, suggestionData) {
      const suggestionId = `${fileId}-${Date.now()}`;
      const suggestion = {
        id: suggestionId,
        fileId,
        ...suggestionData,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
  
      if (!this.suggestions.has(fileId)) {
        this.suggestions.set(fileId, []);
      }
      this.suggestions.get(fileId).push(suggestion);
  
      // If suggestion is part of a review, add it to the review
      if (suggestionData.reviewId) {
        const review = this.reviews.get(suggestionData.reviewId);
        if (review) {
          review.suggestions.push(suggestion);
        }
      }
  
      return suggestion;
    }
  
    updateSuggestionStatus(suggestionId, status, resolution = null) {
      for (const suggestions of this.suggestions.values()) {
        const suggestion = suggestions.find(s => s.id === suggestionId);
        if (suggestion) {
          suggestion.status = status;
          suggestion.updatedAt = new Date().toISOString();
          if (resolution) {
            suggestion.resolution = resolution;
          }
          return suggestion;
        }
      }
      throw new Error('Suggestion not found');
    }
  
    getFileComments(fileId) {
      return this.comments.get(fileId) || [];
    }
  
    getCommentThread(commentId) {
      return this.threads.get(commentId) || [];
    }
  
    getFileSuggestions(fileId) {
      return this.suggestions.get(fileId) || [];
    }
  
    getFileReviews(fileId) {
      return Array.from(this.reviews.values()).filter(review => review.fileId === fileId);
    }
  
    deleteComment(commentId) {
      for (const [fileId, comments] of this.comments.entries()) {
        const index = comments.findIndex(c => c.id === commentId);
        if (index !== -1) {
          comments.splice(index, 1);
          // Clean up replies
          this.threads.delete(commentId);
          return true;
        }
      }
      return false;
    }
  
    deleteSuggestion(suggestionId) {
      for (const [fileId, suggestions] of this.suggestions.entries()) {
        const index = suggestions.findIndex(s => s.id === suggestionId);
        if (index !== -1) {
          suggestions.splice(index, 1);
          return true;
        }
      }
      return false;
    }
  
    deleteReview(reviewId) {
      const review = this.reviews.get(reviewId);
      if (!review) {
        return false;
      }
  
      // Delete associated comments and suggestions
      review.comments.forEach(comment => {
        this.deleteComment(comment.id);
      });
  
      review.suggestions.forEach(suggestion => {
        this.deleteSuggestion(suggestion.id);
      });
  
      return this.reviews.delete(reviewId);
    }
  
    clear() {
      this.reviews.clear();
      this.comments.clear();
      this.threads.clear();
      this.suggestions.clear();
    }
  }
  
  export default CodeCollaboration;