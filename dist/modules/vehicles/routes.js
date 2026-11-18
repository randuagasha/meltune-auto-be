"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vehiclesRouter = void 0;
const express_1 = require("express");
const auth_js_1 = require("../../middleware/auth.js");
const supabase_js_1 = require("../../config/supabase.js");
const response_js_1 = require("../../utils/response.js");
exports.vehiclesRouter = (0, express_1.Router)();
exports.vehiclesRouter.use(auth_js_1.authenticateToken);
exports.vehiclesRouter.get('/', async (req, res) => {
    if (!supabase_js_1.supabaseAdmin) {
        (0, response_js_1.sendError)(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
        return;
    }
    const { role, id } = req.user;
    let query = supabase_js_1.supabaseAdmin.from('vehicles').select('*').order('created_at', { ascending: false });
    if (role === 'customer') {
        query = query.eq('user_id', id);
    }
    const { data, error } = await query;
    if (error) {
        (0, response_js_1.sendError)(res, error.message, 500, 'DB_ERROR');
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
    (0, response_js_1.sendSuccess)(res, mapped, 'Kendaraan berhasil dimuat');
});
exports.vehiclesRouter.post('/', async (req, res) => {
    if (!supabase_js_1.supabaseAdmin) {
        (0, response_js_1.sendError)(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
        return;
    }
    const { brand, model, year, licensePlate, transmission, fuelType, notes } = req.body;
    if (!brand || !model || !year || !licensePlate) {
        (0, response_js_1.sendError)(res, 'Merek, model, tahun, dan nomor plat wajib diisi', 400, 'VALIDATION_ERROR');
        return;
    }
    const { data, error } = await supabase_js_1.supabaseAdmin
        .from('vehicles')
        .insert({
        user_id: req.user.id,
        brand: brand.trim(),
        model: model.trim(),
        year: Number(year),
        license_plate: licensePlate.toUpperCase().trim(),
        transmission: transmission || 'automatic',
        fuel_type: fuelType || 'petrol',
        notes: notes || null,
    })
        .select()
        .single();
    if (error) {
        (0, response_js_1.sendError)(res, error.message, 500, 'DB_ERROR');
        return;
    }
    (0, response_js_1.sendSuccess)(res, {
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
exports.vehiclesRouter.put('/:id', async (req, res) => {
    if (!supabase_js_1.supabaseAdmin) {
        (0, response_js_1.sendError)(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
        return;
    }
    const { id: vehicleId } = req.params;
    const { role, id: userId } = req.user;
    const { data: existing, error: fetchErr } = await supabase_js_1.supabaseAdmin
        .from('vehicles')
        .select('id, user_id')
        .eq('id', vehicleId)
        .single();
    if (fetchErr || !existing) {
        (0, response_js_1.sendError)(res, 'Kendaraan tidak ditemukan', 404, 'NOT_FOUND');
        return;
    }
    if (role === 'customer' && existing.user_id !== userId) {
        (0, response_js_1.sendError)(res, 'Anda tidak memiliki akses ke kendaraan ini', 403, 'FORBIDDEN');
        return;
    }
    const { brand, model, year, licensePlate, transmission, fuelType, notes } = req.body;
    const updates = { updated_at: new Date().toISOString() };
    if (brand !== undefined)
        updates.brand = brand;
    if (model !== undefined)
        updates.model = model;
    if (year !== undefined)
        updates.year = Number(year);
    if (licensePlate !== undefined)
        updates.license_plate = licensePlate.toUpperCase().trim();
    if (transmission !== undefined)
        updates.transmission = transmission;
    if (fuelType !== undefined)
        updates.fuel_type = fuelType;
    if (notes !== undefined)
        updates.notes = notes;
    const { data, error } = await supabase_js_1.supabaseAdmin
        .from('vehicles')
        .update(updates)
        .eq('id', vehicleId)
        .select()
        .single();
    if (error) {
        (0, response_js_1.sendError)(res, error.message, 500, 'DB_ERROR');
        return;
    }
    (0, response_js_1.sendSuccess)(res, {
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
exports.vehiclesRouter.delete('/:id', async (req, res) => {
    if (!supabase_js_1.supabaseAdmin) {
        (0, response_js_1.sendError)(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
        return;
    }
    const { id: vehicleId } = req.params;
    const { role, id: userId } = req.user;
    const { data: existing, error: fetchErr } = await supabase_js_1.supabaseAdmin
        .from('vehicles')
        .select('id, user_id')
        .eq('id', vehicleId)
        .single();
    if (fetchErr || !existing) {
        (0, response_js_1.sendError)(res, 'Kendaraan tidak ditemukan', 404, 'NOT_FOUND');
        return;
    }
    if (role === 'customer' && existing.user_id !== userId) {
        (0, response_js_1.sendError)(res, 'Anda tidak memiliki akses ke kendaraan ini', 403, 'FORBIDDEN');
        return;
    }
    const { error } = await supabase_js_1.supabaseAdmin.from('vehicles').delete().eq('id', vehicleId);
    if (error) {
        (0, response_js_1.sendError)(res, error.message, 500, 'DB_ERROR');
        return;
    }
    (0, response_js_1.sendSuccess)(res, { id: vehicleId }, 'Kendaraan berhasil dihapus');
});
