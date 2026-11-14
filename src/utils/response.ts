import { Response } from 'express';

export interface ApiResponse<T = any> {
  status: 'success' | 'error';
  message?: string;
  data?: T;
  code?: string;
  meta?: Record<string, any>;
}

export function sendSuccess<T>(res: Response, data: T, message?: string, statusCode = 200, meta?: Record<string, any>) {
  return res.status(statusCode).json({
    status: 'success',
    ...(message ? { message } : {}),
    data,
    ...(meta ? { meta } : {}),
  } satisfies ApiResponse<T>);
}

export function sendError(res: Response, message: string, statusCode = 400, code?: string) {
  return res.status(statusCode).json({
    status: 'error',
    message,
    ...(code ? { code } : {}),
  } satisfies ApiResponse);
}
