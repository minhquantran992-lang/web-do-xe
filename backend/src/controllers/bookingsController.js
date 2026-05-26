const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const Booking = require('../models/Booking');
const BookingProgress = require('../models/BookingProgress');
const Configuration = require('../models/Configuration');
const Vendor = require('../models/Vendor');
const User = require('../models/User');
const VendorReview = require('../models/VendorReview');
const { asyncHandler } = require('../middleware/asyncHandler');
const { sendMail } = require('../services/mailer');
const { createNotification, notifyFollowers } = require('../services/notifications');

const getFrontendUrl = () => String(process.env.FRONTEND_URL || 'http://localhost:5173').trim().replace(/\/+$/, '');
const getBackendUrl = () =>
  String(process.env.BACKEND_URL || process.env.API_BASE_URL || `http://localhost:${Number(process.env.PORT || 5000)}`)
    .trim()
    .replace(/\/+$/, '');

const escapeHtml = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const normalizeGender = (value) => {
  const k = String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
  if (!k) return '';
  if (k === 'male' || k === 'nam') return 'male';
  if (k === 'female' || k === 'nu') return 'female';
  return '';
};

const parseBookingReviewToken = (token) => {
  const t = String(token || '').trim();
  if (!t) return { ok: false, status: 400, message: 'Thiếu mã xác thực.' };
  if (!process.env.JWT_SECRET) return { ok: false, status: 500, message: 'Thiếu cấu hình máy chủ.' };
  let payload = null;
  try {
    payload = jwt.verify(t, process.env.JWT_SECRET);
  } catch {
    return { ok: false, status: 400, message: 'Liên kết không hợp lệ hoặc đã hết hạn.' };
  }
  if (String(payload?.typ || '') !== 'BOOKING_REVIEW') return { ok: false, status: 400, message: 'Liên kết không hợp lệ.' };

  const bookingId = String(payload?.bookingId || '').trim();
  const vendorId = String(payload?.vendorId || '').trim();
  const userId = String(payload?.userId || '').trim();
  const rating = Math.max(1, Math.min(5, Math.floor(Number(payload?.rating) || 0)));
  if (!mongoose.isValidObjectId(bookingId) || !mongoose.isValidObjectId(vendorId) || !mongoose.isValidObjectId(userId)) {
    return { ok: false, status: 400, message: 'Liên kết không hợp lệ.' };
  }
  return { ok: true, token: t, bookingId, vendorId, userId, rating };
};

const parseDate = (raw) => {
  if (!raw) return null;
  const d = raw instanceof Date ? raw : new Date(raw);
  if (!d || Number.isNaN(d.getTime())) return null;
  return d;
};

const normalizePrice = (n) => {
  const x = Number(n);
  if (!Number.isFinite(x) || x < 0) return 0;
  return Math.round(x * 100) / 100;
};

const normalizeText = (v, maxLen = 1000) => String(v || '').trim().slice(0, maxLen);

const logBookingEvent = async ({ bookingId, fromStatus, toStatus, actorRole, actorId, note, at }) => {
  const happenedAt = at instanceof Date ? at : new Date();
  return BookingProgress.create({
    bookingId: new mongoose.Types.ObjectId(String(bookingId)),
    fromStatus: fromStatus ? String(fromStatus) : null,
    toStatus: String(toStatus || ''),
    actorRole: String(actorRole || ''),
    actorId: actorId && mongoose.isValidObjectId(String(actorId)) ? new mongoose.Types.ObjectId(String(actorId)) : null,
    note: normalizeText(note),
    happenedAt
  });
};

const PROJECT_STATUS = Object.freeze({
  DESIGN_DRAFT: 'DESIGN_DRAFT',
  DESIGN_SUBMITTED: 'DESIGN_SUBMITTED',
  WAITING_SHOP_RESPONSE: 'WAITING_SHOP_RESPONSE',
  SHOP_REJECTED: 'SHOP_REJECTED',
  QUOTE_SENT: 'QUOTE_SENT',
  WAITING_USER_CONFIRMATION: 'WAITING_USER_CONFIRMATION',
  USER_REJECTED_QUOTE: 'USER_REJECTED_QUOTE',
  QUOTE_CONFIRMED: 'QUOTE_CONFIRMED',
  WAITING_PRODUCTION: 'WAITING_PRODUCTION',
  IN_PROGRESS: 'IN_PROGRESS',
  QUALITY_CHECK: 'QUALITY_CHECK',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  DISPUTED: 'DISPUTED'
});

const mapBookingToProjectStatus = (booking) => {
  const status = String(booking?.status || '').trim().toLowerCase();
  if (status === 'pending') return { status: PROJECT_STATUS.WAITING_SHOP_RESPONSE };
  if (status === 'quoted') return { status: PROJECT_STATUS.WAITING_USER_CONFIRMATION };
  if (status === 'accepted') return { status: PROJECT_STATUS.WAITING_PRODUCTION };
  if (status === 'in_progress') return { status: PROJECT_STATUS.IN_PROGRESS };
  if (status === 'completed') return { status: PROJECT_STATUS.COMPLETED };
  if (status === 'rejected') return { status: PROJECT_STATUS.SHOP_REJECTED };
  if (status === 'cancelled') return { status: PROJECT_STATUS.USER_REJECTED_QUOTE };
  if (status === 'expired') return { status: PROJECT_STATUS.SHOP_REJECTED, reason: 'TIMEOUT' };
  return { status: PROJECT_STATUS.WAITING_SHOP_RESPONSE };
};

