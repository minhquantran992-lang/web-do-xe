export const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

export const isValidEmail = (value) => {
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

export const normalizePhone = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const cleaned = raw.replace(/[^\d+]/g, '');
  const digits = cleaned.replace(/[^\d]/g, '');
  if (digits.length < 8 || digits.length > 15) return '';
  if (cleaned.startsWith('+')) return `+${digits}`;
  return digits;
};

export const normalizeForBlockedText = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[\s\-_.]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim();

export const isInappropriateText = (value) => {
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

export const validateHumanName = (value) => {
  const raw = String(value || '').trim().replace(/\s+/g, ' ');
  if (!raw) return { ok: false, error: 'Vui lòng nhập họ và tên.' };
  if (raw.length < 2 || raw.length > 80) return { ok: false, error: 'Tên không hợp lệ.' };
  if (!/^[\p{L}][\p{L}\s.'-]*$/u.test(raw)) return { ok: false, error: 'Tên không hợp lệ.' };
  if (!/[\p{L}]/u.test(raw)) return { ok: false, error: 'Tên không hợp lệ.' };
  if (isInappropriateText(raw)) return { ok: false, error: 'Tên không phù hợp. Vui lòng nhập tên lịch sự.' };
  return { ok: true, value: raw };
};

export const validateEmail = (value) => {
  const raw = String(value || '').trim();
  const email = normalizeEmail(raw);
  if (!email) return { ok: false, error: 'Vui lòng nhập email.' };
  if (!isValidEmail(email)) return { ok: false, error: 'Email không hợp lệ.' };
  if (isInappropriateText(email)) return { ok: false, error: 'Email không phù hợp. Vui lòng nhập email lịch sự.' };
  return { ok: true, value: email };
};

export const validatePhone = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return { ok: false, error: 'Vui lòng nhập số điện thoại.' };
  if (isInappropriateText(raw)) return { ok: false, error: 'Số điện thoại không phù hợp.' };
  const phone = normalizePhone(raw);
  if (!phone) return { ok: false, error: 'Số điện thoại không hợp lệ.' };
  return { ok: true, value: phone };
};

