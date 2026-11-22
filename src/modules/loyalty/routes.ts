import { Router } from 'express';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../../middleware/auth.js';
import { supabaseAdmin } from '../../config/supabase.js';
import { sendSuccess, sendError } from '../../utils/response.js';

export const loyaltyRouter = Router();

loyaltyRouter.use(authenticateToken);

const DEFAULT_REWARDS = [
  {
    id: 'rew_washer_fluid',
    title: 'Konsentrat Wiper Fluid Hydrophobic (250ml)',
    description: 'Menolak tetesan air hujan pada kaca depan dan mencegah kerak air wiper.',
    pointsCost: 75,
    stock: 28,
    imageUrl: 'https://images.unsplash.com/photo-1507136566006-cfc505b114fc?auto=format&fit=crop&q=80&w=800',
  },
  {
    id: 'rew_microfiber_pack',
    title: 'Paket Microfiber Edgeless 500 GSM (3 Pcs)',
    description: 'Serat ultra-halus untuk finishing detailing tanpa swirl mark dan daya serap tinggi.',
    pointsCost: 120,
    stock: 19,
    imageUrl: 'https://images.unsplash.com/photo-1600790142055-619df03207e6?auto=format&fit=crop&q=80&w=800',
  },
  {
    id: 'rew_tire_gel',
    title: 'MELTUNE Satin Black Tire Dressing Gel (300ml)',
    description: 'Kilap alami satin deep black tahan air, tidak mengotori fender mobil saat kecepatan tinggi.',
    pointsCost: 180,
    stock: 14,
    imageUrl: 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&q=80&w=800',
  },
  {
    id: 'rew_oil_1l',
    title: 'Motul Synthetic Maintenance Engine Oil (1L)',
    description: 'Oli top-up cadangan spesifikasi SAE 5W-30 SN/GF-5 dalam kemasan botol kedap.',
    pointsCost: 300,
    stock: 8,
    imageUrl: 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&q=80&w=800',
  },
];

async function getOrCreateLoyaltyAccount(userId: string) {
  if (!supabaseAdmin) return null;

  try {
    const { data: acc } = await supabaseAdmin
      .from('reward_accounts')
      .select('*')
      .eq('customer_id', userId)
      .single();

    if (acc) return acc;

    const { data: created } = await supabaseAdmin
      .from('reward_accounts')
      .insert({ customer_id: userId, points_balance: 50 })
      .select()
      .single();

    return created;
  } catch {
    return null;
  }
}

loyaltyRouter.get('/profile', async (req: AuthenticatedRequest, res) => {
  if (!supabaseAdmin) {
    sendError(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
    return;
  }
  const userId = req.user!.id;

  const account = await getOrCreateLoyaltyAccount(userId);
  const currentPoints = account?.points_balance ?? 50;

  // Query redemptions
  let redemptionsList: any[] = [];
  try {
    const { data: redemptions } = await supabaseAdmin
      .from('reward_redemptions')
      .select('*')
      .eq('customer_id', userId)
      .order('created_at', { ascending: false });

    if (redemptions) {
      redemptionsList = redemptions.map(r => ({
        id: r.id,
        rewardId: r.id,
        rewardTitle: r.reward_name || 'Reward Loyalitas',
        pointsSpent: r.points,
        redeemedAt: r.created_at,
        code: r.notes || `MLT-RWD-${r.id.slice(0, 4).toUpperCase()}`,
      }));
    }
  } catch {}

  const profile = {
    userId,
    points: currentPoints,
    currentStreak: 1,
    longestStreak: 3,
    lastCheckInDate: null,
    redemptionHistory: redemptionsList,
  };

  sendSuccess(res, profile, 'Data loyalitas pelanggan');
});

loyaltyRouter.get('/rewards', async (_req, res) => {
  if (!supabaseAdmin) {
    sendError(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
    return;
  }
  try {
    const { data, error } = await supabaseAdmin
      .from('rewards')
      .select('*')
      .eq('is_active', true)
      .order('points_cost');

    if (!error && data && data.length > 0) {
      const mapped = data.map(r => ({
        id: r.id,
        title: r.title,
        description: r.description,
        pointsCost: r.points_cost,
        stock: r.stock,
        imageUrl: r.image_url,
      }));
      sendSuccess(res, mapped, 'Katalog reward loyalitas');
      return;
    }
  } catch {}

  sendSuccess(res, DEFAULT_REWARDS, 'Katalog reward loyalitas');
});

loyaltyRouter.post('/check-in', async (req: AuthenticatedRequest, res) => {
  if (!supabaseAdmin) {
    sendError(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
    return;
  }
  const userId = req.user!.id;
  const todayStr = new Date().toISOString().slice(0, 10);

  const account = await getOrCreateLoyaltyAccount(userId);
  const earnedPoints = 25;
  const newBalance = (account?.points_balance || 0) + earnedPoints;

  try {
    if (account?.id) {
      await supabaseAdmin
        .from('reward_accounts')
        .update({ points_balance: newBalance, updated_at: new Date().toISOString() })
        .eq('id', account.id);

      await supabaseAdmin.from('reward_transactions').insert({
        reward_account_id: account.id,
        points: earnedPoints,
        description: `Daily Check-in ${todayStr}`,
        reference_type: 'daily_checkin',
        reference_id: todayStr,
      });
    }
  } catch {}

  sendSuccess(res, {
    pointsEarned: earnedPoints,
    currentPoints: newBalance,
    currentStreak: 2,
    message: `Check-in berhasil! +${earnedPoints} poin ditambahkan ke akun Anda.`,
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

  const foundReward = DEFAULT_REWARDS.find(r => r.id === rewardId) || {
    id: rewardId,
    title: 'Voucher Layanan MELTUNE',
    pointsCost: 75,
  };

  const account = await getOrCreateLoyaltyAccount(userId);
  if ((account?.points_balance || 0) < foundReward.pointsCost) {
    sendError(res, 'Poin loyalitas Anda belum mencukupi untuk reward ini', 400, 'INSUFFICIENT_POINTS');
    return;
  }

  const redemptionCode = `MLT-RWD-${Math.floor(1000 + Math.random() * 9000)}`;
  const newBalance = Math.max(0, (account?.points_balance || 0) - foundReward.pointsCost);

  try {
    if (account?.id) {
      await supabaseAdmin
        .from('reward_accounts')
        .update({ points_balance: newBalance, updated_at: new Date().toISOString() })
        .eq('id', account.id);

      await supabaseAdmin.from('reward_redemptions').insert({
        customer_id: userId,
        points: foundReward.pointsCost,
        reward_name: foundReward.title,
        status: 'claimed',
        notes: redemptionCode,
      });
    }
  } catch {}

  sendSuccess(
    res,
    {
      redemptionCode,
      rewardTitle: foundReward.title,
      pointsSpent: foundReward.pointsCost,
      currentPoints: newBalance,
      message: 'Reward berhasil ditukarkan!',
    },
    'Reward berhasil ditukarkan'
  );
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
