import { Router } from 'express';
import { authenticateToken, requireRole } from '../../middleware/auth.js';
import { supabaseAdmin } from '../../config/supabase.js';
import { sendSuccess, sendError } from '../../utils/response.js';

export const dashboardRouter = Router();

dashboardRouter.get('/admin', authenticateToken, requireRole('superadmin'), async (_req, res) => {
  if (!supabaseAdmin) {
    sendError(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
    return;
  }

  const [
    { count: totalBookings },
    { count: completedBookings },
    { count: pendingBookings },
    { count: cancelledBookings },
    { count: rejectedBookings },
    { count: totalCustomers },
    { count: totalMechanics },
    { data: completedOrders },
    { data: bookingsByService },
    { data: recentBookings },
  ] = await Promise.all([
    supabaseAdmin.from('bookings').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
    supabaseAdmin.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabaseAdmin.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'cancelled'),
    supabaseAdmin.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
    supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'customer').eq('is_active', true),
    supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'mechanic').eq('is_active', true),
    supabaseAdmin.from('orders').select('*').eq('status', 'completed'),
    supabaseAdmin.from('booking_services').select('service_id, price_at_booking, unit_price, services(name)').limit(1000),
    supabaseAdmin.from('bookings').select('*').order('created_at', { ascending: false }).limit(500),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const thisYear = new Date().getFullYear().toString();

  const getBookingTotal = (b: any) => Number(b.total ?? b.total_price ?? b.subtotal ?? 0);
  const getOrderTotal = (o: any) => Number(o.total ?? o.total_amount ?? 0);

  const serviceRevenue = (recentBookings || [])
    .filter((b: any) => b.status === 'completed')
    .reduce((acc: number, b: any) => acc + getBookingTotal(b), 0);

  const partsRevenue = (completedOrders || [])
    .reduce((acc: number, o: any) => acc + getOrderTotal(o), 0);

  const dailyRevenue = (recentBookings || [])
    .filter((b: any) => b.status === 'completed' && b.created_at?.startsWith(today))
    .reduce((acc: number, b: any) => acc + getBookingTotal(b), 0)
    + (completedOrders || [])
    .filter((o: any) => o.created_at?.startsWith(today))
    .reduce((acc: number, o: any) => acc + getOrderTotal(o), 0);

  const monthlyRevenue = (recentBookings || [])
    .filter((b: any) => b.status === 'completed' && b.created_at?.startsWith(thisMonth))
    .reduce((acc: number, b: any) => acc + getBookingTotal(b), 0)
    + (completedOrders || [])
    .filter((o: any) => o.created_at?.startsWith(thisMonth))
    .reduce((acc: number, o: any) => acc + getOrderTotal(o), 0);

  const yearlyRevenue = (recentBookings || [])
    .filter((b: any) => b.status === 'completed' && b.created_at?.startsWith(thisYear))
    .reduce((acc: number, b: any) => acc + getBookingTotal(b), 0)
    + (completedOrders || [])
    .filter((o: any) => o.created_at?.startsWith(thisYear))
    .reduce((acc: number, o: any) => acc + getOrderTotal(o), 0);

  const serviceMap: Record<string, { name: string; count: number; revenue: number }> = {};
  for (const bs of bookingsByService || []) {
    const sid = (bs as any).service_id;
    const name = (bs as any).services?.name || sid;
    if (!serviceMap[sid]) serviceMap[sid] = { name, count: 0, revenue: 0 };
    serviceMap[sid].count += 1;
    serviceMap[sid].revenue += Number((bs as any).price_at_booking ?? (bs as any).unit_price ?? 0);
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
      .filter((b: any) => b.status === 'completed' && b.created_at?.startsWith(monthStr))
      .reduce((acc: number, b: any) => acc + getBookingTotal(b), 0);
    const pRev = (completedOrders || [])
      .filter((o: any) => o.created_at?.startsWith(monthStr))
      .reduce((acc: number, o: any) => acc + getOrderTotal(o), 0);
    return { month, serviceRevenue: sRev, partsRevenue: pRev };
  });

  sendSuccess(res, {
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

dashboardRouter.get('/mechanic', authenticateToken, requireRole('mechanic', 'superadmin'), async (_req, res) => {
  if (!supabaseAdmin) {
    sendError(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
    return;
  }

  const today = new Date().toISOString().slice(0, 10);

  const [
    { count: todayCount },
    { count: pendingCount },
    { count: inProgressCount },
    { count: completedTodayCount },
    { data: activeBookings },
  ] = await Promise.all([
    supabaseAdmin.from('bookings').select('id', { count: 'exact', head: true }).not('status', 'in', '("cancelled","rejected")'),
    supabaseAdmin.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabaseAdmin.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'in_progress'),
    supabaseAdmin.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
    supabaseAdmin.from('bookings')
      .select('id, booking_reference, booking_code, status, scheduled_time_slot, scheduled_start, vehicle_brand, vehicle_model, vehicle_year, vehicle_plate')
      .in('status', ['confirmed', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(4),
  ]);

  const activeIds = (activeBookings || []).map((b: any) => b.id);
  let servicesByBooking: Record<string, string> = {};
  if (activeIds.length > 0) {
    const { data: bServices } = await supabaseAdmin
      .from('booking_services')
      .select('booking_id, service_name, services(name)')
      .in('booking_id', activeIds);
    for (const bs of bServices || []) {
      const sName = (bs as any).service_name || (bs as any).services?.name;
      if (sName && !servicesByBooking[(bs as any).booking_id]) {
        servicesByBooking[(bs as any).booking_id] = sName;
      }
    }
  }

  const bayAllocations = (activeBookings || []).map((b: any, i: number) => {
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

  sendSuccess(res, {
    todayBookingsCount: todayCount || 0,
    pendingActionCount: pendingCount || 0,
    inProgressBayCount: inProgressCount || 0,
    completedTodayCount: completedTodayCount || 0,
    activeBayAllocations: bayAllocations.slice(0, 4),
  }, 'Ringkasan operasional mekanik');
});
