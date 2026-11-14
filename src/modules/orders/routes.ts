import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../../middleware/auth.js';
import { sendSuccess, sendError } from '../../utils/response.js';

export const ordersRouter = Router();

export interface OrderItem {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
}

export interface OrderRecord {
  id: string;
  orderNumber: string;
  userId: string;
  userName: string;
  userPhone?: string;
  items: OrderItem[];
  subtotal: number;
  shippingFee: number;
  totalAmount: number;
  shippingMethod: 'workshop_pickup' | 'express_courier';
  shippingAddress?: string;
  paymentMethod: 'qris' | 'bank_transfer' | 'workshop_cash';
  status: 'pending' | 'processing' | 'ready_for_pickup' | 'shipped' | 'completed' | 'cancelled';
  createdAt: string;
}

const mockOrders: OrderRecord[] = [
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

ordersRouter.use(authenticateToken);

ordersRouter.get('/', (req: AuthenticatedRequest, res) => {
  const { role, id } = req.user!;
  if (role === 'customer') {
    sendSuccess(res, mockOrders.filter(o => o.userId === id), 'Daftar pesanan pelanggan');
  } else {
    sendSuccess(res, mockOrders, 'Semua pesanan store');
  }
});

ordersRouter.post('/', (req: AuthenticatedRequest, res) => {
  const { items, shippingMethod, shippingAddress, paymentMethod } = req.body;
  if (!items || !items.length) {
    sendError(res, 'Keranjang belanja kosong', 400);
    return;
  }

  const subtotal = items.reduce((acc: number, item: any) => acc + (item.price * item.quantity), 0);
  const shippingFee = shippingMethod === 'express_courier' ? 25000 : 0;
  const totalAmount = subtotal + shippingFee;

  const orderNum = `TRS-ORD-${Math.floor(1000 + Math.random() * 9000)}`;

  const newOrder: OrderRecord = {
    id: `ord_${Date.now()}`,
    orderNumber: orderNum,
    userId: req.user!.id,
    userName: req.user!.fullName,
    userPhone: req.user!.phone,
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
  sendSuccess(res, newOrder, 'Pesanan berhasil dibuat', 201);
});

ordersRouter.patch('/:id/status', (req, res) => {
  const { status } = req.body;
  const order = mockOrders.find(o => o.id === req.params.id);
  if (!order) {
    sendError(res, 'Pesanan tidak ditemukan', 404);
    return;
  }
  order.status = status;
  sendSuccess(res, order, 'Status pesanan berhasil diperbarui');
});