const formatVnd = (value) => {
  const n = normalizePrice(value);
  const int = Math.round(n);
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(int)} ₫`;
};

const formatDateTimeVi = (d) => {
  const dt = d instanceof Date ? d : parseDate(d);
  if (!dt) return '';
  const tz = String(process.env.TIMEZONE || 'Asia/Ho_Chi_Minh').trim() || 'Asia/Ho_Chi_Minh';
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: tz,
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(dt);
  } catch {
    return dt.toISOString();
  }
};

const formatYmdInTz = (date, tz) => {
  const dt = date instanceof Date ? date : new Date(date);
  if (!dt || Number.isNaN(dt.getTime())) return '';
  const zone = String(tz || '').trim() || String(process.env.TIMEZONE || '').trim() || 'Asia/Ho_Chi_Minh';
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(dt);
  } catch {
    const y = String(dt.getFullYear());
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
};

const getTzOffsetMinutes = (date, tz) => {
  const zone = String(tz || '').trim() || String(process.env.TIMEZONE || '').trim() || 'Asia/Ho_Chi_Minh';
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'shortOffset' }).formatToParts(date);
    const token = String(parts.find((p) => p.type === 'timeZoneName')?.value || '').trim();
    const m = /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(token);
    if (!m) return 0;
    const sign = m[1] === '-' ? -1 : 1;
    const hh = Number(m[2]);
    const mm = Number(m[3] || 0);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 0;
    return sign * (hh * 60 + mm);
  } catch {
    return 0;
  }
};

const getDayRangeInTz = (date, tz) => {
  const zone = String(tz || '').trim() || String(process.env.TIMEZONE || '').trim() || 'Asia/Ho_Chi_Minh';
  const dt = date instanceof Date ? date : new Date(date);
  if (!dt || Number.isNaN(dt.getTime())) return null;
  let y = 0;
  let m = 0;
  let d = 0;
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(dt);
    y = Number(parts.find((p) => p.type === 'year')?.value || 0);
    m = Number(parts.find((p) => p.type === 'month')?.value || 0);
    d = Number(parts.find((p) => p.type === 'day')?.value || 0);
  } catch {
    const ymd = formatYmdInTz(dt, zone);
    const mm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
    if (mm) {
      y = Number(mm[1]);
      m = Number(mm[2]);
      d = Number(mm[3]);
    }
  }
  if (!y || !m || !d) return null;
  const approxUtc = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  const offsetMin = getTzOffsetMinutes(approxUtc, zone);
  const start = new Date(approxUtc.getTime() - offsetMin * 60 * 1000);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
};

const signReviewToken = ({ bookingId, vendorId, userId, rating }) => {
  if (!process.env.JWT_SECRET) {
    const err = new Error('MISSING_JWT_SECRET');
    err.statusCode = 500;
    throw err;
  }
  const stars = Math.max(1, Math.min(5, Math.floor(Number(rating) || 0)));
  return jwt.sign(
    { typ: 'BOOKING_REVIEW', bookingId: String(bookingId || ''), vendorId: String(vendorId || ''), userId: String(userId || ''), rating: stars },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
};

const buildCompletedEmail = ({ customerName, shopName, bookingId, timeSlot, snapshot, ratingLinks }) => {
  const name = String(customerName || '').trim() || 'bạn';
  const sName = String(shopName || '').trim() || 'cửa hàng';
  const timeLabel = formatDateTimeVi(timeSlot) || (timeSlot instanceof Date ? timeSlot.toISOString() : String(timeSlot || ''));
  const buildLabel = String(snapshot?.buildName || snapshot?.carName || '').trim() || 'Cấu hình tùy chỉnh';
  const total = formatVnd(snapshot?.totalPrice);
  const bookingUrl = `${getFrontendUrl()}/booking/${encodeURIComponent(String(bookingId || ''))}`;
  const subject = `eloride • Cảm ơn bạn • Đánh giá dịch vụ${sName ? ` • ${sName}` : ''}`;

  const text = [
    `Chào ${name},`,
    '',
    `Cửa hàng ${sName} vừa xác nhận đã hoàn thành lịch hẹn của bạn. Cảm ơn bạn đã tin tưởng đội ngũ eloride!`,
    '',
    `Mã đặt lịch: ${bookingId}`,
    timeLabel ? `Thời gian: ${timeLabel}` : '',
    buildLabel ? `Cấu hình: ${buildLabel}` : '',
    total ? `Tổng dự kiến: ${total}` : '',
    '',
    'Bạn vui lòng dành 10 giây để đánh giá chất lượng dịch vụ:',
    `1 sao: ${ratingLinks?.[1] || bookingUrl}`,
    `2 sao: ${ratingLinks?.[2] || bookingUrl}`,
    `3 sao: ${ratingLinks?.[3] || bookingUrl}`,
    `4 sao: ${ratingLinks?.[4] || bookingUrl}`,
    `5 sao: ${ratingLinks?.[5] || bookingUrl}`,
    '',
    `Xem chi tiết lịch hẹn: ${bookingUrl}`,
    '',
    'Trân trọng,',
    'Đội ngũ eloride'
  ]
    .filter(Boolean)
    .join('\n');

  const starBtn = (stars, href) => {
    const s = Math.max(1, Math.min(5, Math.floor(Number(stars) || 0)));
    const filled = '★'.repeat(s);
    const empty = '☆'.repeat(5 - s);
    return `
      <a href="${href}" style="display:inline-block;text-decoration:none;min-width:116px;text-align:center;border:1px solid rgba(251,191,36,0.35);background:rgba(2,6,23,0.35);color:#e2e8f0;font-weight:900;padding:14px 14px;border-radius:14px">
        <div style="font-size:22px;letter-spacing:1px;line-height:1.1;color:#fbbf24">${filled}<span style="color:rgba(226,232,240,0.28)">${empty}</span></div>
        <div style="margin-top:6px;font-size:11px;font-weight:950;color:rgba(226,232,240,0.9)">${s} sao</div>
      </a>
    `.trim();
  };

  const html = `
    <div style="margin:0;padding:0;background:#0b1220;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse">
        <tr>
          <td align="center" style="padding:28px 16px">
            <table role="presentation" cellpadding="0" cellspacing="0" width="640" style="max-width:640px;width:100%;border-collapse:separate;border-spacing:0;border:1px solid rgba(255,255,255,0.08);border-radius:18px;overflow:hidden;background:#0f172a">
              <tr>
                <td style="padding:24px 26px;background:linear-gradient(135deg,#22c55e 0%,#0ea5e9 100%);color:#071018">
                  <div style="font-weight:950;font-size:18px;letter-spacing:0.2px">eloride</div>
                  <div style="margin-top:6px;font-weight:900;font-size:16px;opacity:0.95">Cảm ơn bạn đã sử dụng dịch vụ</div>
                </td>
              </tr>
              <tr>
                <td style="padding:22px 26px;color:#e5e7eb">
                  <div style="font-size:14px;line-height:1.7;color:#cbd5e1">
                    Chào <b style="color:#f8fafc">${escapeHtml(name)}</b>,<br/>
                    Cửa hàng <b style="color:#f8fafc">${escapeHtml(sName)}</b> vừa xác nhận đã hoàn thành lịch hẹn của bạn.
                    Cảm ơn bạn đã tin tưởng đội ngũ eloride!
                  </div>

                  <div style="margin-top:16px;padding:14px 14px;border:1px solid rgba(255,255,255,0.08);border-radius:14px;background:rgba(2,6,23,0.35)">
                    <div style="font-size:12px;color:rgba(148,163,184,0.9);font-weight:750;letter-spacing:0.06em;text-transform:uppercase">Thông tin</div>
                    <div style="margin-top:10px;color:#fff;font-weight:700">Mã đặt lịch: <span style="color:#e2e8f0">${escapeHtml(
                      String(bookingId || '')
                    )}</span></div>
                    ${timeLabel ? `<div style="margin-top:6px;color:#fff;font-weight:650">Thời gian: <span style="color:#e2e8f0">${escapeHtml(timeLabel)}</span></div>` : ''}
                    ${buildLabel ? `<div style="margin-top:6px;color:#fff;font-weight:650">Cấu hình: <span style="color:#e2e8f0">${escapeHtml(buildLabel)}</span></div>` : ''}
                    ${total ? `<div style="margin-top:6px;color:#fff;font-weight:650">Tổng dự kiến: <span style="color:#e2e8f0">${escapeHtml(total)}</span></div>` : ''}
                  </div>

                  <div style="margin-top:18px;font-size:13px;line-height:1.7;color:#94a3b8">
                    Bạn vui lòng dành 10 giây để đánh giá chất lượng dịch vụ:
                  </div>

                  <div style="margin-top:12px">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:10px 10px;margin:0 auto">
                      <tr>
                        <td align="center">${starBtn(1, ratingLinks?.[1] || bookingUrl)}</td>
                        <td align="center">${starBtn(2, ratingLinks?.[2] || bookingUrl)}</td>
                        <td align="center">${starBtn(3, ratingLinks?.[3] || bookingUrl)}</td>
                      </tr>
                      <tr>
                        <td align="center" colspan="3">
                          <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:10px 0;margin:0 auto">
                            <tr>
                              <td align="center">${starBtn(4, ratingLinks?.[4] || bookingUrl)}</td>
                              <td align="center">${starBtn(5, ratingLinks?.[5] || bookingUrl)}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </div>

                  <div style="margin-top:18px">
                    <a href="${bookingUrl}" style="display:inline-block;text-decoration:none;background:linear-gradient(90deg,#38bdf8,#22d3ee);color:#02131a;font-weight:950;font-size:13px;padding:12px 14px;border-radius:12px">
                      Xem chi tiết lịch hẹn
                    </a>
                  </div>

                  <div style="margin-top:16px;font-size:12px;line-height:1.7;color:#64748b">
                    Trân trọng,<br/>Đội ngũ eloride
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 26px;background:#0b1220;color:#64748b;font-size:12px;line-height:1.6">
                  © ${new Date().getFullYear()} eloride
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `.trim();

  return { subject, text, html };
};

const guessBrandName = (raw) => {
  const s = String(raw || '').trim();
  if (!s) return '';
  const first = s.split(/[\s\-–—|/]+/).filter(Boolean)[0] || '';
  return String(first).trim();
};

const buildLegalWarnings = (parts) => {
  const warnings = [];
  const types = new Set((Array.isArray(parts) ? parts : []).map((p) => String(p?.type || '').trim()).filter(Boolean));
  if (types.has('exhaust'))
    warnings.push(
      'Cảnh báo (VN): Độ pô/ống xả có thể vượt ngưỡng tiếng ồn/khí thải theo quy định. Nên ưu tiên pô zin hoặc pô có tiêu âm (DB killer) và kiểm tra quy định hiện hành trước khi lưu thông.'
    );
  if (types.has('lighting'))
    warnings.push(
      'Cảnh báo (VN): Độ đèn phải đảm bảo an toàn giao thông (không gây chói/mất tập trung) và tuân thủ quy định hiện hành khi tham gia giao thông.'
    );
  if (types.has('bodykit'))
    warnings.push(
      'Cảnh báo (VN): Thay đổi dàn áo/body kit có thể bị coi là thay đổi kết cấu/hình dáng phương tiện trong một số trường hợp. Hãy kiểm tra yêu cầu kiểm định/đăng ký (nếu có) trước khi sử dụng.'
    );
  if (types.has('tire') || types.has('wheels'))
    warnings.push(
      'Cảnh báo (VN): Thay mâm/lốp nên đảm bảo đúng kích thước, tải trọng và không cạ vào khung/sườn để tránh mất an toàn khi vận hành.'
    );
  return warnings;
};

const buildSnapshotFromConfig = (cfg) => {
  const parts = [];
  if (cfg?.selectedWheels) parts.push(cfg.selectedWheels);
  if (Array.isArray(cfg?.selectedParts)) parts.push(...cfg.selectedParts);

  const safeParts = parts
    .filter(Boolean)
    .map((p) => ({
      _id: p?._id,
      name: String(p?.name || '').trim(),
      brandName: guessBrandName(p?.name),
      type: String(p?.type || '').trim(),
      price: normalizePrice(p?.price)
    }))
    .filter((p) => p.name || p.type);

  const totalPrice = safeParts.reduce((sum, p) => sum + normalizePrice(p.price), 0);
  const legalWarnings = buildLegalWarnings(safeParts);
  const legalStatus = legalWarnings.length ? 'review' : 'ok';
  const previewImageUrl = String(cfg?.thumbnailUrl || cfg?.carId?.thumbnailUrl || '').trim();
  const carName = String(cfg?.carId?.name || '').trim();
  const buildName = String(cfg?.name || '').trim();
  const color = String(cfg?.selectedColor || '').trim();

  return {
    customerName: '',
    customerPhone: '',
    customerCity: '',
    customerGender: '',
    customerCountry: '',
    buildName,
    carName,
    color,
    previewImageUrl,
    parts: safeParts,
    totalPrice: normalizePrice(totalPrice),
    legalStatus,
    legalWarnings
  };
};

const createBooking = asyncHandler(async (req, res) => {
  const userId = String(req.user?.id || '');
  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });

  const buildId = String(req.body?.buildId || req.body?.configId || req.body?.configurationId || '').trim();
  const shopId = String(req.body?.shopId || req.body?.vendorId || '').trim();
  const timeSlot = parseDate(req.body?.timeSlot || req.body?.slot || req.body?.time) || new Date();

  if (!mongoose.isValidObjectId(buildId)) return res.status(400).json({ error: 'INVALID_BUILD' });
  if (!mongoose.isValidObjectId(shopId)) return res.status(400).json({ error: 'INVALID_SHOP' });

  const vendor = await Vendor.findOne({ _id: shopId, status: 'approved' })
    .select('_id shopName address email phone status bookingPreferences')
    .lean();
  if (!vendor) return res.status(404).json({ error: 'SHOP_NOT_FOUND' });
  if (vendor?.bookingPreferences?.acceptingBookings === false) return res.status(409).json({ error: 'SHOP_NOT_ACCEPTING' });
  const tz = String(vendor?.bookingPreferences?.timezone || '').trim() || String(process.env.TIMEZONE || '').trim() || 'Asia/Ho_Chi_Minh';
  const todayYmd = formatYmdInTz(new Date(), tz);
  const slotYmd = formatYmdInTz(timeSlot, tz);
  const closedDate = String(vendor?.bookingPreferences?.closedDate || '').trim();
  if (closedDate && todayYmd && slotYmd && closedDate === todayYmd && slotYmd === todayYmd) {
    return res.status(409).json({ error: 'SHOP_CLOSED_TODAY' });
  }
  const cap = vendor?.bookingPreferences?.capacity || null;
  const maxSlots = Math.max(1, Math.floor(Number(cap?.maxSlots) || 0)) || 1;
  const dayRange = getDayRangeInTz(timeSlot, tz);
  if (dayRange) {
    const now = new Date();
    const shopObjectId = new mongoose.Types.ObjectId(shopId);
    const activeBookings = await Booking.countDocuments({
      shopId: shopObjectId,
      timeSlot: { $gte: dayRange.start, $lt: dayRange.end },
      $or: [
        { status: { $in: ['accepted', 'in_progress'] } },
        { status: 'pending', expiresAt: { $gt: now } }
      ]
    });
    if (Number(activeBookings) >= maxSlots) return res.status(409).json({ error: 'SHOP_FULL' });
  }

  const cfg = await Configuration.findOne({ _id: buildId, userId })
    .populate('carId', 'name thumbnailUrl')
    .populate('selectedWheels', 'name type price')
    .populate('selectedParts', 'name type price')
    .lean();
  if (!cfg) return res.status(404).json({ error: 'BUILD_NOT_FOUND' });

  const now = new Date();
  const existing = await Booking.findOne({
    userId,
    buildId,
    status: 'pending',
    expiresAt: { $gt: now }
  })
    .select('_id')
    .lean();
  if (existing) return res.status(409).json({ error: 'BOOKING_ALREADY_PENDING', bookingId: existing._id });

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const snapshot = buildSnapshotFromConfig(cfg);

  const customerName = String(req.body?.customerName || req.body?.name || '').trim();
  const customerPhone = String(req.body?.customerPhone || req.body?.phone || '').trim();
  const customerCity = String(req.body?.customerCity || req.body?.city || '').trim();
  const customerGender = normalizeGender(req.body?.customerGender || req.body?.gender);
  const customerCountry = String(req.body?.customerCountry || req.body?.country || '').trim();
  if (customerName) snapshot.customerName = customerName;
  if (customerPhone) snapshot.customerPhone = customerPhone;
  if (customerCity) snapshot.customerCity = customerCity;
  if (customerGender) snapshot.customerGender = customerGender;
  if (customerCountry) snapshot.customerCountry = customerCountry;

  const doc = await Booking.create({
    buildId,
    userId,
    shopId,
    timeSlot,
    status: 'pending',
    createdAt: now,
    expiresAt,
    snapshot
  });

  try {
    await logBookingEvent({ bookingId: doc._id, fromStatus: null, toStatus: 'pending', actorRole: 'USER', actorId: userId, note: 'Tạo yêu cầu', at: now });
  } catch {}

  try {
    const warningList = Array.isArray(snapshot?.legalWarnings) ? snapshot.legalWarnings.map((x) => String(x || '').trim()).filter(Boolean) : [];
    if (warningList.length) {
      const title = String(snapshot?.buildName || snapshot?.carName || '').trim() || buildId;
      await createNotification({
        userId,
        type: 'LEGAL_RISK',
        content: `Build của bạn có cảnh báo pháp lý: ${title}`,
        meta: { itemType: 'build', itemId: buildId, warnings: warningList.slice(0, 6) }
      });
      await notifyFollowers({
        itemType: 'build',
        itemId: buildId,
        type: 'LEGAL_RISK',
        content: `Build bạn theo dõi có cảnh báo pháp lý: ${title}`,
        meta: { itemType: 'build', itemId: buildId, warnings: warningList.slice(0, 6) },
        excludeUserIds: [userId]
      });
    }
  } catch {}

  try {
    const email = String(vendor?.email || '').trim();
    if (email) {
      const user = await User.findById(userId).select('name email').lean();
      const customerName = String(user?.name || '').trim();
      const customerEmail = String(user?.email || '').trim();
      const shopName = String(vendor?.shopName || '').trim();
      const when = timeSlot.toISOString();
      const subject = `eloride • Yêu cầu đặt lịch mới${shopName ? ` • ${shopName}` : ''}`;
      const text = [
        'Bạn có một yêu cầu đặt lịch mới.',
        '',
        shopName ? `Cửa hàng: ${shopName}` : '',
        `Thời gian: ${when}`,
        `Cấu hình: ${String(snapshot?.buildName || snapshot?.carName || '').trim() || buildId}`,
        `Mã Đặt lịch: ${String(doc?._id || '')}`,
        customerName ? `Khách hàng: ${customerName}` : '',
        customerEmail ? `Email khách hàng: ${customerEmail}` : '',
        '',
        `Mở Trung tâm người bán: ${getFrontendUrl()}/seller-center`
      ]
        .filter(Boolean)
        .join('\n');
      const html = `
        <div style="margin:0;padding:0;background:#0b1220;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial">
          <div style="padding:24px 16px">
            <div style="max-width:720px;margin:0 auto;background:#0f172a;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden">
              <div style="padding:32px 32px 24px;border-bottom:1px solid rgba(255,255,255,0.08)">
                <div style="font-size:18px;font-weight:800;color:#fff;letter-spacing:-0.01em">
                  Bạn có một yêu cầu đặt lịch mới
                </div>
                <div style="margin-top:6px;color:rgba(148,163,184,0.9);font-size:13px;line-height:1.5">
                  Vui lòng đăng nhập vào Trung tâm người bán để xác nhận hoặc từ chối yêu cầu này.
                </div>
              </div>
              <div style="padding:24px 32px 32px">
                <div style="display:grid;grid-template-columns:1fr;gap:24px">
                  <div>
                    <div style="font-size:12px;color:rgba(148,163,184,0.9);font-weight:700;letter-spacing:0.06em;text-transform:uppercase">Thời gian</div>
                    <div style="margin-top:6px;color:#fff;font-weight:600">${when}</div>
                  </div>
                  <div>
                    <div style="font-size:12px;color:rgba(148,163,184,0.9);font-weight:700;letter-spacing:0.06em;text-transform:uppercase">Khách hàng</div>
                    <div style="margin-top:6px;color:#fff;font-weight:600">${escapeHtml(customerName) || 'Khách hàng'}</div>
                    ${customerEmail ? `<div style="margin-top:2px;color:rgba(148,163,184,0.9);font-size:13px">${escapeHtml(customerEmail)}</div>` : ''}
                  </div>
                  <div>
                    <div style="font-size:12px;color:rgba(148,163,184,0.9);font-weight:700;letter-spacing:0.06em;text-transform:uppercase">Cấu hình</div>
                    <div style="margin-top:6px;color:#fff;font-weight:600">${escapeHtml(snapshot?.buildName || snapshot?.carName || 'Cấu hình tùy chỉnh')}</div>
                    <div style="margin-top:2px;color:rgba(148,163,184,0.9);font-size:13px">Mã Đặt lịch: ${String(doc?._id || '')}</div>
                  </div>
                </div>
                <div style="margin-top:32px;padding-top:24px;border-top:1px solid rgba(255,255,255,0.08)">
                  <a href="${getFrontendUrl()}/seller-center" style="display:inline-block;text-decoration:none;background:linear-gradient(90deg,#38bdf8,#22d3ee);color:#02131a;font-weight:900;font-size:13px;padding:12px 14px;border-radius:12px">
                    Mở Trung tâm người bán
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      await sendMail({ to: email, subject, text, html });
    }
  } catch (e) {
    console.error('[Bookings] Lỗi gửi email cho cửa hàng:', e);
  }

  res.status(201).json({
    item: {
      _id: doc._id,
      buildId: doc.buildId,
      userId: doc.userId,
      shopId: doc.shopId,
      timeSlot: doc.timeSlot,
      status: doc.status,
      projectStatus: mapBookingToProjectStatus(doc).status,
      projectStatusReason: mapBookingToProjectStatus(doc).reason || '',
      createdAt: doc.createdAt,
      expiresAt: doc.expiresAt,
      snapshot: doc.snapshot,
      shop: {
        _id: vendor._id,
        shopName: vendor.shopName || '',
        address: vendor.address || '',
        email: vendor.email || '',
        phone: vendor.phone || ''
      }
    }
  });
});

