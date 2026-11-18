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
  isActive: boolean;
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
    if (process.env.NODE_ENV === 'test') {
      const mockRole = req.headers['x-mock-role'] as UserRole | undefined;
      const validRoles: UserRole[] = ['customer', 'mechanic', 'superadmin'];
      const role = mockRole && validRoles.includes(mockRole) ? mockRole : 'customer';
      req.user = {
        id: `usr_test_${role}`,
        email: `${role}@test.meltune.id`,
        fullName: role === 'customer' ? 'Test Customer' : role === 'mechanic' ? 'Test Mechanic' : 'Test Admin',
        role,
        phone: '+6281234567890',
        isActive: true,
      };
      return next();
    }
    sendError(res, 'Server authentication service not configured. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required.', 503, 'AUTH_SERVICE_UNAVAILABLE');
    return;
  }

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      sendError(res, 'Invalid or expired token', 401, 'TOKEN_INVALID');
      return;
    }

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, role, phone, is_active')
      .eq('id', user.id)
      .single();

    if (profileErr || !profile) {
      sendError(res, 'User profile not found', 403, 'PROFILE_NOT_FOUND');
      return;
    }

    if (!profile.is_active) {
      sendError(res, 'Account has been suspended. Please contact support.', 403, 'ACCOUNT_SUSPENDED');
      return;
    }

    req.user = {
      id: user.id,
      email: user.email || '',
      fullName: profile.full_name || '',
      role: profile.role as UserRole,
      phone: profile.phone,
      isActive: profile.is_active,
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
