const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const Booking = require('../models/Booking');
const Ticket = require('../models/Ticket');
const TicketMedia = require('../models/TicketMedia');
const TicketLog = require('../models/TicketLog');
const Vendor = require('../models/Vendor');
const User = require('../models/User');
const { asyncHandler } = require('../middleware/asyncHandler');
const { sendMail } = require('../services/mailer');

const parseAdminEmails = () => {
  const raw = String(process.env.ADMIN_EMAILS || '').trim().toLowerCase();
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
};

const getFrontendUrl = () => String(process.env.FRONTEND_URL || 'http://localhost:5173').trim().replace(/\/+$/, '');
const getBackendUrl = () =>
  String(process.env.BACKEND_URL || process.env.API_BASE_URL || `http://localhost:${Number(process.env.PORT || 5000)}`)
    .trim()
    .replace(/\/+$/, '');

const normalizeIssueType = (v) => String(v || '').trim().slice(0, 80);
const normalizeDesc = (v) => String(v || '').trim().slice(0, 2000);

const normalizeStatus = (v) => {
  const s = String(v || '').trim().toUpperCase();
  if (['PENDING', 'DISPUTED', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED'].includes(s)) return s;
  return '';
};

const isFinalStatus = (s) => s === 'RESOLVED' || s === 'REJECTED';
const isActiveStatus = (s) => ['PENDING', 'DISPUTED', 'UNDER_REVIEW'].includes(s);

const fileTypeFromMimetype = (m) => {
  const v = String(m || '').toLowerCase();
  if (v.startsWith('image/')) return 'image';
  if (v.startsWith('video/')) return 'video';
  return '';
};

const resolveUploadUrl = (filename) => `${getBackendUrl()}/uploads/tickets/${encodeURIComponent(filename)}`;

const ensureTicketUploadDir = () => {
  const dir = path.join(__dirname, '..', '..', 'uploads', 'tickets');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const createTicketLog = async ({ ticketObjectId, action, actorRole, actorId, note, meta }) => {
  await TicketLog.create({
    ticketId: ticketObjectId,
    action,
    actorRole,
    actorId: actorId && mongoose.isValidObjectId(String(actorId)) ? new mongoose.Types.ObjectId(String(actorId)) : null,
    note: String(note || '').trim().slice(0, 2000),
    meta: meta && typeof meta === 'object' ? meta : {}
  });
};

const sendAdminNewTicketEmail = async ({ ticket, booking, vendor, user }) => {
  const adminEmails = parseAdminEmails();
  if (!adminEmails.length) return;
  const subject = `Khiếu nại mới (${ticket.ticketId})`;
  const bookingId = String(booking?._id || ticket.bookingId || '');
  const shopName = String(vendor?.shopName || '');
  const issueType = String(ticket?.issueType || '');
  const url = `${getFrontendUrl()}/admin/tickets`;
  const text = [
    'Có khiếu nại mới.',
    `Ticket: ${ticket.ticketId}`,
    `Booking: ${bookingId}`,
    shopName ? `Shop: ${shopName}` : '',
    issueType ? `Loại: ${issueType}` : '',
    `Mở admin: ${url}`
  ]
    .filter(Boolean)
    .join('\n');
  await sendMail({ to: adminEmails.join(','), subject, text, html: '' }).catch(() => {});
};

const sendShopNewTicketEmail = async ({ ticket, booking, vendor }) => {
  const email = String(vendor?.email || '').trim();
  if (!email) return;
  const subject = `Có khiếu nại mới từ khách (${ticket.ticketId})`;
  const bookingId = String(booking?._id || ticket.bookingId || '');
  const issueType = String(ticket?.issueType || '');
  const url = `${getFrontendUrl()}/seller-center`;
  const text = [
    'Có một khiếu nại mới liên quan tới lịch hẹn.',
    `Ticket: ${ticket.ticketId}`,
    `Booking: ${bookingId}`,
    issueType ? `Loại: ${issueType}` : '',
    `Mở Seller Center: ${url}`
  ]
    .filter(Boolean)
    .join('\n');
  await sendMail({ to: email, subject, text, html: '' }).catch(() => {});
};

const sendUserStatusEmail = async ({ ticket, user, status, note }) => {
  const email = String(user?.email || '').trim();
  if (!email) return;
  const subject = `Cập nhật khiếu nại (${ticket.ticketId})`;
  const url = `${getFrontendUrl()}/booking/${encodeURIComponent(String(ticket.bookingId || ''))}`;
  const text = [
    'Trạng thái khiếu nại của bạn đã được cập nhật.',
    `Ticket: ${ticket.ticketId}`,
    `Trạng thái: ${status}`,
    note ? `Ghi chú: ${note}` : '',
    `Xem booking: ${url}`
  ]
    .filter(Boolean)
    .join('\n');
  await sendMail({ to: email, subject, text, html: '' }).catch(() => {});
};

const listMyTickets = asyncHandler(async (req, res) => {
  const userId = String(req.user?.id || '');
  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });

  const status = normalizeStatus(req.query?.status);
  const bookingId = String(req.query?.bookingId || '').trim();
  const q = { userId: new mongoose.Types.ObjectId(userId) };
  if (status) q.status = status;
  if (bookingId && mongoose.isValidObjectId(bookingId)) q.bookingId = new mongoose.Types.ObjectId(bookingId);

  const items = await Ticket.find(q).sort({ createdAt: -1 }).lean();
  res.json({ items });
});

const getMyTicket = asyncHandler(async (req, res) => {
  const userId = String(req.user?.id || '');
  const id = String(req.params?.id || '').trim();
  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_ID' });

  const ticket = await Ticket.findOne({ _id: id, userId }).lean();
  if (!ticket) return res.status(404).json({ error: 'NOT_FOUND' });

  const [media, logs] = await Promise.all([
    TicketMedia.find({ ticketId: ticket._id }).sort({ createdAt: -1 }).lean(),
    TicketLog.find({ ticketId: ticket._id }).sort({ createdAt: -1 }).lean()
  ]);

  res.json({ item: { ...ticket, media, logs } });
});

const createMyTicket = asyncHandler(async (req, res) => {
  const userId = String(req.user?.id || '');
  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });

  const bookingId = String(req.body?.bookingId || '').trim();
  if (!mongoose.isValidObjectId(bookingId)) return res.status(400).json({ error: 'INVALID_BOOKING' });

  const issueType = normalizeIssueType(req.body?.issueType);
  const description = normalizeDesc(req.body?.description);
  if (!issueType) return res.status(400).json({ error: 'MISSING_ISSUE_TYPE' });
  if (!description) return res.status(400).json({ error: 'MISSING_DESCRIPTION' });

  const booking = await Booking.findOne({ _id: bookingId, userId }).lean();
  if (!booking) return res.status(404).json({ error: 'BOOKING_NOT_FOUND' });
  if (String(booking.status || '').toLowerCase() !== 'completed') return res.status(409).json({ error: 'BOOKING_NOT_COMPLETED' });
  if (booking.handoverAcceptedAt) return res.status(409).json({ error: 'BOOKING_FINALIZED' });

  const existing = await Ticket.findOne({
    bookingId: new mongoose.Types.ObjectId(bookingId),
    status: { $in: ['PENDING', 'DISPUTED', 'UNDER_REVIEW'] }
  })
    .select('_id ticketId status')
    .lean();
  if (existing) return res.status(409).json({ error: 'TICKET_ALREADY_ACTIVE', ticketId: existing.ticketId });

  const files = Array.isArray(req.files) ? req.files : [];
  if (!files.length) return res.status(400).json({ error: 'EVIDENCE_REQUIRED' });

  const vendor = await Vendor.findById(booking.shopId).select('_id shopName email').lean();
  if (!vendor) return res.status(404).json({ error: 'SHOP_NOT_FOUND' });

  const ticket = await Ticket.create({
    userId: new mongoose.Types.ObjectId(userId),
    shopId: new mongoose.Types.ObjectId(String(booking.shopId)),
    bookingId: new mongoose.Types.ObjectId(bookingId),
    issueType,
    description,
    status: 'PENDING'
  });

  const mediaRows = [];
  for (const f of files) {
    const ft = fileTypeFromMimetype(f?.mimetype);
    if (!ft) continue;
    const url = resolveUploadUrl(String(f.filename || ''));
    mediaRows.push({
      ticketId: ticket._id,
      fileUrl: url,
      fileType: ft,
      uploadedByRole: 'USER',
      uploadedById: new mongoose.Types.ObjectId(userId)
    });
  }
  if (!mediaRows.length) return res.status(400).json({ error: 'EVIDENCE_REQUIRED' });
  await TicketMedia.insertMany(mediaRows);
  await createTicketLog({ ticketObjectId: ticket._id, action: 'created', actorRole: 'USER', actorId: userId, note: '' });

  const user = await User.findById(userId).select('email name').lean();
  await Promise.all([
    sendAdminNewTicketEmail({ ticket, booking, vendor, user }),
    sendShopNewTicketEmail({ ticket, booking, vendor })
  ]);

  const item = await Ticket.findById(ticket._id).lean();
  res.status(201).json({ item });
});

