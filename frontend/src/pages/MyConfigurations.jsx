import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../services/auth/AuthContext.jsx';
import { deleteConfiguration, getMyConfigurations, setConfigurationPublic } from '../services/api/configurations.js';
import { useI18n } from '../services/i18n.jsx';
import CarViewer from '../threejs/CarViewer.jsx';
import { normalizeVariantKey, resolveBestComboKey } from '../services/combinedModels.js';

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
  if (t === 'exhaust') return [['exhaust_socket', 'exhaust_mount']];
  if (t === 'bodykit') return [['bodykit_mount', 'bodykit_socket']];
  if (t === 'seat') return [['seat_mount']];
  if (t === 'handlebar') return [['handlebar_socket', 'handlebar_mount']];
  if (t === 'lighting') return [['lighting_mount']];
  if (t === 'topbox') return [['topbox_mount', 'topbox_socket', 'rear_box_mount', 'rear_rack_mount', 'seat_mount', 'seat_socket']];
  if (t === 'tire')
    return [
      ['front_tire_mount', 'front_wheel_mount', 'front_wheel_socket', 'wheel_front_left'],
      ['rear_tire_mount', 'rear_wheel_mount', 'rear_wheel_socket', 'wheel_rear_left']
    ];
  if (!t) return [];
  return [[`${t}_mount`]];
};

