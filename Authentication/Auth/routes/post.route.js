import express from 'express';
import Post from '../model/Post.model.js';
import { User } from '../model/user.model.js';
import mongoose from 'mongoose';
import { verifyJWT } from '../middleware/auth.middleware.js';

const router = express.Router();

// Create a new post
router.post('/', verifyJWT, async (req, res) => {
  try {
    const { title, content, category, tags, image } = req.body;
    const post = new Post({
      title,
      content,
      category,
      tags,
      image,
      author: req.user._id
    });
    await post.save();
    res.status(201).json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all posts
router.get('/', async (req, res) => {
  try {
    const posts = await Post.find().populate('author', 'username profilePic').sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// // Get a single post by ID
 router.get('/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).populate('author', 'username profilePic');     if (!post) return res.status(404).json({ error: 'Post not found' });
     res.json(post);
   } catch (err) {
    res.status(500).json({ error: err.message });
   }
 });

// Get all posts by a user
router.get('/user/:userId', async (req, res) => {
  try {
    const posts = await Post.find({ author: req.params.userId }).sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a comment to a post
router.post('/:id/comments', verifyJWT, async (req, res) => {
  try {
    const { text } = req.body;
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    post.comments.push({ author: req.user._id, text });
    await post.save();
    res.status(201).json(post.comments[post.comments.length - 1]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save a post to the user's profile
router.post('/save/:postId', verifyJWT, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.savedPosts.includes(req.params.postId)) {
      user.savedPosts.push(req.params.postId);
      await user.save();
    }
    res.json({ message: 'Post saved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all saved posts for the logged-in user
router.get('/saved', verifyJWT, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate({
      path: 'savedPosts',
      populate: { path: 'author', select: 'username profilePic' }
    });
    res.json(user.savedPosts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Edit a post (only by author)
router.put('/:id', verifyJWT, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to edit this post' });
    }
    const { title, content, category, tags, image } = req.body;
    if (title !== undefined) post.title = title;
    if (content !== undefined) post.content = content;
    if (category !== undefined) post.category = category;
    if (tags !== undefined) post.tags = tags;
    if (image !== undefined) post.image = image;
    post.updatedAt = Date.now();
    await post.save();
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a post (only by author)
router.delete('/:id', verifyJWT, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to delete this post' });
    }
    await post.deleteOne();
    res.json({ message: 'Post deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a like/unlike endpoint
router.post('/:id/like', verifyJWT, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    const userId = req.user._id;
    const liked = post.likes.some(id => id.toString() === userId.toString());
    if (liked) {
      // Unlike
      post.likes = post.likes.filter(id => id.toString() !== userId.toString());
    } else {
      // Like
      post.likes.push(userId);
    }
    await post.save();
    res.json({ liked: !liked, likesCount: post.likes.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Edit a comment on a post
router.patch('/:postId/comments/:commentId', verifyJWT, async (req, res) => {
  try {
    const { text } = req.body;
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    const comment = post.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    if (comment.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to edit this comment' });
    }
    comment.text = text;
    await post.save();
    res.json(comment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a comment on a post
router.delete('/:postId/comments/:commentId', verifyJWT, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    const comment = post.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    if (comment.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to delete this comment' });
    }
    comment.remove();
    await post.save();
    res.json({ message: 'Comment deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;