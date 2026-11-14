"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRouter = void 0;
const express_1 = require("express");
const auth_js_1 = require("../../middleware/auth.js");
const response_js_1 = require("../../utils/response.js");
exports.adminRouter = (0, express_1.Router)();
const mockCustomers = [
    {
        id: 'usr_mock_user',
        fullName: 'Budi Santoso',
        email: 'budi@torsi.id',
        phone: '+6281234567890',
        totalVehicles: 2,
        totalBookings: 2,
        loyaltyPoints: 420,
        status: 'active',
        registeredAt: '2026-09-15T08:00:00Z',
    },
    {
        id: 'usr_cust_danang',
        fullName: 'Danang Prasetyo',
        email: 'danang@example.com',
        phone: '+6281399887766',
        totalVehicles: 1,
        totalBookings: 1,
        loyaltyPoints: 120,
        status: 'active',
        registeredAt: '2026-10-02T11:20:00Z',
    },
    {
        id: 'usr_cust_reza',
        fullName: 'Reza Pratama',
        email: 'reza@example.com',
        phone: '+6281755443322',
        totalVehicles: 1,
        totalBookings: 0,
        loyaltyPoints: 30,
        status: 'suspended',
        registeredAt: '2026-10-20T14:10:00Z',
    },
];
const mockMechanics = [
    {
        id: 'usr_mech_hendra',
        fullName: 'Hendra Wijaya',
        email: 'hendra@torsi.id',
        specialization: 'Lead Diagnostics & Powertrain',
        assignedBays: ['Bay 1', 'Bay 2'],
        status: 'active',
        joinedAt: '2026-01-10T08:00:00Z',
    },
    {
        id: 'usr_mech_agus',
        fullName: 'Agus Salim',
        email: 'agus@torsi.id',
        specialization: 'Chassis, Suspension & Wheel Alignment',
        assignedBays: ['Bay 3'],
        status: 'active',
        joinedAt: '2026-03-01T08:00:00Z',
    },
    {
        id: 'usr_mech_fauzi',
        fullName: 'Fauzi Rahmat',
        email: 'fauzi@torsi.id',
        specialization: 'Auto-Electrical & Air Conditioning',
        assignedBays: ['Bay 4'],
        status: 'active',
        joinedAt: '2026-06-15T08:00:00Z',
    },
];
let workshopSettings = {
    workshopName: 'TORSI Automotive Service & Parts',
    address: 'Kawasan Otomotif BSD Blok B3 No. 12, Tangerang Selatan, Banten 15310',
    phone: '+62 21 5590 8820',
    whatsapp: '+62 811 9876 543',
    operatingHours: 'Senin - Sabtu: 08:30 - 17:30 WIB (Minggu Libur)',
    maxBookingsPerSlot: 2,
    dailyCheckInBasePoints: 15,
    dailyStreakBonusMultiplier: 5,
};
exports.adminRouter.use(auth_js_1.authenticateToken, (0, auth_js_1.requireRole)('superadmin'));
exports.adminRouter.get('/customers', (_req, res) => {
    (0, response_js_1.sendSuccess)(res, mockCustomers, 'Daftar pelanggan');
});
exports.adminRouter.patch('/customers/:id/status', (req, res) => {
    const { status } = req.body;
    const cust = mockCustomers.find(c => c.id === req.params.id);
    if (!cust) {
        (0, response_js_1.sendError)(res, 'Pelanggan tidak ditemukan', 404);
        return;
    }
    cust.status = status;
    (0, response_js_1.sendSuccess)(res, cust, `Status akun pelanggan diubah menjadi ${status}`);
});
exports.adminRouter.get('/mechanics', (_req, res) => {
    (0, response_js_1.sendSuccess)(res, mockMechanics, 'Daftar mekanik workshop');
});
exports.adminRouter.post('/mechanics', (req, res) => {
    const { fullName, email, specialization, assignedBays } = req.body;
    if (!fullName || !email) {
        (0, response_js_1.sendError)(res, 'Nama lengkap dan email wajib diisi', 400);
        return;
    }
    const newMech = {
        id: `usr_mech_${Date.now()}`,
        fullName,
        email,
        specialization: specialization || 'General Technician',
        assignedBays: assignedBays || ['Bay 1'],
        status: 'active',
        joinedAt: new Date().toISOString(),
    };
    mockMechanics.push(newMech);
    (0, response_js_1.sendSuccess)(res, newMech, 'Akun mekanik berhasil dibuat', 201);
});
exports.adminRouter.patch('/mechanics/:id', (req, res) => {
    const mech = mockMechanics.find(m => m.id === req.params.id);
    if (!mech) {
        (0, response_js_1.sendError)(res, 'Mekanik tidak ditemukan', 404);
        return;
    }
    Object.assign(mech, req.body);
    (0, response_js_1.sendSuccess)(res, mech, 'Data mekanik diperbarui');
});
exports.adminRouter.get('/settings', (_req, res) => {
    (0, response_js_1.sendSuccess)(res, workshopSettings, 'Pengaturan operasional workshop');
});
exports.adminRouter.put('/settings', (req, res) => {
    workshopSettings = { ...workshopSettings, ...req.body };
    (0, response_js_1.sendSuccess)(res, workshopSettings, 'Pengaturan workshop berhasil disimpan');
});
