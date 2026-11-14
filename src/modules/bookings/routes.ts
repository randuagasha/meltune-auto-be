import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../../middleware/auth.js';
import { sendSuccess, sendError } from '../../utils/response.js';

export const bookingsRouter = Router();

export type BookingStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';

export interface BookingRecord {
  id: string;
  bookingReference: string;
  userId: string;
  userName: string;
  userPhone?: string;
  vehicleId: string;
  vehicleName: string;
  licensePlate: string;
  serviceIds: string[];
  serviceNames: string[];
  totalPrice: number;
  totalDurationMinutes: number;
  scheduledDate: string;
  scheduledTimeSlot: string;
  problemDescription: string;
  photoUrls?: string[];
  status: BookingStatus;
  rejectionReason?: string;
  mechanicNotes?: string;
  createdAt: string;
  updatedAt: string;
}

const mockBookings: BookingRecord[] = [
  {
    id: 'bkg_01',
    bookingReference: 'TRS-202611-0081',
    userId: 'usr_mock_user',
    userName: 'Budi Santoso',
    userPhone: '+6281234567890',
    vehicleId: 'veh_01',
    vehicleName: 'Honda Civic Turbo (FK7) 2021',
    licensePlate: 'B 1045 TRS',
    serviceIds: ['srv_tuneup_adv', 'srv_oil_full_synth'],
    serviceNames: ['Advanced Engine Tune-Up & Calibration', 'Full Synthetic Fluid & Filter Service'],
    totalPrice: 1500000,
    totalDurationMinutes: 135,
    scheduledDate: '2026-11-15',
    scheduledTimeSlot: '09:00 - 11:30',
    problemDescription: 'Tarikan gas bawah terasa sedikit tersendat saat suhu mesin mulai panas, minta cek busi dan throttle body.',
    photoUrls: ['https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&q=80&w=800'],
    status: 'confirmed',
    mechanicNotes: 'Alokasi Bay 2. Suku cadang filter dan oli 0W-20 sudah disiapkan.',
    createdAt: '2026-11-12T08:30:00Z',
    updatedAt: '2026-11-12T09:15:00Z',
  },
  {
    id: 'bkg_02',
    bookingReference: 'TRS-202611-0042',
    userId: 'usr_mock_user',
    userName: 'Budi Santoso',
    userPhone: '+6281234567890',
    vehicleId: 'veh_02',
    vehicleName: 'Toyota Fortuner 2.8 VRZ 2023',
    licensePlate: 'B 2291 TIK',
    serviceIds: ['srv_brake_overhaul'],
    serviceNames: ['Precision Brake System Overhaul'],
    totalPrice: 550000,
    totalDurationMinutes: 75,
    scheduledDate: '2026-11-04',
    scheduledTimeSlot: '13:30 - 15:00',
    problemDescription: 'Penggantian kampas rem berkala dan bleeding minyak rem.',
    status: 'completed',
    mechanicNotes: 'Kampas rem depan & belakang selesai diganti dengan komponen OEM. Uji pengereman stabil.',
    createdAt: '2026-11-01T10:00:00Z',
    updatedAt: '2026-11-04T15:00:00Z',
  },
  {
    id: 'bkg_03',
    bookingReference: 'TRS-202611-0095',
    userId: 'usr_cust_danang',
    userName: 'Danang Prasetyo',
    userPhone: '+6281399887766',
    vehicleId: 'veh_danang_01',
    vehicleName: 'Mazda 3 Hatchback 2022',
    licensePlate: 'B 8832 KLO',
    serviceIds: ['srv_undercarriage'],
    serviceNames: ['Suspension & Steering Laser Alignment'],
    totalPrice: 450000,
    totalDurationMinutes: 60,
    scheduledDate: '2026-11-16',
    scheduledTimeSlot: '10:00 - 11:30',
    problemDescription: 'Kemudi sedikit menarik ke arah kiri saat melaju di kecepatan 80 km/jam.',
    status: 'pending',
    createdAt: '2026-11-12T11:00:00Z',
    updatedAt: '2026-11-12T11:00:00Z',
  },
];

export const AVAILABLE_TIME_SLOTS = [
  '08:30 - 10:00',
  '10:00 - 11:30',
  '13:00 - 14:30',
  '14:30 - 16:00',
  '16:00 - 17:30',
];

