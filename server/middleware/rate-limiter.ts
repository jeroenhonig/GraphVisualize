
import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

// General API rate limiter
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: 15 * 60, // 15 minutes in seconds
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many requests',
      message: 'You have exceeded the rate limit. Please try again later.',
      retryAfter: Math.round(req.rateLimit.resetTime / 1000),
    });
  },
});

// Stricter rate limiter for file uploads
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 uploads per hour
  message: {
    error: 'Too many file uploads from this IP, please try again later.',
    retryAfter: 60 * 60, // 1 hour in seconds
  },
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Upload rate limit exceeded',
      message: 'You have exceeded the file upload rate limit. Please try again later.',
      retryAfter: Math.round(req.rateLimit.resetTime / 1000),
    });
  },
});

// Rate limiter for code review API
export const codeReviewLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // limit each IP to 5 code reviews per hour
  message: {
    error: 'Too many code review requests from this IP, please try again later.',
    retryAfter: 60 * 60, // 1 hour in seconds
  },
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Code review rate limit exceeded',
      message: 'You have exceeded the code review rate limit. Please try again later.',
      retryAfter: Math.round(req.rateLimit.resetTime / 1000),
    });
  },
});
