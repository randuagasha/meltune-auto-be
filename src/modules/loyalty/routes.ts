import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../../middleware/auth.js';
import { sendSuccess, sendError } from '../../utils/response.js';

export const loyaltyRouter = Router();

export interface RewardRecord {
  id: string;
  title: string;
  description: string;
  pointsCost: number;
  stock: number;
  imageUrl: string;
}

export interface LoyaltyProfile {
  userId: string;
  points: number;
  currentStreak: number;
  longestStreak: number;
  lastCheckInDate?: string;
  redemptionHistory: Array<{
    id: string;
    rewardId: string;
    rewardTitle: string;
    pointsSpent: number;
    redeemedAt: string;
    code: string;
  }>;
}

const mockLoyaltyAccounts: Record<string, LoyaltyProfile> = {
  usr_mock_user: {
    userId: 'usr_mock_user',
    points: 420,
    currentStreak: 5,
    longestStreak: 12,
    lastCheckInDate: '2026-11-11',
    redemptionHistory: [
      {
        id: 'rdm_01',
        rewardId: 'rew_microfiber_pack',
        rewardTitle: 'Paket Kain Microfiber Edgeless Ultra-Plush (3 Pcs)',
        pointsSpent: 120,
        redeemedAt: '2026-11-06T10:15:00Z',
        code: 'TRS-RWD-7712',
      },
    ],
  },
};

export const availableRewards: RewardRecord[] = [
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
    title: 'TORSI Satin Black Tire Dressing Gel (300ml)',
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

loyaltyRouter.use(authenticateToken);

loyaltyRouter.get('/profile', (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  if (!mockLoyaltyAccounts[userId]) {
    mockLoyaltyAccounts[userId] = {
      userId,
      points: 50,
      currentStreak: 1,
      longestStreak: 1,
      redemptionHistory: [],
    };
  }
  sendSuccess(res, mockLoyaltyAccounts[userId], 'Data loyalitas pelanggan');
});

loyaltyRouter.get('/rewards', (_req, res) => {
  sendSuccess(res, availableRewards, 'Katalog reward loyalitas');
});

loyaltyRouter.post('/check-in', (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const profile = mockLoyaltyAccounts[userId] || {
    userId,
    points: 0,
    currentStreak: 0,
    longestStreak: 0,
    redemptionHistory: [],
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  if (profile.lastCheckInDate === todayStr) {
    sendError(res, 'Anda sudah melakukan check-in harian untuk hari ini.', 400, 'ALREADY_CHECKED_IN');
    return;
  }

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (profile.lastCheckInDate === yesterday) {
    profile.currentStreak += 1;
  } else {
    profile.currentStreak = 1;
  }

  if (profile.currentStreak > profile.longestStreak) {
    profile.longestStreak = profile.currentStreak;
  }

  const bonusMultiplier = Math.min(profile.currentStreak * 5, 25);
  const earnedPoints = 15 + bonusMultiplier;
  profile.points += earnedPoints;
  profile.lastCheckInDate = todayStr;
  mockLoyaltyAccounts[userId] = profile;

  sendSuccess(res, {
    pointsEarned: earnedPoints,
    currentPoints: profile.points,
    currentStreak: profile.currentStreak,
    message: `Check-in berhasil! +${earnedPoints} poin ditambahkan (Streak: ${profile.currentStreak} hari).`,
  }, 'Check-in berhasil');
});

loyaltyRouter.post('/redeem', (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { rewardId } = req.body;
  const reward = availableRewards.find(r => r.id === rewardId);
  if (!reward) {
    sendError(res, 'Reward tidak ditemukan', 404);
    return;
  }

  if (reward.stock <= 0) {
    sendError(res, 'Stok reward saat ini sedang habis', 400);
    return;
  }

  const profile = mockLoyaltyAccounts[userId];
  if (!profile || profile.points < reward.pointsCost) {
    sendError(res, 'Poin loyalitas Anda belum mencukupi untuk reward ini', 400);
    return;
  }

  profile.points -= reward.pointsCost;
  reward.stock -= 1;
  const redemptionCode = `TRS-RWD-${Math.floor(1000 + Math.random() * 9000)}`;

  const redemptionRecord = {
    id: `rdm_${Date.now()}`,
    rewardId: reward.id,
    rewardTitle: reward.title,
    pointsSpent: reward.pointsCost,
    redeemedAt: new Date().toISOString(),
    code: redemptionCode,
  };

  profile.redemptionHistory.unshift(redemptionRecord);

  sendSuccess(res, {
    redemption: redemptionRecord,
    remainingPoints: profile.points,
  }, 'Reward berhasil ditukarkan! Tunjukkan kode voucher ke kasir workshop.');
});