const MyConfigurations = () => {
  const { t, lang } = useI18n();
  const { token, isAuthed } = useAuth();
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState('');
  const [togglingId, setTogglingId] = useState('');

  const safeText = (v, fallback = '-') => {
    const s = String(v ?? '').trim();
    return s ? s : fallback;
  };

  const isHexColor = (value) => /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(String(value || '').trim());
  const normalizeHex6 = (value) => {
    const v = String(value || '').trim().toLowerCase();
    if (!v.startsWith('#')) return '';
    if (/^#[0-9a-f]{3}$/.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
    if (/^#[0-9a-f]{6}$/.test(v)) return v;
    if (/^#[0-9a-f]{8}$/.test(v)) return v.slice(0, 7);
    return '';
  };
  const colorNameFromHex = (value) => {
    const hex = normalizeHex6(value);
    if (!hex) return { ok: false, name: t('cfg_color_invalid') };
    const mapVi = {
      '#ffffff': 'Trắng',
      '#000000': 'Đen',
      '#808080': 'Xám',
      '#c0c0c0': 'Bạc',
      '#ff0000': 'Đỏ',
      '#00ff00': 'Xanh lá',
      '#0000ff': 'Xanh dương',
      '#ffff00': 'Vàng',
      '#ffa500': 'Cam',
      '#800080': 'Tím',
      '#00ffff': 'Cyan',
      '#ff00ff': 'Hồng tím',
      '#ffc0cb': 'Hồng',
      '#a52a2a': 'Nâu',
      '#000080': 'Xanh navy',
      '#008080': 'Xanh teal'
    };
    const mapEn = {
      '#ffffff': 'White',
      '#000000': 'Black',
      '#808080': 'Gray',
      '#c0c0c0': 'Silver',
      '#ff0000': 'Red',
      '#00ff00': 'Green',
      '#0000ff': 'Blue',
      '#ffff00': 'Yellow',
      '#ffa500': 'Orange',
      '#800080': 'Purple',
      '#00ffff': 'Cyan',
      '#ff00ff': 'Magenta',
      '#ffc0cb': 'Pink',
      '#a52a2a': 'Brown',
      '#000080': 'Navy',
      '#008080': 'Teal'
    };
    const isVi = String(lang || '').trim().toLowerCase() === 'vi';
    const name = (isVi ? mapVi : mapEn)[hex] || t('cfg_color_custom');
    return { ok: true, name };
  };

  const partsBadges = (parts) => {
    const list = Array.isArray(parts) ? parts : [];
    const names = list
      .map((p) => safeText(p?.name, ''))
      .filter(Boolean);
    const visible = names.slice(0, 2);
    const remaining = names.length - visible.length;
    return { visible, remaining, total: names.length };
  };

  const targetSizeByType = useMemo(
    () => ({
      exhaust: 0.35,
      clutch: 0.25,
      wheels: 0.45,
      brake: 0.25,
      suspension: 0.4,
      tire: 0.45,
      handlebar: 0.35,
      bodykit: 0.6,
      seat: 0.35,
      lighting: 0.25,
      throttle_housing: 0.25,
      topbox: 0.5
    }),
    []
  );

  const formatDate = (value) => {
    const d = value ? new Date(value) : null;
    if (!d || Number.isNaN(d.getTime())) return '';
    const locale = String(lang || '').trim().toLowerCase() === 'vi' ? 'vi-VN' : 'en-US';
    try {
      return new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
    } catch {
      return d.toLocaleDateString();
    }
  };

  const Config3DPreview = ({ config }) => {
    const holderRef = useRef(null);
    const [active, setActive] = useState(false);

    useEffect(() => {
      const el = holderRef.current;
      if (!el || typeof IntersectionObserver === 'undefined') {
        setActive(true);
        return undefined;
      }
      const ob = new IntersectionObserver(
        (entries) => {
          const isIn = entries.some((e) => e.isIntersecting);
          if (isIn) setActive(true);
        },
        { root: null, threshold: 0.12 }
      );
      ob.observe(el);
      return () => ob.disconnect();
    }, []);

    const baseCarModelUrl = String(config?.carId?.model3d || config?.carId?.modelUrl || '').trim();
    const selectedColor = String(config?.selectedColor || '#ffffff').trim() || '#ffffff';
    const accessoryColors = config?.slotColors && typeof config.slotColors === 'object' ? config.slotColors : {};
    const initialCamera = config?.camera && typeof config.camera === 'object' ? config.camera : null;

    const combined = useMemo(() => {
      const order = Array.isArray(config?.carId?.combinedModelSlots) ? config.carId.combinedModelSlots.map((x) => String(x || '').trim()).filter(Boolean) : [];
      const modelMapRaw = config?.carId?.combinedModels && typeof config.carId.combinedModels === 'object' ? config.carId.combinedModels : {};
      const modelMap = modelMapRaw && typeof modelMapRaw === 'object' ? modelMapRaw : {};
      if (!order.length || !modelMap || !Object.keys(modelMap).length) return { url: '', covered: [] };

      const comboConfig = {};
      const wheels = config?.selectedWheels && typeof config.selectedWheels === 'object' ? config.selectedWheels : null;
      if (wheels) comboConfig.wheels = normalizeVariantKey(wheels?.variantKey || wheels?.name || '') || 'stock';

      const parts = Array.isArray(config?.selectedParts) ? config.selectedParts : [];
      for (const p of parts) {
        const type = String(p?.type || '').trim();
        if (!type) continue;
        comboConfig[type] = normalizeVariantKey(p?.variantKey || p?.name || '') || 'stock';
      }

      const key = resolveBestComboKey({ slotsOrder: order, modelMap, config: comboConfig });
      const url = key ? String(modelMap[key] || '').trim() : '';
      if (!url) return { url: '', covered: [] };

      const tokens = String(key || '').split('_');
      const coveredByKey = order.filter((slot, idx) => String(tokens[idx] || 'stock') !== 'stock');
      if (tokens.length < order.length) {
        const nonStock = order.filter((slot) => (normalizeVariantKey(comboConfig?.[slot] || 'stock') || 'stock') !== 'stock');
        if (nonStock.length === 1) return { url, covered: nonStock };
      }
      return { url, covered: coveredByKey };
    }, [config]);

    const effectiveCarModelUrl = combined.url || baseCarModelUrl;

    const slots = useMemo(() => {
      const out = [];

      const addPartSlots = (type, part) => {
        const url = String(part?.modelUrl || '').trim();
        if (!type || !url) return;

        const explicit =
          Array.isArray(part?.mountPoints) && part.mountPoints.length
            ? part.mountPoints.map((m) => pickMountCandidates(m)).filter((x) => x.length)
            : part?.mountPoint
              ? [pickMountCandidates(part.mountPoint)]
              : [];
        const candidates = explicit.length ? explicit : defaultMountCandidatesByType(type);
        const targetSize = targetSizeByType?.[type];

        if (type === 'wheels' || type === 'tire') {
          const front = candidates[0] || ['front_wheel_mount', 'front_wheel_socket'];
          const rear = candidates[1] || ['rear_wheel_mount', 'rear_wheel_socket'];
          out.push({ slot: `${type}:front`, type, socket: front, url, scale: 1, autoScale: true, targetSize });
          out.push({ slot: `${type}:rear`, type, socket: rear, url, scale: 1, autoScale: true, targetSize });
        } else {
          const primary = candidates[0] || [`${type}_mount`];
          out.push({ slot: type, type, socket: primary, url, scale: 1, autoScale: true, targetSize });
        }
      };

      if (config?.selectedWheels && typeof config.selectedWheels === 'object') {
        if (!combined.covered.includes('wheels')) addPartSlots('wheels', config.selectedWheels);
      }
      const parts = Array.isArray(config?.selectedParts) ? config.selectedParts : [];
      for (const p of parts) {
        const type = String(p?.type || '').trim();
        if (!type) continue;
        if (combined.covered.includes(type)) continue;
        addPartSlots(type, p);
      }

      return out;
    }, [combined.covered, config, targetSizeByType]);

    return (
      <div ref={holderRef} className="relative h-full w-full">
        {active && effectiveCarModelUrl ? (
          <CarViewer
            className="h-full w-full rounded-none border-0 bg-transparent"
            carModelUrl={effectiveCarModelUrl}
            color={selectedColor}
            slots={slots}
            accessoryColors={accessoryColors}
            initialCamera={initialCamera}
            background="transparent"
            viewerMode="preview"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-white/5 to-black/20">
            <div className="text-xs font-semibold tracking-wide text-white/60">{t('my_builds_loading_3d')}</div>
          </div>
        )}
      </div>
    );
  };

  useEffect(() => {
    let alive = true;
    if (!isAuthed) {
      setLoading(false);
      setItems([]);
      return undefined;
    }

    setLoading(true);
    getMyConfigurations({ token })
      .then((data) => {
        if (!alive) return;
        setItems(data);
        setError('');
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
  }, [isAuthed, token]);

  if (!isAuthed) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="text-sm text-white/75">{t('my_builds_login_req')}</div>
        <div className="mt-4">
          <Link
            to="/login"
            className="inline-flex items-center justify-center rounded-xl bg-sky-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-sky-300 active:bg-sky-200"
          >
            {t('nav_login')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-sky-500/10 via-white/[0.03] to-emerald-500/10 p-5">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-12 -top-12 h-40 w-40 rounded-full bg-sky-400/10 blur-3xl" />
          <div className="absolute -bottom-10 -right-10 h-44 w-44 rounded-full bg-emerald-400/10 blur-3xl" />
        </div>

        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">{t('my_builds_title')}</h1>
            <div className="mt-1 text-sm text-white/60">
              {loading
                ? t('common_loading')
                : items.length
                  ? `${items.length} ${items.length === 1 ? t('common_item_singular') : t('common_item_plural')}`
                  : t('my_builds_empty')}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/bikes"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-400 to-emerald-300 px-4 py-2.5 text-sm font-extrabold text-zinc-950 transition hover:brightness-110 active:brightness-95"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14" strokeLinecap="round" />
                <path d="M5 12h14" strokeLinecap="round" />
              </svg>
              {t('my_builds_create')}
            </Link>
            <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-semibold text-white/70">
              {t('my_builds_tip')}
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {t('common_error')}: {error}
        </div>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
              <div className="h-36 animate-pulse bg-white/5" />
              <div className="space-y-3 p-4">
                <div className="h-4 w-1/2 animate-pulse rounded bg-white/5" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-white/5" />
                <div className="grid grid-cols-3 gap-2">
                  <div className="h-10 animate-pulse rounded-xl bg-white/5" />
                  <div className="h-10 animate-pulse rounded-xl bg-white/5" />
                  <div className="h-10 animate-pulse rounded-xl bg-white/5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : items.length ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {items.map((c) => {
            const title = safeText(c?.name, t('my_builds_untitled'));
            const carName = safeText(c?.carId?.name, t('my_builds_unknown_car'));
            const wheelName = safeText(c?.selectedWheels?.name, '-');
            const colorValue = safeText(c?.selectedColor, '-');
            const colorPreview = isHexColor(colorValue) ? colorValue : '';
            const colorMeta = colorNameFromHex(colorValue);
            const parts = partsBadges(c?.selectedParts);
            const created = formatDate(c?.createdAt);
            const isPublic = Boolean(c?.isPublic);
            const likesCount = Math.max(0, Number(c?.likesCount) || 0);

            return (
              <div
                key={c._id}
                className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.05]"
              >
                <div className="relative h-40 bg-black/20">
                  <Config3DPreview config={c} />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
                  <div className="absolute left-4 top-4 flex items-center gap-2">
                    <div className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs font-semibold text-white/80">
                      {t('my_builds_badge_saved')}
                    </div>
                    <div
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        isPublic ? 'border-emerald-400/20 bg-emerald-500/15 text-emerald-100' : 'border-white/10 bg-black/40 text-white/70'
                      }`}
                    >
                      {isPublic ? 'Công khai' : 'Cá nhân'}
                    </div>
                    {isPublic ? (
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs font-semibold text-white/80">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                          <path
                            d="M12 21s-7-4.5-9.5-8.5C.4 9.3 2.2 6.6 5 6.2c1.5-.2 3 .4 4 1.6 1-1.2 2.5-1.8 4-1.6 2.8.4 4.6 3.1 2.5 6.3C19 16.5 12 21 12 21z"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <span>{likesCount}</span>
                      </div>
                    ) : null}
                    {created ? (
                      <div className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs font-semibold text-white/70">
                        {created}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold text-white">{title}</div>
                      <div className="mt-0.5 truncate text-sm text-white/55">{carName}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={!c?._id || deletingId === String(c._id) || togglingId === String(c._id)}
                        onClick={async () => {
                          const id = String(c?._id || '').trim();
                          if (!id || togglingId) return;
                          setTogglingId(id);
                          setError('');
                          try {
                            const desired = !Boolean(c?.isPublic);
                            await setConfigurationPublic({ token, configId: id, isPublic: desired });
                            setItems((prev) =>
                              (Array.isArray(prev) ? prev : []).map((x) =>
                                String(x?._id || '') === id ? { ...(x || {}), isPublic: desired, publishedAt: desired ? new Date().toISOString() : null } : x
                              )
                            );
                          } catch (e) {
                            setError(e?.message || 'FAILED_TO_UPDATE');
                          } finally {
                            setTogglingId('');
                          }
                        }}
                        className={`inline-flex h-10 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-bold transition disabled:opacity-60 ${
                          isPublic
                            ? 'border-white/10 bg-black/25 text-white/90 hover:bg-black/40 active:bg-black/50'
                            : 'border-emerald-400/25 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/20 active:bg-emerald-500/25'
                        }`}
                        title={isPublic ? 'Chuyển về cá nhân' : 'Đăng công khai'}
                      >
                        {togglingId === String(c._id) ? (
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                            <path d="M12 2a10 10 0 1 0 10 10" strokeLinecap="round" />
                          </svg>
                        ) : isPublic ? (
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 2a10 10 0 0 0-3.2 19.5" strokeLinecap="round" />
                            <path d="M12 2a10 10 0 0 1 3.2 19.5" strokeLinecap="round" />
                            <path d="M2 12h20" strokeLinecap="round" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M7 11V8a5 5 0 0 1 10 0v3" strokeLinecap="round" />
                            <path d="M5 11h14v10H5V11z" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                        <span>{isPublic ? 'Cá nhân' : 'Công khai'}</span>
                      </button>
                      <button
                        type="button"
                        title={t('my_builds_delete')}
                        disabled={!c?._id || deletingId === String(c._id)}
                        onClick={async () => {
                          const id = String(c?._id || '').trim();
                          if (!id || deletingId) return;
                          const ok = window.confirm(t('my_builds_delete_confirm'));
                          if (!ok) return;
                          setDeletingId(id);
                          setError('');
                          try {
                            await deleteConfiguration({ token, configId: id });
                            setItems((prev) => (Array.isArray(prev) ? prev.filter((x) => String(x?._id || '') !== id) : []));
                          } catch (e) {
                            setError(e?.message || t('my_builds_delete_failed'));
                          } finally {
                            setDeletingId('');
                          }
                        }}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-rose-400/25 bg-rose-500/10 text-rose-100 transition hover:bg-rose-500/15 active:bg-rose-500/20 disabled:opacity-60"
                      >
                        {deletingId === String(c._id) ? (
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                            <path d="M12 2a10 10 0 1 0 10 10" strokeLinecap="round" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18" strokeLinecap="round" />
                            <path d="M8 6V4h8v2" strokeLinecap="round" />
                            <path d="M19 6l-1 14H6L5 6" strokeLinecap="round" />
                            <path d="M10 11v6" strokeLinecap="round" />
                            <path d="M14 11v6" strokeLinecap="round" />
                          </svg>
                        )}
                      </button>

                      {c.carId?._id ? (
                        <Link
                          to={`/configurator/${c.carId._id}`}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/25 px-4 text-sm font-bold text-white/90 transition hover:bg-black/40 active:bg-black/50"
                        >
                          {t('my_builds_open_config')}
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </Link>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-black/15 px-3 py-2.5">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-white/45">{t('cfg_color')}</div>
                      <div className="mt-1 flex items-center gap-2 text-white/85">
                        {colorPreview ? (
                          <span className="h-4 w-4 shrink-0 rounded-full border border-white/15" style={{ background: colorPreview }} />
                        ) : null}
                        <span className={`truncate ${colorMeta.ok ? 'text-white/85' : 'text-amber-200'}`}>{colorMeta.name}</span>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/15 px-3 py-2.5">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-white/45">{t('part_wheels')}</div>
                      <div className="mt-1 truncate text-white/85">{wheelName}</div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/15 px-3 py-2.5">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-white/45">{t('cfg_parts')}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {parts.total ? (
                          <>
                            {parts.visible.map((name) => (
                              <span
                                key={name}
                                className="max-w-[190px] truncate rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[12px] text-white/85"
                              >
                                {name}
                              </span>
                            ))}
                            {parts.remaining > 0 ? (
                              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[12px] text-white/70">
                                +{parts.remaining}
                              </span>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-white/55">-</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="text-base font-semibold text-white">{t('my_builds_empty_title')}</div>
          <div className="mt-1 text-sm text-white/60">{t('my_builds_empty_desc')}</div>
          <div className="mt-4">
            <Link
              to="/bikes"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-400 to-emerald-300 px-4 py-2.5 text-sm font-extrabold text-zinc-950 transition hover:brightness-110 active:brightness-95"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14" strokeLinecap="round" />
                <path d="M5 12h14" strokeLinecap="round" />
              </svg>
              {t('my_builds_create')}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyConfigurations;
