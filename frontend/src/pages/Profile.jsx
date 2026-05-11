import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../services/auth/AuthContext.jsx';
import { getMe, updateMe, uploadMyAvatar } from '../services/api/auth.js';
import { getApiBaseUrl } from '../services/api/client.js';
import { useI18n } from '../services/i18n.jsx';
import { validateHumanName } from '../services/validation.js';

const resolveUploadUrl = (url) => {
  const API_BASE_URL = getApiBaseUrl();
  const u = String(url || '').trim();
  if (!u) return '';
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  if (u.startsWith('/')) return `${API_BASE_URL}${u}`;
  return `${API_BASE_URL}/${u}`;
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

const normalizeKey = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim();

const normalizeGender = (value) => {
  const k = normalizeKey(value);
  if (!k) return '';
  if (k === 'male' || k === 'nam') return 'male';
  if (k === 'female' || k === 'nu') return 'female';
  return '';
};

const daysInMonth = (year, month) => {
  const y = Number(year);
  const m = Number(month);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return 31;
  const d = new Date(y, m, 0).getDate();
  return Number.isFinite(d) ? d : 31;
};

const splitDob = (value) => {
  const raw = String(value || '').trim();
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return { year: '', month: '', day: '' };
  return { year: m[1], month: m[2], day: m[3] };
};

const Profile = () => {
  const { t } = useI18n();
  const { token, user, setAuth } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [dobYear, setDobYear] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobDay, setDobDay] = useState('');
  const [gender, setGender] = useState('');
  const [country, setCountry] = useState('');
  const [countryAuto, setCountryAuto] = useState(true);
  const [avatarFile, setAvatarFile] = useState(null);
  const inputRef = useRef(null);

  const avatarFilename = useMemo(() => {
    if (!avatarFile) return '';
    const f = avatarFile;
    return String(f?.name || '').trim();
  }, [avatarFile]);

  const avatarUrl = useMemo(() => {
    const nextLocal = avatarFile ? URL.createObjectURL(avatarFile) : '';
    if (nextLocal) return nextLocal;
    return resolveUploadUrl(user?.avatar || '');
  }, [avatarFile, user?.avatar]);

  useEffect(() => {
    return () => {
      if (avatarFile) URL.revokeObjectURL(avatarUrl);
    };
  }, [avatarFile, avatarUrl]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');

    getMe({ token })
      .then((me) => {
        if (!alive) return;
        const u = me?.user || null;
        setName(String(u?.name || ''));
        const parts = splitDob(toDateInputValue(u?.dob));
        setDobYear(parts.year);
        setDobMonth(parts.month);
        setDobDay(parts.day);
        setGender(normalizeGender(u?.gender));
        const serverCountry = String(u?.country || '').trim();
        if (serverCountry) {
          setCountry(serverCountry);
          setCountryAuto(false);
        } else {
          setCountry(t('register_country_placeholder'));
          setCountryAuto(true);
        }
        if (u) setAuth({ token, user: u });
      })
      .catch((e) => {
        if (!alive) return;
        setError(e?.message || 'FAILED_TO_LOAD');
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [setAuth, token]);

  useEffect(() => {
    if (!countryAuto) return;
    setCountry(t('register_country_placeholder'));
  }, [countryAuto, t]);

  const onSave = async () => {
    setSaving(true);
    setError('');
    try {
      const checkedName = validateHumanName(name);
      if (!checkedName.ok) {
        setError(checkedName.error);
        return;
      }
      const maxDay = daysInMonth(dobYear, dobMonth);
      const safeDay = dobDay && Number(dobDay) > maxDay ? String(maxDay).padStart(2, '0') : dobDay;
      const dobValue = dobYear && dobMonth && safeDay ? `${dobYear}-${dobMonth}-${safeDay}` : null;
      const payload = {
        name: checkedName.value,
        dob: dobValue,
        gender: gender || '',
        country
      };
      const data = await updateMe({ token, payload });
      const u = data?.user;
      if (u) setAuth({ token, user: u });
    } catch (e) {
      setError(e?.message || 'UPDATE_FAILED');
    } finally {
      setSaving(false);
    }
  };

  const onUploadAvatar = async () => {
    if (!avatarFile) return;
    setUploading(true);
    setError('');
    try {
      const data = await uploadMyAvatar({ token, file: avatarFile });
      const u = data?.user;
      if (u) setAuth({ token, user: u });
      setAvatarFile(null);
      if (inputRef.current) inputRef.current.value = '';
    } catch (e) {
      setError(e?.message || 'UPLOAD_FAILED');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-zinc-950/35 p-5 shadow-[0_40px_120px_-80px_rgba(56,189,248,0.55)] backdrop-blur-2xl sm:p-7">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(900px_420px_at_12%_10%,rgba(56,189,248,0.18),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(760px_420px_at_88%_22%,rgba(34,211,238,0.12),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_520px_at_52%_100%,rgba(168,85,247,0.10),transparent_62%)]" />
      </div>

      <div className="relative">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-white">{t('common_account')}</h1>
              <span className="inline-flex items-center rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[11px] font-semibold text-white/80">
                {user?.email || '—'}
              </span>
            </div>
            <div className="mt-2 text-sm text-zinc-300/90">{t('common_personal_info')}</div>
          </div>

          <button
            type="button"
            onClick={onSave}
            disabled={loading || saving}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-400 via-cyan-300 to-sky-200 px-5 py-3 text-sm font-black text-slate-950 shadow-[0_18px_60px_-30px_rgba(56,189,248,0.65)] transition hover:brightness-105 disabled:opacity-60"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-8H7v8" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 3v5h8" />
            </svg>
            {saving ? t('auth_processing') : t('common_save')}
          </button>
        </div>

        {error ? (
          <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-950/30 px-4 py-3 text-sm font-semibold text-red-100">
            {error}
          </div>
        ) : null}

        <div className={`mt-6 grid gap-5 lg:grid-cols-5 ${loading ? 'opacity-80' : ''}`}>
          <div className="lg:col-span-2">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_28px_90px_-70px_rgba(0,0,0,0.95)]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-white/60">{t('common_avatar')}</div>
              </div>

              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
                <div className="relative">
                  <div className="pointer-events-none absolute -inset-4 rounded-[28px] bg-[radial-gradient(140px_140px_at_50%_35%,rgba(56,189,248,0.28),transparent_62%)] blur-xl" />
                  <div className="relative h-24 w-24 overflow-hidden rounded-3xl border border-white/10 bg-black/30">
                    {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : null}
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <input
                    ref={inputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />

                  <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                    <button
                      type="button"
                      onClick={() => inputRef.current?.click()}
                      disabled={uploading}
                      className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2 text-sm font-semibold text-white/90 transition hover:bg-white/10 disabled:opacity-60"
                    >
                      {t('common_choose_image')}
                    </button>
                    <button
                      type="button"
                      onClick={onUploadAvatar}
                      disabled={!avatarFile || uploading}
                      className="rounded-2xl bg-sky-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-sky-300 disabled:opacity-60"
                    >
                      {uploading ? t('auth_processing') : t('common_upload')}
                    </button>
                    {avatarFile ? (
                      <button
                        type="button"
                        onClick={() => {
                          setAvatarFile(null);
                          if (inputRef.current) inputRef.current.value = '';
                        }}
                        disabled={uploading}
                        className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2 text-sm font-semibold text-white/90 transition hover:bg-white/10 disabled:opacity-60"
                      >
                        {t('admin_cancel_btn')}
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">{t('common_selected_file')}</div>
                    <div className="mt-1 truncate text-sm font-semibold text-white/90">{avatarFilename || '—'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_28px_90px_-70px_rgba(0,0,0,0.95)]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-white/60">{t('common_personal_info')}</div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <div className="mb-1 text-sm font-semibold text-white/75">{t('auth_name_label')}</div>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm font-semibold text-white/90 outline-none transition focus:border-sky-400/50 focus:ring-2 focus:ring-sky-500/20"
                    placeholder={t('register_fullname_placeholder')}
                  />
                </label>

                <label className="block sm:col-span-2">
                  <div className="mb-1 text-sm font-semibold text-white/75">{t('common_dob')}</div>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={dobDay}
                      onChange={(e) => setDobDay(e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm font-semibold text-white/90 outline-none transition focus:border-sky-400/50 focus:ring-2 focus:ring-sky-500/20"
                    >
                      <option value="" className="bg-zinc-950 text-zinc-100">
                        {t('common_day')}
                      </option>
                      {Array.from({ length: daysInMonth(dobYear || 2000, dobMonth || 1) }, (_, i) => String(i + 1).padStart(2, '0')).map((d) => (
                        <option key={d} value={d} className="bg-zinc-950 text-zinc-100">
                          {d}
                        </option>
                      ))}
                    </select>
                    <select
                      value={dobMonth}
                      onChange={(e) => {
                        const nextMonth = e.target.value;
                        setDobMonth(nextMonth);
                        const maxDay = daysInMonth(dobYear || 2000, nextMonth || 1);
                        if (dobDay && Number(dobDay) > maxDay) setDobDay(String(maxDay).padStart(2, '0'));
                      }}
                      className="w-full rounded-2xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm font-semibold text-white/90 outline-none transition focus:border-sky-400/50 focus:ring-2 focus:ring-sky-500/20"
                    >
                      <option value="" className="bg-zinc-950 text-zinc-100">
                        {t('common_month')}
                      </option>
                      {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((m) => (
                        <option key={m} value={m} className="bg-zinc-950 text-zinc-100">
                          {m}
                        </option>
                      ))}
                    </select>
                    <select
                      value={dobYear}
                      onChange={(e) => {
                        const nextYear = e.target.value;
                        setDobYear(nextYear);
                        const maxDay = daysInMonth(nextYear || 2000, dobMonth || 1);
                        if (dobDay && Number(dobDay) > maxDay) setDobDay(String(maxDay).padStart(2, '0'));
                      }}
                      className="w-full rounded-2xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm font-semibold text-white/90 outline-none transition focus:border-sky-400/50 focus:ring-2 focus:ring-sky-500/20"
                    >
                      <option value="" className="bg-zinc-950 text-zinc-100">
                        {t('common_year')}
                      </option>
                      {Array.from({ length: 101 }, (_, i) => String(new Date().getFullYear() - i)).map((y) => (
                        <option key={y} value={y} className="bg-zinc-950 text-zinc-100">
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                </label>

                <label className="block">
                  <div className="mb-1 text-sm font-semibold text-white/75">{t('common_gender')}</div>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm font-semibold text-white/90 outline-none transition focus:border-sky-400/50 focus:ring-2 focus:ring-sky-500/20"
                  >
                    <option value="" className="bg-zinc-950 text-zinc-100">
                      {t('common_select')}
                    </option>
                    <option value="male" className="bg-zinc-950 text-zinc-100">
                      {t('register_gender_male')}
                    </option>
                    <option value="female" className="bg-zinc-950 text-zinc-100">
                      {t('register_gender_female')}
                    </option>
                  </select>
                </label>

                <label className="block">
                  <div className="mb-1 text-sm font-semibold text-white/75">{t('common_country')}</div>
                  <input
                    value={country}
                    onChange={(e) => {
                      setCountryAuto(false);
                      setCountry(e.target.value);
                    }}
                    className="w-full rounded-2xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm font-semibold text-white/90 outline-none transition focus:border-sky-400/50 focus:ring-2 focus:ring-sky-500/20"
                    placeholder={t('register_country_placeholder')}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
