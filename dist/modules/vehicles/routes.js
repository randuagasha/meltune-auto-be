"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vehiclesRouter = void 0;
const express_1 = require("express");
const auth_js_1 = require("../../middleware/auth.js");
const response_js_1 = require("../../utils/response.js");
exports.vehiclesRouter = (0, express_1.Router)();
const mockVehicles = [
    {
        id: 'veh_01',
        userId: 'usr_mock_user',
        brand: 'Honda',
        model: 'Civic Turbo (FK7)',
        year: 2021,
        licensePlate: 'B 1045 TRS',
        transmission: 'automatic',
        fuelType: 'petrol',
        notes: 'Rekomendasi oli sintetis 0W-20, servis berkala kelipatan 10.000 km.',
        createdAt: new Date().toISOString(),
    },
    {
        id: 'veh_02',
        userId: 'usr_mock_user',
        brand: 'Toyota',
        model: 'Fortuner 2.8 VRZ',
        year: 2023,
        licensePlate: 'B 2291 TIK',
        transmission: 'automatic',
        fuelType: 'diesel',
        notes: 'Periksa filter solar dan tekanan ban berkala.',
        createdAt: new Date().toISOString(),
    },
];
exports.vehiclesRouter.use(auth_js_1.authenticateToken);
exports.vehiclesRouter.get('/', (req, res) => {
    const userVehicles = mockVehicles.filter(v => v.userId === req.user?.id || req.user?.role === 'superadmin');
    (0, response_js_1.sendSuccess)(res, userVehicles, 'Kendaraan berhasil dimuat');
});
exports.vehiclesRouter.post('/', (req, res) => {
    const { brand, model, year, licensePlate, transmission, fuelType, notes } = req.body;
    if (!brand || !model || !year || !licensePlate) {
        (0, response_js_1.sendError)(res, 'Merek, model, tahun, dan nomor plat wajib diisi', 400);
        return;
    }
    const newVehicle = {
        id: `veh_${Date.now()}`,
        userId: req.user.id,
        brand,
        model,
        year: Number(year),
        licensePlate: licensePlate.toUpperCase(),
        transmission: transmission || 'automatic',
        fuelType: fuelType || 'petrol',
        notes,
        createdAt: new Date().toISOString(),
    };
    mockVehicles.push(newVehicle);
    (0, response_js_1.sendSuccess)(res, newVehicle, 'Kendaraan berhasil didaftarkan', 201);
});
exports.vehiclesRouter.put('/:id', (req, res) => {
    const idx = mockVehicles.findIndex(v => v.id === req.params.id);
    if (idx === -1) {
        (0, response_js_1.sendError)(res, 'Kendaraan tidak ditemukan', 404);
        return;
    }
    mockVehicles[idx] = { ...mockVehicles[idx], ...req.body };
    (0, response_js_1.sendSuccess)(res, mockVehicles[idx], 'Data kendaraan berhasil diperbarui');
});
exports.vehiclesRouter.delete('/:id', (req, res) => {
    const idx = mockVehicles.findIndex(v => v.id === req.params.id);
    if (idx === -1) {
        (0, response_js_1.sendError)(res, 'Kendaraan tidak ditemukan', 404);
        return;
    }
    mockVehicles.splice(idx, 1);
    (0, response_js_1.sendSuccess)(res, { id: req.params.id }, 'Kendaraan berhasil dihapus');
});
