"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supportRouter = void 0;
const express_1 = require("express");
const auth_js_1 = require("../../middleware/auth.js");
const response_js_1 = require("../../utils/response.js");
exports.supportRouter = (0, express_1.Router)();
const mockThreads = [
    {
        id: 'thr_01',
        customerId: 'usr_mock_user',
        customerName: 'Budi Santoso',
        vehicleModel: 'Honda Civic Turbo 2021',
        subject: 'Konsultasi: Bunyi decit halus saat rem ditekan pada kecepatan rendah',
        status: 'in_progress',
        lastActivity: '2026-11-12T10:15:00Z',
        messages: [
            {
                id: 'msg_01',
                senderId: 'usr_mock_user',
                senderName: 'Budi Santoso',
                senderRole: 'customer',
                content: 'Halo tim TORSI, setiap pagi saat pertama kali jalan dan menginjak rem pelan di turunan komplek, terdengar bunyi decit tipis. Apakah ini indikasi kampas rem menipis atau kotoran embun saja ya?',
                createdAt: '2026-11-12T09:30:00Z',
            },
            {
                id: 'msg_02',
                senderId: 'usr_mech_hendra',
                senderName: 'Hendra Wijaya (Mekanik Kepala)',
                senderRole: 'mechanic',
                content: 'Halo Pak Budi, pada kampas rem tipe keramik modern, lapisan oksidasi embun malam hari memang wajar menyebabkan decit minor pada 2-3 kali injakan pertama. Namun jika bunyi berlanjut saat piringan sudah hangat, ada baiknya kami lakukan inspeksi ketebalan pad via visual gauge saat booking servis berikutnya.',
                createdAt: '2026-11-12T10:15:00Z',
            },
        ],
    },
    {
        id: 'thr_02',
        customerId: 'usr_cust_danang',
        customerName: 'Danang Prasetyo',
        vehicleModel: 'Mazda 3 Hatchback 2022',
        subject: 'Rekomendasi oli transmisi matik SkyActiv-Drive',
        status: 'resolved',
        lastActivity: '2026-11-10T16:00:00Z',
        messages: [
            {
                id: 'msg_03',
                senderId: 'usr_cust_danang',
                senderName: 'Danang Prasetyo',
                senderRole: 'customer',
                content: 'Untuk mobil saya km 40.000 apakah sudah perlu kuras matik atau sekadar ganti sebagian?',
                createdAt: '2026-11-10T14:00:00Z',
            },
            {
                id: 'msg_04',
                senderId: 'usr_mech_hendra',
                senderName: 'Hendra Wijaya (Mekanik Kepala)',
                senderRole: 'mechanic',
                content: 'Kami menyarankan kuras (flushing) penuh menggunakan mesin sirkulasi otomatis dan fluida ATF-FZ genuine agar viscositas di dalam konverter torsi terisi 100% fluida segar.',
                createdAt: '2026-11-10T16:00:00Z',
            },
        ],
    },
];
exports.supportRouter.use(auth_js_1.authenticateToken);
exports.supportRouter.get('/threads', (req, res) => {
    const { role, id } = req.user;
    if (role === 'customer') {
        (0, response_js_1.sendSuccess)(res, mockThreads.filter(t => t.customerId === id), 'Daftar tiket diskusi dukungan');
    }
    else {
        (0, response_js_1.sendSuccess)(res, mockThreads, 'Semua tiket diskusi pelanggan');
    }
});
exports.supportRouter.get('/threads/:id', (req, res) => {
    const thread = mockThreads.find(t => t.id === req.params.id);
    if (!thread) {
        (0, response_js_1.sendError)(res, 'Diskusi tidak ditemukan', 404);
        return;
    }
    (0, response_js_1.sendSuccess)(res, thread, 'Detail percakapan');
});
exports.supportRouter.post('/threads', (req, res) => {
    const { subject, vehicleModel, initialMessage } = req.body;
    if (!subject || !initialMessage) {
        (0, response_js_1.sendError)(res, 'Subjek dan pertanyaan awal wajib diisi', 400);
        return;
    }
    const newThread = {
        id: `thr_${Date.now()}`,
        customerId: req.user.id,
        customerName: req.user.fullName,
        vehicleModel: vehicleModel || 'Kendaraan Pelanggan',
        subject,
        status: 'open',
        lastActivity: new Date().toISOString(),
        messages: [
            {
                id: `msg_${Date.now()}`,
                senderId: req.user.id,
                senderName: req.user.fullName,
                senderRole: req.user.role,
                content: initialMessage,
                createdAt: new Date().toISOString(),
            },
        ],
    };
    mockThreads.unshift(newThread);
    (0, response_js_1.sendSuccess)(res, newThread, 'Topik diskusi berhasil dikirim', 201);
});
exports.supportRouter.post('/threads/:id/messages', (req, res) => {
    const { content } = req.body;
    if (!content) {
        (0, response_js_1.sendError)(res, 'Pesan tidak boleh kosong', 400);
        return;
    }
    const thread = mockThreads.find(t => t.id === req.params.id);
    if (!thread) {
        (0, response_js_1.sendError)(res, 'Diskusi tidak ditemukan', 404);
        return;
    }
    const newMessage = {
        id: `msg_${Date.now()}`,
        senderId: req.user.id,
        senderName: req.user.fullName,
        senderRole: req.user.role,
        content,
        createdAt: new Date().toISOString(),
    };
    thread.messages.push(newMessage);
    thread.lastActivity = new Date().toISOString();
    if (req.user.role === 'mechanic' && thread.status === 'open') {
        thread.status = 'in_progress';
    }
    (0, response_js_1.sendSuccess)(res, newMessage, 'Pesan berhasil dikirim', 201);
});
exports.supportRouter.patch('/threads/:id/status', (req, res) => {
    const { status } = req.body;
    const thread = mockThreads.find(t => t.id === req.params.id);
    if (!thread) {
        (0, response_js_1.sendError)(res, 'Diskusi tidak ditemukan', 404);
        return;
    }
    thread.status = status;
    (0, response_js_1.sendSuccess)(res, thread, 'Status diskusi diperbarui');
});
