import { Router } from 'express';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../../middleware/auth.js';
import { supabaseAdmin } from '../../config/supabase.js';
import { sendSuccess, sendError } from '../../utils/response.js';

export const loyaltyRouter = Router();

loyaltyRouter.use(authenticateToken);

loyaltyRouter.get('/profile', async (req: AuthenticatedRequest, res) => {
  if (!supabaseAdmin) {
    sendError(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
    return;
  }
  const userId = req.user!.id;

  const { data: account, error: accErr } = await supabaseAdmin
    .from('loyalty_accounts')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (accErr || !account) {
    sendError(res, 'Data loyalitas tidak ditemukan', 404, 'NOT_FOUND');
    return;
  }

  const { data: redemptions } = await supabaseAdmin
    .from('reward_redemptions')
    .select('id, reward_id, rewards(title), points_spent, redemption_code, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  const profile = {
    userId: account.user_id,
    points: account.points,
    currentStreak: account.current_streak,
    longestStreak: account.longest_streak,
    lastCheckInDate: account.last_check_in_date,
    redemptionHistory: (redemptions || []).map((r: any) => ({
      id: r.id,
      rewardId: r.reward_id,
      rewardTitle: r.rewards?.title || r.reward_id,
      pointsSpent: r.points_spent,
      redeemedAt: r.created_at,
      code: r.redemption_code,
    })),
  };

  sendSuccess(res, profile, 'Data loyalitas pelanggan');
});

loyaltyRouter.get('/rewards', async (_req, res) => {
  if (!supabaseAdmin) {
    sendError(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
    return;
  }
  const { data, error } = await supabaseAdmin
    .from('rewards')
    .select('*')
    .eq('is_active', true)
    .order('points_cost');
  if (error) {
    sendError(res, error.message, 500, 'DB_ERROR');
    return;
  }
  const mapped = (data || []).map(r => ({
    id: r.id,
    title: r.title,
    description: r.description,
    pointsCost: r.points_cost,
    stock: r.stock,
    imageUrl: r.image_url,
  }));
  sendSuccess(res, mapped, 'Katalog reward loyalitas');
});

loyaltyRouter.post('/check-in', async (req: AuthenticatedRequest, res) => {
  if (!supabaseAdmin) {
    sendError(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
    return;
  }
  const userId = req.user!.id;
  const todayStr = new Date().toISOString().slice(0, 10);

  const { data: account, error: accErr } = await supabaseAdmin
    .from('loyalty_accounts')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (accErr || !account) {
    sendError(res, 'Akun loyalitas tidak ditemukan', 404, 'NOT_FOUND');
    return;
  }

  if (account.last_check_in_date === todayStr) {
    sendError(res, 'Anda sudah melakukan check-in harian untuk hari ini.', 400, 'ALREADY_CHECKED_IN');
    return;
  }

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const newStreak = account.last_check_in_date === yesterday ? account.current_streak + 1 : 1;
  const newLongest = Math.max(account.longest_streak, newStreak);

  const { data: settings } = await supabaseAdmin
    .from('workshop_settings')
    .select('daily_checkin_base_points, daily_streak_bonus_multiplier, max_streak_bonus_points')
    .eq('id', 1)
    .single();

  const basePoints = settings?.daily_checkin_base_points ?? 15;
  const bonusMultiplier = settings?.daily_streak_bonus_multiplier ?? 5;
  const maxBonus = settings?.max_streak_bonus_points ?? 25;
  const bonus = Math.min(newStreak * bonusMultiplier, maxBonus);
  const earnedPoints = basePoints + bonus;
  const newPoints = account.points + earnedPoints;

  const { error: updateErr } = await supabaseAdmin
    .from('loyalty_accounts')
    .update({
      points: newPoints,
      current_streak: newStreak,
      longest_streak: newLongest,
      last_check_in_date: todayStr,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (updateErr) {
    sendError(res, updateErr.message, 500, 'DB_ERROR');
    return;
  }

  await supabaseAdmin.from('daily_checkins').insert({
    user_id: userId,
    check_in_date: todayStr,
    points_awarded: earnedPoints,
    streak_count: newStreak,
  });

  sendSuccess(res, {
    pointsEarned: earnedPoints,
    currentPoints: newPoints,
    currentStreak: newStreak,
    message: `Check-in berhasil! +${earnedPoints} poin ditambahkan (Streak: ${newStreak} hari).`,
  }, 'Check-in berhasil');
});

loyaltyRouter.post('/redeem', async (req: AuthenticatedRequest, res) => {
  if (!supabaseAdmin) {
    sendError(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
    return;
  }
  const userId = req.user!.id;
  const { rewardId } = req.body;

  if (!rewardId) {
    sendError(res, 'ID reward wajib disertakan', 400, 'VALIDATION_ERROR');
    return;
  }

  const { data: reward, error: rErr } = await supabaseAdmin
    .from('rewards')
    .select('*')
    .eq('id', rewardId)
    .eq('is_active', true)
    .single();

  if (rErr || !reward) {
    sendError(res, 'Reward tidak ditemukan', 404, 'NOT_FOUND');
    return;
  }

  if (reward.stock <= 0) {
    sendError(res, 'Stok reward saat ini sedang habis', 400, 'OUT_OF_STOCK');
    return;
  }

  const { data: account, error: accErr } = await supabaseAdmin
    .from('loyalty_accounts')
    .select('points')
    .eq('user_id', userId)
    .single();

  if (accErr || !account) {
    sendError(res, 'Akun loyalitas tidak ditemukan', 404, 'NOT_FOUND');
    return;
  }

  if (account.points < reward.points_cost) {
    sendError(res, 'Poin loyalitas Anda belum mencukupi untuk reward ini', 400, 'INSUFFICIENT_POINTS');
    return;
  }

  const redemptionCode = `TRS-RWD-${Math.floor(1000 + Math.random() * 9000)}`;

  const { data: redemption, error: redErr } = await supabaseAdmin
    .from('reward_redemptions')
    .insert({
      user_id: userId,
      reward_id: rewardId,
      redemption_code: redemptionCode,
      points_spent: reward.points_cost,
      is_claimed: false,
    })
    .select()
    .single();

  if (redErr) {
    sendError(res, redErr.message, 500, 'DB_ERROR');
    return;
  }

  await supabaseAdmin
    .from('loyalty_accounts')
    .update({
      points: account.points - reward.points_cost,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  await supabaseAdmin
    .from('rewards')
    .update({ stock: reward.stock - 1 })
    .eq('id', rewardId);

  sendSuccess(res, {
    redemption: {
      id: redemption.id,
      rewardId: redemption.reward_id,
      rewardTitle: reward.title,
      pointsSpent: redemption.points_spent,
      redeemedAt: redemption.created_at,
      code: redemptionCode,
    },
    remainingPoints: account.points - reward.points_cost,
  }, 'Reward berhasil ditukarkan! Tunjukkan kode voucher ke kasir workshop.');
});

loyaltyRouter.get('/rewards/admin', authenticateToken, requireRole('superadmin'), async (_req, res) => {
  if (!supabaseAdmin) {
    sendError(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
    return;
  }
  const { data, error } = await supabaseAdmin.from('rewards').select('*').order('points_cost');
  if (error) {
    sendError(res, error.message, 500, 'DB_ERROR');
    return;
  }
  sendSuccess(res, data, 'Semua data reward');
});

loyaltyRouter.post('/rewards', authenticateToken, requireRole('superadmin'), async (req, res) => {
  if (!supabaseAdmin) {
    sendError(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
    return;
  }
  const { title, description, pointsCost, stock, imageUrl } = req.body;
  if (!title || !pointsCost || stock === undefined) {
    sendError(res, 'Judul, poin, dan stok wajib diisi', 400, 'VALIDATION_ERROR');
    return;
  }
  const id = `rew_${Date.now()}`;
  const { data, error } = await supabaseAdmin
    .from('rewards')
    .insert({ id, title, description: description || '', points_cost: Number(pointsCost), stock: Number(stock), image_url: imageUrl || null, is_active: true })
    .select()
    .single();
  if (error) {
    sendError(res, error.message, 500, 'DB_ERROR');
    return;
  }
  sendSuccess(res, data, 'Reward berhasil ditambahkan', 201);
});

loyaltyRouter.put('/rewards/:id', authenticateToken, requireRole('superadmin'), async (req, res) => {
  if (!supabaseAdmin) {
    sendError(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
    return;
  }
  const { title, description, pointsCost, stock, imageUrl, isActive } = req.body;
  const updates: Record<string, any> = {};
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (pointsCost !== undefined) updates.points_cost = Number(pointsCost);
  if (stock !== undefined) updates.stock = Number(stock);
  if (imageUrl !== undefined) updates.image_url = imageUrl;
  if (isActive !== undefined) updates.is_active = isActive;

  const { data, error } = await supabaseAdmin.from('rewards').update(updates).eq('id', req.params.id).select().single();
  if (error || !data) {
    sendError(res, 'Reward tidak ditemukan', 404, 'NOT_FOUND');
    return;
  }
  sendSuccess(res, data, 'Reward berhasil diperbarui');
});
