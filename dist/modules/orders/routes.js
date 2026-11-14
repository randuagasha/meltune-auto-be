"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ordersRouter = void 0;
const express_1 = require("express");
const auth_js_1 = require("../../middleware/auth.js");
const response_js_1 = require("../../utils/response.js");
exports.ordersRouter = (0, express_1.Router)();
const mockOrders = [
    {
        id: 'ord_01',
        orderNumber: 'TRS-ORD-8821',
        userId: 'usr_mock_user',
        userName: 'Budi Santoso',
        userPhone: '+6281234567890',
        items: [
            {
                productId: 'prd_motul_300v',
                productName: 'Motul 300V Power 5W-40 (2L)',
                price: 680000,
                quantity: 1,
            },
            {
                productId: 'prd_meguiars_wash',
                productName: 'Meguiar’s Gold Class Car Wash & Conditioner (1.89L)',
                price: 295000,
                quantity: 1,
            },
        ],
        subtotal: 975000,
        shippingFee: 0,
        totalAmount: 975000,
        shippingMethod: 'workshop_pickup',
        paymentMethod: 'qris',
        status: 'completed',
        createdAt: '2026-11-08T14:20:00Z',
    },
];
exports.ordersRouter.use(auth_js_1.authenticateToken);
exports.ordersRouter.get('/', (req, res) => {
    const { role, id } = req.user;
    if (role === 'customer') {
        (0, response_js_1.sendSuccess)(res, mockOrders.filter(o => o.userId === id), 'Daftar pesanan pelanggan');
    }
    else {
        (0, response_js_1.sendSuccess)(res, mockOrders, 'Semua pesanan store');
    }
});
exports.ordersRouter.post('/', (req, res) => {
    const { items, shippingMethod, shippingAddress, paymentMethod } = req.body;
    if (!items || !items.length) {
        (0, response_js_1.sendError)(res, 'Keranjang belanja kosong', 400);
        return;
    }
    const subtotal = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const shippingFee = shippingMethod === 'express_courier' ? 25000 : 0;
    const totalAmount = subtotal + shippingFee;
    const orderNum = `TRS-ORD-${Math.floor(1000 + Math.random() * 9000)}`;
    const newOrder = {
        id: `ord_${Date.now()}`,
        orderNumber: orderNum,
        userId: req.user.id,
        userName: req.user.fullName,
        userPhone: req.user.phone,
        items,
        subtotal,
        shippingFee,
        totalAmount,
        shippingMethod: shippingMethod || 'workshop_pickup',
        shippingAddress,
        paymentMethod: paymentMethod || 'qris',
        status: 'processing',
        createdAt: new Date().toISOString(),
    };
    mockOrders.unshift(newOrder);
    (0, response_js_1.sendSuccess)(res, newOrder, 'Pesanan berhasil dibuat', 201);
});
exports.ordersRouter.patch('/:id/status', (req, res) => {
    const { status } = req.body;
    const order = mockOrders.find(o => o.id === req.params.id);
    if (!order) {
        (0, response_js_1.sendError)(res, 'Pesanan tidak ditemukan', 404);
        return;
    }
    order.status = status;
    (0, response_js_1.sendSuccess)(res, order, 'Status pesanan berhasil diperbarui');
});
