"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardRouter = void 0;
const express_1 = require("express");
const auth_js_1 = require("../../middleware/auth.js");
const supabase_js_1 = require("../../config/supabase.js");
const response_js_1 = require("../../utils/response.js");
exports.dashboardRouter = (0, express_1.Router)();
exports.dashboardRouter.get('/admin', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)('superadmin'), async (_req, res) => {
    if (!supabase_js_1.supabaseAdmin) {
        (0, response_js_1.sendError)(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
        return;
    }
    const [{ count: totalBookings }, { count: completedBookings }, { count: pendingBookings }, { count: cancelledBookings }, { count: rejectedBookings }, { count: totalCustomers }, { count: totalMechanics }, { data: completedOrders }, { data: bookingsByService }, { data: recentBookings },] = await Promise.all([
        supabase_js_1.supabaseAdmin.from('bookings').select('id', { count: 'exact', head: true }),
        supabase_js_1.supabaseAdmin.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
        supabase_js_1.supabaseAdmin.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase_js_1.supabaseAdmin.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'cancelled'),
        supabase_js_1.supabaseAdmin.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
        supabase_js_1.supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'customer').eq('is_active', true),
        supabase_js_1.supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'mechanic').eq('is_active', true),
        supabase_js_1.supabaseAdmin.from('orders').select('*').eq('status', 'completed'),
        supabase_js_1.supabaseAdmin.from('booking_services').select('service_id, price_at_booking, unit_price, services(name)').limit(1000),
        supabase_js_1.supabaseAdmin.from('bookings').select('*').order('created_at', { ascending: false }).limit(500),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    const thisMonth = new Date().toISOString().slice(0, 7);
    const thisYear = new Date().getFullYear().toString();
    const getBookingTotal = (b) => Number(b.total ?? b.total_price ?? b.subtotal ?? 0);
    const getOrderTotal = (o) => Number(o.total ?? o.total_amount ?? 0);
    const serviceRevenue = (recentBookings || [])
        .filter((b) => b.status === 'completed')
        .reduce((acc, b) => acc + getBookingTotal(b), 0);
    const partsRevenue = (completedOrders || [])
        .reduce((acc, o) => acc + getOrderTotal(o), 0);
    const dailyRevenue = (recentBookings || [])
        .filter((b) => b.status === 'completed' && b.created_at?.startsWith(today))
        .reduce((acc, b) => acc + getBookingTotal(b), 0)
        + (completedOrders || [])
            .filter((o) => o.created_at?.startsWith(today))
            .reduce((acc, o) => acc + getOrderTotal(o), 0);
    const monthlyRevenue = (recentBookings || [])
        .filter((b) => b.status === 'completed' && b.created_at?.startsWith(thisMonth))
        .reduce((acc, b) => acc + getBookingTotal(b), 0)
        + (completedOrders || [])
            .filter((o) => o.created_at?.startsWith(thisMonth))
            .reduce((acc, o) => acc + getOrderTotal(o), 0);
    const yearlyRevenue = (recentBookings || [])
        .filter((b) => b.status === 'completed' && b.created_at?.startsWith(thisYear))
        .reduce((acc, b) => acc + getBookingTotal(b), 0)
        + (completedOrders || [])
            .filter((o) => o.created_at?.startsWith(thisYear))
            .reduce((acc, o) => acc + getOrderTotal(o), 0);
    const serviceMap = {};
    for (const bs of bookingsByService || []) {
        const sid = bs.service_id;
        const name = bs.services?.name || sid;
        if (!serviceMap[sid])
            serviceMap[sid] = { name, count: 0, revenue: 0 };
        serviceMap[sid].count += 1;
        serviceMap[sid].revenue += Number(bs.price_at_booking ?? bs.unit_price ?? 0);
    }
    const totalServiceBookings = Object.values(serviceMap).reduce((a, s) => a + s.count, 0);
    const popularServices = Object.values(serviceMap)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map(s => ({
        name: s.name,
        bookingsCount: s.count,
        sharePercent: totalServiceBookings > 0 ? Math.round((s.count / totalServiceBookings) * 100) : 0,
        revenue: s.revenue,
    }));
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const revenueTrends = months.slice(0, new Date().getMonth() + 1).map((month, i) => {
        const monthStr = `${thisYear}-${String(i + 1).padStart(2, '0')}`;
        const sRev = (recentBookings || [])
            .filter((b) => b.status === 'completed' && b.created_at?.startsWith(monthStr))
            .reduce((acc, b) => acc + Number(b.total_price), 0);
        const pRev = (completedOrders || [])
            .filter((o) => o.created_at?.startsWith(monthStr))
            .reduce((acc, o) => acc + Number(o.total_amount), 0);
        return { month, serviceRevenue: sRev, partsRevenue: pRev };
    });
    (0, response_js_1.sendSuccess)(res, {
        overview: {
            totalRevenue: serviceRevenue + partsRevenue,
            dailyRevenue,
            monthlyRevenue,
            yearlyRevenue,
            totalBookings: totalBookings || 0,
            completedBookings: completedBookings || 0,
            pendingBookings: pendingBookings || 0,
            cancelledBookings: (cancelledBookings || 0) + (rejectedBookings || 0),
            totalCustomers: totalCustomers || 0,
            totalMechanics: totalMechanics || 0,
            productSalesCount: (completedOrders || []).length,
        },
        popularServices,
        revenueTrends,
    }, 'Data analitik bisnis MELTUNE AUTO');
});
exports.dashboardRouter.get('/mechanic', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)('mechanic', 'superadmin'), async (_req, res) => {
    if (!supabase_js_1.supabaseAdmin) {
        (0, response_js_1.sendError)(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
        return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const [{ count: todayCount }, { count: pendingCount }, { count: inProgressCount }, { count: completedTodayCount }, { data: activeBookings },] = await Promise.all([
        supabase_js_1.supabaseAdmin.from('bookings').select('id', { count: 'exact', head: true }).not('status', 'in', '("cancelled","rejected")'),
        supabase_js_1.supabaseAdmin.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase_js_1.supabaseAdmin.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'in_progress'),
        supabase_js_1.supabaseAdmin.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
        supabase_js_1.supabaseAdmin.from('bookings')
            .select('id, booking_reference, booking_code, status, scheduled_time_slot, scheduled_start, vehicle_brand, vehicle_model, vehicle_year, vehicle_plate')
            .in('status', ['confirmed', 'in_progress'])
            .order('created_at', { ascending: false })
            .limit(4),
    ]);
    const activeIds = (activeBookings || []).map((b) => b.id);
    let servicesByBooking = {};
    if (activeIds.length > 0) {
        const { data: bServices } = await supabase_js_1.supabaseAdmin
            .from('booking_services')
            .select('booking_id, service_name, services(name)')
            .in('booking_id', activeIds);
        for (const bs of bServices || []) {
            const sName = bs.service_name || bs.services?.name;
            if (sName && !servicesByBooking[bs.booking_id]) {
                servicesByBooking[bs.booking_id] = sName;
            }
        }
    }
    const bayAllocations = (activeBookings || []).map((b, i) => {
        const vName = b.vehicle_brand
            ? `${b.vehicle_brand} ${b.vehicle_model || ''} (${b.vehicle_plate || ''})`.trim()
            : b.vehicle_name || 'Mobil Pelanggan';
        return {
            bayNumber: `Bay ${i + 1}`,
            vehicle: vName,
            service: servicesByBooking[b.id] || 'Servis Berkala Standar',
            status: b.status === 'in_progress' ? 'In Progress' : 'Scheduled',
            bookingReference: b.booking_reference || b.booking_code || `BK-${b.id.slice(0, 8).toUpperCase()}`,
        };
    });
    while (bayAllocations.length < 4) {
        bayAllocations.push({
            bayNumber: `Bay ${bayAllocations.length + 1}`,
            vehicle: 'Empty / Standby',
            service: 'Siap untuk alokasi servis',
            status: 'Idle',
            bookingReference: '',
        });
    }
    (0, response_js_1.sendSuccess)(res, {
        todayBookingsCount: todayCount || 0,
        pendingActionCount: pendingCount || 0,
        inProgressBayCount: inProgressCount || 0,
        completedTodayCount: completedTodayCount || 0,
        activeBayAllocations: bayAllocations.slice(0, 4),
    }, 'Ringkasan operasional mekanik');
});