const getMyBooking = asyncHandler(async (req, res) => {
  const userId = String(req.user?.id || '');
  const id = String(req.params?.id || '').trim();
  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_ID' });

  const [item, history] = await Promise.all([
    Booking.findOne({ _id: id, userId }).populate('shopId', 'shopName address email phone logo coverImage').lean(),
    BookingProgress.find({ bookingId: new mongoose.Types.ObjectId(id) }).sort({ happenedAt: -1, createdAt: -1 }).lean()
  ]);
  if (!item) return res.status(404).json({ error: 'NOT_FOUND' });

  const shop = item.shopId
    ? {
        _id: item.shopId._id,
        shopName: item.shopId.shopName || '',
        address: item.shopId.address || '',
        email: item.shopId.email || '',
        phone: item.shopId.phone || '',
        logo: item.shopId.logo || '',
        coverImage: item.shopId.coverImage || ''
      }
    : null;

  const mapped = mapBookingToProjectStatus(item);
  res.json({
    item: {
      ...item,
      shopId: undefined,
      shop,
      projectStatus: mapped.status,
      projectStatusReason: mapped.reason || '',
      history: (Array.isArray(history) ? history : []).map((h) => ({
        _id: h._id,
        fromStatus: h.fromStatus ? String(h.fromStatus) : null,
        toStatus: String(h.toStatus || ''),
        actorRole: String(h.actorRole || ''),
        note: String(h.note || ''),
        happenedAt: h.happenedAt || h.createdAt || null
      }))
    }
  });
});

const listMyBookings = asyncHandler(async (req, res) => {
  const userId = String(req.user?.id || '');
  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });

  const statusRaw = String(req.query?.status || '').trim().toLowerCase();
  const status = ['pending', 'quoted', 'accepted', 'in_progress', 'completed', 'rejected', 'cancelled', 'expired'].includes(statusRaw)
    ? statusRaw
    : '';
  const q = { userId, ...(status ? { status } : {}) };

  const items = await Booking.find(q)
    .sort({ createdAt: -1 })
    .populate('shopId', 'shopName address email phone logo coverImage')
    .lean();

  const retentionMs = 7 * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - retentionMs;
  const terminalStatuses = new Set(['completed', 'cancelled', 'rejected', 'expired']);
  const terminalAt = (b) => {
    const s = String(b?.status || '').trim().toLowerCase();
    if (s === 'completed') return b?.handoverAcceptedAt || b?.completedAt || b?.createdAt || null;
    if (s === 'cancelled') return b?.cancelledAt || b?.createdAt || null;
    if (s === 'rejected') return b?.rejectedAt || b?.respondedAt || b?.createdAt || null;
    if (s === 'expired') return b?.expiredAt || b?.expiresAt || b?.createdAt || null;
    return b?.createdAt || null;
  };

  const visible = (Array.isArray(items) ? items : []).filter((b) => {
    const s = String(b?.status || '').trim().toLowerCase();
    if (!terminalStatuses.has(s)) return true;
    const t = terminalAt(b);
    const ms = t ? new Date(t).getTime() : 0;
    return Number.isFinite(ms) && ms >= cutoff;
  });

  res.json({
    items: visible.map((b) => ({
      ...(() => {
        const mapped = mapBookingToProjectStatus(b);
        return { projectStatus: mapped.status, projectStatusReason: mapped.reason || '' };
      })(),
      _id: b._id,
      buildId: b.buildId,
      timeSlot: b.timeSlot,
      status: b.status,
      createdAt: b.createdAt,
      expiresAt: b.expiresAt,
      respondedAt: b.respondedAt || null,
      quotedPrice: typeof b.quotedPrice === 'number' ? b.quotedPrice : null,
      quoteNote: String(b.quoteNote || ''),
      quotedAt: b.quotedAt || null,
      confirmedAt: b.confirmedAt || null,
      rejectedAt: b.rejectedAt || null,
      rejectedReason: String(b.rejectedReason || ''),
      cancelledAt: b.cancelledAt || null,
      cancelReason: String(b.cancelReason || ''),
      startedAt: b.startedAt || null,
      completedAt: b.completedAt || null,
      handoverAcceptedAt: b.handoverAcceptedAt || null,
      snapshot: b.snapshot || null,
      shop: b.shopId
        ? {
            _id: b.shopId._id,
            shopName: b.shopId.shopName || '',
            address: b.shopId.address || '',
            email: b.shopId.email || '',
            phone: b.shopId.phone || '',
            logo: b.shopId.logo || '',
            coverImage: b.shopId.coverImage || ''
          }
        : null
    }))
  });
});

