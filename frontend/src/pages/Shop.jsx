import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch, getApiBaseUrl } from '../services/api/client.js';
import { useAuth } from '../services/auth/AuthContext.jsx';
import { useI18n } from '../services/i18n.jsx';
import { isInappropriateText, validateEmail, validateHumanName, validatePhone } from '../services/validation.js';

const toStatus = (raw) => String(raw || '').trim().toLowerCase() || 'pending';

const resolveAssetUrl = (url) => {
  const u = String(url || '').trim();
  if (!u) return '';
  if (u.startsWith('data:') || u.startsWith('blob:')) return u;
  if (u.startsWith('/9j/')) return `data:image/jpeg;base64,${u}`;
  if (u.startsWith('iVBORw0KGgo')) return `data:image/png;base64,${u}`;
  if (u.startsWith('R0lGOD')) return `data:image/gif;base64,${u}`;
  if (u.startsWith('UklGR')) return `data:image/webp;base64,${u}`;
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  const API_BASE_URL = getApiBaseUrl();
  if (u.startsWith('/')) return `${API_BASE_URL}${u}`;
  return `${API_BASE_URL}/${u}`;
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
  const hasAny = lat != null || lng != null;
  if (!hasAny) return { ok: true, locationLat: null, locationLng: null };
  const latNum = lat === '' || lat == null ? null : Number(lat);
  const lngNum = lng === '' || lng == null ? null : Number(lng);
  if (latNum == null && lngNum == null) return { ok: true, locationLat: null, locationLng: null };
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return { ok: false, locationLat: null, locationLng: null };
  if (latNum < -90 || latNum > 90) return { ok: false, locationLat: null, locationLng: null };
  if (lngNum < -180 || lngNum > 180) return { ok: false, locationLat: null, locationLng: null };
  return { ok: true, locationLat: latNum, locationLng: lngNum };
};

