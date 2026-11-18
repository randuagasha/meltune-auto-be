"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.servicesRouter = void 0;
const express_1 = require("express");
const auth_js_1 = require("../../middleware/auth.js");
const supabase_js_1 = require("../../config/supabase.js");
const response_js_1 = require("../../utils/response.js");
exports.servicesRouter = (0, express_1.Router)();
function mapService(s) {
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
exports.servicesRouter.get('/', async (_req, res) => {
    if (!supabase_js_1.supabaseAdmin) {
        (0, response_js_1.sendError)(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
        return;
    }
    const { data, error } = await supabase_js_1.supabaseAdmin
        .from('services')
        .select('*')
        .eq('is_active', true)
        .order('name');
    if (error) {
        (0, response_js_1.sendError)(res, error.message, 500, 'DB_ERROR');
        return;
    }
    (0, response_js_1.sendSuccess)(res, (data || []).map(mapService), 'Katalog layanan berhasil dimuat');
});
exports.servicesRouter.get('/:id', async (req, res) => {
    if (!supabase_js_1.supabaseAdmin) {
        (0, response_js_1.sendError)(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
        return;
    }
    const { data, error } = await supabase_js_1.supabaseAdmin
        .from('services')
        .select('*')
        .eq('id', req.params.id)
        .single();
    if (error || !data) {
        (0, response_js_1.sendError)(res, 'Layanan tidak ditemukan', 404, 'NOT_FOUND');
        return;
    }
    (0, response_js_1.sendSuccess)(res, mapService(data), 'Detail layanan');
});
exports.servicesRouter.post('/', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)('superadmin'), async (req, res) => {
    if (!supabase_js_1.supabaseAdmin) {
        (0, response_js_1.sendError)(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
        return;
    }
    const { name, category, description, price, estimatedDurationMinutes, imageUrl, isActive } = req.body;
    if (!name || !price || !estimatedDurationMinutes) {
        (0, response_js_1.sendError)(res, 'Nama, harga, dan estimasi durasi wajib diisi', 400, 'VALIDATION_ERROR');
        return;
    }
    const id = `srv_${Date.now()}`;
    const { data, error } = await supabase_js_1.supabaseAdmin
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
        (0, response_js_1.sendError)(res, error.message, 500, 'DB_ERROR');
        return;
    }
    (0, response_js_1.sendSuccess)(res, mapService(data), 'Layanan baru berhasil dibuat', 201);
});
exports.servicesRouter.put('/:id', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)('superadmin'), async (req, res) => {
    if (!supabase_js_1.supabaseAdmin) {
        (0, response_js_1.sendError)(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
        return;
    }
    const { name, category, description, price, estimatedDurationMinutes, imageUrl, isActive } = req.body;
    const updates = {};
    if (name !== undefined)
        updates.name = name;
    if (category !== undefined)
        updates.category = category;
    if (description !== undefined)
        updates.description = description;
    if (price !== undefined)
        updates.price = Number(price);
    if (estimatedDurationMinutes !== undefined)
        updates.estimated_duration_minutes = Number(estimatedDurationMinutes);
    if (imageUrl !== undefined)
        updates.image_url = imageUrl;
    if (isActive !== undefined)
        updates.is_active = isActive;
    const { data, error } = await supabase_js_1.supabaseAdmin
        .from('services')
        .update(updates)
        .eq('id', req.params.id)
        .select()
        .single();
    if (error || !data) {
        (0, response_js_1.sendError)(res, 'Layanan tidak ditemukan', 404, 'NOT_FOUND');
        return;
    }
    (0, response_js_1.sendSuccess)(res, mapService(data), 'Layanan berhasil diperbarui');
});
exports.servicesRouter.delete('/:id', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)('superadmin'), async (req, res) => {
    if (!supabase_js_1.supabaseAdmin) {
        (0, response_js_1.sendError)(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
        return;
    }
    const { error } = await supabase_js_1.supabaseAdmin
        .from('services')
        .update({ is_active: false })
        .eq('id', req.params.id);
    if (error) {
        (0, response_js_1.sendError)(res, error.message, 500, 'DB_ERROR');
        return;
    }
    (0, response_js_1.sendSuccess)(res, { id: req.params.id }, 'Layanan berhasil dinonaktifkan');
});
