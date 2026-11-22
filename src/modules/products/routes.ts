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
    imageUrl: p.image_url || '',
    isAvailable: p.is_active ?? p.is_available ?? true,
  };
}

productsRouter.get('/', async (req, res) => {
  if (!supabaseAdmin) {
    sendError(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
    return;
  }
  const { category, search, all } = req.query;

  try {
    let query = supabaseAdmin.from('spare_parts').select('*, inventory(quantity)').order('name');
    if (all !== 'true') {
      query = query.eq('is_active', true);
    }
    if (category && category !== 'all') {
      query = query.eq('category', category as string);
    }
    if (search && typeof search === 'string') {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }
    const { data, error } = await query;
    if (!error && data) {
      sendSuccess(res, data.map(mapProduct), 'Katalog suku cadang berhasil dimuat');
      return;
    }
  } catch {
    // Fall back to products table
  }

  let query = supabaseAdmin.from('products').select('*').order('name');
  if (all !== 'true') {
    query = query.eq('is_available', true);
  }
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

// Image upload route (admin only)
productsRouter.post('/upload-image', authenticateToken, requireRole('superadmin'), async (req, res) => {
  if (!supabaseAdmin) {
    sendError(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
    return;
  }
  const { base64, fileName } = req.body;
  if (!base64 || typeof base64 !== 'string') {
    sendError(res, 'Data gambar (base64) wajib dikirimkan', 400, 'VALIDATION_ERROR');
    return;
  }

  try {
    const matches = base64.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    let mimeType = 'image/png';
    let buffer: Buffer;

    if (matches && matches.length === 3) {
      mimeType = matches[1];
      buffer = Buffer.from(matches[2], 'base64');
    } else {
      buffer = Buffer.from(base64, 'base64');
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
      mimeType = 'image/jpeg';
    }

    const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
    const cleanName = (fileName || 'part')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .toLowerCase() || 'part';
    const filePath = `products/${Date.now()}-${cleanName}.${ext}`;

    const { data: uploadData, error: uploadErr } = await supabaseAdmin.storage
      .from('workshop-media')
      .upload(filePath, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadErr || !uploadData) {
      // Fallback: return data URI so user image preview is never blocked
      sendSuccess(res, { url: base64 }, 'Gambar berhasil diproses');
      return;
    }

    const { data: urlData } = supabaseAdmin.storage
      .from('workshop-media')
      .getPublicUrl(filePath);

    sendSuccess(res, { url: urlData.publicUrl }, 'Gambar produk berhasil diunggah');
  } catch (err: any) {
    sendError(res, err.message || 'Gagal memproses unggah gambar', 500, 'UPLOAD_ERROR');
  }
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
  const { name, category, description, price, stock, imageUrl, isAvailable, brand, unit } = req.body;
  if (!name || price === undefined) {
    sendError(res, 'Nama dan harga wajib diisi', 400, 'VALIDATION_ERROR');
    return;
  }

  const numPrice = Number(price);
  const numStock = Number(stock ?? 10);
  const sku = `MLT-${(category || 'PRD').toUpperCase().slice(0, 3)}-${Date.now().toString().slice(-6)}`;

  try {
    const { data: newPart, error: partErr } = await supabaseAdmin
      .from('spare_parts')
      .insert({
        name: name.trim(),
        sku,
        category: category || 'parts',
        description: description || '',
        brand: brand || 'MELTUNE Genuine',
        unit: unit || 'piece',
        selling_price: numPrice,
        cost_price: Math.round(numPrice * 0.7),
        image_url: imageUrl || null,
        is_active: isAvailable !== undefined ? isAvailable : true,
      })
      .select()
      .single();

    if (partErr || !newPart) {
      // Fallback to products table if spare_parts fails
      const id = `prd_${Date.now()}`;
      const { data: prodData, error: prodErr } = await supabaseAdmin
        .from('products')
        .insert({
          id,
          name: name.trim(),
          category: category || 'parts',
          description: description || '',
          price: numPrice,
          stock: numStock,
          image_url: imageUrl || null,
          is_available: isAvailable !== undefined ? isAvailable : true,
        })
        .select()
        .single();

      if (prodErr || !prodData) {
        sendError(res, partErr?.message || prodErr?.message || 'Gagal menambahkan produk', 500, 'DB_ERROR');
        return;
      }
      sendSuccess(res, mapProduct(prodData), 'Produk berhasil ditambahkan', 201);
      return;
    }

    // Insert inventory record
    await supabaseAdmin
      .from('inventory')
      .insert({
        workshop_id: '185130c5-f388-4b7d-96a8-fe1d94c0de9d',
        spare_part_id: newPart.id,
        quantity: numStock,
        minimum_stock: 5,
      });

    sendSuccess(res, mapProduct({ ...newPart, stock: numStock }), 'Suku cadang berhasil ditambahkan', 201);
  } catch (err: any) {
    sendError(res, err.message || 'Gagal menambahkan suku cadang', 500, 'DB_ERROR');
  }
});

productsRouter.put('/:id', authenticateToken, requireRole('superadmin'), async (req, res) => {
  if (!supabaseAdmin) {
    sendError(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
    return;
  }
  const { name, category, description, price, stock, imageUrl, isAvailable, brand, unit } = req.body;
  const id = req.params.id;

  try {
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name.trim();
    if (category !== undefined) updates.category = category;
    if (description !== undefined) updates.description = description;
    if (price !== undefined) updates.selling_price = Number(price);
    if (imageUrl !== undefined) updates.image_url = imageUrl || null;
    if (isAvailable !== undefined) updates.is_active = isAvailable;
    if (brand !== undefined) updates.brand = brand;
    if (unit !== undefined) updates.unit = unit;

    const { data: updatedPart, error: partError } = await supabaseAdmin
      .from('spare_parts')
      .update(updates)
      .eq('id', id)
      .select('*, inventory(quantity)')
      .single();

    if (partError || !updatedPart) {
      // Fallback update on products table if spare_parts did not find the ID
      const prodUpdates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (name !== undefined) prodUpdates.name = name.trim();
      if (category !== undefined) prodUpdates.category = category;
      if (description !== undefined) prodUpdates.description = description;
      if (price !== undefined) prodUpdates.price = Number(price);
      if (stock !== undefined) prodUpdates.stock = Number(stock);
      if (imageUrl !== undefined) prodUpdates.image_url = imageUrl || null;
      if (isAvailable !== undefined) prodUpdates.is_available = isAvailable;

      const { data: prodData, error: prodErr } = await supabaseAdmin
        .from('products')
        .update(prodUpdates)
        .eq('id', id)
        .select()
        .single();

      if (prodErr || !prodData) {
        sendError(res, 'Produk/suku cadang tidak ditemukan', 404, 'NOT_FOUND');
        return;
      }
      sendSuccess(res, mapProduct(prodData), 'Data produk berhasil diperbarui');
      return;
    }

    // Update stock in inventory table
    let updatedStock = updatedPart.inventory?.[0]?.quantity ?? 10;
    if (stock !== undefined) {
      const numStock = Number(stock);
      const { data: existingInv } = await supabaseAdmin
        .from('inventory')
        .select('id')
        .eq('spare_part_id', id)
        .single();

      if (existingInv) {
        await supabaseAdmin
          .from('inventory')
          .update({ quantity: numStock, updated_at: new Date().toISOString() })
          .eq('id', existingInv.id);
      } else {
        await supabaseAdmin
          .from('inventory')
          .insert({
            workshop_id: '185130c5-f388-4b7d-96a8-fe1d94c0de9d',
            spare_part_id: id,
            quantity: numStock,
            minimum_stock: 5,
          });
      }
      updatedStock = numStock;
    }

    sendSuccess(res, mapProduct({ ...updatedPart, stock: updatedStock }), 'Data suku cadang berhasil diperbarui');
  } catch (err: any) {
    sendError(res, err.message || 'Gagal memperbarui suku cadang', 500, 'DB_ERROR');
  }
});

productsRouter.delete('/:id', authenticateToken, requireRole('superadmin'), async (req, res) => {
  if (!supabaseAdmin) {
    sendError(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
    return;
  }
  const id = req.params.id;
  try {
    const { error: spErr } = await supabaseAdmin
      .from('spare_parts')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (spErr) {
      await supabaseAdmin
        .from('products')
        .update({ is_available: false, updated_at: new Date().toISOString() })
        .eq('id', id);
    }

    sendSuccess(res, { id }, 'Suku cadang berhasil dinonaktifkan');
  } catch (err: any) {
    sendError(res, err.message || 'Gagal menonaktifkan suku cadang', 500, 'DB_ERROR');
  }
});