const confirmMyBooking = asyncHandler(async (req, res) => {
  const userId = String(req.user?.id || '');
  const id = String(req.params?.id || '').trim();
  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_ID' });

  const now = new Date();
  const booking = await Booking.findOne({ _id: id, userId }).lean();
  if (!booking) return res.status(404).json({ error: 'NOT_FOUND' });

  const curr = String(booking.status || '').trim().toLowerCase();
  if (curr !== 'quoted') return res.status(409).json({ error: 'NOT_QUOTED' });

  await Booking.updateOne(
    { _id: id },
    { $set: { status: 'accepted', confirmedAt: now, cancelledAt: null, cancelReason: '' } }
  );
  const updated = await Booking.findById(id).lean();

  try {
    await logBookingEvent({ bookingId: id, fromStatus: 'quoted', toStatus: 'accepted', actorRole: 'USER', actorId: userId, note: 'Khách xác nhận thi công', at: now });
  } catch {}

  try {
    const [vendor, user] = await Promise.all([
      booking?.shopId ? Vendor.findById(booking.shopId).select('userId shopName').lean() : Promise.resolve(null),
      User.findById(userId).select('name email').lean()
    ]);

    const buildId = String(updated?.buildId || booking?.buildId || '').trim();
    const shopName = String(vendor?.shopName || '').trim();
    const title = String(updated?.snapshot?.buildName || updated?.snapshot?.carName || '').trim() || buildId;
    const who = String(user?.name || '').trim() || String(user?.email || '').trim() || 'Khách hàng';
    const content = `Khách hàng đã xác nhận thi công: ${title}${shopName ? ` • ${shopName}` : ''} • ${who}`;
    await createNotification({
      userId: String(vendor?.userId || ''),
      type: 'BOOKING_CONFIRMED',
      content,
      meta: { bookingId: String(updated?._id || id), buildId, shopId: String(booking?.shopId || ''), shopName }
    });
  } catch {}

  const mapped = mapBookingToProjectStatus(updated);
  res.json({ item: { ...updated, projectStatus: mapped.status, projectStatusReason: mapped.reason || '' } });
});

const rejectMyBooking = asyncHandler(async (req, res) => {
  const userId = String(req.user?.id || '');
  const id = String(req.params?.id || '').trim();
  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_ID' });

  const now = new Date();
  const booking = await Booking.findOne({ _id: id, userId }).lean();
  if (!booking) return res.status(404).json({ error: 'NOT_FOUND' });

  const curr = String(booking.status || '').trim().toLowerCase();
  if (curr !== 'quoted') return res.status(409).json({ error: 'NOT_QUOTED' });

  const reasonRaw = String(req.body?.reason || req.body?.cancelReason || '').trim();
  const reason = reasonRaw.length > 500 ? reasonRaw.slice(0, 500) : reasonRaw;

  await Booking.updateOne(
    { _id: id },
    { $set: { status: 'cancelled', cancelledAt: now, cancelReason: reason, confirmedAt: null } }
  );
  const updated = await Booking.findById(id).lean();

  try {
    const noteText = reason ? `Khách từ chối thi công: ${reason}` : 'Khách từ chối thi công';
    await logBookingEvent({ bookingId: id, fromStatus: 'quoted', toStatus: 'cancelled', actorRole: 'USER', actorId: userId, note: noteText, at: now });
  } catch {}

  try {
    const [vendor, user] = await Promise.all([
      booking?.shopId ? Vendor.findById(booking.shopId).select('userId shopName').lean() : Promise.resolve(null),
      User.findById(userId).select('name email').lean()
    ]);

    const buildId = String(updated?.buildId || booking?.buildId || '').trim();
    const shopName = String(vendor?.shopName || '').trim();
    const title = String(updated?.snapshot?.buildName || updated?.snapshot?.carName || '').trim() || buildId;
    const who = String(user?.name || '').trim() || String(user?.email || '').trim() || 'Khách hàng';
    const content = reason
      ? `Khách hàng đã từ chối thi công: ${title}${shopName ? ` • ${shopName}` : ''} • ${who} • Lý do: ${reason}`
      : `Khách hàng đã từ chối thi công: ${title}${shopName ? ` • ${shopName}` : ''} • ${who}`;
    await createNotification({
      userId: String(vendor?.userId || ''),
      type: 'BOOKING_CANCELLED',
      content,
      meta: { bookingId: String(updated?._id || id), buildId, shopId: String(booking?.shopId || ''), shopName, reason }
    });
  } catch {}

  const mapped = mapBookingToProjectStatus(updated);
  res.json({ item: { ...updated, projectStatus: mapped.status, projectStatusReason: mapped.reason || '' } });
});

const finishMyBooking = asyncHandler(async (req, res) => {
  const userId = String(req.user?.id || '');
  const id = String(req.params?.id || '').trim();
  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_ID' });

  const now = new Date();
  const booking = await Booking.findOne({ _id: id, userId }).lean();
  if (!booking) return res.status(404).json({ error: 'NOT_FOUND' });

  const curr = String(booking.status || '').trim().toLowerCase();
  if (curr !== 'completed') return res.status(409).json({ error: 'BOOKING_NOT_COMPLETED' });

  if (booking.handoverAcceptedAt) {
    const updated = await Booking.findById(id).lean();
    const base = updated || booking;
    const mapped = mapBookingToProjectStatus(base);
    return res.json({ item: { ...base, projectStatus: mapped.status, projectStatusReason: mapped.reason || '' } });
  }

  await Booking.updateOne({ _id: id }, { $set: { handoverAcceptedAt: now } });
  const updated = await Booking.findById(id).lean();
  const mapped = mapBookingToProjectStatus(updated);
  res.json({ item: { ...updated, projectStatus: mapped.status, projectStatusReason: mapped.reason || '' } });
});

const listVendorBookings = asyncHandler(async (req, res) => {
  const vendorId = String(req.vendor?._id || '');
  if (!vendorId) return res.status(403).json({ error: 'FORBIDDEN' });
  const statusRaw = String(req.query?.status || '').trim().toLowerCase();
  const status = ['pending', 'quoted', 'accepted', 'in_progress', 'completed', 'rejected', 'cancelled', 'expired'].includes(statusRaw)
    ? statusRaw
    : '';
  const q = { shopId: vendorId, ...(status ? { status } : {}) };
  const items = await Booking.find(q)
    .sort({ createdAt: -1 })
    .populate('userId', 'name email')
    .lean();

  res.json({
    items: items.map((b) => ({
      ...(() => {
        const mapped = mapBookingToProjectStatus(b);
        return { projectStatus: mapped.status, projectStatusReason: mapped.reason || '' };
      })(),
      _id: b._id,
      buildId: b.buildId,
      timeSlot: b.timeSlot,
      status: b.status,
      createdAt: b.createdAt,
      expiresAt: b.expiresAt,
      respondedAt: b.respondedAt || null,
      quotedPrice: typeof b.quotedPrice === 'number' ? b.quotedPrice : null,
      quoteNote: String(b.quoteNote || ''),
      quotedAt: b.quotedAt || null,
      confirmedAt: b.confirmedAt || null,
      rejectedAt: b.rejectedAt || null,
      rejectedReason: String(b.rejectedReason || ''),
      cancelledAt: b.cancelledAt || null,
      cancelReason: String(b.cancelReason || ''),
      startedAt: b.startedAt || null,
      completedAt: b.completedAt || null,
      snapshot: b.snapshot || null,
      user: b.userId
        ? { _id: b.userId._id, name: b.userId.name || '', email: b.userId.email || '' }
        : { _id: null, name: '', email: '' }
    }))
  });
});

const getVendorBooking = asyncHandler(async (req, res) => {
  const vendorId = String(req.vendor?._id || '');
  const id = String(req.params?.id || '').trim();
  if (!vendorId) return res.status(403).json({ error: 'FORBIDDEN' });
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_ID' });

  const [b, history] = await Promise.all([
    Booking.findOne({ _id: id, shopId: vendorId }).populate('userId', 'name email').lean(),
    BookingProgress.find({ bookingId: new mongoose.Types.ObjectId(id) }).sort({ happenedAt: -1, createdAt: -1 }).lean()
  ]);
  if (!b) return res.status(404).json({ error: 'NOT_FOUND' });

  res.json({
    item: {
      ...(() => {
        const mapped = mapBookingToProjectStatus(b);
        return { projectStatus: mapped.status, projectStatusReason: mapped.reason || '' };
      })(),
      _id: b._id,
      buildId: b.buildId,
      timeSlot: b.timeSlot,
      status: b.status,
      createdAt: b.createdAt,
      expiresAt: b.expiresAt,
      respondedAt: b.respondedAt || null,
      quotedPrice: typeof b.quotedPrice === 'number' ? b.quotedPrice : null,
      quoteNote: String(b.quoteNote || ''),
      quotedAt: b.quotedAt || null,
      confirmedAt: b.confirmedAt || null,
      rejectedAt: b.rejectedAt || null,
      rejectedReason: String(b.rejectedReason || ''),
      cancelledAt: b.cancelledAt || null,
      cancelReason: String(b.cancelReason || ''),
      startedAt: b.startedAt || null,
      completedAt: b.completedAt || null,
      handoverAcceptedAt: b.handoverAcceptedAt || null,
      snapshot: b.snapshot || null,
      user: b.userId ? { _id: b.userId._id, name: b.userId.name || '', email: b.userId.email || '' } : null,
      history: (Array.isArray(history) ? history : []).map((h) => ({
        _id: h._id,
        fromStatus: h.fromStatus ? String(h.fromStatus) : null,
        toStatus: String(h.toStatus || ''),
        actorRole: String(h.actorRole || ''),
        note: String(h.note || ''),
        happenedAt: h.happenedAt || h.createdAt || null
      }))
    }
  });
});

