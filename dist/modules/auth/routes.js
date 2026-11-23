"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const auth_js_1 = require("../../middleware/auth.js");
const supabase_js_1 = require("../../config/supabase.js");
const response_js_1 = require("../../utils/response.js");
exports.authRouter = (0, express_1.Router)();
exports.authRouter.get('/me', auth_js_1.authenticateToken, (req, res) => {
    (0, response_js_1.sendSuccess)(res, { user: req.user }, 'Current session profile');
});
exports.authRouter.post('/logout', auth_js_1.authenticateToken, (_req, res) => {
    (0, response_js_1.sendSuccess)(res, { loggedOut: true }, 'Successfully logged out');
});
const handleUpdateProfile = async (req, res) => {
    if (!supabase_js_1.supabaseAdmin) {
        (0, response_js_1.sendError)(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
        return;
    }
    const { fullName, phone } = req.body;
    const updates = { updated_at: new Date().toISOString() };
    if (fullName !== undefined)
        updates.full_name = fullName;
    if (phone !== undefined)
        updates.phone = phone;
    const { data, error } = await supabase_js_1.supabaseAdmin
        .from('profiles')
        .update(updates)
        .eq('id', req.user.id)
        .select('id, full_name, phone, role, is_active, created_at')
        .single();
    if (error) {
        (0, response_js_1.sendError)(res, error.message, 500, 'DB_ERROR');
        return;
    }
    // Also sync with auth.users user_metadata for persistent auth sessions
    try {
        const { data: userRecord } = await supabase_js_1.supabaseAdmin.auth.admin.getUserById(req.user.id);
        if (userRecord?.user) {
            await supabase_js_1.supabaseAdmin.auth.admin.updateUserById(req.user.id, {
                user_metadata: {
                    ...userRecord.user.user_metadata,
                    full_name: fullName !== undefined ? fullName : userRecord.user.user_metadata?.full_name,
                    phone: phone !== undefined ? phone : userRecord.user.user_metadata?.phone,
                },
            });
        }
    }
    catch (metaErr) {
        console.warn('Failed to sync auth user_metadata:', metaErr);
    }
    (0, response_js_1.sendSuccess)(res, {
        id: data.id,
        fullName: data.full_name,
        phone: data.phone,
        role: data.role,
        isActive: data.is_active,
        createdAt: data.created_at,
    }, 'Profil berhasil diperbarui');
};
exports.authRouter.post('/profile', auth_js_1.authenticateToken, handleUpdateProfile);
exports.authRouter.put('/profile', auth_js_1.authenticateToken, handleUpdateProfile);
exports.authRouter.patch('/profile', auth_js_1.authenticateToken, handleUpdateProfile);