const Shop = ({ mode } = {}) => {
  const { token, isAuthed, user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const isApplyMode = String(mode || '').toLowerCase() === 'apply';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const isVendor = String(user?.role || '').toUpperCase() === 'VENDOR';

  const [shop, setShop] = useState(null);
  const [form, setForm] = useState({
    shopName: '',
    representativeName: '',
    province: '',
    description: '',
    phone: '',
    email: '',
    address: '',
    website: '',
    facebook: '',
    logo: '',
    coverImage: '',
    locationLat: null,
    locationLng: null
  });
  const [websiteError, setWebsiteError] = useState('');
  const [addressError, setAddressError] = useState('');
  const [applyError, setApplyError] = useState('');
  const [applyBusy, setApplyBusy] = useState(false);
  const [applyDone, setApplyDone] = useState(false);
  const [addressAuto, setAddressAuto] = useState(false);
  const [shopGpsBusy, setShopGpsBusy] = useState(false);
  const [shopGpsError, setShopGpsError] = useState('');
  const [shopGpsAuto, setShopGpsAuto] = useState(false);
  const shopGeocodeTimerRef = useRef(null);
  const shopGeocodeLastQueryRef = useRef('');
  const [bookingForm, setBookingForm] = useState({
    location: '',
    locationLat: null,
    locationLng: null,
    scheduleType: 'asap',
    scheduleAt: '',
    note: ''
  });
  const [bookingSubmitted, setBookingSubmitted] = useState(false);
  const [bookingSaving, setBookingSaving] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsError, setGpsError] = useState('');

  const toLocalDatetimeValue = (d) => {
    if (!d) return '';
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  };

  const load = async () => {
    if (!isAuthed) {
      setShop(null);
      setLoading(false);
      setError('');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch('/api/vendor/shop', { token });
      const item = data?.item || null;
      setShop(item);
      setForm({
        shopName: String(item?.shopName || ''),
        representativeName: String(item?.representativeName || ''),
        province: String(item?.province || ''),
        description: String(item?.description || ''),
        phone: String(item?.phone || ''),
        email: String(item?.email || ''),
        address: String(item?.address || ''),
        website: String(item?.website || ''),
        facebook: String(item?.facebook || ''),
        logo: String(item?.logo || ''),
        coverImage: String(item?.coverImage || ''),
        locationLat: typeof item?.locationLat === 'number' ? item.locationLat : null,
        locationLng: typeof item?.locationLng === 'number' ? item.locationLng : null
      });
      setShopGpsAuto(false);
      setAddressAuto(false);
      setWebsiteError('');
      setAddressError('');
      setApplyError('');
      setShopGpsError('');
      const pref = item?.bookingPreferences || null;
      setBookingForm((p) => ({
        ...p,
        location: String(pref?.locationText || ''),
        locationLat: typeof pref?.locationLat === 'number' ? pref.locationLat : null,
        locationLng: typeof pref?.locationLng === 'number' ? pref.locationLng : null,
        scheduleType: String(pref?.scheduleType || '').toLowerCase() === 'schedule' ? 'schedule' : 'asap',
        scheduleAt: toLocalDatetimeValue(pref?.scheduleAt),
        note: String(pref?.note || '')
      }));
    } catch (e) {
      setError(e?.message || 'FAILED_TO_LOAD');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [isAuthed, token]);

  useEffect(() => {
    if (!isApplyMode) return;
    if (!isVendor) return;
    navigate('/seller-center', { replace: true });
  }, [isApplyMode, isVendor, navigate]);

  const status = useMemo(() => toStatus(shop?.status), [shop?.status]);

  const statusBadge = useMemo(() => {
    if (status === 'approved') return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    if (status === 'rejected') return 'bg-red-500/15 text-red-300 border-red-500/30';
    return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  }, [status]);

  const buildShopPayload = () => {
    const addressRaw = String(form.address || '').trim();
    if (!addressRaw) {
      setAddressError(t('shop_address_required'));
      return null;
    }
    setAddressError('');

    const websiteRaw = String(form.website || '').trim();
    if (!websiteRaw) {
      setWebsiteError(t('shop_website_required'));
      return null;
    }
    const website = normalizeWebsite(websiteRaw);
    if (!website) {
      setWebsiteError(t('shop_website_invalid'));
      return null;
    }
    setWebsiteError('');

    const loc = normalizeLatLng({ lat: form.locationLat, lng: form.locationLng });
    const needsLocation = Boolean(addressRaw || form.locationLat != null || form.locationLng != null);
    if (needsLocation && (loc.locationLat == null || loc.locationLng == null)) {
      setShopGpsError(t('shop_location_required'));
      return null;
    }
    if (!loc.ok) {
      setShopGpsError(t('shop_location_invalid'));
      return null;
    }
    setShopGpsError('');

    const bookingLocationText = String(bookingForm.location || '').trim() || addressRaw;
    const bookingLocationLat = bookingForm.locationLat ?? loc.locationLat;
    const bookingLocationLng = bookingForm.locationLng ?? loc.locationLng;

    return {
      shopName: String(form.shopName || '').trim(),
      representativeName: String(form.representativeName || '').trim(),
      description: String(form.description || '').trim(),
      phone: String(form.phone || '').trim(),
      email: String(form.email || '').trim(),
      address: addressRaw,
      website,
      facebook: String(form.facebook || '').trim(),
      logo: String(form.logo || '').trim(),
      coverImage: String(form.coverImage || '').trim(),
      locationLat: loc.locationLat,
      locationLng: loc.locationLng,
      bookingPreferences: {
        locationText: bookingLocationText,
        locationLat: bookingLocationLat,
        locationLng: bookingLocationLng,
        scheduleType: bookingForm.scheduleType,
        scheduleAt: bookingForm.scheduleType === 'schedule' ? bookingForm.scheduleAt : null,
        note: String(bookingForm.note || '').trim()
      }
    };
  };

  const reverseShopAddress = async ({ lat, lng }) => {
    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return '';
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
        String(latNum)
      )}&lon=${encodeURIComponent(String(lngNum))}&zoom=18&addressdetails=1&accept-language=vi`;
      const resp = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!resp.ok) return '';
      const data = await resp.json().catch(() => null);
      return String(data?.display_name || '').trim();
    } catch {
      return '';
    }
  };

  const ensureShopCoordinates = async ({ force = false } = {}) => {
    const hasCoords = Number.isFinite(form.locationLat) && Number.isFinite(form.locationLng);
    if (hasCoords && (!force || !shopGpsAuto)) return true;
    const rawName = String(form.shopName || '').trim();
    const rawAddress = String(form.address || '').trim();
    const qBase = `${rawName} ${rawAddress}`.replace(/\s+/g, ' ').trim();
    const q = qBase ? `${qBase}, Vietnam` : '';
    if (!q) return false;

    setShopGpsError('');
    setShopGpsBusy(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=vn&addressdetails=1&accept-language=vi&q=${encodeURIComponent(
        q
      )}`;
      const resp = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!resp.ok) {
        setShopGpsError(t('shop_location_search_failed'));
        return false;
      }
      const data = await resp.json().catch(() => null);
      const first = Array.isArray(data) ? data[0] : null;
      const lat = Number(first?.lat);
      const lng = Number(first?.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        setShopGpsError(t('shop_location_not_found'));
        return false;
      }
      setForm((p) => ({ ...p, locationLat: lat, locationLng: lng }));
      setShopGpsAuto(true);
      shopGeocodeLastQueryRef.current = q;

      const candidate = String(first?.display_name || '').trim();
      const shouldFillAddress = !String(form.address || '').trim() || addressAuto;
      if (candidate && shouldFillAddress) {
        setAddressAuto(true);
        setForm((p) => ({ ...p, address: candidate }));
      } else if (shouldFillAddress) {
        const reverse = await reverseShopAddress({ lat, lng });
        if (reverse) {
          setAddressAuto(true);
          setForm((p) => ({ ...p, address: reverse }));
        }
      }
      return true;
    } catch {
      setShopGpsError(t('shop_location_search_failed'));
      return false;
    } finally {
      setShopGpsBusy(false);
    }
  };

  useEffect(() => {
    if (!isAuthed) return;
    if (loading || saving) return;
    if (shopGpsBusy) return;
    const shopName = String(form.shopName || '').trim();
    if (shopName.length < 3) return;
    const q = `${shopName} ${String(form.address || '').trim()}`.replace(/\s+/g, ' ').trim();
    if (!q) return;
    if (!(form.locationLat == null || form.locationLng == null || shopGpsAuto)) return;
    if (shopGeocodeLastQueryRef.current === q) return;

    if (shopGeocodeTimerRef.current) clearTimeout(shopGeocodeTimerRef.current);
    shopGeocodeTimerRef.current = setTimeout(() => {
      ensureShopCoordinates({ force: true });
    }, 800);

    return () => {
      if (shopGeocodeTimerRef.current) clearTimeout(shopGeocodeTimerRef.current);
    };
  }, [isAuthed, loading, saving, shopGpsBusy, shopGpsAuto, form.shopName, form.address, form.locationLat, form.locationLng]);

  useEffect(() => {
    if (form.locationLat == null || form.locationLng == null) return;
    if (!Number.isFinite(form.locationLat) || !Number.isFinite(form.locationLng)) return;
    if (!shopGpsError) return;
    setShopGpsError('');
  }, [form.locationLat, form.locationLng, shopGpsError]);

  const onSave = async (e) => {
    e.preventDefault();
    if (!isAuthed) return;
    setSaving(true);
    setError('');
    try {
      const addressRaw = String(form.address || '').trim();
      if (!addressRaw) {
        setAddressError(t('shop_address_required'));
        return;
      }
      const websiteRaw = String(form.website || '').trim();
      if (!websiteRaw) {
        setWebsiteError(t('shop_website_required'));
        return;
      }
      if (!Number.isFinite(form.locationLat) || !Number.isFinite(form.locationLng)) {
        const ok = await ensureShopCoordinates();
        if (!ok) return;
      }
      const payload = buildShopPayload();
      if (!payload) return;
      const data = await apiFetch('/api/vendor/shop', { token, method: 'PUT', body: payload });
      setShop(data?.item || null);
      await load();
      const vendorId = String(data?.item?._id || '');
      if (vendorId) {
        navigate(`/marketplace?vendor=${encodeURIComponent(vendorId)}`, { state: { vendor: data?.item || null } });
      }
    } catch (e2) {
      setError(e2?.message || 'SAVE_FAILED');
    } finally {
      setSaving(false);
    }
  };

  const onPickGps = () => {
    setGpsError('');
    if (!navigator?.geolocation) {
      setGpsError(t('shop_booking_gps_unavailable'));
      return;
    }
    setGpsBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos?.coords?.latitude);
        const lng = Number(pos?.coords?.longitude);
        setBookingForm((p) => ({
          ...p,
          locationLat: Number.isFinite(lat) ? lat : null,
          locationLng: Number.isFinite(lng) ? lng : null
        }));
        setGpsBusy(false);
      },
      (err) => {
        setGpsError(String(err?.message || 'GPS_ERROR'));
        setGpsBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  };

  const onPickShopGps = () => {
    setShopGpsError('');
    const q = `${String(form.shopName || '').trim()} ${String(form.address || '').trim()}`.replace(/\s+/g, ' ').trim();

    if (q) {
      ensureShopCoordinates({ force: true });
      return;
    }

    if (!navigator?.geolocation) {
      setShopGpsError(t('shop_booking_gps_unavailable'));
      return;
    }
    setShopGpsBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos?.coords?.latitude);
        const lng = Number(pos?.coords?.longitude);
        setShopGpsAuto(false);
        setShopGpsError('');
        setForm((p) => ({
          ...p,
          locationLat: Number.isFinite(lat) ? lat : null,
          locationLng: Number.isFinite(lng) ? lng : null
        }));
        setShopGpsBusy(false);
      },
      (err) => {
        setShopGpsError(String(err?.message || 'GPS_ERROR'));
        setShopGpsBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  };

  const onSubmitBooking = async (e) => {
    e.preventDefault();
    if (!isAuthed) return;
    setBookingSaving(true);
    setGpsError('');
    setCreateError('');
    setError('');
    try {
      const addressRaw = String(form.address || '').trim();
      if (!addressRaw) {
        setAddressError(t('shop_address_required'));
        return;
      }
      const websiteRaw = String(form.website || '').trim();
      if (!websiteRaw) {
        setWebsiteError(t('shop_website_required'));
        return;
      }
      if (!Number.isFinite(form.locationLat) || !Number.isFinite(form.locationLng)) {
        const ok = await ensureShopCoordinates();
        if (!ok) return;
      }
      const payload = buildShopPayload();
      if (!payload) return;
      const data = await apiFetch('/api/vendor/shop', { token, method: 'PUT', body: payload });
      setShop(data?.item || null);
      setBookingSubmitted(true);
      await load();
    } catch (e2) {
      setError(e2?.message || 'SAVE_FAILED');
      setBookingSubmitted(false);
    } finally {
      setBookingSaving(false);
    }
  };

  const onSubmitApply = async (e) => {
    e.preventDefault();
    const shopName = String(form.shopName || '').trim();
    const representativeName = String(form.representativeName || '').trim();
    const province = String(form.province || '').trim();
    const phone = String(form.phone || '').trim();
    const email = String(form.email || '').trim();

    if (applyBusy) return;
    setApplyBusy(true);
    setApplyError('');
    setApplyDone(false);
    try {
      if (!shopName) {
        setApplyError('Vui lòng nhập tên xưởng.');
        return;
      }
      if (isInappropriateText(shopName)) {
        setApplyError('Tên xưởng không phù hợp. Vui lòng nhập tên lịch sự.');
        return;
      }
      if (!representativeName) {
        setApplyError('Vui lòng nhập tên người đại diện.');
        return;
      }
      const checkedRep = validateHumanName(representativeName);
      if (!checkedRep.ok) {
        setApplyError(checkedRep.error);
        return;
      }
      if (!province) {
        setApplyError('Vui lòng nhập tỉnh/thành.');
        return;
      }
      const checkedPhone = validatePhone(phone);
      if (!checkedPhone.ok) {
        setApplyError(checkedPhone.error);
        return;
      }
      const checkedEmail = validateEmail(email);
      if (!checkedEmail.ok) {
        setApplyError(checkedEmail.error);
        return;
      }

      if (isAuthed) {
        const data = await apiFetch('/api/vendor/shop', {
          token,
          method: 'PUT',
          body: { shopName, representativeName: checkedRep.value, province, phone: checkedPhone.value, email: checkedEmail.value }
        });
        setShop(data?.item || null);
        await load();
      } else {
        await apiFetch('/api/vendors/apply', {
          method: 'POST',
          body: { shopName, representativeName: checkedRep.value, province, phone: checkedPhone.value, email: checkedEmail.value }
        });
      }
      try {
        localStorage.setItem('carbanana_b2b_pending_vendor', '1');
      } catch {}
      setApplyDone(true);
    } catch (e2) {
      setApplyError(e2?.message || 'Gửi thông tin thất bại.');
      setApplyDone(false);
    } finally {
      setApplyBusy(false);
    }
  };

  if (isApplyMode && isVendor) return null;

  if (!isVendor) {
    if (isApplyMode) {
      return (
        <div className="-mx-4 -my-6 relative min-h-[100svh] overflow-hidden bg-black">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-gradient-to-b from-black via-[#070a10] to-black" />
            <div className="absolute inset-0 opacity-[0.10] [background-image:linear-gradient(transparent_97%,rgba(255,255,255,0.10)_98%),linear-gradient(90deg,transparent_97%,rgba(255,255,255,0.10)_98%)] [background-size:22px_22px]" />
            <div className="absolute -left-56 -top-56 h-[40rem] w-[40rem] rounded-full bg-sky-500/12 blur-[140px]" />
            <div className="absolute -right-56 top-10 h-[36rem] w-[36rem] rounded-full bg-cyan-500/10 blur-[150px]" />
            <div className="absolute bottom-[-220px] left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.16)_0%,transparent_62%)] blur-3xl" />
          </div>

          <div className="relative mx-auto flex min-h-[100svh] w-full max-w-6xl items-center px-4 py-10">
            <div className="w-full grid gap-8 lg:grid-cols-12 lg:gap-10">
              <div className="lg:col-span-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-zinc-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_14px_rgba(14,165,233,0.55)]" />
                  {t('lp_cta_partner_shop')}
                </div>

                <h1 className="mt-4 text-3xl font-black tracking-tight text-zinc-50 sm:text-5xl">Đăng ký xưởng đối tác</h1>
                <div className="mt-3 max-w-xl text-sm text-zinc-300 sm:text-base">
                  Tham gia mạng lưới xưởng đối tác để nhận booking, hiển thị trên Marketplace và tăng độ uy tín cho shop.
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs font-semibold tracking-wider text-sky-300/90">QUY TRÌNH</div>
                    <div className="mt-2 text-sm font-semibold text-zinc-100">3 bước</div>
                    <div className="mt-1 text-xs text-zinc-400">Điền → Xác minh → Duyệt</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs font-semibold tracking-wider text-sky-300/90">HỖ TRỢ</div>
                    <div className="mt-2 text-sm font-semibold text-zinc-100">CSKH</div>
                    <div className="mt-1 text-xs text-zinc-400">Liên hệ khi cần</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs font-semibold tracking-wider text-sky-300/90">BẢO MẬT</div>
                    <div className="mt-2 text-sm font-semibold text-zinc-100">Thông tin</div>
                    <div className="mt-1 text-xs text-zinc-400">Chỉ dùng để xét duyệt</div>
                  </div>
                </div>

                <div className="mt-8 space-y-3">
                  <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-2xl border border-sky-500/25 bg-sky-500/12 text-sky-200 shadow-[0_0_24px_rgba(56,189,248,0.22)]">
                      1
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-zinc-50">Điền thông tin cơ bản</div>
                      <div className="mt-1 text-xs text-zinc-400">Tên xưởng, người đại diện, SĐT, Gmail shop.</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-2xl border border-sky-500/25 bg-sky-500/12 text-sky-200 shadow-[0_0_24px_rgba(56,189,248,0.22)]">
                      2
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-zinc-50">Xác minh & xét duyệt</div>
                      <div className="mt-1 text-xs text-zinc-400">Hệ thống sẽ kiểm tra và liên hệ nếu cần bổ sung.</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-2xl border border-sky-500/25 bg-sky-500/12 text-sky-200 shadow-[0_0_24px_rgba(56,189,248,0.22)]">
                      3
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-zinc-50">Bật tính năng xưởng</div>
                      <div className="mt-1 text-xs text-zinc-400">Sau khi duyệt, shop sẽ có Seller Center để quản lý.</div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-center gap-4 text-sm">
                  <Link to="/" className="font-semibold text-zinc-300 hover:text-white">
                    Về trang chủ
                  </Link>
                  <span className="text-zinc-600">•</span>
                  <Link to="/marketplace" className="font-semibold text-sky-300 hover:text-sky-200">
                    Xem Marketplace
                  </Link>
                </div>
              </div>

              <div className="lg:col-span-6">
                <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/60 p-6 shadow-[0_26px_90px_rgba(0,0,0,0.70),0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur-2xl sm:p-8">
                  <div className="pointer-events-none absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_32%_18%,rgba(255,255,255,0.10),transparent_52%)]" />

                  <div className="relative">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-xs font-semibold tracking-[0.22em] text-cyan-300/90">PARTNER ONBOARDING</div>
                        <div className="mt-2 text-xl font-black tracking-tight text-zinc-50 sm:text-2xl">Thông tin xưởng</div>
                        <div className="mt-2 text-sm text-zinc-400">Điền đúng để hệ thống liên hệ và xét duyệt nhanh.</div>
                      </div>
                      {shop ? (
                        <div className={`shrink-0 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${statusBadge}`}>
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          <span>{status}</span>
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-6">
                      {loading ? <div className="text-sm text-zinc-400">{t('common_loading')}</div> : null}

                      {!loading ? (
                        <form onSubmit={onSubmitApply} className="space-y-4">
                          {isAuthed ? (
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
                              Đăng nhập bằng: <span className="font-semibold text-zinc-100">{String(user?.email || '').trim() || '—'}</span>
                            </div>
                          ) : null}

                          {applyDone ? (
                            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-950/25 p-4 text-sm text-emerald-200">
                              <div className="font-semibold">Cảm ơn bạn đã đăng ký</div>
                              <div className="mt-1 text-xs text-emerald-200/80">Chúng tôi đã nhận được thông tin và sẽ liên hệ sớm để xác minh.</div>
                              <div className="mt-3 flex flex-wrap items-center gap-3">
                                <Link to="/" className="text-sm font-semibold text-zinc-200 hover:text-white">
                                  Về trang chủ
                                </Link>
                                <Link to="/dashboard" className="text-sm font-semibold text-sky-300 hover:text-sky-200">
                                  Vào Dashboard
                                </Link>
                              </div>
                            </div>
                          ) : null}

                          {!applyDone ? (
                            <>
                              {applyError ? (
                                <div className="rounded-2xl border border-red-500/25 bg-red-950/30 p-4 text-sm text-red-200">{applyError}</div>
                              ) : null}

                              <div className="grid gap-4 sm:grid-cols-2">
                                <label className="block sm:col-span-2">
                                  <div className="mb-1 text-sm font-semibold text-zinc-200">Tên xưởng</div>
                                  <input
                                    value={form.shopName}
                                    onChange={(e) => setForm((p) => ({ ...p, shopName: e.target.value }))}
                                    className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                                    placeholder="VD: Xưởng Minh Tâm"
                                    required
                                  />
                                </label>

                                <label className="block sm:col-span-2">
                                  <div className="mb-1 text-sm font-semibold text-zinc-200">Người đại diện</div>
                                  <input
                                    value={form.representativeName}
                                    onChange={(e) => setForm((p) => ({ ...p, representativeName: e.target.value }))}
                                    className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                                    placeholder="VD: Nguyễn Văn A"
                                    required
                                  />
                                </label>

                                <label className="block sm:col-span-2">
                                  <div className="mb-1 text-sm font-semibold text-zinc-200">Tỉnh/Thành</div>
                                  <input
                                    value={form.province}
                                    onChange={(e) => setForm((p) => ({ ...p, province: e.target.value }))}
                                    className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                                    placeholder="VD: TP. Hồ Chí Minh"
                                    required
                                  />
                                </label>

                                <label className="block">
                                  <div className="mb-1 text-sm font-semibold text-zinc-200">Số điện thoại</div>
                                  <input
                                    value={form.phone}
                                    onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                                    className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                                    inputMode="tel"
                                    placeholder="VD: 09xxxxxxxx"
                                    required
                                  />
                                </label>

                                <label className="block">
                                  <div className="mb-1 text-sm font-semibold text-zinc-200">Gmail shop</div>
                                  <input
                                    type="email"
                                    value={form.email}
                                    onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                                    className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                                    placeholder="VD: shop@gmail.com"
                                    required
                                  />
                                </label>
                              </div>

                              <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-end">
                                <button
                                  type="submit"
                                  disabled={applyBusy}
                                  className={`inline-flex w-full items-center justify-center whitespace-nowrap rounded-2xl px-6 py-4 text-lg font-black transition ${
                                    applyBusy
                                      ? 'border border-white/10 bg-white/5 text-zinc-400'
                                      : 'bg-gradient-to-r from-sky-400 to-cyan-300 text-zinc-950 shadow-[0_16px_50px_-34px_rgba(56,189,248,0.75)] hover:brightness-110 hover:shadow-[0_0_24px_rgba(14,165,233,0.45)] focus:outline-none focus:ring-2 focus:ring-sky-400/30'
                                  }`}
                                >
                                  {applyBusy ? t('common_loading') : 'Nhận tư vấn miễn phí'}
                                </button>
                              </div>
                            </>
                          ) : null}
                        </form>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="rounded-3xl border border-zinc-800/70 bg-zinc-950/50 p-6 backdrop-blur-xl">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-sm font-semibold text-sky-300">{t('lp_cta_partner_shop')}</div>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-zinc-50 sm:text-3xl">Đăng ký xưởng đối tác</h1>
              <div className="mt-2 max-w-2xl text-sm text-zinc-400">Điền thông tin để gửi yêu cầu trở thành xưởng đối tác.</div>
            </div>
            {shop ? (
              <div className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${statusBadge}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                <span>{status}</span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-800/70 bg-zinc-950/50 p-6 backdrop-blur-xl">
          {loading ? <div className="text-sm text-zinc-400">{t('common_loading')}</div> : null}

          {!loading ? (
            <form onSubmit={onSubmitApply} className="space-y-4">
              {applyDone ? (
                <div className="rounded-2xl border border-emerald-500/25 bg-emerald-950/25 p-4 text-sm text-emerald-200">
                  Cảm ơn bạn đã đăng ký. Chúng tôi đã nhận được thông tin và sẽ liên hệ sớm để xác minh.
                </div>
              ) : null}

              {applyError ? (
                <div className="rounded-2xl border border-red-500/25 bg-red-950/30 p-4 text-sm text-red-200">{applyError}</div>
              ) : null}

              {!applyDone ? (
                <>
                  <label className="block">
                    <div className="mb-1 text-sm text-zinc-300">Tên xưởng</div>
                    <input
                      value={form.shopName}
                      onChange={(e) => setForm((p) => ({ ...p, shopName: e.target.value }))}
                      className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                      placeholder="VD: Xưởng Minh Tâm"
                      required
                    />
                  </label>

                  <label className="block">
                    <div className="mb-1 text-sm text-zinc-300">Người đại diện</div>
                    <input
                      value={form.representativeName}
                      onChange={(e) => setForm((p) => ({ ...p, representativeName: e.target.value }))}
                      className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                      placeholder="VD: Nguyễn Văn A"
                      required
                    />
                  </label>

                  <label className="block">
                    <div className="mb-1 text-sm text-zinc-300">Tỉnh/Thành</div>
                    <input
                      value={form.province}
                      onChange={(e) => setForm((p) => ({ ...p, province: e.target.value }))}
                      className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                      placeholder="VD: TP. Hồ Chí Minh"
                      required
                    />
                  </label>

                  <label className="block">
                    <div className="mb-1 text-sm text-zinc-300">Số điện thoại</div>
                    <input
                      value={form.phone}
                      onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                      className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                      placeholder="VD: 09xxxxxxxx"
                      required
                    />
                  </label>

                  <label className="block">
                    <div className="mb-1 text-sm text-zinc-300">Gmail shop</div>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                      className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                      placeholder="VD: shop@gmail.com"
                      required
                    />
                  </label>

                  <div className="flex items-center justify-end">
                    <button
                      type="submit"
                      disabled={applyBusy}
                      className={`w-full whitespace-nowrap rounded-xl px-5 py-3 text-sm font-black transition ${
                        applyBusy
                          ? 'border border-white/10 bg-white/5 text-zinc-400'
                          : 'bg-gradient-to-r from-sky-400 to-cyan-300 text-zinc-950 hover:brightness-110'
                      }`}
                    >
                      {applyBusy ? t('common_loading') : 'Nhận tư vấn miễn phí'}
                    </button>
                  </div>
                </>
              ) : null}
            </form>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-zinc-800/70 bg-zinc-950/50 p-6 backdrop-blur-xl">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-sm font-semibold text-sky-300">{t('nav_shop')}</div>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-zinc-50 sm:text-3xl">{t('shop_b2b_title')}</h1>
            <div className="mt-2 max-w-2xl text-sm text-zinc-400">{t('shop_b2b_desc')}</div>
          </div>
          {shop ? (
            <div className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${statusBadge}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              <span>{status}</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-3xl border border-zinc-800/70 bg-zinc-950/50 p-6 backdrop-blur-xl">
        <div className="text-sm font-bold tracking-wide text-zinc-100">{t('seller_sidebar_title')}</div>
        <div className="mt-1 text-sm text-zinc-400">{t('shop_b2b_seller_center_desc')}</div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            to="/seller-center"
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-sky-400 to-cyan-300 px-4 py-2 text-xs font-black text-zinc-950 hover:brightness-110"
          >
            {t('shop_b2b_open_seller_center')}
          </Link>
          <Link
            to="/marketplace"
            className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-zinc-200 hover:bg-white/10"
          >
            {t('shop_b2b_view_marketplace')}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Shop;
