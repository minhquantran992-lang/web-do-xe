import { memo, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { checkModLegality } from '../../services/api/ai.js';
import { useI18n } from '../../services/i18n.jsx';
import { useAuth } from '../../services/auth/AuthContext.jsx';

const OptionsPanel = ({
  title,
  subtitle,
  items,
  selectedId,
  motorcycleName,
  activeType,
  resolveAssetUrl,
  formatPrice,
  onSelect,
  conflictPartIds,
  alternatives,
  carColor,
  onCarColorChange,
  onResetCarColor,
  baseSpecs,
  bonusSpecs,
  emissions,
  readOnly,
  onClear,
  clearLabel,
  selectedBadgeLabel,
  selectLabel,
  emptyLabel
}) => {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const conflictSet = conflictPartIds?.has ? conflictPartIds : new Set();
  const selected = String(selectedId || '').trim();
  const selectedHasConflict = Boolean(selected && conflictSet.has(selected));
  const altList = useMemo(() => (Array.isArray(alternatives) ? alternatives : []), [alternatives]);
  const lawUiVi = useMemo(
    () => ({
      title: 'Kiểm tra hợp pháp (VN)',
      basisHint: 'Theo Nghị định 100/2019 & 123/2021',
      checkBtn: 'Kiểm tra',
      result: 'Kết quả',
      fineLabel: 'Mức phạt',
      alternativesLabel: 'Gợi ý an toàn hơn',
      more: 'Xem thêm',
      less: 'Thu gọn',
      status: { legal: 'Hợp pháp', warning: 'Có nguy cơ bị phạt', illegal: 'Vi phạm luật' }
    }),
    []
  );
  const safeT = (key, fallback) => {
    const v = String(t(key) || '').trim();
    return v && v !== key ? v : fallback;
  };
  const list = useMemo(() => (Array.isArray(items) ? items : []), [items]);
  const selectedPart = useMemo(() => list.find((x) => String(x?._id || '') === selected) || null, [list, selected]);
  const selectedPartName = String(selectedPart?.name || '').trim();
  const [lawOpen, setLawOpen] = useState(false);
  const [lawLoading, setLawLoading] = useState(false);
  const [lawError, setLawError] = useState('');
  const [lawResult, setLawResult] = useState(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const safeCarColor = String(carColor || '#ffffff').trim() || '#ffffff';
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
    if (!hex) return { ok: false, hex: '', name: t('cfg_color_invalid') };

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
    return { ok: true, hex, name };
  };
  const carColorMeta = useMemo(() => colorNameFromHex(safeCarColor), [safeCarColor, lang]);

  const canCheck = Boolean(selected && selectedPartName && String(activeType || '').trim());
  const isVietnameseUser = useMemo(() => {
    const raw = String(user?.country || '').trim();
    if (!raw) return false;
    const k = raw
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (k === 'vn' || k === 'vietnam' || k === 'viet nam') return true;
    if (k.includes('viet')) return true;
    return false;
  }, [user?.country]);
  const canShowLawCheck = Boolean(selected) && (String(lang || '').trim().toLowerCase() === 'vi' || isVietnameseUser);

  const allowedStatKeysByType = useMemo(
    () => ({
      exhaust: ['powerHp', 'torqueNm', 'weightKg', 'topSpeedKph'],
      throttle_housing: ['powerHp', 'torqueNm', 'topSpeedKph'],
      clutch: ['torqueNm'],
      wheels: ['weightKg', 'topSpeedKph'],
      tire: ['topSpeedKph', 'weightKg'],
      brake: ['weightKg'],
      suspension: ['weightKg'],
      handlebar: ['weightKg'],
      bodykit: ['weightKg'],
      seat: ['weightKg'],
      lighting: ['weightKg'],
      topbox: ['weightKg']
    }),
    []
  );

  const allowedKeysForType = useMemo(() => {
    return (type) => {
      const k = String(type || '').trim();
      return allowedStatKeysByType[k] || null;
    };
  }, [allowedStatKeysByType]);

  const perf = useMemo(() => {
    const base = baseSpecs && typeof baseSpecs === 'object' ? baseSpecs : {};
    const bonus = bonusSpecs && typeof bonusSpecs === 'object' ? bonusSpecs : {};
    const allowed = allowedKeysForType(activeType);
    const toNumOrNull = (v) => {
      if (v === null || v === undefined || v === '') return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const toNumOr0 = (v) => {
      if (v === null || v === undefined || v === '') return 0;
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };
    const rows = [
      { key: 'powerHp', label: t('cfg_stat_power'), unit: 'Hp' },
      { key: 'torqueNm', label: t('cfg_stat_torque'), unit: 'Nm' },
      { key: 'weightKg', label: t('cfg_stat_weight'), unit: 'Kg' },
      { key: 'topSpeedKph', label: t('cfg_stat_top_speed'), unit: 'Km/h' },
      { key: 'fuelL', label: t('cfg_stat_fuel'), unit: 'L' }
    ].map((r) => {
      const b = toNumOrNull(base[r.key]);
      const d = toNumOr0(bonus[r.key]);
      const hasBase = b !== null;
      const hasDelta = Math.abs(d) > 0.000001;
      const after = hasBase ? b + d : null;
      const relevant = !allowed || allowed.includes(r.key);
      return { ...r, base: b, delta: d, after, show: relevant && (hasBase || hasDelta) };
    });

    const hasAnyBase = rows.some((r) => r.show && r.base !== null);
    const hasAnyDelta = rows.some((r) => r.show && Math.abs(r.delta) > 0.000001);
    const infoModeTypes = new Set(['exhaust', 'clutch', 'wheels', 'brake', 'suspension', 'tire', 'handlebar', 'throttle_housing']);
    const showInfoEvenIfNoDelta = Boolean(selected) && infoModeTypes.has(String(activeType || '').trim());
    const visible = hasAnyBase || hasAnyDelta || showInfoEvenIfNoDelta;
    return { rows, visible, hasAnyBase, hasAnyDelta };
  }, [activeType, allowedKeysForType, baseSpecs, bonusSpecs, selected, t]);

  useEffect(() => {
    setLawError('');
    setLawResult(null);
    setLawOpen(false);
  }, [selected]);

  useEffect(() => {
    setCompareOpen(false);
  }, [selected, activeType]);

  const statusLabel = (status) => {
    const s = String(status || '').trim();
    return lawUiVi.status[s] || lawUiVi.status.warning;
  };

  const statusCls = (status) => {
    const s = String(status || '').trim();
    if (s === 'legal') return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200';
    if (s === 'illegal') return 'border-red-500/25 bg-red-500/10 text-red-200';
    return 'border-amber-500/25 bg-amber-500/10 text-amber-200';
  };

  const onCheck = async () => {
    if (!canCheck || lawLoading) return;
    setLawLoading(true);
    setLawError('');
    try {
      const data = await checkModLegality({
        motorcycle: String(motorcycleName || '').trim(),
        partName: selectedPartName,
        partType: String(activeType || '').trim()
      });
      setLawResult(data && typeof data === 'object' ? data : null);
      setLawOpen(true);
    } catch (e) {
      setLawResult(null);
      setLawOpen(true);
      setLawError(e?.message || 'REQUEST_FAILED');
    } finally {
      setLawLoading(false);
    }
  };

  return (
    <div className="h-full overflow-hidden border-l border-white/10 bg-white/[0.03]">
      <div className="flex h-full flex-col">
        <div className="border-b border-white/10 px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white/90">{title || 'Options'}</div>
              {subtitle ? <div className="mt-0.5 truncate text-[11px] text-white/50">{subtitle}</div> : null}
            </div>
            <button
              type="button"
              onClick={onClear}
              disabled={readOnly || !selected}
              className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-black/35 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {clearLabel || 'Clear'}
            </button>
          </div>

          <div className="mt-3 grid gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-[11px] font-semibold text-white/60">{t('cfg_paint_car')}</div>
                  <div className="truncate text-[10px] text-white/45">{t('cfg_paint_car_hint')}</div>
                </div>
                <button
                  type="button"
                  onClick={() => onResetCarColor?.()}
                  disabled={readOnly}
                  className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-semibold text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {t('cfg_paint_reset')}
                </button>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <input
                  type="color"
                  value={safeCarColor}
                  onChange={(e) => onCarColorChange?.(e.target.value)}
                  disabled={readOnly}
                  className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-white/10 bg-black/30 p-1 disabled:cursor-not-allowed"
                />
                <div className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2">
                  <div className="truncate text-[11px] text-white/55">{t('cfg_color_name_label')}</div>
                  <div className={`truncate text-[12px] font-semibold ${carColorMeta.ok ? 'text-white/90' : 'text-amber-200'}`}>{carColorMeta.name}</div>
                </div>
              </div>
            </div>

            {perf.visible ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <button
                  type="button"
                  onClick={() => setCompareOpen((v) => !v)}
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[11px] font-semibold text-white/60">{t('cfg_compare_title') || t('cfg_stats_after_title')}</div>
                    <div className="mt-1 truncate text-[10px] text-white/45">
                      {compareOpen ? t('cfg_compare_tap_hide') : t('cfg_compare_tap_show')}
                    </div>
                  </div>
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-black/20 text-white/80 transition hover:bg-black/30">
                    <svg
                      viewBox="0 0 24 24"
                      width="18"
                      height="18"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      style={{ transform: compareOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 160ms ease' }}
                    >
                      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </button>

                {compareOpen ? (
                  <>
                    <div className="mt-2 text-[10px] text-white/45">{t('cfg_compare_hint') || t('cfg_stats_after_hint')}</div>
                    {!perf.hasAnyBase ? (
                      <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] font-semibold text-amber-100">
                        {t('cfg_stats_missing_base')}
                      </div>
                    ) : null}
                    {!perf.hasAnyDelta ? (
                      <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] font-semibold text-white/75">
                        {t('cfg_stats_no_bonus')}
                      </div>
                    ) : null}
                    <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-black/15">
                      <div className="grid grid-cols-[1fr_92px_92px] gap-2 border-b border-white/10 bg-black/20 px-3 py-2">
                        <div className="text-[10px] font-semibold text-white/45">{t('cfg_stats_title')}</div>
                        <div className="text-right text-[10px] font-semibold text-white/45">{t('cfg_compare_before') || t('cfg_stats_base')}</div>
                        <div className="text-right text-[10px] font-semibold text-white/45">{t('cfg_compare_after') || t('cfg_stats_after_title')}</div>
                      </div>
                      <div className="divide-y divide-white/10">
                        {perf.rows
                          .filter((r) => r.show)
                          .map((r) => {
                            const delta = Number(r.delta) || 0;
                            const deltaSign = delta > 0 ? '+' : '';
                            const showDelta = Math.abs(delta) > 0.000001;
                            const baseVal = r.base === null ? '—' : String(Math.round(r.base * 10) / 10);
                            const afterVal = r.after === null ? '—' : String(Math.round(r.after * 10) / 10);
                            return (
                              <div key={r.key} className="grid grid-cols-[1fr_92px_92px] gap-2 px-3 py-2">
                                <div className="min-w-0">
                                  <div className="truncate text-[11px] font-semibold text-white/75">{r.label}</div>
                                  <div className="mt-0.5 text-[10px] text-white/35">{r.unit}</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-[12px] font-black text-white/90">{baseVal}</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-[12px] font-black text-white">{afterVal}</div>
                                  {showDelta ? (
                                    <div className={`mt-0.5 text-[10px] font-bold ${delta >= 0 ? 'text-emerald-200' : 'text-rose-200'}`}>
                                      {deltaSign}
                                      {String(Math.round(delta * 10) / 10)}
                                    </div>
                                  ) : (
                                    <div className="mt-0.5 text-[10px] text-white/25"> </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}

          </div>

          {canShowLawCheck ? (
            <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[11px] font-semibold text-white/60">{lawUiVi.title}</div>
                  <div className="truncate text-[10px] text-white/45">{lawUiVi.basisHint}</div>
                  <div className="truncate text-[13px] font-semibold text-white">{selectedPartName || subtitle || '-'}</div>
                </div>
                {lawResult?.status ? (
                  <div className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusCls(lawResult.status)}`}>
                    {String(lawResult?.label_vi || '').trim() || statusLabel(lawResult.status)}
                  </div>
                ) : null}
              </div>

              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={onCheck}
                  disabled={!canCheck || lawLoading}
                  className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-sky-400 to-cyan-300 px-3 py-2 text-[11px] font-black text-zinc-950 transition hover:brightness-110 disabled:opacity-60"
                >
                  {lawLoading ? t('auth_processing') : lawUiVi.checkBtn}
                </button>
                {(lawResult || lawError) ? (
                  <button
                    type="button"
                    onClick={() => setLawOpen((v) => !v)}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-semibold text-white/80 hover:bg-white/10"
                  >
                    {lawOpen ? lawUiVi.less : lawUiVi.more}
                  </button>
                ) : null}
              </div>

              {lawOpen ? (
                <div className="mt-3 space-y-2">
                  {lawError ? (
                    <div className="rounded-xl border border-red-900/40 bg-red-950/30 px-3 py-2 text-[11px] text-red-200">{lawError}</div>
                  ) : null}
                  {lawResult?.reason ? (
                    <div className="text-[11px] leading-relaxed text-white/75">{String(lawResult.reason)}</div>
                  ) : null}
                  {lawResult?.fine ? (
                    <div className="text-[11px] text-white/60">
                      <span className="font-semibold text-white/75">{lawUiVi.fineLabel}: </span>
                      {String(lawResult.fine)}
                    </div>
                  ) : null}
                  {Array.isArray(lawResult?.alternatives) && lawResult.alternatives.length ? (
                    <div className="text-[11px] text-white/70">
                      <div className="font-semibold text-white/75">{lawUiVi.alternativesLabel}</div>
                      <div className="mt-1 space-y-1">
                        {lawResult.alternatives.slice(0, 3).map((a) => (
                          <div key={a} className="text-white/65">
                            - {String(a)}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {selectedHasConflict ? (
            <div className="mb-3 rounded-2xl border border-rose-300/25 bg-rose-500/10 p-3">
              <div className="text-[11px] font-bold text-rose-50">This selection conflicts with another part</div>
              {altList.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {altList.map((p) => {
                    const id = String(p?._id || '').trim();
                    const label = String(p?.name || '').trim() || id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onSelect?.(id)}
                        disabled={readOnly}
                        className="rounded-full border border-rose-300/20 bg-rose-500/10 px-3 py-1.5 text-[11px] font-semibold text-rose-50 hover:bg-rose-500/16 disabled:opacity-60"
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-1 text-[11px] text-rose-100/75">No compatible alternatives found for the current selection.</div>
              )}
            </div>
          ) : null}
          {list.length ? (
            <div className="grid grid-cols-2 gap-3">
              {list.map((p) => {
                const id = String(p?._id || '');
                const isSelected = selected && selected === id;
                const isConflicting = Boolean(isSelected && conflictSet.has(id));
                const rawThumb =
                  String(p?.thumbnailUrl || '').trim() ||
                  String(p?.imageUrl || '').trim() ||
                  String(p?.image || '').trim() ||
                  '';
                const thumb = resolveAssetUrl?.(rawThumb) || '';
                const price = formatPrice?.(p?.price);
                const specs = p?.specs && typeof p.specs === 'object' ? p.specs : {};
                const allowed = allowedKeysForType(p?.type);
                const toNumOrNull = (v) => {
                  if (v === null || v === undefined || v === '') return null;
                  const n = Number(v);
                  return Number.isFinite(n) ? n : null;
                };
                const formatSigned = (n, decimals = 0) => {
                  const x = Math.round(n * Math.pow(10, decimals)) / Math.pow(10, decimals);
                  const sign = x > 0 ? '+' : '';
                  return `${sign}${String(x)}`;
                };
                const chips = [
                  { key: 'powerHp', label: 'HP', value: toNumOrNull(specs.powerHp), decimals: 1 },
                  { key: 'torqueNm', label: 'Nm', value: toNumOrNull(specs.torqueNm), decimals: 1 },
                  { key: 'topSpeedKph', label: 'km/h', value: toNumOrNull(specs.topSpeedKph), decimals: 1 },
                  { key: 'weightKg', label: 'kg', value: toNumOrNull(specs.weightKg), decimals: 1 }
                ]
                  .filter((c) => !allowed || allowed.includes(c.key))
                  .filter((c) => c.value !== null && Math.abs(c.value) > 0.000001)
                  .slice(0, 3);
                const variantKey = String(p?.variantKey || '').trim();
                return (
                  <motion.button
                    key={id || `${p?.name || ''}:${p?.type || ''}`}
                    type="button"
                    whileTap={{ scale: 0.99 }}
                    onClick={() => onSelect?.(id)}
                    disabled={readOnly}
                    className={`group relative overflow-hidden rounded-2xl border text-left transition ${
                      isSelected
                        ? isConflicting
                          ? 'border-rose-300/45 bg-rose-500/12'
                          : 'border-sky-300/55 bg-white/10'
                        : 'border-white/10 bg-black/10 hover:border-sky-300/25 hover:bg-black/18'
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                    title={p?.name || ''}
                  >
                    <div className="absolute left-3 top-3 z-10">
                      {isSelected ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-black text-white">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                          {selectedBadgeLabel || 'Selected'}
                        </span>
                      ) : null}
                    </div>

                    <div className="aspect-[16/10] w-full bg-white/5">
                      {thumb ? (
                        <img
                          src={thumb}
                          alt=""
                          className="h-full w-full object-cover opacity-95 transition duration-500 group-hover:scale-[1.04] group-hover:opacity-100"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center px-3 text-center text-[11px] font-semibold text-white/35">
                          No image
                        </div>
                      )}
                    </div>

                    <div className="px-3 py-2.5">
                      <div className="truncate text-[13px] font-semibold text-white">{p?.name || '-'}</div>
                      {variantKey ? (
                        <div className="mt-0.5 truncate text-[10px] font-semibold text-white/45">{variantKey}</div>
                      ) : (
                        <div className="mt-0.5 text-[10px] text-white/25"> </div>
                      )}
                      {price ? (
                        <div className="mt-1 text-[11px] font-semibold text-white/70">{price}</div>
                      ) : (
                        <div className="mt-1 text-[11px] text-white/40"> </div>
                      )}
                      {chips.length ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {chips.map((c) => (
                            <div key={c.key} className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-semibold text-white/75">
                              {formatSigned(c.value, c.decimals)} {c.label}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-2 text-[10px] text-white/35">{safeT('cfg_part_basic_info_hint', 'Thông tin cơ bản sẽ hiển thị tại đây')}</div>
                      )}
                      <div className="mt-2">
                        <div
                          className={`inline-flex items-center justify-center rounded-xl px-3 py-2 text-[11px] font-bold transition ${
                            isSelected ? 'bg-sky-500/20 text-white' : 'bg-black/20 text-white/85 group-hover:bg-black/30'
                          }`}
                        >
                          {isSelected ? selectedBadgeLabel || 'Selected' : selectLabel || 'Select'}
                        </div>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-4 text-sm text-white/70">
              {emptyLabel || 'No options'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(OptionsPanel);
