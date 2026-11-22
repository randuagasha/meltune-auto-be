import { Router } from 'express';
import { authenticateToken, requireRole } from '../../middleware/auth.js';
import { supabaseAdmin } from '../../config/supabase.js';
import { sendSuccess, sendError } from '../../utils/response.js';

export const productsRouter = Router();

function mapProduct(p: any) {
  const stock = p.inventory?.[0]?.quantity ?? p.stock ?? 10;
  const price = p.selling_price ?? p.price ?? 0;
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    description: p.description,
    price: Number(price),
    stock: Number(stock),
    imageUrl: p.image_url,
    isAvailable: p.is_active ?? p.is_available ?? true,
  };
}

productsRouter.get('/', async (req, res) => {
  if (!supabaseAdmin) {
    sendError(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
    return;
  }
  const { category, search } = req.query;

  try {
    let query = supabaseAdmin.from('spare_parts').select('*, inventory(quantity)').eq('is_active', true).order('name');
    if (category && category !== 'all') {
      query = query.eq('category', category as string);
    }
    if (search && typeof search === 'string') {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }
    const { data, error } = await query;
    if (!error && data) {
      sendSuccess(res, data.map(mapProduct), 'Katalog produk berhasil dimuat');
      return;
    }
  } catch {
    // Fall back to products table
  }

  let query = supabaseAdmin.from('products').select('*').eq('is_available', true).order('name');
  if (category && category !== 'all') {
    query = query.eq('category', category as string);
  }
  if (search && typeof search === 'string') {
    query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
  }
  const { data, error } = await query;
  if (error) {
    sendError(res, error.message, 500, 'DB_ERROR');
    return;
  }
  sendSuccess(res, (data || []).map(mapProduct), 'Katalog produk berhasil dimuat');
});

productsRouter.get('/:id', async (req, res) => {
  if (!supabaseAdmin) {
    sendError(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
    return;
  }
  try {
    const { data: part, error: pErr } = await supabaseAdmin
      .from('spare_parts')
      .select('*, inventory(quantity)')
      .eq('id', req.params.id)
      .single();
    if (!pErr && part) {
      sendSuccess(res, mapProduct(part), 'Detail produk');
      return;
    }
  } catch {}

  const { data, error } = await supabaseAdmin
    .from('products')
    .select('*')
    .eq('id', req.params.id)
    .single();
  if (error || !data) {
    sendError(res, 'Produk tidak ditemukan', 404, 'NOT_FOUND');
    return;
  }
  sendSuccess(res, mapProduct(data), 'Detail produk');
});

productsRouter.post('/', authenticateToken, requireRole('superadmin'), async (req, res) => {
  if (!supabaseAdmin) {
    sendError(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
    return;
  }
  const { name, category, description, price, stock, imageUrl, isAvailable } = req.body;
  if (!name || price === undefined || stock === undefined) {
    sendError(res, 'Nama, harga, dan stok wajib diisi', 400, 'VALIDATION_ERROR');
    return;
  }
  const id = `prd_${Date.now()}`;
  const { data, error } = await supabaseAdmin
    .from('products')
    .insert({
      id,
      name: name.trim(),
      category: category || 'maintenance',
      description: description || '',
      price: Number(price),
      stock: Number(stock),
      image_url: imageUrl || null,
      is_available: isAvailable !== undefined ? isAvailable : true,
    })
    .select()
    .single();
  if (error) {
    sendError(res, error.message, 500, 'DB_ERROR');
    return;
  }
  sendSuccess(res, mapProduct(data), 'Produk berhasil ditambahkan', 201);
});

productsRouter.put('/:id', authenticateToken, requireRole('superadmin'), async (req, res) => {
  if (!supabaseAdmin) {
    sendError(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
    return;
  }
  const { name, category, description, price, stock, imageUrl, isAvailable } = req.body;
  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (name !== undefined) updates.name = name;
  if (category !== undefined) updates.category = category;
  if (description !== undefined) updates.description = description;
  if (price !== undefined) updates.price = Number(price);
  if (stock !== undefined) updates.stock = Number(stock);
  if (imageUrl !== undefined) updates.image_url = imageUrl;
  if (isAvailable !== undefined) updates.is_available = isAvailable;

  const { data, error } = await supabaseAdmin
    .from('products')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error || !data) {
    sendError(res, 'Produk tidak ditemukan', 404, 'NOT_FOUND');
    return;
  }
  sendSuccess(res, mapProduct(data), 'Data produk berhasil diperbarui');
});

productsRouter.delete('/:id', authenticateToken, requireRole('superadmin'), async (req, res) => {
  if (!supabaseAdmin) {
    sendError(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
    return;
  }
  const { error } = await supabaseAdmin
    .from('products')
    .update({ is_available: false, updated_at: new Date().toISOString() })
    .eq('id', req.params.id);
  if (error) {
    sendError(res, error.message, 500, 'DB_ERROR');
    return;
  }
  sendSuccess(res, { id: req.params.id }, 'Produk berhasil dinonaktifkan');
});