const buildAcceptedEmail = ({ customerName, shopName, shopAddress, timeSlot, snapshot, bookingId, quotedPrice, quoteNote }) => {
  const name = String(customerName || '').trim() || 'Khách hàng';
  const sName = String(shopName || '').trim() || 'Cửa hàng đối tác';
  const addr = String(shopAddress || '').trim();
  const timeLabel = formatDateTimeVi(timeSlot) || (timeSlot instanceof Date ? timeSlot.toISOString() : String(timeSlot || ''));
  const parts = Array.isArray(snapshot?.parts) ? snapshot.parts : [];
  const items = parts
    .map((p) => {
      const label = String(p?.name || '').trim() || String(p?.type || '').trim();
      const price = formatVnd(p?.price);
      return label ? `- ${label} — ${price}` : '';
    })
    .filter(Boolean)
    .join('\n');
  const hasQuote = typeof quotedPrice === 'number' && Number.isFinite(quotedPrice) && quotedPrice >= 0;
  const total = formatVnd(hasQuote ? quotedPrice : snapshot?.totalPrice);
  const totalLabel = hasQuote ? 'Báo giá' : 'Tổng dự kiến';
  const normalizeLegalWarningText = (raw) => {
    const s = typeof raw === 'string' ? raw.trim() : String(raw || '').trim();
    if (!s) return '';
    const lower = s.toLowerCase();
    if (lower.includes('exhaust modifications') || (lower.includes('noise') && lower.includes('emissions')))
      return 'Cảnh báo (VN): Độ pô/ống xả có thể vượt ngưỡng tiếng ồn/khí thải theo quy định. Nên ưu tiên pô zin hoặc pô có tiêu âm (DB killer) và kiểm tra quy định hiện hành trước khi lưu thông.';
    if (lower.includes('lighting modifications') || (lower.includes('road safety') && lower.includes('regulations')))
      return 'Cảnh báo (VN): Độ đèn phải đảm bảo an toàn giao thông (không gây chói/mất tập trung) và tuân thủ quy định hiện hành khi tham gia giao thông.';
    if (lower.includes('body kit') || (lower.includes('inspection') && lower.includes('registration')))
      return 'Cảnh báo (VN): Thay đổi dàn áo/body kit có thể bị coi là thay đổi kết cấu/hình dáng phương tiện trong một số trường hợp. Hãy kiểm tra yêu cầu kiểm định/đăng ký (nếu có) trước khi sử dụng.';
    if (lower.includes('wheel/tire') || lower.includes('wheel') || lower.includes('tire') || lower.includes('fitment') || lower.includes('load rating'))
      return 'Cảnh báo (VN): Thay mâm/lốp nên đảm bảo đúng kích thước, tải trọng và không cạ vào khung/sườn để tránh mất an toàn khi vận hành.';
    return s;
  };

  const warningList = Array.isArray(snapshot?.legalWarnings) ? snapshot.legalWarnings.map(normalizeLegalWarningText).filter(Boolean) : [];
  const warnings = warningList.length ? warningList.join('\n- ') : '';
  const buildLabel = String(snapshot?.buildName || snapshot?.carName || '').trim() || 'Cấu hình tùy chỉnh';

  const bookingUrl = `${getFrontendUrl()}/booking/${encodeURIComponent(String(bookingId || ''))}`;
  const subject = `eloride • Xác nhận lịch hẹn • ${sName}`;
  const text = [
    `Chào ${name},`,
    '',
    'Tin vui: lịch hẹn của bạn đã được cửa hàng xác nhận.',
    '',
    `Mã đặt lịch: ${bookingId}`,
    `Thời gian: ${timeLabel}`,
    `Cửa hàng: ${sName}`,
    addr ? `Địa chỉ: ${addr}` : '',
    '',
    `Cấu hình: ${buildLabel}`,
    items ? `Phụ kiện đã chọn:\n${items}` : 'Phụ kiện đã chọn: (không có)',
    `${totalLabel}: ${total}`,
    quoteNote ? `Ghi chú từ shop: ${quoteNote}` : '',
    warnings ? `\nCảnh báo pháp lý:\n- ${warnings}` : '',
    '',
    `Xem chi tiết & theo dõi trạng thái: ${bookingUrl}`,
    '',
    'Cảm ơn bạn đã tin tưởng đội ngũ eloride.'
  ]
    .filter(Boolean)
    .join('\n');

  const htmlParts = parts
    .map(
      (p) => {
        const label = String(p?.name || '').trim() || String(p?.type || '').trim();
        if (!label) return '';
        return `<li style="margin:6px 0"><span style="color:#e2e8f0;font-weight:650">${escapeHtml(label)}</span> <span style="color:rgba(148,163,184,0.9)">• ${escapeHtml(
          formatVnd(p?.price)
        )}</span></li>`;
      }
    )
    .filter(Boolean)
    .join('');

  const htmlWarnings = warningList.length
    ? `<ul style="margin:10px 0 0 18px;color:#fde68a">${warningList
        .map((w) => `<li style="margin:6px 0">${escapeHtml(String(w || '').trim())}</li>`)
        .join('')}</ul>`
    : '';

  const html = `
    <div style="margin:0;padding:0;background:#0b1220;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial">
      <div style="padding:24px 16px">
        <div style="max-width:720px;margin:0 auto;background:#0f172a;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden">
          <div style="padding:30px 30px 22px;border-bottom:1px solid rgba(255,255,255,0.08)">
            <div style="font-size:12px;color:rgba(148,163,184,0.95);font-weight:800;letter-spacing:0.14em;text-transform:uppercase">eloride</div>
            <div style="margin-top:10px;font-size:20px;font-weight:900;color:#fff;letter-spacing:-0.01em">Lịch hẹn của bạn đã được xác nhận</div>
            <div style="margin-top:6px;color:rgba(148,163,184,0.9);font-size:13px;line-height:1.6">Chào ${escapeHtml(
              name
            )}, cửa hàng đã xác nhận lịch hẹn. Bạn có thể mở trang theo dõi để xem chi tiết.</div>
          </div>
          <div style="padding:22px 30px 30px">
            <div style="display:grid;grid-template-columns:1fr;gap:14px">
              <div style="padding:14px 14px;border:1px solid rgba(255,255,255,0.08);border-radius:14px;background:rgba(2,6,23,0.35)">
                <div style="font-size:12px;color:rgba(148,163,184,0.9);font-weight:750;letter-spacing:0.06em;text-transform:uppercase">Thông tin lịch hẹn</div>
                <div style="margin-top:10px;color:#fff;font-weight:700">Mã đặt lịch: <span style="color:#e2e8f0">${escapeHtml(
                  String(bookingId || '')
                )}</span></div>
                <div style="margin-top:6px;color:#fff;font-weight:650">Thời gian: <span style="color:#e2e8f0">${escapeHtml(
                  timeLabel || '—'
                )}</span></div>
                <div style="margin-top:6px;color:#fff;font-weight:650">Cửa hàng: <span style="color:#e2e8f0">${escapeHtml(
                  sName
                )}</span></div>
                ${addr ? `<div style="margin-top:6px;color:#fff;font-weight:650">Địa chỉ: <span style="color:#e2e8f0">${escapeHtml(addr)}</span></div>` : ''}
              </div>

              <div style="padding:14px 14px;border:1px solid rgba(255,255,255,0.08);border-radius:14px;background:rgba(2,6,23,0.35)">
                <div style="font-size:12px;color:rgba(148,163,184,0.9);font-weight:750;letter-spacing:0.06em;text-transform:uppercase">Cấu hình</div>
                <div style="margin-top:10px;color:#fff;font-weight:800">${escapeHtml(buildLabel)}</div>
                ${
                  htmlParts
                    ? `<ul style="margin:12px 0 0 18px;padding:0">${htmlParts}</ul>`
                    : `<div style="margin-top:10px;color:rgba(148,163,184,0.9)">Không có phụ kiện nào được chọn.</div>`
                }
                <div style="margin-top:12px;color:#fff;font-weight:750">${escapeHtml(totalLabel)}: <span style="color:#e2e8f0">${escapeHtml(
                  total
                )}</span></div>
                ${
                  quoteNote
                    ? `<div style="margin-top:8px;color:rgba(226,232,240,0.92);font-weight:650">Ghi chú từ shop: <span style="color:rgba(148,163,184,0.95)">${escapeHtml(
                        String(quoteNote || '').trim()
                      )}</span></div>`
                    : ''
                }
                ${
                  htmlWarnings
                    ? `<div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.08)">
                         <div style="font-size:12px;color:#fbbf24;font-weight:850;letter-spacing:0.06em;text-transform:uppercase">Cảnh báo pháp lý</div>
                         ${htmlWarnings}
                       </div>`
                    : ''
                }
              </div>
            </div>

            <div style="margin-top:22px;display:flex;gap:10px;flex-wrap:wrap">
              <a href="${bookingUrl}" style="display:inline-block;text-decoration:none;background:linear-gradient(90deg,#38bdf8,#22d3ee);color:#02131a;font-weight:900;font-size:13px;padding:12px 14px;border-radius:12px">Mở trang theo dõi</a>
              <a href="${getFrontendUrl()}/marketplace" style="display:inline-block;text-decoration:none;border:1px solid rgba(255,255,255,0.14);color:#e2e8f0;font-weight:800;font-size:13px;padding:11px 14px;border-radius:12px;background:rgba(255,255,255,0.04)">Xem Marketplace</a>
            </div>
            <div style="margin-top:18px;color:rgba(148,163,184,0.85);font-size:12px;line-height:1.6">
              Nếu bạn cần đổi cửa hàng hoặc khung giờ, hãy mở trang theo dõi để thao tác nhanh.
            </div>
          </div>
        </div>
      </div>
    </div>
  `.trim();

  return { subject, text, html };
};

