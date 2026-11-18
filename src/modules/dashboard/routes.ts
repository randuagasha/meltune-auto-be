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
    supabaseAdmin.from('orders').select('total_amount, created_at').eq('status', 'completed'),
    supabaseAdmin.from('booking_services').select('service_id, price_at_booking, services(name)').limit(1000),
    supabaseAdmin.from('bookings').select('total_price, created_at, status').order('created_at', { ascending: false }).limit(500),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const thisYear = new Date().getFullYear().toString();

  const serviceRevenue = (recentBookings || [])
    .filter((b: any) => b.status === 'completed')
    .reduce((acc: number, b: any) => acc + Number(b.total_price), 0);

  const partsRevenue = (completedOrders || [])
    .reduce((acc: number, o: any) => acc + Number(o.total_amount), 0);

  const dailyRevenue = (recentBookings || [])
    .filter((b: any) => b.status === 'completed' && b.created_at?.startsWith(today))
    .reduce((acc: number, b: any) => acc + Number(b.total_price), 0)
    + (completedOrders || [])
    .filter((o: any) => o.created_at?.startsWith(today))
    .reduce((acc: number, o: any) => acc + Number(o.total_amount), 0);

  const monthlyRevenue = (recentBookings || [])
    .filter((b: any) => b.status === 'completed' && b.created_at?.startsWith(thisMonth))
    .reduce((acc: number, b: any) => acc + Number(b.total_price), 0)
    + (completedOrders || [])
    .filter((o: any) => o.created_at?.startsWith(thisMonth))
    .reduce((acc: number, o: any) => acc + Number(o.total_amount), 0);

  const yearlyRevenue = (recentBookings || [])
    .filter((b: any) => b.status === 'completed' && b.created_at?.startsWith(thisYear))
    .reduce((acc: number, b: any) => acc + Number(b.total_price), 0)
    + (completedOrders || [])
    .filter((o: any) => o.created_at?.startsWith(thisYear))
    .reduce((acc: number, o: any) => acc + Number(o.total_amount), 0);

  const serviceMap: Record<string, { name: string; count: number; revenue: number }> = {};
  for (const bs of bookingsByService || []) {
    const sid = (bs as any).service_id;
    const name = (bs as any).services?.name || sid;
    if (!serviceMap[sid]) serviceMap[sid] = { name, count: 0, revenue: 0 };
    serviceMap[sid].count += 1;
    serviceMap[sid].revenue += Number((bs as any).price_at_booking);
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
      .reduce((acc: number, b: any) => acc + Number(b.total_price), 0);
    const pRev = (completedOrders || [])
      .filter((o: any) => o.created_at?.startsWith(monthStr))
      .reduce((acc: number, o: any) => acc + Number(o.total_amount), 0);
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
    supabaseAdmin.from('bookings').select('id', { count: 'exact', head: true }).eq('scheduled_date', today).not('status', 'in', '("cancelled","rejected")'),
    supabaseAdmin.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabaseAdmin.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'in_progress'),
    supabaseAdmin.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'completed').eq('scheduled_date', today),
    supabaseAdmin.from('bookings')
      .select(`
        id, booking_reference, status, scheduled_time_slot,
        vehicles(brand, model, year, license_plate),
        booking_services(services(name))
      `)
      .eq('scheduled_date', today)
      .in('status', ['confirmed', 'in_progress'])
      .order('scheduled_time_slot'),
  ]);

  const bayAllocations = (activeBookings || []).map((b: any, i: number) => ({
    bayNumber: `Bay ${i + 1}`,
    vehicle: `${b.vehicles?.brand || ''} ${b.vehicles?.model || ''} (${b.vehicles?.license_plate || ''})`,
    service: b.booking_services?.[0]?.services?.name || '-',
    status: b.status === 'in_progress' ? 'In Progress' : 'Scheduled',
    bookingReference: b.booking_reference,
  }));

  while (bayAllocations.length < 4) {
    bayAllocations.push({ bayNumber: `Bay ${bayAllocations.length + 1}`, vehicle: 'Empty / Standby', service: '-', status: 'Idle', bookingReference: '' });
  }

  sendSuccess(res, {
    todayBookingsCount: todayCount || 0,
    pendingActionCount: pendingCount || 0,
    inProgressBayCount: inProgressCount || 0,
    completedTodayCount: completedTodayCount || 0,
    activeBayAllocations: bayAllocations.slice(0, 4),
  }, 'Ringkasan operasional mekanik');
});
