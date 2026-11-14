import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { sendError } from '../utils/response.js';

export type UserRole = 'customer' | 'mechanic' | 'superadmin';

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  phone?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export async function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    sendError(res, 'Authentication token required', 401, 'UNAUTHORIZED');
    return;
  }

  if (!supabaseAdmin) {
    const mockUserMatch = req.headers['x-mock-role'] as UserRole | undefined;
    req.user = {
      id: 'usr_mock_user',
      email: mockUserMatch ? `${mockUserMatch}@torsi.id` : 'customer@torsi.id',
      fullName: mockUserMatch ? `TORSI ${mockUserMatch.toUpperCase()}` : 'Budi Santoso',
      role: mockUserMatch || 'customer',
      phone: '+6281234567890',
    };
    return next();
  }

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      sendError(res, 'Invalid or expired token', 401, 'TOKEN_INVALID');
      return;
    }

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, role, phone')
      .eq('id', user.id)
      .single();

    if (profileErr || !profile) {
      sendError(res, 'User profile not found', 403, 'PROFILE_NOT_FOUND');
      return;
    }

    req.user = {
      id: user.id,
      email: user.email || '',
      fullName: profile.full_name || '',
      role: profile.role as UserRole,
      phone: profile.phone,
    };

    next();
  } catch (err: any) {
    sendError(res, err.message || 'Authentication error', 500, 'AUTH_INTERNAL_ERROR');
  }
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 'User not authenticated', 401, 'UNAUTHORIZED');
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      sendError(res, `Forbidden: requires one of [${allowedRoles.join(', ')}] role`, 403, 'FORBIDDEN_ROLE');
      return;
    }

    next();
  };
}
