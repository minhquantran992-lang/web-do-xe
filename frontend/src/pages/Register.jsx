import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { registerOtp, resendOtp, verifyOtp } from '../services/api/auth.js';
import { useAuth } from '../services/auth/AuthContext.jsx';
import { getApiBaseUrl } from '../services/api/client.js';
import { useI18n } from '../services/i18n.jsx';
import { validateEmail, validateHumanName } from '../services/validation.js';

const normalizeNext = (value) => {
  const v = String(value || '').trim();
  if (!v) return '/dashboard';
  if (!v.startsWith('/')) return '/dashboard';
  if (v.startsWith('/login') || v.startsWith('/register') || v.startsWith('/auth/callback')) return '/dashboard';
  return v;
};

const OTP_LEN = 6;
const REGISTER_DRAFT_KEY = 'eloride.register_draft_v1';
const isStrongPassword = (value) => {
  const v = String(value || '');
  if (v.length < 8) return false;
  if (!/[A-Z]/.test(v)) return false;
  if (!/\d/.test(v)) return false;
  return true;
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

const COUNTRIES = [
  'Afghanistan',
  'Albania',
  'Algeria',
  'Andorra',
  'Angola',
  'Antigua and Barbuda',
  'Argentina',
  'Armenia',
  'Australia',
  'Austria',
  'Azerbaijan',
  'Bahamas',
  'Bahrain',
  'Bangladesh',
  'Barbados',
  'Belarus',
  'Belgium',
  'Belize',
  'Benin',
  'Bhutan',
  'Bolivia',
  'Bosnia and Herzegovina',
  'Botswana',
  'Brazil',
  'Brunei',
  'Bulgaria',
  'Burkina Faso',
  'Burundi',
  'Cabo Verde',
  'Cambodia',
  'Cameroon',
  'Canada',
  'Central African Republic',
  'Chad',
  'Chile',
  'China',
  'Colombia',
  'Comoros',
  'Congo (Congo-Brazzaville)',
  'Costa Rica',
  "Côte d’Ivoire",
  'Croatia',
  'Cuba',
  'Cyprus',
  'Czechia',
  'Democratic Republic of the Congo',
  'Denmark',
  'Djibouti',
  'Dominica',
  'Dominican Republic',
  'Ecuador',
  'Egypt',
  'El Salvador',
  'Equatorial Guinea',
  'Eritrea',
  'Estonia',
  'Eswatini',
  'Ethiopia',
  'Fiji',
  'Finland',
  'France',
  'Gabon',
  'Gambia',
  'Georgia',
  'Germany',
  'Ghana',
  'Greece',
  'Grenada',
  'Guatemala',
  'Guinea',
  'Guinea-Bissau',
  'Guyana',
  'Haiti',
  'Honduras',
  'Hungary',
  'Iceland',
  'India',
  'Indonesia',
  'Iran',
  'Iraq',
  'Ireland',
  'Israel',
  'Italy',
  'Jamaica',
  'Japan',
  'Jordan',
  'Kazakhstan',
  'Kenya',
  'Kiribati',
  'Kuwait',
  'Kyrgyzstan',
  'Laos',
  'Latvia',
  'Lebanon',
  'Lesotho',
  'Liberia',
  'Libya',
  'Liechtenstein',
  'Lithuania',
  'Luxembourg',
  'Madagascar',
  'Malawi',
  'Malaysia',
  'Maldives',
  'Mali',
  'Malta',
  'Marshall Islands',
  'Mauritania',
  'Mauritius',
  'Mexico',
  'Micronesia',
  'Moldova',
  'Monaco',
  'Mongolia',
  'Montenegro',
  'Morocco',
  'Mozambique',
  'Myanmar (Burma)',
  'Namibia',
  'Nauru',
  'Nepal',
  'Netherlands',
  'New Zealand',
  'Nicaragua',
  'Niger',
  'Nigeria',
  'North Korea',
  'North Macedonia',
  'Norway',
  'Oman',
  'Pakistan',
  'Palau',
  'Panama',
  'Papua New Guinea',
  'Paraguay',
  'Peru',
  'Philippines',
  'Poland',
  'Portugal',
  'Qatar',
  'Romania',
  'Russia',
  'Rwanda',
  'Saint Kitts and Nevis',
  'Saint Lucia',
  'Saint Vincent and the Grenadines',
  'Samoa',
  'San Marino',
  'Sao Tome and Principe',
  'Saudi Arabia',
  'Senegal',
  'Serbia',
  'Seychelles',
  'Sierra Leone',
  'Singapore',
  'Slovakia',
  'Slovenia',
  'Solomon Islands',
  'Somalia',
  'South Africa',
  'South Korea',
  'South Sudan',
  'Spain',
  'Sri Lanka',
  'Sudan',
  'Suriname',
  'Sweden',
  'Switzerland',
  'Syria',
  'Taiwan',
  'Tajikistan',
  'Tanzania',
  'Thailand',
  'Timor-Leste',
  'Togo',
  'Tonga',
  'Trinidad and Tobago',
  'Tunisia',
  'Turkey',
  'Turkmenistan',
  'Tuvalu',
  'Uganda',
  'Ukraine',
  'United Arab Emirates',
  'United Kingdom',
  'United States',
  'Uruguay',
  'Uzbekistan',
  'Vanuatu',
  'Vatican City',
  'Venezuela',
  'Viet Nam',
  'Yemen',
  'Zambia',
  'Zimbabwe'
];

const maskIdentifier = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.includes('@')) {
    const [local, domain] = raw.split('@');
    const l = String(local || '').trim();
    const d = String(domain || '').trim();
    if (!d) return raw;
    const keep = l.slice(0, Math.min(2, l.length));
    return `${keep}${l.length > 2 ? '•••' : '••'}@${d}`;
  }
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.length < 6) return raw;
  const tail = digits.slice(-4);
  const head = digits.slice(0, Math.min(3, digits.length - 4));
  return `${raw.startsWith('+') ? '+' : ''}${head}${'•'.repeat(Math.max(0, digits.length - head.length - 4))}${tail}`;
};

