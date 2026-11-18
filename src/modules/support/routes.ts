import { Router } from 'express';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../../middleware/auth.js';
import { supabaseAdmin } from '../../config/supabase.js';
import { sendSuccess, sendError } from '../../utils/response.js';

export const supportRouter = Router();

supportRouter.use(authenticateToken);

function mapThread(t: any) {
  return {
    id: t.id,
    customerId: t.customer_id,
    customerName: t.profiles?.full_name || '',
    vehicleModel: t.vehicle_model,
    subject: t.subject,
    status: t.status,
    lastActivity: t.last_activity,
    messages: (t.support_messages || []).map((m: any) => ({
      id: m.id,
      senderId: m.sender_id,
      senderName: m.profiles?.full_name || '',
      senderRole: m.profiles?.role || 'customer',
      content: m.content,
      createdAt: m.created_at,
    })),
  };
}

supportRouter.get('/threads', async (req: AuthenticatedRequest, res) => {
  if (!supabaseAdmin) {
    sendError(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
    return;
  }
  const { role, id } = req.user!;

  let query = supabaseAdmin
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
    sendError(res, error.message, 500, 'DB_ERROR');
    return;
  }
  sendSuccess(res, (data || []).map(mapThread), 'Daftar tiket diskusi dukungan');
});

supportRouter.get('/threads/:id', async (req: AuthenticatedRequest, res) => {
  if (!supabaseAdmin) {
    sendError(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
    return;
  }
  const { data, error } = await supabaseAdmin
    .from('support_threads')
    .select(`
      *,
      profiles!support_threads_customer_id_fkey(full_name),
      support_messages(id, sender_id, content, created_at, profiles!support_messages_sender_id_fkey(full_name, role))
    `)
    .eq('id', req.params.id)
    .single();

  if (error || !data) {
    sendError(res, 'Diskusi tidak ditemukan', 404, 'NOT_FOUND');
    return;
  }

  if (req.user!.role === 'customer' && data.customer_id !== req.user!.id) {
    sendError(res, 'Anda tidak memiliki akses ke diskusi ini', 403, 'FORBIDDEN');
    return;
  }

  sendSuccess(res, mapThread(data), 'Detail percakapan');
});

supportRouter.post('/threads', async (req: AuthenticatedRequest, res) => {
  if (!supabaseAdmin) {
    sendError(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
    return;
  }
  const { subject, vehicleModel, initialMessage } = req.body;
  if (!subject || !initialMessage) {
    sendError(res, 'Subjek dan pertanyaan awal wajib diisi', 400, 'VALIDATION_ERROR');
    return;
  }

  const { data: thread, error: tErr } = await supabaseAdmin
    .from('support_threads')
    .insert({
      customer_id: req.user!.id,
      subject: subject.trim(),
      vehicle_model: vehicleModel || null,
      status: 'open',
      last_activity: new Date().toISOString(),
    })
    .select()
    .single();

  if (tErr || !thread) {
    sendError(res, tErr?.message || 'Gagal membuat diskusi', 500, 'DB_ERROR');
    return;
  }

  await supabaseAdmin.from('support_messages').insert({
    thread_id: thread.id,
    sender_id: req.user!.id,
    content: initialMessage.trim(),
  });

  const { data: fullThread } = await supabaseAdmin
    .from('support_threads')
    .select(`
      *,
      profiles!support_threads_customer_id_fkey(full_name),
      support_messages(id, sender_id, content, created_at, profiles!support_messages_sender_id_fkey(full_name, role))
    `)
    .eq('id', thread.id)
    .single();

  sendSuccess(res, mapThread(fullThread || thread), 'Topik diskusi berhasil dikirim', 201);
});

supportRouter.post('/threads/:id/messages', async (req: AuthenticatedRequest, res) => {
  if (!supabaseAdmin) {
    sendError(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
    return;
  }
  const { content } = req.body;
  if (!content?.trim()) {
    sendError(res, 'Pesan tidak boleh kosong', 400, 'VALIDATION_ERROR');
    return;
  }

  const { data: thread, error: tErr } = await supabaseAdmin
    .from('support_threads')
    .select('id, customer_id, status')
    .eq('id', req.params.id)
    .single();

  if (tErr || !thread) {
    sendError(res, 'Diskusi tidak ditemukan', 404, 'NOT_FOUND');
    return;
  }

  const { role, id: userId } = req.user!;
  if (role === 'customer' && thread.customer_id !== userId) {
    sendError(res, 'Anda tidak memiliki akses ke diskusi ini', 403, 'FORBIDDEN');
    return;
  }

  const { data: message, error: mErr } = await supabaseAdmin
    .from('support_messages')
    .insert({
      thread_id: req.params.id,
      sender_id: userId,
      content: content.trim(),
    })
    .select(`*, profiles!support_messages_sender_id_fkey(full_name, role)`)
    .single();

  if (mErr) {
    sendError(res, mErr.message, 500, 'DB_ERROR');
    return;
  }

  const threadUpdates: Record<string, any> = { last_activity: new Date().toISOString() };
  if (role === 'mechanic' && thread.status === 'open') {
    threadUpdates.status = 'in_progress';
  }
  await supabaseAdmin.from('support_threads').update(threadUpdates).eq('id', req.params.id);

  sendSuccess(res, {
    id: message.id,
    senderId: message.sender_id,
    senderName: message.profiles?.full_name || '',
    senderRole: message.profiles?.role || role,
    content: message.content,
    createdAt: message.created_at,
  }, 'Pesan berhasil dikirim', 201);
});

supportRouter.patch('/threads/:id/status', requireRole('mechanic', 'superadmin'), async (req, res) => {
  if (!supabaseAdmin) {
    sendError(res, 'Database service not available', 503, 'DB_UNAVAILABLE');
    return;
  }
  const { status } = req.body;
  const validStatuses = ['open', 'in_progress', 'resolved'];
  if (!status || !validStatuses.includes(status)) {
    sendError(res, 'Status tidak valid', 400, 'INVALID_STATUS');
    return;
  }
  const { data, error } = await supabaseAdmin
    .from('support_threads')
    .update({ status, last_activity: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error || !data) {
    sendError(res, 'Diskusi tidak ditemukan', 404, 'NOT_FOUND');
    return;
  }
  sendSuccess(res, { id: data.id, status: data.status }, 'Status diskusi diperbarui');
});
