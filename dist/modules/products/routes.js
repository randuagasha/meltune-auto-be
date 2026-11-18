"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productsRouter = void 0;
const express_1 = require("express");
const auth_js_1 = require("../../middleware/auth.js");
const supabase_js_1 = require("../../config/supabase.js");
const response_js_1 = require("../../utils/response.js");
exports.productsRouter = (0, express_1.Router)();
function mapProduct(p) {
    return {
        id: p.id,
        name: p.name,
        category: p.category,
        description: p.description,
        price: Number(p.price),
        stock: p.stock,
        imageUrl: p.image_url,
        isAvailable: p.is_available,
    };
}
exports.productsRouter.get('/', async (req, res) => {
    if (!supabase_js_1.supabaseAdmin) {
        (0, response_js_1.sendError)(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
        return;
    }
    const { category, search } = req.query;
    let query = supabase_js_1.supabaseAdmin.from('products').select('*').eq('is_available', true).order('name');
    if (category && category !== 'all') {
        query = query.eq('category', category);
    }
    if (search && typeof search === 'string') {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }
    const { data, error } = await query;
    if (error) {
        (0, response_js_1.sendError)(res, error.message, 500, 'DB_ERROR');
        return;
    }
    (0, response_js_1.sendSuccess)(res, (data || []).map(mapProduct), 'Katalog produk berhasil dimuat');
});
exports.productsRouter.get('/:id', async (req, res) => {
    if (!supabase_js_1.supabaseAdmin) {
        (0, response_js_1.sendError)(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
        return;
    }
    const { data, error } = await supabase_js_1.supabaseAdmin
        .from('products')
        .select('*')
        .eq('id', req.params.id)
        .single();
    if (error || !data) {
        (0, response_js_1.sendError)(res, 'Produk tidak ditemukan', 404, 'NOT_FOUND');
        return;
    }
    (0, response_js_1.sendSuccess)(res, mapProduct(data), 'Detail produk');
});
exports.productsRouter.post('/', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)('superadmin'), async (req, res) => {
    if (!supabase_js_1.supabaseAdmin) {
        (0, response_js_1.sendError)(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
        return;
    }
    const { name, category, description, price, stock, imageUrl, isAvailable } = req.body;
    if (!name || price === undefined || stock === undefined) {
        (0, response_js_1.sendError)(res, 'Nama, harga, dan stok wajib diisi', 400, 'VALIDATION_ERROR');
        return;
    }
    const id = `prd_${Date.now()}`;
    const { data, error } = await supabase_js_1.supabaseAdmin
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
        (0, response_js_1.sendError)(res, error.message, 500, 'DB_ERROR');
        return;
    }
    (0, response_js_1.sendSuccess)(res, mapProduct(data), 'Produk berhasil ditambahkan', 201);
});
exports.productsRouter.put('/:id', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)('superadmin'), async (req, res) => {
    if (!supabase_js_1.supabaseAdmin) {
        (0, response_js_1.sendError)(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
        return;
    }
    const { name, category, description, price, stock, imageUrl, isAvailable } = req.body;
    const updates = { updated_at: new Date().toISOString() };
    if (name !== undefined)
        updates.name = name;
    if (category !== undefined)
        updates.category = category;
    if (description !== undefined)
        updates.description = description;
    if (price !== undefined)
        updates.price = Number(price);
    if (stock !== undefined)
        updates.stock = Number(stock);
    if (imageUrl !== undefined)
        updates.image_url = imageUrl;
    if (isAvailable !== undefined)
        updates.is_available = isAvailable;
    const { data, error } = await supabase_js_1.supabaseAdmin
        .from('products')
        .update(updates)
        .eq('id', req.params.id)
        .select()
        .single();
    if (error || !data) {
        (0, response_js_1.sendError)(res, 'Produk tidak ditemukan', 404, 'NOT_FOUND');
        return;
    }
    (0, response_js_1.sendSuccess)(res, mapProduct(data), 'Data produk berhasil diperbarui');
});
exports.productsRouter.delete('/:id', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)('superadmin'), async (req, res) => {
    if (!supabase_js_1.supabaseAdmin) {
        (0, response_js_1.sendError)(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
        return;
    }
    const { error } = await supabase_js_1.supabaseAdmin
        .from('products')
        .update({ is_available: false, updated_at: new Date().toISOString() })
        .eq('id', req.params.id);
    if (error) {
        (0, response_js_1.sendError)(res, error.message, 500, 'DB_ERROR');
        return;
    }
    (0, response_js_1.sendSuccess)(res, { id: req.params.id }, 'Produk berhasil dinonaktifkan');
});
