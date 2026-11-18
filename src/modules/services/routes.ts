import { Router } from 'express';
import { authenticateToken, requireRole } from '../../middleware/auth.js';
import { supabaseAdmin } from '../../config/supabase.js';
import { sendSuccess, sendError } from '../../utils/response.js';

export const servicesRouter = Router();

function mapService(s: any) {
  return {
    id: s.id,
    name: s.name,
    category: s.category,
    description: s.description,
    price: Number(s.price),
    estimatedDurationMinutes: s.estimated_duration_minutes,
    imageUrl: s.image_url,
    isActive: s.is_active,
  };
}

servicesRouter.get('/', async (_req, res) => {
  if (!supabaseAdmin) {
    sendError(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
    return;
  }
  const { data, error } = await supabaseAdmin
    .from('services')
    .select('*')
    .eq('is_active', true)
    .order('name');
  if (error) {
    sendError(res, error.message, 500, 'DB_ERROR');
    return;
  }
  sendSuccess(res, (data || []).map(mapService), 'Katalog layanan berhasil dimuat');
});

servicesRouter.get('/:id', async (req, res) => {
  if (!supabaseAdmin) {
    sendError(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
    return;
  }
  const { data, error } = await supabaseAdmin
    .from('services')
    .select('*')
    .eq('id', req.params.id)
    .single();
  if (error || !data) {
    sendError(res, 'Layanan tidak ditemukan', 404, 'NOT_FOUND');
    return;
  }
  sendSuccess(res, mapService(data), 'Detail layanan');
});

servicesRouter.post('/', authenticateToken, requireRole('superadmin'), async (req, res) => {
  if (!supabaseAdmin) {
    sendError(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
    return;
  }
  const { name, category, description, price, estimatedDurationMinutes, imageUrl, isActive } = req.body;
  if (!name || !price || !estimatedDurationMinutes) {
    sendError(res, 'Nama, harga, dan estimasi durasi wajib diisi', 400, 'VALIDATION_ERROR');
    return;
  }
  const id = `srv_${Date.now()}`;
  const { data, error } = await supabaseAdmin
    .from('services')
    .insert({
      id,
      name: name.trim(),
      category: category || 'maintenance',
      description: description || '',
      price: Number(price),
      estimated_duration_minutes: Number(estimatedDurationMinutes),
      image_url: imageUrl || null,
      is_active: isActive !== undefined ? isActive : true,
    })
    .select()
    .single();
  if (error) {
    sendError(res, error.message, 500, 'DB_ERROR');
    return;
  }
  sendSuccess(res, mapService(data), 'Layanan baru berhasil dibuat', 201);
});

servicesRouter.put('/:id', authenticateToken, requireRole('superadmin'), async (req, res) => {
  if (!supabaseAdmin) {
    sendError(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
    return;
  }
  const { name, category, description, price, estimatedDurationMinutes, imageUrl, isActive } = req.body;
  const updates: Record<string, any> = {};
  if (name !== undefined) updates.name = name;
  if (category !== undefined) updates.category = category;
  if (description !== undefined) updates.description = description;
  if (price !== undefined) updates.price = Number(price);
  if (estimatedDurationMinutes !== undefined) updates.estimated_duration_minutes = Number(estimatedDurationMinutes);
  if (imageUrl !== undefined) updates.image_url = imageUrl;
  if (isActive !== undefined) updates.is_active = isActive;

  const { data, error } = await supabaseAdmin
    .from('services')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error || !data) {
    sendError(res, 'Layanan tidak ditemukan', 404, 'NOT_FOUND');
    return;
  }
  sendSuccess(res, mapService(data), 'Layanan berhasil diperbarui');
});

servicesRouter.delete('/:id', authenticateToken, requireRole('superadmin'), async (req, res) => {
  if (!supabaseAdmin) {
    sendError(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
    return;
  }
  const { error } = await supabaseAdmin
    .from('services')
    .update({ is_active: false })
    .eq('id', req.params.id);
  if (error) {
    sendError(res, error.message, 500, 'DB_ERROR');
    return;
  }
  sendSuccess(res, { id: req.params.id }, 'Layanan berhasil dinonaktifkan');
});
