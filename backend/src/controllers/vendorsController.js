const crypto = require('crypto');
const mongoose = require('mongoose');

const Vendor = require('../models/Vendor');
const VendorReview = require('../models/VendorReview');
const PartnerApplication = require('../models/PartnerApplication');
const User = require('../models/User');
const ShopPost = require('../models/ShopPost');
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

const getRequestBaseUrl = (req) => {
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http')
    .split(',')[0]
    .trim();
  const host = String(req.headers['x-forwarded-host'] || req.get('host') || '')
    .split(',')[0]
    .trim();
  if (!host) return '';
  return `${proto}://${host}`;
};

const getFrontendUrl = () => String(process.env.FRONTEND_URL || 'http://localhost:5173').trim().replace(/\/+$/, '');

const escapeHtml = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const isValidEmail = (value) => {
  const email = normalizeEmail(value);
  if (!email) return false;
  if (email.length > 254) return false;
  const at = email.indexOf('@');
  if (at <= 0) return false;
  if (at !== email.lastIndexOf('@')) return false;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (!local || !domain) return false;
  if (local.length > 64) return false;
  if (domain.length > 255) return false;
  if (local.startsWith('.') || local.endsWith('.')) return false;
  if (local.includes('..')) return false;
  if (!/^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+$/i.test(local)) return false;
  if (domain.includes('..')) return false;
  if (!domain.includes('.')) return false;
  const labels = domain.split('.');
  if (labels.some((l) => !l || l.length > 63)) return false;
  if (labels.some((l) => !/^[a-z0-9-]+$/i.test(l))) return false;
  if (labels.some((l) => l.startsWith('-') || l.endsWith('-'))) return false;
  const tld = labels[labels.length - 1] || '';
  if (tld.length < 2 || tld.length > 63) return false;
  return true;
};

const normalizePhone = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const cleaned = raw.replace(/[^\d+]/g, '');
  const digits = cleaned.replace(/[^\d]/g, '');
  if (digits.length < 8 || digits.length > 15) return '';
  if (cleaned.startsWith('+')) return `+${digits}`;
  return digits;
};

const normalizeForBlockedText = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[\s\-_.]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim();

const isInappropriateText = (value) => {
  const s = normalizeForBlockedText(value);
  if (!s) return false;
  const compact = s.replace(/\s+/g, '');
  const profanity = [
    /\b(fuck|shit|bitch|cunt|motherfucker)\b/i,
    /\b(dcm|dm)\b/i,
    /(địt|dit|đụ|du|lồn|lon|cặc|cac|cak|buồi|buoi)/i,
    /(chó\s*mày|cho\s*may)/i,
    /(dit|du|lon|cac|cak|buoi)/i
  ];
  if (profanity.some((rx) => rx.test(s) || rx.test(compact))) return true;
  const sensitive = [
    /\b(porn|xxx|sex|nude)\b/i,
    /(hiep\s*dam|rape)/i,
    /(au\s*dam|pedo|pedophile|child\s*porn)/i,
    /(tu\s*tu|suicide|kill\s*(myself|yourself))/i,
    /(ma\s*tuy|cocaine|heroin|meth|mdma|\bweed\b|can\s*sa)/i
  ];
  if (sensitive.some((rx) => rx.test(s) || rx.test(compact))) return true;
  return false;
};

