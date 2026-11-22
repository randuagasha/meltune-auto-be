import { Router } from 'express';
import { authenticateToken, requireRole } from '../../middleware/auth.js';
import { supabaseAdmin } from '../../config/supabase.js';
import { sendSuccess, sendError } from '../../utils/response.js';

export const adminRouter = Router();

adminRouter.use(authenticateToken, requireRole('superadmin'));

adminRouter.get('/customers', async (_req, res) => {
  if (!supabaseAdmin) {
    sendError(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
    return;
  }
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, phone, role, is_active, created_at')
    .eq('role', 'customer')
    .order('created_at', { ascending: false });

  if (error) {
    sendError(res, error.message, 500, 'DB_ERROR');
    return;
  }

  const customerIds = (data || []).map((p: any) => p.id);

  let vehicleCounts: any[] = [];
  try {
    const { data: vData, error: vErr } = await supabaseAdmin
      .from('vehicles')
      .select('user_id')
      .in('user_id', customerIds);
    if (!vErr && vData) {
      vehicleCounts = vData;
    }
  } catch {
    // table vehicles might not exist in postgres schema cache
  }

  let bookingCounts: any[] = [];
  try {
    const { data: bData } = await supabaseAdmin
      .from('bookings')
      .select('customer_id')
      .in('customer_id', customerIds);
    if (bData) {
      bookingCounts = bData;
    }
  } catch {
    // ignore
  }

  let loyaltyData: any[] = [];
  try {
    const { data: lData } = await supabaseAdmin
      .from('reward_accounts')
      .select('customer_id, points')
      .in('customer_id', customerIds);
    if (lData) {
      loyaltyData = lData;
    }
  } catch {
    // ignore
  }

  const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();

  const mapped = (data || []).map((p: any) => {
    const authUser = authUsers?.users?.find((u: any) => u.id === p.id);
    const metaVehicles = Array.isArray(authUser?.user_metadata?.vehicles) ? authUser.user_metadata.vehicles.length : 0;
    const tableVehicles = (vehicleCounts || []).filter((v: any) => v.user_id === p.id).length;
    const totalVehicles = tableVehicles > 0 ? tableVehicles : metaVehicles;
    const totalBookings = (bookingCounts || []).filter((b: any) => b.customer_id === p.id).length;
    const loyaltyPoints = (loyaltyData || []).find((l: any) => l.customer_id === p.id)?.points || 0;

    return {
      id: p.id,
      fullName: p.full_name,
      email: authUser?.email || '',
      phone: p.phone || '',
      totalVehicles,
      totalBookings,
      loyaltyPoints,
      status: p.is_active ? 'active' : 'suspended',
      registeredAt: p.created_at,
    };
  });

  sendSuccess(res, mapped, 'Daftar pelanggan');
});

adminRouter.patch('/customers/:id/status', async (req, res) => {
  if (!supabaseAdmin) {
    sendError(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
    return;
  }
  const { status } = req.body;
  if (!['active', 'suspended'].includes(status)) {
    sendError(res, 'Status tidak valid. Gunakan "active" atau "suspended"', 400, 'INVALID_STATUS');
    return;
  }
  const isActive = status === 'active';
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .eq('role', 'customer')
    .select('id, full_name, is_active')
    .single();

  if (error || !data) {
    sendError(res, 'Pelanggan tidak ditemukan', 404, 'NOT_FOUND');
    return;
  }
  sendSuccess(res, { id: data.id, fullName: data.full_name, status: data.is_active ? 'active' : 'suspended' }, `Status akun diubah menjadi ${status}`);
});

adminRouter.delete('/customers/:id', async (req, res) => {
  if (!supabaseAdmin) {
    sendError(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
    return;
  }
  const { error } = await supabaseAdmin.auth.admin.deleteUser(req.params.id);
  if (error) {
    sendError(res, error.message, 500, 'DB_ERROR');
    return;
  }
  sendSuccess(res, { id: req.params.id }, 'Akun pelanggan berhasil dihapus');
});

adminRouter.get('/mechanics', async (_req, res) => {
  if (!supabaseAdmin) {
    sendError(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
    return;
  }
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, phone, role, is_active, created_at')
    .eq('role', 'mechanic')
    .order('created_at', { ascending: false });

  if (error) {
    sendError(res, error.message, 500, 'DB_ERROR');
    return;
  }

  const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();

  const mapped = (data || []).map((p: any) => {
    const authUser = authUsers?.users?.find((u: any) => u.id === p.id);
    return {
      id: p.id,
      fullName: p.full_name,
      email: authUser?.email || '',
      phone: p.phone || '',
      status: p.is_active ? 'active' : 'inactive',
      joinedAt: p.created_at,
    };
  });

  sendSuccess(res, mapped, 'Daftar mekanik workshop');
});

adminRouter.post('/mechanics', async (req, res) => {
  if (!supabaseAdmin) {
    sendError(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
    return;
  }
  const { fullName, email, password, phone } = req.body;
  if (!fullName || !email || !password) {
    sendError(res, 'Nama lengkap, email, dan password wajib diisi', 400, 'VALIDATION_ERROR');
    return;
  }

  const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, phone: phone || null },
  });

  if (authErr || !authData.user) {
    sendError(res, authErr?.message || 'Gagal membuat akun mekanik', 500, 'AUTH_ERROR');
    return;
  }

  const { error: profileErr } = await supabaseAdmin
    .from('profiles')
    .update({ role: 'mechanic', phone: phone || null, updated_at: new Date().toISOString() })
    .eq('id', authData.user.id);

  if (profileErr) {
    sendError(res, profileErr.message, 500, 'DB_ERROR');
    return;
  }

  sendSuccess(res, {
    id: authData.user.id,
    fullName,
    email,
    phone: phone || '',
    status: 'active',
    joinedAt: authData.user.created_at,
  }, 'Akun mekanik berhasil dibuat', 201);
});

adminRouter.patch('/mechanics/:id', async (req, res) => {
  if (!supabaseAdmin) {
    sendError(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
    return;
  }
  const { fullName, phone, status } = req.body;
  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (fullName !== undefined) updates.full_name = fullName;
  if (phone !== undefined) updates.phone = phone;
  if (status !== undefined) updates.is_active = status === 'active';

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update(updates)
    .eq('id', req.params.id)
    .eq('role', 'mechanic')
    .select('id, full_name, phone, is_active')
    .single();

  if (error || !data) {
    sendError(res, 'Mekanik tidak ditemukan', 404, 'NOT_FOUND');
    return;
  }
  sendSuccess(res, { id: data.id, fullName: data.full_name, phone: data.phone, status: data.is_active ? 'active' : 'inactive' }, 'Data mekanik diperbarui');
});

adminRouter.get('/settings', async (_req, res) => {
  if (!supabaseAdmin) {
    sendError(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
    return;
  }
  const { data, error } = await supabaseAdmin
    .from('workshop_settings')
    .select('*')
    .eq('id', 1)
    .single();
  if (error || !data) {
    sendError(res, 'Pengaturan workshop tidak ditemukan', 404, 'NOT_FOUND');
    return;
  }
  const operatingHoursFormatted = typeof data.operating_hours === 'object' && data.operating_hours !== null
    ? (data.operating_hours.formatted || JSON.stringify(data.operating_hours))
    : (data.operating_hours || 'Senin - Sabtu: 08:30 - 17:30 WIB (Minggu Libur)');

  const loyaltyCfg = typeof data.loyalty_config === 'object' && data.loyalty_config !== null
    ? data.loyalty_config
    : {};

  sendSuccess(res, {
    workshopName: data.workshop_name,
    address: data.address,
    phone: data.phone,
    whatsapp: data.whatsapp,
    operatingHours: operatingHoursFormatted,
    maxBookingsPerSlot: data.max_bookings_per_slot ?? 2,
    dailyCheckInBasePoints: data.daily_checkin_base_points ?? loyaltyCfg.base_points ?? 15,
    dailyStreakBonusMultiplier: data.daily_streak_bonus_multiplier ?? loyaltyCfg.streak_multiplier ?? 5,
    maxStreakBonusPoints: data.max_streak_bonus_points ?? loyaltyCfg.max_bonus ?? 25,
  }, 'Pengaturan operasional workshop');
});

adminRouter.put('/settings', async (req, res) => {
  if (!supabaseAdmin) {
    sendError(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
    return;
  }
  const {
    workshopName, address, phone, whatsapp, operatingHours,
    maxBookingsPerSlot, dailyCheckInBasePoints, dailyStreakBonusMultiplier, maxStreakBonusPoints,
  } = req.body;

  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (workshopName !== undefined) updates.workshop_name = workshopName;
  if (address !== undefined) updates.address = address;
  if (phone !== undefined) updates.phone = phone;
  if (whatsapp !== undefined) updates.whatsapp = whatsapp;
  if (maxBookingsPerSlot !== undefined) updates.max_bookings_per_slot = Number(maxBookingsPerSlot);

  if (operatingHours !== undefined) {
    updates.operating_hours = operatingHours;
  }

  const { data: currentSettings } = await supabaseAdmin
    .from('workshop_settings')
    .select('*')
    .eq('id', 1)
    .single();

  const currentLoyalty = (currentSettings && typeof currentSettings.loyalty_config === 'object' && currentSettings.loyalty_config) || {};
  const newBasePoints = dailyCheckInBasePoints !== undefined ? Number(dailyCheckInBasePoints) : (currentSettings?.daily_checkin_base_points ?? 15);
  const newMultiplier = dailyStreakBonusMultiplier !== undefined ? Number(dailyStreakBonusMultiplier) : (currentSettings?.daily_streak_bonus_multiplier ?? 5);
  const newMax = maxStreakBonusPoints !== undefined ? Number(maxStreakBonusPoints) : (currentSettings?.max_streak_bonus_points ?? 25);

  if (dailyCheckInBasePoints !== undefined) updates.daily_checkin_base_points = newBasePoints;
  if (dailyStreakBonusMultiplier !== undefined) updates.daily_streak_bonus_multiplier = newMultiplier;
  if (maxStreakBonusPoints !== undefined) updates.max_streak_bonus_points = newMax;

  updates.loyalty_config = {
    ...currentLoyalty,
    base_points: newBasePoints,
    streak_multiplier: newMultiplier,
    max_bonus: newMax,
  };

  const { data, error } = await supabaseAdmin
    .from('workshop_settings')
    .update(updates)
    .eq('id', 1)
    .select()
    .single();

  if (error) {
    sendError(res, error.message, 500, 'DB_ERROR');
    return;
  }

  const operatingHoursRes = typeof data.operating_hours === 'object' && data.operating_hours !== null
    ? (data.operating_hours.formatted || JSON.stringify(data.operating_hours))
    : (data.operating_hours || 'Senin - Sabtu: 08:30 - 17:30 WIB (Minggu Libur)');

  sendSuccess(res, {
    workshopName: data.workshop_name,
    address: data.address,
    phone: data.phone,
    whatsapp: data.whatsapp,
    operatingHours: operatingHoursRes,
    maxBookingsPerSlot: data.max_bookings_per_slot,
    dailyCheckInBasePoints: data.daily_checkin_base_points,
    dailyStreakBonusMultiplier: data.daily_streak_bonus_multiplier,
    maxStreakBonusPoints: data.max_streak_bonus_points,
  }, 'Pengaturan workshop berhasil disimpan');
});
