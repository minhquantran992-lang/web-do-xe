import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { apiFetch, apiFetchForm, getApiBaseUrl } from '../services/api/client.js';
import { useI18n } from '../services/i18n.jsx';
import { listPartneredShops } from '../services/api/vendors.js';
import ChatThreadModal from '../components/ChatThreadModal.jsx';
import { useAuth } from '../services/auth/AuthContext.jsx';

const resolveAssetUrl = (url) => {
  const base = getApiBaseUrl();
  const u = String(url || '').trim();
  if (!u) return '';
  if (u.startsWith('data:') || u.startsWith('blob:')) return u;
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  if (u.startsWith('/')) return `${base}${u}`;
  return `${base}/${u}`;
};

const fmtMoney = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  try {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${Math.round(n)} ₫`;
  }
};

const fmtDate = (iso) => {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
};

const Skeleton = () => (
  <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/40">
    <div className="aspect-[16/10] w-full animate-pulse bg-zinc-900" />
    <div className="space-y-2 p-4">
      <div className="h-4 w-2/3 animate-pulse rounded bg-zinc-800" />
      <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-900" />
    </div>
  </div>
);

const RatingBadge = ({ value }) => {
  const n = Math.max(0, Math.min(5, Number(value) || 0));
  return (
    <span className="inline-flex items-center rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[11px] font-semibold text-amber-200">
      ★ {n ? n.toFixed(1) : '—'}
    </span>
  );
};

const Chip = ({ children }) => (
  <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-zinc-200">
    {children}
  </span>
);

const StorefrontTab = ({ active, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-2xl border px-4 py-2 text-xs font-black ${
      active ? 'border-sky-400/30 bg-sky-500/15 text-sky-100' : 'border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10'
    }`}
  >
    {label}
  </button>
);

