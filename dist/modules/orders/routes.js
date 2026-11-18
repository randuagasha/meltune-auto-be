"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ordersRouter = void 0;
const express_1 = require("express");
const auth_js_1 = require("../../middleware/auth.js");
const supabase_js_1 = require("../../config/supabase.js");
const response_js_1 = require("../../utils/response.js");
exports.ordersRouter = (0, express_1.Router)();
function mapOrder(o) {
    return {
        id: o.id,
        orderNumber: o.order_number,
        userId: o.user_id,
        userName: o.profiles?.full_name || '',
        userPhone: o.profiles?.phone || '',
        items: (o.order_items || []).map((i) => ({
            productId: i.product_id,
            productName: i.products?.name || i.product_id,
            price: Number(i.unit_price),
            quantity: i.quantity,
        })),
        subtotal: Number(o.subtotal),
        shippingFee: Number(o.shipping_fee),
        totalAmount: Number(o.total_amount),
        shippingMethod: o.shipping_method,
        shippingAddress: o.shipping_address,
        paymentMethod: o.payment_method,
        status: o.status,
        createdAt: o.created_at,
    };
}
exports.ordersRouter.use(auth_js_1.authenticateToken);
exports.ordersRouter.get('/', async (req, res) => {
    if (!supabase_js_1.supabaseAdmin) {
        (0, response_js_1.sendError)(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
        return;
    }
    const { role, id } = req.user;
    let query = supabase_js_1.supabaseAdmin
        .from('orders')
        .select(`
      *,
      profiles!orders_user_id_fkey(full_name, phone),
      order_items(product_id, unit_price, quantity, products(name))
    `)
        .order('created_at', { ascending: false });
    if (role === 'customer') {
        query = query.eq('user_id', id);
    }
    const { data, error } = await query;
    if (error) {
        (0, response_js_1.sendError)(res, error.message, 500, 'DB_ERROR');
        return;
    }
    (0, response_js_1.sendSuccess)(res, (data || []).map(mapOrder), role === 'customer' ? 'Daftar pesanan pelanggan' : 'Semua pesanan store');
});
exports.ordersRouter.post('/', async (req, res) => {
    if (!supabase_js_1.supabaseAdmin) {
        (0, response_js_1.sendError)(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
        return;
    }
    const { items, shippingMethod, shippingAddress, paymentMethod } = req.body;
    if (!items || !items.length) {
        (0, response_js_1.sendError)(res, 'Keranjang belanja kosong', 400, 'EMPTY_CART');
        return;
    }
    const productIds = items.map((i) => i.productId);
    const { data: products, error: pErr } = await supabase_js_1.supabaseAdmin
        .from('products')
        .select('id, name, price, stock')
        .in('id', productIds);
    if (pErr || !products) {
        (0, response_js_1.sendError)(res, 'Gagal memvalidasi produk', 500, 'DB_ERROR');
        return;
    }
    for (const item of items) {
        const product = products.find((p) => p.id === item.productId);
        if (!product) {
            (0, response_js_1.sendError)(res, `Produk ${item.productId} tidak ditemukan`, 404, 'PRODUCT_NOT_FOUND');
            return;
        }
        if (product.stock < item.quantity) {
            (0, response_js_1.sendError)(res, `Stok ${product.name} tidak mencukupi (tersisa ${product.stock})`, 400, 'INSUFFICIENT_STOCK');
            return;
        }
    }
    const subtotal = items.reduce((acc, i) => acc + (Number(i.price) * Number(i.quantity)), 0);
    const shippingFee = shippingMethod === 'express_courier' ? 25000 : 0;
    const totalAmount = subtotal + shippingFee;
    const orderNum = `TRS-ORD-${Math.floor(1000 + Math.random() * 9000)}`;
    const { data: order, error: oErr } = await supabase_js_1.supabaseAdmin
        .from('orders')
        .insert({
        order_number: orderNum,
        user_id: req.user.id,
        subtotal,
        shipping_fee: shippingFee,
        total_amount: totalAmount,
        shipping_method: shippingMethod || 'workshop_pickup',
        shipping_address: shippingAddress || null,
        payment_method: paymentMethod || 'qris',
        status: 'processing',
    })
        .select()
        .single();
    if (oErr || !order) {
        (0, response_js_1.sendError)(res, oErr?.message || 'Gagal membuat pesanan', 500, 'DB_ERROR');
        return;
    }
    await supabase_js_1.supabaseAdmin.from('order_items').insert(items.map((i) => ({
        order_id: order.id,
        product_id: i.productId,
        unit_price: Number(i.price),
        quantity: Number(i.quantity),
    })));
    for (const item of items) {
        const product = products.find((p) => p.id === item.productId);
        if (product) {
            await supabase_js_1.supabaseAdmin
                .from('products')
                .update({ stock: product.stock - Number(item.quantity), updated_at: new Date().toISOString() })
                .eq('id', item.productId);
        }
    }
    const { data: fullOrder } = await supabase_js_1.supabaseAdmin
        .from('orders')
        .select(`
      *,
      profiles!orders_user_id_fkey(full_name, phone),
      order_items(product_id, unit_price, quantity, products(name))
    `)
        .eq('id', order.id)
        .single();
    (0, response_js_1.sendSuccess)(res, mapOrder(fullOrder || order), 'Pesanan berhasil dibuat', 201);
});
exports.ordersRouter.patch('/:id/status', (0, auth_js_1.requireRole)('superadmin'), async (req, res) => {
    if (!supabase_js_1.supabaseAdmin) {
        (0, response_js_1.sendError)(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
        return;
    }
    const { status } = req.body;
    const validStatuses = ['pending', 'processing', 'ready_for_pickup', 'shipped', 'completed', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
        (0, response_js_1.sendError)(res, 'Status pesanan tidak valid', 400, 'INVALID_STATUS');
        return;
    }
    const { data, error } = await supabase_js_1.supabaseAdmin
        .from('orders')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', req.params.id)
        .select()
        .single();
    if (error || !data) {
        (0, response_js_1.sendError)(res, 'Pesanan tidak ditemukan', 404, 'NOT_FOUND');
        return;
    }
    (0, response_js_1.sendSuccess)(res, { id: data.id, status: data.status }, 'Status pesanan berhasil diperbarui');
});
