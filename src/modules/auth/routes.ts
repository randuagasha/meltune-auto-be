import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../../middleware/auth.js';
import { supabaseAdmin } from '../../config/supabase.js';
import { sendSuccess, sendError } from '../../utils/response.js';

export const authRouter = Router();

authRouter.get('/me', authenticateToken, (req: AuthenticatedRequest, res) => {
  sendSuccess(res, { user: req.user }, 'Current session profile');
});

authRouter.post('/logout', authenticateToken, (_req, res) => {
  sendSuccess(res, { loggedOut: true }, 'Successfully logged out');
});

const handleUpdateProfile = async (req: AuthenticatedRequest, res: any) => {
  if (!supabaseAdmin) {
    sendError(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
    return;
  }
  const { fullName, phone } = req.body;
  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (fullName !== undefined) updates.full_name = fullName;
  if (phone !== undefined) updates.phone = phone;

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update(updates)
    .eq('id', req.user!.id)
    .select('id, full_name, phone, role, is_active, created_at')
    .single();

  if (error) {
    sendError(res, error.message, 500, 'DB_ERROR');
    return;
  }

  // Also sync with auth.users user_metadata for persistent auth sessions
  try {
    const { data: userRecord } = await supabaseAdmin.auth.admin.getUserById(req.user!.id);
    if (userRecord?.user) {
      await supabaseAdmin.auth.admin.updateUserById(req.user!.id, {
        user_metadata: {
          ...userRecord.user.user_metadata,
          full_name: fullName !== undefined ? fullName : userRecord.user.user_metadata?.full_name,
          phone: phone !== undefined ? phone : userRecord.user.user_metadata?.phone,
        },
      });
    }
  } catch (metaErr) {
    console.warn('Failed to sync auth user_metadata:', metaErr);
  }

  sendSuccess(res, {
    id: data.id,
    fullName: data.full_name,
    phone: data.phone,
    role: data.role,
    isActive: data.is_active,
    createdAt: data.created_at,
  }, 'Profil berhasil diperbarui');
};

authRouter.post('/profile', authenticateToken, handleUpdateProfile);
authRouter.put('/profile', authenticateToken, handleUpdateProfile);
authRouter.patch('/profile', authenticateToken, handleUpdateProfile);
