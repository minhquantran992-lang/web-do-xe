const mongoose = require('mongoose');
const Vendor = require('../models/Vendor');
const User = require('../models/User');
const Booking = require('../models/Booking');
const VendorReview = require('../models/VendorReview');
const ShopPost = require('../models/ShopPost');
const VendorBlock = require('../models/VendorBlock');
const { asyncHandler } = require('../middleware/asyncHandler');
const { sendMail } = require('../services/mailer');
const { logSecurityEvent } = require('../security/securityLog');

const parseAdminEmails = () => {
  const raw = String(process.env.ADMIN_EMAILS || '').trim().toLowerCase();
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
};

const normalizeWebsite = (raw) => {
  const v = String(raw || '').trim();
  if (!v) return '';
  const input = v.includes('://') ? v : `https://${v}`;
  try {
    const u = new URL(input);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    if (!u.hostname) return '';
    return u.toString();
  } catch {
    return '';
  }
};

const normalizeLatLng = ({ lat, lng }) => {
  const latNum = lat === '' || lat == null ? null : Number(lat);
  const lngNum = lng === '' || lng == null ? null : Number(lng);
  const hasAny = latNum != null || lngNum != null;
  if (!hasAny) return { locationLat: null, locationLng: null };
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return null;
  if (latNum < -90 || latNum > 90) return null;
  if (lngNum < -180 || lngNum > 180) return null;
  return { locationLat: latNum, locationLng: lngNum };
};

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

const hasExplicitVietnameseProfanity = (value) => {
  const raw = String(value || '');
  if (!raw) return false;
  const padded = ` ${raw} `;
  if (/(^|[^\p{L}])chó([^\p{L}]|$)/iu.test(padded)) return true;
  return false;
};