const addMyTicketEvidence = asyncHandler(async (req, res) => {
  const userId = String(req.user?.id || '');
  const id = String(req.params?.id || '').trim();
  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_ID' });

  const ticket = await Ticket.findOne({ _id: id, userId }).lean();
  if (!ticket) return res.status(404).json({ error: 'NOT_FOUND' });
  if (isFinalStatus(String(ticket.status || ''))) return res.status(409).json({ error: 'TICKET_FINAL' });

  const files = Array.isArray(req.files) ? req.files : [];
  if (!files.length) return res.status(400).json({ error: 'EVIDENCE_REQUIRED' });

  const mediaRows = [];
  for (const f of files) {
    const ft = fileTypeFromMimetype(f?.mimetype);
    if (!ft) continue;
    const url = resolveUploadUrl(String(f.filename || ''));
    mediaRows.push({
      ticketId: ticket._id,
      fileUrl: url,
      fileType: ft,
      uploadedByRole: 'USER',
      uploadedById: new mongoose.Types.ObjectId(userId)
    });
  }
  if (!mediaRows.length) return res.status(400).json({ error: 'EVIDENCE_REQUIRED' });
  await TicketMedia.insertMany(mediaRows);
  await Ticket.updateOne({ _id: ticket._id }, { $set: { needsMoreEvidence: false, evidenceRequestNote: '' } });
  await createTicketLog({ ticketObjectId: ticket._id, action: 'evidence_added', actorRole: 'USER', actorId: userId, note: '' });

  const item = await Ticket.findById(ticket._id).lean();
  res.json({ item });
});

