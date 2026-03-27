import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import CarViewer from '../threejs/CarViewer.jsx';
import { getBackgrounds, getCars } from '../services/api/cars.js';
import { getParts } from '../services/api/parts.js';
import { createConfiguration, updateConfigurationPart } from '../services/api/configurations.js';
import { useAuth } from '../services/auth/AuthContext.jsx';
import { useI18n } from '../services/i18n.jsx';

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
  if (t === 'tire')
    return [
      ['front_tire_mount', 'front_wheel_mount', 'front_wheel_socket', 'wheel_front_left'],
      ['rear_tire_mount', 'rear_wheel_mount', 'rear_wheel_socket', 'wheel_rear_left']
    ];
  if (!t) return [];
  return [[`${t}_mount`]];
};

const formatPrice = (raw) => {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return '';
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
};

const Car2DPreview = ({ bike, selectedByType, partsById, resolveAssetUrl }) => {
  const baseUrl = resolveAssetUrl(bike?.thumbnailUrl || bike?.imageUrl || bike?.image || '');
  const entries = Object.entries(selectedByType || {})
    .map(([slot, id]) => ({ slot: String(slot || ''), id: String(id || '') }))
    .filter(({ slot, id }) => slot && id);

  return (
    <div className="car2d-stage rounded-xl border border-zinc-800 bg-zinc-950">
      {baseUrl ? <img src={baseUrl} alt="" className="car2d-base" /> : <div className="car2d-base bg-zinc-900" />}
      {entries.map(({ slot, id }) => {
        const part = partsById.get(id);
        const url = resolveAssetUrl(part?.thumbnailUrl || '');
        if (!url) return null;
        return <img key={`${slot}:${id}`} src={url} alt="" className={`car2d-part car2d-part--${slot}`} />;
      })}
    </div>
  );
};

