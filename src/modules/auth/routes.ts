import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../../middleware/auth.js';
import { sendSuccess } from '../../utils/response.js';

export const authRouter = Router();

authRouter.get('/me', authenticateToken, (req: AuthenticatedRequest, res) => {
  sendSuccess(res, { user: req.user }, 'Current session profile');
});

authRouter.post('/logout', authenticateToken, (_req, res) => {
  sendSuccess(res, { loggedOut: true }, 'Successfully logged out');
});