const listTicketsAdmin = asyncHandler(async (req, res) => {
  const status = normalizeStatus(req.query?.status);
  const shopId = String(req.query?.shopId || '').trim();
  const bookingId = String(req.query?.bookingId || '').trim();
  const userId = String(req.query?.userId || '').trim();

  const q = {};
  if (status) q.status = status;
  if (shopId && mongoose.isValidObjectId(shopId)) q.shopId = new mongoose.Types.ObjectId(shopId);
  if (bookingId && mongoose.isValidObjectId(bookingId)) q.bookingId = new mongoose.Types.ObjectId(bookingId);
  if (userId && mongoose.isValidObjectId(userId)) q.userId = new mongoose.Types.ObjectId(userId);

  const items = await Ticket.find(q).sort({ createdAt: -1 }).limit(500).lean();
  res.json({ items });
});

const getTicketAdmin = asyncHandler(async (req, res) => {
  const id = String(req.params?.id || '').trim();
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_ID' });

  const ticket = await Ticket.findById(id).lean();
  if (!ticket) return res.status(404).json({ error: 'NOT_FOUND' });

  const [booking, vendor, user, media, logs] = await Promise.all([
    Booking.findById(ticket.bookingId).lean(),
    Vendor.findById(ticket.shopId).select('shopName email address phone logo coverImage').lean(),
    User.findById(ticket.userId).select('email name').lean(),
    TicketMedia.find({ ticketId: ticket._id }).sort({ createdAt: -1 }).lean(),
    TicketLog.find({ ticketId: ticket._id }).sort({ createdAt: -1 }).lean()
  ]);

  res.json({ item: { ...ticket, booking: booking || null, shop: vendor || null, user: user || null, media, logs } });
});

