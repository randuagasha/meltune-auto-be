import { Router } from 'express';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../../middleware/auth.js';
import { supabaseAdmin } from '../../config/supabase.js';
import { sendSuccess, sendError } from '../../utils/response.js';

export const vehiclesRouter = Router();

vehiclesRouter.use(authenticateToken);

vehiclesRouter.get('/', async (req: AuthenticatedRequest, res) => {
  if (!supabaseAdmin) {
    sendError(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
    return;
  }
  const { role, id } = req.user!;
  let query = supabaseAdmin.from('vehicles').select('*').order('created_at', { ascending: false });
  if (role === 'customer') {
    query = query.eq('user_id', id);
  }
  const { data, error } = await query;
  if (error) {
    sendError(res, error.message, 500, 'DB_ERROR');
    return;
  }
  const mapped = (data || []).map(v => ({
    id: v.id,
    userId: v.user_id,
    brand: v.brand,
    model: v.model,
    year: v.year,
    licensePlate: v.license_plate,
    transmission: v.transmission,
    fuelType: v.fuel_type,
    notes: v.notes,
    createdAt: v.created_at,
  }));
  sendSuccess(res, mapped, 'Kendaraan berhasil dimuat');
});

vehiclesRouter.post('/', async (req: AuthenticatedRequest, res) => {
  if (!supabaseAdmin) {
    sendError(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
    return;
  }
  const { brand, model, year, licensePlate, transmission, fuelType, notes } = req.body;
  if (!brand || !model || !year || !licensePlate) {
    sendError(res, 'Merek, model, tahun, dan nomor plat wajib diisi', 400, 'VALIDATION_ERROR');
    return;
  }
  const { data, error } = await supabaseAdmin
    .from('vehicles')
    .insert({
      user_id: req.user!.id,
      brand: brand.trim(),
      model: model.trim(),
      year: Number(year),
      license_plate: (licensePlate as string).toUpperCase().trim(),
      transmission: transmission || 'automatic',
      fuel_type: fuelType || 'petrol',
      notes: notes || null,
    })
    .select()
    .single();
  if (error) {
    sendError(res, error.message, 500, 'DB_ERROR');
    return;
  }
  sendSuccess(res, {
    id: data.id,
    userId: data.user_id,
    brand: data.brand,
    model: data.model,
    year: data.year,
    licensePlate: data.license_plate,
    transmission: data.transmission,
    fuelType: data.fuel_type,
    notes: data.notes,
    createdAt: data.created_at,
  }, 'Kendaraan berhasil didaftarkan', 201);
});

vehiclesRouter.put('/:id', async (req: AuthenticatedRequest, res) => {
  if (!supabaseAdmin) {
    sendError(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
    return;
  }
  const { id: vehicleId } = req.params;
  const { role, id: userId } = req.user!;

  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from('vehicles')
    .select('id, user_id')
    .eq('id', vehicleId)
    .single();

  if (fetchErr || !existing) {
    sendError(res, 'Kendaraan tidak ditemukan', 404, 'NOT_FOUND');
    return;
  }

  if (role === 'customer' && existing.user_id !== userId) {
    sendError(res, 'Anda tidak memiliki akses ke kendaraan ini', 403, 'FORBIDDEN');
    return;
  }

  const { brand, model, year, licensePlate, transmission, fuelType, notes } = req.body;
  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (brand !== undefined) updates.brand = brand;
  if (model !== undefined) updates.model = model;
  if (year !== undefined) updates.year = Number(year);
  if (licensePlate !== undefined) updates.license_plate = (licensePlate as string).toUpperCase().trim();
  if (transmission !== undefined) updates.transmission = transmission;
  if (fuelType !== undefined) updates.fuel_type = fuelType;
  if (notes !== undefined) updates.notes = notes;

  const { data, error } = await supabaseAdmin
    .from('vehicles')
    .update(updates)
    .eq('id', vehicleId)
    .select()
    .single();

  if (error) {
    sendError(res, error.message, 500, 'DB_ERROR');
    return;
  }
  sendSuccess(res, {
    id: data.id,
    userId: data.user_id,
    brand: data.brand,
    model: data.model,
    year: data.year,
    licensePlate: data.license_plate,
    transmission: data.transmission,
    fuelType: data.fuel_type,
    notes: data.notes,
    createdAt: data.created_at,
  }, 'Data kendaraan berhasil diperbarui');
});

vehiclesRouter.delete('/:id', async (req: AuthenticatedRequest, res) => {
  if (!supabaseAdmin) {
    sendError(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
    return;
  }
  const { id: vehicleId } = req.params;
  const { role, id: userId } = req.user!;

  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from('vehicles')
    .select('id, user_id')
    .eq('id', vehicleId)
    .single();

  if (fetchErr || !existing) {
    sendError(res, 'Kendaraan tidak ditemukan', 404, 'NOT_FOUND');
    return;
  }

  if (role === 'customer' && existing.user_id !== userId) {
    sendError(res, 'Anda tidak memiliki akses ke kendaraan ini', 403, 'FORBIDDEN');
    return;
  }

  const { error } = await supabaseAdmin.from('vehicles').delete().eq('id', vehicleId);
  if (error) {
    sendError(res, error.message, 500, 'DB_ERROR');
    return;
  }
  sendSuccess(res, { id: vehicleId }, 'Kendaraan berhasil dihapus');
});
