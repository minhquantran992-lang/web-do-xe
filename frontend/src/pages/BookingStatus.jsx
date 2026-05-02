import { Component, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { updateMe } from '../services/api/auth.js';
import { createBooking, getMyBooking } from '../services/api/bookings.js';
import { apiFetch, apiFetchForm, getApiBaseUrl } from '../services/api/client.js';
import { listPartneredShops } from '../services/api/vendors.js';
import { useAuth } from '../services/auth/AuthContext.jsx';

const cx = (...arr) => arr.filter(Boolean).join(' ');

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

const formatVnd = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(n)} ₫`;
};

const resolveAssetUrl = (url) => {
  const base = getApiBaseUrl();
  const u = String(url || '').trim();
  if (!u) return '';
  if (u.startsWith('data:') || u.startsWith('blob:')) return u;
  if (u.startsWith('/9j/')) return `data:image/jpeg;base64,${u}`;
  if (u.startsWith('iVBORw0KGgo')) return `data:image/png;base64,${u}`;
  if (u.startsWith('R0lGOD')) return `data:image/gif;base64,${u}`;
  if (u.startsWith('UklGR')) return `data:image/webp;base64,${u}`;
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  if (u.startsWith('/')) return `${base}${u}`;
  return `${base}/${u}`;
};

const parseIso = (s) => {
  const d = s ? new Date(s) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  return d;
};

const msToClock = (ms) => {
  const v = Math.max(0, Math.floor(ms / 1000));
  const m = String(Math.floor(v / 60)).padStart(2, '0');
  const s = String(v % 60).padStart(2, '0');
  return `${m}:${s}`;
};

const Badge = ({ tone, children }) => {
  const cls =
    tone === 'green'
      ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200'
      : tone === 'red'
        ? 'border-rose-500/25 bg-rose-500/10 text-rose-200'
        : tone === 'orange'
          ? 'border-amber-500/25 bg-amber-500/10 text-amber-200'
          : 'border-white/10 bg-white/5 text-zinc-200';
  return <span className={cx('inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold', cls)}>{children}</span>;
};

const ticketStatusLabel = (s) => {
  const v = String(s || '').trim().toUpperCase();
  if (v === 'PENDING') return 'Mới tạo';
  if (v === 'DISPUTED') return 'Đang tranh chấp';
  if (v === 'UNDER_REVIEW') return 'Đang xử lý';
  if (v === 'RESOLVED') return 'Đã giải quyết';
  if (v === 'REJECTED') return 'Bị từ chối';
  return v || '—';
};

const ticketStatusTone = (s) => {
  const v = String(s || '').trim().toUpperCase();
  if (v === 'RESOLVED') return 'green';
  if (v === 'REJECTED') return 'red';
  if (v === 'UNDER_REVIEW' || v === 'DISPUTED') return 'orange';
  return 'gray';
};

const issueTypeLabel = (v) => {
  const s = String(v || '').trim();
  if (s === 'wrong_part') return 'Sai phụ tùng / sai món';
  if (s === 'bad_installation') return 'Lắp đặt kém / lỗi kỹ thuật';
  if (s === 'overpricing') return 'Báo giá/thu phí bất hợp lý';
  return s || '—';
};

const logActionLabel = (action) => {
  const a = String(action || '').trim().toLowerCase();
  if (a === 'created') return 'Tạo khiếu nại';
  if (a === 'evidence_added') return 'Bổ sung bằng chứng';
  if (a === 'evidence_requested') return 'Yêu cầu bổ sung bằng chứng';
  if (a === 'status_changed') return 'Cập nhật trạng thái';
  if (a === 'admin_note_updated') return 'Cập nhật ghi chú nội bộ';
  if (a === 'shop_flagged') return 'Gắn cờ cửa hàng';
  if (a === 'shop_responded') return 'Cửa hàng phản hồi';
  return String(action || '').trim().replaceAll('_', ' ') || '—';
};

class BookingStatusErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6 text-sm text-rose-200">
          <div className="text-sm font-semibold">Không thể hiển thị trạng thái đặt lịch.</div>
          <div className="mt-2 text-xs text-rose-100/80">{String(this.state.error?.message || 'LỖI_KHÔNG_XÁC_ĐỊNH')}</div>
          <div className="mt-4">
            <Link to="/" className="text-sm text-sky-300 hover:text-sky-200">
              Về trang chủ
            </Link>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const BookingStatusInner = () => {
  const { isAuthed, token, user, setAuth } = useAuth();
  const params = useParams();
  const nav = useNavigate();
  const location = useLocation();
  const id = String(params?.id || '').trim();

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const [reroute, setReroute] = useState({ busy: false, error: '' });
  const rerouteRef = useRef({ bookingId: '', done: false });
  const [kycOpen, setKycOpen] = useState(false);
  const [kycLastName, setKycLastName] = useState('');
  const [kycFirstName, setKycFirstName] = useState('');
  const [kycPhone, setKycPhone] = useState('');
  const [kycCity, setKycCity] = useState('');
  const [kycGender, setKycGender] = useState('');
  const [kycCountry, setKycCountry] = useState('');
  const [kycCountryOther, setKycCountryOther] = useState('');
  const [kycSaving, setKycSaving] = useState(false);
  const [kycError, setKycError] = useState('');
  const [pendingShopId, setPendingShopId] = useState('');
  const [acceptToastOpen, setAcceptToastOpen] = useState(false);
  const acceptToastShownRef = useRef(false);
  const lastStatusRef = useRef('');
  const reviewRedirectedRef = useRef(false);

  const [tickets, setTickets] = useState({ loading: false, error: '', items: [] });
  const [ticketDetail, setTicketDetail] = useState({ open: false, loading: false, error: '', item: null });
  const [complaintOpen, setComplaintOpen] = useState(false);
  const [complaintForm, setComplaintForm] = useState({ issueType: 'wrong_part', description: '', files: [] });
  const [complaintBusy, setComplaintBusy] = useState(false);
  const [complaintError, setComplaintError] = useState('');
  const [addEvidence, setAddEvidence] = useState({ busy: false, error: '', files: [] });

  useEffect(() => {
    if (!id) return;
    if (reviewRedirectedRef.current) return;
    const qs = new URLSearchParams(String(location?.search || ''));
    const t = String(qs.get('t') || '').trim();
    if (!t) return;
    reviewRedirectedRef.current = true;
    const base = String(getApiBaseUrl() || '').trim().replace(/\/+$/, '');
    window.location.assign(`${base}/api/bookings/review?t=${encodeURIComponent(t)}`);
  }, [id, location?.search]);

  const expiresAt = useMemo(() => parseIso(item?.expiresAt), [item]);
  const countdownMs = expiresAt ? expiresAt.getTime() - now : 0;

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (!isAuthed || !id) return;
    let alive = true;

    const load = async () => {
      try {
        const res = await getMyBooking({ token, id });
        if (!alive) return;
        setItem(res?.item || null);
        setError('');
      } catch (e) {
        if (!alive) return;
        setError(e?.message || 'REQUEST_FAILED');
        setItem(null);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    };

    load();
    const poll = window.setInterval(load, 3000);
    return () => {
      alive = false;
      window.clearInterval(poll);
    };
  }, [id, isAuthed, token]);

  const status = String(item?.status || '').toLowerCase();
  const shop = item?.shop || null;
  const snapshot = item?.snapshot || null;
  const timeSlotLabel = useMemo(() => {
    const d = item?.timeSlot ? new Date(item.timeSlot) : null;
    if (!d || Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('vi-VN', {
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, [item?.timeSlot]);
  const isExpiredClientSide = status === 'pending' && expiresAt && countdownMs <= 0;
  const shouldAutoReroute = status === 'rejected' || status === 'expired' || isExpiredClientSide;
  const autoReason =
    status === 'rejected'
      ? String(item?.rejectedReason || '').trim()
      : status === 'expired' || isExpiredClientSide
        ? 'Shop không phản hồi trong thời gian quy định.'
        : '';

  useEffect(() => {
    if (!status) return;
    const prev = String(lastStatusRef.current || '');
    if (prev && prev !== 'accepted' && status === 'accepted' && !acceptToastShownRef.current) {
      acceptToastShownRef.current = true;
      setAcceptToastOpen(true);
      const t = window.setTimeout(() => setAcceptToastOpen(false), 4500);
      return () => window.clearTimeout(t);
    }
    lastStatusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (!isAuthed || !token) return;
    if (!id) return;
    if (String(item?.status || '').toLowerCase() !== 'completed') {
      setTickets((p) => (p.items?.length ? { ...p, loading: false, error: '' } : p));
      return;
    }
    let alive = true;
    const loadTickets = async () => {
      setTickets((p) => ({ ...p, loading: true, error: '' }));
      try {
        const data = await apiFetch(`/api/tickets/my?bookingId=${encodeURIComponent(id)}`, { token });
        if (!alive) return;
        setTickets({ loading: false, error: '', items: Array.isArray(data?.items) ? data.items : [] });
      } catch (e) {
        if (!alive) return;
        setTickets({ loading: false, error: String(e?.message || 'Không thể tải danh sách khiếu nại.'), items: [] });
      }
    };
    loadTickets();
    return () => {
      alive = false;
    };
  }, [id, isAuthed, item?.status, token]);

  const openTicketDetail = async (ticketId) => {
    if (!token) return;
    const idStr = String(ticketId || '').trim();
    if (!idStr) return;
    setTicketDetail({ open: true, loading: true, error: '', item: null });
    try {
      const data = await apiFetch(`/api/tickets/${encodeURIComponent(idStr)}`, { token });
      setTicketDetail({ open: true, loading: false, error: '', item: data?.item || null });
    } catch (e) {
      setTicketDetail({ open: true, loading: false, error: String(e?.message || 'Không thể tải chi tiết khiếu nại.'), item: null });
    }
  };

  const submitComplaint = async () => {
    if (!token || complaintBusy) return;
    if (String(item?.status || '').toLowerCase() !== 'completed') {
      setComplaintError('Chỉ có thể tạo khiếu nại khi lịch đặt đã hoàn thành.');
      return;
    }
    const issueType = String(complaintForm.issueType || '').trim();
    const description = String(complaintForm.description || '').trim();
    const files = Array.isArray(complaintForm.files) ? complaintForm.files : [];
    if (!issueType) {
      setComplaintError('Vui lòng chọn loại vấn đề.');
      return;
    }
    if (description.length < 10) {
      setComplaintError('Vui lòng mô tả chi tiết hơn (ít nhất 10 ký tự).');
      return;
    }
    if (!files.length) {
      setComplaintError('Vui lòng tải lên ít nhất 1 ảnh hoặc video làm bằng chứng.');
      return;
    }

    setComplaintBusy(true);
    setComplaintError('');
    try {
      const formData = new FormData();
      formData.append('bookingId', String(id));
      formData.append('issueType', issueType);
      formData.append('description', description);
      for (const f of files.slice(0, 8)) {
        if (f) formData.append('files', f);
      }
      const data = await apiFetchForm('/api/tickets', { token, method: 'POST', formData });
      const created = data?.item || null;
      setComplaintOpen(false);
      setComplaintForm({ issueType: 'wrong_part', description: '', files: [] });
      setTickets((p) => ({ ...p, items: created ? [created, ...(Array.isArray(p.items) ? p.items : [])] : p.items }));
    } catch (e) {
      const code = String(e?.message || '').trim();
      if (code === 'BOOKING_NOT_COMPLETED') setComplaintError('Booking chưa ở trạng thái hoàn thành.');
      else if (code === 'EVIDENCE_REQUIRED') setComplaintError('Thiếu bằng chứng. Vui lòng tải ít nhất 1 ảnh/video.');
      else if (code === 'TICKET_ALREADY_ACTIVE') setComplaintError('Booking này đang có khiếu nại đang xử lý.');
      else setComplaintError(code || 'TẠO_KHIẾU_NẠI_THẤT_BẠI');
    } finally {
      setComplaintBusy(false);
    }
  };

  const submitMoreEvidence = async ({ ticketId }) => {
    if (!token || addEvidence.busy) return;
    const files = Array.isArray(addEvidence.files) ? addEvidence.files : [];
    if (!files.length) {
      setAddEvidence((p) => ({ ...p, error: 'Vui lòng chọn ít nhất 1 ảnh/video.' }));
      return;
    }
    setAddEvidence((p) => ({ ...p, busy: true, error: '' }));
    try {
      const formData = new FormData();
      for (const f of files.slice(0, 8)) {
        if (f) formData.append('files', f);
      }
      await apiFetchForm(`/api/tickets/${encodeURIComponent(String(ticketId))}/evidence`, { token, method: 'POST', formData });
      setAddEvidence({ busy: false, error: '', files: [] });
      const data = await apiFetch(`/api/tickets/my?bookingId=${encodeURIComponent(id)}`, { token });
      setTickets({ loading: false, error: '', items: Array.isArray(data?.items) ? data.items : [] });
      if (ticketDetail.open && ticketDetail.item?._id) {
        const refreshed = await apiFetch(`/api/tickets/${encodeURIComponent(String(ticketDetail.item._id))}`, { token });
        setTicketDetail((p) => ({ ...p, item: refreshed?.item || p.item }));
      }
    } catch (e) {
      setAddEvidence((p) => ({ ...p, busy: false, error: String(e?.message || 'Không thể gửi bằng chứng.') }));
    }
  };

  const needsKyc = useMemo(() => {
    const n = String(user?.name || '').trim();
    const p = String(user?.phone || '').trim();
    const c = String(user?.city || '').trim();
    const g = String(user?.gender || '').trim();
    const country = String(user?.country || '').trim();
    return !n || !p || !c || !g || !country;
  }, [user?.city, user?.country, user?.gender, user?.name, user?.phone]);

  const saveKyc = async () => {
    if (!token || kycSaving) return;
    const name = `${String(kycLastName || '').trim()} ${String(kycFirstName || '').trim()}`.trim();
    const phone = String(kycPhone || '').trim();
    const city = String(kycCity || '').trim();
    const gender = String(kycGender || '').trim();
    const country =
      String(kycCountry || '').trim() === KYC_COUNTRY_OTHER ? String(kycCountryOther || '').trim() : String(kycCountry || '').trim();
    if (name.length < 2) {
      setKycError('Vui lòng nhập họ và tên (ít nhất 2 ký tự).');
      return;
    }
    if (phone.length < 8 || !/^[0-9+()\s.-]+$/.test(phone)) {
      setKycError('Vui lòng nhập số điện thoại hợp lệ.');
      return;
    }
    if (city.length < 2) {
      setKycError('Vui lòng nhập thành phố/tỉnh.');
      return;
    }
    if (!['male', 'female', 'other'].includes(String(gender || '').toLowerCase())) {
      setKycError('Vui lòng chọn giới tính.');
      return;
    }
    if (country.length < 2) {
      setKycError('Vui lòng chọn quốc gia.');
      return;
    }

    setKycSaving(true);
    setKycError('');
    try {
      const data = await updateMe({ token, payload: { name, phone, city, gender, country } });
      const nextUser = data?.user || null;
      if (nextUser) setAuth({ token, user: nextUser });
      setKycOpen(false);
      const nextShopId = String(pendingShopId || '').trim();
      if (nextShopId) {
        setPendingShopId('');
        handleBookOtherShop(nextShopId);
      }
    } catch (e) {
      setKycError(String(e?.message || 'UPDATE_FAILED'));
    } finally {
      setKycSaving(false);
    }
  };

  const [alternativeShops, setAlternativeShops] = useState([]);
  const [fetchingShops, setFetchingShops] = useState(false);

  useEffect(() => {
    if (!isAuthed || !token) return;
    if (!shouldAutoReroute) return;

    let alive = true;
    const fetchShops = async () => {
      try {
        setFetchingShops(true);
        const currentShopId = String(shop?._id || '');
        const shops = await listPartneredShops();
        if (!alive) return;
        const filteredShops = (Array.isArray(shops) ? shops : []).filter(
          (s) => String(s?._id || '') && String(s?._id || '') !== currentShopId
        );
        setAlternativeShops(filteredShops);
      } catch (e) {
        console.error('Failed to fetch alternative shops:', e);
      } finally {
        if (alive) setFetchingShops(false);
      }
    };

    fetchShops();
    return () => {
      alive = false;
    };
  }, [isAuthed, token, shop?._id, shouldAutoReroute]);

  const handleBookOtherShop = async (nextShopId) => {
    if (reroute.busy) return;
    if (needsKyc) {
      setPendingShopId(String(nextShopId || '').trim());
      const rawName = String(user?.name || '').trim();
      const parts = rawName.split(/\s+/).filter(Boolean);
      const first = parts.length ? parts[parts.length - 1] : '';
      const last = parts.length > 1 ? parts.slice(0, -1).join(' ') : '';
      setKycLastName(last);
      setKycFirstName(first);
      setKycPhone(String(user?.phone || '').trim());
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
      setKycError('');
      setKycOpen(true);
      return;
    }
    try {
      setReroute({ busy: true, error: '' });
      const buildId = String(item?.buildId || '').trim();
      const timeSlot = item?.timeSlot;
      if (!buildId || !timeSlot) {
        setReroute({ busy: false, error: 'MISSING_BOOKING_DATA' });
        return;
      }

      const res = await createBooking({
        token,
        buildId,
        shopId: String(nextShopId),
        timeSlot,
        customerName: String(user?.name || '').trim(),
        customerPhone: String(user?.phone || '').trim(),
        customerCity: String(user?.city || '').trim(),
        customerGender: String(user?.gender || '').trim(),
        customerCountry: String(user?.country || '').trim()
      });
      const nextId = String(res?.item?._id || '').trim();
      if (!nextId) {
        setReroute({ busy: false, error: 'REROUTE_FAILED' });
        return;
      }
      nav(`/booking/${encodeURIComponent(nextId)}`, { replace: true });
    } catch (e) {
      const msg = String(e?.message || 'REROUTE_FAILED');
      if (msg === 'SHOP_CLOSED_TODAY') {
        setReroute({ busy: false, error: 'Hôm nay shop không làm việc. Vui lòng chọn ngày khác.' });
      } else if (msg === 'SHOP_FULL') {
        setReroute({ busy: false, error: 'Shop đã hết slot tại ngày bạn chọn. Vui lòng chọn ngày khác hoặc shop khác.' });
      } else {
        setReroute({ busy: false, error: msg });
      }
    }
  };

  if (!isAuthed) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6 text-sm text-zinc-200">
        Vui lòng <Link className="text-sky-300 hover:text-sky-200" to="/login">đăng nhập</Link> để xem trạng thái đặt lịch.
      </div>
    );
  }

  if (loading) return <div className="text-sm text-zinc-500">Đang tải…</div>;

  if (!item) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6">
        <div className="text-sm font-semibold text-white/80">Không tìm thấy lịch đặt</div>
        <div className="mt-2 text-sm text-zinc-500">{error || 'KHÔNG_TÌM_THẤY'}</div>
        <div className="mt-4">
          <Link to="/" className="text-sm text-sky-300 hover:text-sky-200">
            Về trang chủ
          </Link>
        </div>
      </div>
    );
  }

  const tone =
    status === 'completed'
      ? 'green'
      : status === 'accepted'
        ? 'green'
        : status === 'in_progress'
          ? 'orange'
          : status === 'rejected'
            ? 'red'
            : status === 'expired'
              ? 'orange'
              : 'gray';
  const statusLabel =
    status === 'completed'
      ? 'Đã hoàn thành'
      : status === 'in_progress'
        ? 'Đang thực hiện'
        : status === 'accepted'
          ? 'Đã chấp nhận'
          : status === 'rejected'
            ? 'Đã từ chối'
            : status === 'expired'
              ? 'Đã hết hạn'
              : 'Chờ xác nhận';
  const headline =
    status === 'completed'
      ? 'Dịch vụ đã hoàn thành'
      : status === 'in_progress'
        ? 'Shop đang thực hiện'
        : status === 'accepted'
          ? 'Đặt lịch đã được xác nhận'
          : status === 'pending'
            ? 'Đang chờ cửa hàng phản hồi'
            : status === 'rejected'
              ? 'Cửa hàng đã từ chối'
              : 'Yêu cầu đã hết hạn';
  const subline =
    status === 'completed'
      ? 'Nếu có vấn đề với dịch vụ đã thực hiện, bạn có thể tạo khiếu nại kèm bằng chứng.'
      : status === 'in_progress'
        ? 'Cửa hàng đang thực hiện dịch vụ. Bạn có thể theo dõi trạng thái tại đây.'
        : status === 'accepted'
          ? 'Cửa hàng sẽ nhanh chóng gọi tới bạn để xác nhận.'
          : status === 'pending'
            ? 'Hãy giữ máy. Khi cửa hàng xác nhận, bạn sẽ thấy thông báo thành công.'
            : status === 'rejected'
              ? 'Bạn có thể chọn một cửa hàng khác để đặt lịch ngay.'
              : 'Bạn có thể chọn một cửa hàng khác để đặt lịch lại.';
  const heroBorder =
    status === 'completed' || status === 'accepted'
      ? 'from-emerald-500/25 via-cyan-500/10 to-emerald-500/25'
      : status === 'in_progress'
        ? 'from-amber-500/25 via-orange-500/10 to-amber-500/25'
      : status === 'pending'
        ? 'from-sky-500/25 via-cyan-500/10 to-sky-500/25'
        : status === 'rejected'
          ? 'from-rose-500/25 via-fuchsia-500/10 to-rose-500/25'
          : 'from-amber-500/25 via-orange-500/10 to-amber-500/25';
  const heroBadgeCls =
    status === 'completed' || status === 'accepted'
      ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100'
      : status === 'in_progress'
        ? 'border-amber-400/25 bg-amber-500/10 text-amber-100'
      : status === 'pending'
        ? 'border-sky-400/25 bg-sky-500/10 text-sky-100'
        : status === 'rejected'
          ? 'border-rose-400/25 bg-rose-500/10 text-rose-100'
          : 'border-amber-400/25 bg-amber-500/10 text-amber-100';

  return (
    <div className="relative mx-auto w-full max-w-4xl space-y-5">
      <div className="pointer-events-none absolute left-1/2 top-[-180px] h-[420px] w-[860px] -translate-x-1/2 rounded-full bg-gradient-to-r from-sky-500/10 via-cyan-500/5 to-emerald-500/10 blur-3xl" />
      {acceptToastOpen ? (
        <div className="fixed inset-x-0 top-4 z-[95] flex justify-center px-4">
          <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-emerald-400/25 bg-emerald-500/10 shadow-2xl shadow-black/40 backdrop-blur-2xl">
            <div className="flex items-start gap-3 px-5 py-4">
              <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-400/25 bg-emerald-500/15 text-emerald-100">
                ✓
              </div>
              <div className="min-w-0">
                <div className="text-sm font-black text-emerald-100">Đặt lịch thành công!</div>
                <div className="mt-1 text-sm text-emerald-100/80">Cửa hàng sẽ nhanh chóng gọi tới bạn để xác nhận.</div>
              </div>
              <button
                type="button"
                className="ml-auto rounded-xl border border-emerald-400/15 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100/90 hover:bg-emerald-500/15"
                onClick={() => setAcceptToastOpen(false)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/25 p-6 shadow-[0_40px_120px_-80px_rgba(0,0,0,0.95)] backdrop-blur-2xl">
        <div className={cx('pointer-events-none absolute -inset-1 bg-gradient-to-r blur-2xl', heroBorder)} />
        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <Link to="/" className="text-xs font-semibold text-sky-300/90 hover:text-sky-200">
                ← Về trang chủ
              </Link>
              <div className="mt-2 text-2xl font-black tracking-tight text-white">{headline}</div>
              <div className="mt-1 text-sm text-white/70">{subline}</div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className={cx('inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold', heroBadgeCls)}>
                  {statusLabel}
                </span>
                {status === 'pending' ? (
                  <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-semibold text-white/85">
                    Hết hạn trong {msToClock(countdownMs)}
                  </span>
                ) : null}
                {shop?.shopName ? (
                  <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-semibold text-white/75">
                    {shop.shopName}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="w-full max-w-[360px]">
              <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="text-[11px] font-semibold text-white/55">Mã đơn</div>
                    <div className="mt-1 font-mono text-sm font-black text-white/90">#{String(item?._id || '').slice(-10)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-white/55">Ngày giờ</div>
                    <div className="mt-1 text-sm font-semibold text-white/90">{timeSlotLabel || '—'}</div>
                  </div>
                </div>
                <div className="h-px bg-white/10" />
                <div className="grid gap-2 text-sm text-white/75">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-white/55">Địa chỉ</div>
                    <div className="text-right font-semibold text-white/85">{shop?.address || '—'}</div>
                  </div>
                  {shop?.phone ? (
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-white/55">SĐT cửa hàng</div>
                      <div className="text-right font-semibold text-white/85">{shop.phone}</div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="rounded-3xl border border-white/10 bg-black/20 p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-semibold text-white/60">Bản lưu cấu hình</div>
            {snapshot?.buildName || snapshot?.carName ? (
              <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] font-semibold text-white/70">
                {snapshot?.buildName || snapshot?.carName}
              </div>
            ) : null}
          </div>
          <div className="mt-2 flex items-start gap-4">
            <div className="h-20 w-28 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
              {resolveAssetUrl(snapshot?.previewImageUrl) ? (
                <img alt="" src={resolveAssetUrl(snapshot?.previewImageUrl)} className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white/90">{snapshot?.buildName || snapshot?.carName || 'Cấu hình tùy chỉnh'}</div>
              <div className="mt-1 text-xs text-white/55">Mã cấu hình: {String(item?.buildId || '').slice(-10)}</div>
              <div className="mt-2 text-xs font-semibold text-white/60">Tổng cộng</div>
              <div className="text-sm font-bold text-white">{formatVnd(snapshot?.totalPrice)}</div>
            </div>
          </div>

          {Array.isArray(snapshot?.parts) && snapshot.parts.length ? (
            <div className="mt-4">
              <div className="text-xs font-semibold text-white/60">Phụ tùng</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {snapshot.parts.slice(0, 12).map((p, idx) => (
                  <div key={`${p?._id || idx}`} className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-semibold text-white/85">
                    {String(p?.name || p?.type || '').trim() || 'Phụ tùng'}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/20 p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-semibold text-white/60">Trạng thái</div>
            <Badge tone={tone}>{statusLabel}</Badge>
          </div>

          {status === 'pending' ? (
            <div className="mt-3 rounded-2xl border border-sky-400/15 bg-sky-500/10 px-4 py-3 text-sm text-sky-100/90">
              Đang chờ cửa hàng phản hồi. Nếu họ không phản hồi trong vòng 10 phút, yêu cầu sẽ tự động hết hạn.
            </div>
          ) : status === 'in_progress' ? (
            <div className="mt-3 rounded-2xl border border-amber-400/15 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
              Shop đang thực hiện dịch vụ. Bạn có thể quay lại trang này để theo dõi cập nhật.
            </div>
          ) : status === 'completed' ? (
            <div className="mt-3 rounded-2xl border border-emerald-400/15 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100/90">
              Dịch vụ đã hoàn thành. Nếu có vấn đề, bạn có thể gửi khiếu nại kèm bằng chứng để admin xử lý.
            </div>
          ) : status === 'accepted' ? (
            <div className="mt-3 rounded-2xl border border-emerald-400/15 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100/90">
              Đặt lịch đã được xác nhận thành công. Cửa hàng sẽ nhanh chóng gọi tới bạn để xác nhận.
              <div className="mt-2 text-xs text-emerald-100/80">Mẹo: hãy để ý cuộc gọi lạ trong ít phút tới.</div>
            </div>
          ) : status === 'rejected' ? (
            <div className="mt-2 space-y-3 text-sm text-white/75">
              <div>Cửa hàng đã từ chối yêu cầu. Vui lòng chọn cửa hàng khác.</div>
              {autoReason ? (
                <div className="rounded-2xl border border-rose-400/15 bg-rose-500/10 px-4 py-3">
                  <div className="text-xs font-semibold text-white/70">Lý do</div>
                  <div className="mt-1 whitespace-pre-wrap text-sm font-semibold text-white/90">{autoReason}</div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-2 space-y-3 text-sm text-white/75">
              <div>Cửa hàng không phản hồi kịp thời. Vui lòng chọn cửa hàng khác.</div>
              {autoReason ? (
                <div className="rounded-2xl border border-amber-400/15 bg-amber-500/10 px-4 py-3">
                  <div className="text-xs font-semibold text-white/70">Lý do</div>
                  <div className="mt-1 whitespace-pre-wrap text-sm font-semibold text-white/90">{autoReason}</div>
                </div>
              ) : null}
            </div>
          )}

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs font-semibold text-white/70">Khiếu nại</div>
            <div className="mt-1 text-xs text-white/55">Chỉ gửi khiếu nại sau khi dịch vụ hoàn thành.</div>
            <button
              type="button"
              onClick={() => {
                setComplaintError('');
                setComplaintOpen(true);
              }}
              disabled={
                status !== 'completed' ||
                Boolean(tickets.items?.some((t) => ['PENDING', 'DISPUTED', 'UNDER_REVIEW'].includes(String(t?.status || '').toUpperCase())))
              }
              className="mt-3 inline-flex w-full items-center justify-center rounded-2xl bg-sky-400 px-4 py-2.5 text-sm font-black text-zinc-950 hover:bg-sky-300 disabled:opacity-60"
            >
              Nhập khiếu nại
            </button>
          </div>

          {shouldAutoReroute ? (
            <div className="mt-5 border-t border-white/10 pt-5">
              <div className="text-xs font-semibold text-white/60 mb-3">Các cửa hàng khác có sẵn</div>
              {fetchingShops ? (
                <div className="text-sm text-zinc-500">Đang tải danh sách cửa hàng…</div>
              ) : alternativeShops.length === 0 ? (
                <div className="text-sm text-zinc-500">Không có cửa hàng nào khác vào lúc này.</div>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {alternativeShops.map((s) => (
                    <div key={s._id} className="flex flex-col gap-2 rounded-2xl border border-white/5 bg-white/5 p-3">
                      <div>
                        <div className="font-semibold text-white/90">{s.shopName || 'Cửa hàng không xác định'}</div>
                        <div className="text-xs text-white/50">{s.address || 'Không có địa chỉ'}</div>
                      </div>
                      <button
                        onClick={() => handleBookOtherShop(s._id)}
                        disabled={reroute.busy}
                        className={cx(
                          'inline-flex items-center justify-center rounded-xl px-3 py-2 text-xs font-bold text-zinc-950 transition-colors',
                          reroute.busy ? 'cursor-not-allowed bg-sky-400/50' : 'bg-sky-400 hover:bg-sky-300'
                        )}
                      >
                        Đặt lịch tại đây
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {reroute.busy ? (
            <div className="mt-4 rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm font-semibold text-sky-100">
              Đang chuyển sang cửa hàng khác…
            </div>
          ) : reroute.error ? (
            <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              Không thể chuyển cửa hàng ({reroute.error}).
            </div>
          ) : null}

          <div className="mt-4 space-y-2">
            <Link
              to="/"
              className="inline-flex w-full items-center justify-center rounded-2xl bg-sky-400 px-4 py-3 text-sm font-bold text-zinc-950 hover:bg-sky-300"
            >
              Quay lại trang chủ
            </Link>
            <Link
              to={`/builds/${encodeURIComponent(String(item?.buildId || ''))}`}
              className="inline-flex w-full items-center justify-center rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white/90 hover:bg-black/30"
            >
              Xem cấu hình
            </Link>
          </div>
        </div>
      </div>

      {status === 'completed' ? (
        <div className="rounded-3xl border border-white/10 bg-black/20 p-6">
          <div>
            <div className="text-sm font-black text-white/90">Khiếu nại & Tranh chấp</div>
            <div className="mt-1 text-xs text-white/60">Bạn cần cung cấp ít nhất 1 ảnh/video làm bằng chứng.</div>
          </div>

          {tickets.error ? (
            <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{tickets.error}</div>
          ) : null}
          {tickets.loading ? <div className="mt-3 text-sm text-zinc-500">Đang tải khiếu nại…</div> : null}

          {!tickets.loading && Array.isArray(tickets.items) && tickets.items.length ? (
            <div className="mt-4 space-y-3">
              {tickets.items.slice(0, 5).map((t) => (
                <div key={t._id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white/60">Mã khiếu nại</div>
                      <div className="mt-1 text-sm font-black text-white/90">{String(t.ticketId || '').trim() || '—'}</div>
                      <div className="mt-2 text-xs text-white/70">Loại: {issueTypeLabel(t.issueType)}</div>
                      {t.needsMoreEvidence ? (
                        <div className="mt-2 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100">
                          Admin yêu cầu bổ sung bằng chứng{t.evidenceRequestNote ? `: ${String(t.evidenceRequestNote)}` : '.'}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge tone={ticketStatusTone(t.status)}>{ticketStatusLabel(t.status)}</Badge>
                      <button
                        type="button"
                        onClick={() => openTicketDetail(t._id)}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white/85 hover:bg-white/10"
                      >
                        Xem
                      </button>
                    </div>
                  </div>

                  {t.needsMoreEvidence && !['RESOLVED', 'REJECTED'].includes(String(t.status || '').toUpperCase()) ? (
                    <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3">
                      <div className="text-xs font-semibold text-white/70">Bổ sung bằng chứng</div>
                      {addEvidence.error ? <div className="mt-2 text-xs text-rose-200">{addEvidence.error}</div> : null}
                      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <input
                          type="file"
                          multiple
                          accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
                          onChange={(e) => {
                            const arr = Array.from(e.target.files || []);
                            setAddEvidence((p) => ({ ...p, files: arr, error: '' }));
                          }}
                          className="block w-full text-xs text-zinc-300 file:mr-3 file:rounded-xl file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:font-bold file:text-zinc-100 hover:file:bg-white/15"
                        />
                        <button
                          type="button"
                          disabled={addEvidence.busy}
                          onClick={() => submitMoreEvidence({ ticketId: t._id })}
                          className="rounded-xl bg-emerald-400 px-4 py-2 text-xs font-black text-zinc-950 hover:bg-emerald-300 disabled:opacity-60"
                        >
                          {addEvidence.busy ? 'Đang gửi…' : 'Gửi bằng chứng'}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : !tickets.loading ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-400">
              Chưa có khiếu nại nào cho booking này.
            </div>
          ) : null}
        </div>
      ) : null}

      {ticketDetail.open ? (
        <div className="fixed inset-0 z-[92]">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setTicketDetail((p) => ({ ...p, open: false }))} />
          <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-[820px] -translate-x-1/2 -translate-y-1/2">
            <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-zinc-950/80 shadow-[0_40px_120px_-60px_rgba(0,0,0,0.95)] backdrop-blur-2xl">
              <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
                <div>
                  <div className="text-sm font-black text-zinc-50">Chi tiết khiếu nại</div>
                  <div className="mt-1 text-xs text-zinc-400">Kèm bằng chứng, lịch sử xử lý.</div>
                </div>
                <button
                  type="button"
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10"
                  onClick={() => setTicketDetail((p) => ({ ...p, open: false }))}
                >
                  Đóng
                </button>
              </div>
              <div className="max-h-[72vh] overflow-auto px-5 py-4">
                {ticketDetail.loading ? <div className="text-sm text-zinc-400">Đang tải…</div> : null}
                {ticketDetail.error ? (
                  <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{ticketDetail.error}</div>
                ) : null}
                {ticketDetail.item ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-semibold text-zinc-400">Mã khiếu nại</div>
                        <div className="mt-1 text-sm font-black text-zinc-100">{ticketDetail.item.ticketId || '—'}</div>
                        <div className="mt-1 text-xs text-zinc-400">Loại: {issueTypeLabel(ticketDetail.item.issueType)}</div>
                      </div>
                      <Badge tone={ticketStatusTone(ticketDetail.item.status)}>{ticketStatusLabel(ticketDetail.item.status)}</Badge>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-xs font-semibold text-zinc-400">Mô tả</div>
                      <div className="mt-2 whitespace-pre-wrap text-sm text-zinc-200">{ticketDetail.item.description || '—'}</div>
                    </div>
                    {ticketDetail.item.needsMoreEvidence ? (
                      <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                        Admin yêu cầu bổ sung bằng chứng{ticketDetail.item.evidenceRequestNote ? `: ${String(ticketDetail.item.evidenceRequestNote)}` : '.'}
                      </div>
                    ) : null}

                    {Array.isArray(ticketDetail.item.media) && ticketDetail.item.media.length ? (
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="text-xs font-semibold text-zinc-400">Bằng chứng</div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {ticketDetail.item.media.slice(0, 12).map((m) => {
                            const url = resolveAssetUrl(m?.fileUrl);
                            const isImage = String(m?.fileType || '') === 'image';
                            const isVideo = String(m?.fileType || '') === 'video';
                            const isVideoFile = /\.mp4$|\.webm$|\.mov$/i.test(url);
                            return (
                              <div key={m._id} className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                                {isImage && url ? <img alt="" src={url} className="h-48 w-full object-cover" /> : null}
                                {isVideo && url && isVideoFile ? <video src={url} controls className="h-48 w-full object-cover" /> : null}
                                {isVideo && url && !isVideoFile ? (
                                  <div className="p-4">
                                    <a href={url} target="_blank" rel="noreferrer" className="text-sm font-bold text-sky-300 hover:text-sky-200">
                                      Mở link video
                                    </a>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    {Array.isArray(ticketDetail.item.logs) && ticketDetail.item.logs.length ? (
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="text-xs font-semibold text-zinc-400">Lịch sử</div>
                        <div className="mt-3 space-y-2">
                          {ticketDetail.item.logs.slice(0, 12).map((l) => (
                            <div key={l._id} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                              <div className="flex items-center justify-between gap-2 text-xs text-zinc-400">
                                <div className="font-semibold text-zinc-300">{logActionLabel(l.action)}</div>
                                <div>{l.createdAt ? new Date(l.createdAt).toLocaleString('vi-VN') : '—'}</div>
                              </div>
                              {l.note ? <div className="mt-1 whitespace-pre-wrap text-xs text-zinc-200">{l.note}</div> : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {complaintOpen ? (
        <div className="fixed inset-0 z-[91]">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => (complaintBusy ? null : setComplaintOpen(false))} />
          <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-[640px] -translate-x-1/2 -translate-y-1/2">
            <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-zinc-950/80 shadow-[0_40px_120px_-60px_rgba(0,0,0,0.95)] backdrop-blur-2xl">
              <div className="flex items-start justify-between gap-3 border-b border-white/10 px-6 py-5">
                <div>
                  <div className="text-lg font-black text-zinc-50">Tạo khiếu nại</div>
                  <div className="mt-1 text-sm text-zinc-300">Mô tả vấn đề và đính kèm bằng chứng.</div>
                </div>
                <button
                  type="button"
                  onClick={() => (complaintBusy ? null : setComplaintOpen(false))}
                  className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10 disabled:opacity-60"
                  disabled={complaintBusy}
                >
                  Đóng
                </button>
              </div>
              <div className="space-y-4 px-6 py-5">
                {complaintError ? (
                  <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{complaintError}</div>
                ) : null}
                <label className="block space-y-1">
                  <div className="text-xs font-semibold text-zinc-400">Loại vấn đề</div>
                  <select
                    value={complaintForm.issueType}
                    onChange={(e) => setComplaintForm((p) => ({ ...p, issueType: e.target.value }))}
                    disabled={complaintBusy}
                    style={{ colorScheme: 'dark' }}
                    className="w-full rounded-2xl border border-white/15 bg-zinc-950/70 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-sky-400/40"
                  >
                    <option value="wrong_part">Sai phụ tùng / sai món</option>
                    <option value="bad_installation">Lắp đặt kém / lỗi kỹ thuật</option>
                    <option value="overpricing">Báo giá/thu phí bất hợp lý</option>
                  </select>
                </label>
                <label className="block space-y-1">
                  <div className="text-xs font-semibold text-zinc-400">Mô tả</div>
                  <textarea
                    value={complaintForm.description}
                    onChange={(e) => setComplaintForm((p) => ({ ...p, description: e.target.value }))}
                    rows={6}
                    disabled={complaintBusy}
                    className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-sky-400/40"
                    placeholder="Ví dụ: shop lắp sai loại phuộc…"
                  />
                </label>
                <label className="block space-y-1">
                  <div className="text-xs font-semibold text-zinc-400">Bằng chứng (ảnh/video)</div>
                  <input
                    type="file"
                    multiple
                    accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
                    disabled={complaintBusy}
                    onChange={(e) => {
                      const arr = Array.from(e.target.files || []);
                      setComplaintForm((p) => ({ ...p, files: arr }));
                      setComplaintError('');
                    }}
                    className="block w-full text-xs text-zinc-300 file:mr-3 file:rounded-xl file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:font-bold file:text-zinc-100 hover:file:bg-white/15"
                  />
                  {Array.isArray(complaintForm.files) && complaintForm.files.length ? (
                    <div className="text-xs text-zinc-400">Đã chọn: {complaintForm.files.length} tệp</div>
                  ) : null}
                </label>
                <button
                  type="button"
                  disabled={complaintBusy}
                  onClick={submitComplaint}
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-sky-400 px-4 py-3 text-sm font-black text-zinc-950 hover:bg-sky-300 disabled:opacity-60"
                >
                  {complaintBusy ? 'Đang gửi…' : 'Gửi khiếu nại'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {kycOpen ? (
        <div className="fixed inset-0 z-[90]">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-[520px] -translate-x-1/2 -translate-y-1/2">
            <div className="relative">
              <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-sky-500/20 via-cyan-500/10 to-sky-500/20 blur-2xl" />
              <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-white/10 shadow-[0_1px_2px_rgba(0,0,0,0.35),0_40px_120px_-60px_rgba(0,0,0,0.95)] backdrop-blur-2xl">
                <div className="border-b border-white/10 px-6 py-5">
                  <div className="text-[22px] font-black leading-tight tracking-tight text-zinc-50">Bổ sung KYC để đặt lịch</div>
                  <div className="mt-1 text-sm text-zinc-200/80">Vui lòng nhập thông tin để shop liên hệ xác nhận.</div>
                </div>

                <div className="space-y-4 px-6 py-5">
              {kycError ? (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {kycError}
                </div>
              ) : null}
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
                <div className="text-sm font-medium text-zinc-200">Số điện thoại</div>
                <input
                  value={kycPhone}
                  onChange={(e) => setKycPhone(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-zinc-300/70 bg-white/90 px-3 py-2.5 text-[16px] text-zinc-900 shadow-[0_1px_0_rgba(255,255,255,0.06)] outline-none placeholder:text-zinc-500 focus:border-sky-500/70 focus:ring-4 focus:ring-sky-400/20"
                  placeholder="VD: 0901234567"
                  disabled={kycSaving}
                  inputMode="tel"
                />
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
                  <option value="other">Khác</option>
                </select>
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

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setPendingShopId('');
                    setKycOpen(false);
                  }}
                  disabled={kycSaving}
                  className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-zinc-100 shadow-[0_1px_0_rgba(255,255,255,0.06)] transition hover:bg-white/15 disabled:opacity-60"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={saveKyc}
                  disabled={kycSaving}
                  className="rounded-xl bg-sky-500 px-4 py-3 text-sm font-semibold text-zinc-950 shadow-[0_10px_30px_rgba(14,165,233,0.20)] transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-zinc-300 disabled:shadow-none"
                >
                  {kycSaving ? 'Đang lưu…' : 'Lưu & đặt lịch'}
                </button>
              </div>
            </div>
          </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

const BookingStatus = () => (
  <BookingStatusErrorBoundary>
    <BookingStatusInner />
  </BookingStatusErrorBoundary>
);

export default BookingStatus;