const setTicketAdminNote = asyncHandler(async (req, res) => {
  const adminId = String(req.user?.id || '');
  const id = String(req.params?.id || '').trim();
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_ID' });

  const note = String(req.body?.note || '').trim().slice(0, 5000);
  const ticket = await Ticket.findById(id).lean();
  if (!ticket) return res.status(404).json({ error: 'NOT_FOUND' });

  await Ticket.updateOne({ _id: ticket._id }, { $set: { adminNote: note } });
  await createTicketLog({ ticketObjectId: ticket._id, action: 'admin_note_updated', actorRole: 'ADMIN', actorId: adminId, note: '' });
  const item = await Ticket.findById(ticket._id).lean();
  res.json({ item });
});

const requestMoreEvidenceAdmin = asyncHandler(async (req, res) => {
  const adminId = String(req.user?.id || '');
  const id = String(req.params?.id || '').trim();
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_ID' });

  const note = String(req.body?.note || '').trim().slice(0, 2000);
  const ticket = await Ticket.findById(id).lean();
  if (!ticket) return res.status(404).json({ error: 'NOT_FOUND' });
  if (isFinalStatus(String(ticket.status || ''))) return res.status(409).json({ error: 'TICKET_FINAL' });

  await Ticket.updateOne(
    { _id: ticket._id },
    { $set: { status: 'UNDER_REVIEW', needsMoreEvidence: true, evidenceRequestNote: note } }
  );
  await createTicketLog({ ticketObjectId: ticket._id, action: 'evidence_requested', actorRole: 'ADMIN', actorId: adminId, note });

  const user = await User.findById(ticket.userId).select('email name').lean();
  await sendUserStatusEmail({ ticket, user, status: 'UNDER_REVIEW', note: note || 'Vui lòng bổ sung bằng chứng.' });

  const item = await Ticket.findById(ticket._id).lean();
  res.json({ item });
});

const updateTicketStatusAdmin = asyncHandler(async (req, res) => {
  const adminId = String(req.user?.id || '');
  const id = String(req.params?.id || '').trim();
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_ID' });

  const next = normalizeStatus(req.body?.status);
  if (!next) return res.status(400).json({ error: 'INVALID_STATUS' });
  const note = String(req.body?.note || '').trim().slice(0, 2000);

  const ticket = await Ticket.findById(id).lean();
  if (!ticket) return res.status(404).json({ error: 'NOT_FOUND' });
  const prev = String(ticket.status || '');
  if (prev === next) return res.json({ item: ticket });
  if (isFinalStatus(prev)) return res.status(409).json({ error: 'TICKET_FINAL' });

  if (next === 'RESOLVED' || next === 'REJECTED') {
    await Ticket.updateOne({ _id: ticket._id }, { $set: { status: next, needsMoreEvidence: false, evidenceRequestNote: '' } });
  } else {
    await Ticket.updateOne({ _id: ticket._id }, { $set: { status: next } });
  }
  await createTicketLog({
    ticketObjectId: ticket._id,
    action: 'status_changed',
    actorRole: 'ADMIN',
    actorId: adminId,
    note,
    meta: { from: prev, to: next }
  });

  const user = await User.findById(ticket.userId).select('email name').lean();
  await sendUserStatusEmail({ ticket: { ...ticket, status: next }, user, status: next, note });

  const item = await Ticket.findById(ticket._id).lean();
  res.json({ item });
});

