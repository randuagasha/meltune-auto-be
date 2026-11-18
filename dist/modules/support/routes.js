"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supportRouter = void 0;
const express_1 = require("express");
const auth_js_1 = require("../../middleware/auth.js");
const supabase_js_1 = require("../../config/supabase.js");
const response_js_1 = require("../../utils/response.js");
exports.supportRouter = (0, express_1.Router)();
exports.supportRouter.use(auth_js_1.authenticateToken);
function mapThread(t) {
    return {
        id: t.id,
        customerId: t.customer_id,
        customerName: t.profiles?.full_name || '',
        vehicleModel: t.vehicle_model,
        subject: t.subject,
        status: t.status,
        lastActivity: t.last_activity,
        messages: (t.support_messages || []).map((m) => ({
            id: m.id,
            senderId: m.sender_id,
            senderName: m.profiles?.full_name || '',
            senderRole: m.profiles?.role || 'customer',
            content: m.content,
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
    let query = supabase_js_1.supabaseAdmin
        .from('support_threads')
        .select(`
      *,
      profiles!support_threads_customer_id_fkey(full_name),
      support_messages(id, sender_id, content, created_at, profiles!support_messages_sender_id_fkey(full_name, role))
    `)
        .order('last_activity', { ascending: false });
    if (role === 'customer') {
        query = query.eq('customer_id', id);
    }
    const { data, error } = await query;
    if (error) {
        (0, response_js_1.sendError)(res, error.message, 500, 'DB_ERROR');
        return;
    }
    (0, response_js_1.sendSuccess)(res, (data || []).map(mapThread), 'Daftar tiket diskusi dukungan');
});
exports.supportRouter.get('/threads/:id', async (req, res) => {
    if (!supabase_js_1.supabaseAdmin) {
        (0, response_js_1.sendError)(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
        return;
    }
    const { data, error } = await supabase_js_1.supabaseAdmin
        .from('support_threads')
        .select(`
      *,
      profiles!support_threads_customer_id_fkey(full_name),
      support_messages(id, sender_id, content, created_at, profiles!support_messages_sender_id_fkey(full_name, role))
    `)
        .eq('id', req.params.id)
        .single();
    if (error || !data) {
        (0, response_js_1.sendError)(res, 'Diskusi tidak ditemukan', 404, 'NOT_FOUND');
        return;
    }
    if (req.user.role === 'customer' && data.customer_id !== req.user.id) {
        (0, response_js_1.sendError)(res, 'Anda tidak memiliki akses ke diskusi ini', 403, 'FORBIDDEN');
        return;
    }
    (0, response_js_1.sendSuccess)(res, mapThread(data), 'Detail percakapan');
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
    const { data: thread, error: tErr } = await supabase_js_1.supabaseAdmin
        .from('support_threads')
        .insert({
        customer_id: req.user.id,
        subject: subject.trim(),
        vehicle_model: vehicleModel || null,
        status: 'open',
        last_activity: new Date().toISOString(),
    })
        .select()
        .single();
    if (tErr || !thread) {
        (0, response_js_1.sendError)(res, tErr?.message || 'Gagal membuat diskusi', 500, 'DB_ERROR');
        return;
    }
    await supabase_js_1.supabaseAdmin.from('support_messages').insert({
        thread_id: thread.id,
        sender_id: req.user.id,
        content: initialMessage.trim(),
    });
    const { data: fullThread } = await supabase_js_1.supabaseAdmin
        .from('support_threads')
        .select(`
      *,
      profiles!support_threads_customer_id_fkey(full_name),
      support_messages(id, sender_id, content, created_at, profiles!support_messages_sender_id_fkey(full_name, role))
    `)
        .eq('id', thread.id)
        .single();
    (0, response_js_1.sendSuccess)(res, mapThread(fullThread || thread), 'Topik diskusi berhasil dikirim', 201);
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
    const { data: thread, error: tErr } = await supabase_js_1.supabaseAdmin
        .from('support_threads')
        .select('id, customer_id, status')
        .eq('id', req.params.id)
        .single();
    if (tErr || !thread) {
        (0, response_js_1.sendError)(res, 'Diskusi tidak ditemukan', 404, 'NOT_FOUND');
        return;
    }
    const { role, id: userId } = req.user;
    if (role === 'customer' && thread.customer_id !== userId) {
        (0, response_js_1.sendError)(res, 'Anda tidak memiliki akses ke diskusi ini', 403, 'FORBIDDEN');
        return;
    }
    const { data: message, error: mErr } = await supabase_js_1.supabaseAdmin
        .from('support_messages')
        .insert({
        thread_id: req.params.id,
        sender_id: userId,
        content: content.trim(),
    })
        .select(`*, profiles!support_messages_sender_id_fkey(full_name, role)`)
        .single();
    if (mErr) {
        (0, response_js_1.sendError)(res, mErr.message, 500, 'DB_ERROR');
        return;
    }
    const threadUpdates = { last_activity: new Date().toISOString() };
    if (role === 'mechanic' && thread.status === 'open') {
        threadUpdates.status = 'in_progress';
    }
    await supabase_js_1.supabaseAdmin.from('support_threads').update(threadUpdates).eq('id', req.params.id);
    (0, response_js_1.sendSuccess)(res, {
        id: message.id,
        senderId: message.sender_id,
        senderName: message.profiles?.full_name || '',
        senderRole: message.profiles?.role || role,
        content: message.content,
        createdAt: message.created_at,
    }, 'Pesan berhasil dikirim', 201);
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
    const { data, error } = await supabase_js_1.supabaseAdmin
        .from('support_threads')
        .update({ status, last_activity: new Date().toISOString() })
        .eq('id', req.params.id)
        .select()
        .single();
    if (error || !data) {
        (0, response_js_1.sendError)(res, 'Diskusi tidak ditemukan', 404, 'NOT_FOUND');
        return;
    }
    (0, response_js_1.sendSuccess)(res, { id: data.id, status: data.status }, 'Status diskusi diperbarui');
});
