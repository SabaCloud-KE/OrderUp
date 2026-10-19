import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/app-error';
import { logger } from '../../config/logger';

export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (err instanceof AppError) {
    logger.warn(`AppError [${err.code}]: ${err.message}`);
    res.status(err.statusCode).json({
      success: false,
      data: null,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  // Handle Payload Too Large from express body-parser
  if (err.type === 'entity.too.large' || err.status === 413 || err.statusCode === 413) {
    logger.warn(`PayloadTooLarge: ${err.message}`);
    res.status(413).json({
      success: false,
      data: null,
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'The uploaded file or request payload is too large. Please use an image under 10MB.',
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  // Handle malformed JSON
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      success: false,
      data: null,
      error: {
        code: 'BAD_REQUEST',
        message: 'Malformed JSON payload in request body.',
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  // Handle Prisma Unique Constraint Violations (P2002)
  if (err.code === 'P2002') {
    const fields = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : (err.meta?.target || 'field');
    res.status(409).json({
      success: false,
      data: null,
      error: {
        code: 'CONFLICT',
        message: `A record with this ${fields} already exists. Please choose a different value.`,
        details: err.message,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  // Handle Prisma Client Validation Errors (e.g. unknown argument or invalid schema properties)
  if (err.name === 'PrismaClientValidationError' || (typeof err.message === 'string' && err.message.includes('invocation:'))) {
    const rawMsg = String(err.message || '');
    logger.warn(`PrismaClientValidationError: ${rawMsg.slice(0, 300)}`);

    // Extract the helpful descriptive error line (after the invocation query block)
    const lines = rawMsg.split('\n').map(l => l.trim()).filter(Boolean);
    const nonInvocationLines = lines.filter(l => !l.startsWith('Invalid `') && !l.startsWith('{') && !l.startsWith('}') && !l.includes('where:') && !l.includes('data:'));
    const cleanReason = (nonInvocationLines.length > 0 ? nonInvocationLines[nonInvocationLines.length - 1] : 'Database query validation failed.')
      .replace(/data:image\/[a-zA-Z0-9+.-]+;base64,[a-zA-Z0-9+/=]+/g, '[image data]');

    res.status(400).json({
      success: false,
      data: null,
      error: {
        code: 'VALIDATION_ERROR',
        message: cleanReason,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  // Handle Invalid role validation errors
  if (err.message && err.message.startsWith('Invalid role')) {
    res.status(400).json({
      success: false,
      data: null,
      error: {
        code: 'INVALID_ROLE',
        message: err.message,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  // Handle unreachable database (e.g., PostgreSQL not running locally)
  if (err.message && (err.message.includes("Can't reach database server") || err.code === 'P1001')) {
    logger.warn(`DatabaseConnectionError: Cannot reach database server at ${err.message}`);
    res.status(503).json({
      success: false,
      data: null,
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Cannot reach database server at localhost:5432. Please ensure PostgreSQL is running or click "Switch to Cloud" in the portal.',
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  // Sanitize any large base64 data URLs from error logs and response
  const rawMsg = String(err.message || 'An unexpected internal error occurred.');
  const sanitizedMsg = rawMsg.replace(/data:image\/[a-zA-Z0-9+.-]+;base64,[a-zA-Z0-9+/=]+/g, '[image data]');
  logger.error(`Unhandled Exception: ${sanitizedMsg.slice(0, 500)}`, { stack: err.stack });

  res.status(500).json({
    success: false,
    data: null,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: sanitizedMsg.length > 500 ? sanitizedMsg.slice(0, 500) + '...' : sanitizedMsg,
      details: sanitizedMsg.length > 500 ? sanitizedMsg.slice(0, 500) + '...' : sanitizedMsg,
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
};