const flagShopAdmin = asyncHandler(async (req, res) => {
  const adminId = String(req.user?.id || '');
  const id = String(req.params?.id || '').trim();
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_ID' });

  const enabled = req.body?.enabled === true || req.body?.flagged === true;
  const note = String(req.body?.note || '').trim().slice(0, 2000);

  const ticket = await Ticket.findById(id).lean();
  if (!ticket) return res.status(404).json({ error: 'NOT_FOUND' });

  await Ticket.updateOne({ _id: ticket._id }, { $set: { shopFlagged: enabled } });
  await createTicketLog({ ticketObjectId: ticket._id, action: 'shop_flagged', actorRole: 'ADMIN', actorId: adminId, note });

  if (enabled) {
    await Vendor.updateOne(
      { _id: ticket.shopId },
      { $set: { 'quality.flagged': true, 'quality.flaggedAt': new Date(), 'quality.flagNote': note } }
    ).catch(() => {});
  }

  const item = await Ticket.findById(ticket._id).lean();
  res.json({ item });
});

const listVendorTickets = asyncHandler(async (req, res) => {
  const vendorId = String(req.vendor?._id || '');
  if (!vendorId) return res.status(403).json({ error: 'FORBIDDEN' });
  const status = normalizeStatus(req.query?.status);
  const q = { shopId: new mongoose.Types.ObjectId(vendorId) };
  if (status) q.status = status;
  const items = await Ticket.find(q).sort({ createdAt: -1 }).limit(300).lean();
  res.json({ items });
});

const getVendorTicket = asyncHandler(async (req, res) => {
  const vendorId = String(req.vendor?._id || '');
  const id = String(req.params?.id || '').trim();
  if (!vendorId) return res.status(403).json({ error: 'FORBIDDEN' });
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_ID' });

  const ticket = await Ticket.findOne({ _id: id, shopId: vendorId }).lean();
  if (!ticket) return res.status(404).json({ error: 'NOT_FOUND' });

  const [media, logs] = await Promise.all([
    TicketMedia.find({ ticketId: ticket._id }).sort({ createdAt: -1 }).lean(),
    TicketLog.find({ ticketId: ticket._id }).sort({ createdAt: -1 }).lean()
  ]);

  res.json({ item: { ...ticket, media, logs } });
});

const respondVendorTicket = asyncHandler(async (req, res) => {
  const vendorId = String(req.vendor?._id || '');
  const id = String(req.params?.id || '').trim();
  if (!vendorId) return res.status(403).json({ error: 'FORBIDDEN' });
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_ID' });

  const ticket = await Ticket.findOne({ _id: id, shopId: vendorId }).lean();
  if (!ticket) return res.status(404).json({ error: 'NOT_FOUND' });
  if (isFinalStatus(String(ticket.status || ''))) return res.status(409).json({ error: 'TICKET_FINAL' });

  const note = String(req.body?.note || '').trim().slice(0, 2000);
  if (!note && (!Array.isArray(req.files) || !req.files.length)) return res.status(400).json({ error: 'EMPTY_RESPONSE' });

  const files = Array.isArray(req.files) ? req.files : [];
  const mediaRows = [];
  for (const f of files) {
    const ft = fileTypeFromMimetype(f?.mimetype);
    if (!ft) continue;
    const url = resolveUploadUrl(String(f.filename || ''));
    mediaRows.push({
      ticketId: ticket._id,
      fileUrl: url,
      fileType: ft,
      uploadedByRole: 'VENDOR',
      uploadedById: new mongoose.Types.ObjectId(vendorId)
    });
  }
  if (mediaRows.length) await TicketMedia.insertMany(mediaRows);
  await createTicketLog({ ticketObjectId: ticket._id, action: 'shop_responded', actorRole: 'VENDOR', actorId: vendorId, note });

  const item = await Ticket.findById(ticket._id).lean();
  res.json({ item });
});

module.exports = {
  ensureTicketUploadDir,
  listMyTickets,
  getMyTicket,
  createMyTicket,
  addMyTicketEvidence,
  listTicketsAdmin,
  getTicketAdmin,
  setTicketAdminNote,
  requestMoreEvidenceAdmin,
  updateTicketStatusAdmin,
  flagShopAdmin,
  listVendorTickets,
  getVendorTicket,
  respondVendorTicket
};
