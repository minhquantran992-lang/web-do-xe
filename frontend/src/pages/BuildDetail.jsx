import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import Viewer from '../components/configurator/Viewer.jsx';
import { favoriteBuild, getBuildDetail, voteBuild } from '../services/api/configurations.js';
import { createBooking } from '../services/api/bookings.js';
import { updateMe } from '../services/api/auth.js';
import { listPartneredShops } from '../services/api/vendors.js';
import { useAuth } from '../services/auth/AuthContext.jsx';
import { useI18n } from '../services/i18n.jsx';
import { getApiBaseUrl } from '../services/api/client.js';
import ChatThreadModal from '../components/ChatThreadModal.jsx';
import FollowButton from '../components/FollowButton.jsx';
import { validateHumanName } from '../services/validation.js';

const cx = (...arr) => arr.filter(Boolean).join(' ');

const legalWarningsFromParts = (parts) => {
  const warnings = [];
  const types = new Set((Array.isArray(parts) ? parts : []).map((p) => String(p?.type || '').trim()).filter(Boolean));
  if (types.has('exhaust'))
    warnings.push(
      'Cảnh báo (VN): Độ pô/ống xả có thể vượt ngưỡng tiếng ồn/khí thải. Nên ưu tiên pô zin hoặc pô có tiêu âm (DB killer) và đảm bảo đúng tiêu chuẩn. (Tham khảo: NĐ 100/2019/NĐ-CP, NĐ 123/2021/NĐ-CP)'
    );
  if (types.has('lighting'))
    warnings.push(
      'Cảnh báo (VN): Độ đèn cần đúng màu, không gây chói/lóa và không lắp đèn sai quy định khi tham gia giao thông. (Tham khảo: NĐ 100/2019/NĐ-CP, NĐ 123/2021/NĐ-CP)'
    );
  if (types.has('bodykit'))
    warnings.push(
      'Cảnh báo (VN): Thay đổi ốp/ngoại hình không được làm thay đổi kết cấu xe hoặc che khuất biển số/đèn/xi-nhan; các thay đổi ảnh hưởng kết cấu có thể bị xử phạt. (Tham khảo: NĐ 100/2019/NĐ-CP, NĐ 123/2021/NĐ-CP)'
    );
  if (types.has('tire') || types.has('wheels'))
    warnings.push(
      'Cảnh báo (VN): Thay mâm/lốp cần đúng thông số, đúng tải trọng và không cạ/không vượt quá giới hạn an toàn; thay đổi sai có thể gây mất an toàn và có nguy cơ bị xử lý. (Tham khảo: NĐ 100/2019/NĐ-CP, NĐ 123/2021/NĐ-CP)'
    );
  return warnings;
};

const normalizePrice = (n) => {
  const x = Number(n);
  if (!Number.isFinite(x) || x < 0) return 0;
  return Math.round(x * 100) / 100;
};

