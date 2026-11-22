"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AVAILABLE_TIME_SLOTS = exports.bookingsRouter = void 0;
const express_1 = require("express");
const auth_js_1 = require("../../middleware/auth.js");
const supabase_js_1 = require("../../config/supabase.js");
const response_js_1 = require("../../utils/response.js");
exports.bookingsRouter = (0, express_1.Router)();
const VALID_TRANSITIONS = {
    pending: ['confirmed', 'rejected', 'cancelled'],
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
    const vName = b.vehicle_brand
        ? `${b.vehicle_brand} ${b.vehicle_model} ${b.vehicle_year || ''}`.trim()
        : b.vehicles
            ? `${b.vehicles.brand} ${b.vehicles.model} ${b.vehicles.year || ''}`.trim()
            : b.vehicle_name || 'Mobil';
    const vPlate = b.vehicle_plate || b.vehicles?.license_plate || b.license_plate || '';
    const sDate = b.scheduled_date || (b.scheduled_start ? String(b.scheduled_start).slice(0, 10) : '');
    const sTime = b.scheduled_time_slot || (b.scheduled_start
        ? `${String(b.scheduled_start).slice(11, 16)} - ${b.scheduled_end ? String(b.scheduled_end).slice(11, 16) : 'Selesai'}`
        : '08:30 - 10:00');
    const pDesc = b.customer_notes || b.problem_description || '';
    const sNames = services && services.length > 0
        ? services.map((s) => s.service_name || s.services?.name || s.service_id)
        : b.service_names || [];
    const sIds = services && services.length > 0
        ? services.map((s) => s.service_id)
        : b.service_ids || [];
    return {
        id: b.id,
        bookingReference: b.booking_code || b.booking_reference || b.id,
        userId: b.customer_id || b.user_id,
        userName: b.profiles?.full_name || b.user_name || 'Pelanggan',
        userPhone: b.profiles?.phone || b.user_phone || '',
        vehicleId: b.vehicle_id || b.id,
        vehicleName: vName,
        licensePlate: vPlate,
        serviceIds: sIds,
        serviceNames: sNames,
        totalPrice: Number(b.total ?? b.total_price ?? 0),
        totalDurationMinutes: b.total_duration_minutes || 60,
        scheduledDate: sDate,
        scheduledTimeSlot: sTime,
        problemDescription: pDesc,
        photoUrls: b.photo_urls || [],
        status: b.status,
        rejectionReason: b.rejection_reason || null,
        mechanicNotes: b.mechanic_notes || null,
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
        .select('*')
        .limit(1)
        .single();
    const maxPerSlot = settings?.max_bookings_per_slot ?? 2;
    const { data: booked, error } = await supabase_js_1.supabaseAdmin
        .from('bookings')
        .select('scheduled_start, status')
        .not('status', 'in', '("cancelled","rejected")');
    const slotCounts = {};
    if (!error && booked) {
        for (const b of booked) {
            if (b.scheduled_start && String(b.scheduled_start).startsWith(date)) {
                const timeKey = String(b.scheduled_start).slice(11, 16);
                slotCounts[timeKey] = (slotCounts[timeKey] || 0) + 1;
            }
        }
    }
    const slotData = exports.AVAILABLE_TIME_SLOTS.map(slot => {
        const slotStart = slot.split(' - ')[0];
        const count = slotCounts[slotStart] || 0;
        return {
            slot,
            available: count < maxPerSlot,
            capacity: maxPerSlot,
            remaining: Math.max(0, maxPerSlot - count),
        };
    });
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
        .select('*')
        .order('created_at', { ascending: false });
    if (role === 'customer') {
        query = query.eq('customer_id', id);
    }
    const { data: bookingsData, error } = await query;
    if (error) {
        (0, response_js_1.sendError)(res, error.message, 500, 'DB_ERROR');
        return;
    }
    const bookingIds = (bookingsData || []).map((b) => b.id);
    let servicesMap = {};
    if (bookingIds.length > 0) {
        const { data: bServices } = await supabase_js_1.supabaseAdmin
            .from('booking_services')
            .select('*')
            .in('booking_id', bookingIds);
        for (const bs of bServices || []) {
            if (!servicesMap[bs.booking_id])
                servicesMap[bs.booking_id] = [];
            servicesMap[bs.booking_id].push(bs);
        }
    }
    const mapped = (bookingsData || []).map(b => mapBooking(b, servicesMap[b.id] || []));
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
        .select('*')
        .or(`id.eq.${req.params.id},booking_code.eq.${req.params.id}`)
        .single();
    if (error || !data) {
        (0, response_js_1.sendError)(res, 'Booking tidak ditemukan', 404, 'NOT_FOUND');
        return;
    }
    const ownerId = data.customer_id || data.user_id;
    if (role === 'customer' && ownerId !== userId) {
        (0, response_js_1.sendError)(res, 'Anda tidak memiliki akses ke booking ini', 403, 'FORBIDDEN');
        return;
    }
    const { data: bServices } = await supabase_js_1.supabaseAdmin
        .from('booking_services')
        .select('*')
        .eq('booking_id', data.id);
    (0, response_js_1.sendSuccess)(res, mapBooking(data, bServices || []), 'Detail booking');
});
exports.bookingsRouter.post('/', async (req, res) => {
    if (!supabase_js_1.supabaseAdmin) {
        (0, response_js_1.sendError)(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
        return;
    }
    const { vehicleId, vehicleName, licensePlate, serviceIds, serviceNames, totalPrice, totalDurationMinutes, scheduledDate, scheduledTimeSlot, problemDescription, photoUrls, } = req.body;
    if (!scheduledDate || !scheduledTimeSlot) {
        (0, response_js_1.sendError)(res, 'Tanggal dan slot waktu kedatangan wajib diisi', 400, 'VALIDATION_ERROR');
        return;
    }
    const userId = req.user.id;
    // Retrieve workshop ID
    const { data: workshops } = await supabase_js_1.supabaseAdmin.from('workshops').select('id').limit(1);
    const workshopId = workshops?.[0]?.id || '185130c5-f388-4b7d-96a8-fe1d94c0de9d';
    // Parse vehicle details
    let vBrand = 'Mobil';
    let vModel = 'Pelanggan';
    let vYear = new Date().getFullYear();
    let vPlate = licensePlate || 'B 1234 TRS';
    if (vehicleName) {
        const parts = String(vehicleName).trim().split(' ');
        if (parts.length >= 1)
            vBrand = parts[0];
        if (parts.length >= 2)
            vModel = parts.slice(1).join(' ');
    }
    // Parse time slot
    const [startTimeStr, endTimeStr] = String(scheduledTimeSlot).split(' - ');
    const startHour = startTimeStr ? startTimeStr.trim() : '08:30';
    const endHour = endTimeStr ? endTimeStr.trim() : '10:00';
    const startTimestamp = `${scheduledDate} ${startHour}:00+00`;
    const endTimestamp = `${scheduledDate} ${endHour}:00+00`;
    const dateCode = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const bookingRef = `MLT-${dateCode}-${randomSuffix}`;
    const { data: booking, error: bErr } = await supabase_js_1.supabaseAdmin
        .from('bookings')
        .insert({
        booking_code: bookingRef,
        customer_id: userId,
        workshop_id: workshopId,
        vehicle_brand: vBrand,
        vehicle_model: vModel,
        vehicle_year: vYear,
        vehicle_plate: vPlate,
        scheduled_start: startTimestamp,
        scheduled_end: endTimestamp,
        status: 'pending',
        customer_notes: problemDescription || 'Servis berkala.',
        subtotal: Number(totalPrice) || 0,
        total: Number(totalPrice) || 0,
    })
        .select()
        .single();
    if (bErr || !booking) {
        (0, response_js_1.sendError)(res, bErr?.message || 'Gagal membuat booking', 500, 'DB_ERROR');
        return;
    }
    // Insert booking services
    const chosenServices = (serviceIds || []).map((id, idx) => ({
        booking_id: booking.id,
        service_id: id,
        service_name: serviceNames?.[idx] || 'Layanan Servis',
        quantity: 1,
        unit_price: Number(totalPrice) || 0,
        subtotal: Number(totalPrice) || 0,
    }));
    if (chosenServices.length > 0) {
        await supabase_js_1.supabaseAdmin.from('booking_services').insert(chosenServices);
    }
    (0, response_js_1.sendSuccess)(res, mapBooking(booking, chosenServices), 'Booking layanan berhasil dikirim. Menunggu konfirmasi mekanik.', 201);
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
        .select('*')
        .eq('id', req.params.id)
        .single();
    if (fetchErr || !booking) {
        (0, response_js_1.sendError)(res, 'Booking tidak ditemukan', 404, 'NOT_FOUND');
        return;
    }
    const ownerId = booking.customer_id || booking.user_id;
    if (status) {
        if (role === 'customer') {
            if (ownerId !== userId) {
                (0, response_js_1.sendError)(res, 'Anda tidak memiliki akses ke booking ini', 403, 'FORBIDDEN');
                return;
            }
            if (!CUSTOMER_ALLOWED_TRANSITIONS.includes(status)) {
                (0, response_js_1.sendError)(res, 'Pelanggan hanya dapat membatalkan booking', 403, 'FORBIDDEN');
                return;
            }
        }
        else if (role === 'mechanic') {
            if (!MECHANIC_ALLOWED_TRANSITIONS.includes(status)) {
                (0, response_js_1.sendError)(res, 'Transisi status tidak valid untuk teknisi', 400, 'INVALID_TRANSITION');
                return;
            }
        }
        const currentStatus = booking.status;
        const allowedNext = VALID_TRANSITIONS[currentStatus] || [];
        if (role !== 'superadmin' && !allowedNext.includes(status)) {
            (0, response_js_1.sendError)(res, `Tidak dapat mengubah status dari '${currentStatus}' ke '${status}'`, 400, 'INVALID_TRANSITION');
            return;
        }
        if (status === 'rejected' && !rejectionReason?.trim()) {
            (0, response_js_1.sendError)(res, 'Alasan penolakan wajib diisi', 400, 'REJECTION_REASON_REQUIRED');
            return;
        }
    }
    const updates = { updated_at: new Date().toISOString() };
    if (status) {
        updates.status = status;
        if (status === 'completed')
            updates.completed_at = new Date().toISOString();
        if (status === 'cancelled' || status === 'rejected')
            updates.cancelled_at = new Date().toISOString();
    }
    if (rejectionReason !== undefined)
        updates.rejection_reason = rejectionReason;
    if (mechanicNotes !== undefined)
        updates.mechanic_notes = mechanicNotes;
    const { data, error } = await supabase_js_1.supabaseAdmin
        .from('bookings')
        .update(updates)
        .eq('id', req.params.id)
        .select('*')
        .single();
    if (error) {
        (0, response_js_1.sendError)(res, error.message, 500, 'DB_ERROR');
        return;
    }
    const { data: bServices } = await supabase_js_1.supabaseAdmin
        .from('booking_services')
        .select('*')
        .eq('booking_id', data.id);
    (0, response_js_1.sendSuccess)(res, mapBooking(data, bServices || []), 'Status booking berhasil diperbarui');
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
