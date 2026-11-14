"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardRouter = void 0;
const express_1 = require("express");
const auth_js_1 = require("../../middleware/auth.js");
const response_js_1 = require("../../utils/response.js");
exports.dashboardRouter = (0, express_1.Router)();
exports.dashboardRouter.get('/admin', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)('superadmin'), (_req, res) => {
    const analytics = {
        overview: {
            totalRevenue: 48650000,
            dailyRevenue: 2450000,
            monthlyRevenue: 34800000,
            yearlyRevenue: 218500000,
            totalBookings: 148,
            completedBookings: 132,
            pendingBookings: 5,
            cancelledBookings: 11,
            totalCustomers: 86,
            totalMechanics: 4,
            productSalesCount: 64,
        },
        popularServices: [
            { name: 'Advanced Engine Tune-Up', bookingsCount: 54, sharePercent: 36 },
            { name: 'Full Synthetic Fluid & Filter', bookingsCount: 42, sharePercent: 28 },
            { name: 'Precision Brake Overhaul', bookingsCount: 26, sharePercent: 18 },
            { name: 'Suspension & Laser Alignment', bookingsCount: 16, sharePercent: 11 },
            { name: 'Climate Purge & Ozone', bookingsCount: 10, sharePercent: 7 },
        ],
        revenueTrends: [
            { month: 'Jun', serviceRevenue: 18200000, partsRevenue: 7500000 },
            { month: 'Jul', serviceRevenue: 21400000, partsRevenue: 9200000 },
            { month: 'Agu', serviceRevenue: 24000000, partsRevenue: 10100000 },
            { month: 'Sep', serviceRevenue: 22800000, partsRevenue: 8900000 },
            { month: 'Okt', serviceRevenue: 26500000, partsRevenue: 11400000 },
            { month: 'Nov', serviceRevenue: 23100000, partsRevenue: 11700000 },
        ],
    };
    (0, response_js_1.sendSuccess)(res, analytics, 'Data analitik bisnis TORSI');
});
exports.dashboardRouter.get('/mechanic', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)('mechanic', 'superadmin'), (_req, res) => {
    const summary = {
        todayBookingsCount: 4,
        pendingActionCount: 1,
        inProgressBayCount: 2,
        completedTodayCount: 1,
        activeBayAllocations: [
            { bayNumber: 'Bay 1', vehicle: 'Mazda 3 Hatchback (B 8832 KLO)', service: 'Suspension Laser Alignment', status: 'In Inspection' },
            { bayNumber: 'Bay 2', vehicle: 'Honda Civic Turbo (B 1045 TRS)', service: 'Advanced Engine Tune-Up', status: 'In Progress' },
            { bayNumber: 'Bay 3', vehicle: 'Toyota Fortuner (B 2291 TIK)', service: 'Brake Fluid Flushing', status: 'Completed & Ready' },
            { bayNumber: 'Bay 4', vehicle: 'Empty / Standby', service: '-', status: 'Idle' },
        ],
    };
    (0, response_js_1.sendSuccess)(res, summary, 'Ringkasan operasional mekanik');
});
