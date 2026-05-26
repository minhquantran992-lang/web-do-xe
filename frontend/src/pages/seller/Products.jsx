import { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, getApiBaseUrl } from '../../services/api/client.js';
import { useAuth } from '../../services/auth/AuthContext.jsx';
import { useI18n } from '../../services/i18n.jsx';
import { humanizeImageUploadError, isInappropriateText, validatePhone } from '../../services/validation.js';

const cx = (...arr) => arr.filter(Boolean).join(' ');

const resolveAssetUrl = (url) => {
  const API_BASE_URL = getApiBaseUrl();
  const u = String(url || '').trim();
  if (!u) return '';
  if (u.startsWith('data:') || u.startsWith('blob:')) return u;
  if (u.startsWith('/9j/')) return `data:image/jpeg;base64,${u}`;
  if (u.startsWith('iVBORw0KGgo')) return `data:image/png;base64,${u}`;
  if (u.startsWith('R0lGOD')) return `data:image/gif;base64,${u}`;
  if (u.startsWith('UklGR')) return `data:image/webp;base64,${u}`;
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  if (u.startsWith('/')) return `${API_BASE_URL}${u}`;
  return `${API_BASE_URL}/${u}`;
};

const timeToMin = (v) => {
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

const ShopProfile = ({ onSaved }) => {
  const { token } = useAuth();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [initial, setInitial] = useState(null);
  const [form, setForm] = useState({
    shopName: '',
    address: '',
    phone: '',
    logo: '',
    coverImage: '',
    workingStart: '',
    workingEnd: '',
    breakStart: '',
    breakEnd: '',
    maxSlots: '3',
    mechanicCount: '1'
  });
  const logoPickerRef = useRef(null);
  const coverPickerRef = useRef(null);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await apiFetch('/api/vendor/shop', { token });
        if (!alive) return;
        const item = data?.item || null;
        setInitial(item);
        const pref = item?.bookingPreferences || null;
        const cap = pref?.capacity || null;
        setForm({
          shopName: String(item?.shopName || '').trim(),
          address: String(item?.address || '').trim(),
          phone: String(item?.phone || '').trim(),
          logo: String(item?.logo || '').trim(),
          coverImage: String(item?.coverImage || '').trim(),
          workingStart: String(pref?.workingHours?.start || '').trim(),
          workingEnd: String(pref?.workingHours?.end || '').trim(),
          breakStart: String(pref?.breakHours?.start || '').trim(),
          breakEnd: String(pref?.breakHours?.end || '').trim(),
          maxSlots: String(Number(cap?.maxSlots) || 3),
          mechanicCount: String(Number(cap?.mechanicCount) || 1)
        });
      } catch (e) {
        if (!alive) return;
        setError(e?.message || 'FAILED_TO_LOAD');
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [token]);

  const canSave = useMemo(() => Boolean(String(form.shopName || '').trim()), [form.shopName]);

  const uploadShopImage = async (file) => {
    if (!token || !file) return '';
    const base = getApiBaseUrl();
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${base}/api/vendor/shop/upload-image`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = data?.error || 'UPLOAD_FAILED';
      throw new Error(msg);
    }
    return String(data?.url || '').trim();
  };

  const save = async () => {
    if (!token || saving || !canSave) return;
    const ws = String(form.workingStart || '').trim();
    const we = String(form.workingEnd || '').trim();
    const bs = String(form.breakStart || '').trim();
    const be = String(form.breakEnd || '').trim();
    const maxSlots = Math.floor(Number(form.maxSlots));
    const mechanicCount = Math.floor(Number(form.mechanicCount));
    if (!Number.isFinite(maxSlots) || maxSlots < 1) {
      setError('Số slot phải lớn hơn 0.');
      return;
    }
    if (!Number.isFinite(mechanicCount) || mechanicCount < 1) {
      setError('Số thợ phải lớn hơn 0.');
      return;
    }
    if ((ws && !we) || (!ws && we)) {
      setError(t('shop_working_hours_invalid'));
      return;
    }
    if ((bs && !be) || (!bs && be)) {
      setError(t('shop_break_hours_invalid'));
      return;
    }
    if (ws && we) {
      const wsMin = timeToMin(ws);
      const weMin = timeToMin(we);
      if (wsMin == null || weMin == null || wsMin >= weMin) {
        setError(t('shop_working_hours_invalid'));
        return;
      }
      if (bs && be) {
        const bsMin = timeToMin(bs);
        const beMin = timeToMin(be);
        if (bsMin == null || beMin == null || bsMin >= beMin) {
          setError(t('shop_break_hours_invalid'));
          return;
        }
        if (bsMin < wsMin || beMin > weMin) {
          setError(t('shop_break_outside_working'));
          return;
        }
      }
    } else if (bs && be) {
      const bsMin = timeToMin(bs);
      const beMin = timeToMin(be);
      if (bsMin == null || beMin == null || bsMin >= beMin) {
        setError(t('shop_break_hours_invalid'));
        return;
      }
    }
    const shopName = String(form.shopName || '').trim();
    if (shopName && isInappropriateText(shopName)) {
      setError('Tên xưởng không phù hợp. Vui lòng nhập tên lịch sự.');
      return;
    }
    const phoneRaw = String(form.phone || '').trim();
    const checkedPhone = phoneRaw ? validatePhone(phoneRaw) : { ok: true, value: '' };
    if (!checkedPhone.ok) {
      setError(checkedPhone.error);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const prefPrev = initial?.bookingPreferences || {};
      await apiFetch('/api/vendor/shop', {
        token,
        method: 'PUT',
        body: {
          shopName,
          address: String(form.address || '').trim(),
          phone: checkedPhone.value,
          logo: String(form.logo || '').trim(),
          coverImage: String(form.coverImage || '').trim(),
          representativeName: String(initial?.representativeName || '').trim(),
          province: String(initial?.province || '').trim(),
          description: String(initial?.description || '').trim(),
          email: String(initial?.email || '').trim(),
          website: String(initial?.website || '').trim(),
          facebook: String(initial?.facebook || '').trim(),
          locationLat: typeof initial?.locationLat === 'number' ? initial.locationLat : null,
          locationLng: typeof initial?.locationLng === 'number' ? initial.locationLng : null,
          bookingPreferences: {
            acceptingBookings: prefPrev?.acceptingBookings,
            locationText: String(prefPrev?.locationText || '').trim(),
            locationLat: typeof prefPrev?.locationLat === 'number' ? prefPrev.locationLat : null,
            locationLng: typeof prefPrev?.locationLng === 'number' ? prefPrev.locationLng : null,
            scheduleType: String(prefPrev?.scheduleType || '').trim(),
            scheduleAt: prefPrev?.scheduleAt || null,
            note: String(prefPrev?.note || '').trim(),
            timezone: String(prefPrev?.timezone || '').trim(),
            workingDays: Array.isArray(prefPrev?.workingDays) ? prefPrev.workingDays : [],
            closedDate: String(prefPrev?.closedDate || '').trim(),
            capacity: { maxSlots, mechanicCount },
            workingHours: { start: ws, end: we },
            breakHours: { start: bs, end: be }
          }
        }
      });

      setToast(t('seller_toast_profile_saved'));
      window.setTimeout(() => setToast(''), 3000);
      if (typeof onSaved === 'function') onSaved(String(form.shopName || '').trim());

      const data = await apiFetch('/api/vendor/shop', { token });
      setInitial(data?.item || null);
    } catch (e) {
      const msg = String(e?.message || 'FAILED_TO_SAVE');
      if (msg === 'INVALID_MAX_SLOTS') setError('Số slot phải lớn hơn 0.');
      else if (msg === 'INVALID_MECHANIC_COUNT') setError('Số thợ phải lớn hơn 0.');
      else setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-zinc-800/70 bg-zinc-950/50 p-6 backdrop-blur-xl">
        <div className="text-sm font-bold text-zinc-50">{t('shop_profile_title')}</div>
        <div className="mt-1 text-xs text-zinc-400">{t('seller_profile_desc')}</div>
      </div>

      {toast ? (
        <div className="rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm font-semibold text-sky-100">{toast}</div>
      ) : null}
      {error ? <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-zinc-800/70 bg-zinc-950/50 p-5 backdrop-blur-xl">
          <div className="grid gap-4">
            <label className="space-y-1">
              <div className="text-xs font-semibold text-zinc-400">{t('shop_shop_name')}</div>
              <input
                value={form.shopName}
                onChange={(e) => setForm((p) => ({ ...p, shopName: e.target.value }))}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-sky-400/40"
              />
            </label>

            <label className="space-y-1">
              <div className="text-xs font-semibold text-zinc-400">{t('shop_address')}</div>
              <input
                value={form.address}
                onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-sky-400/40"
              />
            </label>

            <label className="space-y-1">
              <div className="text-xs font-semibold text-zinc-400">{t('shop_phone')}</div>
              <input
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-sky-400/40"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <div className="text-xs font-semibold text-zinc-400">{t('shop_working_hours_from')}</div>
                <input
                  type="time"
                  value={form.workingStart}
                  onChange={(e) => setForm((p) => ({ ...p, workingStart: e.target.value }))}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-sky-400/40"
                />
              </label>
              <label className="space-y-1">
                <div className="text-xs font-semibold text-zinc-400">{t('shop_working_hours_to')}</div>
                <input
                  type="time"
                  value={form.workingEnd}
                  onChange={(e) => setForm((p) => ({ ...p, workingEnd: e.target.value }))}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-sky-400/40"
                />
              </label>
              <label className="space-y-1">
                <div className="text-xs font-semibold text-zinc-400">{t('shop_break_hours_from')}</div>
                <input
                  type="time"
                  value={form.breakStart}
                  onChange={(e) => setForm((p) => ({ ...p, breakStart: e.target.value }))}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-sky-400/40"
                />
              </label>
              <label className="space-y-1">
                <div className="text-xs font-semibold text-zinc-400">{t('shop_break_hours_to')}</div>
                <input
                  type="time"
                  value={form.breakEnd}
                  onChange={(e) => setForm((p) => ({ ...p, breakEnd: e.target.value }))}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-sky-400/40"
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <div className="text-xs font-semibold text-zinc-400">Số slot tối đa (xe làm cùng lúc)</div>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.maxSlots}
                  onChange={(e) => setForm((p) => ({ ...p, maxSlots: e.target.value }))}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-sky-400/40"
                />
              </label>
              <label className="space-y-1">
                <div className="text-xs font-semibold text-zinc-400">Số thợ</div>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.mechanicCount}
                  onChange={(e) => setForm((p) => ({ ...p, mechanicCount: e.target.value }))}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-sky-400/40"
                />
              </label>
              {Number(form.mechanicCount) > 0 && Number(form.maxSlots) >= Number(form.mechanicCount) * 5 ? (
                <div className="sm:col-span-2 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                  Cảnh báo: số thợ ít so với số slot (không chặn đặt lịch).
                </div>
              ) : null}
              <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold text-zinc-400">{t('shop_logo_url')}</div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => logoPickerRef.current?.click()}
                      className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-bold text-zinc-100 hover:bg-white/10"
                    >
                      Chọn file
                    </button>
                    {form.logo ? (
                      <button
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, logo: '' }))}
                        className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-200 hover:bg-rose-500/15"
                      >
                        Xoá
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900">
                    {resolveAssetUrl(form.logo) ? <img alt="" src={resolveAssetUrl(form.logo)} className="h-full w-full object-cover" /> : null}
                  </div>
                  <input
                    value={form.logo}
                    onChange={(e) => setForm((p) => ({ ...p, logo: e.target.value }))}
                    placeholder="https://… hoặc /uploads/…"
                    className="w-full flex-1 rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-sky-400/40"
                  />
                </div>

                <input
                  ref={logoPickerRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setError('');
                    try {
                      const url = await uploadShopImage(file);
                      setForm((p) => ({ ...p, logo: url }));
                    } catch (err) {
                      setError(humanizeImageUploadError(err));
                    } finally {
                      e.target.value = '';
                    }
                  }}
                  className="hidden"
                />
                <div className="text-[11px] font-semibold text-zinc-500">PNG/JPG/WEBP • tối đa 10MB</div>
                <div className="text-[11px] font-semibold text-zinc-500">Ảnh sẽ được kiểm duyệt. Ảnh nhạy cảm sẽ bị từ chối.</div>
              </div>

              <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold text-zinc-400">{t('shop_cover_url')}</div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => coverPickerRef.current?.click()}
                      className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-bold text-zinc-100 hover:bg-white/10"
                    >
                      Chọn file
                    </button>
                    {form.coverImage ? (
                      <button
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, coverImage: '' }))}
                        className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-200 hover:bg-rose-500/15"
                      >
                        Xoá
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-10 w-16 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900">
                    {resolveAssetUrl(form.coverImage) ? (
                      <img alt="" src={resolveAssetUrl(form.coverImage)} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <input
                    value={form.coverImage}
                    onChange={(e) => setForm((p) => ({ ...p, coverImage: e.target.value }))}
                    placeholder="https://… hoặc /uploads/…"
                    className="w-full flex-1 rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-sky-400/40"
                  />
                </div>

                <input
                  ref={coverPickerRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setError('');
                    try {
                      const url = await uploadShopImage(file);
                      setForm((p) => ({ ...p, coverImage: url }));
                    } catch (err) {
                      setError(humanizeImageUploadError(err));
                    } finally {
                      e.target.value = '';
                    }
                  }}
                  className="hidden"
                />
                <div className="text-[11px] font-semibold text-zinc-500">PNG/JPG/WEBP • tối đa 10MB</div>
                <div className="text-[11px] font-semibold text-zinc-500">Ảnh sẽ được kiểm duyệt. Ảnh nhạy cảm sẽ bị từ chối.</div>
              </div>
            </div>

            <button
              type="button"
              disabled={saving || !canSave}
              onClick={save}
              className="w-full rounded-2xl bg-gradient-to-r from-sky-400 to-cyan-300 px-4 py-2.5 text-sm font-black text-zinc-950 hover:brightness-110 disabled:opacity-60"
            >
              {saving ? t('common_processing') : t('common_save')}
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-zinc-800/70 bg-zinc-950/50 backdrop-blur-xl">
          <div className="border-b border-white/10 px-5 py-4">
            <div className="text-sm font-bold text-zinc-50">{t('seller_profile_preview_title')}</div>
            <div className="mt-1 text-xs text-zinc-400">{t('seller_profile_preview_desc')}</div>
          </div>
          <div className="p-5">
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5">
              {resolveAssetUrl(form.coverImage) ? (
                <img alt="" src={resolveAssetUrl(form.coverImage)} className="h-28 w-full object-cover" />
              ) : (
                <div className="h-28 w-full bg-white/5" />
              )}
              <div className="flex items-center gap-3 p-4">
                <div className="h-12 w-12 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900">
                  {resolveAssetUrl(form.logo) ? <img alt="" src={resolveAssetUrl(form.logo)} className="h-full w-full object-cover" /> : null}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-extrabold text-zinc-100">{String(form.shopName || '—')}</div>
                  <div className="mt-1 truncate text-xs font-semibold text-zinc-400">{String(form.address || '—')}</div>
                  <div className="mt-0.5 truncate text-xs text-zinc-500">{String(form.phone || '—')}</div>
                </div>
              </div>
            </div>

            {loading ? <div className="mt-4 text-sm text-zinc-500">{t('common_loading')}</div> : null}
            {!loading && !initial ? (
              <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                {t('seller_profile_empty_hint')}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShopProfile;