const acceptBooking = asyncHandler(async (req, res) => {
  const vendorId = String(req.vendor?._id || '');
  const id = String(req.params?.id || '').trim();
  if (!vendorId) return res.status(403).json({ error: 'FORBIDDEN' });
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_ID' });

  const now = new Date();
  const nextDate = parseDate(req.body?.timeSlot || req.body?.slot || req.body?.time);
  if (nextDate && nextDate.getTime() < now.getTime()) return res.status(400).json({ error: 'TIME_IN_PAST' });

  const quotedPriceRaw = req.body?.quotedPrice ?? req.body?.price ?? req.body?.quotePrice;
  const quotedPrice = quotedPriceRaw === undefined || quotedPriceRaw === null || quotedPriceRaw === '' ? null : Number(quotedPriceRaw);
  if (quotedPrice === null) return res.status(400).json({ error: 'QUOTE_REQUIRED' });
  if (!Number.isFinite(quotedPrice) || quotedPrice <= 0) return res.status(400).json({ error: 'INVALID_QUOTED_PRICE' });
  const quoteNote = String(req.body?.quoteNote || req.body?.note || '').trim();

  const booking = await Booking.findOne({ _id: id, shopId: vendorId }).lean();
  if (!booking) return res.status(404).json({ error: 'NOT_FOUND' });

  if (booking.status !== 'pending') return res.status(409).json({ error: 'NOT_PENDING' });
  if (booking.expiresAt && now.getTime() >= new Date(booking.expiresAt).getTime()) {
    await Booking.updateOne({ _id: id }, { $set: { status: 'expired', expiredAt: now } });
    return res.status(409).json({ error: 'EXPIRED' });
  }

  const patch = { status: 'quoted', respondedAt: now };
  if (nextDate) patch.timeSlot = nextDate;
  patch.quotedPrice = quotedPrice;
  patch.quotedAt = now;
  patch.quoteNote = quoteNote;
  patch.confirmedAt = null;
  patch.cancelledAt = null;
  patch.cancelReason = '';
  await Booking.updateOne({ _id: id }, { $set: patch });
  const updated = await Booking.findById(id).lean();

  try {
    const noteText = quoteNote ? `Báo giá: ${Math.round(quotedPrice)} • ${quoteNote}` : `Báo giá: ${Math.round(quotedPrice)}`;
    await logBookingEvent({ bookingId: id, fromStatus: 'pending', toStatus: 'quoted', actorRole: 'WORKSHOP', actorId: vendorId, note: noteText, at: now });
  } catch {}

  const [vendor, user] = await Promise.all([
    Vendor.findById(vendorId).select('shopName address email phone').lean(),
    User.findById(booking.userId).select('name email').lean()
  ]);

  const userEmail = String(user?.email || '').trim();
  if (userEmail) {
    if (String(updated?.status || '').trim().toLowerCase() === 'quoted') {
      const bookingId = String(updated?._id || '');
      const bookingUrl = `${getFrontendUrl()}/booking/${encodeURIComponent(bookingId)}`;
      const shopName = String(vendor?.shopName || '').trim();
      const timeLabel =
        formatDateTimeVi(updated?.timeSlot) ||
        (updated?.timeSlot instanceof Date ? updated.timeSlot.toISOString() : String(updated?.timeSlot || ''));
      const buildLabel =
        String(updated?.snapshot?.buildName || updated?.snapshot?.carName || '').trim() || String(updated?.buildId || '');
      const quote = typeof updated?.quotedPrice === 'number' && Number.isFinite(updated.quotedPrice) ? formatVnd(updated.quotedPrice) : '—';
      const note = String(updated?.quoteNote || '').trim();
      const subject = `eloride • Báo giá lịch hẹn${shopName ? ` • ${shopName}` : ''}`;
      const text = [
        `Chào ${String(user?.name || userEmail).trim() || userEmail},`,
        '',
        'Shop đã gửi báo giá cho lịch hẹn của bạn.',
        '',
        bookingId ? `Mã đặt lịch: ${bookingId}` : '',
        timeLabel ? `Thời gian: ${timeLabel}` : '',
        shopName ? `Cửa hàng: ${shopName}` : '',
        buildLabel ? `Cấu hình: ${buildLabel}` : '',
        `Báo giá: ${quote}`,
        note ? `Ghi chú từ shop: ${note}` : '',
        '',
        `Vui lòng xác nhận hoặc từ chối thi công tại đây: ${bookingUrl}`,
        '',
        'Cảm ơn bạn đã sử dụng eloride.'
      ]
        .filter(Boolean)
        .join('\n');
      const html = `
        <div style="margin:0;padding:0;background:#0b1220;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial">
          <div style="padding:24px 16px">
            <div style="max-width:720px;margin:0 auto;background:#0f172a;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden">
              <div style="padding:30px 30px 22px;border-bottom:1px solid rgba(255,255,255,0.08)">
                <div style="font-size:12px;color:rgba(148,163,184,0.95);font-weight:800;letter-spacing:0.14em;text-transform:uppercase">eloride</div>
                <div style="margin-top:10px;font-size:20px;font-weight:900;color:#fff;letter-spacing:-0.01em">Shop đã gửi báo giá</div>
                <div style="margin-top:6px;color:rgba(148,163,184,0.9);font-size:13px;line-height:1.6">
                  Chào ${escapeHtml(String(user?.name || userEmail).trim() || userEmail)}, vui lòng xác nhận hoặc từ chối thi công trên trang theo dõi.
                </div>
              </div>
              <div style="padding:22px 30px 30px">
                <div style="display:grid;grid-template-columns:1fr;gap:14px">
                  <div style="padding:14px 14px;border:1px solid rgba(255,255,255,0.08);border-radius:14px;background:rgba(2,6,23,0.35)">
                    <div style="font-size:12px;color:rgba(148,163,184,0.9);font-weight:750;letter-spacing:0.06em;text-transform:uppercase">Thông tin</div>
                    ${bookingId ? `<div style="margin-top:10px;color:#fff;font-weight:700">Mã đặt lịch: <span style="color:#e2e8f0">${escapeHtml(bookingId)}</span></div>` : ''}
                    ${timeLabel ? `<div style="margin-top:6px;color:#fff;font-weight:650">Thời gian: <span style="color:#e2e8f0">${escapeHtml(timeLabel)}</span></div>` : ''}
                    ${shopName ? `<div style="margin-top:6px;color:#fff;font-weight:650">Cửa hàng: <span style="color:#e2e8f0">${escapeHtml(shopName)}</span></div>` : ''}
                    ${buildLabel ? `<div style="margin-top:6px;color:#fff;font-weight:650">Cấu hình: <span style="color:#e2e8f0">${escapeHtml(buildLabel)}</span></div>` : ''}
                    <div style="margin-top:10px;color:#fff;font-weight:900">Báo giá: <span style="color:#e2e8f0">${escapeHtml(quote)}</span></div>
                    ${note ? `<div style="margin-top:8px;color:rgba(226,232,240,0.92);font-weight:650">Ghi chú từ shop: <span style="color:rgba(148,163,184,0.95)">${escapeHtml(note)}</span></div>` : ''}
                  </div>
                </div>
                <div style="margin-top:22px;display:flex;gap:10px;flex-wrap:wrap">
                  <a href="${bookingUrl}" style="display:inline-block;text-decoration:none;background:linear-gradient(90deg,#38bdf8,#22d3ee);color:#02131a;font-weight:900;font-size:13px;padding:12px 14px;border-radius:12px">Mở trang theo dõi</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      await sendMail({ to: userEmail, subject, text, html });
    } else {
      const mail = buildAcceptedEmail({
        customerName: user?.name || userEmail,
        shopName: vendor?.shopName || '',
        shopAddress: vendor?.address || '',
        timeSlot: updated?.timeSlot,
        snapshot: updated?.snapshot || {},
        bookingId: String(updated?._id || ''),
        quotedPrice: updated?.quotedPrice ?? null,
        quoteNote: String(updated?.quoteNote || '')
      });
      await sendMail({ to: userEmail, subject: mail.subject, text: mail.text, html: mail.html });
    }
  }

  try {
    const buildId = String(updated?.buildId || booking?.buildId || '').trim();
    const shopName = String(vendor?.shopName || '').trim();
    const when = updated?.timeSlot instanceof Date ? updated.timeSlot.toISOString() : '';
    const title = String(updated?.snapshot?.buildName || updated?.snapshot?.carName || '').trim() || buildId;
    const quoteText =
      typeof updated?.quotedPrice === 'number' && Number.isFinite(updated.quotedPrice) && updated.quotedPrice > 0 ? ` • Báo giá: ${formatVnd(updated.quotedPrice)}` : '';
    const content = quoteText
      ? `Shop đã gửi báo giá cho lịch hẹn của bạn: ${title}${shopName ? ` • ${shopName}` : ''}${quoteText}`
      : `Shop đã chấp nhận lịch hẹn của bạn: ${title}${shopName ? ` • ${shopName}` : ''}`;
    await createNotification({
      userId: String(booking?.userId || ''),
      type: 'BOOKING_ACCEPTED',
      content,
      meta: {
        bookingId: String(updated?._id || ''),
        buildId,
        shopId: String(vendorId),
        shopName,
        timeSlot: when,
        quotedPrice: updated?.quotedPrice ?? null
      }
    });
    if (buildId && mongoose.isValidObjectId(buildId)) {
      await notifyFollowers({
        itemType: 'build',
        itemId: buildId,
        type: 'BUILD_ACCEPTED',
        content: `Build bạn theo dõi đã được shop chấp nhận: ${title}${shopName ? ` • ${shopName}` : ''}`,
        meta: { bookingId: String(updated?._id || ''), buildId, shopId: String(vendorId), shopName, timeSlot: when },
        excludeUserIds: [String(booking?.userId || '')]
      });
    }
  } catch {}

  const mapped = mapBookingToProjectStatus(updated);
  res.json({ item: { ...updated, projectStatus: mapped.status, projectStatusReason: mapped.reason || '' } });
});

const updateBookingStatus = asyncHandler(async (req, res) => {
  const vendorId = String(req.vendor?._id || '');
  const id = String(req.params?.id || '').trim();
  if (!vendorId) return res.status(403).json({ error: 'FORBIDDEN' });
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_ID' });

  const nextRaw = String(req.body?.status || req.body?.nextStatus || '').trim().toLowerCase();
  const next = nextRaw === 'in_progress' || nextRaw === 'completed' ? nextRaw : '';
  if (!next) return res.status(400).json({ error: 'INVALID_STATUS' });

  const now = new Date();
  const booking = await Booking.findOne({ _id: id, shopId: vendorId }).lean();
  if (!booking) return res.status(404).json({ error: 'NOT_FOUND' });

  const curr = String(booking.status || '').trim().toLowerCase();
  if (curr !== 'accepted' && curr !== 'in_progress') return res.status(409).json({ error: 'INVALID_TRANSITION' });
  if (next === 'in_progress' && curr !== 'accepted') return res.status(409).json({ error: 'INVALID_TRANSITION' });

  const patch = { status: next };
  if (next === 'in_progress') {
    patch.startedAt = booking.startedAt || now;
    patch.completedAt = null;
  } else if (next === 'completed') {
    patch.startedAt = booking.startedAt || now;
    patch.completedAt = now;
  }

  await Booking.updateOne({ _id: id }, { $set: patch });
  const updated = await Booking.findById(id).lean();

  try {
    const noteText = next === 'in_progress' ? 'Bắt đầu thi công' : 'Hoàn tất';
    await logBookingEvent({ bookingId: id, fromStatus: curr, toStatus: next, actorRole: 'WORKSHOP', actorId: vendorId, note: noteText, at: now });
  } catch {}

  if (next === 'completed') {
    try {
      const [vendor, user] = await Promise.all([
        Vendor.findById(vendorId).select('shopName').lean(),
        updated?.userId ? User.findById(updated.userId).select('name email').lean() : Promise.resolve(null)
      ]);
      try {
        const uid = String(updated?.userId || '').trim();
        if (mongoose.isValidObjectId(uid)) {
          const buildId = String(updated?.buildId || '').trim();
          const shopName = String(vendor?.shopName || '').trim();
          const title = String(updated?.snapshot?.buildName || updated?.snapshot?.carName || '').trim() || buildId || String(updated?._id || id);
          await createNotification({
            userId: uid,
            type: 'BOOKING_COMPLETED',
            content: `Shop đã bàn giao cho khách: ${title}${shopName ? ` • ${shopName}` : ''}`,
            meta: {
              bookingId: String(updated?._id || id),
              buildId: buildId || null,
              shopId: String(vendorId),
              shopName,
              completedAt: updated?.completedAt instanceof Date ? updated.completedAt.toISOString() : updated?.completedAt || null
            }
          });
        }
      } catch {}
      const userEmail = String(user?.email || '').trim();
      if (userEmail) {
        const ratingLinks = {};
        if (process.env.JWT_SECRET) {
          for (let stars = 1; stars <= 5; stars += 1) {
            const token = signReviewToken({
              bookingId: String(updated?._id || id),
              vendorId: String(vendorId),
              userId: String(updated?.userId || ''),
              rating: stars
            });
            ratingLinks[stars] = `${getBackendUrl()}/api/bookings/review?t=${encodeURIComponent(token)}`;
          }
        }
        const mail = buildCompletedEmail({
          customerName: user?.name || userEmail,
          shopName: vendor?.shopName || '',
          bookingId: String(updated?._id || id),
          timeSlot: updated?.timeSlot,
          snapshot: updated?.snapshot,
          ratingLinks
        });
        await sendMail({ to: userEmail, subject: mail.subject, text: mail.text, html: mail.html });
      }
    } catch (e) {
      console.error('[Bookings] Lỗi gửi email cảm ơn/đánh giá:', e?.message || e);
    }
  }

  const mapped = mapBookingToProjectStatus(updated);
  res.json({ item: { ...updated, projectStatus: mapped.status, projectStatusReason: mapped.reason || '' } });
});

const rescheduleBooking = asyncHandler(async (req, res) => {
  const vendorId = String(req.vendor?._id || '');
  const id = String(req.params?.id || '').trim();
  if (!vendorId) return res.status(403).json({ error: 'FORBIDDEN' });
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_ID' });

  const nextDate = parseDate(req.body?.timeSlot || req.body?.slot || req.body?.time);
  if (!nextDate) return res.status(400).json({ error: 'INVALID_TIME' });

  const now = new Date();
  if (nextDate.getTime() < now.getTime()) return res.status(400).json({ error: 'TIME_IN_PAST' });

  const booking = await Booking.findOne({ _id: id, shopId: vendorId }).lean();
  if (!booking) return res.status(404).json({ error: 'NOT_FOUND' });

  const status = String(booking?.status || '').trim().toLowerCase();
  if (status !== 'accepted') return res.status(409).json({ error: 'INVALID_STATUS' });

  const prevTime = booking?.timeSlot ? new Date(booking.timeSlot) : null;
  await Booking.updateOne({ _id: id }, { $set: { timeSlot: nextDate } });
  const updated = await Booking.findById(id).lean();

  try {
    const prevLabel = prevTime ? prevTime.toISOString() : '';
    const nextLabel = nextDate ? nextDate.toISOString() : '';
    const noteText = prevLabel ? `Dời lịch: ${prevLabel} → ${nextLabel}` : `Dời lịch: ${nextLabel}`;
    await logBookingEvent({ bookingId: id, fromStatus: 'accepted', toStatus: 'accepted', actorRole: 'WORKSHOP', actorId: vendorId, note: noteText, at: now });
  } catch {}

  try {
    const [vendor, user] = await Promise.all([
      Vendor.findById(vendorId).select('shopName address email phone').lean(),
      booking?.userId ? User.findById(booking.userId).select('name email').lean() : Promise.resolve(null)
    ]);
    const userEmail = String(user?.email || '').trim();
    if (userEmail) {
      const shopName = String(vendor?.shopName || '').trim();
      const oldLabel = prevTime ? formatDateTimeVi(prevTime) || prevTime.toISOString() : '';
      const newLabel = formatDateTimeVi(nextDate) || nextDate.toISOString();
      const subject = `eloride • Dời lịch thi công${shopName ? ` • ${shopName}` : ''}`;
      const bookingUrl = `${getFrontendUrl()}/booking/${encodeURIComponent(String(updated?._id || id))}`;
      const text = [
        'Shop đã dời lịch thi công.',
        '',
        shopName ? `Cửa hàng: ${shopName}` : '',
        oldLabel ? `Lịch cũ: ${oldLabel}` : '',
        `Lịch mới: ${newLabel}`,
        '',
        `Xem chi tiết lịch hẹn: ${bookingUrl}`
      ]
        .filter(Boolean)
        .join('\n');
      const html = `
        <div style="margin:0;padding:0;background:#0b1220;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial">
          <div style="padding:24px 16px">
            <div style="max-width:720px;margin:0 auto;background:#0f172a;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden">
              <div style="padding:18px 18px;border-bottom:1px solid rgba(255,255,255,0.08);background:linear-gradient(135deg,rgba(56,189,248,0.16),rgba(34,211,238,0.10))">
                <div style="font-size:12px;letter-spacing:0.16em;color:rgba(224,242,254,0.95);font-weight:700">ELORIDE</div>
                <div style="margin-top:8px;font-size:18px;color:#fff;font-weight:900">Shop đã dời lịch thi công</div>
                ${shopName ? `<div style="margin-top:6px;color:rgba(226,232,240,0.9);font-size:13px">${escapeHtml(shopName)}</div>` : ''}
              </div>
              <div style="padding:18px 18px;color:rgba(226,232,240,0.95);font-size:14px;line-height:1.6">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse">
                  ${oldLabel ? `<tr><td style="padding:10px 0;color:rgba(148,163,184,0.9);width:140px">Lịch cũ</td><td style="padding:10px 0;color:#fff;font-weight:700">${escapeHtml(oldLabel)}</td></tr>` : ''}
                  <tr><td style="padding:10px 0;color:rgba(148,163,184,0.9);width:140px">Lịch mới</td><td style="padding:10px 0;color:#fff;font-weight:900">${escapeHtml(newLabel)}</td></tr>
                </table>
                <div style="margin-top:16px">
                  <a href="${bookingUrl}" style="display:inline-block;text-decoration:none;background:linear-gradient(90deg,#38bdf8,#22d3ee);color:#02131a;font-weight:900;font-size:13px;padding:12px 14px;border-radius:12px">
                    Xem chi tiết lịch hẹn
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      await sendMail({ to: userEmail, subject, text, html });
    }
  } catch (e) {
    console.error('[Bookings] Lỗi gửi email dời lịch:', e?.message || e);
  }

  const mapped = mapBookingToProjectStatus(updated);
  res.json({ item: { ...updated, projectStatus: mapped.status, projectStatusReason: mapped.reason || '' } });
});

