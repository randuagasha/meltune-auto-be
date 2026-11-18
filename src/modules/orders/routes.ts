import { Router } from 'express';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../../middleware/auth.js';
import { supabaseAdmin } from '../../config/supabase.js';
import { sendSuccess, sendError } from '../../utils/response.js';

export const ordersRouter = Router();

function mapOrder(o: any) {
  return {
    id: o.id,
    orderNumber: o.order_number,
    userId: o.user_id,
    userName: o.profiles?.full_name || '',
    userPhone: o.profiles?.phone || '',
    items: (o.order_items || []).map((i: any) => ({
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

ordersRouter.use(authenticateToken);

ordersRouter.get('/', async (req: AuthenticatedRequest, res) => {
  if (!supabaseAdmin) {
    sendError(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
    return;
  }
  const { role, id } = req.user!;

  let query = supabaseAdmin
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
    sendError(res, error.message, 500, 'DB_ERROR');
    return;
  }
  sendSuccess(res, (data || []).map(mapOrder), role === 'customer' ? 'Daftar pesanan pelanggan' : 'Semua pesanan store');
});

ordersRouter.post('/', async (req: AuthenticatedRequest, res) => {
  if (!supabaseAdmin) {
    sendError(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
    return;
  }
  const { items, shippingMethod, shippingAddress, paymentMethod } = req.body;
  if (!items || !items.length) {
    sendError(res, 'Keranjang belanja kosong', 400, 'EMPTY_CART');
    return;
  }

  const productIds = items.map((i: any) => i.productId);
  const { data: products, error: pErr } = await supabaseAdmin
    .from('products')
    .select('id, name, price, stock')
    .in('id', productIds);

  if (pErr || !products) {
    sendError(res, 'Gagal memvalidasi produk', 500, 'DB_ERROR');
    return;
  }

  for (const item of items) {
    const product = products.find((p: any) => p.id === item.productId);
    if (!product) {
      sendError(res, `Produk ${item.productId} tidak ditemukan`, 404, 'PRODUCT_NOT_FOUND');
      return;
    }
    if (product.stock < item.quantity) {
      sendError(res, `Stok ${product.name} tidak mencukupi (tersisa ${product.stock})`, 400, 'INSUFFICIENT_STOCK');
      return;
    }
  }

  const subtotal = items.reduce((acc: number, i: any) => acc + (Number(i.price) * Number(i.quantity)), 0);
  const shippingFee = shippingMethod === 'express_courier' ? 25000 : 0;
  const totalAmount = subtotal + shippingFee;
  const orderNum = `TRS-ORD-${Math.floor(1000 + Math.random() * 9000)}`;

  const { data: order, error: oErr } = await supabaseAdmin
    .from('orders')
    .insert({
      order_number: orderNum,
      user_id: req.user!.id,
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
    sendError(res, oErr?.message || 'Gagal membuat pesanan', 500, 'DB_ERROR');
    return;
  }

  await supabaseAdmin.from('order_items').insert(
    items.map((i: any) => ({
      order_id: order.id,
      product_id: i.productId,
      unit_price: Number(i.price),
      quantity: Number(i.quantity),
    }))
  );

  for (const item of items) {
    const product = products.find((p: any) => p.id === item.productId);
    if (product) {
      await supabaseAdmin
        .from('products')
        .update({ stock: product.stock - Number(item.quantity), updated_at: new Date().toISOString() })
        .eq('id', item.productId);
    }
  }

  const { data: fullOrder } = await supabaseAdmin
    .from('orders')
    .select(`
      *,
      profiles!orders_user_id_fkey(full_name, phone),
      order_items(product_id, unit_price, quantity, products(name))
    `)
    .eq('id', order.id)
    .single();

  sendSuccess(res, mapOrder(fullOrder || order), 'Pesanan berhasil dibuat', 201);
});

ordersRouter.patch('/:id/status', requireRole('superadmin'), async (req, res) => {
  if (!supabaseAdmin) {
    sendError(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
    return;
  }
  const { status } = req.body;
  const validStatuses = ['pending', 'processing', 'ready_for_pickup', 'shipped', 'completed', 'cancelled'];
  if (!status || !validStatuses.includes(status)) {
    sendError(res, 'Status pesanan tidak valid', 400, 'INVALID_STATUS');
    return;
  }
  const { data, error } = await supabaseAdmin
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error || !data) {
    sendError(res, 'Pesanan tidak ditemukan', 404, 'NOT_FOUND');
    return;
  }
  sendSuccess(res, { id: data.id, status: data.status }, 'Status pesanan berhasil diperbarui');
});
