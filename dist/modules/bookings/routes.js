"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AVAILABLE_TIME_SLOTS = exports.bookingsRouter = void 0;
const express_1 = require("express");
const auth_js_1 = require("../../middleware/auth.js");
const supabase_js_1 = require("../../config/supabase.js");
const response_js_1 = require("../../utils/response.js");
exports.bookingsRouter = (0, express_1.Router)();
const VALID_TRANSITIONS = {
    pending: ['confirmed', 'rejected'],
    confirmed: ['in_progress', 'cancelled'],
    in_progress: ['waiting_for_parts', 'completed'],
    waiting_for_parts: ['in_progress', 'completed'],
    completed: [],
    cancelled: [],
    rejected: [],
};
const MECHANIC_ALLOWED_TRANSITIONS = ['confirmed', 'rejected', 'in_progress', 'waiting_for_parts', 'completed'];
const CUSTOMER_ALLOWED_TRANSITIONS = ['cancelled'];
exports.AVAILABLE_TIME_SLOTS = [
    '08:30 - 10:00',
    '10:00 - 11:30',
    '13:00 - 14:30',
    '14:30 - 16:00',
    '16:00 - 17:30',
];
function mapBooking(b, services) {
    return {
        id: b.id,
        bookingReference: b.booking_reference,
        userId: b.user_id,
        userName: b.profiles?.full_name || b.user_name || '',
        userPhone: b.profiles?.phone || b.user_phone || '',
        vehicleId: b.vehicle_id,
        vehicleName: b.vehicles ? `${b.vehicles.brand} ${b.vehicles.model} ${b.vehicles.year}` : '',
        licensePlate: b.vehicles?.license_plate || '',
        serviceIds: services ? services.map((s) => s.service_id) : (b.service_ids || []),
        serviceNames: services ? services.map((s) => s.services?.name || s.service_id) : (b.service_names || []),
        totalPrice: Number(b.total_price),
        totalDurationMinutes: b.total_duration_minutes,
        scheduledDate: b.scheduled_date,
        scheduledTimeSlot: b.scheduled_time_slot,
        problemDescription: b.problem_description,
        photoUrls: b.photo_urls || [],
        status: b.status,
        rejectionReason: b.rejection_reason,
        mechanicNotes: b.mechanic_notes,
        createdAt: b.created_at,
        updatedAt: b.updated_at,
    };
}
exports.bookingsRouter.get('/available-slots', async (req, res) => {
    const { date } = req.query;
    if (!date) {
        (0, response_js_1.sendError)(res, 'Tanggal pemesanan wajib dicantumkan', 400, 'VALIDATION_ERROR');
        return;
    }
    if (!supabase_js_1.supabaseAdmin) {
        (0, response_js_1.sendError)(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
        return;
    }
    const { data: settings } = await supabase_js_1.supabaseAdmin
        .from('workshop_settings')
        .select('max_bookings_per_slot')
        .eq('id', 1)
        .single();
    const maxPerSlot = settings?.max_bookings_per_slot ?? 2;
    const { data: booked, error } = await supabase_js_1.supabaseAdmin
        .from('bookings')
        .select('scheduled_time_slot')
        .eq('scheduled_date', date)
        .not('status', 'in', '("cancelled","rejected")');
    if (error) {
        (0, response_js_1.sendError)(res, error.message, 500, 'DB_ERROR');
        return;
    }
    const slotCounts = {};
    for (const b of booked || []) {
        slotCounts[b.scheduled_time_slot] = (slotCounts[b.scheduled_time_slot] || 0) + 1;
    }
    const slotData = exports.AVAILABLE_TIME_SLOTS.map(slot => ({
        slot,
        available: (slotCounts[slot] || 0) < maxPerSlot,
        capacity: maxPerSlot,
        remaining: Math.max(0, maxPerSlot - (slotCounts[slot] || 0)),
    }));
    (0, response_js_1.sendSuccess)(res, { date, slots: slotData }, 'Ketersediaan slot berhasil diperiksa');
});
exports.bookingsRouter.use(auth_js_1.authenticateToken);
exports.bookingsRouter.get('/', async (req, res) => {
    if (!supabase_js_1.supabaseAdmin) {
        (0, response_js_1.sendError)(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
        return;
    }
    const { role, id } = req.user;
    let query = supabase_js_1.supabaseAdmin
        .from('bookings')
        .select(`
      *,
      profiles!bookings_user_id_fkey(full_name, phone),
      vehicles(brand, model, year, license_plate),
      booking_services(service_id, price_at_booking, services(name))
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
    const mapped = (data || []).map(b => mapBooking(b, b.booking_services));
    (0, response_js_1.sendSuccess)(res, mapped, role === 'customer' ? 'Daftar booking pelanggan' : 'Semua data booking workshop');
});
exports.bookingsRouter.get('/:id', async (req, res) => {
    if (!supabase_js_1.supabaseAdmin) {
        (0, response_js_1.sendError)(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
        return;
    }
    const { id: userId, role } = req.user;
    const { data, error } = await supabase_js_1.supabaseAdmin
        .from('bookings')
        .select(`
      *,
      profiles!bookings_user_id_fkey(full_name, phone),
      vehicles(brand, model, year, license_plate),
      booking_services(service_id, price_at_booking, services(name))
    `)
        .or(`id.eq.${req.params.id},booking_reference.eq.${req.params.id}`)
        .single();
    if (error || !data) {
        (0, response_js_1.sendError)(res, 'Booking tidak ditemukan', 404, 'NOT_FOUND');
        return;
    }
    if (role === 'customer' && data.user_id !== userId) {
        (0, response_js_1.sendError)(res, 'Anda tidak memiliki akses ke booking ini', 403, 'FORBIDDEN');
        return;
    }
    (0, response_js_1.sendSuccess)(res, mapBooking(data, data.booking_services), 'Detail booking');
});
exports.bookingsRouter.post('/', async (req, res) => {
    if (!supabase_js_1.supabaseAdmin) {
        (0, response_js_1.sendError)(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
        return;
    }
    const { vehicleId, serviceIds, totalPrice, totalDurationMinutes, scheduledDate, scheduledTimeSlot, problemDescription, photoUrls, } = req.body;
    if (!vehicleId || !serviceIds?.length || !scheduledDate || !scheduledTimeSlot) {
        (0, response_js_1.sendError)(res, 'Informasi kendaraan, layanan, tanggal, dan slot waktu wajib diisi', 400, 'VALIDATION_ERROR');
        return;
    }
    const { data: vehicle, error: vErr } = await supabase_js_1.supabaseAdmin
        .from('vehicles')
        .select('id, user_id')
        .eq('id', vehicleId)
        .single();
    if (vErr || !vehicle) {
        (0, response_js_1.sendError)(res, 'Kendaraan tidak ditemukan', 404, 'NOT_FOUND');
        return;
    }
    if (vehicle.user_id !== req.user.id) {
        (0, response_js_1.sendError)(res, 'Kendaraan tidak terdaftar pada akun Anda', 403, 'FORBIDDEN');
        return;
    }
    const { data: settings } = await supabase_js_1.supabaseAdmin
        .from('workshop_settings')
        .select('max_bookings_per_slot')
        .eq('id', 1)
        .single();
    const maxPerSlot = settings?.max_bookings_per_slot ?? 2;
    const { count } = await supabase_js_1.supabaseAdmin
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('scheduled_date', scheduledDate)
        .eq('scheduled_time_slot', scheduledTimeSlot)
        .not('status', 'in', '("cancelled","rejected")');
    if ((count || 0) >= maxPerSlot) {
        (0, response_js_1.sendError)(res, 'Slot waktu pada tanggal tersebut sudah penuh. Silakan pilih slot lain.', 409, 'SLOT_FULL');
        return;
    }
    const dateCode = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const bookingRef = `TRS-${dateCode}-${randomSuffix}`;
    const { data: booking, error: bErr } = await supabase_js_1.supabaseAdmin
        .from('bookings')
        .insert({
        booking_reference: bookingRef,
        user_id: req.user.id,
        vehicle_id: vehicleId,
        total_price: Number(totalPrice) || 0,
        total_duration_minutes: Number(totalDurationMinutes) || 60,
        scheduled_date: scheduledDate,
        scheduled_time_slot: scheduledTimeSlot,
        problem_description: problemDescription || '',
        photo_urls: photoUrls || [],
        status: 'pending',
    })
        .select()
        .single();
    if (bErr || !booking) {
        (0, response_js_1.sendError)(res, bErr?.message || 'Gagal membuat booking', 500, 'DB_ERROR');
        return;
    }
    const { data: servicesData } = await supabase_js_1.supabaseAdmin
        .from('services')
        .select('id, name, price')
        .in('id', serviceIds);
    if (servicesData && servicesData.length > 0) {
        await supabase_js_1.supabaseAdmin.from('booking_services').insert(servicesData.map((s) => ({
            booking_id: booking.id,
            service_id: s.id,
            price_at_booking: s.price,
        })));
    }
    const { data: fullBooking } = await supabase_js_1.supabaseAdmin
        .from('bookings')
        .select(`
      *,
      profiles!bookings_user_id_fkey(full_name, phone),
      vehicles(brand, model, year, license_plate),
      booking_services(service_id, price_at_booking, services(name))
    `)
        .eq('id', booking.id)
        .single();
    (0, response_js_1.sendSuccess)(res, mapBooking(fullBooking || booking, fullBooking?.booking_services), 'Booking layanan berhasil dikirim. Menunggu konfirmasi mekanik.', 201);
});
exports.bookingsRouter.patch('/:id/status', (0, auth_js_1.requireRole)('customer', 'mechanic', 'superadmin'), async (req, res) => {
    if (!supabase_js_1.supabaseAdmin) {
        (0, response_js_1.sendError)(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
        return;
    }
    const { status, rejectionReason, mechanicNotes } = req.body;
    const { role, id: userId } = req.user;
    const { data: booking, error: fetchErr } = await supabase_js_1.supabaseAdmin
        .from('bookings')
        .select('id, status, user_id')
        .eq('id', req.params.id)
        .single();
    if (fetchErr || !booking) {
        (0, response_js_1.sendError)(res, 'Booking tidak ditemukan', 404, 'NOT_FOUND');
        return;
    }
    if (status) {
        if (role === 'customer') {
            if (booking.user_id !== userId) {
                (0, response_js_1.sendError)(res, 'Anda tidak memiliki akses ke booking ini', 403, 'FORBIDDEN');
                return;
            }
            if (!CUSTOMER_ALLOWED_TRANSITIONS.includes(status)) {
                (0, response_js_1.sendError)(res, 'Pelanggan hanya dapat membatalkan booking', 403, 'FORBIDDEN');
                return;
            }
        }
        else {
            if (!MECHANIC_ALLOWED_TRANSITIONS.includes(status)) {
                (0, response_js_1.sendError)(res, 'Transisi status tidak valid', 400, 'INVALID_TRANSITION');
                return;
            }
        }
        const currentStatus = booking.status;
        const allowedNext = VALID_TRANSITIONS[currentStatus] || [];
        if (!allowedNext.includes(status)) {
            (0, response_js_1.sendError)(res, `Tidak dapat mengubah status dari '${currentStatus}' ke '${status}'`, 400, 'INVALID_TRANSITION');
            return;
        }
        if (status === 'rejected' && !rejectionReason?.trim()) {
            (0, response_js_1.sendError)(res, 'Alasan penolakan wajib diisi', 400, 'REJECTION_REASON_REQUIRED');
            return;
        }
    }
    const updates = { updated_at: new Date().toISOString() };
    if (status)
        updates.status = status;
    if (rejectionReason !== undefined)
        updates.rejection_reason = rejectionReason;
    if (mechanicNotes !== undefined)
        updates.mechanic_notes = mechanicNotes;
    const { data, error } = await supabase_js_1.supabaseAdmin
        .from('bookings')
        .update(updates)
        .eq('id', req.params.id)
        .select(`
      *,
      profiles!bookings_user_id_fkey(full_name, phone),
      vehicles(brand, model, year, license_plate),
      booking_services(service_id, price_at_booking, services(name))
    `)
        .single();
    if (error) {
        (0, response_js_1.sendError)(res, error.message, 500, 'DB_ERROR');
        return;
    }
    (0, response_js_1.sendSuccess)(res, mapBooking(data, data.booking_services), 'Status booking berhasil diperbarui');
});
exports.bookingsRouter.patch('/:id/notes', (0, auth_js_1.requireRole)('mechanic', 'superadmin'), async (req, res) => {
    if (!supabase_js_1.supabaseAdmin) {
        (0, response_js_1.sendError)(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
        return;
    }
    const { mechanicNotes } = req.body;
    if (mechanicNotes === undefined) {
        (0, response_js_1.sendError)(res, 'Catatan mekanik wajib disertakan', 400, 'VALIDATION_ERROR');
        return;
    }
    const { data, error } = await supabase_js_1.supabaseAdmin
        .from('bookings')
        .update({ mechanic_notes: mechanicNotes, updated_at: new Date().toISOString() })
        .eq('id', req.params.id)
        .select()
        .single();
    if (error || !data) {
        (0, response_js_1.sendError)(res, 'Booking tidak ditemukan', 404, 'NOT_FOUND');
        return;
    }
    (0, response_js_1.sendSuccess)(res, { id: data.id, mechanicNotes: data.mechanic_notes }, 'Catatan mekanik berhasil diperbarui');
});
