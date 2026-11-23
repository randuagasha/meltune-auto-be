import { Router } from 'express';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../../middleware/auth.js';
import { supabaseAdmin } from '../../config/supabase.js';
import { sendSuccess, sendError } from '../../utils/response.js';

export const ordersRouter = Router();

function mapOrder(o: any, items?: any[]) {
  return {
    id: o.id,
    orderNumber: o.order_code || o.order_number || o.id,
    userId: o.customer_id || o.user_id,
    userName: o.customer_name || 'Pelanggan',
    userPhone: o.customer_phone || '',
    items: (items || o.order_items || []).map((i: any) => ({
      productId: i.spare_part_id || i.product_id,
      productName: i.product_name || i.products?.name || 'Suku Cadang',
      price: Number(i.unit_price || 0),
      quantity: Number(i.quantity || 1),
    })),
    subtotal: Number(o.subtotal || 0),
    shippingFee: Number(o.shipping_cost ?? o.shipping_fee ?? 0),
    totalAmount: Number(o.total ?? o.total_amount ?? 0),
    shippingMethod: o.shipping_method || 'workshop_pickup',
    shippingAddress: o.shipping_address || '',
    paymentMethod: o.payment_method || 'qris',
    status: o.status || 'pending',
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

  try {
    let query = supabaseAdmin
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (role === 'customer') {
      query = query.eq('customer_id', id);
    }

    const { data: ordersData, error } = await query;
    if (error) {
      sendError(res, error.message, 500, 'DB_ERROR');
      return;
    }

    const orderIds = (ordersData || []).map(o => o.id);
    let itemsMap: Record<string, any[]> = {};

    if (orderIds.length > 0) {
      const { data: orderItems } = await supabaseAdmin
        .from('order_items')
        .select('*')
        .in('order_id', orderIds);

      for (const item of orderItems || []) {
        if (!itemsMap[item.order_id]) itemsMap[item.order_id] = [];
        itemsMap[item.order_id].push(item);
      }
    }

    const mapped = (ordersData || []).map(o => mapOrder(o, itemsMap[o.id] || []));
    sendSuccess(res, mapped, role === 'customer' ? 'Daftar pesanan pelanggan' : 'Semua pesanan store');
    return;
  } catch (err: any) {
    sendError(res, err.message, 500, 'DB_ERROR');
  }
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

  const userId = req.user!.id;
  const { data: workshops } = await supabaseAdmin.from('workshops').select('id').limit(1);
  const workshopId = workshops?.[0]?.id || '185130c5-f388-4b7d-96a8-fe1d94c0de9d';

  const subtotal = items.reduce((acc: number, i: any) => acc + (Number(i.price) * Number(i.quantity)), 0);
  const shippingFee = shippingMethod === 'express_courier' ? 25000 : 0;
  const totalAmount = subtotal + shippingFee;
  const orderNum = `MLT-ORD-${Math.floor(1000 + Math.random() * 9000)}`;

  try {
    const { data: order, error: oErr } = await supabaseAdmin
      .from('orders')
      .insert({
        order_code: orderNum,
        customer_id: userId,
        workshop_id: workshopId,
        subtotal,
        shipping_cost: shippingFee,
        total: totalAmount,
        shipping_address: shippingAddress || null,
        payment_method: paymentMethod || 'qris',
        status: 'pending',
      })
      .select()
      .single();

    if (oErr || !order) {
      sendError(res, oErr?.message || 'Gagal membuat pesanan', 500, 'DB_ERROR');
      return;
    }

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const { data: dbParts } = await supabaseAdmin.from('spare_parts').select('id, name, sku');
    const defaultPartId = dbParts?.[0]?.id || '82511259-23b3-46b4-8a43-d832c5579df5';

    const itemsToInsert = items.map((i: any) => {
      let finalPartId = i.productId;
      let pName = i.productName || 'Suku Cadang';
      let pSku = i.sku || null;

      if (!UUID_REGEX.test(finalPartId)) {
        const matched = (dbParts || []).find(p => p.name.toLowerCase() === pName.toLowerCase() || p.sku === i.productId);
        finalPartId = matched?.id || defaultPartId;
        if (matched) {
          pName = matched.name;
          pSku = matched.sku;
        }
      }

      return {
        order_id: order.id,
        spare_part_id: finalPartId,
        product_name: pName,
        sku: pSku,
        quantity: Number(i.quantity) || 1,
        unit_price: Number(i.price) || 0,
        subtotal: (Number(i.price) || 0) * (Number(i.quantity) || 1),
      };
    });

    await supabaseAdmin.from('order_items').insert(itemsToInsert);

    sendSuccess(res, mapOrder(order, itemsToInsert), 'Pesanan berhasil dibuat', 201);
  } catch (err: any) {
    sendError(res, err.message, 500, 'DB_ERROR');
  }
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