const parseBookingId = (raw) => {
  const s = String(raw || '').trim();
  if (!s) return '';
  try {
    const m = s.match(/\/booking\/([^/?#]+)/i);
    if (m && m[1]) return String(m[1]).trim();
  } catch {}
  return s;
};

const Marketplace = () => {
  const { t } = useI18n();
  const { isAuthed, token, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const [buyStep, setBuyStep] = useState('product');
  const [buyProduct, setBuyProduct] = useState(null);
  const [checkoutItems, setCheckoutItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [buyQty, setBuyQty] = useState(1);
  const [kyc, setKyc] = useState({ name: '', phone: '', address: '', note: '' });
  const [buyBusy, setBuyBusy] = useState(false);
  const [buyError, setBuyError] = useState('');
  const [complaintOpen, setComplaintOpen] = useState(false);
  const [complaintBusy, setComplaintBusy] = useState(false);
  const [complaintError, setComplaintError] = useState('');
  const [complaintForm, setComplaintForm] = useState({ bookingId: '', issueType: 'wrong_part', description: '', files: [] });

  const vendorId = useMemo(() => {
    const fromPath = String(params?.vendorId || '').trim();
    if (fromPath) return fromPath;
    const sp = new URLSearchParams(location.search);
    return String(sp.get('vendor') || '').trim();
  }, [location.search, params?.vendorId]);
  const storefrontMode = Boolean(vendorId);

  const vendorFromState = location?.state?.vendor || null;

  useEffect(() => {
    if (storefrontMode) return;
    let alive = true;
    setLoading(true);
    listPartneredShops()
      .then((list) => {
        if (!alive) return;
        setItems(Array.isArray(list) ? list : []);
        setError('');
      })
      .catch((e) => {
        if (!alive) return;
        setError(e?.message || 'FAILED_TO_LOAD');
        setItems([]);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [storefrontMode]);

  const vendorItems = useMemo(() => {
    if (!vendorId) return items;
    return items.filter((it) => String(it?._id || '') === vendorId);
  }, [items, vendorId]);

  const vendor = useMemo(() => {
    if (!vendorId) return null;
    if (vendorFromState && String(vendorFromState?._id || '') === vendorId) return vendorFromState;
    return vendorItems[0] || null;
  }, [vendorFromState, vendorId, vendorItems]);

  const [vendorDetail, setVendorDetail] = useState(null);
  const [vendorDetailLoading, setVendorDetailLoading] = useState(false);
  useEffect(() => {
    if (!vendorId) {
      setVendorDetail(null);
      return;
    }
    let alive = true;
    setVendorDetailLoading(true);
    apiFetch(`/api/vendors/${encodeURIComponent(vendorId)}`)
      .then((data) => {
        if (!alive) return;
        setVendorDetail(data?.item || null);
      })
      .catch(() => {
        if (!alive) return;
        setVendorDetail(null);
      })
      .finally(() => {
        if (!alive) return;
        setVendorDetailLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [vendorId]);

  const storefrontVendor = vendorDetail || vendor;

  const [tab, setTab] = useState('products');
  useEffect(() => {
    setTab('products');
  }, [vendorId]);

  const [products, setProducts] = useState([]);
  const [posts, setPosts] = useState([]);
  const [videos, setVideos] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [loadingVideos, setLoadingVideos] = useState(false);

  useEffect(() => {
    if (!vendorId) {
      setProducts([]);
      setPosts([]);
      setVideos([]);
      return;
    }
    let alive = true;
    setError('');

    const loadProducts = async () => {
      setLoadingProducts(true);
      try {
        const data = await apiFetch(`/api/public-cars?vendor=${encodeURIComponent(vendorId)}`);
        if (!alive) return;
        setProducts(Array.isArray(data?.items) ? data.items : []);
      } catch (e) {
        if (!alive) return;
        setProducts([]);
        setError(e?.message || 'FAILED_TO_LOAD_PRODUCTS');
      } finally {
        if (!alive) return;
        setLoadingProducts(false);
      }
    };

    const loadPosts = async () => {
      setLoadingPosts(true);
      try {
        const data = await apiFetch(`/api/vendors/${encodeURIComponent(vendorId)}/posts?type=post`);
        if (!alive) return;
        setPosts(Array.isArray(data?.items) ? data.items : []);
      } catch {
        if (!alive) return;
        setPosts([]);
      } finally {
        if (!alive) return;
        setLoadingPosts(false);
      }
    };

    const loadVideos = async () => {
      setLoadingVideos(true);
      try {
        const data = await apiFetch(`/api/vendors/${encodeURIComponent(vendorId)}/posts?type=video`);
        if (!alive) return;
        setVideos(Array.isArray(data?.items) ? data.items : []);
      } catch {
        if (!alive) return;
        setVideos([]);
      } finally {
        if (!alive) return;
        setLoadingVideos(false);
      }
    };

    loadProducts();
    loadPosts();
    loadVideos();

    return () => {
      alive = false;
    };
  }, [vendorId]);

  const [sortKey, setSortKey] = useState('newest');
  useEffect(() => {
    setSortKey('newest');
  }, [vendorId]);

  const cartKey = useMemo(() => {
    const v = String(vendorId || '').trim();
    return v ? `carbanana.cart.${v}` : '';
  }, [vendorId]);

  useEffect(() => {
    if (!cartKey) {
      setCart([]);
      return;
    }
    try {
      const raw = localStorage.getItem(cartKey);
      const parsed = raw ? JSON.parse(raw) : null;
      setCart(Array.isArray(parsed) ? parsed : []);
    } catch {
      setCart([]);
    }
  }, [cartKey]);

  useEffect(() => {
    if (!cartKey) return;
    try {
      localStorage.setItem(cartKey, JSON.stringify(Array.isArray(cart) ? cart : []));
    } catch {}
  }, [cart, cartKey]);

  useEffect(() => {
    if (!buyOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (buyBusy) return;
        setBuyOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [buyBusy, buyOpen]);

  const submitComplaint = async () => {
    if (!token || complaintBusy) return;
    if (!vendorId) return;

    const bookingId = parseBookingId(complaintForm.bookingId);
    const issueType = String(complaintForm.issueType || '').trim();
    const description = String(complaintForm.description || '').trim();
    const files = Array.isArray(complaintForm.files) ? complaintForm.files : [];
    if (!bookingId) {
      setComplaintError('Vui lòng nhập mã booking (hoặc dán link booking).');
      return;
    }
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
    setToast('');
    try {
      const bookingRes = await apiFetch(`/api/bookings/${encodeURIComponent(bookingId)}`, { token });
      const booking = bookingRes?.item || null;
      const bookingStatus = String(booking?.status || '').trim().toLowerCase();
      const bookingShopId = String(booking?.shop?._id || '').trim();
      if (!booking || !bookingShopId) {
        setComplaintError('Không tìm thấy booking này trong tài khoản của bạn.');
        return;
      }
      if (bookingShopId !== String(vendorId)) {
        setComplaintError('Booking này không thuộc cửa hàng hiện tại.');
        return;
      }
      if (bookingStatus !== 'completed') {
        setComplaintError('Chỉ có thể gửi khiếu nại khi booking đã hoàn thành.');
        return;
      }

      const formData = new FormData();
      formData.append('bookingId', bookingId);
      formData.append('issueType', issueType);
      formData.append('description', description);
      for (const f of files.slice(0, 8)) {
        if (f) formData.append('files', f);
      }
      await apiFetchForm('/api/tickets', { token, method: 'POST', formData });

      setComplaintOpen(false);
      setComplaintForm({ bookingId: '', issueType: 'wrong_part', description: '', files: [] });
      setToast('Đã gửi khiếu nại. Shop và admin sẽ nhận được yêu cầu.');
      window.setTimeout(() => setToast(''), 4000);
    } catch (e) {
      const code = String(e?.message || '').trim();
      if (code === 'UNAUTHORIZED') setComplaintError('Vui lòng đăng nhập để gửi khiếu nại.');
      else if (code === 'BOOKING_NOT_COMPLETED') setComplaintError('Booking chưa ở trạng thái hoàn thành.');
      else if (code === 'EVIDENCE_REQUIRED') setComplaintError('Thiếu bằng chứng. Vui lòng tải ít nhất 1 ảnh/video.');
      else if (code === 'TICKET_ALREADY_ACTIVE') setComplaintError('Booking này đang có khiếu nại đang xử lý.');
      else if (code === 'NOT_FOUND') setComplaintError('Không tìm thấy booking này trong tài khoản của bạn.');
      else setComplaintError(code || 'GỬI_KHIẾU_NẠI_THẤT_BẠI');
    } finally {
      setComplaintBusy(false);
    }
  };

  const normalizeCartItem = (p) => {
    const productId = String(p?._id || '').trim();
    return {
      productId,
      title: String(p?.title || 'Sản phẩm').trim(),
      price: Number(p?.price) || 0,
      qty: 1,
      coverImage: String(p?.coverImage || '').trim(),
      images: Array.isArray(p?.images) ? p.images : []
    };
  };

  const addToCart = (p, qtyRaw = 1) => {
    const item = normalizeCartItem(p);
    if (!item.productId) return;
    const addQty = Math.max(1, Math.floor(Number(qtyRaw) || 1));
    setCart((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      const idx = list.findIndex((x) => String(x?.productId || '') === item.productId);
      if (idx < 0) return [...list, item];
      const next = list.slice();
      const cur = next[idx] || {};
      const qty = Math.max(1, Math.floor(Number(cur.qty) || 1) + addQty);
      next[idx] = { ...cur, ...item, qty };
      return next;
    });
    setToast('Đã thêm vào giỏ hàng.');
    window.setTimeout(() => setToast(''), 2500);
  };

  const openBuy = (p) => {
    setBuyProduct(p || null);
    setCheckoutItems([]);
    setBuyQty(1);
    setBuyError('');
    setBuyStep('product');
    setBuyOpen(true);
  };

  const openCart = () => {
    const list = Array.isArray(cart) ? cart : [];
    if (!list.length) {
      setToast('Giỏ hàng đang trống.');
      window.setTimeout(() => setToast(''), 2500);
      return;
    }
    setCheckoutItems(list);
    setBuyProduct(null);
    setBuyError('');
    setBuyStep('cart');
    setBuyOpen(true);
    setKyc((p) => ({
      name: String(p?.name || user?.name || '').trim(),
      phone: String(p?.phone || user?.phone || '').trim(),
      address: String(p?.address || '').trim(),
      note: String(p?.note || '').trim()
    }));
  };

  const goKyc = ({ items }) => {
    const list = Array.isArray(items) ? items : [];
    if (!list.length) return;
    setCheckoutItems(list);
    setBuyError('');
    setBuyStep('kyc');
    setBuyOpen(true);
    setKyc((p) => ({
      name: String(p?.name || user?.name || '').trim(),
      phone: String(p?.phone || user?.phone || '').trim(),
      address: String(p?.address || '').trim(),
      note: String(p?.note || '').trim()
    }));
  };

  const submitBuy = async () => {
    if (!vendorId) return;
    if (!isAuthed) {
      const next = `/shops/${encodeURIComponent(String(vendorId))}`;
      navigate(`/login?next=${encodeURIComponent(next)}`);
      return;
    }

    const list = Array.isArray(checkoutItems) ? checkoutItems : [];
    if (!list.length) return;

    const name = String(kyc.name || '').trim();
    const phone = String(kyc.phone || '').trim();
    const address = String(kyc.address || '').trim();
    const note = String(kyc.note || '').trim();

    if (name.length < 2) {
      setBuyError('Vui lòng nhập họ tên.');
      return;
    }
    if (phone.replace(/\D/g, '').length < 9) {
      setBuyError('Vui lòng nhập số điện thoại hợp lệ.');
      return;
    }
    if (address.length < 6) {
      setBuyError('Vui lòng nhập địa chỉ nhận hàng.');
      return;
    }

    if (!token || buyBusy) return;
    setBuyBusy(true);
    setBuyError('');
    setToast('');
    try {
      const lines = list.map((x, i) => {
        const title = String(x?.title || '').trim() || 'Sản phẩm';
        const qty = Math.max(1, Math.floor(Number(x?.qty) || 1));
        const priceText = fmtMoney(Number(x?.price) || 0);
        return `${i + 1}. ${title} x${qty} (${priceText})`;
      });
      const msg = [
        'YÊU CẦU MUA HÀNG',
        '',
        ...lines,
        '',
        `Họ tên: ${name}`,
        `SĐT: ${phone}`,
        `Địa chỉ: ${address}`,
        note ? `Ghi chú: ${note}` : ''
      ]
        .filter(Boolean)
        .join('\n');

      const r = await apiFetch('/api/chat/threads', { token, method: 'POST', body: { shopId: String(vendorId) } });
      const threadId = String(r?.item?._id || '').trim();
      if (!threadId) throw new Error('REQUEST_FAILED');
      await apiFetch(`/api/chat/threads/${encodeURIComponent(threadId)}/messages`, { token, method: 'POST', body: { text: msg } });

      setBuyOpen(false);
      setBuyProduct(null);
      setCheckoutItems([]);
      setBuyStep('product');
      setCart([]);
      setToast('Đã gửi yêu cầu. Shop sẽ liên hệ lại qua chat.');
      window.setTimeout(() => setToast(''), 4000);
      setChatOpen(true);
    } catch (e) {
      const code = String(e?.message || '').trim();
      if (code === 'UNAUTHORIZED') setBuyError('Vui lòng đăng nhập để mua hàng.');
      else if (code === 'USER_BLOCKED_BY_SHOP') setBuyError('Bạn đã bị shop chặn. Không thể gửi yêu cầu mua hàng.');
      else if (code === 'RATE_LIMITED') setBuyError('Bạn thao tác quá nhanh. Vui lòng thử lại sau.');
      else setBuyError(code || 'GỬI_YÊU_CẦU_THẤT_BẠI');
    } finally {
      setBuyBusy(false);
    }
  };

  const sortedProducts = useMemo(() => {
    const list = Array.isArray(products) ? [...products] : [];
    const toTime = (x) => {
      const d = x?.createdAt ? new Date(x.createdAt) : null;
      const ms = d && !Number.isNaN(d.getTime()) ? d.getTime() : 0;
      return ms;
    };
    if (sortKey === 'price_asc') return list.sort((a, b) => (Number(a?.price) || 0) - (Number(b?.price) || 0));
    if (sortKey === 'price_desc') return list.sort((a, b) => (Number(b?.price) || 0) - (Number(a?.price) || 0));
    if (sortKey === 'views') return list.sort((a, b) => (Number(b?.viewCount) || 0) - (Number(a?.viewCount) || 0));
    return list.sort((a, b) => toTime(b) - toTime(a));
  }, [products, sortKey]);

  const cards = useMemo(() => {
    return items.slice(0, 24);
  }, [items]);

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
      <div className="relative mx-auto w-full max-w-6xl space-y-6 px-4 pb-10 pt-6">
        {storefrontMode ? null : (
          <div className="rounded-3xl border border-zinc-800/70 bg-zinc-950/50 p-6 backdrop-blur-xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="text-sm font-semibold text-sky-300">{t('nav_marketplace')}</div>
                <h1 className="mt-1 text-2xl font-black tracking-tight text-zinc-50 sm:text-3xl">{t('market_heading')}</h1>
                <div className="mt-2 max-w-2xl text-sm text-zinc-400">{t('market_desc')}</div>
              </div>
              <Link
                to="/custom"
                className="inline-flex items-center justify-center rounded-2xl bg-sky-400 px-5 py-3 text-sm font-semibold text-zinc-950 hover:bg-sky-300"
              >
                {t('dash_create_new')}
              </Link>
            </div>
          </div>
        )}

        {toast ? (
          <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100">
            {toast}
          </div>
        ) : null}
        {error ? <div className="rounded-2xl border border-red-900/40 bg-red-950/30 p-4 text-sm text-red-200">{error}</div> : null}

        {storefrontMode ? (
          <div className="grid gap-6 lg:grid-cols-[1.6fr_0.9fr]">
          <div className="space-y-6">
            <div className="overflow-hidden rounded-3xl border border-zinc-800/70 bg-zinc-950/50 shadow-[0_26px_90px_rgba(0,0,0,0.70),0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur-2xl">
              <div className="relative">
                <div className="h-44 w-full bg-zinc-900 sm:h-52">
                  {storefrontVendor?.coverImage ? (
                    <img alt="" src={resolveAssetUrl(storefrontVendor.coverImage)} className="h-full w-full object-cover opacity-95" />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-r from-zinc-900 via-zinc-950 to-sky-950/40" />
                  )}
                </div>
                <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.35),rgba(0,0,0,0.65))]" />

                <div className="absolute left-5 top-5 flex items-center gap-2">
                  <Link
                    to="/marketplace"
                    className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-zinc-100 hover:bg-white/10"
                  >
                    ← Marketplace
                  </Link>
                  {vendorDetailLoading ? <Chip>Đang tải…</Chip> : null}
                </div>

                <div className="absolute bottom-5 left-5 right-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <div className="flex min-w-0 items-end gap-4">
                    <div className="h-16 w-16 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950">
                      {storefrontVendor?.logo ? (
                        <img alt="" src={resolveAssetUrl(storefrontVendor.logo)} className="h-full w-full object-contain p-2" />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-sm font-black text-zinc-300">
                          {String(storefrontVendor?.shopName || 'S')
                            .trim()
                            .slice(0, 1)
                            .toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate text-2xl font-black tracking-tight text-white sm:text-3xl">{storefrontVendor?.shopName || 'Shop'}</div>
                        <RatingBadge value={storefrontVendor?.rating} />
                        {Number(storefrontVendor?.reviewCount) ? <Chip>{Number(storefrontVendor.reviewCount)} đánh giá</Chip> : null}
                      </div>
                      <div className="mt-1 line-clamp-2 max-w-2xl text-sm text-zinc-200/90">{storefrontVendor?.description || 'Chưa có mô tả.'}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {storefrontVendor?.address ? <Chip>{storefrontVendor.address}</Chip> : null}
                        {storefrontVendor?.phone ? <Chip>{storefrontVendor.phone}</Chip> : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {storefrontVendor?.website ? (
                      <a
                        href={storefrontVendor.website}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-black text-zinc-100 hover:bg-white/10"
                      >
                        Website
                      </a>
                    ) : null}
                    {storefrontVendor?.facebook ? (
                      <a
                        href={storefrontVendor.facebook}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-black text-zinc-100 hover:bg-white/10"
                      >
                        Facebook
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-800/70 bg-zinc-950/50 backdrop-blur-xl">
              <div className="border-b border-white/10 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <StorefrontTab active={tab === 'products'} label={`Sản phẩm (${products.length})`} onClick={() => setTab('products')} />
                    <StorefrontTab active={tab === 'posts'} label={`Bài viết (${posts.length})`} onClick={() => setTab('posts')} />
                    <StorefrontTab active={tab === 'videos'} label={`Video (${videos.length})`} onClick={() => setTab('videos')} />
                  </div>
                  {tab === 'products' ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={openCart}
                        className="rounded-2xl border border-sky-400/25 bg-sky-500/10 px-4 py-2 text-xs font-black text-sky-100 hover:bg-sky-500/15"
                      >
                        Giỏ hàng ({(Array.isArray(cart) ? cart : []).reduce((s, x) => s + Math.max(1, Math.floor(Number(x?.qty) || 1)), 0)})
                      </button>
                      <select
                        value={sortKey}
                        onChange={(e) => setSortKey(e.target.value)}
                        style={{ colorScheme: 'dark' }}
                        className="rounded-2xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-xs font-semibold text-zinc-100 outline-none focus:border-sky-400/40"
                      >
                        <option value="newest">Mới nhất</option>
                        <option value="views">Xem nhiều</option>
                        <option value="price_asc">Giá tăng dần</option>
                        <option value="price_desc">Giá giảm dần</option>
                      </select>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="p-5">
                {tab === 'products' ? (
                  <div className="grid gap-5 sm:grid-cols-2">
                    {loadingProducts ? (
                      <>
                        <Skeleton />
                        <Skeleton />
                        <Skeleton />
                        <Skeleton />
                      </>
                    ) : sortedProducts.length ? (
                      sortedProducts.slice(0, 60).map((p) => {
                        const img = p?.coverImage || (Array.isArray(p?.images) ? p.images[0] : '') || '';
                        return (
                          <button
                            type="button"
                            key={String(p?._id || '')}
                            onClick={() => openBuy(p)}
                            className="group overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/40 text-left transition hover:border-sky-400/30"
                          >
                            <div className="aspect-[16/10] w-full bg-zinc-900">
                              {img ? (
                                <img alt="" src={resolveAssetUrl(img)} className="h-full w-full object-cover opacity-95 transition group-hover:opacity-100" />
                              ) : (
                                <div className="h-full w-full bg-gradient-to-r from-zinc-900 via-zinc-950 to-sky-950/30" />
                              )}
                            </div>
                            <div className="space-y-2 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-black text-zinc-50">{p?.title || 'Sản phẩm'}</div>
                                  {p?.description ? <div className="mt-1 line-clamp-2 text-xs text-zinc-400">{p.description}</div> : null}
                                </div>
                                <div className="shrink-0 text-sm font-extrabold text-sky-300">{fmtMoney(p?.price)}</div>
                              </div>
                              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
                                <div>Kho: {Number(p?.stock) || 0}</div>
                                <div>Lượt xem: {Number(p?.viewCount) || 0}</div>
                                <div>Đã bán: {Number(p?.soldCount) || 0}</div>
                              </div>
                            </div>
                          </button>
                        );
                      })
                    ) : (
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-zinc-300 sm:col-span-2">
                        <div className="text-sm font-black text-zinc-50">Chưa có sản phẩm</div>
                        <div className="mt-1 text-xs text-zinc-400">Shop sẽ cập nhật sản phẩm trong thời gian tới.</div>
                      </div>
                    )}
                  </div>
                ) : null}

                {tab === 'posts' ? (
                  <div className="space-y-4">
                    {loadingPosts ? (
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-zinc-400">{t('common_loading')}</div>
                    ) : posts.length ? (
                      posts.slice(0, 50).map((p) => (
                        <div key={String(p?._id || '')} className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                          {p?.mediaUrl ? <img alt="" src={resolveAssetUrl(p.mediaUrl)} className="max-h-[420px] w-full object-cover" /> : null}
                          <div className="space-y-2 p-5">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-base font-black text-zinc-50">{p?.title || 'Bài viết'}</div>
                                <div className="mt-1 text-xs font-semibold text-zinc-500">{fmtDate(p?.createdAt)}</div>
                              </div>
                            </div>
                            {p?.content ? <div className="whitespace-pre-wrap text-sm text-zinc-200/90">{p.content}</div> : null}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-zinc-300">
                        <div className="text-sm font-black text-zinc-50">Chưa có bài viết</div>
                        <div className="mt-1 text-xs text-zinc-400">Shop sẽ đăng bài viết chia sẻ dịch vụ/kinh nghiệm sau.</div>
                      </div>
                    )}
                  </div>
                ) : null}

                {tab === 'videos' ? (
                  <div className="grid gap-5 sm:grid-cols-2">
                    {loadingVideos ? (
                      <>
                        <Skeleton />
                        <Skeleton />
                        <Skeleton />
                        <Skeleton />
                      </>
                    ) : videos.length ? (
                      videos.slice(0, 50).map((v) => {
                        const url = String(v?.mediaUrl || '').trim();
                        const lower = url.toLowerCase();
                        const isVideoFile = lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.ogg');
                        const thumb = String(v?.thumbnailUrl || '').trim();
                        return (
                          <div key={String(v?._id || '')} className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/40">
                            {isVideoFile && url ? (
                              <video src={resolveAssetUrl(url)} controls className="w-full bg-black/40" />
                            ) : url ? (
                              <a href={url} target="_blank" rel="noreferrer" className="block">
                                {thumb ? (
                                  <img alt="" src={resolveAssetUrl(thumb)} className="max-h-[360px] w-full object-cover" />
                                ) : (
                                  <div className="grid aspect-[16/10] w-full place-items-center bg-zinc-900 text-xs font-bold text-zinc-400">Mở video</div>
                                )}
                              </a>
                            ) : (
                              <div className="grid aspect-[16/10] w-full place-items-center bg-zinc-900 text-xs font-bold text-zinc-400">Chưa có link video</div>
                            )}
                            <div className="space-y-2 p-4">
                              <div className="truncate text-sm font-black text-zinc-50">{v?.title || 'Video'}</div>
                              <div className="text-xs font-semibold text-zinc-500">{fmtDate(v?.createdAt)}</div>
                              {v?.content ? <div className="line-clamp-3 whitespace-pre-wrap text-sm text-zinc-200/90">{v.content}</div> : null}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-zinc-300 sm:col-span-2">
                        <div className="text-sm font-black text-zinc-50">Chưa có video</div>
                        <div className="mt-1 text-xs text-zinc-400">Shop sẽ cập nhật video giới thiệu/công việc sau.</div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-6 self-start">
            <div className="rounded-3xl border border-zinc-800/70 bg-zinc-950/50 p-5 backdrop-blur-xl">
              <div className="text-sm font-black text-zinc-50">Thông tin shop</div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-[11px] font-bold tracking-wider text-zinc-500">ĐỊA CHỈ</div>
                  <div className="mt-1 text-sm font-semibold text-zinc-100">{storefrontVendor?.address || 'Chưa cập nhật'}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-[11px] font-bold tracking-wider text-zinc-500">SĐT</div>
                  <div className="mt-1 text-sm font-semibold text-zinc-100">{storefrontVendor?.phone || 'Chưa cập nhật'}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-[11px] font-bold tracking-wider text-zinc-500">GIỜ LÀM VIỆC</div>
                  <div className="mt-1 text-sm font-semibold text-zinc-100">
                    {String(storefrontVendor?.bookingPreferences?.workingHours?.start || '').trim() &&
                    String(storefrontVendor?.bookingPreferences?.workingHours?.end || '').trim()
                      ? `${String(storefrontVendor.bookingPreferences.workingHours.start).trim()} - ${String(
                          storefrontVendor.bookingPreferences.workingHours.end
                        ).trim()}`
                      : 'Chưa cập nhật'}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-[11px] font-bold tracking-wider text-zinc-500">GIỜ NGHỈ</div>
                  <div className="mt-1 text-sm font-semibold text-zinc-100">
                    {String(storefrontVendor?.bookingPreferences?.breakHours?.start || '').trim() &&
                    String(storefrontVendor?.bookingPreferences?.breakHours?.end || '').trim()
                      ? `${String(storefrontVendor.bookingPreferences.breakHours.start).trim()} - ${String(
                          storefrontVendor.bookingPreferences.breakHours.end
                        ).trim()}`
                      : 'Chưa cập nhật'}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:col-span-2">
                  <div className="text-[11px] font-bold tracking-wider text-zinc-500">EMAIL</div>
                  <div className="mt-1 text-sm font-semibold text-zinc-100 break-all">{storefrontVendor?.email || 'Chưa cập nhật'}</div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-800/70 bg-zinc-950/50 p-5 backdrop-blur-xl">
              <div className="text-sm font-black text-zinc-50">Liên hệ</div>
              <div className="mt-2 text-xs text-zinc-400">Bạn có thể gọi, chat hoặc gửi khiếu nại sau khi hoàn thành dịch vụ.</div>
              <div className="mt-4 grid gap-2">
                {storefrontVendor?.phone ? (
                  <a
                    href={`tel:${String(storefrontVendor.phone || '').replace(/\s+/g, '')}`}
                    className="inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-sky-400 to-cyan-300 px-4 py-3 text-sm font-black text-zinc-950 hover:brightness-110"
                  >
                    Gọi ngay
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="inline-flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-zinc-500"
                  >
                    Chưa có SĐT
                  </button>
                )}
                {isAuthed ? (
                  <button
                    type="button"
                    onClick={() => setChatOpen(true)}
                    className="inline-flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-zinc-100 hover:bg-white/10"
                  >
                    Chat với shop
                  </button>
                ) : (
                  <Link
                    to={`/login?next=${encodeURIComponent(`/shops/${String(vendorId || '')}`)}`}
                    className="inline-flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-zinc-100 hover:bg-white/10"
                  >
                    Đăng nhập để chat
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (!isAuthed) {
                      setToast('Vui lòng đăng nhập để gửi khiếu nại.');
                      window.setTimeout(() => setToast(''), 3000);
                      return;
                    }
                    setComplaintError('');
                    setComplaintOpen(true);
                  }}
                  className="inline-flex w-full items-center justify-center rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm font-black text-amber-100 hover:bg-amber-500/15"
                >
                  Gửi khiếu nại
                </button>
                {storefrontVendor?.website ? (
                  <a
                    href={storefrontVendor.website}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-zinc-100 hover:bg-white/10"
                  >
                    Mở website
                  </a>
                ) : null}
                {storefrontVendor?.facebook ? (
                  <a
                    href={storefrontVendor.facebook}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-zinc-100 hover:bg-white/10"
                  >
                    Mở Facebook
                  </a>
                ) : null}
              </div>
              <div className="mt-3 text-xs text-zinc-500">Sản phẩm/Bài viết/Video do shop đăng và tự chịu trách nhiệm.</div>
            </div>
          </aside>
          <ChatThreadModal open={chatOpen} onClose={() => setChatOpen(false)} mode="user" shopId={String(vendorId || '')} />
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <>
              <Skeleton />
              <Skeleton />
              <Skeleton />
              <Skeleton />
              <Skeleton />
              <Skeleton />
            </>
          ) : cards.length ? (
            cards.map((it) => (
              <Link
                key={String(it?._id || '')}
                to={`/shops/${encodeURIComponent(String(it?._id || ''))}`}
                state={{ vendor: it || null }}
                className="group overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/40 transition hover:border-sky-400/30"
              >
                <div className="aspect-[16/10] w-full bg-zinc-900">
                  {it?.coverImage ? (
                    <img alt="" src={resolveAssetUrl(it.coverImage)} className="h-full w-full object-cover opacity-90" />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-r from-zinc-900 via-zinc-900 to-sky-950/30" />
                  )}
                </div>
                <div className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-zinc-100 group-hover:text-white">{it?.shopName || 'Shop'}</div>
                      <div className="mt-1 line-clamp-1 text-xs text-zinc-500">{it?.address || '—'}</div>
                    </div>
                    <div className="shrink-0">
                      <RatingBadge value={it?.rating} />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-zinc-400">{it?.phone || '—'}</div>
                    {typeof it?.distanceKm === 'number' ? <div className="text-xs font-semibold text-zinc-500">{it.distanceKm} km</div> : null}
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-6 text-sm text-zinc-400 sm:col-span-2 lg:col-span-3">
              {t('market_empty')}
            </div>
          )}
        </div>
      )}
      </div>

      {buyOpen ? (
        <div className="fixed inset-0 z-[91]">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => {
              if (buyBusy) return;
              setBuyOpen(false);
            }}
          />
          <div
            className={
              buyStep === 'product'
                ? 'absolute left-1/2 top-1/2 w-[94vw] max-w-[1100px] -translate-x-1/2 -translate-y-1/2'
                : 'absolute left-1/2 top-1/2 w-[92vw] max-w-[760px] -translate-x-1/2 -translate-y-1/2'
            }
          >
            <div className="relative flex max-h-[90vh] flex-col overflow-hidden rounded-3xl border border-white/15 bg-zinc-950/85 shadow-[0_40px_120px_-60px_rgba(0,0,0,0.95)] backdrop-blur-2xl">
              <div className="flex items-start justify-between gap-3 border-b border-white/10 px-6 py-5">
                <div className="min-w-0">
                  <div className="text-lg font-black text-zinc-50">
                    {buyStep === 'kyc' ? 'Thông tin giao hàng' : buyStep === 'cart' ? 'Giỏ hàng' : 'Chi tiết sản phẩm'}
                  </div>
                  <div className="mt-1 text-sm text-zinc-300">
                    {buyStep === 'kyc'
                      ? 'Nhập thông tin để shop liên hệ và giao hàng.'
                      : buyStep === 'cart'
                        ? 'Kiểm tra sản phẩm trong giỏ và bấm “Thanh toán”.'
                        : String(buyProduct?.title || '').trim()
                          ? `Đang xem: ${String(buyProduct?.title || '').trim()}`
                          : 'Xem thông tin sản phẩm và chọn hành động.'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (buyBusy) return;
                    setBuyOpen(false);
                  }}
                  className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10 disabled:opacity-60"
                  disabled={buyBusy}
                >
                  Đóng
                </button>
              </div>

              <div className={`flex-1 px-6 py-5 ${buyStep === 'product' ? 'overflow-y-auto' : 'space-y-4'}`}>
                {buyError ? (
                  <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{buyError}</div>
                ) : null}

                {buyStep === 'product' ? (
                  <div className="grid gap-6 lg:grid-cols-[520px_1fr]">
                    <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/95">
                      {(() => {
                        const img = buyProduct?.coverImage || (Array.isArray(buyProduct?.images) ? buyProduct.images[0] : '') || '';
                        return (
                          <div className="aspect-square w-full p-4 sm:p-6">
                            {img ? (
                              <img alt="" src={resolveAssetUrl(img)} className="h-full w-full object-contain" />
                            ) : (
                              <div className="h-full w-full rounded-2xl bg-gradient-to-r from-zinc-200 via-white to-zinc-200" />
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    <div className="min-w-0 space-y-5">
                      <div>
                        <div className="text-xl font-black tracking-tight text-zinc-50 sm:text-2xl">{String(buyProduct?.title || 'Sản phẩm')}</div>
                        <div className="mt-3 text-2xl font-black text-sky-300 sm:text-3xl">{fmtMoney(buyProduct?.price)}</div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-zinc-400">
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Kho: {Number(buyProduct?.stock) || 0}</span>
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Đã bán: {Number(buyProduct?.soldCount) || 0}</span>
                        </div>
                      </div>

                      {buyProduct?.description ? (
                        <div className="whitespace-pre-wrap rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-200/90">
                          {String(buyProduct.description)}
                        </div>
                      ) : (
                        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-400">Chưa có mô tả.</div>
                      )}

                      <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="text-sm font-black text-zinc-50">Số lượng</div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setBuyQty((v) => Math.max(1, Math.floor(Number(v) || 1) - 1))}
                              className="h-10 w-10 rounded-2xl border border-white/10 bg-white/5 text-sm font-black text-zinc-100 hover:bg-white/10"
                            >
                              −
                            </button>
                            <div className="min-w-[44px] text-center text-sm font-black text-zinc-100 tabular-nums">{Math.max(1, Math.floor(Number(buyQty) || 1))}</div>
                            <button
                              type="button"
                              onClick={() => setBuyQty((v) => Math.max(1, Math.floor(Number(v) || 1) + 1))}
                              className="h-10 w-10 rounded-2xl border border-white/10 bg-white/5 text-sm font-black text-zinc-100 hover:bg-white/10"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (!buyProduct) return;
                            addToCart(buyProduct, buyQty);
                          }}
                          className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-zinc-100 hover:bg-white/10"
                        >
                          Thêm vào giỏ
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!buyProduct) return;
                            if (!isAuthed) {
                              const next = `/shops/${encodeURIComponent(String(vendorId || ''))}`;
                              navigate(`/login?next=${encodeURIComponent(next)}`);
                              return;
                            }
                            goKyc({ items: [{ ...normalizeCartItem(buyProduct), qty: Math.max(1, Math.floor(Number(buyQty) || 1)) }] });
                          }}
                          className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-sky-400 to-cyan-300 px-4 py-3 text-sm font-black text-zinc-950 hover:brightness-110"
                        >
                          Mua ngay
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={openCart}
                        className="w-full rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm font-black text-sky-100 hover:bg-sky-500/15"
                      >
                        Xem giỏ hàng
                      </button>
                    </div>
                  </div>
                ) : buyStep === 'cart' ? (
                  <>
                    <div className="space-y-2">
                      {(Array.isArray(cart) ? cart : []).map((it) => {
                        const id = String(it?.productId || '').trim();
                        const qty = Math.max(1, Math.floor(Number(it?.qty) || 1));
                        const title = String(it?.title || 'Sản phẩm').trim();
                        const img = String(it?.coverImage || '').trim() || (Array.isArray(it?.images) ? String(it.images[0] || '').trim() : '');
                        return (
                          <div key={id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                            <div className="h-14 w-14 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900">
                              {img ? <img alt="" src={resolveAssetUrl(img)} className="h-full w-full object-cover" /> : null}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-black text-zinc-50">{title}</div>
                              <div className="mt-1 text-xs font-semibold text-zinc-400">{fmtMoney(Number(it?.price) || 0)}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setCart((prev) =>
                                    (Array.isArray(prev) ? prev : []).map((x) =>
                                      String(x?.productId || '') === id ? { ...(x || {}), qty: Math.max(1, Math.floor(Number(x?.qty) || 1) - 1) } : x
                                    )
                                  )
                                }
                                className="h-10 w-10 rounded-2xl border border-white/10 bg-white/5 text-sm font-black text-zinc-100 hover:bg-white/10"
                              >
                                −
                              </button>
                              <div className="min-w-[44px] text-center text-sm font-black text-zinc-100 tabular-nums">{qty}</div>
                              <button
                                type="button"
                                onClick={() =>
                                  setCart((prev) =>
                                    (Array.isArray(prev) ? prev : []).map((x) =>
                                      String(x?.productId || '') === id ? { ...(x || {}), qty: Math.max(1, Math.floor(Number(x?.qty) || 1) + 1) } : x
                                    )
                                  )
                                }
                                className="h-10 w-10 rounded-2xl border border-white/10 bg-white/5 text-sm font-black text-zinc-100 hover:bg-white/10"
                              >
                                +
                              </button>
                              <button
                                type="button"
                                onClick={() => setCart((prev) => (Array.isArray(prev) ? prev : []).filter((x) => String(x?.productId || '') !== id))}
                                className="h-10 w-10 rounded-2xl border border-rose-400/20 bg-rose-500/10 text-sm font-black text-rose-100 hover:bg-rose-500/15"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      <div className="text-sm font-black text-zinc-50">
                        Tổng:{' '}
                        {fmtMoney(
                          (Array.isArray(cart) ? cart : []).reduce(
                            (s, x) => s + (Number(x?.price) || 0) * Math.max(1, Math.floor(Number(x?.qty) || 1)),
                            0
                          )
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (!isAuthed) {
                            const next = `/shops/${encodeURIComponent(String(vendorId || ''))}`;
                            navigate(`/login?next=${encodeURIComponent(next)}`);
                            return;
                          }
                          goKyc({ items: Array.isArray(cart) ? cart : [] });
                        }}
                        className="inline-flex items-center justify-center rounded-2xl bg-sky-400 px-4 py-2.5 text-sm font-black text-zinc-950 hover:bg-sky-300"
                      >
                        Thanh toán
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block space-y-1">
                        <div className="text-xs font-semibold text-zinc-400">Họ tên</div>
                        <input
                          value={kyc.name}
                          onChange={(e) => setKyc((p) => ({ ...(p || {}), name: e.target.value }))}
                          disabled={buyBusy}
                          className="w-full rounded-2xl border border-white/15 bg-zinc-950/70 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-sky-400/40"
                        />
                      </label>
                      <label className="block space-y-1">
                        <div className="text-xs font-semibold text-zinc-400">Số điện thoại</div>
                        <input
                          value={kyc.phone}
                          onChange={(e) => setKyc((p) => ({ ...(p || {}), phone: e.target.value }))}
                          disabled={buyBusy}
                          className="w-full rounded-2xl border border-white/15 bg-zinc-950/70 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-sky-400/40"
                        />
                      </label>
                    </div>
                    <label className="block space-y-1">
                      <div className="text-xs font-semibold text-zinc-400">Địa chỉ nhận hàng</div>
                      <textarea
                        value={kyc.address}
                        onChange={(e) => setKyc((p) => ({ ...(p || {}), address: e.target.value }))}
                        rows={3}
                        disabled={buyBusy}
                        placeholder="Ví dụ: 123 Lê Lợi, P. Bến Thành, Q.1, TP.HCM"
                        className="w-full resize-none rounded-2xl border border-white/15 bg-zinc-950/70 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-sky-400/40"
                      />
                    </label>
                    <label className="block space-y-1">
                      <div className="text-xs font-semibold text-zinc-400">Ghi chú (tuỳ chọn)</div>
                      <textarea
                        value={kyc.note}
                        onChange={(e) => setKyc((p) => ({ ...(p || {}), note: e.target.value }))}
                        rows={3}
                        disabled={buyBusy}
                        placeholder="VD: “Giao giờ hành chính”, “Gọi trước khi giao”…"
                        className="w-full resize-none rounded-2xl border border-white/15 bg-zinc-950/70 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-sky-400/40"
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setBuyStep((Array.isArray(checkoutItems) ? checkoutItems : []).length > 1 ? 'cart' : 'product')}
                        disabled={buyBusy}
                        className="inline-flex flex-1 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-zinc-100 hover:bg-white/10 disabled:opacity-60"
                      >
                        Quay lại
                      </button>
                      <button
                        type="button"
                        onClick={submitBuy}
                        disabled={buyBusy}
                        className="inline-flex flex-1 items-center justify-center rounded-2xl bg-sky-400 px-4 py-3 text-sm font-black text-zinc-950 hover:bg-sky-300 disabled:opacity-60"
                      >
                        {buyBusy ? 'Đang gửi…' : 'Gửi cho shop'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {complaintOpen ? (
        <div className="fixed inset-0 z-[90]">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => (complaintBusy ? null : setComplaintOpen(false))} />
          <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-[640px] -translate-x-1/2 -translate-y-1/2">
            <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-zinc-950/80 shadow-[0_40px_120px_-60px_rgba(0,0,0,0.95)] backdrop-blur-2xl">
              <div className="flex items-start justify-between gap-3 border-b border-white/10 px-6 py-5">
                <div>
                  <div className="text-lg font-black text-zinc-50">Gửi khiếu nại</div>
                  <div className="mt-1 text-sm text-zinc-300">Yêu cầu sẽ được gửi tới shop và admin để xử lý.</div>
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
                  <div className="text-xs font-semibold text-zinc-400">Mã booking (hoặc link booking)</div>
                  <input
                    value={complaintForm.bookingId}
                    onChange={(e) => setComplaintForm((p) => ({ ...p, bookingId: e.target.value }))}
                    disabled={complaintBusy}
                    placeholder="Ví dụ: 665f... hoặc https://.../booking/665f..."
                    className="w-full rounded-2xl border border-white/15 bg-zinc-950/70 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-sky-400/40"
                  />
                  <div className="text-[11px] text-zinc-500">Chỉ gửi được khi booking đã hoàn thành và thuộc shop này.</div>
                </label>
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
                    className="w-full resize-none rounded-2xl border border-white/15 bg-zinc-950/70 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-sky-400/40"
                    placeholder="Mô tả chi tiết vấn đề bạn gặp phải…"
                  />
                </label>
                <label className="block space-y-1">
                  <div className="text-xs font-semibold text-zinc-400">Bằng chứng (ảnh/video)</div>
                  <input
                    type="file"
                    multiple
                    accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
                    disabled={complaintBusy}
                    onChange={(e) => setComplaintForm((p) => ({ ...p, files: Array.from(e.target.files || []) }))}
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
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-amber-400 px-4 py-3 text-sm font-black text-zinc-950 hover:bg-amber-300 disabled:opacity-60"
                >
                  {complaintBusy ? 'Đang gửi…' : 'Gửi khiếu nại'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
};

export default Marketplace;
