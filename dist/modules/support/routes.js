"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supportRouter = void 0;
const express_1 = require("express");
const auth_js_1 = require("../../middleware/auth.js");
const supabase_js_1 = require("../../config/supabase.js");
const response_js_1 = require("../../utils/response.js");
exports.supportRouter = (0, express_1.Router)();
exports.supportRouter.use(auth_js_1.authenticateToken);
function mapTicket(t, messages) {
    return {
        id: t.id,
        customerId: t.customer_id,
        customerName: t.customer_name || 'Pelanggan',
        vehicleModel: t.vehicle_model || 'Mobil Pelanggan',
        subject: t.subject || `Tiket ${t.ticket_code || t.id}`,
        status: t.status || 'open',
        lastActivity: t.updated_at || t.created_at,
        messages: (messages || []).map((m) => ({
            id: m.id,
            senderId: m.sender_id,
            senderName: m.sender_name || 'Staff MELTUNE',
            senderRole: m.sender_id === t.customer_id ? 'customer' : 'mechanic',
            content: m.message || m.content || '',
            createdAt: m.created_at,
        })),
    };
}
exports.supportRouter.get('/threads', async (req, res) => {
    if (!supabase_js_1.supabaseAdmin) {
        (0, response_js_1.sendError)(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
        return;
    }
    const { role, id } = req.user;
    try {
        let query = supabase_js_1.supabaseAdmin
            .from('support_tickets')
            .select('*')
            .order('created_at', { ascending: false });
        if (role === 'customer') {
            query = query.eq('customer_id', id);
        }
        const { data: tickets, error: tErr } = await query;
        if (!tErr && tickets) {
            const ticketIds = tickets.map(t => t.id);
            let messagesMap = {};
            if (ticketIds.length > 0) {
                const { data: messages } = await supabase_js_1.supabaseAdmin
                    .from('support_messages')
                    .select('*')
                    .in('ticket_id', ticketIds)
                    .order('created_at', { ascending: true });
                for (const m of messages || []) {
                    if (!messagesMap[m.ticket_id])
                        messagesMap[m.ticket_id] = [];
                    messagesMap[m.ticket_id].push(m);
                }
            }
            const mapped = tickets.map(t => mapTicket(t, messagesMap[t.id] || []));
            (0, response_js_1.sendSuccess)(res, mapped, 'Daftar tiket diskusi dukungan');
            return;
        }
    }
    catch { }
    (0, response_js_1.sendSuccess)(res, [], 'Daftar tiket diskusi dukungan');
});
exports.supportRouter.get('/threads/:id', async (req, res) => {
    if (!supabase_js_1.supabaseAdmin) {
        (0, response_js_1.sendError)(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
        return;
    }
    try {
        const { data: ticket, error } = await supabase_js_1.supabaseAdmin
            .from('support_tickets')
            .select('*')
            .eq('id', req.params.id)
            .single();
        if (!error && ticket) {
            if (req.user.role === 'customer' && ticket.customer_id !== req.user.id) {
                (0, response_js_1.sendError)(res, 'Anda tidak memiliki akses ke diskusi ini', 403, 'FORBIDDEN');
                return;
            }
            const { data: messages } = await supabase_js_1.supabaseAdmin
                .from('support_messages')
                .select('*')
                .eq('ticket_id', ticket.id)
                .order('created_at', { ascending: true });
            (0, response_js_1.sendSuccess)(res, mapTicket(ticket, messages || []), 'Detail percakapan');
            return;
        }
    }
    catch { }
    (0, response_js_1.sendError)(res, 'Diskusi tidak ditemukan', 404, 'NOT_FOUND');
});
exports.supportRouter.post('/threads', async (req, res) => {
    if (!supabase_js_1.supabaseAdmin) {
        (0, response_js_1.sendError)(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
        return;
    }
    const { subject, vehicleModel, initialMessage } = req.body;
    if (!subject || !initialMessage) {
        (0, response_js_1.sendError)(res, 'Subjek dan pertanyaan awal wajib diisi', 400, 'VALIDATION_ERROR');
        return;
    }
    const userId = req.user.id;
    const ticketCode = `TCK-${Math.floor(1000 + Math.random() * 9000)}`;
    try {
        const { data: ticket, error: tErr } = await supabase_js_1.supabaseAdmin
            .from('support_tickets')
            .insert({
            ticket_code: ticketCode,
            customer_id: userId,
            subject: subject.trim(),
            status: 'open',
        })
            .select()
            .single();
        if (!tErr && ticket) {
            await supabase_js_1.supabaseAdmin.from('support_messages').insert({
                ticket_id: ticket.id,
                sender_id: userId,
                message: initialMessage.trim(),
            });
            const initialMsgObj = {
                id: 'msg_' + Date.now(),
                sender_id: userId,
                message: initialMessage.trim(),
                created_at: new Date().toISOString(),
            };
            (0, response_js_1.sendSuccess)(res, mapTicket({ ...ticket, vehicle_model: vehicleModel }, [initialMsgObj]), 'Topik diskusi berhasil dibuat', 201);
            return;
        }
    }
    catch { }
    (0, response_js_1.sendError)(res, 'Gagal membuat tiket diskusi', 500, 'DB_ERROR');
});
exports.supportRouter.post('/threads/:id/messages', async (req, res) => {
    if (!supabase_js_1.supabaseAdmin) {
        (0, response_js_1.sendError)(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
        return;
    }
    const { content } = req.body;
    if (!content?.trim()) {
        (0, response_js_1.sendError)(res, 'Pesan tidak boleh kosong', 400, 'VALIDATION_ERROR');
        return;
    }
    const userId = req.user.id;
    const role = req.user.role;
    try {
        const { data: msg, error: mErr } = await supabase_js_1.supabaseAdmin
            .from('support_messages')
            .insert({
            ticket_id: req.params.id,
            sender_id: userId,
            message: content.trim(),
        })
            .select()
            .single();
        if (!mErr && msg) {
            await supabase_js_1.supabaseAdmin
                .from('support_tickets')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', req.params.id);
            (0, response_js_1.sendSuccess)(res, {
                id: msg.id,
                senderId: msg.sender_id,
                senderName: req.user.role === 'customer' ? 'Pelanggan' : 'Staff Mekanik',
                senderRole: role,
                content: msg.message,
                createdAt: msg.created_at,
            }, 'Pesan berhasil dikirim', 201);
            return;
        }
    }
    catch { }
    (0, response_js_1.sendError)(res, 'Gagal mengirim pesan', 500, 'DB_ERROR');
});
exports.supportRouter.patch('/threads/:id/status', (0, auth_js_1.requireRole)('mechanic', 'superadmin'), async (req, res) => {
    if (!supabase_js_1.supabaseAdmin) {
        (0, response_js_1.sendError)(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
        return;
    }
    const { status } = req.body;
    const validStatuses = ['open', 'in_progress', 'resolved'];
    if (!status || !validStatuses.includes(status)) {
        (0, response_js_1.sendError)(res, 'Status tidak valid', 400, 'INVALID_STATUS');
        return;
    }
    try {
        const { data, error } = await supabase_js_1.supabaseAdmin
            .from('support_tickets')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', req.params.id)
            .select()
            .single();
        if (!error && data) {
            (0, response_js_1.sendSuccess)(res, { id: data.id, status: data.status }, 'Status tiket diperbarui');
            return;
        }
    }
    catch { }
    (0, response_js_1.sendError)(res, 'Tiket diskusi tidak ditemukan', 404, 'NOT_FOUND');
});
