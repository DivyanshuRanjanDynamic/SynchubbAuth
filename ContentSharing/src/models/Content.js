import mongoose from 'mongoose';

const contentSchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['image', 'video', 'blog'],
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  mediaUrl: {
    type: String,
    required: function() {
      return this.type === 'image' || this.type === 'video';
    }
  },
  thumbnailUrl: {
    type: String,
    required: function() {
      return this.type === 'video';
    }
  },
  content: {
    type: String,
    required: function() {
      return this.type === 'blog';
    }
  },
  tags: [{
    type: String,
    trim: true
  }],
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    content: {
      type: String,
      required: true,
      trim: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  shares: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    platform: {
      type: String,
      enum: ['facebook', 'twitter', 'instagram', 'linkedin'],
      required: true
    },
    sharedAt: {
      type: Date,
      default: Date.now
    }
  }],
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'published'
  },
  visibility: {
    type: String,
    enum: ['public', 'followers', 'private'],
    default: 'public'
  },
  metadata: {
    width: Number,
    height: Number,
    duration: Number, // for videos
    size: Number,
    format: String,
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number],
        default: undefined
      }
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
contentSchema.index({ author: 1, createdAt: -1 });
contentSchema.index({ type: 1, status: 1 });
contentSchema.index({ tags: 1 });
contentSchema.index({ 'metadata.location': '2dsphere' });

// Virtual for like count
contentSchema.virtual('likeCount').get(function() {
  return this.likes.length;
});

// Virtual for comment count
contentSchema.virtual('commentCount').get(function() {
  return this.comments.length;
});

// Virtual for share count
contentSchema.virtual('shareCount').get(function() {
  return this.shares.length;
});

// Method to check if a user has liked the content
contentSchema.methods.hasLiked = function(userId) {
  return this.likes.includes(userId);
};

// Method to add a like
contentSchema.methods.addLike = function(userId) {
  if (!this.hasLiked(userId)) {
    this.likes.push(userId);
    return true;
  }
  return false;
};

// Method to remove a like
contentSchema.methods.removeLike = function(userId) {
  const index = this.likes.indexOf(userId);
  if (index > -1) {
    this.likes.splice(index, 1);
    return true;
  }
  return false;
};

// Method to add a comment
contentSchema.methods.addComment = function(userId, content) {
  this.comments.push({
    user: userId,
    content,
    createdAt: new Date()
  });
};

// Method to add a share
contentSchema.methods.addShare = function(userId, platform) {
  this.shares.push({
    user: userId,
    platform,
    sharedAt: new Date()
  });
};

const Content = mongoose.model('Content', contentSchema);

export default Content; 