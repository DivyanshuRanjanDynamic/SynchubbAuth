import Joi from 'joi';
import { createError } from '../utils/error.js';

// Content validation schema
const contentSchema = Joi.object({
  type: Joi.string().valid('image', 'video', 'blog').required(),
  title: Joi.string().required().min(1).max(100),
  description: Joi.string().allow('').max(1000),
  content: Joi.when('type', {
    is: 'blog',
    then: Joi.string().required().min(1).max(50000),
    otherwise: Joi.string().allow('')
  }),
  tags: Joi.array().items(Joi.string().trim()).max(10),
  visibility: Joi.string().valid('public', 'followers', 'private').default('public')
});

// Comment validation schema
const commentSchema = Joi.object({
  content: Joi.string().required().min(1).max(1000)
});

// Share validation schema
const shareSchema = Joi.object({
  platform: Joi.string().valid('facebook', 'twitter', 'instagram', 'linkedin').required()
});

// Validation middleware
export const validateContent = (req, res, next) => {
  try {
    const { error } = contentSchema.validate(req.body, { abortEarly: false });
    if (error) {
      const errors = error.details.map(detail => detail.message);
      throw createError(400, 'Validation error', errors);
    }
    next();
  } catch (error) {
    next(error);
  }
};

export const validateComment = (req, res, next) => {
  try {
    const { error } = commentSchema.validate(req.body, { abortEarly: false });
    if (error) {
      const errors = error.details.map(detail => detail.message);
      throw createError(400, 'Validation error', errors);
    }
    next();
  } catch (error) {
    next(error);
  }
};

export const validateShare = (req, res, next) => {
  try {
    const { error } = shareSchema.validate(req.body, { abortEarly: false });
    if (error) {
      const errors = error.details.map(detail => detail.message);
      throw createError(400, 'Validation error', errors);
    }
    next();
  } catch (error) {
    next(error);
  }
}; 