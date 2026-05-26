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

const hasExplicitVietnameseProfanity = (value) => {
  const raw = String(value || '');
  if (!raw) return false;
  const padded = ` ${raw} `;
  if (/(^|[^\p{L}])chó([^\p{L}]|$)/iu.test(padded)) return true;
  return false;
};

export const isInappropriateText = (value) => {
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

export const validateHumanName = (value) => {
  const raw = String(value || '').trim().replace(/\s+/g, ' ');
  if (!raw) return { ok: false, error: 'Vui lòng nhập họ và tên.' };
  if (raw.length < 2 || raw.length > 80) return { ok: false, error: 'Tên không hợp lệ.' };
  if (!/^[\p{L}][\p{L}\s.'-]*$/u.test(raw)) return { ok: false, error: 'Tên không hợp lệ.' };
  if (!/[\p{L}]/u.test(raw)) return { ok: false, error: 'Tên không hợp lệ.' };
  if (isInappropriateText(raw) || isNonsenseName(raw)) return { ok: false, error: 'Tên không phù hợp. Vui lòng nhập tên lịch sự.' };
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

export const normalizeVietnamPhone = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const cleaned = raw.replace(/[^\d+]/g, '');
  const digits = cleaned.replace(/[^\d]/g, '');
  if (!digits) return '';

  if (cleaned.startsWith('+')) {
    if (!digits.startsWith('84') || digits.length !== 11) return '';
    const national = `0${digits.slice(2)}`;
    return `+84${national.slice(1)}`;
  }

  if (digits.startsWith('84') && digits.length === 11) {
    const national = `0${digits.slice(2)}`;
    return `+84${national.slice(1)}`;
  }

  if (digits.startsWith('0') && digits.length === 10) {
    return `+84${digits.slice(1)}`;
  }

  if (digits.startsWith('02') && digits.length === 11) {
    return `+84${digits.slice(1)}`;
  }

  return '';
};

export const validateVietnamPhone = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return { ok: false, error: 'Vui lòng nhập số điện thoại.' };
  if (isInappropriateText(raw)) return { ok: false, error: 'Số điện thoại không phù hợp.' };

  const normalized = normalizeVietnamPhone(raw);
  if (!normalized) return { ok: false, error: 'Số điện thoại Việt Nam không hợp lệ. VD: 09xxxxxxxx hoặc +849xxxxxxxx.' };

  const digits = normalized.replace(/[^\d]/g, '');
  const national = digits.startsWith('84') ? `0${digits.slice(2)}` : '';

  const isMobile = /^0(3|5|7|8|9)\d{8}$/.test(national);
  const isLandline = /^02\d{9}$/.test(national);
  if (!isMobile && !isLandline) return { ok: false, error: 'Số điện thoại Việt Nam không hợp lệ.' };

  if (/^(\d)\1+$/.test(national) || /^(0123456789|0987654321)$/.test(national)) {
    return { ok: false, error: 'Số điện thoại không hợp lệ.' };
  }

  return { ok: true, value: normalized };
};

export const humanizeImageUploadError = (err) => {
  const code = String(err?.message || err || '').trim();
  if (!code) return 'Upload thất bại.';
  if (code === 'SENSITIVE_IMAGE') return 'Ảnh nhạy cảm từ chối yêu cầu thay đổi ảnh';
  if (code === 'MODERATION_NOT_CONFIGURED') return 'Chức năng kiểm duyệt ảnh chưa được cấu hình. Vui lòng liên hệ admin.';
  if (code === 'MODERATION_FAILED') return 'Không thể kiểm duyệt ảnh lúc này. Vui lòng thử lại.';
  if (code === 'FILE_TOO_LARGE') return 'Ảnh quá lớn. Vui lòng chọn ảnh nhỏ hơn.';
  if (code === 'INVALID_FILE_TYPE') return 'File không đúng định dạng. Chỉ hỗ trợ PNG/JPG/WEBP.';
  if (code === 'INVALID_FORMDATA') return 'Dữ liệu upload không hợp lệ. Vui lòng thử lại.';
  if (code === 'UNAUTHORIZED') return 'Vui lòng đăng nhập để upload ảnh.';
  return code;
};