const validateHumanName = (value) => {
  const raw = String(value || '').trim().replace(/\s+/g, ' ');
  if (!raw) return { ok: false, error: 'INVALID_REPRESENTATIVE_NAME' };
  if (raw.length < 2 || raw.length > 80) return { ok: false, error: 'INVALID_REPRESENTATIVE_NAME' };
  if (!/^[\p{L}][\p{L}\s.'-]*$/u.test(raw)) return { ok: false, error: 'INVALID_REPRESENTATIVE_NAME' };
  if (!/[\p{L}]/u.test(raw)) return { ok: false, error: 'INVALID_REPRESENTATIVE_NAME' };
  if (isInappropriateText(raw)) return { ok: false, error: 'REPRESENTATIVE_NAME_INAPPROPRIATE' };
  return { ok: true, value: raw };
};

const signAdminAction = ({ action, applicationId, expiresAt }) => {
  const secret = String(process.env.ADMIN_ACTION_SECRET || process.env.JWT_SECRET || '').trim();
  if (!secret) return '';
  const exp = String(expiresAt || '');
  const payload = `${String(action || '')}.${String(applicationId || '')}.${exp}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
};

const verifyAdminAction = ({ action, applicationId, expiresAt, token }) => {
  const secret = String(process.env.ADMIN_ACTION_SECRET || process.env.JWT_SECRET || '').trim();
  if (!secret) return false;
  const expMs = Number(expiresAt);
  if (!Number.isFinite(expMs) || expMs <= Date.now()) return false;
  const expected = signAdminAction({ action, applicationId, expiresAt });
  const a = Buffer.from(String(expected || ''), 'utf8');
  const b = Buffer.from(String(token || ''), 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

const toNumOrNull = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
};

const haversineKm = ({ lat1, lng1, lat2, lng2 }) => {
  const R = 6371;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const hash01 = (s) => {
  const str = String(s || '');
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const x = (h >>> 0) / 4294967295;
  return x;
};

const buildSlots = () => {
  const now = new Date();
  const slots = [];
  for (let day = 0; day < 3; day += 1) {
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate() + day, 0, 0, 0, 0);
    for (const h of [10, 13, 16]) {
      const d = new Date(base);
      d.setHours(h, 0, 0, 0);
      if (d.getTime() < now.getTime() + 30 * 60 * 1000) continue;
      slots.push(d.toISOString());
    }
  }
  return slots.slice(0, 9);
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

const listPartneredVendors = asyncHandler(async (req, res) => {
  const lat = toNumOrNull(req.query?.lat);
  const lng = toNumOrNull(req.query?.lng);
  const hasUserPos = lat !== null && lng !== null;

  const isProd = String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production';
  if (!isProd) {
    const apps = await PartnerApplication.find({ status: 'pending' })
      .sort({ createdAt: -1 })
      .select('shopName representativeName province phone email createdAt')
      .limit(50)
      .lean();
    if (apps.length) {
      for (const a of apps) {
        const email = String(a?.email || '').trim().toLowerCase();
        if (!email) continue;
        const user = await User.findOne({ email }).select('_id email role').lean();
        if (!user) continue;
        const now = new Date();
        await User.updateOne({ _id: user._id }, { $set: { role: 'VENDOR' } });
        await Vendor.updateOne(
          { userId: user._id },
          {
            $set: {
              shopName: String(a?.shopName || '').trim(),
              representativeName: String(a?.representativeName || '').trim(),
              province: String(a?.province || '').trim(),
              phone: String(a?.phone || '').trim(),
              email,
              status: 'approved',
              approvedAt: now
            },
            $setOnInsert: { userId: user._id }
          },
          { upsert: true }
        );
        await PartnerApplication.updateOne({ _id: a._id }, { $set: { status: 'reviewed' } });
      }
    }
  }
  const q = isProd ? { status: 'approved' } : { status: { $in: ['approved', 'pending'] } };
  const rows = await Vendor.find(q)
    .sort({ approvedAt: -1, createdAt: -1 })
    .select('shopName address phone email logo coverImage locationLat locationLng createdAt bookingPreferences')
    .lean();

  const vendorIds = rows.map((v) => v?._id).filter(Boolean);
  const ratingAgg = vendorIds.length
    ? await VendorReview.aggregate([
        { $match: { vendorId: { $in: vendorIds } } },
        { $group: { _id: '$vendorId', avg: { $avg: '$rating' }, count: { $sum: 1 } } }
      ])
    : [];
  const ratingMap = new Map(
    (Array.isArray(ratingAgg) ? ratingAgg : []).map((x) => [
      String(x?._id || ''),
      {
        avg: Number.isFinite(Number(x?.avg)) ? Math.round(Number(x.avg) * 10) / 10 : 0,
        count: Number(x?.count) || 0
      }
    ])
  );

  const items = rows.map((v) => {
    const vLat = toNumOrNull(v?.locationLat);
    const vLng = toNumOrNull(v?.locationLng);
    const canDistance = hasUserPos && vLat !== null && vLng !== null;
    const distKm = canDistance ? haversineKm({ lat1: lat, lng1: lng, lat2: vLat, lng2: vLng }) : null;
    const ratingMeta = ratingMap.get(String(v?._id || '')) || { avg: 0, count: 0 };
    const rating = ratingMeta.avg;
    const acceptingBookings = v?.bookingPreferences?.acceptingBookings !== false;
    const tz = String(v?.bookingPreferences?.timezone || '').trim();
    const todayYmd = formatYmdInTz(new Date(), tz);
    const closedDate = String(v?.bookingPreferences?.closedDate || '').trim();
    const closedToday = Boolean(todayYmd && closedDate && closedDate === todayYmd);
    return {
      _id: v._id,
      shopName: v.shopName || '',
      address: v.address || '',
      phone: v.phone || '',
      email: v.email || '',
      logo: v.logo || '',
      coverImage: v.coverImage || '',
      distanceKm: distKm !== null ? Math.round(distKm * 10) / 10 : null,
      rating,
      reviewCount: ratingMeta.count,
      acceptingBookings,
      closedToday,
      availableTimeSlots: buildSlots()
    };
  });

  items.sort((a, b) => {
    const da = a.distanceKm;
    const db = b.distanceKm;
    if (da === null && db === null) return b.rating - a.rating;
    if (da === null) return 1;
    if (db === null) return -1;
    if (da !== db) return da - db;
    return b.rating - a.rating;
  });

  res.json({ items });
});

const getVendorPublic = asyncHandler(async (req, res) => {
  const id = String(req.params.id || '');
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_ID' });

  const [item, agg] = await Promise.all([
    Vendor.findById(id).lean(),
    VendorReview.aggregate([
      { $match: { vendorId: new mongoose.Types.ObjectId(id) } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }
    ])
  ]);
  if (!item) return res.status(404).json({ error: 'NOT_FOUND' });

  const avg = agg?.[0]?.avg;
  const count = Number(agg?.[0]?.count || 0);
  const rating = Number.isFinite(Number(avg)) ? Math.round(Number(avg) * 10) / 10 : 0;
  const tz = String(item?.bookingPreferences?.timezone || '').trim();
  const todayYmd = formatYmdInTz(new Date(), tz);
  const closedDate = String(item?.bookingPreferences?.closedDate || '').trim();
  const closedToday = Boolean(todayYmd && closedDate && closedDate === todayYmd);
  res.json({ item: { ...item, rating, reviewCount: count, closedToday } });
});

const listVendorPostsPublic = asyncHandler(async (req, res) => {
  const id = String(req.params.id || '');
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_ID' });

  const type = String(req.query?.type || '').trim().toLowerCase();
  const limitRaw = Number(req.query?.limit);
  const limit = Number.isFinite(limitRaw) ? Math.min(50, Math.max(1, Math.floor(limitRaw))) : 20;

  const q = { vendorId: new mongoose.Types.ObjectId(id) };
  if (type === 'post' || type === 'video') q.type = type;

  const rows = await ShopPost.find(q).sort({ createdAt: -1 }).limit(limit).lean();
  res.json({
    items: rows.map((p) => ({
      _id: p._id,
      type: p.type,
      title: p.title || '',
      content: p.content || '',
      mediaUrl: p.mediaUrl || '',
      thumbnailUrl: p.thumbnailUrl || '',
      createdAt: p.createdAt
    }))
  });
});

const submitPartnerApplication = asyncHandler(async (req, res) => {
  const shopName = String(req.body?.shopName || '').trim();
  const representativeName = String(req.body?.representativeName || '').trim();
  const province = String(req.body?.province || '').trim();
  const phone = String(req.body?.phone || '').trim();
  const email = normalizeEmail(req.body?.email);

  if (!shopName) return res.status(400).json({ error: 'MISSING_SHOP_NAME' });
  if (!representativeName) return res.status(400).json({ error: 'MISSING_REPRESENTATIVE_NAME' });
  if (!province) return res.status(400).json({ error: 'MISSING_PROVINCE' });
  if (!phone) return res.status(400).json({ error: 'MISSING_PHONE' });
  if (!email) return res.status(400).json({ error: 'MISSING_EMAIL' });

  if (!isValidEmail(email)) return res.status(400).json({ error: 'INVALID_EMAIL' });
  if (isInappropriateText(email)) return res.status(400).json({ error: 'EMAIL_INAPPROPRIATE' });
  if (isInappropriateText(shopName)) return res.status(400).json({ error: 'SHOP_NAME_INAPPROPRIATE' });
  if (isInappropriateText(phone)) return res.status(400).json({ error: 'PHONE_INAPPROPRIATE' });

  const checkedRep = validateHumanName(representativeName);
  if (!checkedRep.ok) return res.status(400).json({ error: checkedRep.error });
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return res.status(400).json({ error: 'INVALID_PHONE' });

  const item = await PartnerApplication.create({
    shopName,
    representativeName: checkedRep.value,
    province,
    phone: normalizedPhone,
    email
  });

  const adminEmails = parseAdminEmails();
  if (adminEmails.length) {
    const subject = 'eloride • Đăng ký xưởng đối tác (B2B)';
    const createdAt = item?.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString();
    const base = getRequestBaseUrl(req);
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const action = 'grant_vendor';
    const token = signAdminAction({ action, applicationId: item?._id, expiresAt });
    const approveUrl =
      base && token
        ? `${base}/api/vendors/apply/${encodeURIComponent(String(item?._id || ''))}/grant-vendor?expires=${encodeURIComponent(
            String(expiresAt)
          )}&token=${encodeURIComponent(token)}`
        : '';
    const text = [
      'Có đăng ký xưởng đối tác (B2B) mới:',
      '',
      `Shop: ${shopName}`,
      `Người đại diện: ${representativeName}`,
      `Tỉnh/Thành: ${province}`,
      `SĐT: ${phone}`,
      `Email: ${email}`,
      `Application ID: ${String(item?._id || '')}`,
      `Thời gian: ${createdAt}`,
      approveUrl ? `Duyệt (cấp quyền Vendor): ${approveUrl}` : ''
    ].join('\n');
    const html = `
      <div style="margin:0;padding:0;background:#0b1220;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial">
        <div style="padding:24px 16px">
          <div style="max-width:720px;margin:0 auto;background:#0f172a;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden">
            <div style="padding:18px 18px;border-bottom:1px solid rgba(255,255,255,0.08);background:linear-gradient(135deg,rgba(56,189,248,0.16),rgba(34,211,238,0.10))">
              <div style="font-size:12px;letter-spacing:0.16em;color:rgba(224,242,254,0.95);font-weight:700">ELORIDE</div>
              <div style="margin-top:8px;font-size:18px;color:#fff;font-weight:800">Đăng ký xưởng đối tác (B2B) mới</div>
            </div>
            <div style="padding:18px 18px;color:rgba(226,232,240,0.95);font-size:14px">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse">
                <tr><td style="padding:10px 0;color:rgba(148,163,184,0.9);width:140px">Shop</td><td style="padding:10px 0;color:#fff;font-weight:700">${escapeHtml(shopName)}</td></tr>
                <tr><td style="padding:10px 0;color:rgba(148,163,184,0.9)">Người đại diện</td><td style="padding:10px 0;color:#fff;font-weight:600">${escapeHtml(representativeName)}</td></tr>
                <tr><td style="padding:10px 0;color:rgba(148,163,184,0.9)">Tỉnh/Thành</td><td style="padding:10px 0;color:#fff;font-weight:600">${escapeHtml(province)}</td></tr>
                <tr><td style="padding:10px 0;color:rgba(148,163,184,0.9)">SĐT</td><td style="padding:10px 0;color:#fff;font-weight:600">${escapeHtml(phone)}</td></tr>
                <tr><td style="padding:10px 0;color:rgba(148,163,184,0.9)">Email</td><td style="padding:10px 0;color:#fff;font-weight:600">${escapeHtml(email)}</td></tr>
                <tr><td style="padding:10px 0;color:rgba(148,163,184,0.9)">Application ID</td><td style="padding:10px 0;color:rgba(226,232,240,0.95)">${String(
                  item?._id || ''
                )}</td></tr>
                <tr><td style="padding:10px 0;color:rgba(148,163,184,0.9)">Thời gian</td><td style="padding:10px 0;color:rgba(226,232,240,0.95)">${createdAt}</td></tr>
              </table>
              ${
                approveUrl
                  ? `<div style="margin-top:16px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.08)">
                      <a href="${approveUrl}" style="display:inline-block;text-decoration:none;background:linear-gradient(90deg,#38bdf8,#22d3ee);color:#02131a;font-weight:900;font-size:13px;padding:12px 14px;border-radius:12px">
                        Cấp quyền Vendor
                      </a>
                      <div style="margin-top:10px;color:rgba(148,163,184,0.9);font-size:12px">Bấm để duyệt nhanh và chuyển sang trang B2B.</div>
                    </div>`
                  : ''
              }
            </div>
          </div>
        </div>
      </div>
    `;
    try {
      await sendMail({ to: adminEmails.join(','), subject, text, html });
    } catch (err) {
      console.error('[partner-application] notify admin failed:', err?.message || err);
    }
  }

  res.status(201).json({ item });
});

const grantVendorFromApplication = asyncHandler(async (req, res) => {
  const id = String(req.params?.id || '').trim();
  const expiresAt = Number(req.query?.expires);
  const token = String(req.query?.token || '').trim();
  const ok = mongoose.isValidObjectId(id) && verifyAdminAction({ action: 'grant_vendor', applicationId: id, expiresAt, token });
  if (!ok) return res.status(403).send('FORBIDDEN');

  const application = await PartnerApplication.findById(id).lean();
  if (!application) return res.status(404).send('NOT_FOUND');

  const email = String(application?.email || '').trim().toLowerCase();
  const shopName = String(application?.shopName || '').trim();
  const representativeName = String(application?.representativeName || '').trim();
  const province = String(application?.province || '').trim();
  const phone = String(application?.phone || '').trim();

  const user = email ? await User.findOne({ email }).lean() : null;
  if (!user) {
    await PartnerApplication.updateOne({ _id: id }, { $set: { status: 'reviewed' } });
    const url = `${getFrontendUrl()}/partner-application`;
    return res
      .status(200)
      .send(`Tài khoản với email "${email}" chưa tồn tại. Yêu cầu: user đăng ký tài khoản bằng email này trước. ${url}`);
  }

  await User.updateOne({ _id: user._id }, { $set: { role: 'VENDOR' } });
  const now = new Date();
  await Vendor.updateOne(
    { userId: user._id },
    {
      $set: { shopName, representativeName, province, phone, email, status: 'approved', approvedAt: now },
      $setOnInsert: { userId: user._id }
    },
    { upsert: true }
  );
  await PartnerApplication.updateOne({ _id: id }, { $set: { status: 'reviewed' } });

  try {
    if (email) {
      await sendMail({
        to: email,
        subject: 'eloride • Đã duyệt xưởng đối tác',
        text: `Shop của bạn đã được cấp quyền Vendor. Vui lòng đăng nhập để vào trang B2B: ${getFrontendUrl()}/dashboard`,
        html: `<div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial">
          <h2 style="margin:0 0 8px">Shop đã được duyệt</h2>
          <div style="color:#334155">Bạn đã được cấp quyền Vendor. Đăng nhập để vào trang B2B.</div>
          <div style="margin-top:14px">
            <a href="${getFrontendUrl()}/dashboard" style="display:inline-block;text-decoration:none;background:#0ea5e9;color:#001018;font-weight:900;font-size:13px;padding:10px 12px;border-radius:10px">Mở trang B2B</a>
          </div>
        </div>`
      });
    }
  } catch {}

  return res.redirect(`${getFrontendUrl()}/dashboard`);
});

module.exports = { getVendorPublic, listPartneredVendors, submitPartnerApplication, grantVendorFromApplication, listVendorPostsPublic };