const formatVnd = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(n)} ₫`;
};

const toDateInputValue = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const pickMountCandidates = (mount) => {
  const m = String(mount || '').trim();
  if (!m) return [];
  if (m.endsWith('_mount')) return [m, m.replace(/_mount$/, '_socket')];
  if (m.endsWith('_socket')) return [m, m.replace(/_socket$/, '_mount')];
  return [m];
};

const defaultMountCandidatesByType = (type) => {
  const t = String(type || '');
  if (t === 'wheels')
    return [
      ['front_wheel_socket', 'front_wheel_mount', 'wheel_front_left'],
      ['rear_wheel_socket', 'rear_wheel_mount', 'wheel_rear_left']
    ];
  if (t === 'tire')
    return [
      ['front_tire_socket', 'front_tire_mount', 'tire_front'],
      ['rear_tire_socket', 'rear_tire_mount', 'tire_rear']
    ];
  if (t === 'suspension') return [['front_suspension_socket', 'front_suspension_mount'], ['rear_suspension_socket', 'rear_suspension_mount']];
  if (t === 'brake') return [['front_brake_socket', 'front_brake_mount'], ['rear_brake_socket', 'rear_brake_mount']];
  if (t === 'clutch') return [['clutch_socket', 'clutch_mount']];
  if (t === 'handlebar') return [['handlebar_socket', 'handlebar_mount']];
  if (t === 'seat') return [['seat_socket', 'seat_mount']];
  if (t === 'bodykit') return [['bodykit_socket', 'bodykit_mount']];
  if (t === 'lighting') return [['light_socket', 'lighting_socket', 'lighting_mount']];
  if (t === 'throttle_housing') return [['throttle_housing_socket', 'throttle_housing_mount']];
  if (t === 'exhaust') return [['exhaust_socket', 'exhaust_mount']];
  if (t === 'topbox') return [['topbox_mount', 'topbox_socket', 'rear_box_mount', 'rear_rack_mount', 'seat_mount', 'seat_socket']];
  return [[`${t}_socket`, `${t}_mount`]];
};

const TARGET_SIZE_BY_TYPE = {
  exhaust: 0.35,
  clutch: 0.25,
  wheels: 0.45,
  frontWheel: 0.45,
  rearWheel: 0.45,
  brake: 0.25,
  suspension: 0.4,
  tire: 0.45,
  handlebar: 0.35,
  bodykit: 0.6,
  seat: 0.35,
  tank: 0.55,
  headlight: 0.25,
  lighting: 0.25,
  throttle_housing: 0.25,
  topbox: 0.5
};

const KYC_COUNTRY_OTHER = '__other__';
const KYC_COUNTRY_OPTIONS = [
  'Việt Nam',
  'United States',
  'Japan',
  'Korea',
  'China',
  'Thailand',
  'Singapore',
  'Malaysia',
  'Indonesia',
  'Australia',
  'Canada',
  'Germany',
  'France',
  'United Kingdom'
];

const BuildDetail = () => {
  const { t } = useI18n();
  const { isAuthed, token, user, setAuth } = useAuth();
  const location = useLocation();
  const nav = useNavigate();
  const params = useParams();
  const id = String(params?.id || '').trim();

  const resolveUrl = (u) => {
    const base = getApiBaseUrl();
    const raw = String(u || '').trim();
    if (!raw) return '';
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
    if (raw.startsWith('/')) return `${base}${raw}`;
    return raw;
  };

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [bookingOpen, setBookingOpen] = useState(false);
  const [shops, setShops] = useState([]);
  const [shopsLoading, setShopsLoading] = useState(false);
  const [shopsError, setShopsError] = useState('');
  const [selectedShopId, setSelectedShopId] = useState('');
  const [bookingBusy, setBookingBusy] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [kycOpen, setKycOpen] = useState(false);
  const [kycMode, setKycMode] = useState('full');
  const [kycLastName, setKycLastName] = useState('');
  const [kycFirstName, setKycFirstName] = useState('');
  const [kycDob, setKycDob] = useState('');
  const [kycCity, setKycCity] = useState('');
  const [kycGender, setKycGender] = useState('');
  const [kycCountry, setKycCountry] = useState('');
  const [kycCountryOther, setKycCountryOther] = useState('');
  const [bookingDate, setBookingDate] = useState('');
  const [kycSaving, setKycSaving] = useState(false);
  const [kycError, setKycError] = useState('');

  const kycStorageKey = useMemo(() => {
    const uid = String(user?.id || user?._id || '').trim();
    const email = String(user?.email || '').trim().toLowerCase();
    const role = String(user?.role || '').trim().toLowerCase() || 'user';
    const base = uid || email;
    return base ? `carbanana.kyc.${role}.${base}` : '';
  }, [user?._id, user?.email, user?.id, user?.role]);

  useEffect(() => {
    setKycLastName('');
    setKycFirstName('');
    setKycDob('');
    setKycCity('');
    setKycGender('');
    setKycCountry('');
    setKycCountryOther('');
    setKycError('');
    setKycMode('full');
    setKycOpen(false);
  }, [kycStorageKey]);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    setLoading(true);
    getBuildDetail({ id, token: isAuthed ? token : undefined })
      .then((res) => {
        if (!alive) return;
        setItem(res?.item || null);
      })
      .catch(() => {
        if (!alive) return;
        setItem(null);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id, isAuthed, token]);

  useEffect(() => {
    const qs = new URLSearchParams(location.search || '');
    if (qs.get('book') === '1') setBookingOpen(true);
  }, [location.search]);

  useEffect(() => {
    if (!bookingOpen) return;
    let alive = true;
    setShopsLoading(true);
    setShopsError('');
    listPartneredShops()
      .then((items) => {
        if (!alive) return;
        setShops(Array.isArray(items) ? items : []);
      })
      .catch((e) => {
        if (!alive) return;
        setShops([]);
        setShopsError(e?.message || 'REQUEST_FAILED');
      })
      .finally(() => {
        if (!alive) return;
        setShopsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [bookingOpen]);

  useEffect(() => {
    if (!toast) return;
    const tm = window.setTimeout(() => setToast(''), 1800);
    return () => window.clearTimeout(tm);
  }, [toast]);

  const needsKyc = useMemo(() => {
    const n = String(user?.name || '').trim();
    const nameOk = validateHumanName(n).ok;
    const dob = toDateInputValue(user?.dob);
    const c = String(user?.city || '').trim();
    const g = String(user?.gender || '').trim().toLowerCase();
    const country = String(user?.country || '').trim();
    return !nameOk || !dob || !c || !['male', 'female'].includes(g) || !country;
  }, [user?.city, user?.country, user?.dob, user?.gender, user?.name]);

  const todayIso = useMemo(() => {
    const d = new Date();
    const yyyy = String(d.getFullYear());
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const tomorrowIso = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const yyyy = String(d.getFullYear());
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const title = useMemo(() => {
    const carName = item?.carId?.name || '';
    const buildName = String(item?.name || '').trim();
    return buildName || carName || `${t('build_detail_title')} #${id.slice(-6)}`;
  }, [id, item, t]);

  const imageUrl = resolveUrl(item?.imageUrl || item?.thumbnailUrl || item?.carId?.thumbnailUrl);
  const carModelUrl = String(item?.carId?.model3d || item?.carId?.modelUrl || '').trim();
  const userName = item?.userId?.name || '';
  const partsCount =
    (Array.isArray(item?.selectedParts) ? item.selectedParts.length : 0) + (item?.selectedWheels ? 1 : 0);
  const viewerBackground = String(item?.backgroundKey || 'studio').trim() || 'studio';
  const viewerBackgroundKey = viewerBackground === 'studio' ? 'dark-studio' : viewerBackground;

  const allSelectedParts = useMemo(() => {
    const out = [];
    if (item?.selectedWheels) out.push(item.selectedWheels);
    if (Array.isArray(item?.selectedParts)) out.push(...item.selectedParts);
    return out.filter(Boolean);
  }, [item]);

  const totalPrice = useMemo(() => {
    return allSelectedParts.reduce((sum, p) => sum + normalizePrice(p?.price), 0);
  }, [allSelectedParts]);

  const legalWarnings = useMemo(() => legalWarningsFromParts(allSelectedParts), [allSelectedParts]);
  const legalStatus = legalWarnings.length ? 'review' : 'ok';

  const viewerSlots = useMemo(() => {
    const parts = allSelectedParts;
    const slots = [];
    for (const part of parts) {
      const type = String(part?.type || '').trim();
      if (!type) continue;
      const url = String(part?.modelUrl || '').trim();
      if (!url) continue;

      const explicit =
        Array.isArray(part?.mountPoints) && part.mountPoints.length
          ? part.mountPoints.map((m) => pickMountCandidates(m)).filter((x) => x.length)
          : part?.mountPoint
            ? [pickMountCandidates(part.mountPoint)]
            : [];

      const candidates = explicit.length ? explicit : defaultMountCandidatesByType(type);
      const targetSize = TARGET_SIZE_BY_TYPE?.[type];

      if (type === 'wheels' || type === 'tire') {
        const front = candidates[0] || ['front_wheel_mount', 'front_wheel_socket'];
        const rear = candidates[1] || ['rear_wheel_mount', 'rear_wheel_socket'];
        slots.push({ slot: `${type}:front`, type, socket: front, url, scale: 1, autoScale: true, targetSize });
        slots.push({ slot: `${type}:rear`, type, socket: rear, url, scale: 1, autoScale: true, targetSize });
      } else {
        const primary = candidates[0] || [`${type}_mount`];
        slots.push({ slot: type, type, socket: primary, url, scale: 1, autoScale: true, targetSize });
      }
    }

    return slots;
  }, [allSelectedParts]);

  const anchorPreset = useMemo(() => {
    return Array.isArray(item?.carId?.anchors) ? item.carId.anchors : [];
  }, [item?.carId?.anchors]);

  const partLabels = useMemo(() => {
    const out = [];
    const seen = new Set();
    const add = (p) => {
      const pid = String(p?._id || '').trim();
      if (!pid || seen.has(pid)) return;
      seen.add(pid);
      const name = String(p?.name || '').trim();
      if (name) out.push(name);
    };
    if (item?.selectedWheels) add(item.selectedWheels);
    if (Array.isArray(item?.selectedParts)) for (const p of item.selectedParts) add(p);
    return out;
  }, [item]);

  const votes = Number(item?.likesCount) || 0;
  const favorites = Number(item?.favoritesCount) || 0;
  const views = Number(item?.viewsCount) || 0;
  const voted = Boolean(item?.likedByMe);
  const favorited = Boolean(item?.favoritedByMe);
  const shareUrl = useMemo(() => {
    const safeId = encodeURIComponent(String(id || '').trim());
    if (!safeId) return '';
    try {
      return `${window.location.origin}/builds/${safeId}`;
    } catch {
      return `/builds/${safeId}`;
    }
  }, [id]);
  const shareTitle = useMemo(() => String(title || '').trim() || 'Carbanana Build', [title]);
  const shareText = useMemo(() => {
    const owner = String(userName || '').trim();
    return owner ? `Xem bản độ của ${owner}` : 'Xem bản độ này';
  }, [userName]);

  const onVote = async () => {
    if (!id || busy) return;
    if (!isAuthed) {
      setToast(t('leaderboard_login_to_vote'));
      return;
    }
    if (voted) return;
    setBusy(true);
    try {
      const res = await voteBuild({ token, buildId: id });
      const patch = res?.item;
      setItem((prev) => ({ ...(prev || {}), ...(patch || {}) }));
      setToast(t('leaderboard_vote_done'));
    } finally {
      setBusy(false);
    }
  };

  const onFavorite = async () => {
    if (!id || busy) return;
    if (!isAuthed) {
      setToast(t('leaderboard_login_to_vote'));
      return;
    }
    if (favorited) return;
    setBusy(true);
    try {
      const res = await favoriteBuild({ token, buildId: id });
      const patch = res?.item;
      setItem((prev) => ({ ...(prev || {}), ...(patch || {}) }));
      setToast(t('leaderboard_favorited'));
    } finally {
      setBusy(false);
    }
  };

  const openExternalShare = (url) => {
    const u = String(url || '').trim();
    if (!u) return;
    try {
      window.open(u, '_blank', 'noopener,noreferrer');
    } catch {
      window.location.href = u;
    }
  };

  const onCopyShareLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setToast('Đã copy link');
    } catch {
      setToast('Copy thất bại');
    }
  };

  const onNativeShare = async () => {
    if (!shareUrl) return;
    if (!navigator?.share) {
      setShareOpen(true);
      return;
    }
    try {
      await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
      setToast('Đã mở chia sẻ');
    } catch {}
  };

  const closeBooking = () => {
    setBookingOpen(false);
    setSelectedShopId('');
    setShopsError('');
    setToast('');
    setChatOpen(false);
    setKycOpen(false);
    setKycError('');
    try {
      const qs = new URLSearchParams(location.search || '');
      if (qs.has('book')) {
        qs.delete('book');
        nav(`${location.pathname}${qs.toString() ? `?${qs.toString()}` : ''}`, { replace: true });
      }
    } catch {}
  };

  const openKyc = ({ mode } = {}) => {
    const nextMode = mode === 'dateOnly' ? 'dateOnly' : 'full';
    setKycMode(nextMode);
    let saved = null;
    try {
      if (kycStorageKey) {
        const raw = localStorage.getItem(kycStorageKey);
        if (raw) saved = JSON.parse(raw);
      }
    } catch {}

    const savedLast = String(saved?.lastName || '').trim();
    const savedFirst = String(saved?.firstName || '').trim();
    const savedDob = String(saved?.dob || '').trim();
    const savedCity = String(saved?.city || '').trim();
    const savedGender = String(saved?.gender || '').trim();
    const savedCountry = String(saved?.country || '').trim();

    if (savedLast || savedFirst || savedDob || savedCity) {
      setKycLastName(savedLast);
      setKycFirstName(savedFirst);
      setKycDob(savedDob);
      setKycCity(savedCity);
      setKycGender(savedGender);
      if (savedCountry && KYC_COUNTRY_OPTIONS.includes(savedCountry)) {
        setKycCountry(savedCountry);
        setKycCountryOther('');
      } else if (savedCountry) {
        setKycCountry(KYC_COUNTRY_OTHER);
        setKycCountryOther(savedCountry);
      } else {
        setKycCountry('');
        setKycCountryOther('');
      }
    } else {
      const rawName = String(user?.name || '').trim();
      const parts = rawName.split(/\s+/).filter(Boolean);
      const first = parts.length ? parts[parts.length - 1] : '';
      const last = parts.length > 1 ? parts.slice(0, -1).join(' ') : '';
      setKycLastName(last);
      setKycFirstName(first);
      setKycDob(toDateInputValue(user?.dob));
      setKycCity(String(user?.city || '').trim());
      setKycGender(String(user?.gender || '').trim());
      const uCountry = String(user?.country || '').trim();
      if (uCountry && KYC_COUNTRY_OPTIONS.includes(uCountry)) {
        setKycCountry(uCountry);
        setKycCountryOther('');
      } else if (uCountry) {
        setKycCountry(KYC_COUNTRY_OTHER);
        setKycCountryOther(uCountry);
      } else {
        setKycCountry('');
        setKycCountryOther('');
      }
    }
    const picked = shops.find((x) => String(x?._id || '') === String(selectedShopId || ''));
    const prefDate = picked?.closedToday ? tomorrowIso : todayIso;
    setBookingDate((v) => v || prefDate);
    setKycError('');
    setKycOpen(true);
  };

  const doRequestBooking = async ({ timeSlot }) => {
    setBookingBusy(true);
    try {
      const res = await createBooking({ token, buildId: id, shopId: selectedShopId, timeSlot });
      const bookingId = String(res?.item?._id || '');
      if (bookingId) {
        closeBooking();
        nav(`/booking/${encodeURIComponent(bookingId)}`);
      } else {
        setToast('REQUEST_FAILED');
      }
    } catch (e) {
      const msg = e?.message || 'REQUEST_FAILED';
      if (msg === 'BOOKING_ALREADY_PENDING') {
        const bid = String(e?.data?.bookingId || '');
        if (bid) {
          closeBooking();
          nav(`/booking/${encodeURIComponent(bid)}`);
          return;
        }
      }
      if (msg === 'RATE_LIMITED') {
        const retryMs = Number(e?.data?.retryAfterMs) || 0;
        const retrySec = retryMs ? Math.max(1, Math.ceil(retryMs / 1000)) : 30;
        setToast(`Bạn thao tác quá nhanh. Vui lòng thử lại sau ${retrySec}s.`);
        return;
      }
      setToast(msg);
    } finally {
      setBookingBusy(false);
    }
  };

  const onRequestBooking = async () => {
    if (bookingBusy) return;
    if (!id) return;
    if (!isAuthed) {
      setToast('Vui lòng đăng nhập để đặt lịch.');
      return;
    }
    if (!selectedShopId) {
      setToast('Vui lòng chọn shop.');
      return;
    }
    const picked = shops.find((x) => String(x?._id || '') === String(selectedShopId || ''));
    if (picked && picked?.acceptingBookings === false) {
      setToast('Shop hiện tại đang tạm ngưng.');
      return;
    }
    if (picked?.closedToday) {
      setToast('Hôm nay shop nghỉ. Bạn vẫn có thể đặt lịch từ ngày mai.');
    }
    openKyc({ mode: needsKyc ? 'full' : 'dateOnly' });
  };

  const onOpenChat = () => {
    if (!isAuthed) {
      setToast('Vui lòng đăng nhập để chat.');
      return;
    }
    if (!selectedShopId) {
      setToast('Vui lòng chọn shop để chat.');
      return;
    }
    setChatOpen(true);
  };

  const visibleShops = useMemo(() => {
    const list = Array.isArray(shops) ? shops : [];
    return list;
  }, [shops]);

  const onKycPrimaryAction = async () => {
    if (!token || kycSaving) return;
    const mode = String(kycMode || 'full');
    if (mode !== 'dateOnly') {
      const lastName = String(kycLastName || '').trim();
      const firstName = String(kycFirstName || '').trim();
      const rawName = `${lastName} ${firstName}`.trim().replace(/\s+/g, ' ');
      const city = String(kycCity || '').trim();
      const gender = String(kycGender || '').trim().toLowerCase();
      const country = String(kycCountry || '').trim() === KYC_COUNTRY_OTHER ? String(kycCountryOther || '').trim() : String(kycCountry || '').trim();
      const dob = String(kycDob || '').trim();

      if (!lastName || !firstName) {
        setKycError('Vui lòng nhập đầy đủ họ và tên.');
        return;
      }
      const checkedName = validateHumanName(rawName);
      if (!checkedName.ok) {
        setKycError(checkedName.error);
        return;
      }
      const dobDate = dob ? new Date(`${dob}T00:00:00`) : null;
      if (!dob || !dobDate || Number.isNaN(dobDate.getTime())) {
        setKycError('Vui lòng chọn ngày tháng năm sinh.');
        return;
      }
      if (dobDate.getTime() >= new Date(`${todayIso}T00:00:00`).getTime()) {
        setKycError('Ngày sinh không hợp lệ.');
        return;
      }
      if (!['male', 'female'].includes(gender)) {
        setKycError('Vui lòng chọn giới tính.');
        return;
      }
      if (city.length < 2) {
        setKycError('Vui lòng nhập thành phố/tỉnh.');
        return;
      }
      if (country.length < 2) {
        setKycError('Vui lòng chọn quốc gia.');
        return;
      }

      setKycSaving(true);
      setKycError('');
      try {
        try {
          if (kycStorageKey) {
            localStorage.setItem(
              kycStorageKey,
              JSON.stringify({
                lastName: String(kycLastName || '').trim(),
                firstName: String(kycFirstName || '').trim(),
                dob,
                city,
                gender,
                country
              })
            );
          }
        } catch {}

        const data = await updateMe({ token, payload: { name: checkedName.value, dob, city, gender, country } });
        const nextUser = data?.user || null;
        if (nextUser) setAuth({ token, user: nextUser });
        setKycMode('dateOnly');
      } catch (e) {
        const msg = String(e?.message || 'REQUEST_FAILED');
        if (msg === 'INVALID_NAME') {
          setKycError('Tên không hợp lệ.');
          return;
        }
        if (msg === 'NAME_INAPPROPRIATE') {
          setKycError('Tên không phù hợp. Vui lòng nhập tên lịch sự.');
          return;
        }
        if (msg === 'UNAUTHORIZED') {
          setKycError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
          return;
        }
        setKycError(msg);
        return;
      } finally {
        setKycSaving(false);
      }
      return;
    }

    const dateStr = String(bookingDate || '').trim();
    if (!dateStr) {
      setKycError('Vui lòng chọn ngày đặt lịch.');
      return;
    }
    const picked = shops.find((x) => String(x?._id || '') === String(selectedShopId || ''));
    if (picked?.closedToday && dateStr === todayIso) {
      setKycError('Hôm nay shop không làm việc. Vui lòng chọn ngày khác.');
      return;
    }
    const timeSlotDate = new Date(`${dateStr}T09:00:00`);
    if (Number.isNaN(timeSlotDate.getTime())) {
      setKycError('Ngày đặt lịch không hợp lệ.');
      return;
    }
    if (new Date(`${todayIso}T00:00:00`).getTime() > timeSlotDate.getTime()) {
      setKycError('Vui lòng chọn ngày từ hôm nay trở đi.');
      return;
    }

    const rawName = String(user?.name || '').trim();
    const city = String(user?.city || '').trim();
    const gender = String(user?.gender || '').trim().toLowerCase();
    const country = String(user?.country || '').trim();
    const dob = toDateInputValue(user?.dob);
    if (!rawName || !dob || !city || !['male', 'female'].includes(gender) || !country) {
      setKycMode('full');
      setKycError('Vui lòng nhập KYC trước khi đặt lịch.');
      return;
    }

    setKycSaving(true);
    setKycError('');
    try {
      const res = await createBooking({
        token,
        buildId: id,
        shopId: selectedShopId,
        timeSlot: timeSlotDate.toISOString(),
        customerName: rawName,
        customerCity: city,
        customerGender: gender,
        customerCountry: country
      });
      const bookingId = String(res?.item?._id || '');
      if (bookingId) {
        closeBooking();
        nav(`/booking/${encodeURIComponent(bookingId)}`);
      } else {
        setKycError('Không tạo được lịch hẹn. Vui lòng thử lại.');
      }
    } catch (e) {
      const msg = String(e?.message || 'REQUEST_FAILED');
      if (msg === 'BOOKING_ALREADY_PENDING') {
        const bid = String(e?.data?.bookingId || '');
        if (bid) {
          closeBooking();
          nav(`/booking/${encodeURIComponent(bid)}`);
          return;
        }
        setKycError('Bạn đang có 1 yêu cầu đặt lịch đang chờ. Vui lòng thử lại sau.');
        return;
      }
      if (msg === 'RATE_LIMITED') {
        const retryMs = Number(e?.data?.retryAfterMs) || 0;
        const retrySec = retryMs ? Math.max(1, Math.ceil(retryMs / 1000)) : 30;
        setKycError(`Bạn thao tác quá nhanh. Vui lòng thử lại sau ${retrySec}s.`);
        return;
      }
      if (msg === 'SHOP_NOT_ACCEPTING') {
        setKycError('Shop hiện tại đang tạm ngưng.');
        return;
      }
      if (msg === 'SHOP_CLOSED_TODAY') {
        setKycError('Hôm nay shop không làm việc. Vui lòng chọn ngày khác.');
        return;
      }
      if (msg === 'SHOP_FULL') {
        setKycError('Shop đã hết slot tại ngày bạn chọn. Vui lòng chọn ngày khác hoặc shop khác.');
        return;
      }
      if (msg === 'UNAUTHORIZED') {
        setKycError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        return;
      }
      if (msg === 'SHOP_NOT_FOUND') {
        setKycError('Shop không khả dụng. Vui lòng chọn shop khác.');
        return;
      }
      if (msg === 'BUILD_NOT_FOUND') {
        setKycError('Bản độ không tồn tại hoặc đã bị xóa.');
        return;
      }
      setKycError(msg);
    } finally {
      setKycSaving(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-zinc-500">{t('common_loading')}</div>;
  }

  if (!item) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6">
        <div className="text-sm font-semibold text-white/80">{t('common_error')}</div>
        <div className="mt-2 text-sm text-zinc-500">BUILD_NOT_FOUND</div>
        <div className="mt-4">
          <Link to="/leaderboard" className="text-sm text-sky-300 hover:text-sky-200">
            {t('build_detail_back')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative min-h-screen"
      style={{
        backgroundImage:
          'radial-gradient(860px 440px at 18% 0%, rgba(56,189,248,0.30), transparent 60%), radial-gradient(760px 440px at 86% 18%, rgba(34,211,238,0.18), transparent 62%), radial-gradient(760px 520px at 78% 96%, rgba(168,85,247,0.14), transparent 60%), linear-gradient(180deg, #0b2a4a 0%, #070b14 45%, #05060a 100%)'
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.10) 1px, transparent 1px)',
          backgroundSize: '84px 84px'
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/0 via-black/10 to-black/30" />

      <div className="relative mx-auto w-full max-w-6xl space-y-6 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/leaderboard"
              className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-zinc-100 hover:bg-white/10"
            >
              ← {t('build_detail_back')}
            </Link>
            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-sky-400 to-cyan-300 px-4 py-2 text-sm font-black text-zinc-950 hover:brightness-110"
            >
              {t('common_back_home')}
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-100">
              Tổng {formatVnd(totalPrice)}
            </div>
            <div
              className={cx(
                'rounded-full border px-3 py-1.5 text-xs font-semibold',
                legalStatus === 'ok' ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200' : 'border-amber-400/25 bg-amber-500/10 text-amber-200'
              )}
            >
              Pháp lý: {legalStatus.toUpperCase()}
            </div>
            <FollowButton itemType="build" itemId={id} size="xs" />
            <button
              type="button"
              onClick={() => setBookingOpen(true)}
              className="rounded-2xl border border-sky-400/20 bg-sky-500/15 px-4 py-2 text-sm font-bold text-sky-100 hover:bg-sky-500/20"
            >
              Đặt lịch tại shop đối tác
            </button>
          </div>
        </div>

        {toast ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm font-semibold text-zinc-100">{toast}</div>
        ) : null}

        {legalWarnings.length ? (
          <div className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-5 text-sm text-amber-100 backdrop-blur-xl">
            <div className="text-xs font-semibold text-amber-100/85">Cảnh báo pháp lý</div>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {legalWarnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="rounded-3xl border border-white/10 bg-zinc-950/35 p-5 backdrop-blur-xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-white/60">Build</div>
              <div className="mt-1 truncate text-xl font-black tracking-tight text-white">{title}</div>
              <div className="mt-2 text-sm text-white/70">
                {userName ? `${t('build_detail_by')} ${userName} • ` : ''}
                {partsCount} {t('build_detail_parts')} • {t('leaderboard_views')} {views}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/45">
                <span>ID:</span>
                <span className="font-semibold text-white/70">{id}</span>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(id);
                      setToast('Đã copy ID');
                    } catch {}
                  }}
                  className="rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-semibold text-white/70 transition hover:bg-white/10"
                >
                  Copy
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-100">
                {t('leaderboard_votes')} {votes}
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-100">
                {t('leaderboard_favorites')} {favorites}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="overflow-hidden rounded-3xl border border-zinc-800/70 bg-zinc-950/55 backdrop-blur-xl">
            <div className="relative h-[58vh] min-h-[360px] max-h-[640px] bg-black/20">
              {carModelUrl ? (
                <div className="absolute inset-0">
                  <Viewer
                    carModelUrl={carModelUrl}
                    color={String(item?.selectedColor || '').trim() || '#ffffff'}
                    highlightType=""
                    anchorPreset={anchorPreset}
                    slots={viewerSlots}
                    embeddedConfig={{}}
                    background={viewerBackgroundKey}
                    backgroundPreset={null}
                    dragHint={t('cfg_drag_hint')}
                    initialCamera={item?.camera}
                  />
                </div>
              ) : imageUrl ? (
                <img src={imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-white/60">NO_PREVIEW</div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-zinc-950/35 p-5 backdrop-blur-xl">
              <div className="grid gap-3">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={onVote}
                  disabled={busy || voted}
                  className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    voted ? 'border-white/10 bg-white/5 text-white/90' : 'border-sky-300/25 bg-sky-400 text-zinc-950 hover:bg-sky-300'
                  }`}
                >
                  <span>👍</span>
                  <span>{voted ? t('leaderboard_vote_done') : t('leaderboard_like')}</span>
                </motion.button>

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={onFavorite}
                  disabled={busy || favorited}
                  className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    favorited ? 'border-rose-300/25 bg-rose-400 text-zinc-950' : 'border-white/10 bg-white/5 text-white/90 hover:bg-white/10'
                  }`}
                >
                  <span>❤️</span>
                  <span>{favorited ? t('leaderboard_favorited') : t('leaderboard_favorite')}</span>
                </motion.button>

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={onNativeShare}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10"
                >
                  <span>🔗</span>
                  <span>Chia sẻ</span>
                </motion.button>

                {shareOpen ? (
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-xs font-semibold text-white/60">Chia sẻ ra ứng dụng</div>
                    <div className="mt-3 grid gap-2">
                      <button
                        type="button"
                        onClick={onCopyShareLink}
                        className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 hover:bg-white/10"
                      >
                        Copy link
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const u = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(String(shareUrl || ''))}`;
                          openExternalShare(u);
                        }}
                        className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 hover:bg-white/10"
                      >
                        Chia sẻ Facebook
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const u = `https://zalo.me/share?url=${encodeURIComponent(String(shareUrl || ''))}&title=${encodeURIComponent(String(shareTitle || ''))}`;
                          openExternalShare(u);
                        }}
                        className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 hover:bg-white/10"
                      >
                        Chia sẻ Zalo
                      </button>
                      <button
                        type="button"
                        onClick={() => setShareOpen(false)}
                        className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/70 hover:bg-white/10"
                      >
                        Đóng
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-zinc-950/35 p-5 backdrop-blur-xl">
              <div className="text-xs font-semibold text-white/60">{t('build_detail_parts')}</div>
              {partLabels.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {partLabels.slice(0, 10).map((name) => (
                    <div key={name} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/85">
                      {name}
                    </div>
                  ))}
                  {partLabels.length > 10 ? (
                    <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70">
                      +{partLabels.length - 10}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="mt-2 text-sm text-white/60">—</div>
              )}
            </div>

            <div className="rounded-3xl border border-white/10 bg-zinc-950/35 p-5 backdrop-blur-xl">
              <div className="text-xs font-semibold text-white/60">Giá</div>
              <div className="mt-3 space-y-2">
                {allSelectedParts.length ? (
                  allSelectedParts.map((p, idx) => (
                    <div key={String(p?._id || `${p?.type || ''}:${p?.name || ''}` || idx)} className="flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0 truncate text-white/85">{String(p?.name || p?.type || '').trim() || 'Part'}</div>
                      <div className="shrink-0 font-semibold text-white/85">{formatVnd(p?.price)}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-white/60">—</div>
                )}
                <div className="h-px bg-white/10" />
                <div className="flex items-center justify-between text-sm font-bold text-white/90">
                  <div>Total</div>
                  <div>{formatVnd(totalPrice)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

      <Link
        to="/"
        className="fixed bottom-5 left-5 z-[70] inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-400 to-cyan-300 px-4 py-3 text-sm font-black text-zinc-950 shadow-[0_18px_60px_-34px_rgba(56,189,248,0.55)] hover:brightness-110"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 10.5L12 3l9 7.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>Trang chủ</span>
      </Link>

      {bookingOpen ? (
        <div className="fixed inset-0 z-[80]">
          <button type="button" className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeBooking} aria-label="Close booking modal" />
          <div className="absolute inset-x-0 top-10 mx-auto w-[min(980px,calc(100%-32px))]">
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/90 shadow-2xl shadow-black/50 backdrop-blur-2xl">
              <div className="flex items-start justify-between gap-3 border-b border-white/10 px-6 py-5">
                <div className="min-w-0">
                  <div className="text-lg font-semibold text-white/90">Select a partnered shop</div>
                  <div className="mt-1 text-sm text-white/55">Pick a shop, then request booking (10-minute response window).</div>
                </div>
                <button
                  type="button"
                  onClick={closeBooking}
                  className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/85 hover:bg-white/10"
                >
                  Close
                </button>
              </div>

              <div className="grid gap-5 p-6 lg:grid-cols-[1fr_340px]">
                <div className="space-y-3">
                  {shopsLoading ? <div className="text-sm text-white/60">Loading shops…</div> : null}
                  {shopsError ? (
                    <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{shopsError}</div>
                  ) : null}
                  {!shopsLoading && !shopsError && !visibleShops.length ? (
                    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/70">
                      No partnered shops available.
                    </div>
                  ) : null}

                  <div className="grid gap-3 sm:grid-cols-2">
                    {visibleShops.map((s) => {
                      const sid = String(s?._id || '');
                      const active = sid && sid === selectedShopId;
                      const isAccepting = s?.acceptingBookings !== false;
                      return (
                        <button
                          key={sid}
                          type="button"
                          onClick={() => {
                            setSelectedShopId(sid);
                          }}
                          disabled={!isAccepting}
                          className={cx(
                            'text-left rounded-3xl border p-4 transition',
                            !isAccepting ? 'cursor-not-allowed border-white/10 bg-black/10 opacity-70' : '',
                            isAccepting && active ? 'border-sky-400/35 bg-sky-500/10' : isAccepting ? 'border-white/10 bg-black/20 hover:bg-black/30' : ''
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-white/90">{s?.shopName || 'Shop'}</div>
                              <div className="mt-1 line-clamp-2 text-xs text-white/55">{s?.address || ''}</div>
                            </div>
                            <div className="shrink-0 text-right">
                              <div className="text-xs font-semibold text-white/70">⭐ {Number(s?.rating) || 0}</div>
                              {s?.distanceKm != null ? <div className="mt-1 text-[11px] text-white/50">{s.distanceKm} km</div> : null}
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {active ? (
                              <div className="rounded-full border border-sky-400/25 bg-sky-400/10 px-2.5 py-1 text-[11px] font-semibold text-sky-200">
                                Selected
                              </div>
                            ) : null}
                            {!isAccepting ? (
                              <div className="rounded-full border border-rose-400/25 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-100">
                                Tạm ngưng
                              </div>
                            ) : null}
                            {s?.closedToday ? (
                              <div className="rounded-full border border-amber-400/25 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-100">
                                Hôm nay nghỉ
                              </div>
                            ) : null}
                          </div>
                          {!isAccepting ? (
                            <div className="mt-2 text-xs text-white/55">Shop hiện tại đang tạm ngưng.</div>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  {(() => {
                    const picked = shops.find((x) => String(x?._id || '') === String(selectedShopId || ''));
                    if (!picked?.closedToday) return null;
                    return (
                      <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                        Hôm nay shop nghỉ. Bạn vẫn có thể đặt lịch cho các ngày khác.
                      </div>
                    );
                  })()}
                  {(() => {
                    const picked = shops.find((x) => String(x?._id || '') === String(selectedShopId || ''));
                    if (!picked || picked?.acceptingBookings !== false) return null;
                    return (
                      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                        Shop hiện tại đang tạm ngưng.
                      </div>
                    );
                  })()}
                  <button
                    type="button"
                    onClick={onRequestBooking}
                    disabled={
                      bookingBusy ||
                      !selectedShopId ||
                      (() => {
                        const picked = shops.find((x) => String(x?._id || '') === String(selectedShopId || ''));
                        return picked?.acceptingBookings === false;
                      })()
                    }
                    className="w-full rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-bold text-zinc-950 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {bookingBusy ? 'Requesting…' : 'Request booking'}
                  </button>
                  <button
                    type="button"
                    onClick={onOpenChat}
                    disabled={
                      !selectedShopId ||
                      (() => {
                        const picked = shops.find((x) => String(x?._id || '') === String(selectedShopId || ''));
                        return picked?.acceptingBookings === false;
                      })()
                    }
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-zinc-100 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Chat với shop
                  </button>
                  <div className="text-xs text-white/50">Shop must accept/reject within 10 minutes or the request expires.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <ChatThreadModal open={chatOpen} onClose={() => setChatOpen(false)} mode="user" shopId={selectedShopId} />

      {kycOpen ? (
        <div className="fixed inset-0 z-[90]">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-[520px] -translate-x-1/2 -translate-y-1/2">
            <div className="relative">
              <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-sky-500/20 via-cyan-500/10 to-sky-500/20 blur-2xl" />
              <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-white/10 shadow-[0_1px_2px_rgba(0,0,0,0.35),0_40px_120px_-60px_rgba(0,0,0,0.95)] backdrop-blur-2xl">
                <div className="border-b border-white/10 px-6 py-5">
                  <div className="text-[22px] font-black leading-tight tracking-tight text-zinc-50">
                    {kycMode === 'dateOnly' ? 'Đặt lịch' : 'Thông tin khách hàng (KYC)'}
                  </div>
                  <div className="mt-1 text-sm text-zinc-200/80">
                    {kycMode === 'dateOnly'
                      ? 'Chọn ngày để đặt lịch.'
                      : 'Nhập đủ thông tin để mở bước đặt lịch.'}
                  </div>
                </div>

                <div className="space-y-4 px-6 py-5">
              {kycError ? (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{kycError}</div>
              ) : null}
              {kycMode === 'dateOnly' ? null : (
                <>
                  <div>
                    <div className="text-sm font-medium text-zinc-200">Họ và tên</div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <input
                        value={kycLastName}
                        onChange={(e) => setKycLastName(e.target.value)}
                        className="w-full rounded-xl border border-zinc-300/70 bg-white/90 px-3 py-2.5 text-[16px] text-zinc-900 shadow-[0_1px_0_rgba(255,255,255,0.06)] outline-none placeholder:text-zinc-500 focus:border-sky-500/70 focus:ring-4 focus:ring-sky-400/20"
                        placeholder="Họ"
                        disabled={kycSaving}
                      />
                      <input
                        value={kycFirstName}
                        onChange={(e) => setKycFirstName(e.target.value)}
                        className="w-full rounded-xl border border-zinc-300/70 bg-white/90 px-3 py-2.5 text-[16px] text-zinc-900 shadow-[0_1px_0_rgba(255,255,255,0.06)] outline-none placeholder:text-zinc-500 focus:border-sky-500/70 focus:ring-4 focus:ring-sky-400/20"
                        placeholder="Tên"
                        disabled={kycSaving}
                      />
                    </div>
                  </div>
                  <label className="block">
                    <div className="text-sm font-medium text-zinc-200">Ngày tháng năm sinh</div>
                    <input
                      type="date"
                      value={kycDob}
                      max={todayIso}
                      onChange={(e) => setKycDob(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-zinc-300/70 bg-white/90 px-3 py-2.5 text-[16px] text-zinc-900 shadow-[0_1px_0_rgba(255,255,255,0.06)] outline-none placeholder:text-zinc-500 focus:border-sky-500/70 focus:ring-4 focus:ring-sky-400/20"
                      disabled={kycSaving}
                    />
                  </label>
                  <label className="block">
                    <div className="text-sm font-medium text-zinc-200">Giới tính</div>
                    <select
                      value={kycGender}
                      onChange={(e) => setKycGender(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-zinc-300/70 bg-white/90 px-3 py-2.5 text-[16px] text-zinc-900 shadow-[0_1px_0_rgba(255,255,255,0.06)] outline-none focus:border-sky-500/70 focus:ring-4 focus:ring-sky-400/20"
                      disabled={kycSaving}
                    >
                      <option value="">Chọn giới tính</option>
                      <option value="male">Nam</option>
                      <option value="female">Nữ</option>
                    </select>
                  </label>
                  <label className="block">
                    <div className="text-sm font-medium text-zinc-200">Thành phố / Tỉnh</div>
                    <input
                      value={kycCity}
                      onChange={(e) => setKycCity(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-zinc-300/70 bg-white/90 px-3 py-2.5 text-[16px] text-zinc-900 shadow-[0_1px_0_rgba(255,255,255,0.06)] outline-none placeholder:text-zinc-500 focus:border-sky-500/70 focus:ring-4 focus:ring-sky-400/20"
                      placeholder="VD: TP.HCM"
                      disabled={kycSaving}
                    />
                  </label>
                  <label className="block">
                    <div className="text-sm font-medium text-zinc-200">Quốc gia</div>
                    <select
                      value={kycCountry}
                      onChange={(e) => setKycCountry(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-zinc-300/70 bg-white/90 px-3 py-2.5 text-[16px] text-zinc-900 shadow-[0_1px_0_rgba(255,255,255,0.06)] outline-none focus:border-sky-500/70 focus:ring-4 focus:ring-sky-400/20"
                      disabled={kycSaving}
                    >
                      <option value="">Chọn quốc gia</option>
                      {KYC_COUNTRY_OPTIONS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                      <option value={KYC_COUNTRY_OTHER}>Khác</option>
                    </select>
                    {String(kycCountry || '') === KYC_COUNTRY_OTHER ? (
                      <input
                        value={kycCountryOther}
                        onChange={(e) => setKycCountryOther(e.target.value)}
                        className="mt-2 w-full rounded-xl border border-zinc-300/70 bg-white/90 px-3 py-2.5 text-[16px] text-zinc-900 shadow-[0_1px_0_rgba(255,255,255,0.06)] outline-none placeholder:text-zinc-500 focus:border-sky-500/70 focus:ring-4 focus:ring-sky-400/20"
                        placeholder="Nhập quốc gia"
                        disabled={kycSaving}
                      />
                    ) : null}
                  </label>
                </>
              )}
              {kycMode === 'dateOnly' ? (
                <label className="block">
                  <div className="text-sm font-medium text-zinc-200">Ngày đặt lịch</div>
                  <input
                    type="date"
                    value={bookingDate}
                    min={todayIso}
                    onChange={(e) => setBookingDate(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-zinc-300/70 bg-white/90 px-3 py-2.5 text-[16px] text-zinc-900 shadow-[0_1px_0_rgba(255,255,255,0.06)] outline-none focus:border-sky-500/70 focus:ring-4 focus:ring-sky-400/20"
                    disabled={kycSaving}
                  />
                </label>
              ) : null}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setKycOpen(false)}
                  disabled={kycSaving}
                  className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-zinc-100 shadow-[0_1px_0_rgba(255,255,255,0.06)] transition hover:bg-white/15 disabled:opacity-60"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={onKycPrimaryAction}
                  disabled={kycSaving}
                  className="rounded-xl bg-sky-500 px-4 py-3 text-sm font-semibold text-zinc-950 shadow-[0_10px_30px_rgba(14,165,233,0.20)] transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-zinc-300 disabled:shadow-none"
                >
                  {kycSaving ? 'Đang xử lý…' : kycMode === 'dateOnly' ? 'Đặt lịch' : 'Tiếp tục'}
                </button>
              </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      </div>
    </div>
  );
};

export default BuildDetail;
