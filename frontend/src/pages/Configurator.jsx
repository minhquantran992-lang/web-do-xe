import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import Header from '../components/configurator/Header.jsx';
import OptionsPanel from '../components/configurator/OptionsPanel.jsx';
import Sidebar from '../components/configurator/Sidebar.jsx';
import Viewer from '../components/configurator/Viewer.jsx';
import { getBackgrounds, getCars } from '../services/api/cars.js';
import { getParts } from '../services/api/parts.js';
import { createConfiguration, setConfigurationThumbnail, shareBuild, updateConfigurationPaint, updateConfigurationPart } from '../services/api/configurations.js';
import { getApiBaseUrl } from '../services/api/client.js';
import { normalizeVariantKey, resolveBestComboKey } from '../services/combinedModels.js';
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
  if (t === 'topbox') return [['topbox_mount', 'topbox_socket', 'rear_box_mount', 'rear_rack_mount', 'seat_mount', 'seat_socket']];
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
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(n)} ₫`;
};

const Configurator = () => {
  const { t } = useI18n();
  const params = useParams();
  const bikeId = params.bikeId || params.carId;
  const nav = useNavigate();
  const location = useLocation();
  const { token, isAuthed } = useAuth();
  const readOnly = false;
  const isObjectId = (value) => /^[a-f0-9]{24}$/i.test(String(value || '').trim());
  const viewerMode = useMemo(() => {
    const search = String(location?.search || '');
    const params = new URLSearchParams(search);
    const v = String(params.get('viewer') || '').trim().toLowerCase();
    return v === 'legacy' ? 'legacy' : 'scene';
  }, [location?.search]);

  const [cars, setCars] = useState([]);
  const [parts, setParts] = useState([]);
  const [backgrounds, setBackgrounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedByType, setSelectedByType] = useState({});
  const [carColor, setCarColor] = useState('#ffffff');
  const [activeConfigId, setActiveConfigId] = useState('');
  const [viewerBackground, setViewerBackground] = useState('studio');
  const [embeddedVariantsByType, setEmbeddedVariantsByType] = useState({});
  const [bgPickerOpen, setBgPickerOpen] = useState(false);
  const [comboStyleOpen, setComboStyleOpen] = useState(false);
  const [comboStyleKey, setComboStyleKey] = useState('');
  const [comboStyleSelectedKey, setComboStyleSelectedKey] = useState('');
  const [comboPreviewOpen, setComboPreviewOpen] = useState(false);
  const [comboPreviewKey, setComboPreviewKey] = useState('');
  const [forcedCombinedModelKey, setForcedCombinedModelKey] = useState('');
  const [savingBuild, setSavingBuild] = useState(false);
  const [sharePromptOpen, setSharePromptOpen] = useState(false);
  const [savePromptOpen, setSavePromptOpen] = useState(false);
  const [savePromptName, setSavePromptName] = useState('');
  const [savePromptShare, setSavePromptShare] = useState(false);
  const [lastSavedConfigId, setLastSavedConfigId] = useState('');
  const [sharingBuild, setSharingBuild] = useState(false);
  const [cameraState, setCameraState] = useState(null);
  const viewerRef = useRef(null);

  const [activeGroup, setActiveGroup] = useState('performance');
  const [activeType, setActiveType] = useState('wheels');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [hasPickedType, setHasPickedType] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const [hover3d, setHover3d] = useState(null);
  const [mechanicalCollisions, setMechanicalCollisions] = useState([]);
  const EMBEDDED_PREFIX = '__embedded:';
  const isEmbeddedSelection = (value) => String(value || '').startsWith(EMBEDDED_PREFIX);
  const embeddedNameFromSelection = (value) => String(value || '').slice(EMBEDDED_PREFIX.length);
  const isHexColor = (value) => /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(String(value || '').trim());
  const safeCarColor = isHexColor(carColor) ? String(carColor).trim() : '#ffffff';
  const persistPaint = (patch = {}) => {
    if (!isAuthed || !activeConfigId) return;
    updateConfigurationPaint({ token, configId: activeConfigId, ...patch }).catch(() => {});
  };

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
    setSelectedByType({});
    setCarColor('#ffffff');
    setActiveConfigId('');
    setHasPickedType(false);
    setToast(null);
    setHover3d(null);
    setSidebarOpen(false);
    setOptionsOpen(false);
    setSavingBuild(false);
    setSharePromptOpen(false);
    setLastSavedConfigId('');
    setSharingBuild(false);
    setCameraState(null);
  }, [bikeId]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!bgPickerOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setBgPickerOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [bgPickerOpen]);

  useEffect(() => {
    if (!sharePromptOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setSharePromptOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sharePromptOpen]);

  useEffect(() => {
    if (!comboPreviewOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setComboPreviewOpen(false);
        setComboPreviewKey('');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [comboPreviewOpen]);

  const bike = useMemo(() => cars.find((c) => String(c?._id || '') === String(bikeId || '')), [cars, bikeId]);
  const displayBikeName = useMemo(() => {
    const n = String(bike?.name || bike?.title || '').trim();
    const key = n.toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (key === 'xsr155') return 'XSR155';
    return n;
  }, [bike?.name, bike?.title]);

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

  const groups = useMemo(
    () => [
      { key: 'performance', label: t('cfg_group_performance'), types: ['exhaust', 'clutch'] },
      { key: 'handling', label: t('cfg_group_handling'), types: ['wheels', 'brake', 'suspension', 'tire', 'handlebar'] },
      { key: 'appearance', label: t('cfg_group_appearance'), types: ['bodykit', 'seat', 'lighting', 'topbox'] },
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
    if (key === 'topbox') return t('part_topbox');
    return key;
  };

  const partsById = useMemo(() => new Map(parts.map((p) => [String(p?._id || ''), p])), [parts]);

  const combos = useMemo(() => {
    const list = Array.isArray(bike?.combos) ? bike.combos : [];
    const out = [];
    for (const item of list) {
      const key = String(item?.key || '').trim();
      if (!key) continue;
      const title = String(item?.title || '').trim() || key;
      const modelKey = String(item?.modelKey || '').trim();
      const sortOrderNum = Number(item?.sortOrder);
      const sortOrder = Number.isFinite(sortOrderNum) ? sortOrderNum : 0;
      const rawSlots = item?.slots;
      const slots =
        rawSlots && typeof rawSlots === 'object'
          ? Object.fromEntries(Object.entries(rawSlots).map(([k, v]) => [String(k || '').trim(), String(v || '').trim()]))
          : {};
      const cleanSlots = {};
      for (const [slot, id] of Object.entries(slots || {})) {
        if (!slot) continue;
        if (!id) continue;
        cleanSlots[slot] = id;
      }
      const preview = [];
      for (const [slot, id] of Object.entries(cleanSlots)) {
        const p = partsById.get(String(id || ''));
        const name = String(p?.name || id || '').trim();
        preview.push(`${partLabel(slot)}: ${name}`.trim());
      }
      if (!Object.keys(cleanSlots).length && !modelKey) continue;
      out.push({ key, title, modelKey, sortOrder, slots: cleanSlots, preview: preview.filter(Boolean) });
    }

    if (!out.length) {
      const modelMap = bike?.combinedModels && typeof bike.combinedModels === 'object' ? bike.combinedModels : {};
      const derived = Object.keys(modelMap || {})
        .map((k) => String(k || '').trim())
        .filter((k) => k && k !== 'stock' && !k.includes('_'))
        .map((k) => ({
          key: k,
          title: k,
          modelKey: k,
          sortOrder: 0,
          slots: {},
          preview: []
        }))
        .sort((a, b) => String(a.title).localeCompare(String(b.title)));
      if (derived.length) return derived;
    }

    out.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || String(a.title).localeCompare(String(b.title)));
    return out;
  }, [bike?.combos, bike?.combinedModels, partLabel, partsById]);

  const comboStyles = useMemo(() => {
    const key = String(comboStyleKey || '').trim();
    const make = (k, title, desc, backgroundKey, color) => ({
      key: k,
      title,
      desc,
      backgroundKey,
      color
    });
    if (key === 'sport')
      return [
        make('sport-night', t('cfg_style_night'), t('cfg_style_night_hint'), 'dark-studio', '#111827'),
        make('sport-stage', t('cfg_style_stage'), t('cfg_style_stage_hint'), 'stage', '#ef4444'),
        make('sport-sunset', t('cfg_style_sunset'), t('cfg_style_sunset_hint'), 'sunset', '#f97316')
      ];
    if (key === 'touring')
      return [
        make('tour-showroom', t('cfg_style_showroom'), t('cfg_style_showroom_hint'), 'showroom', '#e5e7eb'),
        make('tour-garage', t('cfg_style_garage'), t('cfg_style_garage_hint'), 'garage', '#9ca3af'),
        make('tour-sky', t('cfg_style_sky'), t('cfg_style_sky_hint'), 'sky', '#ffffff')
      ];
    if (key === 'comfort')
      return [
        make('comfort-studio', t('cfg_style_studio'), t('cfg_style_studio_hint'), 'studio', '#f8fafc'),
        make('comfort-gray', t('cfg_style_minimal'), t('cfg_style_minimal_hint'), 'gray', '#e5e7eb'),
        make('comfort-white', t('cfg_style_clean'), t('cfg_style_clean_hint'), 'white', '#ffffff')
      ];
    return [
      make('style-studio', t('cfg_style_studio'), t('cfg_style_studio_hint'), 'studio', '#ffffff'),
      make('style-showroom', t('cfg_style_showroom'), t('cfg_style_showroom_hint'), 'showroom', '#e5e7eb'),
      make('style-night', t('cfg_style_night'), t('cfg_style_night_hint'), 'dark-studio', '#111827')
    ];
  }, [comboStyleKey, t]);

  const selectedComboStyle = useMemo(() => {
    const list = Array.isArray(comboStyles) ? comboStyles : [];
    const current = String(comboStyleSelectedKey || '').trim();
    return list.find((s) => String(s?.key || '').trim() === current) || list[0] || null;
  }, [comboStyles, comboStyleSelectedKey]);

  const selectedComboStyleBackgroundPreset = useMemo(() => {
    const key = String(selectedComboStyle?.backgroundKey || '').trim();
    if (!key) return null;
    return backgroundPresets.find((p) => String(p?.key || '') === key) || null;
  }, [backgroundPresets, selectedComboStyle]);

  useEffect(() => {
    if (!comboStyleOpen) return;
    const list = Array.isArray(comboStyles) ? comboStyles : [];
    if (!list.length) return;
    const current = String(comboStyleSelectedKey || '').trim();
    const isValid = current && list.some((s) => String(s?.key || '').trim() === current);
    if (!isValid) setComboStyleSelectedKey(String(list[0]?.key || ''));
  }, [comboStyleOpen, comboStyles, comboStyleSelectedKey]);

  const applyComboStyle = (styleKey) => {
    const k = String(styleKey || '').trim();
    const s = comboStyles.find((x) => String(x?.key || '').trim() === k);
    if (!s) return;
    const bg = String(s?.backgroundKey || '').trim();
    if (bg) setViewerBackground(bg);
    const c = String(s?.color || '').trim();
    if (c) {
      setCarColor(c);
      if (isHexColor(c)) persistPaint({ selectedColor: c });
    }
    setComboStyleOpen(false);
    setComboStyleKey('');
    setComboStyleSelectedKey('');
    showToast(t('cfg_style_applied'));
  };

  const applyCombo = (comboKey) => {
    const key = String(comboKey || '').trim();
    if (!key) return;
    const combo = combos.find((c) => String(c?.key || '').trim() === key);
    const slots = combo?.slots && typeof combo.slots === 'object' ? combo.slots : null;
    const forceKey = String(combo?.modelKey || '').trim();
    setForcedCombinedModelKey(forceKey);

    if (slots) {
      setSelectedByType((prev) => {
        const next = { ...(prev || {}) };
        for (const [slot, id] of Object.entries(slots)) {
          const s = String(slot || '').trim();
          const v = String(id || '').trim();
          if (!s) continue;
          if (!v) delete next[s];
          else next[s] = v;
        }
        return next;
      });

      if (isAuthed && activeConfigId) {
        for (const [slot, id] of Object.entries(slots)) {
          const s = String(slot || '').trim();
          if (!s) continue;
          const v = String(id || '').trim();
          updateConfigurationPart({ token, configId: activeConfigId, slot: s, partId: v || null }).catch(() => {});
        }
      }
    }

    showToast(t('cfg_combo_applied'));
    setComboStyleOpen(false);
    setComboStyleKey('');
    setComboStyleSelectedKey('');
    setSidebarOpen(false);
  };

  const openComboPreview = (comboKey) => {
    const key = String(comboKey || '').trim();
    if (!key) return;
    setComboPreviewKey(key);
    setComboPreviewOpen(true);
    setSidebarOpen(false);
  };

  const comboPreview = useMemo(
    () => combos.find((c) => String(c?.key || '').trim() === String(comboPreviewKey || '').trim()) || null,
    [comboPreviewKey, combos]
  );
  const comboPreviewSlots = useMemo(() => {
    const slots = comboPreview?.slots && typeof comboPreview.slots === 'object' ? comboPreview.slots : null;
    return slots && typeof slots === 'object' ? slots : null;
  }, [comboPreview]);
  const comboPreviewSelectedByType = useMemo(() => {
    const base = { ...(selectedByType || {}) };
    if (comboPreviewSlots) {
      for (const [slot, id] of Object.entries(comboPreviewSlots)) {
        const s = String(slot || '').trim();
        const v = String(id || '').trim();
        if (!s) continue;
        if (!v) delete base[s];
        else base[s] = v;
      }
    }
    return base;
  }, [comboPreviewSlots, selectedByType]);
  const comboPreviewForcedModelKey = useMemo(() => String(comboPreview?.modelKey || '').trim(), [comboPreview]);

  const comboPreviewSlotsOrder = useMemo(() => {
    const raw = bike?.combinedModelSlots;
    const base =
      Array.isArray(raw) && raw.length
        ? raw.map((x) => String(x || '').trim()).filter(Boolean)
        : ['exhaust', 'topbox'];

    const selectedTypes =
      comboPreviewSelectedByType && typeof comboPreviewSelectedByType === 'object' ? Object.keys(comboPreviewSelectedByType) : [];
    const extras = [];
    for (const t2 of selectedTypes) {
      const key = String(t2 || '').trim();
      if (!key) continue;
      if (key !== 'exhaust' && key !== 'topbox' && key !== 'handlebar') continue;
      if (!base.includes(key) && !extras.includes(key)) extras.push(key);
    }

    return [...base, ...extras];
  }, [bike?.combinedModelSlots, comboPreviewSelectedByType]);

  const comboPreviewConfig = useMemo(() => {
    const cfg = {};
    for (const type of comboPreviewSlotsOrder) {
      const selectedId = String(comboPreviewSelectedByType?.[type] || '');
      if (!selectedId) {
        cfg[type] = 'stock';
        continue;
      }
      if (isEmbeddedSelection(selectedId)) {
        cfg[type] = normalizeVariantKey(embeddedNameFromSelection(selectedId)) || 'stock';
        continue;
      }
      const p = partsById.get(selectedId);
      cfg[type] = normalizeVariantKey(p?.variantKey || p?.name || '') || 'stock';
    }
    return cfg;
  }, [comboPreviewSelectedByType, comboPreviewSlotsOrder, embeddedNameFromSelection, isEmbeddedSelection, partsById]);

  const comboPreviewCombinedModelSelection = useMemo(() => {
    const order = Array.isArray(comboPreviewSlotsOrder) ? comboPreviewSlotsOrder : [];
    const modelMap = bike?.combinedModels && typeof bike.combinedModels === 'object' ? bike.combinedModels : {};
    if (!modelMap || !Object.keys(modelMap).length) return { url: '', key: '', covered: [] };

    const forced = String(comboPreviewForcedModelKey || '').trim();
    if (forced && modelMap[forced]) {
      const url = String(modelMap[forced] || '').trim();
      const covered = order.length ? order : Object.keys(comboPreviewSelectedByType || {}).map((k) => String(k || '')).filter(Boolean);
      return url ? { url, key: forced, covered } : { url: '', key: '', covered: [] };
    }
    if (!order.length) return { url: '', key: '', covered: [] };

    const key = resolveBestComboKey({ slotsOrder: order, modelMap, config: comboPreviewConfig });
    const url = key ? String(modelMap[key] || '').trim() : '';
    if (!url) return { url: '', key: '', covered: [] };

    const tokens = String(key || '').split('_');
    const coveredByKey = order.filter((slot, idx) => String(tokens[idx] || 'stock') !== 'stock');
    if (tokens.length < order.length) {
      const nonStock = order.filter((slot) => (normalizeVariantKey(comboPreviewConfig?.[slot] || 'stock') || 'stock') !== 'stock');
      if (nonStock.length === 1) return { url, key, covered: nonStock };
    }
    const covered = coveredByKey;
    return { url, key, covered };
  }, [bike, comboPreviewConfig, comboPreviewForcedModelKey, comboPreviewSelectedByType, comboPreviewSlotsOrder]);

  const comboPreviewCombinedModelUrl = comboPreviewCombinedModelSelection.url;
  const comboPreviewCombinedModelCovered = comboPreviewCombinedModelSelection.covered;
  const comboPreviewEffectiveCarModelUrl = comboPreviewCombinedModelUrl || bike?.model3d || bike?.modelUrl || '';

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

  const comboPreviewViewerSlots = useMemo(() => {
    const slots = [];
    for (const [type, id] of Object.entries(comboPreviewSelectedByType || {})) {
      if (comboPreviewCombinedModelUrl && comboPreviewCombinedModelCovered.includes(String(type || ''))) continue;
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
  }, [comboPreviewCombinedModelCovered, comboPreviewCombinedModelUrl, comboPreviewSelectedByType, partsById, targetSizeByType]);

  const comboPreviewEmbeddedConfig = useMemo(() => {
    const cfg = {};
    for (const [type, v] of Object.entries(comboPreviewSelectedByType || {})) {
      const sel = String(v || '');
      if (!sel || !isEmbeddedSelection(sel)) continue;
      const name = embeddedNameFromSelection(sel);
      if (!name) continue;
      cfg[String(type || '')] = name;
    }
    return cfg;
  }, [comboPreviewSelectedByType, embeddedNameFromSelection, isEmbeddedSelection]);

  const partsForActiveType = useMemo(() => {
    const type = String(activeType || '');
    const embedded = embeddedVariantsByType && typeof embeddedVariantsByType === 'object' ? embeddedVariantsByType[type] : null;
    const list = Array.isArray(embedded) ? embedded : [];
    if (list.length) {
      return list.map((name) => ({
        _id: `${EMBEDDED_PREFIX}${String(name || '')}`,
        type,
        name: String(name || ''),
        price: 0
      }));
    }
    return parts.filter((p) => String(p?.type || '') === type);
  }, [EMBEDDED_PREFIX, activeType, embeddedVariantsByType, parts]);

  const selectedItems = useMemo(() => {
    const out = [];
    for (const [type, id] of Object.entries(selectedByType || {})) {
      const sel = String(id || '');
      if (isEmbeddedSelection(sel)) {
        const name = embeddedNameFromSelection(sel);
        if (!name) continue;
        out.push({
          type,
          part: { _id: sel, type: String(type || ''), name, price: 0 }
        });
        continue;
      }
      const part = partsById.get(sel);
      if (!part) continue;
      out.push({ type, part });
    }
    out.sort((a, b) => String(a.type).localeCompare(String(b.type)));
    return out;
  }, [embeddedNameFromSelection, isEmbeddedSelection, partsById, selectedByType]);

  const totalPrice = useMemo(() => {
    let sum = 0;
    for (const it of selectedItems) sum += Number(it?.part?.price) || 0;
    return sum;
  }, [selectedItems]);

  const collisionPairsByPartId = useMemo(() => {
    const pairs = Array.isArray(mechanicalCollisions) ? mechanicalCollisions : [];
    const out = [];
    const seen = new Set();
    for (const pair of pairs) {
      const aSlot = String(pair?.[0] || '').trim();
      const bSlot = String(pair?.[1] || '').trim();
      const aType = String(aSlot.split(':')[0] || '').trim();
      const bType = String(bSlot.split(':')[0] || '').trim();
      const aId = String(selectedByType?.[aType] || '').trim();
      const bId = String(selectedByType?.[bType] || '').trim();
      if (!aId || !bId) continue;
      if (aId === bId) continue;
      if (isEmbeddedSelection(aId) || isEmbeddedSelection(bId)) continue;
      const k = [aId, bId].sort().join('|');
      if (seen.has(k)) continue;
      seen.add(k);
      out.push([aId, bId]);
    }
    return out;
  }, [isEmbeddedSelection, mechanicalCollisions, selectedByType]);

  const mechanicalConflictInfo = useMemo(() => {
    const normalizeTags = (value) => {
      const arr = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,\n]/g) : [];
      const out = [];
      for (const x of arr) {
        const t = String(x || '')
          .trim()
          .toLowerCase()
          .replace(/\s+/g, '_');
        if (!t) continue;
        if (!out.includes(t)) out.push(t);
      }
      return out;
    };
    const partMount = (p) =>
      String(p?.mount_point || p?.mountPoint || (Array.isArray(p?.mountPoints) ? p.mountPoints[0] : '') || '')
        .trim()
        .toLowerCase();
    const partCompat = (p) => normalizeTags(p?.compatibility_tags || p?.compatibilityTags || []);
    const partExcl = (p) => normalizeTags(p?.exclusion_tags || p?.exclusionTags || []);
    const intersectsAny = (a, b) => {
      if (!a?.length || !b?.length) return false;
      const setB = new Set(b);
      for (const x of a) if (setB.has(x)) return true;
      return false;
    };

    const selected = [];
    for (const [type, id] of Object.entries(selectedByType || {})) {
      const sel = String(id || '').trim();
      if (!sel) continue;
      if (isEmbeddedSelection(sel)) continue;
      const p = partsById.get(sel);
      if (!p) continue;
      selected.push({ type: String(type || '').trim(), id: sel, part: p });
    }

    const byPairKey = new Map();
    const upsert = ({ a, b, reason }) => {
      const aId = String(a?.id || '').trim();
      const bId = String(b?.id || '').trim();
      if (!aId || !bId || aId === bId) return;
      const k = [aId, bId].sort().join('|');
      const existing = byPairKey.get(k) || { a, b, reasons: new Set() };
      existing.reasons.add(String(reason || ''));
      byPairKey.set(k, existing);
    };

    for (let i = 0; i < selected.length; i += 1) {
      for (let j = i + 1; j < selected.length; j += 1) {
        const a = selected[i];
        const b = selected[j];
        const aMount = partMount(a.part);
        const bMount = partMount(b.part);
        if (aMount && bMount && aMount === bMount) upsert({ a, b, reason: 'MOUNT_POINT' });

        const aCompat = partCompat(a.part);
        const bCompat = partCompat(b.part);
        const aExcl = partExcl(a.part);
        const bExcl = partExcl(b.part);
        const aOther = [...bCompat, ...bExcl];
        const bOther = [...aCompat, ...aExcl];
        if (intersectsAny(aExcl, aOther) || intersectsAny(bExcl, bOther)) upsert({ a, b, reason: 'RULE' });
      }
    }

    for (const [aId, bId] of collisionPairsByPartId) {
      const aType = Object.keys(selectedByType || {}).find((k) => String(selectedByType?.[k] || '') === aId) || '';
      const bType = Object.keys(selectedByType || {}).find((k) => String(selectedByType?.[k] || '') === bId) || '';
      const aPart = partsById.get(aId);
      const bPart = partsById.get(bId);
      if (!aPart || !bPart) continue;
      upsert({ a: { id: aId, type: aType, part: aPart }, b: { id: bId, type: bType, part: bPart }, reason: 'COLLISION' });
    }

    const conflicts = Array.from(byPairKey.values()).map((c) => ({
      a: { id: c.a.id, type: c.a.type, name: String(c.a?.part?.name || '').trim() || c.a.id },
      b: { id: c.b.id, type: c.b.type, name: String(c.b?.part?.name || '').trim() || c.b.id },
      reasons: Array.from(c.reasons).filter(Boolean)
    }));

    const conflictPartIds = new Set();
    const conflictTypes = new Set();
    for (const c of conflicts) {
      conflictPartIds.add(c.a.id);
      conflictPartIds.add(c.b.id);
      if (c.a.type) conflictTypes.add(c.a.type);
      if (c.b.type) conflictTypes.add(c.b.type);
    }

    const alternativesByType = {};
    const allParts = Array.isArray(parts) ? parts : [];
    const selectedById = new Map(selected.map((x) => [x.id, x]));
    for (const type of conflictTypes) {
      const currentId = String(selectedByType?.[type] || '').trim();
      const current = selectedById.get(currentId);
      if (!current?.part) continue;

      const others = selected.filter((x) => x.type !== type);
      const desiredMount = partMount(current.part);
      const desiredCompat = partCompat(current.part);

      const candidates = allParts
        .filter((p) => String(p?.type || '').trim() === type)
        .filter((p) => String(p?._id || '') !== currentId)
        .filter((p) => {
          const m = partMount(p);
          if (desiredMount && m && m !== desiredMount) return false;
          const c = partCompat(p);
          if (desiredCompat.length && c.length && !intersectsAny(c, desiredCompat)) return false;
          const excl = partExcl(p);
          const compat = partCompat(p);
          for (const o of others) {
            const oCompat = partCompat(o.part);
            const oExcl = partExcl(o.part);
            const otherAll = [...oCompat, ...oExcl];
            if (m && partMount(o.part) && m === partMount(o.part)) return false;
            if (intersectsAny(excl, otherAll)) return false;
            if (intersectsAny(oExcl, [...compat, ...excl])) return false;
          }
          return true;
        })
        .map((p) => {
          const price = Number(p?.price) || 0;
          const c = partCompat(p);
          const score = desiredCompat.length ? c.filter((x) => desiredCompat.includes(x)).length : 0;
          return { p, score, price };
        })
        .sort((a, b) => (b.score - a.score) || (a.price - b.price))
        .slice(0, 3)
        .map((x) => x.p);

      if (candidates.length) alternativesByType[type] = candidates;
    }

    return { conflicts, conflictPartIds, conflictTypes, alternativesByType };
  }, [collisionPairsByPartId, isEmbeddedSelection, parts, partsById, selectedByType]);

  const comboSlotsOrder = useMemo(() => {
    const raw = bike?.combinedModelSlots;
    const base =
      Array.isArray(raw) && raw.length
        ? raw.map((x) => String(x || '').trim()).filter(Boolean)
        : ['exhaust', 'topbox'];

    const selectedTypes = selectedByType && typeof selectedByType === 'object' ? Object.keys(selectedByType) : [];
    const extras = [];
    for (const t of selectedTypes) {
      const key = String(t || '').trim();
      if (!key) continue;
      if (key !== 'exhaust' && key !== 'topbox' && key !== 'handlebar') continue;
      if (!base.includes(key) && !extras.includes(key)) extras.push(key);
    }

    return [...base, ...extras];
  }, [bike?.combinedModelSlots, selectedByType]);

  const comboConfig = useMemo(() => {
    const cfg = {};
    for (const type of comboSlotsOrder) {
      const selectedId = String(selectedByType?.[type] || '');
      if (!selectedId) {
        cfg[type] = 'stock';
        continue;
      }
      if (isEmbeddedSelection(selectedId)) {
        cfg[type] = normalizeVariantKey(embeddedNameFromSelection(selectedId)) || 'stock';
        continue;
      }
      const p = partsById.get(selectedId);
      cfg[type] = normalizeVariantKey(p?.variantKey || p?.name || '') || 'stock';
    }
    return cfg;
  }, [comboSlotsOrder, embeddedNameFromSelection, isEmbeddedSelection, partsById, selectedByType]);

  const combinedModelSelection = useMemo(() => {
    const order = Array.isArray(comboSlotsOrder) ? comboSlotsOrder : [];
    const modelMap = bike?.combinedModels && typeof bike.combinedModels === 'object' ? bike.combinedModels : {};
    if (!modelMap || !Object.keys(modelMap).length) return { url: '', key: '', covered: [] };

    const forced = String(forcedCombinedModelKey || '').trim();
    if (forced && modelMap[forced]) {
      const url = String(modelMap[forced] || '').trim();
      const covered = order.length ? order : Object.keys(selectedByType || {}).map((k) => String(k || '')).filter(Boolean);
      return url ? { url, key: forced, covered } : { url: '', key: '', covered: [] };
    }
    if (!order.length) return { url: '', key: '', covered: [] };

    const key = resolveBestComboKey({ slotsOrder: order, modelMap, config: comboConfig });
    const url = key ? String(modelMap[key] || '').trim() : '';
    if (!url) return { url: '', key: '', covered: [] };

    const tokens = String(key || '').split('_');
    const coveredByKey = order.filter((slot, idx) => String(tokens[idx] || 'stock') !== 'stock');
    if (tokens.length < order.length) {
      const nonStock = order.filter((slot) => (normalizeVariantKey(comboConfig?.[slot] || 'stock') || 'stock') !== 'stock');
      if (nonStock.length === 1) return { url, key, covered: nonStock };
    }
    const covered = coveredByKey;
    return { url, key, covered };
  }, [bike, comboConfig, comboSlotsOrder, forcedCombinedModelKey, selectedByType]);

  const combinedModelUrl = combinedModelSelection.url;
  const combinedModelCovered = combinedModelSelection.covered;
  const effectiveCarModelUrl = combinedModelUrl || bike?.model3d || bike?.modelUrl || '';

  const viewerSlots = useMemo(() => {
    const slots = [];
    for (const [type, id] of Object.entries(selectedByType || {})) {
      if (combinedModelUrl && combinedModelCovered.includes(String(type || ''))) continue;
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
  }, [combinedModelCovered, combinedModelUrl, partsById, selectedByType, targetSizeByType]);

  const embeddedConfig = useMemo(() => {
    const cfg = {};
    for (const [type, v] of Object.entries(selectedByType || {})) {
      const sel = String(v || '');
      if (!sel || !isEmbeddedSelection(sel)) continue;
      const name = embeddedNameFromSelection(sel);
      if (!name) continue;
      cfg[String(type || '')] = name;
    }
    return cfg;
  }, [embeddedNameFromSelection, isEmbeddedSelection, selectedByType]);

  const baseSpecs = useMemo(() => {
    const s = bike?.specs && typeof bike.specs === 'object' ? bike.specs : {};
    const toNumOrNull = (v) => {
      if (v === null || v === undefined || v === '') return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    return {
      powerHp: toNumOrNull(s.powerHp),
      torqueNm: toNumOrNull(s.torqueNm),
      weightKg: toNumOrNull(s.weightKg),
      topSpeedKph: toNumOrNull(s.topSpeedKph),
      fuelL: toNumOrNull(s.fuelL)
    };
  }, [bike]);

  const bonusSpecs = useMemo(() => {
    const toNumOr0 = (v) => {
      if (v === null || v === undefined || v === '') return 0;
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };
    const totals = { powerHp: 0, torqueNm: 0, weightKg: 0, topSpeedKph: 0, fuelL: 0 };
    const seen = new Set();
    for (const [, raw] of Object.entries(selectedByType || {})) {
      const id = String(raw || '').trim();
      if (!id || seen.has(id)) continue;
      if (isEmbeddedSelection(id) || !isObjectId(id)) continue;
      seen.add(id);
      const p = partsById.get(id);
      if (!p) continue;
      const s = p?.specs && typeof p.specs === 'object' ? p.specs : {};
      totals.powerHp += toNumOr0(s.powerHp);
      totals.torqueNm += toNumOr0(s.torqueNm);
      totals.weightKg += toNumOr0(s.weightKg);
      totals.topSpeedKph += toNumOr0(s.topSpeedKph);
      totals.fuelL += toNumOr0(s.fuelL);
    }
    return totals;
  }, [partsById, selectedByType]);

  if (loading)
    return (
      <div className="min-h-screen bg-[#05070c] px-6 py-10">
        <div className="mx-auto w-full max-w-[720px]">
          <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/5 p-6 text-white shadow-2xl backdrop-blur-xl">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_260px_at_50%_0%,rgba(56,189,248,0.14),transparent_62%)]" />
            <div className="relative flex items-center gap-3">
              <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-cyan-300" />
              <div className="text-sm font-semibold text-white/85">{t('common_loading')}</div>
            </div>
          </div>
        </div>
      </div>
    );
  if (error) {
    return (
      <div className="min-h-screen bg-[#05070c] px-6 py-10">
        <div className="mx-auto w-full max-w-[720px]">
          <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/5 p-6 text-white shadow-2xl backdrop-blur-xl">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_260px_at_50%_0%,rgba(239,68,68,0.14),transparent_62%)]" />
            <div className="relative text-sm font-semibold text-red-200">
              {t('common_error')}: {error}
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (!bike) {
    return (
      <div className="min-h-screen bg-[#05070c] px-6 py-10">
        <div className="mx-auto w-full max-w-[720px]">
          <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/5 p-6 text-white shadow-2xl backdrop-blur-xl">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_260px_at_50%_0%,rgba(56,189,248,0.14),transparent_62%)]" />
            <div className="relative">
              <div className="text-sm font-semibold text-white/85">{t('cfg_bike_not_found')}</div>
              <div className="mt-4">
                <Link
                  to="/bikes"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-4 py-2 text-sm font-semibold text-white/90 backdrop-blur transition hover:bg-black/40"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                  {t('bike_details_back')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const selectType = (type) => {
    const g = groups.find((x) => x.types.includes(type));
    if (g) setActiveGroup(g.key);
    setActiveType(type);
    setHasPickedType(true);
    setSidebarOpen(false);
    setOptionsOpen(true);
  };

  const pickPart = (type, id) => {
    setForcedCombinedModelKey('');
    const key = String(type || '');
    const partId = String(id || '');
    const current = String(selectedByType?.[key] || '');
    const nextId = current && current === partId ? '' : partId;
    setSelectedByType((prev) => {
      const next = { ...(prev || {}) };
      if (!nextId) delete next[key];
      else next[key] = nextId;
      return next;
    });

    if (isAuthed && activeConfigId) {
      updateConfigurationPart({ token, configId: activeConfigId, slot: key, partId: nextId || null }).catch(() => {});
    }

    const p = nextId
      ? isEmbeddedSelection(nextId)
        ? { name: embeddedNameFromSelection(nextId) }
        : partsById.get(nextId)
      : null;
    if (p?.name) showToast(`${t('cfg_toast_applied_prefix')} ${partLabel(key)} ${p.name}`);
    else if (!nextId) showToast(`${t('cfg_toast_cleared_prefix')} ${partLabel(key)}`);
  };

  const clearType = (type) => {
    setForcedCombinedModelKey('');
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

  const showToast = (message) => {
    const msg = String(message || '').trim();
    if (!msg) return;
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 1800);
  };

  const resetAll = () => {
    setSelectedByType({});
    setCarColor('#ffffff');
    setHasPickedType(false);
    setForcedCombinedModelKey('');
    setBgPickerOpen(false);
    setComboStyleOpen(false);
    setComboStyleKey('');
    setComboStyleSelectedKey('');
    setComboPreviewOpen(false);
    setComboPreviewKey('');
    setSidebarOpen(false);
    setOptionsOpen(false);
    showToast(t('cfg_toast_reset'));
    if (isAuthed && activeConfigId) {
      for (const type of Object.keys(selectedByType || {})) {
        updateConfigurationPart({ token, configId: activeConfigId, slot: type, partId: null }).catch(() => {});
      }
      updateConfigurationPaint({ token, configId: activeConfigId, selectedColor: '#ffffff' }).catch(() => {});
    }
  };

  const openSavePrompt = () => {
    if (savingBuild || sharingBuild) return;
    if (!isAuthed) {
      showToast(t('cfg_login_required'));
      return;
    }
    if (!bikeId) {
      showToast(t('cfg_save_failed'));
      return;
    }
    setSavePromptName('');
    setSavePromptShare(false);
    setSavePromptOpen(true);
  };

  const confirmSaveBuild = async () => {
    if (savingBuild) return;
    if (!isAuthed) {
      showToast(t('cfg_login_required'));
      return;
    }
    if (!bikeId) {
      showToast(t('cfg_save_failed'));
      return;
    }
    const buildName = String(savePromptName || '').trim();
    if (!buildName) {
      showToast('Vui lòng nhập tên bản độ.');
      return;
    }

    const wheelsIdRaw = selectedByType?.wheels;
    const selectedWheels = !isEmbeddedSelection(wheelsIdRaw) && isObjectId(wheelsIdRaw) ? String(wheelsIdRaw) : null;
    const selectedParts = Object.entries(selectedByType || {})
      .filter(([k]) => String(k) !== 'wheels')
      .map(([, v]) => String(v || ''))
      .filter((id) => id && !isEmbeddedSelection(id) && isObjectId(id));

    setSavingBuild(true);
    try {
      const data = await createConfiguration({
        token,
        carId: bikeId,
        selectedColor: safeCarColor,
        selectedWheels,
        selectedParts,
        name: buildName
      });

      const newId = String(data?.item?._id || data?.item?.id || '');
      if (newId) setActiveConfigId(newId);
      setLastSavedConfigId(newId);

      if (newId) {
        const captureNow = async () => {
          const take = () => viewerRef.current?.capture?.({ type: 'image/jpeg', quality: 0.86 }) || '';
          let img = take();
          if (!img || img.length < 4000) {
            await new Promise((r) => window.requestAnimationFrame(() => window.requestAnimationFrame(r)));
            img = take();
          }
          if (!img || img.length < 4000) {
            await new Promise((r) => window.requestAnimationFrame(r));
            img = take();
          }
          return img;
        };
        const imageData = await captureNow();
        if (imageData) {
          setConfigurationThumbnail({ token, configId: newId, imageData, backgroundKey: viewerBackground, camera: cameraState }).catch(() => {});
        }
      }

      showToast(t('cfg_saved'));
      if (savePromptShare && newId) {
        await doShareBuild({ configId: newId, direct: true, name: buildName });
      } else {
        setSavePromptOpen(false);
      }
    } catch (e) {
      showToast(t('cfg_save_failed'));
    } finally {
      setSavingBuild(false);
    }
  };

  const doShareBuild = async ({ configId, direct, name } = {}) => {
    if (!isAuthed) {
      showToast(t('cfg_login_required'));
      return;
    }
    if (!configId) return;
    if (sharingBuild) return;

    setSharingBuild(true);
    try {
      const imageData = viewerRef.current?.capture?.({ type: 'image/jpeg', quality: 0.86 }) || '';
      await shareBuild({
        token,
        configId,
        name: String(name || '').trim(),
        backgroundKey: viewerBackground,
        camera: cameraState,
        imageData
      });
      showToast(t('cfg_shared'));
      if (direct) showToast(t('cfg_share_redirected'));
      setSharePromptOpen(false);
      setSavePromptOpen(false);
      nav(`/builds/${encodeURIComponent(configId)}?book=1`);
    } catch (e) {
      showToast(t('cfg_share_failed'));
    } finally {
      setSharingBuild(false);
    }
  };

  const shareNow = async () => {
    if (!isAuthed) {
      showToast(t('cfg_login_required'));
      return;
    }
    if (sharingBuild || savingBuild) return;

    let configId = String(activeConfigId || lastSavedConfigId || '');
    if (!configId) {
      if (!bikeId) {
        showToast(t('cfg_share_failed'));
        return;
      }
      const wheelsIdRaw = selectedByType?.wheels;
      const selectedWheels = !isEmbeddedSelection(wheelsIdRaw) && isObjectId(wheelsIdRaw) ? String(wheelsIdRaw) : null;
      const selectedParts = Object.entries(selectedByType || {})
        .filter(([k]) => String(k) !== 'wheels')
        .map(([, v]) => String(v || ''))
        .filter((id) => id && !isEmbeddedSelection(id) && isObjectId(id));

      setSavingBuild(true);
      try {
        const data = await createConfiguration({
          token,
          carId: bikeId,
          selectedColor: safeCarColor,
          selectedWheels,
          selectedParts,
          name: ''
        });
        configId = String(data?.item?._id || data?.item?.id || '');
        if (configId) {
          setActiveConfigId(configId);
          setLastSavedConfigId(configId);
        }
      } catch {
        showToast(t('cfg_save_failed'));
        setSavingBuild(false);
        return;
      } finally {
        setSavingBuild(false);
      }
    }

    await doShareBuild({ configId, direct: true });
  };

  const answerSharePrompt = async (shouldShare) => {
    if (!shouldShare) {
      setSharePromptOpen(false);
      return;
    }
    if (!isAuthed || !lastSavedConfigId) {
      setSharePromptOpen(false);
      return;
    }
    await doShareBuild({ configId: lastSavedConfigId, direct: false });
  };

  const bookPartneredShopNow = () => {
    if (!lastSavedConfigId) {
      setSharePromptOpen(false);
      return;
    }
    setSharePromptOpen(false);
    nav(`/builds/${encodeURIComponent(lastSavedConfigId)}?book=1`);
  };

  const activeSelectedId = String(selectedByType?.[activeType] || '');
  const activeSelectedPart = activeSelectedId
    ? isEmbeddedSelection(activeSelectedId)
      ? { _id: activeSelectedId, type: String(activeType || ''), name: embeddedNameFromSelection(activeSelectedId), price: 0 }
      : partsById.get(activeSelectedId)
    : null;
  const stepNow = !hasPickedType ? 1 : !activeSelectedId ? 2 : 3;
  const subtitleText = `${t('cfg_selected_count_label')} ${selectedItems.length} ${t('cfg_selected_count_unit')}${
    formatPrice(totalPrice) ? ` • ${formatPrice(totalPrice)}` : ''
  }`;

  return (
    <div className="flex min-h-screen flex-col overflow-hidden bg-[#05070c] text-white">
      <Header
        title={displayBikeName || 'Configurator'}
        subtitle={subtitleText}
        step={stepNow}
        onGoHome={() => nav('/')}
        homeLabel={t('common_back_home')}
        onChangeBike={() => nav('/bikes')}
        changeBikeLabel={t('cfg_change_bike')}
        onShareBuild={shareNow}
        shareLabel="Export Build"
        shareDisabled={sharingBuild || savingBuild}
        onSaveBuild={openSavePrompt}
        saveLabel={t('cfg_save_build')}
        saveDisabled={savingBuild}
        onReset={resetAll}
        resetLabel={t('cfg_reset')}
        onOpenBackgroundPicker={() => setBgPickerOpen(true)}
        backgroundLabel={t('cfg_background')}
        onToggleSidebar={() => {
          setOptionsOpen(false);
          setSidebarOpen((v) => !v);
        }}
        onToggleOptions={() => {
          setSidebarOpen(false);
          setOptionsOpen((v) => !v);
        }}
        optionsLabel={t('cfg_btn_parts')}
      />

      <div className="relative flex-1 overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0f1b] via-[#05070c] to-[#02040a]" />
          <div className="absolute inset-0 bg-[radial-gradient(1200px_700px_at_55%_35%,rgba(59,130,246,0.14),transparent_62%)]" />
        </div>

        {toast ? (
          <div className="pointer-events-none absolute inset-x-0 top-5 z-50 flex justify-center px-4">
            <div className="rounded-2xl border border-white/10 bg-black/55 px-4 py-3 text-sm font-semibold text-white shadow-[0_26px_90px_-55px_rgba(0,0,0,0.95)] backdrop-blur-xl">
              {toast}
            </div>
          </div>
        ) : null}

        {mechanicalConflictInfo?.conflicts?.length ? (
          <div className="absolute inset-x-0 top-[74px] z-50 flex justify-center px-4 pointer-events-none">
            <div className="pointer-events-auto w-full max-w-[980px] rounded-2xl border border-rose-400/25 bg-rose-950/25 p-4 text-white shadow-[0_26px_90px_-55px_rgba(0,0,0,0.95)] backdrop-blur-xl">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-black text-rose-100">Mechanical conflicts detected</div>
                  <div className="mt-0.5 text-[11px] text-rose-100/70">
                    Conflicting parts are highlighted in red. Switch to suggested alternatives to resolve.
                  </div>
                </div>
                <div className="shrink-0 rounded-full border border-rose-300/20 bg-black/20 px-3 py-1 text-[11px] font-bold text-rose-100/90">
                  {mechanicalConflictInfo.conflicts.length}
                </div>
              </div>

              <div className="mt-3 space-y-1.5">
                {mechanicalConflictInfo.conflicts.slice(0, 4).map((c) => {
                  const reasonLabel = (r) => {
                    if (r === 'MOUNT_POINT') return 'same mount point';
                    if (r === 'COLLISION') return 'collision';
                    if (r === 'RULE') return 'rule conflict';
                    return String(r || '').toLowerCase();
                  };
                  return (
                    <div key={`${c.a.id}|${c.b.id}`} className="text-[12px] text-rose-50/90">
                      <span className="font-semibold">{partLabel(c.a.type)}</span>
                      {': '}
                      <span className="font-semibold">{c.a.name}</span>
                      <span className="text-rose-100/60"> ↔ </span>
                      <span className="font-semibold">{partLabel(c.b.type)}</span>
                      {': '}
                      <span className="font-semibold">{c.b.name}</span>
                      <span className="text-rose-100/65">{` (${c.reasons.map(reasonLabel).join(', ')})`}</span>
                    </div>
                  );
                })}
              </div>

              {Object.keys(mechanicalConflictInfo.alternativesByType || {}).length ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {Object.entries(mechanicalConflictInfo.alternativesByType).map(([type, alts]) => (
                    <div key={type} className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <div className="text-[11px] font-semibold text-white/80">{`Alternatives for ${partLabel(type)}`}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(Array.isArray(alts) ? alts : []).map((p) => {
                          const id = String(p?._id || '').trim();
                          const label = String(p?.name || '').trim() || id;
                          return (
                            <button
                              key={id}
                              type="button"
                              onClick={() => pickPart(type, id)}
                              className="rounded-full border border-rose-300/20 bg-rose-500/10 px-3 py-1.5 text-[11px] font-semibold text-rose-50 hover:bg-rose-500/16"
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {hover3d?.label ? (
          <div
            className="fixed z-[60] -translate-x-1/2 -translate-y-[120%] rounded-xl border border-white/10 bg-zinc-950/85 px-3 py-2 text-xs font-semibold text-zinc-100 shadow-2xl backdrop-blur"
            style={{ left: hover3d.x, top: hover3d.y }}
          >
            {hover3d.label}
          </div>
        ) : null}

        <div className="relative z-10 grid h-full grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_420px]">
          <div className="hidden lg:block">
            <Sidebar
              groups={groups}
              partLabel={partLabel}
              activeType={activeType}
              onSelectType={selectType}
              conflictTypes={mechanicalConflictInfo.conflictTypes}
              titleLabel={t('cfg_categories')}
              activeHintLabel={t('cfg_active')}
              selectHintLabel={t('landing_select')}
              combos={combos}
              comboTitle={t('cfg_combo_title')}
              comboHint={t('cfg_combo_hint')}
              comboApplyLabel={t('cfg_combo_apply')}
              comboPreviewLabel={t('cfg_combo_apply')}
              onApplyCombo={applyCombo}
            />
          </div>

          <div className="relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_520px_at_50%_35%,rgba(56,189,248,0.16),transparent_62%)]" />
            <Viewer
              ref={viewerRef}
              carModelUrl={effectiveCarModelUrl}
              color={safeCarColor}
              anchorPreset={bike?.anchors}
              highlightType={hasPickedType ? activeType : ''}
              onHoverPart={(info) => setHover3d(info)}
              onCarMeta={(meta) => {
                const embedded = meta?.embeddedVariants && typeof meta.embeddedVariants === 'object' ? meta.embeddedVariants : {};
                setEmbeddedVariantsByType(embedded);
              }}
              onCamera={(cam) => setCameraState(cam)}
              onMechanicalCollisions={(pairs) => setMechanicalCollisions(pairs)}
              slots={viewerSlots}
              embeddedConfig={embeddedConfig}
              background={viewerBackground}
              backgroundPreset={activeBackgroundPreset}
              dragHint={t('cfg_drag_hint')}
              viewerMode={viewerMode}
            />
          </div>

          <div className="hidden lg:block">
            <OptionsPanel
              title={partLabel(activeType)}
              subtitle={activeSelectedPart?.name ? activeSelectedPart.name : t('cfg_choose_accessory')}
              items={partsForActiveType}
              selectedId={activeSelectedId}
              motorcycleName={bike?.name || bike?.title || ''}
              activeType={activeType}
              resolveAssetUrl={resolveAssetUrl}
              formatPrice={formatPrice}
              onSelect={(id) => pickPart(activeType, id)}
              conflictPartIds={mechanicalConflictInfo.conflictPartIds}
              alternatives={mechanicalConflictInfo.alternativesByType?.[activeType] || []}
              carColor={carColor}
              onCarColorChange={(value) => {
                const next = String(value || '').trim();
                setCarColor(next);
                if (isHexColor(next)) persistPaint({ selectedColor: next });
              }}
              onResetCarColor={() => {
                setCarColor('#ffffff');
                persistPaint({ selectedColor: '#ffffff' });
              }}
              baseSpecs={baseSpecs}
              bonusSpecs={bonusSpecs}
              onClear={() => clearType(activeType)}
              readOnly={readOnly}
              clearLabel={t('cfg_clear')}
              selectedBadgeLabel={t('cfg_selected_badge')}
              selectLabel={t('landing_select')}
            />
          </div>
        </div>

        {sidebarOpen ? (
          <div className="lg:hidden fixed inset-0 z-50">
            <button
              type="button"
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              aria-label="Close"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 w-[86vw] max-w-[360px] overflow-hidden bg-[#05070c] shadow-2xl">
              <Sidebar
                groups={groups}
                partLabel={partLabel}
                activeType={activeType}
                onSelectType={selectType}
                conflictTypes={mechanicalConflictInfo.conflictTypes}
                titleLabel={t('cfg_categories')}
                activeHintLabel={t('cfg_active')}
                selectHintLabel={t('landing_select')}
                combos={combos}
                comboTitle={t('cfg_combo_title')}
                comboHint={t('cfg_combo_hint')}
                comboApplyLabel={t('cfg_combo_apply')}
                comboPreviewLabel={t('cfg_combo_apply')}
                onApplyCombo={applyCombo}
              />
            </div>
          </div>
        ) : null}

        {optionsOpen ? (
          <div className="lg:hidden fixed inset-0 z-50">
            <button
              type="button"
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              aria-label="Close"
              onClick={() => setOptionsOpen(false)}
            />
            <div className="absolute inset-y-0 right-0 w-[92vw] max-w-[420px] overflow-hidden bg-[#05070c] shadow-2xl">
              <OptionsPanel
                title={partLabel(activeType)}
                subtitle={activeSelectedPart?.name ? activeSelectedPart.name : t('cfg_choose_accessory')}
                items={partsForActiveType}
                selectedId={activeSelectedId}
                motorcycleName={bike?.name || bike?.title || ''}
                activeType={activeType}
                resolveAssetUrl={resolveAssetUrl}
                formatPrice={formatPrice}
                onSelect={(id) => pickPart(activeType, id)}
                conflictPartIds={mechanicalConflictInfo.conflictPartIds}
                alternatives={mechanicalConflictInfo.alternativesByType?.[activeType] || []}
                carColor={carColor}
                onCarColorChange={(value) => {
                  const next = String(value || '').trim();
                  setCarColor(next);
                  if (isHexColor(next)) persistPaint({ selectedColor: next });
                }}
                onResetCarColor={() => {
                  setCarColor('#ffffff');
                  persistPaint({ selectedColor: '#ffffff' });
                }}
                baseSpecs={baseSpecs}
                bonusSpecs={bonusSpecs}
                onClear={() => clearType(activeType)}
                readOnly={readOnly}
                clearLabel={t('cfg_clear')}
                selectedBadgeLabel={t('cfg_selected_badge')}
                selectLabel={t('landing_select')}
                emptyLabel={t('cfg_no_parts')}
              />
            </div>
          </div>
        ) : null}

        {comboPreviewOpen ? (
          <div className="fixed inset-0 z-[62]">
            <button
              type="button"
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              aria-label={t('cfg_close')}
              onClick={() => {
                setComboPreviewOpen(false);
                setComboPreviewKey('');
              }}
            />
            <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-[980px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-white/10 bg-[#05070c]/95 shadow-2xl">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white/90">{comboPreview?.title || t('cfg_combo_title')}</div>
                  <div className="mt-0.5 truncate text-[11px] text-white/50">{t('cfg_combo_hint')}</div>
                </div>
                <button
                  type="button"
                  className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-black/20 text-white/90 transition hover:bg-black/35"
                  aria-label={t('cfg_close')}
                  onClick={() => {
                    setComboPreviewOpen(false);
                    setComboPreviewKey('');
                  }}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              <div className="p-5">
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/10">
                  <div className="relative aspect-[16/10] overflow-hidden">
                    <Viewer
                      carModelUrl={comboPreviewEffectiveCarModelUrl}
                      color={safeCarColor}
                      anchorPreset={bike?.anchors}
                      highlightType=""
                      onHoverPart={() => {}}
                      onCarMeta={() => {}}
                      onCamera={() => {}}
                      slots={comboPreviewViewerSlots}
                      embeddedConfig={comboPreviewEmbeddedConfig}
                      background={viewerBackground}
                      backgroundPreset={activeBackgroundPreset}
                      dragHint={t('cfg_drag_hint')}
                      viewerMode={viewerMode}
                    />
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const key = String(comboPreviewKey || '').trim();
                      setComboPreviewOpen(false);
                      setComboPreviewKey('');
                      applyCombo(key);
                    }}
                    disabled={!comboPreviewKey}
                    className="flex-1 rounded-2xl bg-sky-500 px-4 py-3 text-[12px] font-black text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {t('cfg_combo_apply')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setComboPreviewOpen(false);
                      setComboPreviewKey('');
                    }}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-[12px] font-bold text-white/85 transition hover:bg-white/10"
                  >
                    {t('cfg_close')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {comboStyleOpen ? (
          <div className="fixed inset-0 z-[65]">
            <button
              type="button"
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              aria-label={t('cfg_close')}
              onClick={() => {
                setComboStyleOpen(false);
                setComboStyleKey('');
                setComboStyleSelectedKey('');
              }}
            />
            <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-[980px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-white/10 bg-[#05070c]/95 shadow-2xl">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white/90">{t('cfg_style_title')}</div>
                  <div className="mt-0.5 truncate text-[11px] text-white/50">{t('cfg_style_hint')}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-semibold text-white/80 hover:bg-white/10"
                    onClick={() => {
                      setComboStyleOpen(false);
                      setComboStyleKey('');
                      setComboStyleSelectedKey('');
                    }}
                  >
                    {t('cfg_style_skip')}
                  </button>
                  <button
                    type="button"
                    className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-black/20 text-white/90 transition hover:bg-black/35"
                    aria-label={t('cfg_close')}
                    onClick={() => {
                      setComboStyleOpen(false);
                      setComboStyleKey('');
                      setComboStyleSelectedKey('');
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-5">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
                  <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/10">
                    <div className="relative aspect-[16/10] overflow-hidden">
                      <Viewer
                        carModelUrl={effectiveCarModelUrl}
                        color={isHexColor(selectedComboStyle?.color) ? String(selectedComboStyle?.color).trim() : safeCarColor}
                        anchorPreset={bike?.anchors}
                        highlightType=""
                        onHoverPart={() => {}}
                        onCarMeta={() => {}}
                        onCamera={() => {}}
                        slots={viewerSlots}
                        embeddedConfig={embeddedConfig}
                        background={String(selectedComboStyle?.backgroundKey || viewerBackground || '').trim() || viewerBackground}
                        backgroundPreset={selectedComboStyleBackgroundPreset || activeBackgroundPreset}
                        dragHint={t('cfg_drag_hint')}
                        viewerMode={viewerMode}
                      />
                    </div>
                    <div className="border-t border-white/10 px-4 py-3">
                      <div className="truncate text-[13px] font-semibold text-white/90">{selectedComboStyle?.title || '-'}</div>
                      {selectedComboStyle?.desc ? <div className="mt-1 truncate text-[11px] text-white/55">{selectedComboStyle.desc}</div> : null}
                    </div>
                  </div>

                  <div className="flex flex-col">
                    <div className="space-y-2">
                      {comboStyles.slice(0, 6).map((s) => {
                        const key = String(s?.key || '').trim();
                        const isActive = key && String(comboStyleSelectedKey || '').trim() === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setComboStyleSelectedKey(key)}
                            className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                              isActive ? 'border-sky-300/60 bg-white/10' : 'border-white/10 bg-black/10 hover:border-sky-300/25 hover:bg-black/18'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="truncate text-[13px] font-semibold text-white/90">{s?.title || '-'}</div>
                              {s?.desc ? <div className="mt-0.5 truncate text-[11px] text-white/55">{s.desc}</div> : null}
                            </div>
                            <span className="h-7 w-7 shrink-0 rounded-full border border-white/15" style={{ background: String(s?.color || '#ffffff') }} />
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-4 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => applyComboStyle(comboStyleSelectedKey)}
                        disabled={!selectedComboStyle}
                        className="flex-1 rounded-2xl bg-sky-500 px-4 py-3 text-[12px] font-black text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {t('cfg_style_apply')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setComboStyleOpen(false);
                          setComboStyleKey('');
                          setComboStyleSelectedKey('');
                        }}
                        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-[12px] font-bold text-white/85 transition hover:bg-white/10"
                      >
                        {t('cfg_style_skip')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {bgPickerOpen ? (
          <div className="fixed inset-0 z-[70]">
            <button
              type="button"
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              aria-label={t('cfg_close')}
              onClick={() => setBgPickerOpen(false)}
            />
            <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-[720px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-white/10 bg-[#05070c]/95 shadow-2xl">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white/90">{t('cfg_background')}</div>
                  <div className="mt-0.5 truncate text-[11px] text-white/50">{t('cfg_color_and_bg')}</div>
                </div>
                <button
                  type="button"
                  className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-black/20 text-white/90 transition hover:bg-black/35"
                  aria-label={t('cfg_close')}
                  onClick={() => setBgPickerOpen(false)}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              <div className="max-h-[70vh] overflow-y-auto p-5">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {backgroundPresets.map((p) => {
                    const key = String(p?.key || '');
                    const isActive = key && String(viewerBackground || '') === key;
                    const kind = String(p?.kind || '');
                    const css = String(p?.css || '').trim();
                    const color = String(p?.color || '').trim();
                    const imageUrl = kind === 'image' ? resolveAssetUrl(p?.imageUrl || '') : '';
                    const previewStyle =
                      kind === 'image' && imageUrl
                        ? {
                            backgroundColor: '#0b0b0b',
                            backgroundImage: `url('${imageUrl}')`,
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'center',
                            backgroundSize: 'cover'
                          }
                        : kind === 'gradient' && css
                          ? { background: css }
                          : kind === 'color' && color
                            ? { background: color }
                            : { background: '#1a1a1a' };

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setViewerBackground(key);
                          setBgPickerOpen(false);
                        }}
                        className={`group overflow-hidden rounded-2xl border text-left transition ${
                          isActive ? 'border-sky-300/60 bg-white/10' : 'border-white/10 bg-black/10 hover:border-sky-300/25 hover:bg-black/18'
                        }`}
                      >
                        <div className="h-20 w-full" style={previewStyle} />
                        <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                          <div className="truncate text-[12px] font-semibold text-white/90">{p?.label || key}</div>
                          {isActive ? (
                            <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[10px] font-black text-white">
                              {t('cfg_active')}
                            </span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {savePromptOpen ? (
          <div className="fixed inset-0 z-[80]">
            <button
              type="button"
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              aria-label={t('cfg_close')}
              onClick={() => setSavePromptOpen(false)}
              disabled={savingBuild || sharingBuild}
            />
            <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-[520px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-white/10 bg-[#05070c]/95 shadow-2xl">
              <div className="border-b border-white/10 px-5 py-4">
                <div className="text-sm font-semibold text-white/90">Lưu bản độ</div>
                <div className="mt-1 text-xs text-white/55">Nhập tên bản độ và chọn có muốn chia sẻ hay không.</div>
              </div>
              <form
                className="space-y-4 p-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  confirmSaveBuild();
                }}
              >
                <label className="block space-y-2">
                  <div className="text-[11px] font-semibold tracking-[0.18em] text-white/55">TÊN BẢN ĐỘ</div>
                  <input
                    value={savePromptName}
                    onChange={(e) => setSavePromptName(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none focus:border-sky-400/60 focus:ring-4 focus:ring-sky-400/15"
                    placeholder="Ví dụ: XSR 155 Street"
                    autoFocus
                    disabled={savingBuild || sharingBuild}
                  />
                </label>

                <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={savePromptShare}
                    onChange={(e) => setSavePromptShare(e.target.checked)}
                    disabled={savingBuild || sharingBuild}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white/90">Chia sẻ bản độ</div>
                    <div className="mt-0.5 text-[11px] text-white/55">Bật để đưa bản độ lên cộng đồng.</div>
                  </div>
                </label>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-sm font-semibold text-white/90 transition hover:bg-black/35 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => setSavePromptOpen(false)}
                    disabled={savingBuild || sharingBuild}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-xl border border-sky-300/25 bg-sky-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={savingBuild || sharingBuild}
                  >
                    {savingBuild || sharingBuild ? t('cfg_processing') : 'Lưu'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {sharePromptOpen ? (
          <div className="fixed inset-0 z-[80]">
            <button
              type="button"
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              aria-label={t('cfg_close')}
              onClick={() => setSharePromptOpen(false)}
              disabled={sharingBuild}
            />
            <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-[520px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-white/10 bg-[#05070c]/95 shadow-2xl">
              <div className="border-b border-white/10 px-5 py-4">
                <div className="text-sm font-semibold text-white/90">{t('cfg_share_title')}</div>
                <div className="mt-1 text-xs text-white/55">{t('cfg_share_desc')}</div>
              </div>
              <div className="flex items-center justify-end gap-2 p-5">
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-sm font-semibold text-white/90 transition hover:bg-black/35 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => answerSharePrompt(false)}
                  disabled={sharingBuild}
                >
                  {t('cfg_share_no')}
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-xl border border-emerald-400/25 bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={bookPartneredShopNow}
                  disabled={sharingBuild || !lastSavedConfigId}
                >
                  {t('cfg_book_partnered_shop')}
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-xl border border-sky-300/25 bg-sky-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => answerSharePrompt(true)}
                  disabled={sharingBuild}
                >
                  {sharingBuild ? t('cfg_processing') : t('cfg_share_yes')}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default Configurator;