const Configurator = () => {
  const { t } = useI18n();
  const params = useParams();
  const bikeId = params.bikeId || params.carId;
  const nav = useNavigate();
  const { token, isAuthed } = useAuth();
  const readOnly = !isAuthed;

  const [cars, setCars] = useState([]);
  const [parts, setParts] = useState([]);
  const [backgrounds, setBackgrounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [useStockColor, setUseStockColor] = useState(true);
  const [customColor, setCustomColor] = useState('#22c55e');
  const [selectedByType, setSelectedByType] = useState({});
  const [configName, setConfigName] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const [activeConfigId, setActiveConfigId] = useState('');
  const [viewerBackground, setViewerBackground] = useState('studio');
  const [socketNames, setSocketNames] = useState([]);

  const [activeGroup, setActiveGroup] = useState('performance');
  const [activeType, setActiveType] = useState('exhaust');
  const partsScrollRef = useRef(null);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [partsHudOpen, setPartsHudOpen] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    Promise.all([getCars(), getParts(), getBackgrounds().catch(() => [])])
      .then(([carsRes, partsRes, bgRes]) => {
        if (!alive) return;
        setCars(Array.isArray(carsRes) ? carsRes : []);
        setParts(Array.isArray(partsRes) ? partsRes : []);
        setBackgrounds(Array.isArray(bgRes) ? bgRes : []);
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
  }, []);

  useEffect(() => {
    setSaveStatus('');
    setSelectedByType({});
    setUseStockColor(true);
    setActiveConfigId('');
    setSocketNames([]);
  }, [bikeId]);

  const bike = useMemo(() => cars.find((c) => String(c?._id || '') === String(bikeId || '')), [cars, bikeId]);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
  const resolveAssetUrl = (url) => {
    const u = String(url || '').trim();
    if (!u) return '';
    if (u.startsWith('http://') || u.startsWith('https://')) return u;
    if (u.startsWith('/')) return `${API_BASE_URL}${u}`;
    return `${API_BASE_URL}/${u}`;
  };

  const defaultBackgroundPresets = useMemo(
    () => [
      { key: 'gray', label: t('bg_gray'), kind: 'color', color: '#e6e6e2', sortOrder: 0 },
      { key: 'white', label: t('bg_white'), kind: 'color', color: '#ffffff', sortOrder: 1 },
      {
        key: 'sunset',
        label: t('bg_sunset'),
        kind: 'gradient',
        css: 'linear-gradient(180deg, #f9b9a1 0%, #b9d9ff 42%, #163a8a 43%, #091a3a 100%)',
        sortOrder: 20
      },
      {
        key: 'sky',
        label: t('bg_sky'),
        kind: 'gradient',
        css: 'linear-gradient(180deg, #cfe9ff 0%, #8bc1ff 55%, #2a4c85 56%, #102a4a 100%)',
        sortOrder: 21
      },
      {
        key: 'studio',
        label: t('bg_studio'),
        kind: 'gradient',
        css: 'radial-gradient(circle at 50% 30%, #2a2a2a 0%, #0b0b0b 70%, #050505 100%)',
        sortOrder: 30
      },
      {
        key: 'showroom',
        label: t('bg_showroom'),
        kind: 'gradient',
        css: 'radial-gradient(circle at 50% 35%, #ffffff 0%, #f2f2f2 55%, #d6d6d6 100%)',
        sortOrder: 40
      },
      {
        key: 'stage',
        label: t('bg_stage'),
        kind: 'gradient',
        css: 'radial-gradient(ellipse at 50% 90%, #15251a 0%, #080d0a 40%, #020202 100%)',
        sortOrder: 50
      },
      {
        key: 'garage',
        label: t('bg_garage'),
        kind: 'gradient',
        css: 'radial-gradient(circle at 50% 50%, #11141a 0%, #05070a 60%, #000000 100%)',
        sortOrder: 60
      },
      {
        key: 'dark-studio',
        label: t('bg_dark_studio'),
        kind: 'gradient',
        css: 'radial-gradient(circle at 50% 40%, #1a1f2e 0%, #0a0c12 50%, #000000 100%)',
        sortOrder: 70
      }
    ],
    [t]
  );

  const backgroundPresets = useMemo(() => {
    const map = new Map(defaultBackgroundPresets.map((p) => [String(p.key), p]));
    for (const p of Array.isArray(backgrounds) ? backgrounds : []) {
      const key = String(p?.key || '').trim();
      if (!key) continue;
      const prev = map.get(key) || {};
      map.set(key, { ...prev, ...p, key });
    }
    const list = Array.from(map.values());
    list.sort((a, b) => {
      const ao = Number.isFinite(Number(a.sortOrder)) ? Number(a.sortOrder) : 9999;
      const bo = Number.isFinite(Number(b.sortOrder)) ? Number(b.sortOrder) : 9999;
      if (ao !== bo) return ao - bo;
      return String(a.label || a.key || '').localeCompare(String(b.label || b.key || ''));
    });
    return list;
  }, [backgrounds, defaultBackgroundPresets]);

  const activeBackgroundPreset = useMemo(() => {
    const key = String(viewerBackground || '');
    return backgroundPresets.find((p) => String(p.key) === key) || backgroundPresets[0] || null;
  }, [backgroundPresets, viewerBackground]);

  const backgroundPreviewStyle = useMemo(() => {
    const p = activeBackgroundPreset;
    if (!p) return { background: '#e6e6e2' };
    const kind = String(p.kind || '');
    if (kind === 'image' && p.imageUrl) {
      return {
        backgroundColor: '#0b0b0b',
        backgroundImage: `url('${resolveAssetUrl(p.imageUrl)}')`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        backgroundSize: 'cover'
      };
    }
    if (kind === 'gradient' && p.css) return { background: String(p.css) };
    if (kind === 'color' && p.color) return { background: String(p.color) };
    return { background: '#e6e6e2' };
  }, [activeBackgroundPreset, API_BASE_URL]);

  const groups = useMemo(
    () => [
      { key: 'performance', label: t('cfg_group_performance'), types: ['exhaust', 'clutch'] },
      { key: 'handling', label: t('cfg_group_handling'), types: ['wheels', 'brake', 'suspension', 'tire', 'handlebar'] },
      { key: 'appearance', label: t('cfg_group_appearance'), types: ['bodykit', 'seat', 'lighting'] },
      { key: 'electronics', label: t('cfg_group_electronics'), types: ['throttle_housing'] }
    ],
    [t]
  );

  useEffect(() => {
    const g = groups.find((x) => x.key === activeGroup);
    if (!g) return;
    if (!g.types.includes(activeType)) setActiveType(g.types[0] || '');
  }, [activeGroup, activeType, groups]);

  const partLabel = (type) => {
    const key = String(type || '');
    if (key === 'exhaust') return t('part_exhaust');
    if (key === 'clutch') return t('part_clutch');
    if (key === 'wheels') return t('part_wheels');
    if (key === 'brake') return t('part_brake');
    if (key === 'suspension') return t('part_suspension');
    if (key === 'tire') return t('part_tire');
    if (key === 'handlebar') return t('part_handlebar');
    if (key === 'bodykit') return t('part_bodykit');
    if (key === 'seat') return t('part_seat');
    if (key === 'lighting') return t('part_lighting');
    if (key === 'throttle_housing') return t('part_throttle_housing');
    return key;
  };

  const partsById = useMemo(() => new Map(parts.map((p) => [String(p?._id || ''), p])), [parts]);

  const partsForActiveType = useMemo(() => {
    const type = String(activeType || '');
    return parts.filter((p) => String(p?.type || '') === type);
  }, [activeType, parts]);

  const typeTiles = useMemo(() => {
    const out = [];
    for (const g of groups) {
      for (const type of g.types || []) {
        out.push({ groupKey: g.key, type: String(type || ''), label: partLabel(type) });
      }
    }
    return out;
  }, [groups]);

  const selectedItems = useMemo(() => {
    const out = [];
    for (const [type, id] of Object.entries(selectedByType || {})) {
      const part = partsById.get(String(id || ''));
      if (!part) continue;
      out.push({ type, part });
    }
    out.sort((a, b) => String(a.type).localeCompare(String(b.type)));
    return out;
  }, [partsById, selectedByType]);

  const totalPrice = useMemo(() => {
    let sum = 0;
    for (const it of selectedItems) sum += Number(it?.part?.price) || 0;
    return sum;
  }, [selectedItems]);

  const currentStats = useMemo(() => {
    if (!bike) return null;
    const base = bike.specs || {};
    let powerHp = Number(base.powerHp) || 0;
    let torqueNm = Number(base.torqueNm) || 0;
    let weightKg = Number(base.weightKg) || 0;
    let topSpeedKph = Number(base.topSpeedKph) || 0;
    
    for (const it of selectedItems) {
      const ps = it?.part?.specs || {};
      powerHp += Number(ps.powerHp) || 0;
      torqueNm += Number(ps.torqueNm) || 0;
      weightKg += Number(ps.weightKg) || 0;
      topSpeedKph += Number(ps.topSpeedKph) || 0;
    }
    
    return {
      powerHp,
      torqueNm,
      weightKg,
      topSpeedKph,
      fuelL: base.fuelL,
      engineType: base.engineType,
      gearbox: base.gearbox
    };
  }, [bike, selectedItems]);

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
      throttle_housing: 0.25
    }),
    []
  );

  const viewerSlots = useMemo(() => {
    const slots = [];
    for (const [type, id] of Object.entries(selectedByType || {})) {
      const part = partsById.get(String(id || ''));
      if (!part) continue;
      const url = String(part?.modelUrl || '').trim();
      if (!url) continue;

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
        slots.push({ slot: `${type}:front`, type, socket: front, url, scale: 1, autoScale: true, targetSize });
        slots.push({ slot: `${type}:rear`, type, socket: rear, url, scale: 1, autoScale: true, targetSize });
      } else {
        const primary = candidates[0] || [`${type}_mount`];
        slots.push({ slot: type, type, socket: primary, url, scale: 1, autoScale: true, targetSize });
      }
    }
    return slots;
  }, [partsById, selectedByType, targetSizeByType]);

  const selectedWheels = String(selectedByType?.wheels || '');
  const selectedPartsToSave = useMemo(
    () => Object.entries(selectedByType || {}).filter(([k]) => k !== 'wheels').map(([, v]) => v).filter(Boolean),
    [selectedByType]
  );

  const onSave = async () => {
    setSaveStatus('');
    if (!isAuthed) {
      setSaveStatus(t('cfg_login_required'));
      return;
    }
    if (!bike?._id) return;
    try {
      const data = await createConfiguration({
        token,
        carId: bike._id,
        selectedColor: customColor,
        selectedWheels: selectedWheels || null,
        selectedParts: selectedPartsToSave,
        name: configName
      });
      const id = String(data?.item?._id || '');
      if (id) setActiveConfigId(id);
      setSaveStatus(t('cfg_saved'));
    } catch (e) {
      setSaveStatus(`${t('cfg_save_failed')}: ${e?.message || 'SAVE_FAILED'}`);
    }
  };

  if (loading) return <div className="text-zinc-400">{t('common_loading')}</div>;
  if (error) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 text-red-400">
        {t('common_error')}: {error}
      </div>
    );
  }
  if (!bike) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
        <div className="text-zinc-300">{t('cfg_bike_not_found')}</div>
        <div className="mt-4">
          <Link to="/bikes" className="rounded-lg bg-zinc-800 px-4 py-2 text-sm hover:bg-zinc-700">
            {t('bike_details_back')}
          </Link>
        </div>
      </div>
    );
  }

  const selectType = (type) => {
    const g = groups.find((x) => x.types.includes(type));
    if (g) setActiveGroup(g.key);
    setActiveType(type);
  };

  const togglePart = (type, id) => {
    if (readOnly) {
      return;
    }
    const key = String(type || '');
    const partId = String(id || '');
    const current = String(selectedByType?.[key] || '');
    const nextPartId = current && current === partId ? null : partId;
    setSelectedByType((prev) => {
      const current = String(prev?.[key] || '');
      if (current && current === partId) {
        const next = { ...(prev || {}) };
        delete next[key];
        return next;
      }
      return { ...(prev || {}), [key]: partId };
    });

    if (isAuthed && activeConfigId) {
      updateConfigurationPart({ token, configId: activeConfigId, slot: key, partId: nextPartId }).catch(() => {});
    }
  };

  const clearType = (type) => {
    if (readOnly) {
      return;
    }
    const key = String(type || '');
    setSelectedByType((prev) => {
      const next = { ...(prev || {}) };
      delete next[key];
      return next;
    });

    if (isAuthed && activeConfigId) {
      updateConfigurationPart({ token, configId: activeConfigId, slot: key, partId: null }).catch(() => {});
    }
  };

  return (
    <div className="-mx-4 -my-6 h-[calc(100vh-72px)] min-h-[640px] bg-black">
      <div className="relative h-full w-full">
        {leftOpen ? (
          <div className="absolute inset-0 z-30">
            <button type="button" onClick={() => setLeftOpen(false)} className="absolute inset-0 bg-black/50" aria-label="Close" />
            <div className="absolute inset-y-0 left-0 w-[320px] max-w-[86vw] overflow-auto border-r border-zinc-800 bg-zinc-950 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-zinc-100">{t('cfg_color')}</div>
                <button
                  type="button"
                  onClick={() => setLeftOpen(false)}
                  className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-900"
                >
                  {t('cfg_close')}
                </button>
              </div>

              <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
                <div className="text-xs font-medium text-zinc-300">{t('cfg_color')}</div>
                <div className="mt-2 flex overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
                  <button
                    type="button"
                    onClick={() => {
                      if (readOnly) return;
                      setUseStockColor(true);
                    }}
                    className={`flex-1 px-3 py-2 text-xs transition ${
                      useStockColor ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-300 hover:bg-zinc-900'
                    }`}
                    disabled={readOnly}
                  >
                    {t('cfg_stock_color')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (readOnly) return;
                      setUseStockColor(false);
                    }}
                    className={`flex-1 px-3 py-2 text-xs transition ${
                      !useStockColor ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-300 hover:bg-zinc-900'
                    }`}
                    disabled={readOnly}
                  >
                    {t('cfg_custom_color')}
                  </button>
                </div>
                <input
                  type="color"
                  value={customColor}
                  onChange={(e) => {
                    if (readOnly) return;
                    setCustomColor(e.target.value);
                    setUseStockColor(false);
                  }}
                  className={`mt-2 h-10 w-full cursor-pointer rounded-lg bg-zinc-950 ${useStockColor ? 'opacity-50' : ''}`}
                  disabled={useStockColor || readOnly}
                />
                {readOnly ? <div className="mt-2 text-xs text-zinc-400">{t('cfg_login_required')}</div> : null}
              </div>
            </div>
          </div>
        ) : null}

        {rightOpen ? (
          <div className="absolute inset-0 z-30">
            <button type="button" onClick={() => setRightOpen(false)} className="absolute inset-0 bg-black/50" aria-label="Close" />
            <div className="absolute inset-y-0 right-0 w-[360px] max-w-[92vw] overflow-auto border-l border-zinc-800 bg-zinc-950 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-zinc-100">{t('cfg_summary')}</div>
                <button
                  type="button"
                  onClick={() => setRightOpen(false)}
                  className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-900"
                >
                  {t('cfg_close')}
                </button>
              </div>

              <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-zinc-400">{t('cfg_selected_count_label')}</div>
                  <div className="text-xs text-zinc-200">{selectedItems.length} {t('cfg_selected_count_unit')}</div>
                </div>
                <div className="mt-3 space-y-2">
                  {selectedItems.length ? (
                    selectedItems.map(({ type, part }) => {
                      const price = formatPrice(part?.price);
                      return (
                        <div key={type} className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs text-zinc-400">{partLabel(type)}</div>
                            <div className="truncate text-sm font-medium text-zinc-100">{part?.name || '-'}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            {price ? <div className="text-xs text-zinc-300">${price}</div> : null}
                            <button
                              type="button"
                              onClick={() => clearType(type)}
                              disabled={readOnly}
                              className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {t('cfg_remove')}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-zinc-400">
                      {t('cfg_no_parts_selected')}
                    </div>
                  )}
                </div>
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      if (readOnly) return;
                      setSelectedByType({});
                      setConfigName('');
                      setSaveStatus('');
                      setUseStockColor(true);
                    }}
                    disabled={readOnly}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-200 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t('cfg_reset')}
                  </button>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
                <div className="text-sm font-semibold text-zinc-100">{t('cfg_save')}</div>
                <div className="mt-3 space-y-3">
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3">
                    <div className="text-xs font-medium text-zinc-300">{t('cfg_background')}</div>
                    <div className="mt-2 flex items-center gap-2">
                      <select
                        value={viewerBackground}
                        onChange={(e) => setViewerBackground(e.target.value)}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500"
                      >
                        {backgroundPresets.map((p) => (
                          <option key={p.key} value={p.key}>
                            {p.label || p.key}
                          </option>
                        ))}
                      </select>
                      <div className="h-8 w-8 shrink-0 rounded-lg border border-zinc-800" style={backgroundPreviewStyle} />
                    </div>
                  </div>
                  <input
                    value={configName}
                    onChange={(e) => {
                      if (readOnly) return;
                      setConfigName(e.target.value);
                    }}
                    placeholder={t('cfg_name_placeholder')}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-emerald-500"
                    disabled={readOnly}
                  />
                  <button
                    type="button"
                    onClick={onSave}
                    disabled={readOnly}
                    className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t('cfg_save_build')}
                  </button>
                  {!isAuthed ? <div className="text-xs text-zinc-400">{t('cfg_login_required')}</div> : null}
                  {saveStatus ? <div className="text-sm text-zinc-200">{saveStatus}</div> : null}
                </div>
              </div>

              <details className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
                <summary className="cursor-pointer select-none text-sm font-semibold text-zinc-100">{t('cfg_tools')}</summary>
                <div className="mt-3 space-y-3">
                  <div>
                    <div className="text-xs font-medium text-zinc-300">2D Preview</div>
                    <div className="mt-2">
                      <Car2DPreview bike={bike} selectedByType={selectedByType} partsById={partsById} resolveAssetUrl={resolveAssetUrl} />
                    </div>
                  </div>
                  {socketNames.length ? (
                    <div>
                      <div className="text-xs font-medium text-zinc-300">Sockets</div>
                      <div className="mt-2 max-h-28 overflow-auto rounded-lg border border-zinc-800 bg-zinc-950 p-2 font-mono text-[11px] text-zinc-200">
                        {socketNames.map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => navigator.clipboard?.writeText?.(n)}
                            className="block w-full truncate rounded px-1 py-0.5 text-left hover:bg-zinc-900"
                            title="Copy"
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </details>
            </div>
          </div>
        ) : null}

        {statsOpen ? (
          <div className="absolute inset-0 z-40 grid place-items-center p-4">
            <button type="button" onClick={() => setStatsOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-label={t('cfg_close')} />
            <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
              <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
                <div className="text-lg font-semibold text-zinc-100">{t('cfg_stats_title')}</div>
                <button
                  type="button"
                  onClick={() => setStatsOpen(false)}
                  className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white"
                >
                  {t('cfg_close')}
                </button>
              </div>
              <div className="p-5">
                {currentStats ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-zinc-800/50 pb-2">
                      <span className="text-zinc-400">{t('cfg_stat_power')}</span>
                      <span className="font-medium text-emerald-400">{currentStats.powerHp ? currentStats.powerHp.toFixed(1) : '-'}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-zinc-800/50 pb-2">
                      <span className="text-zinc-400">{t('cfg_stat_torque')}</span>
                      <span className="font-medium text-emerald-400">{currentStats.torqueNm ? currentStats.torqueNm.toFixed(1) : '-'}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-zinc-800/50 pb-2">
                      <span className="text-zinc-400">{t('cfg_stat_weight')}</span>
                      <span className="font-medium text-emerald-400">{currentStats.weightKg ? currentStats.weightKg.toFixed(1) : '-'}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-zinc-800/50 pb-2">
                      <span className="text-zinc-400">{t('cfg_stat_top_speed')}</span>
                      <span className="font-medium text-emerald-400">{currentStats.topSpeedKph ? currentStats.topSpeedKph.toFixed(1) : '-'}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-zinc-800/50 pb-2">
                      <span className="text-zinc-400">{t('cfg_stat_fuel')}</span>
                      <span className="font-medium text-zinc-100">{currentStats.fuelL || '-'}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-zinc-800/50 pb-2">
                      <span className="text-zinc-400">{t('cfg_stat_engine')}</span>
                      <span className="font-medium text-zinc-100">{currentStats.engineType || '-'}</span>
                    </div>
                    <div className="flex items-center justify-between pb-1">
                      <span className="text-zinc-400">{t('cfg_stat_gearbox')}</span>
                      <span className="font-medium text-zinc-100">{currentStats.gearbox || '-'}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-zinc-500">{t('cfg_no_stats')}</div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        <div className="relative h-full w-full overflow-hidden bg-transparent">
          <div className="absolute inset-0">
            <CarViewer
              className="h-full w-full rounded-none border-0 bg-transparent"
              carModelUrl={bike.model3d || bike.modelUrl}
              color={useStockColor ? undefined : customColor}
              paintTargets={{}}
              onCarMeta={(meta) => {
                const nodes = Array.isArray(meta?.nodes) ? meta.nodes : [];
                const list = nodes
                  .map((n) => String(n || '').trim())
                  .filter(Boolean)
                  .filter((n) => /socket|mount/i.test(n))
                  .sort((a, b) => a.localeCompare(b));
                setSocketNames(list);
              }}
              slots={viewerSlots}
              background={viewerBackground}
              backgroundPreset={activeBackgroundPreset}
            />
          </div>

          <div className="pointer-events-none absolute right-6 top-6 z-20">
            <div className="pointer-events-auto flex flex-col items-end gap-4">
              <button
                type="button"
                onClick={() => setStatsOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-black/40 px-5 py-3 text-sm font-medium text-white backdrop-blur-md transition-all hover:bg-black/60 border border-white/10"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 20V10M18 20V4M6 20v-4" />
                </svg>
                {t('cfg_btn_stats')}
              </button>
              <button
                type="button"
                onClick={() => setRightOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-black/40 px-5 py-3 text-sm font-medium text-white backdrop-blur-md transition-all hover:bg-black/60 border border-white/10"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                {t('cfg_btn_config')}
              </button>
              <button
                type="button"
                onClick={() => setPartsHudOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-black/40 px-5 py-3 text-sm font-medium text-white backdrop-blur-md transition-all hover:bg-black/60 border border-white/10"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 3v4M3 5h4M6 17v4M4 19h4M13 3l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                {t('cfg_btn_parts')}
              </button>
            </div>
          </div>

          <div className="pointer-events-none absolute left-6 top-6 z-20">
            <div className="pointer-events-auto flex flex-col gap-4">
              <button
                type="button"
                onClick={() => {
                  if (window.history.length > 1) {
                    nav(-1);
                    return;
                  }
                  nav('/custom', { replace: true });
                }}
                className="flex items-center gap-2 rounded-xl bg-black/40 px-5 py-3 text-sm font-medium text-white backdrop-blur-md transition-all hover:bg-black/60 border border-white/10"
                title={t('bike_details_back')}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
                <span className="hidden sm:inline">{t('common_back')}</span>
              </button>
              <button
                type="button"
                onClick={() => setLeftOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-black/40 px-5 py-3 text-sm font-medium text-white backdrop-blur-md transition-all hover:bg-black/60 border border-white/10"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 3h8" />
                </svg>
                {t('cfg_color_and_bg')}
              </button>
              {!isAuthed ? (
                <div className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-xs text-white/80 backdrop-blur">
                  {t('cfg_login_required')}
                </div>
              ) : null}
            </div>
          </div>

          {partsHudOpen ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-6 z-10 pb-4">
              <div className="pointer-events-auto mx-auto w-full max-w-[1100px] px-6">
                <div className="rounded-[1.5rem] border border-white/10 bg-black/50 p-4 text-white backdrop-blur-xl shadow-2xl">
                  <div className="flex items-center gap-4">
                    <div className="min-w-0 flex-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      <div className="flex min-w-max items-center gap-2">
                        {typeTiles.map((tile) => {
                          const active = String(activeType) === String(tile.type);
                          return (
                            <button
                              key={tile.type}
                              type="button"
                              onClick={() => selectType(tile.type)}
                              className={`flex items-center gap-2 rounded-full px-2 py-1 transition ${
                                active ? 'bg-white/15 text-white' : 'bg-white/5 text-white/80 hover:bg-white/10 hover:text-white'
                              }`}
                              title={tile.label}
                            >
                              <span
                                className={`grid h-7 w-7 place-items-center rounded-full border text-[11px] font-semibold ${
                                  active ? 'border-white/30 bg-white/10' : 'border-white/15 bg-black/30'
                                }`}
                              >
                                {String(tile.label || '').slice(0, 1).toUpperCase()}
                              </span>
                              <span className="hidden pr-1 text-[11px] font-semibold sm:block">{tile.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => clearType(activeType)}
                      className="rounded-full bg-white/10 px-3 py-2 text-[11px] font-semibold text-white hover:bg-white/15"
                      disabled={readOnly}
                    >
                      {t('cfg_clear')}
                    </button>
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    <div className="min-w-0 truncate text-[12px] text-white/80">
                      {t('cfg_active_part')} <span className="font-semibold text-white">{partLabel(activeType)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => partsScrollRef.current?.scrollBy?.({ left: -360, behavior: 'smooth' })}
                      className="ml-auto grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white hover:bg-white/15"
                      title={t('cfg_btn_prev')}
                    >
                      ‹
                    </button>
                    <div
                      ref={partsScrollRef}
                      className="min-w-0 flex-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    >
                      <div className="flex min-w-max snap-x snap-mandatory items-stretch gap-4">
                        {partsForActiveType.length ? (
                          partsForActiveType.map((p) => {
                            const id = String(p?._id || '');
                            const selected = String(selectedByType?.[activeType] || '') === id;
                            const thumb = resolveAssetUrl(p?.thumbnailUrl || '');
                            return (
                            <button
                                key={id}
                                type="button"
                                onClick={() => togglePart(activeType, id)}
                                className={`group w-[140px] snap-start overflow-hidden rounded-xl border text-left transition ${
                                  selected ? 'border-emerald-400 bg-emerald-500/15' : 'border-white/10 bg-black/20 hover:bg-black/30'
                                }`}
                                title={p?.name || ''}
                              disabled={readOnly}
                              >
                                <div className="aspect-[16/9] w-full bg-white/5">
                                  {thumb ? (
                                    <img
                                      src={thumb}
                                      alt=""
                                      className="h-full w-full object-cover opacity-95 transition duration-500 group-hover:opacity-100"
                                    />
                                  ) : null}
                                </div>
                                <div className="px-2 py-1">
                                  <div className="truncate text-[11px] font-semibold text-white">{p?.name || '-'}</div>
                                </div>
                              </button>
                            );
                          })
                        ) : (
                          <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-white/70">
                            {t('cfg_no_parts')}
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => partsScrollRef.current?.scrollBy?.({ left: 360, behavior: 'smooth' })}
                      className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white hover:bg-white/15"
                      title={t('cfg_btn_next')}
                    >
                      ›
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default Configurator;
