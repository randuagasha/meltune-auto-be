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
        if (process.env.NODE_ENV === 'test') {
            const mockRole = req.headers['x-mock-role'];
            const validRoles = ['customer', 'mechanic', 'superadmin'];
            const role = mockRole && validRoles.includes(mockRole) ? mockRole : 'customer';
            req.user = {
                id: `usr_test_${role}`,
                email: `${role}@test.meltune.id`,
                fullName: role === 'customer' ? 'Test Customer' : role === 'mechanic' ? 'Test Mechanic' : 'Test Admin',
                role,
                phone: '+6281234567890',
                isActive: true,
            };
            return next();
        }
        (0, response_js_1.sendError)(res, 'Server authentication service not configured. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required.', 503, 'AUTH_SERVICE_UNAVAILABLE');
        return;
    }
    try {
        const { data: { user }, error } = await supabase_js_1.supabaseAdmin.auth.getUser(token);
        if (error || !user) {
            (0, response_js_1.sendError)(res, 'Invalid or expired token', 401, 'TOKEN_INVALID');
            return;
        }
        const { data: profile, error: profileErr } = await supabase_js_1.supabaseAdmin
            .from('profiles')
            .select('id, full_name, role, phone, is_active')
            .eq('id', user.id)
            .single();
        if (profileErr || !profile) {
            (0, response_js_1.sendError)(res, 'User profile not found', 403, 'PROFILE_NOT_FOUND');
            return;
        }
        if (!profile.is_active) {
            (0, response_js_1.sendError)(res, 'Account has been suspended. Please contact support.', 403, 'ACCOUNT_SUSPENDED');
            return;
        }
        req.user = {
            id: user.id,
            email: user.email || '',
            fullName: profile.full_name || '',
            role: profile.role,
            phone: profile.phone,
            isActive: profile.is_active,
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
