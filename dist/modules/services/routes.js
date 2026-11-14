"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initialServices = exports.servicesRouter = void 0;
const express_1 = require("express");
const auth_js_1 = require("../../middleware/auth.js");
const response_js_1 = require("../../utils/response.js");
exports.servicesRouter = (0, express_1.Router)();
exports.initialServices = [
    {
        id: 'srv_tuneup_adv',
        name: 'Advanced Engine Tune-Up & Calibration',
        category: 'maintenance',
        description: 'Diagnostik komprehensif sistem injeksi, pembersihan throttle body, inspeksi busi, dan kalibrasi sensor ECU.',
        price: 650000,
        estimatedDurationMinutes: 90,
        imageUrl: 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&q=80&w=800',
        isActive: true,
    },
    {
        id: 'srv_oil_full_synth',
        name: 'Full Synthetic Fluid & Filter Service',
        category: 'maintenance',
        description: 'Penggantian oli mesin full synthetic premium, filter oli OEM, gasket sumbatan, serta 24 poin cek keselamatan.',
        price: 850000,
        estimatedDurationMinutes: 45,
        imageUrl: 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&q=80&w=800',
        isActive: true,
    },
    {
        id: 'srv_brake_overhaul',
        name: 'Precision Brake System Overhaul',
        category: 'repair',
        description: 'Pembersihan rotor & kaliper, penggantian kampas rem keramik OEM, flushing minyak rem DOT 4, dan bleeding rem vakum.',
        price: 550000,
        estimatedDurationMinutes: 75,
        imageUrl: 'https://images.unsplash.com/photo-1600790142055-619df03207e6?auto=format&fit=crop&q=80&w=800',
        isActive: true,
    },
    {
        id: 'srv_undercarriage',
        name: 'Suspension & Steering Laser Alignment',
        category: 'diagnostics',
        description: 'Inspeksi tierod, balljoint, bushing, serta penyetelan sudut toe, camber, dan caster presisi komputasi digital.',
        price: 450000,
        estimatedDurationMinutes: 60,
        imageUrl: 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&q=80&w=800',
        isActive: true,
    },
    {
        id: 'srv_ac_refresh',
        name: 'Climate System Purge & Anti-Bacterial Ozone',
        category: 'detailing',
        description: 'Kuras freon kompresor, penggantian oli refrigeran PAG, pembersihan evaporator ultrasonik, dan sterilisasi kabin ozon.',
        price: 500000,
        estimatedDurationMinutes: 60,
        imageUrl: 'https://images.unsplash.com/photo-1507136566006-cfc505b114fc?auto=format&fit=crop&q=80&w=800',
        isActive: true,
    },
    {
        id: 'srv_dyno_check',
        name: 'ECU Scan & Electronic Fault Diagnostics',
        category: 'diagnostics',
        description: 'Scanning protokol OBD-II mendalam, pembacaan parameter live engine, deteksi limp mode, dan reset DTC.',
        price: 350000,
        estimatedDurationMinutes: 40,
        imageUrl: 'https://images.unsplash.com/photo-1553440569-bcc63803a83d?auto=format&fit=crop&q=80&w=800',
        isActive: true,
    },
];
let servicesData = [...exports.initialServices];
exports.servicesRouter.get('/', (_req, res) => {
    (0, response_js_1.sendSuccess)(res, servicesData, 'Katalog layanan berhasil dimuat');
});
exports.servicesRouter.get('/:id', (req, res) => {
    const service = servicesData.find(s => s.id === req.params.id);
    if (!service) {
        (0, response_js_1.sendError)(res, 'Layanan tidak ditemukan', 404);
        return;
    }
    (0, response_js_1.sendSuccess)(res, service, 'Detail layanan');
});
exports.servicesRouter.post('/', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)('superadmin'), (req, res) => {
    const { name, category, description, price, estimatedDurationMinutes, imageUrl } = req.body;
    if (!name || !price || !estimatedDurationMinutes) {
        (0, response_js_1.sendError)(res, 'Nama, harga, dan estimasi durasi wajib diisi', 400);
        return;
    }
    const newService = {
        id: `srv_${Date.now()}`,
        name,
        category: category || 'maintenance',
        description: description || '',
        price: Number(price),
        estimatedDurationMinutes: Number(estimatedDurationMinutes),
        imageUrl: imageUrl || '',
        isActive: true,
    };
    servicesData.push(newService);
    (0, response_js_1.sendSuccess)(res, newService, 'Layanan baru berhasil dibuat', 201);
});
exports.servicesRouter.put('/:id', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)('superadmin'), (req, res) => {
    const idx = servicesData.findIndex(s => s.id === req.params.id);
    if (idx === -1) {
        (0, response_js_1.sendError)(res, 'Layanan tidak ditemukan', 404);
        return;
    }
    servicesData[idx] = { ...servicesData[idx], ...req.body };
    (0, response_js_1.sendSuccess)(res, servicesData[idx], 'Layanan berhasil diperbarui');
});
exports.servicesRouter.delete('/:id', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)('superadmin'), (req, res) => {
    const idx = servicesData.findIndex(s => s.id === req.params.id);
    if (idx === -1) {
        (0, response_js_1.sendError)(res, 'Layanan tidak ditemukan', 404);
        return;
    }
    servicesData.splice(idx, 1);
    (0, response_js_1.sendSuccess)(res, { id: req.params.id }, 'Layanan berhasil dihapus');
});
