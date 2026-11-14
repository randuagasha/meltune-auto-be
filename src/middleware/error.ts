import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response.js';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  console.error('Unhandled server error:', err);
  const status = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';
  sendError(res, message, status, 'INTERNAL_ERROR');
}
