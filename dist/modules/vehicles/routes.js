"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vehiclesRouter = void 0;
const express_1 = require("express");
const auth_js_1 = require("../../middleware/auth.js");
const supabase_js_1 = require("../../config/supabase.js");
const response_js_1 = require("../../utils/response.js");
exports.vehiclesRouter = (0, express_1.Router)();
exports.vehiclesRouter.use(auth_js_1.authenticateToken);
async function getUserMetadataVehicles(userId) {
    if (!supabase_js_1.supabaseAdmin)
        return [];
    try {
        const { data, error } = await supabase_js_1.supabaseAdmin.auth.admin.getUserById(userId);
        if (error || !data?.user)
            return [];
        return (data.user.user_metadata?.vehicles || []);
    }
    catch {
        return [];
    }
}
async function saveUserMetadataVehicles(userId, vehicles) {
    if (!supabase_js_1.supabaseAdmin)
        return false;
    try {
        const { data: userRecord } = await supabase_js_1.supabaseAdmin.auth.admin.getUserById(userId);
        const currentMeta = userRecord?.user?.user_metadata || {};
        const { error } = await supabase_js_1.supabaseAdmin.auth.admin.updateUserById(userId, {
            user_metadata: {
                ...currentMeta,
                vehicles,
            },
        });
        return !error;
    }
    catch {
        return false;
    }
}
exports.vehiclesRouter.get('/', async (req, res) => {
    if (!supabase_js_1.supabaseAdmin) {
        (0, response_js_1.sendError)(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
        return;
    }
    const { role, id } = req.user;
    try {
        let query = supabase_js_1.supabaseAdmin.from('vehicles').select('*').order('created_at', { ascending: false });
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
            (0, response_js_1.sendSuccess)(res, mapped, 'Kendaraan berhasil dimuat');
            return;
        }
    }
    catch {
        // Fall back to user_metadata
    }
    // Fallback: Read vehicles from user profile metadata
    const metaVehicles = await getUserMetadataVehicles(id);
    (0, response_js_1.sendSuccess)(res, metaVehicles, 'Kendaraan berhasil dimuat');
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
    const userId = req.user.id;
    const cleanPlate = licensePlate.toUpperCase().trim();
    const cleanBrand = brand.trim();
    const cleanModel = model.trim();
    const cleanYear = Number(year);
    const cleanTransmission = transmission || 'automatic';
    const cleanFuelType = fuelType || 'petrol';
    const cleanNotes = notes ? String(notes).trim() : null;
    try {
        const { data, error } = await supabase_js_1.supabaseAdmin
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
            return;
        }
    }
    catch {
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
    (0, response_js_1.sendSuccess)(res, newVehicle, 'Kendaraan berhasil didaftarkan', 201);
});
exports.vehiclesRouter.put('/:id', async (req, res) => {
    if (!supabase_js_1.supabaseAdmin) {
        (0, response_js_1.sendError)(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
        return;
    }
    const { id: vehicleId } = req.params;
    const { role, id: userId } = req.user;
    const { brand, model, year, licensePlate, transmission, fuelType, notes } = req.body;
    try {
        const { data: existing, error: fetchErr } = await supabase_js_1.supabaseAdmin
            .from('vehicles')
            .select('id, user_id')
            .eq('id', vehicleId)
            .single();
        if (!fetchErr && existing) {
            if (role === 'customer' && existing.user_id !== userId) {
                (0, response_js_1.sendError)(res, 'Anda tidak memiliki akses ke kendaraan ini', 403, 'FORBIDDEN');
                return;
            }
            const updates = { updated_at: new Date().toISOString() };
            if (brand !== undefined)
                updates.brand = brand.trim();
            if (model !== undefined)
                updates.model = model.trim();
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
            if (!error && data) {
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
                return;
            }
        }
    }
    catch {
        // Fall back to user_metadata
    }
    // Fallback: Update in user_metadata
    const metaVehicles = await getUserMetadataVehicles(userId);
    const idx = metaVehicles.findIndex(v => v.id === vehicleId);
    if (idx === -1) {
        (0, response_js_1.sendError)(res, 'Kendaraan tidak ditemukan', 404, 'NOT_FOUND');
        return;
    }
    metaVehicles[idx] = {
        ...metaVehicles[idx],
        brand: brand !== undefined ? brand.trim() : metaVehicles[idx].brand,
        model: model !== undefined ? model.trim() : metaVehicles[idx].model,
        year: year !== undefined ? Number(year) : metaVehicles[idx].year,
        licensePlate: licensePlate !== undefined ? licensePlate.toUpperCase().trim() : metaVehicles[idx].licensePlate,
        transmission: transmission !== undefined ? transmission : metaVehicles[idx].transmission,
        fuelType: fuelType !== undefined ? fuelType : metaVehicles[idx].fuelType,
        notes: notes !== undefined ? notes : metaVehicles[idx].notes,
        updatedAt: new Date().toISOString(),
    };
    await saveUserMetadataVehicles(userId, metaVehicles);
    (0, response_js_1.sendSuccess)(res, metaVehicles[idx], 'Data kendaraan berhasil diperbarui');
});
exports.vehiclesRouter.delete('/:id', async (req, res) => {
    if (!supabase_js_1.supabaseAdmin) {
        (0, response_js_1.sendError)(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
        return;
    }
    const { id: vehicleId } = req.params;
    const { role, id: userId } = req.user;
    try {
        const { data: existing, error: fetchErr } = await supabase_js_1.supabaseAdmin
            .from('vehicles')
            .select('id, user_id')
            .eq('id', vehicleId)
            .single();
        if (!fetchErr && existing) {
            if (role === 'customer' && existing.user_id !== userId) {
                (0, response_js_1.sendError)(res, 'Anda tidak memiliki akses ke kendaraan ini', 403, 'FORBIDDEN');
                return;
            }
            const { error } = await supabase_js_1.supabaseAdmin.from('vehicles').delete().eq('id', vehicleId);
            if (!error) {
                (0, response_js_1.sendSuccess)(res, { id: vehicleId }, 'Kendaraan berhasil dihapus');
                return;
            }
        }
    }
    catch {
        // Fall back to user_metadata
    }
    // Fallback: Delete from user_metadata
    const metaVehicles = await getUserMetadataVehicles(userId);
    const filtered = metaVehicles.filter(v => v.id !== vehicleId);
    await saveUserMetadataVehicles(userId, filtered);
    (0, response_js_1.sendSuccess)(res, { id: vehicleId }, 'Kendaraan berhasil dihapus');
});