bookingsRouter.get('/available-slots', (req, res) => {
  const { date } = req.query;
  if (!date) {
    sendError(res, 'Tanggal pemesanan wajib dicantumkan', 400);
    return;
  }
  const bookedSlots = mockBookings
    .filter(b => b.scheduledDate === date && b.status !== 'cancelled')
    .map(b => b.scheduledTimeSlot);

  const slotData = AVAILABLE_TIME_SLOTS.map(slot => ({
    slot,
    available: !bookedSlots.includes(slot),
    capacity: 2,
    remaining: bookedSlots.filter(s => s === slot).length >= 2 ? 0 : 2 - bookedSlots.filter(s => s === slot).length,
  }));

  sendSuccess(res, { date, slots: slotData }, 'Ketersediaan slot berhasil diperiksa');
});

bookingsRouter.use(authenticateToken);

bookingsRouter.get('/', (req: AuthenticatedRequest, res) => {
  const { role, id } = req.user!;
  if (role === 'customer') {
    const userBookings = mockBookings.filter(b => b.userId === id);
    sendSuccess(res, userBookings, 'Daftar booking pelanggan');
  } else {
    sendSuccess(res, mockBookings, 'Semua data booking workshop');
  }
});

bookingsRouter.get('/:id', (req, res) => {
  const booking = mockBookings.find(b => b.id === req.params.id || b.bookingReference === req.params.id);
  if (!booking) {
    sendError(res, 'Booking tidak ditemukan', 404);
    return;
  }
  sendSuccess(res, booking, 'Detail booking');
});

bookingsRouter.post('/', (req: AuthenticatedRequest, res) => {
  const {
    vehicleId,
    vehicleName,
    licensePlate,
    serviceIds,
    serviceNames,
    totalPrice,
    totalDurationMinutes,
    scheduledDate,
    scheduledTimeSlot,
    problemDescription,
    photoUrls,
  } = req.body;

  if (!vehicleId || !serviceIds?.length || !scheduledDate || !scheduledTimeSlot) {
    sendError(res, 'Informasi kendaraan, layanan, tanggal, dan slot waktu wajib diisi lengkap', 400);
    return;
  }

  const existingInSlot = mockBookings.filter(
    b => b.scheduledDate === scheduledDate && b.scheduledTimeSlot === scheduledTimeSlot && b.status !== 'cancelled'
  );
  if (existingInSlot.length >= 2) {
    sendError(res, 'Slot waktu pada tanggal tersebut sudah penuh. Silakan pilih slot lain.', 409);
    return;
  }

  const dateCode = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const bookingRef = `TRS-${dateCode}-${randomSuffix}`;

  const newBooking: BookingRecord = {
    id: `bkg_${Date.now()}`,
    bookingReference: bookingRef,
    userId: req.user!.id,
    userName: req.user!.fullName,
    userPhone: req.user!.phone,
    vehicleId,
    vehicleName: vehicleName || 'Kendaraan Terdaftar',
    licensePlate: licensePlate || 'B XXXX TRS',
    serviceIds,
    serviceNames: serviceNames || ['Layanan Berkala TORSI'],
    totalPrice: Number(totalPrice) || 0,
    totalDurationMinutes: Number(totalDurationMinutes) || 60,
    scheduledDate,
    scheduledTimeSlot,
    problemDescription: problemDescription || '',
    photoUrls: photoUrls || [],
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  mockBookings.unshift(newBooking);
  sendSuccess(res, newBooking, 'Booking layanan berhasil dikirim. Menunggu konfirmasi mekanik.', 201);
});

bookingsRouter.patch('/:id/status', (req: AuthenticatedRequest, res) => {
  const { status, rejectionReason, mechanicNotes } = req.body;
  const booking = mockBookings.find(b => b.id === req.params.id);
  if (!booking) {
    sendError(res, 'Booking tidak ditemukan', 404);
    return;
  }

  if (status) booking.status = status;
  if (rejectionReason !== undefined) booking.rejectionReason = rejectionReason;
  if (mechanicNotes !== undefined) booking.mechanicNotes = mechanicNotes;
  booking.updatedAt = new Date().toISOString();

  sendSuccess(res, booking, 'Status booking berhasil diperbarui');
});