const isInappropriateText = (value) => {
  if (hasExplicitVietnameseProfanity(value)) return true;
  const s = normalizeForBlockedText(value);
  if (!s) return false;
  const compact = s.replace(/\s+/g, '');
  const profanity = [
    /\b(fuck|shit|bitch|cunt|motherfucker)\b/i,
    /\b(dcm|dm)\b/i,
    /\b(vcl|clm|vl)\b/i,
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

const normalizeForNameHeuristics = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[\s\-_.]+/g, ' ')
    .replace(/[^\p{L}\s]/gu, '')
    .trim();

const isNonsenseName = (value) => {
  const s = normalizeForNameHeuristics(value);
  if (!s) return false;
  const compact = s.replace(/\s+/g, '');
  const letters = compact.replace(/[^a-z]/g, '');
  if (!letters) return false;

  if (/^(test|testing|asdf|qwerty|zxcv|admin|user|unknown|null|none)$/i.test(letters)) return true;
  if (/(qwerty|asdfgh|zxcvbn)/i.test(letters)) return true;
  if (/([a-z])\1{3,}/i.test(letters)) return true;
  if (letters.length >= 6 && !/[aeiouy]/i.test(letters)) return true;
  if (letters.length >= 10) {
    const vowelCount = (letters.match(/[aeiouy]/gi) || []).length;
    if (vowelCount / letters.length < 0.2) return true;
    const unique = new Set(letters.split('')).size;
    if (unique / letters.length < 0.25) return true;
  }
  const parts = s.split(' ').filter(Boolean);
  if (parts.length >= 2) {
    const uniqParts = new Set(parts).size;
    if (uniqParts === 1 && parts[0].length >= 2) return true;
  }
  return false;
};

const validateHumanName = (value) => {
  const raw = String(value || '').trim().replace(/\s+/g, ' ');
  if (!raw) return { ok: false, error: 'INVALID_REPRESENTATIVE_NAME' };
  if (raw.length < 2 || raw.length > 80) return { ok: false, error: 'INVALID_REPRESENTATIVE_NAME' };
  if (!/^[\p{L}][\p{L}\s.'-]*$/u.test(raw)) return { ok: false, error: 'INVALID_REPRESENTATIVE_NAME' };
  if (!/[\p{L}]/u.test(raw)) return { ok: false, error: 'INVALID_REPRESENTATIVE_NAME' };
  if (isInappropriateText(raw) || isNonsenseName(raw)) return { ok: false, error: 'REPRESENTATIVE_NAME_INAPPROPRIATE' };
  return { ok: true, value: raw };
};

const getMyShop = asyncHandler(async (req, res) => {
  const userId = String(req.user?.id || '');
  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });
  const item = await Vendor.findOne({ userId }).lean();
  res.json({ item: item || null });
});

const parseBool = (v) => {
  if (typeof v === 'boolean') return v;
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return null;
  if (s === 'true' || s === '1' || s === 'yes' || s === 'on') return true;
  if (s === 'false' || s === '0' || s === 'no' || s === 'off') return false;
  return null;
};

const parseTimeToMin = (v) => {
  const s = String(v || '').trim();
  if (!s) return null;
  const m = /^(\d{2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23) return null;
  if (mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
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

const normalizeClosedDate = (raw) => {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  return s;
};

const toIntOrNull = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.floor(n);
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

const getTodayRangeInTz = (tz) => {
  const zone = String(tz || '').trim() || String(process.env.TIMEZONE || '').trim() || 'Asia/Ho_Chi_Minh';
  const now = new Date();
  const ymd = formatYmdInTz(now, zone);
  const mm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!mm) return null;
  const y = Number(mm[1]);
  const m = Number(mm[2]);
  const d = Number(mm[3]);
  if (!y || !m || !d) return null;
  const approxUtc = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  const offsetMin = getTzOffsetMinutes(approxUtc, zone);
  const start = new Date(approxUtc.getTime() - offsetMin * 60 * 1000);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
};

const upsertMyShop = asyncHandler(async (req, res) => {
  const userId = String(req.user?.id || '');
  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });

  const shopName = String(req.body?.shopName || '').trim();
  if (!shopName) return res.status(400).json({ error: 'MISSING_SHOP_NAME' });
  if (isInappropriateText(shopName)) return res.status(400).json({ error: 'SHOP_NAME_INAPPROPRIATE' });

  const representativeNameRaw = String(req.body?.representativeName || '').trim();
  const checkedRep = representativeNameRaw ? validateHumanName(representativeNameRaw) : { ok: true, value: '' };
  if (!checkedRep.ok) return res.status(400).json({ error: checkedRep.error });

  const phoneRaw = String(req.body?.phone || '').trim();
  if (phoneRaw && isInappropriateText(phoneRaw)) return res.status(400).json({ error: 'PHONE_INAPPROPRIATE' });
  const normalizedPhone = phoneRaw ? normalizePhone(phoneRaw) : '';
  if (phoneRaw && !normalizedPhone) return res.status(400).json({ error: 'INVALID_PHONE' });

  const emailRaw = String(req.body?.email || '').trim();
  const normalizedEmail = emailRaw ? normalizeEmail(emailRaw) : '';
  if (normalizedEmail && !isValidEmail(normalizedEmail)) return res.status(400).json({ error: 'INVALID_EMAIL' });
  if (normalizedEmail && isInappropriateText(normalizedEmail)) return res.status(400).json({ error: 'EMAIL_INAPPROPRIATE' });

  const existing = await Vendor.findOne({ userId }).lean();

  const pref = req.body?.bookingPreferences || null;
  let bookingPreferences;
  if (pref) {
    const explicitAccepting = parseBool(pref?.acceptingBookings ?? pref?.accepting ?? pref?.acceptingCustomers);
    const acceptingBookings = explicitAccepting !== null ? explicitAccepting : existing?.bookingPreferences?.acceptingBookings !== false;
    const locationText = String(pref?.locationText || '').trim();
    const scheduleTypeRaw = String(pref?.scheduleType || '').trim().toLowerCase();
    const scheduleType = scheduleTypeRaw === 'schedule' ? 'schedule' : 'asap';
    const note = String(pref?.note || '').trim();
    const timezone = String(pref?.timezone || '').trim();
    const rawClosedDate = normalizeClosedDate(pref?.closedDate);
    const closedToday = parseBool(pref?.closedToday ?? pref?.closedForToday ?? pref?.closed);
    const todayYmd = formatYmdInTz(new Date(), timezone || existing?.bookingPreferences?.timezone);
    const closedDate =
      closedToday === true
        ? todayYmd
        : closedToday === false
          ? ''
          : rawClosedDate || normalizeClosedDate(existing?.bookingPreferences?.closedDate);
    const capRaw = pref?.capacity || null;
    const maxSlotsRaw = toIntOrNull(capRaw?.maxSlots ?? pref?.maxSlots ?? pref?.slots ?? pref?.max_slots);
    const mechRaw = toIntOrNull(capRaw?.mechanicCount ?? pref?.mechanicCount ?? pref?.mechanics ?? pref?.mechanic_count);
    const prevCap = existing?.bookingPreferences?.capacity || {};
    const maxSlots = maxSlotsRaw !== null ? maxSlotsRaw : toIntOrNull(prevCap?.maxSlots) ?? 3;
    const mechanicCount = mechRaw !== null ? mechRaw : toIntOrNull(prevCap?.mechanicCount) ?? 1;
    if (!Number.isFinite(maxSlots) || maxSlots < 1) return res.status(400).json({ error: 'INVALID_MAX_SLOTS' });
    if (!Number.isFinite(mechanicCount) || mechanicCount < 1) return res.status(400).json({ error: 'INVALID_MECHANIC_COUNT' });
    const workingDays = Array.isArray(pref?.workingDays)
      ? pref.workingDays
          .map((d) => Number(d))
          .filter((d) => Number.isFinite(d) && d >= 0 && d <= 6)
      : [];
    const workingHoursRaw = pref?.workingHours || null;
    const workingHours = workingHoursRaw
      ? { start: String(workingHoursRaw?.start || '').trim(), end: String(workingHoursRaw?.end || '').trim() }
      : { start: '', end: '' };
    const breakHoursRaw = pref?.breakHours || null;
    const breakHours = breakHoursRaw
      ? { start: String(breakHoursRaw?.start || '').trim(), end: String(breakHoursRaw?.end || '').trim() }
      : { start: '', end: '' };
    if ((workingHours.start && !workingHours.end) || (!workingHours.start && workingHours.end)) {
      return res.status(400).json({ error: 'INVALID_WORKING_HOURS' });
    }
    if ((breakHours.start && !breakHours.end) || (!breakHours.start && breakHours.end)) {
      return res.status(400).json({ error: 'INVALID_BREAK_HOURS' });
    }
    if (workingHours.start && workingHours.end) {
      const ws = parseTimeToMin(workingHours.start);
      const we = parseTimeToMin(workingHours.end);
      if (ws == null || we == null || ws >= we) return res.status(400).json({ error: 'INVALID_WORKING_HOURS' });
      if (breakHours.start && breakHours.end) {
        const bs = parseTimeToMin(breakHours.start);
        const be = parseTimeToMin(breakHours.end);
        if (bs == null || be == null || bs >= be) return res.status(400).json({ error: 'INVALID_BREAK_HOURS' });
        if (bs < ws || be > we) return res.status(400).json({ error: 'BREAK_OUTSIDE_WORKING_HOURS' });
      }
    } else if (breakHours.start && breakHours.end) {
      const bs = parseTimeToMin(breakHours.start);
      const be = parseTimeToMin(breakHours.end);
      if (bs == null || be == null || bs >= be) return res.status(400).json({ error: 'INVALID_BREAK_HOURS' });
    }
    const latNum = Number(pref?.locationLat);
    const lngNum = Number(pref?.locationLng);
    const locationLat = Number.isFinite(latNum) ? latNum : null;
    const locationLng = Number.isFinite(lngNum) ? lngNum : null;
    const scheduleAtRaw = pref?.scheduleAt;
    const scheduleAtDate = scheduleType === 'schedule' && scheduleAtRaw ? new Date(scheduleAtRaw) : null;
    const scheduleAt = scheduleAtDate && !Number.isNaN(scheduleAtDate.getTime()) ? scheduleAtDate : null;
    bookingPreferences = {
      acceptingBookings,
      locationText,
      locationLat,
      locationLng,
      scheduleType,
      scheduleAt,
      note,
      timezone,
      workingDays,
      closedDate,
      capacity: { maxSlots, mechanicCount },
      workingHours,
      breakHours
    };
  }

  const website = normalizeWebsite(req.body?.website);
  if (String(req.body?.website || '').trim() && !website) return res.status(400).json({ error: 'INVALID_WEBSITE' });

  const loc = normalizeLatLng({ lat: req.body?.locationLat, lng: req.body?.locationLng });
  if (loc === null) return res.status(400).json({ error: 'INVALID_LOCATION' });

  const patch = {
    shopName,
    representativeName: checkedRep.value,
    province: String(req.body?.province || '').trim(),
    description: String(req.body?.description || '').trim(),
    phone: normalizedPhone,
    email: normalizedEmail,
    address: String(req.body?.address || '').trim(),
    website,
    facebook: String(req.body?.facebook || '').trim(),
    logo: String(req.body?.logo || '').trim(),
    coverImage: String(req.body?.coverImage || '').trim(),
    ...loc,
    ...(bookingPreferences ? { bookingPreferences } : {})
  };

  await Vendor.updateOne({ userId }, { $set: patch, $setOnInsert: { userId } }, { upsert: true });

  const item = await Vendor.findOne({ userId }).lean();
  if (!existing) {
    const adminEmails = parseAdminEmails();
    if (adminEmails.length) {
      const subject = 'eloride • Đăng ký xưởng đối tác (B2B)';
      const createdAt = item?.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString();
      const text = [
        'Có đăng ký xưởng đối tác (B2B) mới:',
        '',
        `Shop: ${String(item?.shopName || '').trim()}`,
        `Người đại diện: ${String(item?.representativeName || '').trim()}`,
        `Tỉnh/Thành: ${String(item?.province || '').trim()}`,
        `SĐT: ${String(item?.phone || '').trim()}`,
        `Email: ${String(item?.email || '').trim()}`,
        `User ID: ${String(item?.userId || '')}`,
        `Vendor ID: ${String(item?._id || '')}`,
        `Thời gian: ${createdAt}`
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
                  <tr><td style="padding:10px 0;color:rgba(148,163,184,0.9);width:140px">Shop</td><td style="padding:10px 0;color:#fff;font-weight:700">${String(
                    item?.shopName || ''
                  )}</td></tr>
                  <tr><td style="padding:10px 0;color:rgba(148,163,184,0.9)">Người đại diện</td><td style="padding:10px 0;color:#fff;font-weight:600">${String(
                    item?.representativeName || ''
                  )}</td></tr>
                  <tr><td style="padding:10px 0;color:rgba(148,163,184,0.9)">Tỉnh/Thành</td><td style="padding:10px 0;color:#fff;font-weight:600">${String(
                    item?.province || ''
                  )}</td></tr>
                  <tr><td style="padding:10px 0;color:rgba(148,163,184,0.9)">SĐT</td><td style="padding:10px 0;color:#fff;font-weight:600">${String(
                    item?.phone || ''
                  )}</td></tr>
                  <tr><td style="padding:10px 0;color:rgba(148,163,184,0.9)">Email</td><td style="padding:10px 0;color:#fff;font-weight:600">${String(
                    item?.email || ''
                  )}</td></tr>
                  <tr><td style="padding:10px 0;color:rgba(148,163,184,0.9)">User ID</td><td style="padding:10px 0;color:rgba(226,232,240,0.95)">${String(
                    item?.userId || ''
                  )}</td></tr>
                  <tr><td style="padding:10px 0;color:rgba(148,163,184,0.9)">Vendor ID</td><td style="padding:10px 0;color:rgba(226,232,240,0.95)">${String(
                    item?._id || ''
                  )}</td></tr>
                  <tr><td style="padding:10px 0;color:rgba(148,163,184,0.9)">Thời gian</td><td style="padding:10px 0;color:rgba(226,232,240,0.95)">${createdAt}</td></tr>
                </table>
              </div>
            </div>
          </div>
        </div>
      `;
      try {
        await sendMail({ to: adminEmails.join(','), subject, text, html });
      } catch (err) {
        console.error('[vendor] notify admin failed:', err?.message || err);
      }
    }
  }
  res.status(existing ? 200 : 201).json({ item });
});

const setMyAcceptingBookings = asyncHandler(async (req, res) => {
  const vendorId = String(req.vendor?._id || '');
  if (!vendorId) return res.status(403).json({ error: 'FORBIDDEN' });

  const next = parseBool(req.body?.acceptingBookings ?? req.body?.accepting ?? req.body?.enabled);
  if (next === null) return res.status(400).json({ error: 'INVALID_ACCEPTING' });

  await Vendor.updateOne({ _id: vendorId }, { $set: { 'bookingPreferences.acceptingBookings': next } });
  const item = await Vendor.findById(vendorId).lean();
  res.json({ item: item || null });
});

const setMyClosedToday = asyncHandler(async (req, res) => {
  const vendorId = String(req.vendor?._id || '');
  if (!vendorId) return res.status(403).json({ error: 'FORBIDDEN' });

  const enabled = parseBool(req.body?.closedToday ?? req.body?.enabled ?? req.body?.closed);
  if (enabled === null) return res.status(400).json({ error: 'INVALID_CLOSED_TODAY' });

  const vendor = await Vendor.findById(vendorId).select('bookingPreferences.timezone').lean();
  const tz = String(vendor?.bookingPreferences?.timezone || '').trim() || String(process.env.TIMEZONE || '').trim() || 'Asia/Ho_Chi_Minh';
  const closedDate = enabled ? formatYmdInTz(new Date(), tz) : '';

  await Vendor.updateOne({ _id: vendorId }, { $set: { 'bookingPreferences.closedDate': closedDate } });
  const item = await Vendor.findById(vendorId).lean();
  res.json({ item: item || null });
});

const setMyCapacity = asyncHandler(async (req, res) => {
  const vendorId = String(req.vendor?._id || '');
  if (!vendorId) return res.status(403).json({ error: 'FORBIDDEN' });

  const patch = {};
  if (req.body?.maxSlots !== undefined) {
    const n = Math.floor(Number(req.body.maxSlots));
    if (!Number.isFinite(n) || n < 1) return res.status(400).json({ error: 'INVALID_MAX_SLOTS' });
    patch['bookingPreferences.capacity.maxSlots'] = n;
  }
  if (req.body?.mechanicCount !== undefined) {
    const n = Math.floor(Number(req.body.mechanicCount));
    if (!Number.isFinite(n) || n < 1) return res.status(400).json({ error: 'INVALID_MECHANIC_COUNT' });
    patch['bookingPreferences.capacity.mechanicCount'] = n;
  }
  if (!Object.keys(patch).length) return res.status(400).json({ error: 'EMPTY_PATCH' });

  await Vendor.updateOne({ _id: vendorId }, { $set: patch });
  const item = await Vendor.findById(vendorId).lean();
  res.json({ item: item || null });
});

const getMyStats = asyncHandler(async (req, res) => {
  const vendorId = String(req.vendor?._id || '');
  if (!vendorId) return res.status(403).json({ error: 'FORBIDDEN' });

  const now = new Date();
  const tz = String(req.vendor?.bookingPreferences?.timezone || '').trim() || String(process.env.TIMEZONE || '').trim() || 'Asia/Ho_Chi_Minh';
  const range = getTodayRangeInTz(tz);
  const start = range?.start || new Date(new Date(now).setHours(0, 0, 0, 0));
  const end = range?.end || new Date(new Date(start).setDate(start.getDate() + 1));

  const shopObjectId = new mongoose.Types.ObjectId(vendorId);
  const [newRequestsCount, todaysAppointments, totalCompletedJobs, ratingAgg, activeBookingsToday] = await Promise.all([
    Booking.countDocuments({ shopId: shopObjectId, status: 'pending', expiresAt: { $gt: now } }),
    Booking.countDocuments({
      shopId: shopObjectId,
      status: { $in: ['accepted', 'in_progress'] },
      timeSlot: { $gte: start, $lt: end }
    }),
    Booking.countDocuments({ shopId: shopObjectId, status: 'completed' }),
    VendorReview.aggregate([
      { $match: { vendorId: shopObjectId } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]),
    Booking.countDocuments({
      shopId: shopObjectId,
      timeSlot: { $gte: start, $lt: end },
      $or: [
        { status: { $in: ['accepted', 'in_progress'] } },
        { status: 'pending', expiresAt: { $gt: now } }
      ]
    })
  ]);

  const avg = ratingAgg?.[0]?.avg;
  const reviewCount = Number(ratingAgg?.[0]?.count || 0);
  const averageRating = Number.isFinite(Number(avg)) ? Math.round(Number(avg) * 10) / 10 : 0;

  const cap = req.vendor?.bookingPreferences?.capacity || {};
  const maxSlots = Math.max(1, Math.floor(Number(cap?.maxSlots) || 0)) || 1;
  const mechanicCount = Math.max(1, Math.floor(Number(cap?.mechanicCount) || 0)) || 1;
  const active = Number(activeBookingsToday) || 0;
  const availableSlots = Math.max(0, maxSlots - active);

  res.json({
    item: {
      newRequestsCount: Number(newRequestsCount) || 0,
      todaysAppointments: Number(todaysAppointments) || 0,
      totalCompletedJobs: Number(totalCompletedJobs) || 0,
      averageRating,
      reviewCount,
      capacity: {
        maxSlots,
        mechanicCount,
        activeBookingsToday: active,
        availableSlotsToday: availableSlots
      }
    }
  });
});

const listMyReviews = asyncHandler(async (req, res) => {
  const vendorId = String(req.vendor?._id || '');
  if (!vendorId) return res.status(403).json({ error: 'FORBIDDEN' });
  const limitRaw = Number(req.query?.limit);
  const limit = Number.isFinite(limitRaw) ? Math.min(50, Math.max(1, Math.floor(limitRaw))) : 20;

  const shopObjectId = new mongoose.Types.ObjectId(vendorId);
  const [rows, agg] = await Promise.all([
    VendorReview.find({ vendorId: shopObjectId }).sort({ createdAt: -1 }).limit(limit).populate('userId', 'name email').lean(),
    VendorReview.aggregate([
      { $match: { vendorId: shopObjectId } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }
    ])
  ]);

  const avg = agg?.[0]?.avg;
  const count = Number(agg?.[0]?.count || 0);
  const averageRating = Number.isFinite(Number(avg)) ? Math.round(Number(avg) * 10) / 10 : 0;

  res.json({
    meta: { averageRating, reviewCount: count },
    items: rows.map((r) => ({
      _id: r._id,
      rating: Number(r.rating) || 0,
      comment: r.comment || '',
      createdAt: r.createdAt,
      user: r.userId ? { _id: r.userId._id, name: r.userId.name || '', email: r.userId.email || '' } : null
    }))
  });
});

const listMyShopPosts = asyncHandler(async (req, res) => {
  const vendorId = String(req.vendor?._id || '');
  if (!vendorId) return res.status(403).json({ error: 'FORBIDDEN' });

  const type = String(req.query?.type || '').trim().toLowerCase();
  const limitRaw = Number(req.query?.limit);
  const limit = Number.isFinite(limitRaw) ? Math.min(50, Math.max(1, Math.floor(limitRaw))) : 30;

  const q = { vendorId: new mongoose.Types.ObjectId(vendorId) };
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

const createMyShopPost = asyncHandler(async (req, res) => {
  const vendorId = String(req.vendor?._id || '');
  if (!vendorId) return res.status(403).json({ error: 'FORBIDDEN' });

  const type = String(req.body?.type || '').trim().toLowerCase();
  if (type !== 'post' && type !== 'video') return res.status(400).json({ error: 'INVALID_TYPE' });

  const title = String(req.body?.title || '').trim();
  if (!title) return res.status(400).json({ error: 'MISSING_TITLE' });

  const content = String(req.body?.content || '').trim();
  const mediaUrl = String(req.body?.mediaUrl || '').trim();
  const thumbnailUrl = String(req.body?.thumbnailUrl || '').trim();

  if (type === 'video' && !mediaUrl) return res.status(400).json({ error: 'MISSING_MEDIA_URL' });

  const item = await ShopPost.create({
    vendorId: new mongoose.Types.ObjectId(vendorId),
    type,
    title,
    content,
    mediaUrl,
    thumbnailUrl
  });

  res.status(201).json({
    item: {
      _id: item._id,
      type: item.type,
      title: item.title || '',
      content: item.content || '',
      mediaUrl: item.mediaUrl || '',
      thumbnailUrl: item.thumbnailUrl || '',
      createdAt: item.createdAt
    }
  });
});

const updateMyShopPost = asyncHandler(async (req, res) => {
  const vendorId = String(req.vendor?._id || '');
  if (!vendorId) return res.status(403).json({ error: 'FORBIDDEN' });

  const id = String(req.params?.id || '').trim();
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_ID' });

  const existing = await ShopPost.findOne({ _id: id, vendorId: new mongoose.Types.ObjectId(vendorId) }).lean();
  if (!existing) return res.status(404).json({ error: 'NOT_FOUND' });

  const title = req.body?.title != null ? String(req.body?.title || '').trim() : null;
  const content = req.body?.content != null ? String(req.body?.content || '').trim() : null;
  const mediaUrl = req.body?.mediaUrl != null ? String(req.body?.mediaUrl || '').trim() : null;
  const thumbnailUrl = req.body?.thumbnailUrl != null ? String(req.body?.thumbnailUrl || '').trim() : null;

  const patch = {};
  if (title !== null) {
    if (!title) return res.status(400).json({ error: 'MISSING_TITLE' });
    patch.title = title;
  }
  if (content !== null) patch.content = content;
  if (mediaUrl !== null) patch.mediaUrl = mediaUrl;
  if (thumbnailUrl !== null) patch.thumbnailUrl = thumbnailUrl;

  if (existing.type === 'video' && patch.mediaUrl != null && !patch.mediaUrl) return res.status(400).json({ error: 'MISSING_MEDIA_URL' });

  await ShopPost.updateOne({ _id: id }, { $set: patch });
  const item = await ShopPost.findById(id).lean();
  res.json({
    item: item
      ? {
          _id: item._id,
          type: item.type,
          title: item.title || '',
          content: item.content || '',
          mediaUrl: item.mediaUrl || '',
          thumbnailUrl: item.thumbnailUrl || '',
          createdAt: item.createdAt
        }
      : null
  });
});

const deleteMyShopPost = asyncHandler(async (req, res) => {
  const vendorId = String(req.vendor?._id || '');
  if (!vendorId) return res.status(403).json({ error: 'FORBIDDEN' });

  const id = String(req.params?.id || '').trim();
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_ID' });

  const del = await ShopPost.deleteOne({ _id: id, vendorId: new mongoose.Types.ObjectId(vendorId) });
  if (!del?.deletedCount) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json({ ok: true });
});

const parseDurationHours = (value) => {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const hours = Math.floor(n);
  if (hours <= 0) return null;
  return Math.min(24 * 365, hours);
};

const listMyBlockedUsers = asyncHandler(async (req, res) => {
  const vendorId = String(req.vendor?._id || '').trim();
  if (!vendorId) return res.status(403).json({ error: 'FORBIDDEN' });

  const limitRaw = Number(req.query?.limit || 50);
  const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, Math.floor(limitRaw))) : 50;
  const now = new Date();

  const blocks = await VendorBlock.find({
    shopId: new mongoose.Types.ObjectId(vendorId),
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }]
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const userIds = Array.isArray(blocks) ? blocks.map((b) => String(b?.userId || '')).filter(Boolean) : [];
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } }).select('name email avatar').lean()
    : [];
  const byId = new Map((Array.isArray(users) ? users : []).map((u) => [String(u?._id || ''), u]));

  res.json({
    items: (Array.isArray(blocks) ? blocks : []).map((b) => {
      const uid = String(b?.userId || '');
      const u = byId.get(uid);
      return {
        userId: uid,
        user: u ? { id: String(u._id), name: u.name || '', email: u.email || '', avatar: u.avatar || '' } : null,
        reason: String(b?.reason || ''),
        expiresAt: b?.expiresAt || null,
        createdAt: b?.createdAt || null
      };
    })
  });
});

const blockUser = asyncHandler(async (req, res) => {
  const vendorId = String(req.vendor?._id || '').trim();
  if (!vendorId) return res.status(403).json({ error: 'FORBIDDEN' });

  const userId = String(req.body?.userId || '').trim();
  if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ error: 'INVALID_USER_ID' });

  const reason = String(req.body?.reason || '').trim().slice(0, 200);
  const hours = parseDurationHours(req.body?.durationHours ?? req.body?.hours);
  const expiresAt = hours ? new Date(Date.now() + hours * 60 * 60 * 1000) : null;

  await VendorBlock.updateOne(
    { shopId: new mongoose.Types.ObjectId(vendorId), userId: new mongoose.Types.ObjectId(userId) },
    { $set: { reason, expiresAt, createdAt: new Date() }, $setOnInsert: { shopId: vendorId, userId } },
    { upsert: true }
  );

  await logSecurityEvent({
    req,
    kind: 'VENDOR_BLOCK_USER',
    outcome: 'blocked',
    meta: { shopId: vendorId, userId, reason, expiresAt: expiresAt || null }
  });

  res.status(201).json({ ok: true, userId, expiresAt });
});

const unblockUser = asyncHandler(async (req, res) => {
  const vendorId = String(req.vendor?._id || '').trim();
  if (!vendorId) return res.status(403).json({ error: 'FORBIDDEN' });

  const userId = String(req.params?.userId || req.body?.userId || '').trim();
  if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ error: 'INVALID_USER_ID' });

  const del = await VendorBlock.deleteOne({
    shopId: new mongoose.Types.ObjectId(vendorId),
    userId: new mongoose.Types.ObjectId(userId)
  });

  await logSecurityEvent({
    req,
    kind: 'VENDOR_UNBLOCK_USER',
    outcome: del?.deletedCount ? 'unblocked' : 'noop',
    meta: { shopId: vendorId, userId }
  });

  res.json({ ok: true });
});

const reportSpamUser = asyncHandler(async (req, res) => {
  const vendorId = String(req.vendor?._id || '').trim();
  if (!vendorId) return res.status(403).json({ error: 'FORBIDDEN' });

  const userId = String(req.body?.userId || '').trim();
  if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ error: 'INVALID_USER_ID' });

  const reason = String(req.body?.reason || req.body?.message || '').trim().slice(0, 500);
  const action = String(req.body?.action || '').trim().toLowerCase();
  const shouldBlock = action === 'block' || action === 'ban';

  await logSecurityEvent({
    req,
    kind: 'VENDOR_SPAM_REPORT',
    outcome: shouldBlock ? 'reported_and_blocked' : 'reported',
    meta: { shopId: vendorId, userId, reason }
  });

  if (shouldBlock) {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await VendorBlock.updateOne(
      { shopId: new mongoose.Types.ObjectId(vendorId), userId: new mongoose.Types.ObjectId(userId) },
      { $set: { reason: reason.slice(0, 200), expiresAt, createdAt: new Date() }, $setOnInsert: { shopId: vendorId, userId } },
      { upsert: true }
    );
  }

  res.status(201).json({ ok: true });
});

const uploadMyShopImage = asyncHandler(async (req, res) => {
  const vendorId = String(req.vendor?._id || '').trim();
  if (!vendorId) return res.status(403).json({ error: 'FORBIDDEN' });

  const file = req.file;
  if (!file) return res.status(400).json({ error: 'MISSING_FILE' });

  res.status(201).json({ ok: true, url: `/uploads/vendor-shop/${file.filename}` });
});

const uploadMyShopPostMedia = asyncHandler(async (req, res) => {
  const vendorId = String(req.vendor?._id || '').trim();
  if (!vendorId) return res.status(403).json({ error: 'FORBIDDEN' });

  const file = req.file;
  if (!file) return res.status(400).json({ error: 'MISSING_FILE' });

  res.status(201).json({ ok: true, url: `/uploads/vendor-posts/${file.filename}` });
});

module.exports = {
  getMyShop,
  upsertMyShop,
  setMyAcceptingBookings,
  setMyClosedToday,
  setMyCapacity,
  getMyStats,
  listMyReviews,
  listMyShopPosts,
  createMyShopPost,
  updateMyShopPost,
  deleteMyShopPost,
  listMyBlockedUsers,
  blockUser,
  unblockUser,
  reportSpamUser,
  uploadMyShopImage,
  uploadMyShopPostMedia
};