const StepPill = ({ active, done, index, title }) => {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm ${
        active
          ? 'border-sky-400/30 bg-sky-400/10 text-sky-100'
          : done
            ? 'border-white/15 bg-white/10 text-zinc-100'
            : 'border-white/10 bg-white/5 text-zinc-300'
      }`}
    >
      <div
        className={`grid h-7 w-7 place-items-center rounded-lg text-xs font-bold ${
          active ? 'bg-sky-400 text-zinc-950' : done ? 'bg-white/20 text-zinc-50' : 'bg-white/10 text-zinc-200'
        }`}
      >
        {index}
      </div>
      <div className="font-semibold leading-tight">{title}</div>
    </div>
  );
};

const OtpBox = ({ value, onChange, onKeyDown, onPaste, inputRef }) => {
  return (
    <input
      ref={inputRef}
      value={value}
      inputMode="numeric"
      autoComplete="one-time-code"
      onChange={onChange}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      maxLength={1}
      style={{ colorScheme: 'light' }}
      className="h-12 w-11 rounded-xl border border-zinc-300/70 bg-white/90 text-center text-lg font-bold text-zinc-900 shadow-[0_1px_0_rgba(255,255,255,0.06)] outline-none transition focus:border-sky-500/70 focus:ring-4 focus:ring-sky-400/20"
    />
  );
};

const Register = () => {
  const location = useLocation();
  const nav = useNavigate();
  const { setAuth } = useAuth();
  const { lang, t, toggle } = useI18n();
  const titleNode = useMemo(() => {
    const title = String(t('auth_register_title') || '').trim();
    const needle = 'eloride';
    const lower = title.toLowerCase();
    const idx = lower.indexOf(needle);
    if (idx < 0) return title;

    const brand = title.slice(idx, idx + needle.length);
    const before = title.slice(0, idx);
    const after = title.slice(idx + needle.length);

    if (lang === 'vi') {
      const beforeLower = before.toLowerCase();
      const withIdx = beforeLower.lastIndexOf('với');
      if (withIdx >= 0) {
        const line1 = before.slice(0, withIdx).trim();
        const line2Prefix = before.slice(withIdx).trim();
        return (
          <span>
            <span className="block">{line1}</span>
            <span className="block">
              {line2Prefix}{' '}
              <span className="bg-gradient-to-r from-sky-300 via-cyan-200 to-emerald-200 bg-clip-text text-transparent">
                {brand}
              </span>
              {after}
            </span>
          </span>
        );
      }
    }

    return (
      <span>
        {before}
        <span className="bg-gradient-to-r from-sky-300 via-cyan-200 to-emerald-200 bg-clip-text text-transparent">
          {brand}
        </span>
        {after}
      </span>
    );
  }, [lang, t]);
  const [step, setStep] = useState(2);
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [dob, setDob] = useState('');
  const initialDobParts = useMemo(() => splitDob(dob), [dob]);
  const [dobDay, setDobDay] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobYear, setDobYear] = useState('');
  const [gender, setGender] = useState('');
  const [country, setCountry] = useState('');
  const [countryQuery, setCountryQuery] = useState('');
  const [countryOpen, setCountryOpen] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [identifierTouched, setIdentifierTouched] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [otp, setOtp] = useState(Array.from({ length: OTP_LEN }, () => ''));
  const otpRefs = useRef([]);
  const didInitDraftRef = useRef(false);
  const countryInputRef = useRef(null);
  const [otpChannel, setOtpChannel] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldownUntil, setResendCooldownUntil] = useState(0);
  const [otpLockedUntil, setOtpLockedUntil] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [triedStep1, setTriedStep1] = useState(false);
  const [triedStep2, setTriedStep2] = useState(false);
  const [triedStep3, setTriedStep3] = useState(false);

  const next = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return normalizeNext(params.get('next'));
  }, [location.search]);

  useEffect(() => {
    sessionStorage.setItem('post_auth_redirect', next);
  }, [next]);

  const persistDraftNow = useCallback(() => {
    const draft = {
      step,
      lastName,
      firstName,
      dobYear,
      dobMonth,
      dobDay,
      gender,
      country,
      countryQuery,
      identifier,
      termsAccepted
    };
    sessionStorage.setItem(REGISTER_DRAFT_KEY, JSON.stringify(draft));
  }, [country, countryQuery, dobDay, dobMonth, dobYear, firstName, gender, identifier, lastName, step, termsAccepted]);

  useEffect(() => {
    const navEntry = typeof performance !== 'undefined' ? performance.getEntriesByType?.('navigation')?.[0] : null;
    const navType =
      String(navEntry?.type || '').trim() ||
      (typeof performance !== 'undefined' && performance.navigation
        ? (performance.navigation.type === 1 ? 'reload' : 'navigate')
        : '');
    if (navType === 'reload') {
      sessionStorage.removeItem(REGISTER_DRAFT_KEY);
      return;
    }
    const raw = sessionStorage.getItem(REGISTER_DRAFT_KEY);
    if (!raw) return;
    try {
      const draft = JSON.parse(raw);
      if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return;
      const stepRaw = Number(draft.step);
      const stepSafe = stepRaw === 3 ? 3 : 2;
      setStep(stepSafe);
      setLastName(String(draft.lastName || ''));
      setFirstName(String(draft.firstName || ''));
      setDobYear(String(draft.dobYear || ''));
      setDobMonth(String(draft.dobMonth || ''));
      setDobDay(String(draft.dobDay || ''));
      setGender(String(draft.gender || ''));
      setCountry(String(draft.country || ''));
      setCountryQuery(String(draft.countryQuery || draft.country || ''));
      setIdentifier(String(draft.identifier || ''));
      setTermsAccepted(Boolean(draft.termsAccepted));
    } catch {
      sessionStorage.removeItem(REGISTER_DRAFT_KEY);
    }
  }, []);

  useEffect(() => {
    if (!didInitDraftRef.current) {
      didInitDraftRef.current = true;
      return;
    }
    const draft = {
      step,
      lastName,
      firstName,
      dobYear,
      dobMonth,
      dobDay,
      gender,
      country,
      countryQuery,
      identifier,
      termsAccepted
    };
    sessionStorage.setItem(REGISTER_DRAFT_KEY, JSON.stringify(draft));
  }, [country, countryQuery, dobDay, dobMonth, dobYear, firstName, gender, identifier, lastName, step, termsAccepted]);

  const startOAuth = (provider) => {
    sessionStorage.setItem('post_auth_redirect', next);
    const frontend = typeof window !== 'undefined' ? window.location.origin : '';
    const url = new URL(`${getApiBaseUrl()}/auth/${encodeURIComponent(provider)}`);
    if (frontend) url.searchParams.set('frontend', frontend);
    window.location.href = url.toString();
  };

  useEffect(() => {
    if (!resendCooldownUntil) return;
    const tmr = window.setInterval(() => {
      if (Date.now() >= resendCooldownUntil) setResendCooldownUntil(0);
    }, 250);
    return () => window.clearInterval(tmr);
  }, [resendCooldownUntil]);

  useEffect(() => {
    if (!otpLockedUntil) return;
    const tmr = window.setInterval(() => {
      if (Date.now() >= otpLockedUntil) setOtpLockedUntil(0);
    }, 250);
    return () => window.clearInterval(tmr);
  }, [otpLockedUntil]);

  useEffect(() => {
    if (!(resendCooldownUntil || otpLockedUntil)) return;
    const tmr = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(tmr);
  }, [otpLockedUntil, resendCooldownUntil]);

  const isOtpLocked = otpLockedUntil && nowMs < otpLockedUntil;
  const otpLockedRemainingMs = isOtpLocked ? Math.max(0, otpLockedUntil - nowMs) : 0;
  const otpLockedTimerText = useMemo(() => {
    if (!isOtpLocked) return '';
    const total = Math.ceil(otpLockedRemainingMs / 1000);
    const mm = String(Math.floor(total / 60)).padStart(2, '0');
    const ss = String(total % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  }, [isOtpLocked, otpLockedRemainingMs]);

  const otpValue = otp.join('');
  const otpDigits = otpValue.replace(/[^\d]/g, '');
  const fullName = useMemo(() => `${String(lastName || '').trim()} ${String(firstName || '').trim()}`.trim(), [firstName, lastName]);
  const passwordStrong = useMemo(() => isStrongPassword(password), [password]);
  const checkedIdentifier = useMemo(() => validateEmail(identifier), [identifier]);
  const identifierValid = Boolean(checkedIdentifier?.ok);
  const safeIdentifier = checkedIdentifier?.ok ? checkedIdentifier.value : String(identifier || '').trim();
  const checkedName = useMemo(() => validateHumanName(fullName), [fullName]);
  const canStep1 = Boolean(
    checkedName.ok &&
      String(dobYear || '').trim() &&
      String(dobMonth || '').trim() &&
      String(dobDay || '').trim() &&
      String(gender || '').trim() &&
      String(country || '').trim()
  );
  const canStep2 = Boolean(
    identifierValid &&
      passwordStrong &&
      String(confirmPassword || '').trim() &&
      String(confirmPassword || '') === String(password || '') &&
      termsAccepted
  );
  const canStep3 = otpDigits.length === OTP_LEN;
  const filteredCountries = useMemo(() => {
    const q = String(countryQuery || '').trim().toLowerCase();
    if (!q) return COUNTRIES.slice(0, 80);
    return COUNTRIES.filter((c) => c.toLowerCase().includes(q)).slice(0, 80);
  }, [countryQuery]);

  useEffect(() => {
    if (dob && (dobYear || dobMonth || dobDay)) return;
    if (!dob) return;
    setDobYear(initialDobParts.year);
    setDobMonth(initialDobParts.month);
    setDobDay(initialDobParts.day);
  }, [dob, dobDay, dobMonth, dobYear, initialDobParts.day, initialDobParts.month, initialDobParts.year]);

  useEffect(() => {
    if (!dobYear || !dobMonth || !dobDay) {
      setDob('');
      return;
    }
    const maxDay = daysInMonth(dobYear, dobMonth);
    const safeDay = Number(dobDay) > maxDay ? String(maxDay).padStart(2, '0') : dobDay;
    if (safeDay !== dobDay) {
      setDobDay(safeDay);
      return;
    }
    setDob(`${dobYear}-${dobMonth}-${safeDay}`);
  }, [dobDay, dobMonth, dobYear]);

  const errorText = useMemo(() => {
    const msg = String(error || '').trim();
    if (!msg) return '';
    if (msg === 'MISSING_FIELDS') return t('register_error_missing_fields');
    if (msg === 'INVALID_EMAIL') return t('register_error_identifier_invalid');
    if (msg === 'EMAIL_INAPPROPRIATE') return 'Email không phù hợp. Vui lòng nhập email lịch sự.';
    if (msg === 'EMAIL_EXISTS')
      return (
        <span>
          {t('register_error_email_exists')}{' '}
          <Link to={`/login?next=${encodeURIComponent(next)}`} className="font-semibold text-sky-300 hover:text-sky-200">
            {t('auth_login_link')}
          </Link>
        </span>
      );
    if (msg === 'INVALID_OTP') return t('register_error_invalid_otp');
    if (msg === 'OTP_EXPIRED') return t('register_error_otp_expired');
    if (msg === 'OTP_LOCKED') return t('register_error_otp_locked');
    if (msg === 'EMAIL_ALREADY_LINKED') return t('register_error_email_already_linked');
    if (msg === 'WEAK_PASSWORD') return t('register_error_password_strength');
    if (msg === 'INVALID_NAME') return 'Tên không hợp lệ.';
    if (msg === 'NAME_INAPPROPRIATE') return 'Tên không phù hợp. Vui lòng nhập tên lịch sự.';
    if (msg === 'REGISTER_FAILED') return t('register_error_register_failed');
    if (msg === 'TERMS_REQUIRED') return t('register_error_terms_required');
    if (msg === 'VERIFY_FAILED') return t('register_error_verify_failed');
    if (msg === 'RESEND_FAILED') return t('register_error_resend_failed');
    return msg;
  }, [error, next, t]);

  const moveOtpFocus = (index) => {
    const el = otpRefs.current?.[index];
    if (el && typeof el.focus === 'function') el.focus();
  };

  const setOtpAt = (index, digit) => {
    setOtp((prev) => {
      const nextOtp = prev.slice();
      nextOtp[index] = digit;
      return nextOtp;
    });
  };

  const handleOtpPaste = (e) => {
    const txt = String(e.clipboardData?.getData('text') || '').replace(/[^\d]/g, '');
    if (!txt) return;
    e.preventDefault();
    const digits = txt.slice(0, OTP_LEN).split('');
    setOtp((prev) => {
      const nextOtp = prev.slice();
      for (let i = 0; i < OTP_LEN; i += 1) nextOtp[i] = digits[i] || '';
      return nextOtp;
    });
    moveOtpFocus(Math.min(digits.length, OTP_LEN - 1));
  };

  const submitStep1 = (e) => {
    e.preventDefault();
    setError('');
    setTriedStep1(true);
    if (!canStep1) return;
    setStep(2);
    setTriedStep2(false);
  };

  const submitStep2 = async (e) => {
    e.preventDefault();
    setError('');
    setTriedStep2(true);
    if (!canStep2) return;
    if (!checkedIdentifier.ok) return;
    if (!termsAccepted) {
      setError('TERMS_REQUIRED');
      return;
    }
    setLoading(true);
    try {
      const data = await registerOtp({ name: fullName, dob, gender, country, identifier: safeIdentifier, password });
      if (data?.token) {
        setAuth({ token: data.token, user: data.user });
        sessionStorage.removeItem(REGISTER_DRAFT_KEY);
        nav(next, { replace: true });
        return;
      }
      setOtpChannel(String(data?.channel || ''));
      setOtp(Array.from({ length: OTP_LEN }, () => ''));
      setStep(3);
      setTriedStep3(false);
      window.setTimeout(() => moveOtpFocus(0), 0);
    } catch (err) {
      const code = String(err?.message || '').trim();
      setError(code || 'REGISTER_FAILED');
    } finally {
      setLoading(false);
    }
  };

  const submitStep3 = async (e) => {
    e.preventDefault();
    setError('');
    setTriedStep3(true);
    if (!safeIdentifier || !canStep3) return;
    if (otpLockedUntil && Date.now() < otpLockedUntil) return;
    setLoading(true);
    try {
      const data = await verifyOtp({ identifier: safeIdentifier, code: otpValue });
      setAuth({ token: data.token, user: data.user });
      sessionStorage.removeItem(REGISTER_DRAFT_KEY);
      nav(next, { replace: true });
    } catch (err) {
      const code = String(err?.message || '').trim();
      if (code === 'INVALID_OTP' || code === 'OTP_EXPIRED' || code === 'OTP_LOCKED') {
        setError(code || 'INVALID_OTP');
        setOtp(Array.from({ length: OTP_LEN }, () => ''));
        setTriedStep3(false);
        window.setTimeout(() => moveOtpFocus(0), 0);
        if (code === 'OTP_LOCKED') {
          setOtpLockedUntil(Date.now() + 5 * 60 * 1000);
          setResendCooldownUntil(Date.now() + 5 * 60 * 1000);
        }
      } else {
        setError(code || 'VERIFY_FAILED');
      }
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    if (resendLoading) return;
    if (otpLockedUntil && Date.now() < otpLockedUntil) return;
    if (resendCooldownUntil && Date.now() < resendCooldownUntil) return;
    setError('');
    setResendLoading(true);
    try {
      await resendOtp({ identifier: safeIdentifier });
      setResendCooldownUntil(Date.now() + 30 * 1000);
    } catch (err) {
      const code = String(err?.message || '').trim();
      setError(code || 'RESEND_FAILED');
      if (code === 'OTP_LOCKED') {
        setOtpLockedUntil(Date.now() + 5 * 60 * 1000);
        setResendCooldownUntil(Date.now() + 5 * 60 * 1000);
      }
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="-mx-4 -my-6 relative min-h-[100svh] overflow-hidden bg-black">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[url('/bg/register-bike.jpg')] bg-cover bg-center brightness-[1.08] contrast-[1.14] saturate-[1.15] blur-[1px] scale-[1.03] opacity-65" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/25 to-black/70" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.06)_0%,rgba(0,0,0,0.50)_62%,rgba(0,0,0,0.82)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_18%,rgba(56,189,248,0.35),transparent_55%),radial-gradient(circle_at_72%_70%,rgba(34,211,238,0.18),transparent_62%)] opacity-80 mix-blend-screen" />
        <div className="absolute -left-28 -top-28 h-[26rem] w-[26rem] rounded-full bg-sky-500/18 blur-[110px]" />
        <div className="absolute -right-28 -bottom-28 h-[28rem] w-[28rem] rounded-full bg-cyan-500/14 blur-[110px]" />
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.18)_1px,transparent_1px)] bg-[size:150px_150px] opacity-10 animate-pulse" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,.06)_1px,transparent_1px)] bg-[size:44px_44px] opacity-[0.14]" />
      </div>

      <div className="relative mx-auto flex min-h-[100svh] max-w-7xl items-center justify-center px-4 py-7">
        <div className="w-full max-w-[26.5rem]">
          <div className="relative">
            <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-sky-500/20 via-cyan-500/10 to-sky-500/20 blur-2xl" />
            <div className="relative rounded-3xl border border-white/15 bg-white/10 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.35),0_40px_120px_-60px_rgba(0,0,0,0.95)] backdrop-blur-2xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[28px] font-black leading-tight tracking-tight text-zinc-50">{titleNode}</div>
                  <div className="mt-1 text-sm text-zinc-200/80">{t('register_wizard_subtitle')}</div>
                </div>
                <div className="shrink-0">
                  <div className="inline-flex overflow-hidden rounded-xl border border-white/15 bg-white/10 p-1">
                    <button
                      type="button"
                      onClick={() => lang !== 'vi' && toggle()}
                      className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                        lang === 'vi' ? 'bg-sky-400 text-zinc-950' : 'text-zinc-100 hover:bg-white/10'
                      }`}
                    >
                      VI
                    </button>
                    <button
                      type="button"
                      onClick={() => lang === 'vi' && toggle()}
                      className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                        lang === 'vi' ? 'text-zinc-100 hover:bg-white/10' : 'bg-sky-400 text-zinc-950'
                      }`}
                    >
                      EN
                    </button>
                  </div>
                </div>
              </div>

            <div className="mt-6 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <StepPill active={step === 2} done={step > 2} index={1} title={t('register_step_account')} />
                <StepPill active={step === 3} done={false} index={2} title={t('register_step_otp')} />
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-sky-400 transition-[width] duration-300"
                  style={{ width: step === 3 ? '100%' : '0%' }}
                />
              </div>
            </div>

            <div className="mt-6">
              {step === 1 ? (
                <form onSubmit={submitStep1} className="space-y-4">
                  <div>
                    <div className="text-sm font-medium text-zinc-200">{t('register_fullname_label')}</div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <input
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        autoComplete="family-name"
                        className="w-full rounded-xl border border-zinc-300/70 bg-white/90 px-3 py-2.5 text-[16px] text-zinc-900 shadow-[0_1px_0_rgba(255,255,255,0.06)] outline-none placeholder:text-zinc-500 focus:border-sky-500/70 focus:ring-4 focus:ring-sky-400/20"
                        placeholder={t('register_lastname_placeholder')}
                      />
                      <input
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        autoComplete="given-name"
                        className="w-full rounded-xl border border-zinc-300/70 bg-white/90 px-3 py-2.5 text-[16px] text-zinc-900 shadow-[0_1px_0_rgba(255,255,255,0.06)] outline-none placeholder:text-zinc-500 focus:border-sky-500/70 focus:ring-4 focus:ring-sky-400/20"
                        placeholder={t('register_firstname_placeholder')}
                      />
                    </div>
                    {triedStep1 && (!String(lastName || '').trim() || !String(firstName || '').trim()) ? (
                      <div className="mt-2 text-sm text-red-300">{t('register_error_fullname_required')}</div>
                    ) : triedStep1 && String(lastName || '').trim() && String(firstName || '').trim() && !checkedName.ok ? (
                      <div className="mt-2 text-sm text-red-300">{checkedName.error}</div>
                    ) : null}
                  </div>

                  <label className="block">
                    <div className="text-sm font-medium text-zinc-200">{t('register_dob_label')}</div>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <select
                        value={dobDay}
                        onChange={(e) => setDobDay(e.target.value)}
                        style={{ colorScheme: 'light' }}
                        className={`w-full rounded-xl border border-white/20 bg-white/90 px-3 py-2.5 text-[16px] shadow-[0_1px_0_rgba(255,255,255,0.06)] outline-none focus:border-sky-500/70 focus:ring-4 focus:ring-sky-400/20 ${dobDay ? 'text-zinc-900' : 'text-zinc-500'}`}
                      >
                        <option value="" className="bg-white text-zinc-900">
                          {t('common_day')}
                        </option>
                        {Array.from({ length: daysInMonth(dobYear || 2000, dobMonth || 1) }, (_, i) => String(i + 1).padStart(2, '0')).map((d) => (
                          <option key={d} value={d} className="bg-white text-zinc-900">
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
                        style={{ colorScheme: 'light' }}
                        className={`w-full rounded-xl border border-white/20 bg-white/90 px-3 py-2.5 text-[16px] shadow-[0_1px_0_rgba(255,255,255,0.06)] outline-none focus:border-sky-500/70 focus:ring-4 focus:ring-sky-400/20 ${dobMonth ? 'text-zinc-900' : 'text-zinc-500'}`}
                      >
                        <option value="" className="bg-white text-zinc-900">
                          {t('common_month')}
                        </option>
                        {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((m) => (
                          <option key={m} value={m} className="bg-white text-zinc-900">
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
                        style={{ colorScheme: 'light' }}
                        className={`w-full rounded-xl border border-white/20 bg-white/90 px-3 py-2.5 text-[16px] shadow-[0_1px_0_rgba(255,255,255,0.06)] outline-none focus:border-sky-500/70 focus:ring-4 focus:ring-sky-400/20 ${dobYear ? 'text-zinc-900' : 'text-zinc-500'}`}
                      >
                        <option value="" className="bg-white text-zinc-900">
                          {t('common_year')}
                        </option>
                        {Array.from({ length: 101 }, (_, i) => String(new Date().getFullYear() - i)).map((y) => (
                          <option key={y} value={y} className="bg-white text-zinc-900">
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>
                    {triedStep1 && !String(dob || '').trim() ? (
                      <div className="mt-2 text-sm text-red-300">{t('register_error_dob_required')}</div>
                    ) : null}
                  </label>

                  <label className="block">
                    <div className="text-sm font-medium text-zinc-200">{t('register_gender_label')}</div>
                    <div className="mt-2 space-y-2">
                      <label
                        className={`flex cursor-pointer items-center justify-between rounded-xl border border-zinc-300/70 bg-white/90 px-3 py-3 text-sm shadow-[0_1px_0_rgba(255,255,255,0.06)] transition hover:bg-white ${gender === 'male' ? 'text-zinc-900' : 'text-zinc-500'}`}
                        onDoubleClick={() => setGender('')}
                      >
                        <span className={gender === 'male' ? 'font-semibold' : 'font-medium'}>{t('register_gender_male')}</span>
                        <span className="flex items-center gap-3">
                          <span
                            className={`h-4 w-4 rounded-full border ${
                              gender === 'male'
                                ? 'border-sky-400 bg-sky-500 shadow-[0_0_0_4px_rgba(56,189,248,0.18)]'
                                : 'border-zinc-400/70 bg-transparent'
                            }`}
                          />
                          <input
                            type="radio"
                            name="gender"
                            value="male"
                            checked={gender === 'male'}
                            onChange={() => setGender('male')}
                            className="hidden"
                          />
                        </span>
                      </label>
                      <label
                        className={`flex cursor-pointer items-center justify-between rounded-xl border border-zinc-300/70 bg-white/90 px-3 py-3 text-sm shadow-[0_1px_0_rgba(255,255,255,0.06)] transition hover:bg-white ${gender === 'female' ? 'text-zinc-900' : 'text-zinc-500'}`}
                        onDoubleClick={() => setGender('')}
                      >
                        <span className={gender === 'female' ? 'font-semibold' : 'font-medium'}>{t('register_gender_female')}</span>
                        <span className="flex items-center gap-3">
                          <span
                            className={`h-4 w-4 rounded-full border ${
                              gender === 'female'
                                ? 'border-sky-400 bg-sky-500 shadow-[0_0_0_4px_rgba(56,189,248,0.18)]'
                                : 'border-zinc-400/70 bg-transparent'
                            }`}
                          />
                          <input
                            type="radio"
                            name="gender"
                            value="female"
                            checked={gender === 'female'}
                            onChange={() => setGender('female')}
                            className="hidden"
                          />
                        </span>
                      </label>
                    </div>
                    {triedStep1 && !String(gender || '').trim() ? (
                      <div className="mt-2 text-sm text-red-300">{t('register_error_gender_required')}</div>
                    ) : null}
                  </label>

                  <label className="block">
                    <div className="text-sm font-medium text-zinc-200">{t('register_country_label')}</div>
                    <div className="relative mt-2">
                      <input
                        ref={countryInputRef}
                        value={countryQuery}
                        onFocus={() => setCountryOpen(true)}
                        onChange={(e) => {
                          const v = e.target.value;
                          setCountryQuery(v);
                          setCountry(v);
                          setCountryOpen(true);
                        }}
                        onBlur={() => {
                          window.setTimeout(() => setCountryOpen(false), 120);
                          if (!String(countryQuery || '').trim()) {
                            setCountry('');
                            return;
                          }
                          const hit = COUNTRIES.find((c) => c.toLowerCase() === String(countryQuery || '').trim().toLowerCase());
                          if (hit) {
                            setCountry(hit);
                            setCountryQuery(hit);
                          }
                        }}
                        placeholder={t('register_country_placeholder')}
                        autoComplete="country-name"
                        className="w-full rounded-xl border border-zinc-300/70 bg-white/90 px-3 py-2.5 text-[16px] text-zinc-900 shadow-[0_1px_0_rgba(255,255,255,0.06)] outline-none placeholder:text-zinc-500 focus:border-sky-500/70 focus:ring-4 focus:ring-sky-400/20"
                      />
                      {countryOpen && filteredCountries.length ? (
                        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-56 overflow-y-auto rounded-xl border border-zinc-300/70 bg-white py-1 text-zinc-900 shadow-lg">
                          {filteredCountries.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onMouseDown={(ev) => {
                                ev.preventDefault();
                                setCountry(c);
                                setCountryQuery(c);
                                setCountryOpen(false);
                              }}
                              className="block w-full px-3 py-2 text-left text-sm hover:bg-sky-50"
                            >
                              {c}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    {triedStep1 && !String(country || '').trim() ? (
                      <div className="mt-2 text-sm text-red-300">{t('register_error_country_required')}</div>
                    ) : null}
                  </label>

                  {errorText ? (
                    <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                      {errorText}
                    </div>
                  ) : null}

                  <button
                    disabled={!canStep1}
                    className="w-full rounded-xl bg-sky-500 px-4 py-3 text-sm font-semibold text-zinc-950 shadow-[0_10px_30px_rgba(14,165,233,0.20)] transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-zinc-300 disabled:shadow-none"
                  >
                    {t('register_btn_continue')}
                  </button>

                  <div className="text-center text-sm text-zinc-300">
                    {t('auth_has_account')}{' '}
                    <Link to={`/login?next=${encodeURIComponent(next)}`} className="font-semibold text-sky-300 hover:text-sky-200">
                      {t('auth_login_link')}
                    </Link>
                  </div>
                </form>
              ) : null}

              {step === 2 ? (
                <form onSubmit={submitStep2} className="space-y-4">
                  <label className="block">
                    <div className="text-sm font-medium text-zinc-200">{t('register_identifier_label')}</div>
                    <input
                      value={identifier}
                      onChange={(e) => {
                        if (!identifierTouched) setIdentifierTouched(true);
                        setIdentifier(e.target.value);
                      }}
                      onBlur={() => setIdentifierTouched(true)}
                      autoComplete="email"
                      className="mt-2 w-full rounded-xl border border-zinc-300/70 bg-white/90 px-3 py-2.5 text-[16px] text-zinc-900 shadow-[0_1px_0_rgba(255,255,255,0.06)] outline-none placeholder:text-zinc-500 focus:border-sky-500/70 focus:ring-4 focus:ring-sky-400/20"
                      placeholder={t('register_identifier_placeholder')}
                    />
                    {triedStep2 && !String(identifier || '').trim() ? (
                      <div className="mt-2 text-sm text-red-300">{t('register_error_identifier_required')}</div>
                    ) : (triedStep2 || identifierTouched) && String(identifier || '').trim() && !identifierValid ? (
                      <div className="mt-2 text-sm text-red-300">{checkedIdentifier.error || t('register_error_identifier_invalid')}</div>
                    ) : null}
                  </label>

                  <label className="block">
                    <div className="text-sm font-medium text-zinc-200">{t('auth_password_label')}</div>
                    <div className="relative mt-2">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
                        className="w-full rounded-xl border border-zinc-300/70 bg-white/90 px-3 py-2.5 pr-12 text-[16px] text-zinc-900 shadow-[0_1px_0_rgba(255,255,255,0.06)] outline-none placeholder:text-zinc-500 focus:border-sky-500/70 focus:ring-4 focus:ring-sky-400/20"
                        placeholder={t('auth_password_min')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-zinc-600 hover:text-zinc-900"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? (
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                            <circle cx="12" cy="12" r="3" />
                            <path d="M3 3l18 18" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                    {String(password || '').trim() && !passwordStrong ? (
                      <div className="mt-2 inline-flex rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200">
                        {t('register_error_password_strength')}
                      </div>
                    ) : null}
                  </label>

                  <label className="block">
                    <div className="text-sm font-medium text-zinc-200">{t('auth_confirm_password')}</div>
                    <div className="relative mt-2">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                        className="w-full rounded-xl border border-zinc-300/70 bg-white/90 px-3 py-2.5 pr-12 text-[16px] text-zinc-900 shadow-[0_1px_0_rgba(255,255,255,0.06)] outline-none placeholder:text-zinc-500 focus:border-sky-500/70 focus:ring-4 focus:ring-sky-400/20"
                        placeholder={t('auth_confirm_password')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((v) => !v)}
                        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-zinc-600 hover:text-zinc-900"
                        aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                      >
                        {showConfirmPassword ? (
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                            <circle cx="12" cy="12" r="3" />
                            <path d="M3 3l18 18" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                    {triedStep2 && !String(confirmPassword || '').trim() ? (
                      <div className="mt-2 text-sm text-red-300">{t('register_error_confirm_password_required')}</div>
                    ) : triedStep2 && String(confirmPassword || '') !== String(password || '') ? (
                      <div className="mt-2 text-sm text-red-300">{t('register_error_password_mismatch')}</div>
                    ) : null}
                  </label>

                  <div>
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={termsAccepted}
                        onChange={(e) => setTermsAccepted(Boolean(e.target.checked))}
                        className="mt-1 h-4 w-4 rounded border border-white/20 bg-white/10 accent-sky-400"
                      />
                      <div className="text-xs leading-5 text-zinc-200/80">
                        {t('register_terms_prefix')}{' '}
                        <Link to="/terms" onClick={persistDraftNow} className="font-semibold text-sky-300 hover:text-sky-200">
                          {t('register_terms_terms')}
                        </Link>{' '}
                        {t('register_terms_and')}{' '}
                        <Link to="/privacy" onClick={persistDraftNow} className="font-semibold text-sky-300 hover:text-sky-200">
                          {t('register_terms_privacy')}
                        </Link>
                      </div>
                    </label>
                    {triedStep2 && !termsAccepted ? (
                      <div className="mt-2 text-sm text-red-300">{t('register_error_terms_required')}</div>
                    ) : null}
                  </div>

                  {errorText ? (
                    <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                      {errorText}
                    </div>
                  ) : null}

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        nav(`/login?next=${encodeURIComponent(next)}`);
                      }}
                      className="flex-1 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-zinc-100 shadow-[0_1px_0_rgba(255,255,255,0.06)] transition hover:bg-white/15"
                      disabled={loading}
                    >
                      {t('register_btn_back')}
                    </button>
                    <button
                      disabled={loading || !canStep2}
                      className="flex-1 rounded-xl bg-sky-500 px-4 py-3 text-sm font-semibold text-zinc-950 shadow-[0_10px_30px_rgba(14,165,233,0.20)] transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-zinc-300 disabled:shadow-none"
                    >
                      {loading ? t('auth_processing') : t('register_btn_send_otp')}
                    </button>
                  </div>

                  <div className="grid gap-3 pt-1">
                    <div className="flex items-center gap-3">
                      <div className="h-px flex-1 bg-white/10" />
                      <div className="text-xs font-medium text-zinc-300">{t('common_or')}</div>
                      <div className="h-px flex-1 bg-white/10" />
                    </div>
                    <button
                      type="button"
                      onClick={() => startOAuth('google')}
                      className="group relative inline-flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl border border-sky-400/25 bg-gradient-to-r from-sky-500/15 via-cyan-500/10 to-sky-500/15 px-4 py-3 text-sm font-bold text-zinc-50 shadow-[0_18px_70px_-52px_rgba(56,189,248,0.45)] backdrop-blur transition hover:border-sky-300/40 hover:from-sky-500/20 hover:via-cyan-500/15 hover:to-sky-500/20 hover:shadow-[0_22px_80px_-52px_rgba(56,189,248,0.65)] focus:outline-none focus:ring-2 focus:ring-sky-400/35"
                    >
                      <span className="pointer-events-none absolute -inset-10 bg-[radial-gradient(420px_200px_at_50%_30%,rgba(56,189,248,0.25),transparent_60%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                      <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.16),transparent)]" />
                      <span className="relative inline-flex items-center justify-center gap-3">
                        <svg width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.8 6 29.7 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.2-.4-3.5z"/>
                          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.8 6 29.7 4 24 4c-7.7 0-14.4 4.3-17.7 10.7z"/>
                          <path fill="#4CAF50" d="M24 44c5.6 0 10.7-2.1 14.6-5.5l-6.8-5.6C29.8 34.5 27 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.6 5.1C9.4 39.7 16.2 44 24 44z"/>
                          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3-3.2 5.2-5.9 6.5l.1.1 6.8 5.6c-.5.4 7.7-5.6 7.7-16.2 0-1.3-.1-2.2-.4-3.5z"/>
                        </svg>
                        {t('auth_register_google')}
                      </span>
                    </button>
                  </div>

                </form>
              ) : null}

              {step === 3 ? (
                <form onSubmit={submitStep3} className="space-y-4">
                  {(() => {
                    const via = otpChannel ? t('register_otp_via').replace('{channel}', otpChannel.toUpperCase()) : '';
                    const template = t('register_otp_sent').replace('{via}', via);
                    const parts = template.split('{target}');
                    const before = parts[0] || '';
                    const after = parts.slice(1).join('{target}');
                    return (
                      <div className="rounded-xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-zinc-200">
                        {before}
                        <span className="font-semibold text-zinc-50">{maskIdentifier(identifier) || t('register_your_account')}</span>
                        {after}
                      </div>
                    );
                  })()}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-zinc-200">
                        {t('register_otp_code_label').replace('{len}', String(OTP_LEN))}
                      </div>
                      <div className="text-xs text-zinc-400">{t('register_otp_paste_hint')}</div>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      {otp.map((digit, idx) => (
                        <OtpBox
                          key={idx}
                          value={digit}
                          inputRef={(el) => {
                            otpRefs.current[idx] = el;
                          }}
                          onPaste={handleOtpPaste}
                          onChange={(e) => {
                            const d = String(e.target.value || '').replace(/[^\d]/g, '').slice(0, 1);
                            setOtpAt(idx, d);
                            if (d) moveOtpFocus(Math.min(idx + 1, OTP_LEN - 1));
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Backspace' && !otp[idx]) {
                              moveOtpFocus(Math.max(idx - 1, 0));
                            }
                            if (e.key === 'ArrowLeft') moveOtpFocus(Math.max(idx - 1, 0));
                            if (e.key === 'ArrowRight') moveOtpFocus(Math.min(idx + 1, OTP_LEN - 1));
                          }}
                        />
                      ))}
                    </div>
                    {triedStep3 && !canStep3 ? (
                      <div className="text-sm text-red-300">{t('register_error_otp_len').replace('{len}', String(OTP_LEN))}</div>
                    ) : null}
                  </div>

                  {errorText ? (
                    <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">{errorText}</div>
                        {error === 'OTP_LOCKED' && otpLockedTimerText ? (
                          <div className="shrink-0 rounded-lg border border-red-400/25 bg-black/20 px-2 py-1 text-xs font-bold tabular-nums text-red-100">
                            {otpLockedTimerText}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  <button
                    disabled={loading || !canStep3 || isOtpLocked}
                    className="w-full rounded-xl bg-sky-500 px-4 py-3 text-sm font-semibold text-zinc-950 shadow-[0_10px_30px_rgba(14,165,233,0.20)] transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-zinc-300 disabled:shadow-none"
                  >
                    {loading ? t('auth_processing') : t('register_btn_verify_create')}
                  </button>

                  <div className="flex items-center justify-between gap-3 text-sm">
                    <button
                      type="button"
                      onClick={() => {
                        setStep(2);
                        setTriedStep2(false);
                      }}
                      className="rounded-lg px-2 py-1.5 font-semibold text-zinc-200 transition hover:text-zinc-50"
                      disabled={loading}
                    >
                      {t('register_btn_edit_account')}
                    </button>
                    <button
                      type="button"
                      onClick={onResend}
                      disabled={resendLoading || isOtpLocked || (resendCooldownUntil && nowMs < resendCooldownUntil)}
                      className="rounded-lg px-2 py-1.5 font-semibold text-sky-300 transition hover:text-sky-200 disabled:cursor-not-allowed disabled:text-zinc-500"
                    >
                      {isOtpLocked
                        ? t('register_btn_resend_otp')
                        : resendCooldownUntil && nowMs < resendCooldownUntil
                          ? t('register_btn_resend_otp_countdown').replace(
                              '{s}',
                              String(Math.ceil((resendCooldownUntil - nowMs) / 1000))
                            )
                        : resendLoading
                          ? t('auth_processing')
                          : t('register_btn_resend_otp')}
                    </button>
                  </div>

                </form>
              ) : null}

            </div>

              <div className="mt-6 text-center text-xs text-zinc-400">
                <Link to="/" className="hover:text-zinc-200">
                  {t('common_back_to_landing')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