const captureBookingReview = asyncHandler(async (req, res) => {
  const parsed = parseBookingReviewToken(req.query?.t || req.query?.token);
  if (!parsed.ok) return res.status(parsed.status).send(parsed.message);
  const { token, bookingId, vendorId, userId, rating } = parsed;

  const b = await Booking.findOne({ _id: bookingId, shopId: vendorId, userId }).select('_id status').lean();
  if (!b) return res.status(404).send('Không tìm thấy lịch hẹn.');
  if (String(b.status || '').trim().toLowerCase() !== 'completed') {
    return res.status(409).send('Lịch hẹn chưa hoàn thành nên chưa thể đánh giá.');
  }

  await VendorReview.findOneAndUpdate(
    { vendorId: new mongoose.Types.ObjectId(vendorId), userId: new mongoose.Types.ObjectId(userId), bookingId: new mongoose.Types.ObjectId(bookingId) },
    { $set: { rating, comment: '' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const homeUrl = `${getFrontendUrl()}/`;
  const isLow = rating <= 3;
  const stars = '★★★★★'.slice(0, rating) + '☆☆☆☆☆'.slice(0, 5 - rating);
  const dotColor = isLow ? '#fb7185' : '#22c55e';
  const dotGlow = isLow ? 'rgba(251,113,133,0.18)' : 'rgba(34,197,94,0.18)';
  res
    .status(200)
    .send(
      `
      <!doctype html>
      <html lang="vi">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>eloride • Cảm ơn bạn</title>
        </head>
        <body style="margin:0;background:#070c16;color:#e5e7eb;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial">
          <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:28px 14px">
            <div style="position:fixed;inset:0;pointer-events:none;background:
              radial-gradient(700px 380px at 14% 8%, rgba(34,197,94,0.22), transparent 60%),
              radial-gradient(740px 420px at 86% 18%, rgba(56,189,248,0.18), transparent 60%),
              radial-gradient(820px 520px at 50% 92%, rgba(168,85,247,0.12), transparent 60%),
              linear-gradient(180deg, rgba(2,6,23,0.0), rgba(2,6,23,0.75) 60%, rgba(2,6,23,0.92))"></div>

            <div style="width:100%;max-width:620px;position:relative">
              <div style="border:1px solid rgba(255,255,255,0.08);border-radius:22px;overflow:hidden;background:rgba(15,23,42,0.78);backdrop-filter:blur(14px)">
                <div style="padding:20px 22px;border-bottom:1px solid rgba(255,255,255,0.08);background:linear-gradient(135deg, rgba(34,197,94,0.22), rgba(14,165,233,0.16))">
                  <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
                    <div style="display:flex;align-items:center;gap:10px;min-width:0">
                      <div style="width:38px;height:38px;border-radius:14px;background:rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:center">
                        <div style="width:18px;height:18px;border-radius:999px;background:${dotColor};box-shadow:0 0 0 6px ${dotGlow}"></div>
                      </div>
                      <div style="min-width:0">
                        <div style="font-weight:950;font-size:18px;letter-spacing:0.2px">eloride</div>
                        <div style="margin-top:3px;font-weight:900;font-size:15px;color:rgba(226,232,240,0.95)">${isLow ? 'Rất tiếc về trải nghiệm của bạn' : 'Cảm ơn bạn'}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div style="padding:22px 22px 18px;text-align:center">
                  <div style="margin:0 auto;max-width:520px">
                    <div style="font-size:16px;line-height:1.7;color:#e2e8f0;font-weight:900">
                      ${isLow ? 'Mình xin lỗi vì dịch vụ chưa làm bạn hài lòng.' : 'Cảm ơn bạn đã dành thời gian đánh giá dịch vụ.'}
                    </div>
                    <div style="margin-top:10px;font-size:18px;letter-spacing:2px;color:${isLow ? '#fb7185' : '#fbbf24'};font-weight:950">${stars}</div>
                    <div style="margin-top:10px;font-size:13px;line-height:1.8;color:#94a3b8">
                      ${
                        isLow
                          ? 'Bạn có thể cho mình biết điều gì chưa ổn để tụi mình cải thiện không?'
                          : 'Đánh giá của bạn đã được ghi nhận và sẽ giúp eloride phục vụ tốt hơn.'
                      }
                    </div>
                    ${
                      isLow
                        ? `
                          <div id="fb_wrap" style="margin-top:14px;text-align:left">
                            <div style="font-size:12px;font-weight:800;color:rgba(226,232,240,0.9);letter-spacing:0.06em;text-transform:uppercase">Góp ý của bạn</div>
                            <textarea id="fb_comment" rows="4" placeholder="VD: Thái độ phục vụ, thời gian chờ, chất lượng lắp đặt..." style="margin-top:8px;width:100%;box-sizing:border-box;border-radius:14px;border:1px solid rgba(255,255,255,0.10);background:rgba(2,6,23,0.35);color:#e2e8f0;padding:12px 12px;outline:none;resize:vertical;line-height:1.5"></textarea>
                            <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">
                              <button id="fb_submit" type="button" style="cursor:pointer;border:none;border-radius:14px;background:linear-gradient(90deg,#fb7185,#f43f5e);color:#14070a;font-weight:950;font-size:13px;padding:12px 14px">Gửi góp ý</button>
                              <span id="fb_state" style="font-size:12px;color:#94a3b8"></span>
                            </div>
                          </div>
                          <script>
                            (function () {
                              var btn = document.getElementById('fb_submit');
                              var box = document.getElementById('fb_comment');
                              var state = document.getElementById('fb_state');
                              if (!btn || !box) return;
                              btn.addEventListener('click', async function () {
                                try {
                                  btn.disabled = true;
                                  btn.style.opacity = '0.75';
                                  state.textContent = 'Đang gửi...';
                                  var comment = String(box.value || '').trim();
                                  var resp = await fetch('/api/bookings/review', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ t: ${JSON.stringify(token)}, comment: comment })
                                  });
                                  if (!resp.ok) throw new Error('FAILED');
                                  state.textContent = 'Đã nhận góp ý. Cảm ơn bạn!';
                                  box.value = '';
                                } catch (e) {
                                  state.textContent = 'Không gửi được. Vui lòng thử lại.';
                                } finally {
                                  btn.disabled = false;
                                  btn.style.opacity = '1';
                                }
                              });
                            })();
                          </script>
                        `
                        : ''
                    }
                    <div style="margin-top:14px">
                      <a href="${homeUrl}" style="display:inline-block;text-decoration:none;background:linear-gradient(90deg,#38bdf8,#22d3ee);color:#02131a;font-weight:950;font-size:13px;padding:12px 14px;border-radius:14px">
                        Ghé thăm website eloride
                      </a>
                    </div>
                  </div>
                </div>

                <div style="padding:14px 22px;background:rgba(2,6,23,0.55);border-top:1px solid rgba(255,255,255,0.08);display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center">
                  <div style="font-size:12px;color:#64748b">© ${new Date().getFullYear()} eloride</div>
                  <div style="font-size:12px;color:#64748b">Cảm ơn bạn đã đồng hành cùng chúng tôi</div>
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `.trim()
    );
});

