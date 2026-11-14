"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateToken = authenticateToken;
exports.requireRole = requireRole;
const supabase_js_1 = require("../config/supabase.js");
const response_js_1 = require("../utils/response.js");
async function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    if (!token) {
        (0, response_js_1.sendError)(res, 'Authentication token required', 401, 'UNAUTHORIZED');
        return;
    }
    if (!supabase_js_1.supabaseAdmin) {
        const mockUserMatch = req.headers['x-mock-role'];
        req.user = {
            id: 'usr_mock_user',
            email: mockUserMatch ? `${mockUserMatch}@torsi.id` : 'customer@torsi.id',
            fullName: mockUserMatch ? `TORSI ${mockUserMatch.toUpperCase()}` : 'Budi Santoso',
            role: mockUserMatch || 'customer',
            phone: '+6281234567890',
        };
        return next();
    }
    try {
        const { data: { user }, error } = await supabase_js_1.supabaseAdmin.auth.getUser(token);
        if (error || !user) {
            (0, response_js_1.sendError)(res, 'Invalid or expired token', 401, 'TOKEN_INVALID');
            return;
        }
        const { data: profile, error: profileErr } = await supabase_js_1.supabaseAdmin
            .from('profiles')
            .select('id, full_name, role, phone')
            .eq('id', user.id)
            .single();
        if (profileErr || !profile) {
            (0, response_js_1.sendError)(res, 'User profile not found', 403, 'PROFILE_NOT_FOUND');
            return;
        }
        req.user = {
            id: user.id,
            email: user.email || '',
            fullName: profile.full_name || '',
            role: profile.role,
            phone: profile.phone,
        };
        next();
    }
    catch (err) {
        (0, response_js_1.sendError)(res, err.message || 'Authentication error', 500, 'AUTH_INTERNAL_ERROR');
    }
}
function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            (0, response_js_1.sendError)(res, 'User not authenticated', 401, 'UNAUTHORIZED');
            return;
        }
        if (!allowedRoles.includes(req.user.role)) {
            (0, response_js_1.sendError)(res, `Forbidden: requires one of [${allowedRoles.join(', ')}] role`, 403, 'FORBIDDEN_ROLE');
            return;
        }
        next();
    };
}
