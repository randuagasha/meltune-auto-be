import { Router } from 'express';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../../middleware/auth.js';
import { supabaseAdmin } from '../../config/supabase.js';
import { sendSuccess, sendError } from '../../utils/response.js';

export const vehiclesRouter = Router();

vehiclesRouter.use(authenticateToken);

async function getUserMetadataVehicles(userId: string): Promise<any[]> {
  if (!supabaseAdmin) return [];
  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (error || !data?.user) return [];
    return (data.user.user_metadata?.vehicles || []) as any[];
  } catch {
    return [];
  }
}

async function saveUserMetadataVehicles(userId: string, vehicles: any[]): Promise<boolean> {
  if (!supabaseAdmin) return false;
  try {
    const { data: userRecord } = await supabaseAdmin.auth.admin.getUserById(userId);
    const currentMeta = userRecord?.user?.user_metadata || {};
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...currentMeta,
        vehicles,
      },
    });
    return !error;
  } catch {
    return false;
  }
}

vehiclesRouter.get('/', async (req: AuthenticatedRequest, res) => {
  if (!supabaseAdmin) {
    sendError(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
    return;
  }
  const { role, id } = req.user!;

  try {
    let query = supabaseAdmin.from('vehicles').select('*').order('created_at', { ascending: false });
    if (role === 'customer') {
      query = query.eq('user_id', id);
    }
    const { data, error } = await query;
    if (!error && data) {
      const mapped = data.map(v => ({
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
      return;
    }
  } catch {
    // Fall back to user_metadata
  }

  // Fallback: Read vehicles from user profile metadata
  const metaVehicles = await getUserMetadataVehicles(id);
  sendSuccess(res, metaVehicles, 'Kendaraan berhasil dimuat');
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

  const userId = req.user!.id;
  const cleanPlate = (licensePlate as string).toUpperCase().trim();
  const cleanBrand = (brand as string).trim();
  const cleanModel = (model as string).trim();
  const cleanYear = Number(year);
  const cleanTransmission = transmission || 'automatic';
  const cleanFuelType = fuelType || 'petrol';
  const cleanNotes = notes ? String(notes).trim() : null;

  try {
    const { data, error } = await supabaseAdmin
      .from('vehicles')
      .insert({
        user_id: userId,
        brand: cleanBrand,
        model: cleanModel,
        year: cleanYear,
        license_plate: cleanPlate,
        transmission: cleanTransmission,
        fuel_type: cleanFuelType,
        notes: cleanNotes,
      })
      .select()
      .single();

    if (!error && data) {
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
      return;
    }
  } catch {
    // Fall back to user_metadata
  }

  // Fallback: Store vehicle in Supabase Auth user_metadata
  const metaVehicles = await getUserMetadataVehicles(userId);
  const newVehicle = {
    id: 'veh_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    userId,
    brand: cleanBrand,
    model: cleanModel,
    year: cleanYear,
    licensePlate: cleanPlate,
    transmission: cleanTransmission,
    fuelType: cleanFuelType,
    notes: cleanNotes,
    createdAt: new Date().toISOString(),
  };

  metaVehicles.unshift(newVehicle);
  await saveUserMetadataVehicles(userId, metaVehicles);

  sendSuccess(res, newVehicle, 'Kendaraan berhasil didaftarkan', 201);
});

vehiclesRouter.put('/:id', async (req: AuthenticatedRequest, res) => {
  if (!supabaseAdmin) {
    sendError(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
    return;
  }
  const { id: vehicleId } = req.params;
  const { role, id: userId } = req.user!;
  const { brand, model, year, licensePlate, transmission, fuelType, notes } = req.body;

  try {
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('vehicles')
      .select('id, user_id')
      .eq('id', vehicleId)
      .single();

    if (!fetchErr && existing) {
      if (role === 'customer' && existing.user_id !== userId) {
        sendError(res, 'Anda tidak memiliki akses ke kendaraan ini', 403, 'FORBIDDEN');
        return;
      }

      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (brand !== undefined) updates.brand = brand.trim();
      if (model !== undefined) updates.model = model.trim();
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

      if (!error && data) {
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
        return;
      }
    }
  } catch {
    // Fall back to user_metadata
  }

  // Fallback: Update in user_metadata
  const metaVehicles = await getUserMetadataVehicles(userId);
  const idx = metaVehicles.findIndex(v => v.id === vehicleId);
  if (idx === -1) {
    sendError(res, 'Kendaraan tidak ditemukan', 404, 'NOT_FOUND');
    return;
  }

  metaVehicles[idx] = {
    ...metaVehicles[idx],
    brand: brand !== undefined ? brand.trim() : metaVehicles[idx].brand,
    model: model !== undefined ? model.trim() : metaVehicles[idx].model,
    year: year !== undefined ? Number(year) : metaVehicles[idx].year,
    licensePlate: licensePlate !== undefined ? (licensePlate as string).toUpperCase().trim() : metaVehicles[idx].licensePlate,
    transmission: transmission !== undefined ? transmission : metaVehicles[idx].transmission,
    fuelType: fuelType !== undefined ? fuelType : metaVehicles[idx].fuelType,
    notes: notes !== undefined ? notes : metaVehicles[idx].notes,
    updatedAt: new Date().toISOString(),
  };

  await saveUserMetadataVehicles(userId, metaVehicles);
  sendSuccess(res, metaVehicles[idx], 'Data kendaraan berhasil diperbarui');
});

vehiclesRouter.delete('/:id', async (req: AuthenticatedRequest, res) => {
  if (!supabaseAdmin) {
    sendError(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
    return;
  }
  const { id: vehicleId } = req.params;
  const { role, id: userId } = req.user!;

  try {
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('vehicles')
      .select('id, user_id')
      .eq('id', vehicleId)
      .single();

    if (!fetchErr && existing) {
      if (role === 'customer' && existing.user_id !== userId) {
        sendError(res, 'Anda tidak memiliki akses ke kendaraan ini', 403, 'FORBIDDEN');
        return;
      }
      const { error } = await supabaseAdmin.from('vehicles').delete().eq('id', vehicleId);
      if (!error) {
        sendSuccess(res, { id: vehicleId }, 'Kendaraan berhasil dihapus');
        return;
      }
    }
  } catch {
    // Fall back to user_metadata
  }

  // Fallback: Delete from user_metadata
  const metaVehicles = await getUserMetadataVehicles(userId);
  const filtered = metaVehicles.filter(v => v.id !== vehicleId);
  await saveUserMetadataVehicles(userId, filtered);

  sendSuccess(res, { id: vehicleId }, 'Kendaraan berhasil dihapus');
});