const submitBookingReviewComment = asyncHandler(async (req, res) => {
  const parsed = parseBookingReviewToken(req.body?.t || req.body?.token || req.query?.t || req.query?.token);
  if (!parsed.ok) return res.status(400).json({ error: 'INVALID_TOKEN' });
  const { bookingId, vendorId, userId, rating } = parsed;

  const b = await Booking.findOne({ _id: bookingId, shopId: vendorId, userId }).select('_id status').lean();
  if (!b) return res.status(404).json({ error: 'NOT_FOUND' });
  if (String(b.status || '').trim().toLowerCase() !== 'completed') return res.status(409).json({ error: 'NOT_COMPLETED' });

  const raw = String(req.body?.comment || '').trim();
  const comment = raw.length > 1000 ? raw.slice(0, 1000) : raw;

  await VendorReview.findOneAndUpdate(
    { vendorId: new mongoose.Types.ObjectId(vendorId), userId: new mongoose.Types.ObjectId(userId), bookingId: new mongoose.Types.ObjectId(bookingId) },
    { $set: { rating, comment } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.json({ ok: true });
});

const rejectBooking = asyncHandler(async (req, res) => {
  const vendorId = String(req.vendor?._id || '');
  const id = String(req.params?.id || '').trim();
  if (!vendorId) return res.status(403).json({ error: 'FORBIDDEN' });
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_ID' });

  const now = new Date();
  const booking = await Booking.findOne({ _id: id, shopId: vendorId }).lean();
  if (!booking) return res.status(404).json({ error: 'NOT_FOUND' });

  if (booking.status !== 'pending') return res.status(409).json({ error: 'NOT_PENDING' });
  if (booking.expiresAt && now.getTime() >= new Date(booking.expiresAt).getTime()) {
    await Booking.updateOne({ _id: id }, { $set: { status: 'expired', expiredAt: now } });
    return res.status(409).json({ error: 'EXPIRED' });
  }

  const reasonRaw = String(req.body?.reason || req.body?.rejectedReason || '').trim();
  const reason = reasonRaw.length > 500 ? reasonRaw.slice(0, 500) : reasonRaw;

  await Booking.updateOne(
    { _id: id },
    { $set: { status: 'rejected', respondedAt: now, rejectedAt: now, rejectedReason: reason } }
  );
  const updated = await Booking.findById(id).lean();

  try {
    const noteText = reason ? `Shop từ chối: ${reason}` : 'Shop từ chối';
    await logBookingEvent({ bookingId: id, fromStatus: 'pending', toStatus: 'rejected', actorRole: 'WORKSHOP', actorId: vendorId, note: noteText, at: now });
  } catch {}

  const [vendor, user] = await Promise.all([
    Vendor.findById(vendorId).select('shopName address email phone').lean(),
    User.findById(booking.userId).select('name email').lean()
  ]);

  const userEmail = String(user?.email || '').trim();
  if (userEmail) {
    const shopName = String(vendor?.shopName || '').trim();
    const timeLabel =
      formatDateTimeVi(updated?.timeSlot) ||
      (updated?.timeSlot instanceof Date ? updated.timeSlot.toISOString() : String(updated?.timeSlot || ''));
    const buildLabel = String(updated?.snapshot?.buildName || updated?.snapshot?.carName || '').trim() || String(updated?.buildId || '');
    const bookingUrl = `${getFrontendUrl()}/booking/${encodeURIComponent(String(updated?._id || ''))}`;
    const subject = `eloride • Lịch hẹn không được chấp nhận${shopName ? ` • ${shopName}` : ''}`;
    const text = [
      `Chào ${String(user?.name || userEmail).trim() || userEmail},`,
      '',
      'Chúng tôi rất tiếc — cửa hàng không thể nhận lịch đặt vào thời gian bạn yêu cầu.',
      shopName ? `Cửa hàng: ${shopName}` : '',
      timeLabel ? `Thời gian: ${timeLabel}` : '',
      buildLabel ? `Cấu hình: ${buildLabel}` : '',
      reason ? `Lý do từ cửa hàng: ${reason}` : '',
      '',
      `Mở trang theo dõi để chọn cửa hàng khác ngay: ${bookingUrl}`,
      '',
      'Xin lỗi vì sự bất tiện này.'
    ]
      .filter(Boolean)
      .join('\n');
    const html = `
      <div style="margin:0;padding:0;background:#0b1220;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial">
        <div style="padding:24px 16px">
          <div style="max-width:720px;margin:0 auto;background:#0f172a;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden">
            <div style="padding:32px 32px 24px;border-bottom:1px solid rgba(255,255,255,0.08)">
              <div style="font-size:18px;font-weight:800;color:#fff;letter-spacing:-0.01em">
                Lịch hẹn không được chấp nhận
              </div>
              <div style="margin-top:6px;color:rgba(148,163,184,0.9);font-size:13px;line-height:1.5">
                Chúng tôi rất tiếc — cửa hàng không thể nhận lịch đặt vào thời gian bạn yêu cầu.
              </div>
            </div>
            <div style="padding:24px 32px 32px">
              <div style="display:grid;grid-template-columns:1fr;gap:24px">
                <div>
                  <div style="font-size:12px;color:rgba(148,163,184,0.9);font-weight:700;letter-spacing:0.06em;text-transform:uppercase">Cửa hàng</div>
                  <div style="margin-top:6px;color:#fff;font-weight:600">${escapeHtml(shopName) || 'Cửa hàng'}</div>
                </div>
                <div>
                  <div style="font-size:12px;color:rgba(148,163,184,0.9);font-weight:700;letter-spacing:0.06em;text-transform:uppercase">Thời gian</div>
                  <div style="margin-top:6px;color:#fff;font-weight:600">${escapeHtml(timeLabel) || '—'}</div>
                </div>
                <div>
                  <div style="font-size:12px;color:rgba(148,163,184,0.9);font-weight:700;letter-spacing:0.06em;text-transform:uppercase">Cấu hình</div>
                  <div style="margin-top:6px;color:#fff;font-weight:600">${escapeHtml(buildLabel) || 'Cấu hình tùy chỉnh'}</div>
                </div>
              </div>
              ${
                reason
                  ? `<div style="margin-top:24px;padding:16px;border:1px solid rgba(255,255,255,0.08);border-radius:12px;background:rgba(2,6,23,0.4)">
                      <div style="font-size:12px;color:rgba(148,163,184,0.9);font-weight:700;letter-spacing:0.06em;text-transform:uppercase">Lý do từ cửa hàng</div>
                      <div style="margin-top:8px;color:#fff;font-weight:600;white-space:pre-wrap">${escapeHtml(reason)}</div>
                    </div>`
                  : ''
              }
              <div style="margin-top:32px;padding-top:24px;border-top:1px solid rgba(255,255,255,0.08)">
                <a href="${bookingUrl}" style="display:inline-block;text-decoration:none;background:linear-gradient(90deg,#38bdf8,#22d3ee);color:#02131a;font-weight:900;font-size:13px;padding:12px 14px;border-radius:12px">Mở trang theo dõi</a>
                <a href="${getFrontendUrl()}/marketplace" style="display:inline-block;margin-left:10px;text-decoration:none;border:1px solid rgba(255,255,255,0.14);color:#e2e8f0;font-weight:800;font-size:13px;padding:11px 14px;border-radius:12px;background:rgba(255,255,255,0.04)">Xem Marketplace</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    try {
      await sendMail({ to: userEmail, subject, text, html });
    } catch (e) {
      console.error('[Bookings] Lỗi gửi email cho khách hàng:', e);
    }
  }

  const mapped = mapBookingToProjectStatus(updated);
  res.json({ item: { ...updated, projectStatus: mapped.status, projectStatusReason: mapped.reason || '' } });
});

const expirePendingBookings = async () => {
  const now = new Date();
  const r = await Booking.updateMany(
    { status: 'pending', expiresAt: { $lte: now } },
    { $set: { status: 'expired', expiredAt: now } }
  );
  return Number(r?.modifiedCount || r?.nModified || 0);
};

module.exports = {
  createBooking,
  getMyBooking,
  listMyBookings,
  confirmMyBooking,
  rejectMyBooking,
  finishMyBooking,
  listVendorBookings,
  getVendorBooking,
  acceptBooking,
  updateBookingStatus,
  rescheduleBooking,
  captureBookingReview,
  submitBookingReviewComment,
  rejectBooking,
  expirePendingBookings
};
