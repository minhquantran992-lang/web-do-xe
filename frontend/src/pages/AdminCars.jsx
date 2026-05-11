import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../services/auth/AuthContext.jsx';
import { useI18n } from '../services/i18n.jsx';
import {
  createAdminCar,
  createAdminBrand,
  createAdminPart,
  createAdminBackground,
  deleteAdminCar,
  updateAdminCar,
  updateAdminPart,
  deleteAdminBrand,
  deleteAdminBackground,
  deleteAdminPart,
  getAdminBrands,
  getAdminBackgrounds,
  getAdminCars,
  getAdminParts,
  uploadAdminCarModel,
  uploadAdminCarCombinedModel,
  deleteAdminCarCombinedModel,
  uploadAdminBackgroundImage,
  uploadAdminBrandLogo,
  updateAdminBrand,
  updateAdminBackground,
  importAdminBrandLogoFromUrl,
  getAdminUsers,
  updateAdminUser,
  deleteAdminUser
} from '../services/api/adminCars.js';
import {
  getAdminLandingHeroImages,
  getAdminDashboardHeroImages,
  setAdminLandingHeroImages,
  setAdminDashboardHeroImages,
  uploadAdminHeroImage
} from '../services/api/settings.js';
import { getApiBaseUrl } from '../services/api/client.js';
import { makeComboKey, normalizeVariantKey } from '../services/combinedModels.js';
import AnchorEditorCanvas from '../editor/anchors/AnchorEditorCanvas.jsx';
import AnchorEditorPanel from '../editor/anchors/AnchorEditorPanel.jsx';
import { parseAnchorsFromDb, serializeAnchorsForDb } from '../editor/anchors/anchorUtils.js';

const toDigitsOnly = (value) => String(value || '').replace(/[^\d]/g, '');
const formatVnd = (value) => {
  const digits = toDigitsOnly(value);
  if (!digits) return '';
  const n = Number(digits);
  if (!Number.isFinite(n)) return '';
  return `${new Intl.NumberFormat('vi-VN').format(n)} ₫`;
};

const normalizeComboKey = (raw) =>
  String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const AdminCars = () => {
  const { token, isAuthed } = useAuth();
  const { t } = useI18n();

  const [cars, setCars] = useState([]);
  const [selectedCars, setSelectedCars] = useState({});
  const [parts, setParts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [selectedBrands, setSelectedBrands] = useState({});
  const [backgrounds, setBackgrounds] = useState([]);
  const [selectedBackgrounds, setSelectedBackgrounds] = useState({});
  const [heroLandingImages, setHeroLandingImages] = useState([]);
  const [heroDashboardImages, setHeroDashboardImages] = useState([]);
  const [heroScope, setHeroScope] = useState('landing');
  const [heroBusy, setHeroBusy] = useState(false);
  const [heroError, setHeroError] = useState('');
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userBusyId, setUserBusyId] = useState('');
  const [userEditOpen, setUserEditOpen] = useState(false);
  const [userEditId, setUserEditId] = useState('');
  const [userEditError, setUserEditError] = useState('');
  const [userEditRole, setUserEditRole] = useState('USER');
  const [userEditVerified, setUserEditVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [activeSection, setActiveSection] = useState('cars');
  const [showBrandForm, setShowBrandForm] = useState(false);
  const [showCarForm, setShowCarForm] = useState(true);
  const [showPartForm, setShowPartForm] = useState(true);
  const [showBgForm, setShowBgForm] = useState(false);
  const [carForm, setCarForm] = useState({ name: '', brand: '', category: '', engineCc: '', image: '', model3d: '', co: '', hc: '', euroStandard: '' });
  const [carCreateError, setCarCreateError] = useState('');
  const [carUploading, setCarUploading] = useState(false);
  const [carUploadError, setCarUploadError] = useState('');
  const [carEditOpen, setCarEditOpen] = useState(false);
  const [carEditId, setCarEditId] = useState('');
  const [carEditError, setCarEditError] = useState('');
  const [carEditForm, setCarEditForm] = useState({
    name: '',
    brand: '',
    category: '',
    engineCc: '',
    image: '',
    model3d: '',
    combinedModelSlots: '',
    combinedModelsJson: '',
    powerHp: '',
    torqueNm: '',
    weightKg: '',
    topSpeedKph: '',
    fuelL: '',
    engineType: '',
    gearbox: '',
    co: '',
    hc: '',
    euroStandard: ''
  });
  const [anchorEditOpen, setAnchorEditOpen] = useState(false);
  const [anchorEditCarId, setAnchorEditCarId] = useState('');
  const [anchorEditModelUrl, setAnchorEditModelUrl] = useState('');
  const [anchorEditAnchors, setAnchorEditAnchors] = useState([]);
  const [anchorEditSelectedId, setAnchorEditSelectedId] = useState('');
  const [anchorEditAddMode, setAnchorEditAddMode] = useState(false);
  const [anchorEditTransformMode, setAnchorEditTransformMode] = useState('translate');
  const [anchorEditShowAnchors, setAnchorEditShowAnchors] = useState(true);
  const [anchorEditSnapEnabled, setAnchorEditSnapEnabled] = useState(false);
  const [anchorEditSnapPosStep, setAnchorEditSnapPosStep] = useState('0.01');
  const [anchorEditSnapRotDeg, setAnchorEditSnapRotDeg] = useState('5');
  const [anchorEditBusy, setAnchorEditBusy] = useState(false);
  const [anchorEditError, setAnchorEditError] = useState('');
  const [comboUploadValues, setComboUploadValues] = useState({});
  const [comboUploadKey, setComboUploadKey] = useState('');
  const [comboUploadFiles, setComboUploadFiles] = useState([]);
  const [comboUploadBusy, setComboUploadBusy] = useState(false);
  const [comboUploadError, setComboUploadError] = useState('');
  const [carCombosDraft, setCarCombosDraft] = useState([]);

  const [partForm, setPartForm] = useState({ 
    name: '', 
    type: 'wheels', 
    variantKey: '',
    thumbnailUrl: '', 
    price: '',
    powerHp: '',
    torqueNm: '',
    weightKg: '',
    topSpeedKph: '',
    coMultiplier: '',
    hcMultiplier: '',
    hasCatalytic: true
  });
  const [partCreateError, setPartCreateError] = useState('');

  const [partEditOpen, setPartEditOpen] = useState(false);
  const [partEditId, setPartEditId] = useState('');
  const [partEditError, setPartEditError] = useState('');
  const [partEditForm, setPartEditForm] = useState({
    name: '',
    type: 'wheels',
    variantKey: '',
    thumbnailUrl: '',
    price: '',
    powerHp: '',
    torqueNm: '',
    weightKg: '',
    topSpeedKph: '',
    coMultiplier: '',
    hcMultiplier: '',
    hasCatalytic: true
  });

  const allowedPartSpecKeysByType = {
    exhaust: ['powerHp', 'torqueNm', 'weightKg', 'topSpeedKph'],
    clutch: ['torqueNm'],
    wheels: ['weightKg', 'topSpeedKph'],
    brake: ['weightKg'],
    suspension: ['weightKg'],
    tire: ['topSpeedKph', 'weightKg'],
    handlebar: ['weightKg'],
    bodykit: ['weightKg'],
    seat: ['weightKg'],
    lighting: ['weightKg'],
    throttle_housing: ['powerHp', 'torqueNm', 'topSpeedKph'],
    topbox: ['weightKg']
  };

  const getAllowedPartSpecKeys = (type) => allowedPartSpecKeysByType[String(type || '').trim()] || [];

  const toNumOrNullFlexible = (v) => {
    if (v === '' || v === null || v === undefined) return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    const raw = String(v || '').trim();
    if (!raw) return null;
    const match = raw.replace(/\s+/g, '').match(/-?[\d.,]+/);
    if (!match) return null;
    let token = String(match[0] || '');
    if (token.includes('.') && token.includes(',')) {
      const lastDot = token.lastIndexOf('.');
      const lastComma = token.lastIndexOf(',');
      if (lastComma > lastDot) token = token.replace(/\./g, '').replace(',', '.');
      else token = token.replace(/,/g, '');
    } else if (token.includes(',')) {
      const parts = token.split(',');
      if (parts.length === 2 && parts[1].length === 3) token = parts.join('');
      else if (parts.length === 2) token = `${parts[0]}.${parts[1]}`;
      else token = parts.join('');
    } else if (token.includes('.')) {
      const parts = token.split('.');
      if (parts.length > 2) {
        const last = parts[parts.length - 1];
        if (last.length === 3) token = parts.join('');
        else token = `${parts.slice(0, -1).join('')}.${last}`;
      }
    }
    const n = Number(token);
    return Number.isFinite(n) ? n : null;
  };

  const stripDisallowedPartSpecs = (form, nextType) => {
    const allowed = new Set(getAllowedPartSpecKeys(nextType));
    const out = { ...form, type: nextType };
    const keys = ['powerHp', 'torqueNm', 'weightKg', 'topSpeedKph'];
    for (const k of keys) {
      if (!allowed.has(k)) out[k] = '';
    }
    if (String(nextType || '').trim() !== 'exhaust') out.hasCatalytic = true;
    return out;
  };

  const selectedCarIds = useMemo(() => Object.keys(selectedCars).filter((k) => selectedCars[k]), [selectedCars]);
  const selectedBrandIds = useMemo(() => Object.keys(selectedBrands).filter((k) => selectedBrands[k]), [selectedBrands]);
  const selectedBackgroundIds = useMemo(
    () => Object.keys(selectedBackgrounds).filter((k) => selectedBackgrounds[k]),
    [selectedBackgrounds]
  );

  const partsByType = useMemo(() => {
    const map = new Map();
    for (const p of Array.isArray(parts) ? parts : []) {
      const type = String(p?.type || '').trim();
      if (!type) continue;
      if (!map.has(type)) map.set(type, []);
      map.get(type).push(p);
    }
    for (const [k, v] of map.entries()) {
      v.sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')));
      map.set(k, v);
    }
    return map;
  }, [parts]);

  const partTypeOptions = useMemo(
    () => [
      { value: 'exhaust', label: t('part_exhaust') },
      { value: 'clutch', label: t('part_clutch') },
      { value: 'wheels', label: t('part_wheels') },
      { value: 'brake', label: t('part_brake') },
      { value: 'suspension', label: t('part_suspension') },
      { value: 'tire', label: t('part_tire') },
      { value: 'handlebar', label: t('part_handlebar') },
      { value: 'bodykit', label: t('part_bodykit') },
      { value: 'seat', label: t('part_seat') },
      { value: 'lighting', label: t('part_lighting') },
      { value: 'throttle_housing', label: t('part_throttle_housing') },
      { value: 'topbox', label: t('part_topbox') }
    ],
    [t]
  );

  const [brandName, setBrandName] = useState('');
  const [brandVehicleType, setBrandVehicleType] = useState('pkl');
  const [brandError, setBrandError] = useState('');
  const [brandLogoUrl, setBrandLogoUrl] = useState('');
  const [brandLogoUploading, setBrandLogoUploading] = useState(false);
  const [brandLogoUploadError, setBrandLogoUploadError] = useState('');
  const [brandEditOpen, setBrandEditOpen] = useState(false);
  const [brandEditId, setBrandEditId] = useState('');
  const [brandEditError, setBrandEditError] = useState('');
  const [brandEditForm, setBrandEditForm] = useState({ name: '', vehicleType: 'pkl', logo: '' });
  const [brandEditLogoUploading, setBrandEditLogoUploading] = useState(false);
  const [brandEditLogoUploadError, setBrandEditLogoUploadError] = useState('');

  const [bgForm, setBgForm] = useState({
    key: '',
    label: '',
    kind: 'image',
    color: '#ffffff',
    css: '',
    imageUrl: '',
    enabled: true,
    sortOrder: ''
  });
  const [bgCreateError, setBgCreateError] = useState('');
  const [bgUploading, setBgUploading] = useState(false);
  const [bgUploadError, setBgUploadError] = useState('');
  const [bgEditOpen, setBgEditOpen] = useState(false);
  const [bgEditId, setBgEditId] = useState('');
  const [bgEditError, setBgEditError] = useState('');
  const [bgEditForm, setBgEditForm] = useState({
    key: '',
    label: '',
    kind: 'image',
    color: '#ffffff',
    css: '',
    imageUrl: '',
    enabled: true,
    sortOrder: ''
  });
  const [bgEditUploading, setBgEditUploading] = useState(false);
  const [bgEditUploadError, setBgEditUploadError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    setForbidden(false);
    try {
      const [carItems, partItems, brandItems, bgItems, userItems, landingHero, dashHero] = await Promise.all([
        getAdminCars({ token }),
        getAdminParts({ token }),
        getAdminBrands({ token }),
        getAdminBackgrounds({ token }),
        getAdminUsers({ token }),
        getAdminLandingHeroImages({ token }),
        getAdminDashboardHeroImages({ token })
      ]);
      setCars(carItems);
      setParts(partItems);
      setBrands(brandItems);
      setBackgrounds(bgItems);
      setUsers(userItems);
      setHeroLandingImages(landingHero);
      setHeroDashboardImages(dashHero);
      setSelectedCars({});
      setSelectedBrands({});
      setSelectedBackgrounds({});
    } catch (e) {
      if (e?.status === 403) {
        setForbidden(true);
      } else {
        setError(e?.message || 'FAILED_TO_LOAD');
      }
    } finally {
      setLoading(false);
    }
  };

  const resolveApiUrl = (url) => {
    const base = getApiBaseUrl();
    const u = String(url || '').trim();
    if (!u) return '';
    if (u.startsWith('data:') || u.startsWith('blob:')) return u;
    if (u.startsWith('http://') || u.startsWith('https://')) return u;
    if (u.startsWith('/')) return `${base}${u}`;
    return `${base}/${u}`;
  };

  const onUploadHero = async (filesLike) => {
    setHeroError('');
    const files = Array.from(filesLike || []).slice(0, 3);
    if (!files.length) return;
    setHeroBusy(true);
    try {
      const uploaded = await Promise.all(files.map((file) => uploadAdminHeroImage({ token, file })));
      const urls = uploaded.map((x) => String(x?.url || '').trim()).filter(Boolean).slice(0, 3);
      if (heroScope === 'dashboard') {
        const next = await setAdminDashboardHeroImages({ token, images: urls });
        setHeroDashboardImages(next);
      } else {
        const next = await setAdminLandingHeroImages({ token, images: urls });
        setHeroLandingImages(next);
      }
    } catch (e) {
      setHeroError(e?.message || 'UPLOAD_FAILED');
    } finally {
      setHeroBusy(false);
    }
  };

  const onResetHero = async () => {
    setHeroError('');
    setHeroBusy(true);
    try {
      if (heroScope === 'dashboard') {
        const next = await setAdminDashboardHeroImages({ token, images: [] });
        setHeroDashboardImages(next);
      } else {
        const next = await setAdminLandingHeroImages({ token, images: [] });
        setHeroLandingImages(next);
      }
    } catch (e) {
      setHeroError(e?.message || 'UPDATE_FAILED');
    } finally {
      setHeroBusy(false);
    }
  };

  const formatDate = (value) => {
    const d = value ? new Date(value) : null;
    if (!d || Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString();
  };

  const filteredUsers = useMemo(() => {
    const q = String(userSearch || '').trim().toLowerCase();
    const role = String(userRoleFilter || '').trim().toUpperCase();
    return users.filter((u) => {
      if (role && String(u.role || '').toUpperCase() !== role) return false;
      if (!q) return true;
      const hay = `${u?.name || ''} ${u?.email || ''} ${u?.phone || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [users, userRoleFilter, userSearch]);

  const onUpdateUser = async (id, patch) => {
    setError('');
    setUserBusyId(String(id));
    try {
      const item = await updateAdminUser({ token, id, payload: patch });
      setUsers((prev) => prev.map((u) => (String(u._id) === String(item._id) ? item : u)));
    } catch (e) {
      setError(e?.message || 'UPDATE_FAILED');
    } finally {
      setUserBusyId('');
    }
  };

  const onDeleteUser = async (id) => {
    if (!confirm(t('admin_delete_user_confirm'))) return;
    setError('');
    setUserBusyId(String(id));
    try {
      await deleteAdminUser({ token, id });
      setUsers((prev) => prev.filter((u) => String(u._id) !== String(id)));
    } catch (e) {
      setError(e?.message || 'DELETE_FAILED');
    } finally {
      setUserBusyId('');
    }
  };

  const openEditUser = (u) => {
    setUserEditError('');
    setUserEditId(String(u?._id || ''));
    setUserEditRole(String(u?.role || 'USER').toUpperCase());
    setUserEditVerified(Boolean(u?.emailVerified));
    setUserEditOpen(true);
  };

  const closeEditUser = () => {
    setUserEditOpen(false);
    setUserEditId('');
    setUserEditError('');
    setUserEditRole('USER');
    setUserEditVerified(false);
  };

  const onSaveUserEdit = async (e) => {
    e.preventDefault();
    if (!userEditId) return;
    setUserEditError('');
    setUserBusyId(String(userEditId));
    try {
      const item = await updateAdminUser({
        token,
        id: userEditId,
        payload: { role: userEditRole, emailVerified: userEditVerified }
      });
      setUsers((prev) => prev.map((u) => (String(u._id) === String(item._id) ? item : u)));
      closeEditUser();
    } catch (e2) {
      setUserEditError(e2?.message || 'UPDATE_FAILED');
    } finally {
      setUserBusyId('');
    }
  };

  useEffect(() => {
    if (!isAuthed) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed, token]);

  const onCreateCar = async (e) => {
    e.preventDefault();
    setCarCreateError('');
    setBusy(true);
    try {
      const toNumOrNull = (v) => {
        if (v === '' || v === null || v === undefined) return null;
        if (typeof v === 'number') return Number.isFinite(v) ? v : null;
        const raw = String(v || '').trim();
        if (!raw) return null;
        const match = raw.replace(/\s+/g, '').match(/-?[\d.,]+/);
        if (!match) return null;
        let token = String(match[0] || '');
        if (token.includes('.') && token.includes(',')) {
          const lastDot = token.lastIndexOf('.');
          const lastComma = token.lastIndexOf(',');
          if (lastComma > lastDot) {
            token = token.replace(/\./g, '').replace(',', '.');
          } else {
            token = token.replace(/,/g, '');
          }
        } else if (token.includes(',')) {
          const parts = token.split(',');
          if (parts.length === 2 && parts[1].length === 3) token = parts.join('');
          else if (parts.length === 2) token = `${parts[0]}.${parts[1]}`;
          else token = parts.join('');
        } else if (token.includes('.')) {
          const parts = token.split('.');
          if (parts.length > 2) {
            const last = parts[parts.length - 1];
            if (last.length === 3) token = parts.join('');
            else token = `${parts.slice(0, -1).join('')}.${last}`;
          }
        }
        const n = Number(token);
        return Number.isFinite(n) ? n : null;
      };
      await createAdminCar({
        token,
        payload: {
          name: carForm.name,
          brand: carForm.brand,
          category: carForm.category,
          engineCc: toNumOrNull(carForm.engineCc),
          image: carForm.image,
          model3d: carForm.model3d,
          emissions: {
            co: toNumOrNull(carForm.co),
            hc: toNumOrNull(carForm.hc),
            euroStandard: carForm.euroStandard
          }
        }
      });
      setCarForm({ name: '', brand: '', category: '', engineCc: '', image: '', model3d: '', co: '', hc: '', euroStandard: '' });
      await load();
    } catch (err) {
      setCarCreateError(err?.message || 'CREATE_FAILED');
    } finally {
      setBusy(false);
    }
  };

  const onUploadCarModel = async (file) => {
    if (!file) return;
    setCarUploadError('');
    setCarUploading(true);
    try {
      const data = await uploadAdminCarModel({ token, file });
      setCarForm((p) => ({ ...p, model3d: data?.url || '' }));
    } catch (e) {
      setCarUploadError(e?.message || 'UPLOAD_FAILED');
    } finally {
      setCarUploading(false);
    }
  };

  const toggleAllCars = (checked) => {
    const next = {};
    for (const c of cars) next[c._id] = checked;
    setSelectedCars(next);
  };

  const toggleOneCar = (id, checked) => {
    setSelectedCars((prev) => ({ ...prev, [id]: checked }));
  };

  const openEditCar = (car) => {
    const s = car?.specs && typeof car.specs === 'object' ? car.specs : {};
    const em = car?.emissions && typeof car.emissions === 'object' ? car.emissions : {};
    const slots = Array.isArray(car?.combinedModelSlots) ? car.combinedModelSlots : [];
    const models = car?.combinedModels && typeof car.combinedModels === 'object' ? car.combinedModels : {};
    const combosRaw = Array.isArray(car?.combos) ? car.combos : [];
    const combosDraft = combosRaw
      .map((c) => {
        const key = String(c?.key || '').trim();
        const title = String(c?.title || '').trim();
        const modelKey = String(c?.modelKey || '').trim();
        const sortOrderNum = Number(c?.sortOrder);
        const sortOrder = Number.isFinite(sortOrderNum) ? sortOrderNum : 0;
        const rawSlots = c?.slots;
        const slotsObj =
          rawSlots instanceof Map
            ? Object.fromEntries(rawSlots.entries())
            : rawSlots && typeof rawSlots === 'object'
              ? rawSlots
              : {};
        const slotRows = Object.entries(slotsObj || {})
          .map(([slot, partId]) => ({ slot: String(slot || '').trim(), partId: String(partId || '').trim() }))
          .filter((x) => x.slot);
        return { key, title, modelKey, sortOrder, slots: slotRows };
      })
      .filter((c) => c.key || c.title || (Array.isArray(c.slots) && c.slots.length));
    setCarEditError('');
    setComboUploadError('');
    setComboUploadBusy(false);
    setComboUploadFiles([]);
    const slotsOrder = slots.map((x) => String(x || '').trim()).filter(Boolean);
    const initialValues = {};
    for (const s2 of slotsOrder) initialValues[s2] = '';
    setComboUploadValues(initialValues);
    setComboUploadKey('');
    setCarCombosDraft(combosDraft);
    setCarEditId(String(car?._id || ''));
    setCarEditForm({
      name: String(car?.name || ''),
      brand: String(car?.brand || ''),
      category: String(car?.category || ''),
      engineCc: car?.engineCc === null || car?.engineCc === undefined ? '' : String(car.engineCc),
      image: String(car?.image || ''),
      model3d: String(car?.model3d || ''),
      combinedModelSlots: slotsOrder.join(', '),
      combinedModelsJson: JSON.stringify(models || {}, null, 2),
      powerHp: s?.powerHp === null || s?.powerHp === undefined ? '' : String(s.powerHp),
      torqueNm: s?.torqueNm === null || s?.torqueNm === undefined ? '' : String(s.torqueNm),
      weightKg: s?.weightKg === null || s?.weightKg === undefined ? '' : String(s.weightKg),
      topSpeedKph: s?.topSpeedKph === null || s?.topSpeedKph === undefined ? '' : String(s.topSpeedKph),
      fuelL: s?.fuelL === null || s?.fuelL === undefined ? '' : String(s.fuelL),
      engineType: String(s?.engineType || ''),
      gearbox: String(s?.gearbox || ''),
      co: em?.co === null || em?.co === undefined ? '' : String(em.co),
      hc: em?.hc === null || em?.hc === undefined ? '' : String(em.hc),
      euroStandard: String(em?.euroStandard || '')
    });
    setCarEditOpen(true);
  };

  const openAnchorEditor = (car) => {
    setAnchorEditError('');
    const id = String(car?._id || '').trim();
    setAnchorEditCarId(id);
    setAnchorEditModelUrl(String(car?.model3d || car?.modelUrl || '').trim());
    setAnchorEditAnchors(parseAnchorsFromDb(car?.anchors));
    setAnchorEditSelectedId('');
    setAnchorEditAddMode(false);
    setAnchorEditTransformMode('translate');
    setAnchorEditShowAnchors(true);
    setAnchorEditSnapEnabled(false);
    setAnchorEditSnapPosStep('0.01');
    setAnchorEditSnapRotDeg('5');
    setAnchorEditOpen(true);
  };

  const closeAnchorEditor = () => {
    setAnchorEditOpen(false);
    setAnchorEditCarId('');
    setAnchorEditModelUrl('');
    setAnchorEditAnchors([]);
    setAnchorEditSelectedId('');
    setAnchorEditAddMode(false);
    setAnchorEditError('');
  };

  useEffect(() => {
    if (!anchorEditOpen) return;
    const id = String(anchorEditCarId || '').trim();
    if (!id) return;
    const car = cars.find((c) => String(c?._id || '') === id);
    if (!car) return;
    setAnchorEditModelUrl(String(car?.model3d || car?.modelUrl || '').trim());
    setAnchorEditAnchors(parseAnchorsFromDb(car?.anchors));
    setAnchorEditSelectedId('');
    setAnchorEditAddMode(false);
  }, [anchorEditOpen, anchorEditCarId, cars]);

  const anchorMakeId = () => `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const anchorClampNum = (v, fallback = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  const anchorUpsertById = (id, patch) => {
    const k = String(id || '').trim();
    if (!k) return;
    setAnchorEditAnchors((prev) =>
      (Array.isArray(prev) ? prev : []).map((a) => (String(a?.id || '') === k ? { ...a, ...(patch || {}) } : a))
    );
  };

  const anchorCreate = ({ name, category, position, rotation } = {}) => {
    const id = anchorMakeId();
    const next = {
      id,
      name: String(name || '').trim() || `anchor_${id.slice(-6)}`,
      category: String(category || '').trim(),
      position: Array.isArray(position) ? position.slice(0, 3) : [0, 0, 0],
      rotation: Array.isArray(rotation) ? rotation.slice(0, 3) : [0, 0, 0]
    };
    setAnchorEditAnchors((prev) => [...(Array.isArray(prev) ? prev : []), next]);
    setAnchorEditSelectedId(id);
    return id;
  };

  const anchorAddAt = (pos) => {
    const p = Array.isArray(pos) ? pos.slice(0, 3).map((x) => anchorClampNum(x)) : [0, 0, 0];
    const id = anchorCreate({ name: 'new_anchor', category: '', position: p, rotation: [0, 0, 0] });
    setAnchorEditAddMode(false);
    return id;
  };

  const anchorUpdateTransform = (id, position, rotation) => {
    anchorUpsertById(id, { position, rotation });
  };

  const anchorOnCreateAction = (action) => {
    const kind = String(action?.type || '').trim();
    if (kind === 'new') {
      anchorCreate({ name: String(action?.name || '').trim(), category: String(action?.category || '').trim() });
      return;
    }
    if (kind === 'patch') {
      const id = String(action?.id || '').trim();
      const patch = action?.patch && typeof action.patch === 'object' ? action.patch : {};
      anchorUpsertById(id, patch);
    }
  };

  const anchorDeleteSelected = () => {
    const id = String(anchorEditSelectedId || '').trim();
    if (!id) return;
    setAnchorEditAnchors((prev) => (Array.isArray(prev) ? prev : []).filter((a) => String(a?.id || '') !== id));
    setAnchorEditSelectedId('');
  };

  const anchorSaveToDb = async () => {
    const id = String(anchorEditCarId || '').trim();
    if (!id) return;
    setAnchorEditError('');
    setAnchorEditBusy(true);
    try {
      const payload = { anchors: serializeAnchorsForDb(anchorEditAnchors) };
      const updated = await updateAdminCar({ token, id, payload });
      setCars((prev) => (Array.isArray(prev) ? prev : []).map((c) => (String(c?._id || '') === id ? updated : c)));
    } catch (e2) {
      setAnchorEditError(e2?.message || 'SAVE_FAILED');
    } finally {
      setAnchorEditBusy(false);
    }
  };

  const anchorImportPreset = ({ bikeId, anchors }) => {
    const arr = Array.isArray(anchors) ? anchors : [];
    setAnchorEditAnchors(arr);
    setAnchorEditSelectedId('');
    const nextCarId = String(bikeId || '').trim();
    if (nextCarId) setAnchorEditCarId(nextCarId);
  };

  const closeEditCar = () => {
    setCarEditOpen(false);
    setCarEditId('');
    setCarEditError('');
    setCarCombosDraft([]);
  };

  const addCarComboDraft = () => {
    setCarCombosDraft((prev) => [
      ...(Array.isArray(prev) ? prev : []),
      { key: '', title: '', modelKey: '', sortOrder: 0, slots: [{ slot: 'exhaust', partId: '' }] }
    ]);
  };

  const removeCarComboDraft = (idx) => {
    setCarCombosDraft((prev) => (Array.isArray(prev) ? prev.filter((_, i) => i !== idx) : []));
  };

  const updateCarComboDraft = (idx, patch) => {
    setCarCombosDraft((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      return list.map((c, i) => (i === idx ? { ...(c || {}), ...(patch || {}) } : c));
    });
  };

  const addCarComboSlotDraft = (idx) => {
    setCarCombosDraft((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      return list.map((c, i) => {
        if (i !== idx) return c;
        const slots = Array.isArray(c?.slots) ? c.slots : [];
        return { ...(c || {}), slots: [...slots, { slot: 'exhaust', partId: '' }] };
      });
    });
  };

  const removeCarComboSlotDraft = (comboIdx, slotIdx) => {
    setCarCombosDraft((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      return list.map((c, i) => {
        if (i !== comboIdx) return c;
        const slots = Array.isArray(c?.slots) ? c.slots : [];
        return { ...(c || {}), slots: slots.filter((_, j) => j !== slotIdx) };
      });
    });
  };

  const updateCarComboSlotDraft = (comboIdx, slotIdx, patch) => {
    setCarCombosDraft((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      return list.map((c, i) => {
        if (i !== comboIdx) return c;
        const slots = Array.isArray(c?.slots) ? c.slots : [];
        return {
          ...(c || {}),
          slots: slots.map((s, j) => (j === slotIdx ? { ...(s || {}), ...(patch || {}) } : s))
        };
      });
    });
  };

  const onUpdateCar = async (e) => {
    e.preventDefault();
    if (!carEditId) return;
    setCarEditError('');
    setBusy(true);
    try {
      const toNumOrNull = (v) => {
        if (v === '' || v === null || v === undefined) return null;
        if (typeof v === 'number') return Number.isFinite(v) ? v : null;
        const raw = String(v || '').trim();
        if (!raw) return null;
        const match = raw.replace(/\s+/g, '').match(/-?[\d.,]+/);
        if (!match) return null;
        let token = String(match[0] || '');
        if (token.includes('.') && token.includes(',')) {
          const lastDot = token.lastIndexOf('.');
          const lastComma = token.lastIndexOf(',');
          if (lastComma > lastDot) {
            token = token.replace(/\./g, '').replace(',', '.');
          } else {
            token = token.replace(/,/g, '');
          }
        } else if (token.includes(',')) {
          const parts = token.split(',');
          if (parts.length === 2 && parts[1].length === 3) token = parts.join('');
          else if (parts.length === 2) token = `${parts[0]}.${parts[1]}`;
          else token = parts.join('');
        } else if (token.includes('.')) {
          const parts = token.split('.');
          if (parts.length > 2) {
            const last = parts[parts.length - 1];
            if (last.length === 3) token = parts.join('');
            else token = `${parts.slice(0, -1).join('')}.${last}`;
          }
        }
        const n = Number(token);
        return Number.isFinite(n) ? n : null;
      };
      const combinedModelSlots = String(carEditForm.combinedModelSlots || '')
        .split(',')
        .map((x) => String(x || '').trim())
        .filter(Boolean);
      const combinedModelsJson = String(carEditForm.combinedModelsJson || '').trim();
      let combinedModels = {};
      if (combinedModelsJson) {
        try {
          combinedModels = JSON.parse(combinedModelsJson);
        } catch {
          setCarEditError(t('admin_invalid_json'));
          return;
        }
      }
      const combos = (Array.isArray(carCombosDraft) ? carCombosDraft : [])
        .map((c) => {
          const key = normalizeComboKey(c?.key || c?.title || '');
          const title = String(c?.title || '').trim();
          const modelKey = normalizeComboKey(c?.modelKey || '');
          const sortOrderNum = Number(c?.sortOrder);
          const sortOrder = Number.isFinite(sortOrderNum) ? sortOrderNum : 0;
          const slotsArr = Array.isArray(c?.slots) ? c.slots : [];
          const slots = {};
          for (const row of slotsArr) {
            const slot = String(row?.slot || '').trim();
            const partId = String(row?.partId || '').trim();
            if (!slot) continue;
            if (!partId) continue;
            slots[slot] = partId;
          }
          return { key, title, modelKey, sortOrder, slots };
        })
        .filter((c) => c.key && ((c.slots && Object.keys(c.slots).length) || c.modelKey))
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || String(a.title).localeCompare(String(b.title)));
      const updated = await updateAdminCar({
        token,
        id: carEditId,
        payload: {
          name: carEditForm.name,
          brand: carEditForm.brand,
          category: carEditForm.category,
          engineCc: toNumOrNull(carEditForm.engineCc),
          image: carEditForm.image,
          model3d: carEditForm.model3d,
          combos,
          combinedModelSlots,
          combinedModels,
          specs: {
            powerHp: toNumOrNull(carEditForm.powerHp),
            torqueNm: toNumOrNull(carEditForm.torqueNm),
            weightKg: toNumOrNull(carEditForm.weightKg),
            topSpeedKph: toNumOrNull(carEditForm.topSpeedKph),
            fuelL: toNumOrNull(carEditForm.fuelL),
            engineType: carEditForm.engineType,
            gearbox: carEditForm.gearbox
          },
          emissions: {
            co: toNumOrNull(carEditForm.co),
            hc: toNumOrNull(carEditForm.hc),
            euroStandard: carEditForm.euroStandard
          }
        }
      });
      if (updated && updated._id) {
        const uid = String(updated._id);
        setCars((prev) => prev.map((c) => (String(c?._id || '') === uid ? { ...c, ...updated } : c)));
      }
      closeEditCar();
    } catch (e2) {
      setCarEditError(e2?.message || 'UPDATE_FAILED');
    } finally {
      setBusy(false);
    }
  };

  const getCombinedSlotsOrderFromForm = () =>
    String(carEditForm.combinedModelSlots || '')
      .split(',')
      .map((x) => String(x || '').trim())
      .filter(Boolean);

  const parseCombinedModelsFromForm = () => {
    const raw = String(carEditForm.combinedModelsJson || '').trim();
    if (!raw) return { ok: true, value: {} };
    try {
      const value = JSON.parse(raw);
      if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, error: t('admin_invalid_json') };
      return { ok: true, value };
    } catch {
      return { ok: false, error: t('admin_invalid_json') };
    }
  };

  const combinedSlotsOrder = useMemo(() => getCombinedSlotsOrderFromForm(), [carEditForm.combinedModelSlots]);

  useEffect(() => {
    if (!carEditOpen) return;
    setComboUploadValues((prev) => {
      const next = {};
      for (const slot of combinedSlotsOrder) next[slot] = prev?.[slot] ?? '';
      return next;
    });
  }, [carEditOpen, combinedSlotsOrder]);

  const combinedModelsParsed = useMemo(() => parseCombinedModelsFromForm(), [carEditForm.combinedModelsJson]);
  const combinedModelEntries = useMemo(() => {
    if (!combinedModelsParsed.ok) return [];
    const v = combinedModelsParsed.value && typeof combinedModelsParsed.value === 'object' ? combinedModelsParsed.value : {};
    return Object.entries(v)
      .map(([k, url]) => [String(k), String(url || '')])
      .filter(([k]) => Boolean(k))
      .sort((a, b) => a[0].localeCompare(b[0]));
  }, [combinedModelsParsed]);

  const comboPreviewKey = useMemo(() => {
    if (!combinedSlotsOrder.length) return '';
    const cfg = {};
    for (const slot of combinedSlotsOrder) cfg[slot] = normalizeVariantKey(comboUploadValues?.[slot] || 'stock') || 'stock';
    return makeComboKey({ slotsOrder: combinedSlotsOrder, config: cfg });
  }, [combinedSlotsOrder, comboUploadValues]);

  const onUploadCombinedModel = async () => {
    if (!carEditId) return;
    setComboUploadError('');
    const files = Array.isArray(comboUploadFiles) ? comboUploadFiles.filter(Boolean) : [];
    if (!files.length) {
      setComboUploadError('MISSING_FILE');
      return;
    }
    setComboUploadBusy(true);
    try {
      const current = combinedModelsParsed.ok ? combinedModelsParsed.value : {};
      let next = { ...(current || {}) };

      if (files.length === 1) {
        const key = String(comboUploadKey || comboPreviewKey || '').trim();
        if (!key) {
          setComboUploadError('MISSING_COMBO_KEY');
          return;
        }
        const data = await uploadAdminCarCombinedModel({ token, id: carEditId, comboKey: key, file: files[0] });
        next = { ...next, [String(data?.key || key)]: String(data?.url || '') };
      } else {
        for (const file of files) {
          const rawName = String(file?.name || '').trim();
          const base = rawName.replace(/\.(glb|gltf)$/i, '');
          const derivedKey = normalizeVariantKey(base);
          if (!derivedKey) continue;
          const data = await uploadAdminCarCombinedModel({ token, id: carEditId, comboKey: derivedKey, file });
          next = { ...next, [String(data?.key || derivedKey)]: String(data?.url || '') };
        }
      }

      setCarEditForm((p) => ({ ...p, combinedModelsJson: JSON.stringify(next, null, 2) }));
      setComboUploadFiles([]);
      setComboUploadKey('');
      setComboUploadError('');
    } catch (e) {
      setComboUploadError(e?.message || 'UPLOAD_FAILED');
    } finally {
      setComboUploadBusy(false);
    }
  };

  const onRemoveCombinedModelKey = async (key) => {
    if (!carEditId) return;
    const k = String(key || '').trim();
    if (!k) return;
    setComboUploadError('');
    setComboUploadBusy(true);
    try {
      await deleteAdminCarCombinedModel({ token, id: carEditId, comboKey: k });
      const current = combinedModelsParsed.ok ? combinedModelsParsed.value : {};
      const next = { ...(current || {}) };
      delete next[k];
      setCarEditForm((p) => ({ ...p, combinedModelsJson: JSON.stringify(next, null, 2) }));
    } catch (e) {
      setComboUploadError(e?.message || 'DELETE_FAILED');
    } finally {
      setComboUploadBusy(false);
    }
  };

  const deleteOneCar = async (id) => {
    if (!confirm(t('admin_delete_car_confirm'))) return;
    setBusy(true);
    setError('');
    try {
      await deleteAdminCar({ token, id });
      await load();
    } catch (e) {
      setError(e?.message || 'DELETE_FAILED');
    } finally {
      setBusy(false);
    }
  };

  const deleteSelectedCars = async () => {
    if (!selectedCarIds.length) return;
    if (!confirm(t('admin_delete_cars_confirm').replace('{count}', selectedCarIds.length))) return;
    setBusy(true);
    setError('');
    try {
      await Promise.all(selectedCarIds.map((id) => deleteAdminCar({ token, id })));
      await load();
    } catch (e) {
      setError(e?.message || 'DELETE_FAILED');
    } finally {
      setBusy(false);
    }
  };

  const toggleAllBrands = (checked) => {
    const next = {};
    for (const b of brands) next[b._id] = checked;
    setSelectedBrands(next);
  };

  const toggleOneBrand = (id, checked) => {
    setSelectedBrands((prev) => ({ ...prev, [id]: checked }));
  };

  const onCreateBrand = async (e) => {
    e.preventDefault();
    setBrandError('');
    setBusy(true);
    try {
      await createAdminBrand({ token, payload: { name: brandName, vehicleType: brandVehicleType, logo: brandLogoUrl } });
      setBrandName('');
      setBrandVehicleType('pkl');
      setBrandLogoUrl('');
      await load();
    } catch (err) {
      setBrandError(err?.message || 'CREATE_FAILED');
    } finally {
      setBusy(false);
    }
  };

  const onUploadBrandLogo = async (file) => {
    if (!file) return;
    setBrandLogoUploadError('');
    setBrandLogoUploading(true);
    try {
      const data = await uploadAdminBrandLogo({ token, file });
      setBrandLogoUrl(data?.url || '');
    } catch (e) {
      setBrandLogoUploadError(e?.message || 'UPLOAD_FAILED');
    } finally {
      setBrandLogoUploading(false);
    }
  };

  const openEditBrand = (b) => {
    setBrandEditError('');
    setBrandEditId(String(b?._id || ''));
    setBrandEditForm({
      name: String(b?.name || ''),
      vehicleType: String(b?.vehicleType || 'pkl'),
      logo: String(b?.logo || '')
    });
    setBrandEditLogoUploadError('');
    setBrandEditOpen(true);
  };

  const closeEditBrand = () => {
    setBrandEditOpen(false);
    setBrandEditId('');
    setBrandEditError('');
    setBrandEditForm({ name: '', vehicleType: 'pkl', logo: '' });
    setBrandEditLogoUploading(false);
    setBrandEditLogoUploadError('');
  };

  const onUploadBrandLogoEdit = async (file) => {
    if (!file) return;
    setBrandEditLogoUploadError('');
    setBrandEditLogoUploading(true);
    try {
      const data = await uploadAdminBrandLogo({ token, file });
      setBrandEditForm((p) => ({ ...p, logo: data?.url || '' }));
    } catch (e) {
      setBrandEditLogoUploadError(e?.message || 'UPLOAD_FAILED');
    } finally {
      setBrandEditLogoUploading(false);
    }
  };

  const onUpdateBrand = async (e) => {
    e.preventDefault();
    if (!brandEditId) return;
    setBrandEditError('');
    setBusy(true);
    try {
      const item = await updateAdminBrand({
        token,
        id: brandEditId,
        payload: { name: brandEditForm.name, vehicleType: brandEditForm.vehicleType, logo: brandEditForm.logo }
      });
      setBrands((prev) => prev.map((b) => (String(b._id) === String(item._id) ? item : b)));
      closeEditBrand();
    } catch (e2) {
      setBrandEditError(e2?.message || 'UPDATE_FAILED');
    } finally {
      setBusy(false);
    }
  };

  const resolveAssetUrl = (url) => {
    const API_BASE_URL = getApiBaseUrl();
    const u = String(url || '').trim();
    if (!u) return '';
    if (u.startsWith('http://') || u.startsWith('https://')) return u;
    if (u.startsWith('/')) return `${API_BASE_URL}${u}`;
    return `${API_BASE_URL}/${u}`;
  };

  const onUploadBackgroundImage = async (file) => {
    if (!file) return;
    setBgUploadError('');
    setBgUploading(true);
    try {
      const data = await uploadAdminBackgroundImage({ token, file });
      setBgForm((p) => ({ ...p, imageUrl: data?.url || '' }));
    } catch (e) {
      setBgUploadError(e?.message || 'UPLOAD_FAILED');
    } finally {
      setBgUploading(false);
    }
  };

  const openEditBackground = (b) => {
    setBgEditError('');
    setBgEditId(String(b?._id || ''));
    setBgEditForm({
      key: String(b?.key || ''),
      label: String(b?.label || ''),
      kind: String(b?.kind || 'image'),
      color: String(b?.color || '#ffffff'),
      css: String(b?.css || ''),
      imageUrl: String(b?.imageUrl || ''),
      enabled: Boolean(b?.enabled),
      sortOrder: b?.sortOrder === null || b?.sortOrder === undefined ? '' : String(b.sortOrder)
    });
    setBgEditUploadError('');
    setBgEditOpen(true);
  };

  const closeEditBackground = () => {
    setBgEditOpen(false);
    setBgEditId('');
    setBgEditError('');
    setBgEditForm({ key: '', label: '', kind: 'image', color: '#ffffff', css: '', imageUrl: '', enabled: true, sortOrder: '' });
    setBgEditUploading(false);
    setBgEditUploadError('');
  };

  const onUploadBackgroundImageEdit = async (file) => {
    if (!file) return;
    setBgEditUploadError('');
    setBgEditUploading(true);
    try {
      const data = await uploadAdminBackgroundImage({ token, file });
      setBgEditForm((p) => ({ ...p, imageUrl: data?.url || '' }));
    } catch (e) {
      setBgEditUploadError(e?.message || 'UPLOAD_FAILED');
    } finally {
      setBgEditUploading(false);
    }
  };

  const onUpdateBackground = async (e) => {
    e.preventDefault();
    if (!bgEditId) return;
    setBgEditError('');
    setBusy(true);
    try {
      const item = await updateAdminBackground({
        token,
        id: bgEditId,
        payload: {
          label: bgEditForm.label,
          kind: bgEditForm.kind,
          color: bgEditForm.color,
          css: bgEditForm.css,
          imageUrl: bgEditForm.imageUrl,
          enabled: Boolean(bgEditForm.enabled),
          sortOrder: bgEditForm.sortOrder
        }
      });
      setBackgrounds((prev) => prev.map((b) => (String(b._id) === String(item._id) ? item : b)));
      closeEditBackground();
    } catch (e2) {
      setBgEditError(e2?.message || 'UPDATE_FAILED');
    } finally {
      setBusy(false);
    }
  };

  const onCreateBackground = async (e) => {
    e.preventDefault();
    setBgCreateError('');
    setBusy(true);
    try {
      await createAdminBackground({
        token,
        payload: {
          key: bgForm.key,
          label: bgForm.label,
          kind: bgForm.kind,
          color: bgForm.color,
          css: bgForm.css,
          imageUrl: bgForm.imageUrl,
          enabled: bgForm.enabled,
          sortOrder: bgForm.sortOrder
        }
      });
      setBgForm({ key: '', label: '', kind: 'image', color: '#ffffff', css: '', imageUrl: '', enabled: true, sortOrder: '' });
      await load();
    } catch (err) {
      setBgCreateError(err?.message || 'CREATE_FAILED');
    } finally {
      setBusy(false);
    }
  };

  const toggleAllBackgrounds = (checked) => {
    const next = {};
    for (const b of backgrounds) next[b._id] = checked;
    setSelectedBackgrounds(next);
  };

  const toggleOneBackground = (id, checked) => {
    setSelectedBackgrounds((prev) => ({ ...prev, [id]: checked }));
  };

  const deleteOneBackground = async (id) => {
    if (!confirm(t('admin_delete_bg_confirm'))) return;
    setBusy(true);
    setError('');
    try {
      await deleteAdminBackground({ token, id });
      await load();
    } catch (e) {
      setError(e?.message || 'DELETE_FAILED');
    } finally {
      setBusy(false);
    }
  };

  const deleteSelectedBackgrounds = async () => {
    if (!selectedBackgroundIds.length) return;
    if (!confirm(t('admin_delete_bgs_confirm').replace('{count}', selectedBackgroundIds.length))) return;
    setBusy(true);
    setError('');
    try {
      for (const id of selectedBackgroundIds) {
        await deleteAdminBackground({ token, id });
      }
      await load();
    } catch (e) {
      setError(e?.message || 'DELETE_FAILED');
    } finally {
      setBusy(false);
    }
  };

  const deleteOneBrand = async (id) => {
    if (!confirm(t('admin_delete_brand_confirm'))) return;
    setBusy(true);
    setError('');
    try {
      await deleteAdminBrand({ token, id });
      await load();
    } catch (e) {
      setError(e?.message || 'DELETE_FAILED');
    } finally {
      setBusy(false);
    }
  };

  const deleteSelectedBrands = async () => {
    if (!selectedBrandIds.length) return;
    if (!confirm(t('admin_delete_brands_confirm').replace('{count}', selectedBrandIds.length))) return;
    setBusy(true);
    setError('');
    try {
      await Promise.all(selectedBrandIds.map((id) => deleteAdminBrand({ token, id })));
      await load();
    } catch (e) {
      setError(e?.message || 'DELETE_FAILED');
    } finally {
      setBusy(false);
    }
  };

  const onCreatePart = async (e) => {
    e.preventDefault();
    setPartCreateError('');
    setBusy(true);
    try {
      const allowedKeys = getAllowedPartSpecKeys(partForm.type);
      const specs = {};
      for (const key of allowedKeys) {
        specs[key] = toNumOrNullFlexible(partForm[key]);
      }
      const emissions = {};
      const coMul = toNumOrNullFlexible(partForm.coMultiplier);
      const hcMul = toNumOrNullFlexible(partForm.hcMultiplier);
      if (coMul !== null) emissions.coMultiplier = coMul;
      if (hcMul !== null) emissions.hcMultiplier = hcMul;
      if (String(partForm.type || '').trim() === 'exhaust') emissions.hasCatalytic = partForm.hasCatalytic !== false;

      await createAdminPart({
        token,
        payload: {
          name: partForm.name,
          type: partForm.type,
          variantKey: partForm.variantKey,
          thumbnailUrl: partForm.thumbnailUrl,
          price: partForm.price,
          specs,
          emissions
        }
      });
      setPartForm({ 
        name: '', type: 'wheels', variantKey: '', thumbnailUrl: '', price: '',
        powerHp: '', torqueNm: '', weightKg: '', topSpeedKph: '',
        coMultiplier: '', hcMultiplier: '', hasCatalytic: true
      });
      await load();
    } catch (err) {
      setPartCreateError(err?.message || 'CREATE_FAILED');
    } finally {
      setBusy(false);
    }
  };

  const deleteOnePart = async (id) => {
    if (!confirm(t('admin_delete_part_confirm'))) return;
    setBusy(true);
    setError('');
    try {
      await deleteAdminPart({ token, id });
      await load();
    } catch (e) {
      setError(e?.message || 'DELETE_FAILED');
    } finally {
      setBusy(false);
    }
  };


  const openEditPart = (part) => {
    const s = part?.specs && typeof part.specs === 'object' ? part.specs : {};
    const em = part?.emissions && typeof part.emissions === 'object' ? part.emissions : {};
    setPartEditError('');
    setPartEditId(String(part?._id || ''));
    setPartEditForm({
      name: String(part?.name || ''),
      type: String(part?.type || 'wheels'),
      variantKey: String(part?.variantKey || ''),
      thumbnailUrl: String(part?.thumbnailUrl || ''),
      price: part?.price === null || part?.price === undefined ? '' : String(part.price),
      powerHp: s?.powerHp === null || s?.powerHp === undefined ? '' : String(s.powerHp),
      torqueNm: s?.torqueNm === null || s?.torqueNm === undefined ? '' : String(s.torqueNm),
      weightKg: s?.weightKg === null || s?.weightKg === undefined ? '' : String(s.weightKg),
      topSpeedKph: s?.topSpeedKph === null || s?.topSpeedKph === undefined ? '' : String(s.topSpeedKph),
      coMultiplier: em?.coMultiplier === null || em?.coMultiplier === undefined ? '' : String(em.coMultiplier),
      hcMultiplier: em?.hcMultiplier === null || em?.hcMultiplier === undefined ? '' : String(em.hcMultiplier),
      hasCatalytic: em?.hasCatalytic !== false
    });
    setPartEditOpen(true);
  };

  const closeEditPart = () => {
    setPartEditOpen(false);
    setPartEditId('');
    setPartEditError('');
  };

  const onUpdatePart = async (e) => {
    e.preventDefault();
    if (!partEditId) return;
    setPartEditError('');
    setBusy(true);
    try {
      const allowedKeys = getAllowedPartSpecKeys(partEditForm.type);
      const specs = {};
      for (const key of allowedKeys) {
        specs[key] = toNumOrNullFlexible(partEditForm[key]);
      }
      const emissions = {};
      const coMul = toNumOrNullFlexible(partEditForm.coMultiplier);
      const hcMul = toNumOrNullFlexible(partEditForm.hcMultiplier);
      if (coMul !== null) emissions.coMultiplier = coMul;
      if (hcMul !== null) emissions.hcMultiplier = hcMul;
      if (String(partEditForm.type || '').trim() === 'exhaust') emissions.hasCatalytic = partEditForm.hasCatalytic !== false;
      const updated = await updateAdminPart({
        token,
        id: partEditId,
        payload: {
          name: partEditForm.name,
          type: partEditForm.type,
          variantKey: partEditForm.variantKey,
          thumbnailUrl: partEditForm.thumbnailUrl,
          price: toNumOrNullFlexible(partEditForm.price) ?? 0,
          specs,
          emissions
        }
      });
      if (updated && updated._id) {
        const uid = String(updated._id);
        setParts((prev) => prev.map((p) => (String(p?._id || '') === uid ? { ...p, ...updated } : p)));
      }
      closeEditPart();
    } catch (e2) {
      setPartEditError(e2?.message || 'UPDATE_FAILED');
    } finally {
      setBusy(false);
    }
  };

  if (!isAuthed) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5">
        <div className="text-zinc-300">{t('admin_login_req')}</div>
        <div className="mt-3">
          <Link to="/login" className="rounded bg-sky-400 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-sky-300">{t('nav_login')}</Link>
        </div>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5">
        <div className="text-zinc-300">{t('admin_forbidden')}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
        <div className="flex flex-col gap-1">
          <div className="text-xl font-semibold text-zinc-100">{t('nav_admin')}</div>
          <div className="text-sm text-zinc-400">{t('admin_panel_hint')}</div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <button
            type="button"
            onClick={() => {
              setActiveSection('cars');
              setShowCarForm(true);
            }}
            className={`rounded-xl border p-4 text-left transition ${
              activeSection === 'cars' ? 'border-sky-400/40 bg-sky-400/10' : 'border-zinc-800 bg-zinc-950/60 hover:bg-zinc-950'
            }`}
          >
            <div className="text-sm font-semibold text-zinc-100">{t('admin_cars_title')}</div>
            <div className="mt-1 text-xs text-zinc-400">{t('admin_section_hint_cars')}</div>
            <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-sky-400 px-3 py-2 text-xs font-semibold text-zinc-950">
              {t('admin_add_car_btn')}
              <span className="rounded-md bg-zinc-950/10 px-2 py-0.5 text-[11px]">{cars.length}</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSection('parts');
              setShowPartForm(true);
            }}
            className={`rounded-xl border p-4 text-left transition ${
              activeSection === 'parts' ? 'border-sky-400/40 bg-sky-400/10' : 'border-zinc-800 bg-zinc-950/60 hover:bg-zinc-950'
            }`}
          >
            <div className="text-sm font-semibold text-zinc-100">{t('admin_parts_title')}</div>
            <div className="mt-1 text-xs text-zinc-400">{t('admin_section_hint_parts')}</div>
            <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-sky-400 px-3 py-2 text-xs font-semibold text-zinc-950">
              {t('admin_add_part_btn')}
              <span className="rounded-md bg-zinc-950/10 px-2 py-0.5 text-[11px]">{parts.length}</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSection('brands');
              setShowBrandForm(true);
            }}
            className={`rounded-xl border p-4 text-left transition ${
              activeSection === 'brands' ? 'border-sky-400/40 bg-sky-400/10' : 'border-zinc-800 bg-zinc-950/60 hover:bg-zinc-950'
            }`}
          >
            <div className="text-sm font-semibold text-zinc-100">{t('admin_brands_title')}</div>
            <div className="mt-1 text-xs text-zinc-400">{t('admin_section_hint_brands')}</div>
            <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-sky-400 px-3 py-2 text-xs font-semibold text-zinc-950">
              {t('admin_add_brand_btn')}
              <span className="rounded-md bg-zinc-950/10 px-2 py-0.5 text-[11px]">{brands.length}</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSection('bgs');
              setShowBgForm(true);
            }}
            className={`rounded-xl border p-4 text-left transition ${
              activeSection === 'bgs' ? 'border-sky-400/40 bg-sky-400/10' : 'border-zinc-800 bg-zinc-950/60 hover:bg-zinc-950'
            }`}
          >
            <div className="text-sm font-semibold text-zinc-100">{t('admin_bgs_title')}</div>
            <div className="mt-1 text-xs text-zinc-400">{t('admin_section_hint_bgs')}</div>
            <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-sky-400 px-3 py-2 text-xs font-semibold text-zinc-950">
              {t('admin_add_bg_btn')}
              <span className="rounded-md bg-zinc-950/10 px-2 py-0.5 text-[11px]">{backgrounds.length}</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSection('users');
            }}
            className={`rounded-xl border p-4 text-left transition ${
              activeSection === 'users' ? 'border-sky-400/40 bg-sky-400/10' : 'border-zinc-800 bg-zinc-950/60 hover:bg-zinc-950'
            }`}
          >
            <div className="text-sm font-semibold text-zinc-100">{t('admin_users_title')}</div>
            <div className="mt-1 text-xs text-zinc-400">{t('admin_section_hint_users')}</div>
            <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-sky-400 px-3 py-2 text-xs font-semibold text-zinc-950">
              {t('admin_actions')}
              <span className="rounded-md bg-zinc-950/10 px-2 py-0.5 text-[11px]">{users.length}</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSection('hero');
            }}
            className={`rounded-xl border p-4 text-left transition ${
              activeSection === 'hero' ? 'border-sky-400/40 bg-sky-400/10' : 'border-zinc-800 bg-zinc-950/60 hover:bg-zinc-950'
            }`}
          >
            <div className="text-sm font-semibold text-zinc-100">{t('admin_hero_title')}</div>
            <div className="mt-1 text-xs text-zinc-400">{t('admin_section_hint_hero')}</div>
            <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-sky-400 px-3 py-2 text-xs font-semibold text-zinc-950">
              {t('admin_hero_upload_btn')}
              <span className="rounded-md bg-zinc-950/10 px-2 py-0.5 text-[11px]">{heroLandingImages.length + heroDashboardImages.length}</span>
            </div>
          </button>

          <Link
            to="/admin/shadow"
            className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 text-left transition hover:bg-zinc-950"
          >
            <div className="text-sm font-semibold text-zinc-100">Admin • Shadow Mode</div>
            <div className="mt-1 text-xs text-zinc-400">Tracking logs • suspicious activity • scan analytics</div>
            <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-sky-400 px-3 py-2 text-xs font-semibold text-zinc-950">
              Mở
            </div>
          </Link>
        </div>
      </div>

      {activeSection === 'brands' ? (
      <section id="admin-brands" className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">{t('admin_brands_title')}</h2>
            <div className="mt-1 text-sm text-zinc-400">{t('admin_section_hint_brands')}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowBrandForm((v) => !v)}
              className="rounded bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700"
            >
              {showBrandForm ? t('admin_hide_form') : t('admin_show_form')}
            </button>
            <button
              disabled={!selectedBrandIds.length || busy}
              onClick={deleteSelectedBrands}
              className="rounded bg-red-600 px-3 py-2 text-sm font-medium hover:bg-red-500 disabled:opacity-60"
            >
              {t('admin_delete_selected_brands')}
            </button>
          </div>
        </div>

      {showBrandForm ? (
        <form onSubmit={onCreateBrand} className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1">
            <div className="text-sm text-zinc-300">{t('admin_brand_name')}</div>
            <input
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
              placeholder="Honda / Yamaha / Ducati..."
              required
            />
          </div>
          <div className="space-y-1">
            <div className="text-sm text-zinc-300">{t('admin_type')}</div>
            <select
              value={brandVehicleType}
              onChange={(e) => setBrandVehicleType(e.target.value)}
              className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            >
              <option value="scooter">{t('admin_scooter')}</option>
              <option value="pkl">{t('admin_pkl')}</option>
              <option value="oto">{t('admin_oto')}</option>
            </select>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-zinc-300">{t('admin_logo_url')}</div>
            <div className="flex items-center gap-2">
              <input
                value={brandLogoUrl}
                onChange={(e) => setBrandLogoUrl(e.target.value)}
                className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                placeholder="https://...png"
              />
              <button
                type="button"
                onClick={async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    if (text) setBrandLogoUrl(text.trim());
                  } catch (_e) {
                    const manual = prompt(t('admin_paste_url_prompt')) || '';
                    if (manual) setBrandLogoUrl(manual.trim());
                  }
                }}
                className="whitespace-nowrap rounded border border-zinc-700 bg-zinc-900 px-2 py-2 text-xs text-zinc-200 hover:bg-zinc-800"
              >{t('admin_paste_url_btn')}</button>
              <button
                type="button"
                disabled={!brandLogoUrl || brandLogoUploading || busy}
                onClick={async () => {
                  try {
                    const data = await importAdminBrandLogoFromUrl({ token, url: brandLogoUrl });
                    setBrandLogoUrl(data?.url || '');
                    alert(t('admin_saved_to_server'));
                  } catch (e) {
                    alert(t('admin_save_url_error'));
                  }
                }}
                className="whitespace-nowrap rounded border border-zinc-700 bg-zinc-900 px-2 py-2 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-60"
              >{t('admin_save_to_server_btn')}</button>
              <button
                type="button"
                disabled={!brandLogoUrl}
                onClick={async () => {
                  const val = resolveAssetUrl(brandLogoUrl);
                  try {
                    await navigator.clipboard.writeText(val || '');
                    alert(t('admin_copied_url'));
                  } catch (_e) {
                    alert(t('admin_copy_error'));
                  }
                }}
                className="whitespace-nowrap rounded border border-zinc-700 bg-zinc-900 px-2 py-2 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-60"
              >{t('admin_copy_btn')}</button>
            </div>
            {brandLogoUrl ? (
              <div className="mt-2 flex items-center gap-3">
                <img
                  src={resolveAssetUrl(brandLogoUrl)}
                  alt="preview"
                  className="h-10 w-10 rounded border border-zinc-800 bg-zinc-900 object-contain p-1"
                />
                <div className="truncate text-xs text-zinc-400">{resolveAssetUrl(brandLogoUrl)}</div>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-3 pt-1">
              <input
                type="file"
                accept=".png,.jpg,.jpeg,.webp"
                disabled={brandLogoUploading || busy}
                onChange={(e) => onUploadBrandLogo(e.target.files?.[0])}
                className="block w-full text-xs text-zinc-300 file:mr-3 file:rounded file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-xs file:text-zinc-100 hover:file:bg-zinc-700 disabled:opacity-60"
              />
            </div>
            {brandLogoUploading ? <div className="text-xs text-zinc-400">{t('admin_uploading_logo')}</div> : null}
            {brandLogoUploadError ? <div className="text-xs text-red-400">{t('admin_upload_error')}{brandLogoUploadError}</div> : null}
          </div>
          <div className="flex items-end justify-end">
            <button
              disabled={busy}
              className="rounded bg-sky-400 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-sky-300 disabled:opacity-60"
            >{t('admin_add_brand_btn')}</button>
          </div>
        </div>
        {brandError ? <div className="mt-2 text-sm text-red-400">{t('admin_error')}{brandError}</div> : null}
      </form>
      ) : null}

      {brandEditOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
            <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
              <div className="text-lg font-semibold text-zinc-100">{t('admin_edit_brand')}</div>
              <button
                type="button"
                disabled={busy || brandEditLogoUploading}
                onClick={closeEditBrand}
                className="rounded bg-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-700 disabled:opacity-60"
              >{t('admin_close')}</button>
            </div>

            <form id="brand-edit-form" onSubmit={onUpdateBrand} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block">
                  <div className="mb-1 text-sm text-zinc-300">{t('admin_brand_name')}</div>
                  <input
                    value={brandEditForm.name}
                    onChange={(e) => setBrandEditForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                    required
                  />
                </label>
                <label className="block">
                  <div className="mb-1 text-sm text-zinc-300">{t('admin_type')}</div>
                  <select
                    value={brandEditForm.vehicleType}
                    onChange={(e) => setBrandEditForm((p) => ({ ...p, vehicleType: e.target.value }))}
                    className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                  >
                    <option value="scooter">{t('admin_scooter')}</option>
                    <option value="pkl">{t('admin_pkl')}</option>
                    <option value="oto">{t('admin_oto')}</option>
                  </select>
                </label>
                <label className="block md:col-span-2">
                  <div className="mb-1 text-sm text-zinc-300">{t('admin_logo_url')}</div>
                  <input
                    value={brandEditForm.logo}
                    onChange={(e) => setBrandEditForm((p) => ({ ...p, logo: e.target.value }))}
                    className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                    placeholder="https://...png"
                  />
                  {brandEditForm.logo ? (
                    <div className="mt-2 flex items-center gap-3">
                      <img
                        src={resolveAssetUrl(brandEditForm.logo)}
                        alt="preview"
                        className="h-10 w-10 rounded border border-zinc-800 bg-zinc-900 object-contain p-1"
                      />
                      <div className="truncate text-xs text-zinc-400">{resolveAssetUrl(brandEditForm.logo)}</div>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between gap-3 pt-2">
                    <input
                      type="file"
                      accept=".png,.jpg,.jpeg,.webp"
                      disabled={brandEditLogoUploading || busy}
                      onChange={(e) => onUploadBrandLogoEdit(e.target.files?.[0])}
                      className="block w-full text-xs text-zinc-300 file:mr-3 file:rounded file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-xs file:text-zinc-100 hover:file:bg-zinc-700 disabled:opacity-60"
                    />
                  </div>
                  {brandEditLogoUploading ? <div className="text-xs text-zinc-400">{t('admin_uploading_logo')}</div> : null}
                  {brandEditLogoUploadError ? <div className="text-xs text-red-400">{t('admin_upload_error')}{brandEditLogoUploadError}</div> : null}
                </label>
              </div>

              {brandEditError ? <div className="text-sm text-red-400">{t('admin_error')}{brandEditError}</div> : null}
            </form>

            <div className="flex items-center justify-end gap-2 border-t border-zinc-800 bg-zinc-950 px-4 py-3">
              <button
                type="button"
                disabled={busy || brandEditLogoUploading}
                onClick={closeEditBrand}
                className="rounded bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700 disabled:opacity-60"
              >{t('admin_cancel_btn')}</button>
              <button
                type="submit"
                form="brand-edit-form"
                disabled={busy || brandEditLogoUploading}
                className="rounded bg-sky-400 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-sky-300 disabled:opacity-60"
              >{t('admin_update_info')}</button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-lg border border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-900/70 text-zinc-200">
            <tr>
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  checked={brands.length > 0 && selectedBrandIds.length === brands.length}
                  onChange={(e) => toggleAllBrands(e.target.checked)}
                />
              </th>
              <th className="px-3 py-2">Logo</th>
              <th className="px-3 py-2">{t('admin_brand')}</th>
              <th className="px-3 py-2">{t('admin_type')}</th>
              <th className="w-40 px-3 py-2 text-right">{t('admin_actions')}</th>
            </tr>
          </thead>
          <tbody className="bg-zinc-950">
            {brands.map((b) => (
              <tr key={b._id} className="border-t border-zinc-800">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedBrands[b._id])}
                    onChange={(e) => toggleOneBrand(b._id, e.target.checked)}
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    {b.logo ? (
                      <img src={resolveAssetUrl(b.logo)} alt={b.name} className="h-6 w-auto rounded bg-zinc-800 object-contain p-0.5" />
                    ) : (
                      <span className="text-xs text-zinc-500">—</span>
                    )}
                    {b.logo ? (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(resolveAssetUrl(b.logo));
                            alert(t('admin_copied_url'));
                          } catch (_e) {
                            alert(t('admin_copy_error'));
                          }
                        }}
                        className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-200 hover:bg-zinc-800"
                      >{t('admin_copy_btn')}</button>
                    ) : null}
                  </div>
                </td>
                <td className="px-3 py-2 text-zinc-100">{b.name}</td>
                <td className="px-3 py-2 text-zinc-300">
                  {String(b.vehicleType || 'pkl') === 'oto' || String(b.vehicleType || '') === 'car'
                    ? t('admin_oto')
                    : String(b.vehicleType || '') === 'scooter'
                      ? t('admin_scooter')
                      : t('admin_pkl')}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => openEditBrand(b)}
                    className="mr-2 rounded bg-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-700 disabled:opacity-60"
                  >{t('admin_update_info')}</button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => deleteOneBrand(b._id)}
                    className="rounded bg-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-700 disabled:opacity-60"
                  >{t('admin_delete_btn')}</button>
                </td>
              </tr>
            ))}
            {!loading && brands.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-zinc-400">{t('admin_no_brands')}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      </section>
      ) : null}

      {activeSection === 'cars' ? (
      <section id="admin-cars" className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">{t('admin_cars_title')}</h2>
            <div className="mt-1 text-sm text-zinc-400">{t('admin_section_hint_cars')}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCarForm((v) => !v)}
              className="rounded bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700"
            >
              {showCarForm ? t('admin_hide_form') : t('admin_show_form')}
            </button>
            <button
              disabled={!selectedCarIds.length || busy}
              onClick={deleteSelectedCars}
              className="rounded bg-red-600 px-3 py-2 text-sm font-medium hover:bg-red-500 disabled:opacity-60"
            >
              {t('admin_delete_selected_cars')}
            </button>
          </div>
        </div>

      {showCarForm ? (
      <form onSubmit={onCreateCar} className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <div className="text-sm text-zinc-300">{t('admin_car_name')}</div>
            <input
              value={carForm.name}
              onChange={(e) => setCarForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
              placeholder="Porsche 911"
              required
            />
          </div>
          <div className="space-y-1">
            <div className="text-sm text-zinc-300">Brand</div>
            <input
              value={carForm.brand}
              onChange={(e) => setCarForm((p) => ({ ...p, brand: e.target.value }))}
              className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
              placeholder="Porsche"
              list="admin-brand-suggestions"
            />
            <datalist id="admin-brand-suggestions">
              {brands
                .filter((b) => {
                  const t = String(b?.vehicleType || 'pkl');
                  const normalized = t === 'car' ? 'oto' : t === 'bike' ? 'pkl' : t;
                  if (!carForm.category) return true;
                  return normalized === String(carForm.category);
                })
                .map((b) => (
                  <option key={b._id} value={b.name} />
                ))}
            </datalist>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-zinc-300">Category</div>
            <select
              value={carForm.category}
              onChange={(e) => setCarForm((p) => ({ ...p, category: e.target.value }))}
              className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            >
              <option value="">--</option>
              <option value="scooter">Scooter</option>
              <option value="pkl">PKL</option>
              <option value="oto">{t('admin_car')}</option>
            </select>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-zinc-300">Engine CC</div>
            <input
              value={carForm.engineCc}
              onChange={(e) => setCarForm((p) => ({ ...p, engineCc: e.target.value }))}
              className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
              placeholder="150"
              inputMode="numeric"
            />
          </div>
          <div className="space-y-1">
            <div className="text-sm text-zinc-300">{t('admin_image_url')}</div>
            <input
              value={carForm.image}
              onChange={(e) => setCarForm((p) => ({ ...p, image: e.target.value }))}
              className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
              placeholder="https://...jpg"
            />
          </div>
          <div className="space-y-1">
            <div className="text-sm text-zinc-300">Model3D URL (.glb/.gltf)</div>
            <input
              value={carForm.model3d}
              onChange={(e) => setCarForm((p) => ({ ...p, model3d: e.target.value }))}
              className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
              placeholder={t('admin_model_placeholder')}
            />
            <div className="flex items-center justify-between gap-3 pt-1">
              <input
                type="file"
                accept=".glb,.gltf"
                disabled={carUploading || busy}
                onChange={(e) => onUploadCarModel(e.target.files?.[0])}
                className="block w-full text-xs text-zinc-300 file:mr-3 file:rounded file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-xs file:text-zinc-100 hover:file:bg-zinc-700 disabled:opacity-60"
              />
            </div>
            {carUploading ? <div className="text-xs text-zinc-400">{t('admin_uploading_model')}</div> : null}
            {carUploadError ? <div className="text-xs text-red-400">{t('admin_upload_error')}{carUploadError}</div> : null}
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
          <div className="mb-2 text-sm font-semibold text-zinc-200">Khí thải (mô phỏng)</div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="block">
              <div className="mb-1 text-sm text-zinc-300">CO (gốc)</div>
              <input
                value={carForm.co}
                onChange={(e) => setCarForm((p) => ({ ...p, co: e.target.value }))}
                className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                inputMode="decimal"
                placeholder="VD: 2.1"
              />
            </label>
            <label className="block">
              <div className="mb-1 text-sm text-zinc-300">HC (gốc)</div>
              <input
                value={carForm.hc}
                onChange={(e) => setCarForm((p) => ({ ...p, hc: e.target.value }))}
                className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                inputMode="numeric"
                placeholder="VD: 800"
              />
            </label>
            <label className="block">
              <div className="mb-1 text-sm text-zinc-300">Tiêu chuẩn Euro</div>
              <input
                value={carForm.euroStandard}
                onChange={(e) => setCarForm((p) => ({ ...p, euroStandard: e.target.value }))}
                className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                placeholder="Euro 4"
              />
            </label>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="text-xs text-zinc-400">{t('admin_model_hint')}</div>
          <button
            disabled={busy}
            className="rounded bg-sky-400 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-sky-300 disabled:opacity-60"
          >{t('admin_add_car_btn')}</button>
        </div>
        {carCreateError ? <div className="mt-2 text-sm text-red-400">{t('admin_error')}{carCreateError}</div> : null}
      </form>
      ) : null}

      {loading ? <div className="text-zinc-400">{t('admin_loading')}</div> : null}
      {error ? <div className="text-red-400">{t('admin_error')}{error}</div> : null}

      {carEditOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
            <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
              <div className="text-lg font-semibold text-zinc-100">{t('admin_edit_specs')}</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={closeEditCar}
                  className="rounded bg-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-700 disabled:opacity-60"
                >{t('admin_close')}</button>
              </div>
            </div>
            <form id="car-edit-form" onSubmit={onUpdateCar} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block">
                  <div className="mb-1 text-sm text-zinc-300">{t('admin_car_name')}</div>
                  <input
                    value={carEditForm.name}
                    onChange={(e) => setCarEditForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                    required
                  />
                </label>
                <label className="block">
                  <div className="mb-1 text-sm text-zinc-300">Brand</div>
                  <input
                    value={carEditForm.brand}
                    onChange={(e) => setCarEditForm((p) => ({ ...p, brand: e.target.value }))}
                    className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <div className="mb-1 text-sm text-zinc-300">Category</div>
                  <select
                    value={carEditForm.category}
                    onChange={(e) => setCarEditForm((p) => ({ ...p, category: e.target.value }))}
                    className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                  >
                    <option value="">--</option>
                    <option value="scooter">Scooter</option>
                    <option value="pkl">PKL</option>
                    <option value="oto">{t('admin_car')}</option>
                  </select>
                </label>
                <label className="block">
                  <div className="mb-1 text-sm text-zinc-300">{t('admin_cc')}</div>
                  <input
                    value={carEditForm.engineCc}
                    onChange={(e) => setCarEditForm((p) => ({ ...p, engineCc: e.target.value }))}
                    className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                    inputMode="numeric"
                    placeholder="155"
                  />
                </label>
                <label className="block md:col-span-2">
                  <div className="mb-1 text-sm text-zinc-300">{t('admin_image_url')}</div>
                  <input
                    value={carEditForm.image}
                    onChange={(e) => setCarEditForm((p) => ({ ...p, image: e.target.value }))}
                    className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                    placeholder="https://..."
                  />
                </label>
                <label className="block md:col-span-2">
                  <div className="mb-1 text-sm text-zinc-300">Model3D URL (.glb/.gltf)</div>
                  <input
                    value={carEditForm.model3d}
                    onChange={(e) => setCarEditForm((p) => ({ ...p, model3d: e.target.value }))}
                    className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                    placeholder={t('admin_model_url_placeholder')}
                  />
                </label>
              </div>

              <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
                <div className="mb-2 text-sm font-semibold text-zinc-200">{t('admin_specs')}</div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <div className="mb-1 text-sm text-zinc-300">{t('admin_power')}</div>
                    <input
                      value={carEditForm.powerHp}
                      onChange={(e) => setCarEditForm((p) => ({ ...p, powerHp: e.target.value }))}
                      className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                      inputMode="decimal"
                    />
                  </label>
                  <label className="block">
                    <div className="mb-1 text-sm text-zinc-300">{t('admin_torque')}</div>
                    <input
                      value={carEditForm.torqueNm}
                      onChange={(e) => setCarEditForm((p) => ({ ...p, torqueNm: e.target.value }))}
                      className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                      inputMode="decimal"
                    />
                  </label>
                  <label className="block">
                    <div className="mb-1 text-sm text-zinc-300">{t('admin_weight')}</div>
                    <input
                      value={carEditForm.weightKg}
                      onChange={(e) => setCarEditForm((p) => ({ ...p, weightKg: e.target.value }))}
                      className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                      inputMode="decimal"
                    />
                  </label>
                  <label className="block">
                    <div className="mb-1 text-sm text-zinc-300">{t('admin_top_speed')}</div>
                    <input
                      value={carEditForm.topSpeedKph}
                      onChange={(e) => setCarEditForm((p) => ({ ...p, topSpeedKph: e.target.value }))}
                      className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                      inputMode="decimal"
                    />
                  </label>
                  <label className="block">
                    <div className="mb-1 text-sm text-zinc-300">{t('admin_fuel')}</div>
                    <input
                      value={carEditForm.fuelL}
                      onChange={(e) => setCarEditForm((p) => ({ ...p, fuelL: e.target.value }))}
                      className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                      inputMode="decimal"
                    />
                  </label>
                  <label className="block">
                    <div className="mb-1 text-sm text-zinc-300">{t('admin_gearbox')}</div>
                    <input
                      value={carEditForm.gearbox}
                      onChange={(e) => setCarEditForm((p) => ({ ...p, gearbox: e.target.value }))}
                      className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                      placeholder="6-speed / CVT..."
                    />
                  </label>
                  <label className="block md:col-span-2">
                    <div className="mb-1 text-sm text-zinc-300">{t('admin_engine_type')}</div>
                    <input
                      value={carEditForm.engineType}
                      onChange={(e) => setCarEditForm((p) => ({ ...p, engineType: e.target.value }))}
                      className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                      placeholder="1-cylinder / V4 / Electric..."
                    />
                  </label>
                </div>
              </div>

              <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
                <div className="mb-2 text-sm font-semibold text-zinc-200">Khí thải (mô phỏng)</div>
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="block">
                    <div className="mb-1 text-sm text-zinc-300">CO (gốc)</div>
                    <input
                      value={carEditForm.co}
                      onChange={(e) => setCarEditForm((p) => ({ ...p, co: e.target.value }))}
                      className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                      inputMode="decimal"
                      placeholder="VD: 2.1"
                    />
                  </label>
                  <label className="block">
                    <div className="mb-1 text-sm text-zinc-300">HC (gốc)</div>
                    <input
                      value={carEditForm.hc}
                      onChange={(e) => setCarEditForm((p) => ({ ...p, hc: e.target.value }))}
                      className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                      inputMode="numeric"
                      placeholder="VD: 800"
                    />
                  </label>
                  <label className="block">
                    <div className="mb-1 text-sm text-zinc-300">Tiêu chuẩn Euro</div>
                    <input
                      value={carEditForm.euroStandard}
                      onChange={(e) => setCarEditForm((p) => ({ ...p, euroStandard: e.target.value }))}
                      className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                      placeholder="Euro 4"
                    />
                  </label>
                </div>
              </div>

              <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-zinc-200">{t('admin_combos_title')}</div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={addCarComboDraft}
                    className="rounded bg-sky-400 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-sky-300 disabled:opacity-60"
                  >
                    {t('admin_add_combo')}
                  </button>
                </div>

                {!carCombosDraft.length ? <div className="text-xs text-zinc-400">{t('admin_no_combos')}</div> : null}

                <div className="space-y-3">
                  {carCombosDraft.map((c, idx) => {
                    const slots = Array.isArray(c?.slots) ? c.slots : [];
                    return (
                      <div key={`${idx}:${c?.key || ''}`} className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm font-semibold text-zinc-100">{t('admin_combo')}</div>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => removeCarComboDraft(idx)}
                            className="rounded bg-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-700 disabled:opacity-60"
                          >
                            {t('admin_remove')}
                          </button>
                        </div>

                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <label className="block">
                            <div className="mb-1 text-sm text-zinc-300">{t('admin_combo_key_label')}</div>
                            <input
                              value={c?.key ?? ''}
                              onChange={(e) => updateCarComboDraft(idx, { key: e.target.value })}
                              className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                              placeholder="bober"
                            />
                            {normalizeComboKey(c?.key || c?.title || '') ? (
                              <div className="mt-1 text-xs text-zinc-400">
                                Preview: <span className="text-zinc-200">{normalizeComboKey(c?.key || c?.title || '')}</span>
                              </div>
                            ) : null}
                          </label>
                          <label className="block">
                            <div className="mb-1 text-sm text-zinc-300">{t('admin_combo_title_label')}</div>
                            <input
                              value={c?.title ?? ''}
                              onChange={(e) => updateCarComboDraft(idx, { title: e.target.value })}
                              className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                              placeholder="Combo bober"
                            />
                          </label>
                          <label className="block">
                            <div className="mb-1 text-sm text-zinc-300">{t('admin_combo_model_key_label')}</div>
                            <input
                              value={c?.modelKey ?? ''}
                              onChange={(e) => updateCarComboDraft(idx, { modelKey: e.target.value })}
                              className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                              placeholder="bober"
                            />
                          </label>
                          <label className="block">
                            <div className="mb-1 text-sm text-zinc-300">{t('admin_sort_order')}</div>
                            <input
                              value={c?.sortOrder ?? 0}
                              onChange={(e) => updateCarComboDraft(idx, { sortOrder: e.target.value })}
                              className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                              inputMode="numeric"
                            />
                          </label>
                        </div>

                        <div className="mt-4">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <div className="text-sm font-semibold text-zinc-200">{t('admin_combo_slots')}</div>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => addCarComboSlotDraft(idx)}
                              className="rounded bg-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-700 disabled:opacity-60"
                            >
                              {t('admin_add_slot')}
                            </button>
                          </div>

                          <div className="space-y-2">
                            {(slots.length ? slots : [{ slot: 'exhaust', partId: '' }]).map((row, rowIdx) => {
                              const slotType = String(row?.slot || 'exhaust');
                              const options = partsByType.get(slotType) || [];
                              return (
                                <div key={`${rowIdx}`} className="grid gap-2 md:grid-cols-[180px_1fr_96px]">
                                  <select
                                    value={slotType}
                                    onChange={(e) => updateCarComboSlotDraft(idx, rowIdx, { slot: e.target.value, partId: '' })}
                                    className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                                  >
                                    {partTypeOptions.map((o) => (
                                      <option key={o.value} value={o.value}>
                                        {o.label}
                                      </option>
                                    ))}
                                  </select>
                                  <select
                                    value={String(row?.partId || '')}
                                    onChange={(e) => updateCarComboSlotDraft(idx, rowIdx, { partId: e.target.value })}
                                    className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                                  >
                                    <option value="">{t('admin_choose_part')}</option>
                                    {options.map((p) => (
                                      <option key={p._id} value={p._id}>
                                        {p.name}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => removeCarComboSlotDraft(idx, rowIdx)}
                                    className="rounded bg-zinc-800 px-3 py-2 text-xs hover:bg-zinc-700 disabled:opacity-60"
                                  >
                                    {t('admin_remove')}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
                <div className="mb-2 text-sm font-semibold text-zinc-200">Combined Models</div>
                <div className="grid gap-3">
                  <label className="block">
                    <div className="mb-1 text-sm text-zinc-300">{t('admin_combined_model_slots')}</div>
                    <input
                      value={carEditForm.combinedModelSlots}
                      onChange={(e) => setCarEditForm((p) => ({ ...p, combinedModelSlots: e.target.value }))}
                      className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                      placeholder="exhaust, handlebar"
                    />
                  </label>

                  <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                    <div className="mb-2 text-sm font-semibold text-zinc-200">{t('admin_combined_upload_title')}</div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {combinedSlotsOrder.map((slot) => (
                        <label key={slot} className="block">
                          <div className="mb-1 text-sm text-zinc-300">{slot}</div>
                          <input
                            value={comboUploadValues?.[slot] ?? ''}
                            onChange={(e) =>
                              setComboUploadValues((p) => ({
                                ...(p || {}),
                                [slot]: e.target.value
                              }))
                            }
                            className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                            placeholder="stock / akrapovic / rizoma"
                          />
                        </label>
                      ))}
                      <label className="block md:col-span-2">
                        <div className="mb-1 text-sm text-zinc-300">{t('admin_combo_key')}</div>
                        <input
                          value={comboUploadKey}
                          onChange={(e) => setComboUploadKey(e.target.value)}
                          className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                          placeholder={comboPreviewKey || 'akrapovic_rizoma'}
                        />
                        {comboPreviewKey ? (
                          <div className="mt-1 text-xs text-zinc-400">
                            Preview: <span className="text-zinc-200">{comboPreviewKey}</span>
                          </div>
                        ) : null}
                      </label>
                      <label className="block md:col-span-2">
                        <div className="mb-1 text-sm text-zinc-300">Model (.glb/.gltf)</div>
                        <input
                          type="file"
                          accept=".glb,.gltf"
                          multiple
                          disabled={comboUploadBusy}
                          onChange={(e) => setComboUploadFiles(Array.from(e.target.files || []))}
                          className="block w-full text-xs text-zinc-300 file:mr-3 file:rounded file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-xs file:text-zinc-100 hover:file:bg-zinc-700 disabled:opacity-60"
                        />
                        {comboUploadFiles.length > 1 ? (
                          <div className="mt-1 text-xs text-zinc-400">
                            {t('admin_combo_upload_multi_hint')}
                          </div>
                        ) : null}
                      </label>
                      <div className="md:col-span-2 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled={comboUploadBusy || busy}
                          onClick={onUploadCombinedModel}
                          className="rounded bg-sky-400 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-sky-300 disabled:opacity-60"
                        >
                          {comboUploadBusy ? t('auth_processing') : t('admin_combo_upload')}
                        </button>
                      </div>
                      {comboUploadError ? (
                        <div className="md:col-span-2 text-sm text-red-400">
                          {t('admin_error')}
                          {comboUploadError}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <label className="block">
                    <div className="mb-1 text-sm text-zinc-300">{t('admin_combined_models_json')}</div>
                    <textarea
                      value={carEditForm.combinedModelsJson}
                      onChange={(e) => setCarEditForm((p) => ({ ...p, combinedModelsJson: e.target.value }))}
                      className="h-44 w-full resize-none rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                      placeholder='{\n  "akrapovic_rizoma": "/uploads/models/xsr155_akrapovic_rizoma.glb"\n}'
                    />
                    {!combinedModelsParsed.ok ? (
                      <div className="mt-2 text-xs text-red-400">
                        {t('admin_invalid_json')}
                      </div>
                    ) : null}
                  </label>

                  {combinedModelEntries.length ? (
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                      <div className="mb-2 text-sm font-semibold text-zinc-200">Mappings</div>
                      <div className="space-y-2">
                        {combinedModelEntries.map(([k, url]) => (
                          <div key={k} className="flex flex-wrap items-center justify-between gap-2 rounded border border-zinc-800 bg-zinc-950 px-3 py-2">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-zinc-100">{k}</div>
                              <a className="block truncate text-xs text-sky-300 hover:text-sky-200" href={resolveAssetUrl(url)} target="_blank" rel="noreferrer">
                                {resolveAssetUrl(url)}
                              </a>
                            </div>
                            <button
                              type="button"
                              disabled={comboUploadBusy || busy}
                              onClick={() => onRemoveCombinedModelKey(k)}
                              className="rounded bg-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-700 disabled:opacity-60"
                            >
                              {t('admin_combo_remove')}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {carEditError ? <div className="text-sm text-red-400">{t('admin_error')}{carEditError}</div> : null}
            </form>
            <div className="flex items-center justify-end gap-2 border-t border-zinc-800 bg-zinc-950 px-4 py-3">
              <button
                type="button"
                disabled={busy}
                onClick={closeEditCar}
                className="rounded bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700 disabled:opacity-60"
              >{t('admin_cancel_btn')}</button>
              <button
                type="submit"
                form="car-edit-form"
                disabled={busy}
                className="rounded bg-sky-400 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-sky-300 disabled:opacity-60"
              >{t('admin_update_info')}</button>
            </div>
          </div>
        </div>
      ) : null}

      {anchorEditOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold tracking-[0.22em] text-zinc-400">ADMIN</div>
                <div className="mt-1 truncate text-base font-black text-zinc-50">3D Anchor Editor</div>
              </div>
              <div className="flex items-center gap-2">
                {anchorEditError ? <div className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">{anchorEditError}</div> : null}
                <button
                  type="button"
                  disabled={anchorEditBusy}
                  onClick={closeAnchorEditor}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-zinc-200 hover:bg-white/10 disabled:opacity-60"
                >
                  {t('admin_close')}
                </button>
              </div>
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden p-4 lg:grid-cols-[minmax(0,1fr)_420px]">
              <div className="min-h-0">
                <div className="h-full">
                  <AnchorEditorCanvas
                    modelUrl={anchorEditModelUrl}
                    anchors={anchorEditAnchors}
                    selectedId={anchorEditSelectedId}
                    focusPosition={
                      (Array.isArray(anchorEditAnchors) ? anchorEditAnchors : []).find((a) => String(a?.id || '') === String(anchorEditSelectedId || ''))
                        ?.position
                    }
                    showAnchors={anchorEditShowAnchors}
                    addMode={anchorEditAddMode}
                    transformMode={anchorEditTransformMode}
                    snapEnabled={anchorEditSnapEnabled}
                    snapPosStep={anchorClampNum(anchorEditSnapPosStep, 0.01)}
                    snapRotDeg={anchorClampNum(anchorEditSnapRotDeg, 5)}
                    onAddAnchorAt={anchorAddAt}
                    onSelectAnchor={(id) => setAnchorEditSelectedId(String(id || ''))}
                    onUpdateAnchorTransform={anchorUpdateTransform}
                  />
                </div>
              </div>
              <div className="min-h-0 overflow-hidden">
                <AnchorEditorPanel
                  cars={cars}
                  selectedCarId={anchorEditCarId}
                  onSelectCarId={(id) => setAnchorEditCarId(String(id || ''))}
                  modelUrl={anchorEditModelUrl}
                  onModelUrlChange={(v) => setAnchorEditModelUrl(String(v || '').trim())}
                  anchors={anchorEditAnchors}
                  selectedAnchorId={anchorEditSelectedId}
                  onSelectAnchorId={(id) => setAnchorEditSelectedId(String(id || ''))}
                  addMode={anchorEditAddMode}
                  onToggleAddMode={() =>
                    setAnchorEditAddMode((v) => {
                      const next = !v;
                      if (next) setAnchorEditShowAnchors(true);
                      return next;
                    })
                  }
                  transformMode={anchorEditTransformMode}
                  onTransformMode={(m) => setAnchorEditTransformMode(String(m || 'translate'))}
                  showAnchors={anchorEditShowAnchors}
                  onShowAnchors={(v) => setAnchorEditShowAnchors(Boolean(v))}
                  snapEnabled={anchorEditSnapEnabled}
                  onSnapEnabled={(v) => setAnchorEditSnapEnabled(Boolean(v))}
                  snapPosStep={anchorEditSnapPosStep}
                  onSnapPosStep={(v) => setAnchorEditSnapPosStep(String(v || ''))}
                  snapRotDeg={anchorEditSnapRotDeg}
                  onSnapRotDeg={(v) => setAnchorEditSnapRotDeg(String(v || ''))}
                  onCreateAnchor={anchorOnCreateAction}
                  onDeleteAnchor={anchorDeleteSelected}
                  onSaveAnchorsToDb={anchorSaveToDb}
                  onImportPreset={anchorImportPreset}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-900/70 text-zinc-200">
            <tr>
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  checked={cars.length > 0 && selectedCarIds.length === cars.length}
                  onChange={(e) => toggleAllCars(e.target.checked)}
                />
              </th>
              <th className="px-3 py-2">{t('admin_car_name_col')}</th>
              <th className="px-3 py-2">Brand</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">CC</th>
              <th className="px-3 py-2">Image</th>
              <th className="px-3 py-2">Model3D</th>
              <th className="w-28 px-3 py-2 text-right">{t('admin_actions')}</th>
            </tr>
          </thead>
          <tbody className="bg-zinc-950">
            {cars.map((c) => (
              <tr key={c._id} className="border-t border-zinc-800">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedCars[c._id])}
                    onChange={(e) => toggleOneCar(c._id, e.target.checked)}
                  />
                </td>
                <td className="px-3 py-2 text-zinc-100">{c.name}</td>
                <td className="px-3 py-2 text-zinc-300">{c.brand || '-'}</td>
                <td className="px-3 py-2 text-zinc-300">{c.category || '-'}</td>
                <td className="px-3 py-2 text-zinc-300">{Number.isFinite(c.engineCc) ? c.engineCc : c.engineCc || '-'}</td>
                <td className="px-3 py-2 text-zinc-300">
                  {c.image ? (
                    <a className="text-sky-300 hover:text-sky-200" href={c.image} target="_blank" rel="noreferrer">
                      open
                    </a>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="px-3 py-2 text-zinc-300">
                  {c.model3d ? (
                    <a className="text-sky-300 hover:text-sky-200" href={c.model3d} target="_blank" rel="noreferrer">
                      open
                    </a>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => openAnchorEditor(c)}
                      className="rounded bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-500 disabled:opacity-60"
                    >Anchors</button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => openEditCar(c)}
                      className="rounded bg-sky-600 px-3 py-1.5 text-xs text-white hover:bg-sky-500 disabled:opacity-60"
                    >{t('admin_edit_btn')}</button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => deleteOneCar(c._id)}
                      className="rounded bg-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-700 disabled:opacity-60"
                    >{t('admin_delete_btn')}</button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && cars.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-zinc-400">{t('admin_no_cars')}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      </section>
      ) : null}

      {activeSection === 'parts' ? (
      <section id="admin-parts" className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">{t('admin_parts_title')}</h2>
            <div className="mt-1 text-sm text-zinc-400">{t('admin_section_hint_parts')}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPartForm((v) => !v)}
              className="rounded bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700"
            >
              {showPartForm ? t('admin_hide_form') : t('admin_show_form')}
            </button>
          </div>
        </div>

      {showPartForm ? (
      <form onSubmit={onCreatePart} className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <div className="text-sm text-zinc-300">{t('admin_part_name')}</div>
            <input
              value={partForm.name}
              onChange={(e) => setPartForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
              placeholder="Wheels B / Bodykit B"
              required
            />
          </div>
          <div className="space-y-1">
            <div className="text-sm text-zinc-300">{t('admin_type_req')}</div>
            <select
              value={partForm.type}
              onChange={(e) => {
                const nextType = e.target.value;
                setPartForm((p) => stripDisallowedPartSpecs(p, nextType));
              }}
              className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            >
              <option value="exhaust">{t('part_exhaust')}</option>
              <option value="clutch">{t('part_clutch')}</option>
              <option value="wheels">{t('part_wheels')}</option>
              <option value="brake">{t('part_brake')}</option>
              <option value="suspension">{t('part_suspension')}</option>
              <option value="tire">{t('part_tire')}</option>
              <option value="handlebar">{t('part_handlebar')}</option>
              <option value="bodykit">{t('part_bodykit')}</option>
              <option value="seat">{t('part_seat')}</option>
              <option value="lighting">{t('part_lighting')}</option>
              <option value="throttle_housing">{t('part_throttle_housing')}</option>
              <option value="topbox">{t('part_topbox')}</option>
            </select>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-zinc-300">{t('admin_variant_key')}</div>
            <input
              value={partForm.variantKey}
              onChange={(e) => setPartForm((p) => ({ ...p, variantKey: e.target.value }))}
              className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
              placeholder="akrapovic / rizoma"
            />
          </div>
          <div className="space-y-1">
            <div className="text-sm text-zinc-300">Thumbnail URL</div>
            <input
              value={partForm.thumbnailUrl}
              onChange={(e) => setPartForm((p) => ({ ...p, thumbnailUrl: e.target.value }))}
              className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
              placeholder="https://...jpg"
            />
          </div>

          <div className="space-y-1">
            <div className="text-sm text-zinc-300">{t('admin_price')}</div>
            <input
              value={partForm.price}
              onChange={(e) => setPartForm((p) => ({ ...p, price: toDigitsOnly(e.target.value) }))}
              className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
              placeholder="1000000"
              inputMode="numeric"
            />
            {partForm.price ? <div className="text-xs text-zinc-400">{formatVnd(partForm.price)}</div> : null}
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
          <div className="mb-2 text-sm font-semibold text-zinc-200">{t('admin_bonus_specs')}</div>
          <div className="grid gap-3 md:grid-cols-4">
            {getAllowedPartSpecKeys(partForm.type).includes('powerHp') ? (
            <label className="block">
              <div className="mb-1 text-sm text-zinc-300">{t('admin_bonus_power')}</div>
              <input
                value={partForm.powerHp}
                onChange={(e) => setPartForm((p) => ({ ...p, powerHp: e.target.value }))}
                className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                inputMode="decimal"
                placeholder="VD: 5.5"
              />
            </label>
            ) : null}
            {getAllowedPartSpecKeys(partForm.type).includes('torqueNm') ? (
            <label className="block">
              <div className="mb-1 text-sm text-zinc-300">{t('admin_bonus_torque')}</div>
              <input
                value={partForm.torqueNm}
                onChange={(e) => setPartForm((p) => ({ ...p, torqueNm: e.target.value }))}
                className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                inputMode="decimal"
              />
            </label>
            ) : null}
            {getAllowedPartSpecKeys(partForm.type).includes('weightKg') ? (
            <label className="block">
              <div className="mb-1 text-sm text-zinc-300">{t('admin_bonus_weight')}</div>
              <input
                value={partForm.weightKg}
                onChange={(e) => setPartForm((p) => ({ ...p, weightKg: e.target.value }))}
                className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                inputMode="decimal"
                placeholder="VD: -2.5"
              />
            </label>
            ) : null}
            {getAllowedPartSpecKeys(partForm.type).includes('topSpeedKph') ? (
            <label className="block">
              <div className="mb-1 text-sm text-zinc-300">Max Speed (+Km/h)</div>
              <input
                value={partForm.topSpeedKph}
                onChange={(e) => setPartForm((p) => ({ ...p, topSpeedKph: e.target.value }))}
                className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                inputMode="decimal"
              />
            </label>
            ) : null}
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
          <div className="mb-2 text-sm font-semibold text-zinc-200">Hệ số khí thải</div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="block">
              <div className="mb-1 text-sm text-zinc-300">Hệ số CO</div>
              <input
                value={partForm.coMultiplier}
                onChange={(e) => setPartForm((p) => ({ ...p, coMultiplier: e.target.value }))}
                className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                inputMode="decimal"
                placeholder="VD: 2.5"
              />
            </label>
            <label className="block">
              <div className="mb-1 text-sm text-zinc-300">Hệ số HC</div>
              <input
                value={partForm.hcMultiplier}
                onChange={(e) => setPartForm((p) => ({ ...p, hcMultiplier: e.target.value }))}
                className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                inputMode="decimal"
                placeholder="VD: 2.0"
              />
            </label>
            {String(partForm.type || '').trim() === 'exhaust' ? (
              <label className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200">
                <input
                  type="checkbox"
                  checked={partForm.hasCatalytic !== false}
                  onChange={(e) => setPartForm((p) => ({ ...p, hasCatalytic: e.target.checked }))}
                  className="h-4 w-4"
                />
                Có catalytic converter
              </label>
            ) : (
              <div />
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-end gap-3">
          <button
            disabled={busy}
            className="rounded bg-sky-400 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-sky-300 disabled:opacity-60"
          >{t('admin_add_part_btn')}</button>
        </div>
        {partCreateError ? <div className="mt-2 text-sm text-red-400">{t('admin_error')}{partCreateError}</div> : null}
      </form>
      ) : null}

      {partEditOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
            <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
              <div className="text-lg font-semibold text-zinc-100">{t('admin_edit_part')}</div>
              <button
                type="button"
                disabled={busy}
                onClick={closeEditPart}
                className="rounded bg-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-700 disabled:opacity-60"
              >{t('admin_close')}</button>
            </div>

            <form id="part-edit-form" onSubmit={onUpdatePart} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block">
                  <div className="mb-1 text-sm text-zinc-300">{t('admin_part_name')}</div>
                  <input
                    value={partEditForm.name}
                    onChange={(e) => setPartEditForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                    required
                  />
                </label>
                <label className="block">
                  <div className="mb-1 text-sm text-zinc-300">{t('admin_type_req')}</div>
                  <select
                    value={partEditForm.type}
                    onChange={(e) => {
                      const nextType = e.target.value;
                      setPartEditForm((p) => stripDisallowedPartSpecs(p, nextType));
                    }}
                    className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                  >
                    <option value="exhaust">{t('part_exhaust')}</option>
                    <option value="clutch">{t('part_clutch')}</option>
                    <option value="wheels">{t('part_wheels')}</option>
                    <option value="brake">{t('part_brake')}</option>
                    <option value="suspension">{t('part_suspension')}</option>
                    <option value="tire">{t('part_tire')}</option>
                    <option value="handlebar">{t('part_handlebar')}</option>
                    <option value="bodykit">{t('part_bodykit')}</option>
                    <option value="seat">{t('part_seat')}</option>
                    <option value="lighting">{t('part_lighting')}</option>
                    <option value="throttle_housing">{t('part_throttle_housing')}</option>
                    <option value="topbox">{t('part_topbox')}</option>
                  </select>
                </label>
                <label className="block md:col-span-2">
                  <div className="mb-1 text-sm text-zinc-300">{t('admin_variant_key')}</div>
                  <input
                    value={partEditForm.variantKey}
                    onChange={(e) => setPartEditForm((p) => ({ ...p, variantKey: e.target.value }))}
                    className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                    placeholder="akrapovic / rizoma"
                  />
                </label>
                <label className="block md:col-span-2">
                  <div className="mb-1 text-sm text-zinc-300">Thumbnail URL</div>
                  <input
                    value={partEditForm.thumbnailUrl}
                    onChange={(e) => setPartEditForm((p) => ({ ...p, thumbnailUrl: e.target.value }))}
                    className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                    placeholder="https://...jpg"
                  />
                </label>
                <label className="block">
                  <div className="mb-1 text-sm text-zinc-300">{t('admin_price')}</div>
                  <input
                    value={partEditForm.price}
                    onChange={(e) => setPartEditForm((p) => ({ ...p, price: toDigitsOnly(e.target.value) }))}
                    className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                    inputMode="numeric"
                    placeholder="1000000"
                  />
                  {partEditForm.price ? <div className="mt-1 text-xs text-zinc-400">{formatVnd(partEditForm.price)}</div> : null}
                </label>
              </div>

              <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
                <div className="mb-2 text-sm font-semibold text-zinc-200">{t('admin_bonus_specs')}</div>
                <div className="grid gap-3 md:grid-cols-4">
                  {getAllowedPartSpecKeys(partEditForm.type).includes('powerHp') ? (
                  <label className="block">
                    <div className="mb-1 text-sm text-zinc-300">{t('admin_bonus_power')}</div>
                    <input
                      value={partEditForm.powerHp}
                      onChange={(e) => setPartEditForm((p) => ({ ...p, powerHp: e.target.value }))}
                      className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                      inputMode="decimal"
                      placeholder="VD: 5.5"
                    />
                  </label>
                  ) : null}
                  {getAllowedPartSpecKeys(partEditForm.type).includes('torqueNm') ? (
                  <label className="block">
                    <div className="mb-1 text-sm text-zinc-300">{t('admin_bonus_torque')}</div>
                    <input
                      value={partEditForm.torqueNm}
                      onChange={(e) => setPartEditForm((p) => ({ ...p, torqueNm: e.target.value }))}
                      className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                      inputMode="decimal"
                    />
                  </label>
                  ) : null}
                  {getAllowedPartSpecKeys(partEditForm.type).includes('weightKg') ? (
                  <label className="block">
                    <div className="mb-1 text-sm text-zinc-300">{t('admin_bonus_weight')}</div>
                    <input
                      value={partEditForm.weightKg}
                      onChange={(e) => setPartEditForm((p) => ({ ...p, weightKg: e.target.value }))}
                      className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                      inputMode="decimal"
                      placeholder="VD: -2.5"
                    />
                  </label>
                  ) : null}
                  {getAllowedPartSpecKeys(partEditForm.type).includes('topSpeedKph') ? (
                  <label className="block">
                    <div className="mb-1 text-sm text-zinc-300">Max Speed (+Km/h)</div>
                    <input
                      value={partEditForm.topSpeedKph}
                      onChange={(e) => setPartEditForm((p) => ({ ...p, topSpeedKph: e.target.value }))}
                      className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                      inputMode="decimal"
                    />
                  </label>
                  ) : null}
                </div>
              </div>

              <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
                <div className="mb-2 text-sm font-semibold text-zinc-200">Hệ số khí thải</div>
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="block">
                    <div className="mb-1 text-sm text-zinc-300">Hệ số CO</div>
                    <input
                      value={partEditForm.coMultiplier}
                      onChange={(e) => setPartEditForm((p) => ({ ...p, coMultiplier: e.target.value }))}
                      className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                      inputMode="decimal"
                      placeholder="VD: 2.5"
                    />
                  </label>
                  <label className="block">
                    <div className="mb-1 text-sm text-zinc-300">Hệ số HC</div>
                    <input
                      value={partEditForm.hcMultiplier}
                      onChange={(e) => setPartEditForm((p) => ({ ...p, hcMultiplier: e.target.value }))}
                      className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                      inputMode="decimal"
                      placeholder="VD: 2.0"
                    />
                  </label>
                  {String(partEditForm.type || '').trim() === 'exhaust' ? (
                    <label className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200">
                      <input
                        type="checkbox"
                        checked={partEditForm.hasCatalytic !== false}
                        onChange={(e) => setPartEditForm((p) => ({ ...p, hasCatalytic: e.target.checked }))}
                        className="h-4 w-4"
                      />
                      Có catalytic converter
                    </label>
                  ) : (
                    <div />
                  )}
                </div>
              </div>

              {partEditError ? <div className="text-sm text-red-400">{t('admin_error')}{partEditError}</div> : null}
            </form>

            <div className="flex items-center justify-end gap-2 border-t border-zinc-800 bg-zinc-950 px-4 py-3">
              <button
                type="button"
                disabled={busy}
                onClick={closeEditPart}
                className="rounded bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700 disabled:opacity-60"
              >{t('admin_cancel_btn')}</button>
              <button
                type="submit"
                form="part-edit-form"
                disabled={busy}
                className="rounded bg-sky-400 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-sky-300 disabled:opacity-60"
              >{t('admin_update_info')}</button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-lg border border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-900/70 text-zinc-200">
            <tr>
              <th className="px-3 py-2">{t('admin_name')}</th>
              <th className="px-3 py-2">{t('admin_type')}</th>
              <th className="px-3 py-2">Thumbnail</th>
              <th className="px-3 py-2">{t('admin_price')}</th>
              <th className="w-40 px-3 py-2 text-right">{t('admin_actions')}</th>
            </tr>
          </thead>
          <tbody className="bg-zinc-950">
            {parts.map((p) => (
              <tr key={p._id} className="border-t border-zinc-800">
                <td className="px-3 py-2 text-zinc-100">{p.name}</td>
                <td className="px-3 py-2 text-zinc-300">{p.type}</td>
                <td className="px-3 py-2 text-zinc-300">
                  {p.thumbnailUrl ? (
                    <a className="text-sky-300 hover:text-sky-200" href={p.thumbnailUrl} target="_blank" rel="noreferrer">
                      open
                    </a>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="px-3 py-2 text-zinc-300">{Number.isFinite(Number(p.price)) ? formatVnd(p.price) : '-'}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => openEditPart(p)}
                    className="mr-2 rounded bg-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-700 disabled:opacity-60"
                  >{t('admin_update_info')}</button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => deleteOnePart(p._id)}
                    className="rounded bg-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-700 disabled:opacity-60"
                  >{t('admin_delete_btn')}</button>
                </td>
              </tr>
            ))}
            {!loading && parts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-zinc-400">{t('admin_no_parts')}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      </section>
      ) : null}

      {activeSection === 'bgs' ? (
      <section id="admin-bgs" className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">{t('admin_bgs_title')}</h2>
            <div className="mt-1 text-sm text-zinc-400">{t('admin_section_hint_bgs')}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowBgForm((v) => !v)}
              className="rounded bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700"
            >
              {showBgForm ? t('admin_hide_form') : t('admin_show_form')}
            </button>
            <button
              disabled={!selectedBackgroundIds.length || busy}
              onClick={deleteSelectedBackgrounds}
              className="rounded bg-red-600 px-3 py-2 text-sm font-medium hover:bg-red-500 disabled:opacity-60"
            >
              {t('admin_delete_selected_bgs')}
            </button>
          </div>
        </div>

      {showBgForm ? (
      <form onSubmit={onCreateBackground} className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <div className="text-sm text-zinc-300">Key *</div>
            <input
              value={bgForm.key}
              onChange={(e) => setBgForm((p) => ({ ...p, key: e.target.value }))}
              className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
              placeholder="showroom-1 / studio-dark"
              required
            />
          </div>
          <div className="space-y-1">
            <div className="text-sm text-zinc-300">{t('admin_display_name')}</div>
            <input
              value={bgForm.label}
              onChange={(e) => setBgForm((p) => ({ ...p, label: e.target.value }))}
              className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
              placeholder="Showroom"
              required
            />
          </div>
          <div className="space-y-1">
            <div className="text-sm text-zinc-300">{t('admin_type_req')}</div>
            <select
              value={bgForm.kind}
              onChange={(e) => setBgForm((p) => ({ ...p, kind: e.target.value }))}
              className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            >
              <option value="image">{t('admin_bg_image_type')}</option>
              <option value="gradient">Gradient</option>
              <option value="color">{t('admin_bg_color_type')}</option>
            </select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <div className="text-sm text-zinc-300">{t('admin_bg_image_upload')}</div>
            <input
              value={bgForm.imageUrl}
              onChange={(e) => setBgForm((p) => ({ ...p, imageUrl: e.target.value }))}
              className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
              placeholder={t('admin_bg_url_placeholder')}
              disabled={bgForm.kind !== 'image'}
            />
            <div className="flex items-center justify-between gap-3 pt-1">
              <input
                type="file"
                accept=".png,.jpg,.jpeg,.webp"
                disabled={bgUploading || busy || bgForm.kind !== 'image'}
                onChange={(e) => onUploadBackgroundImage(e.target.files?.[0])}
                className="block w-full text-xs text-zinc-300 file:mr-3 file:rounded file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-xs file:text-zinc-100 hover:file:bg-zinc-700 disabled:opacity-60"
              />
            </div>
            {bgUploading ? <div className="text-xs text-zinc-400">{t('admin_uploading_image')}</div> : null}
            {bgUploadError ? <div className="text-xs text-red-400">{t('admin_upload_error')}{bgUploadError}</div> : null}
          </div>
          <div className="space-y-1">
            <div className="text-sm text-zinc-300">{t('admin_bg_color_type')}</div>
            <input
              type="color"
              value={bgForm.color}
              onChange={(e) => setBgForm((p) => ({ ...p, color: e.target.value }))}
              className="h-10 w-full cursor-pointer rounded bg-zinc-950"
              disabled={bgForm.kind !== 'color'}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <div className="text-sm text-zinc-300">CSS (gradient)</div>
            <input
              value={bgForm.css}
              onChange={(e) => setBgForm((p) => ({ ...p, css: e.target.value }))}
              className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
              placeholder="linear-gradient(180deg, #fff 0%, #eee 100%)"
              disabled={bgForm.kind !== 'gradient'}
            />
          </div>
          <div className="space-y-1">
            <div className="text-sm text-zinc-300">{t('admin_sort_order')}</div>
            <input
              value={bgForm.sortOrder}
              onChange={(e) => setBgForm((p) => ({ ...p, sortOrder: e.target.value }))}
              className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
              placeholder="0"
            />
          </div>
          <div className="flex items-end justify-end">
            <button
              disabled={busy}
              className="rounded bg-sky-400 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-sky-300 disabled:opacity-60"
            >{t('admin_add_bg_btn')}</button>
          </div>
        </div>
        {bgCreateError ? <div className="mt-2 text-sm text-red-400">{t('admin_error')}{bgCreateError}</div> : null}
      </form>
      ) : null}

      {bgEditOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
            <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
              <div className="text-lg font-semibold text-zinc-100">{t('admin_edit_bg')}</div>
              <button
                type="button"
                disabled={busy || bgEditUploading}
                onClick={closeEditBackground}
                className="rounded bg-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-700 disabled:opacity-60"
              >{t('admin_close')}</button>
            </div>

            <form id="bg-edit-form" onSubmit={onUpdateBackground} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <div className="text-sm text-zinc-300">Key</div>
                  <input
                    value={bgEditForm.key}
                    disabled
                    className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-400"
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <div className="text-sm text-zinc-300">{t('admin_display_name')}</div>
                  <input
                    value={bgEditForm.label}
                    onChange={(e) => setBgEditForm((p) => ({ ...p, label: e.target.value }))}
                    className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-zinc-300">{t('admin_type_req')}</div>
                  <select
                    value={bgEditForm.kind}
                    onChange={(e) => setBgEditForm((p) => ({ ...p, kind: e.target.value }))}
                    className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                  >
                    <option value="image">{t('admin_bg_image_type')}</option>
                    <option value="gradient">Gradient</option>
                    <option value="color">{t('admin_bg_color_type')}</option>
                  </select>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <div className="text-sm text-zinc-300">{t('admin_bg_image_upload')}</div>
                  <input
                    value={bgEditForm.imageUrl}
                    onChange={(e) => setBgEditForm((p) => ({ ...p, imageUrl: e.target.value }))}
                    className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                    placeholder={t('admin_bg_url_placeholder')}
                    disabled={bgEditForm.kind !== 'image'}
                  />
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <input
                      type="file"
                      accept=".png,.jpg,.jpeg,.webp"
                      disabled={bgEditUploading || busy || bgEditForm.kind !== 'image'}
                      onChange={(e) => onUploadBackgroundImageEdit(e.target.files?.[0])}
                      className="block w-full text-xs text-zinc-300 file:mr-3 file:rounded file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-xs file:text-zinc-100 hover:file:bg-zinc-700 disabled:opacity-60"
                    />
                  </div>
                  {bgEditUploading ? <div className="text-xs text-zinc-400">{t('admin_uploading_image')}</div> : null}
                  {bgEditUploadError ? <div className="text-xs text-red-400">{t('admin_upload_error')}{bgEditUploadError}</div> : null}
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-zinc-300">{t('admin_bg_color_type')}</div>
                  <input
                    type="color"
                    value={bgEditForm.color}
                    onChange={(e) => setBgEditForm((p) => ({ ...p, color: e.target.value }))}
                    className="h-10 w-full cursor-pointer rounded bg-zinc-950"
                    disabled={bgEditForm.kind !== 'color'}
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <div className="text-sm text-zinc-300">CSS (gradient)</div>
                  <input
                    value={bgEditForm.css}
                    onChange={(e) => setBgEditForm((p) => ({ ...p, css: e.target.value }))}
                    className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                    placeholder="linear-gradient(180deg, #fff 0%, #eee 100%)"
                    disabled={bgEditForm.kind !== 'gradient'}
                  />
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-zinc-300">{t('admin_sort_order')}</div>
                  <input
                    value={bgEditForm.sortOrder}
                    onChange={(e) => setBgEditForm((p) => ({ ...p, sortOrder: e.target.value }))}
                    className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                    placeholder="0"
                  />
                </div>
                <label className="flex items-center gap-2 pt-7 text-sm text-zinc-200">
                  <input
                    type="checkbox"
                    checked={Boolean(bgEditForm.enabled)}
                    onChange={(e) => setBgEditForm((p) => ({ ...p, enabled: e.target.checked }))}
                  />
                  <span>{t('admin_enabled')}</span>
                </label>
              </div>

              {bgEditError ? <div className="text-sm text-red-400">{t('admin_error')}{bgEditError}</div> : null}
            </form>

            <div className="flex items-center justify-end gap-2 border-t border-zinc-800 bg-zinc-950 px-4 py-3">
              <button
                type="button"
                disabled={busy || bgEditUploading}
                onClick={closeEditBackground}
                className="rounded bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700 disabled:opacity-60"
              >{t('admin_cancel_btn')}</button>
              <button
                type="submit"
                form="bg-edit-form"
                disabled={busy || bgEditUploading}
                className="rounded bg-sky-400 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-sky-300 disabled:opacity-60"
              >{t('admin_update_info')}</button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-lg border border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-900/70 text-zinc-200">
            <tr>
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  checked={backgrounds.length > 0 && selectedBackgroundIds.length === backgrounds.length}
                  onChange={(e) => toggleAllBackgrounds(e.target.checked)}
                />
              </th>
              <th className="w-14 px-3 py-2">Xem</th>
              <th className="px-3 py-2">Key</th>
              <th className="px-3 py-2">{t('admin_name')}</th>
              <th className="px-3 py-2">{t('admin_type')}</th>
              <th className="px-3 py-2">{t('admin_source')}</th>
              <th className="w-40 px-3 py-2 text-right">{t('admin_actions')}</th>
            </tr>
          </thead>
          <tbody className="bg-zinc-950">
            {backgrounds.map((b) => {
              const kind = String(b.kind || '');
              const style =
                kind === 'image'
                  ? {
                      backgroundColor: '#0b0b0b',
                      backgroundImage: b.imageUrl ? `url('${resolveAssetUrl(b.imageUrl)}')` : undefined,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'center',
                      backgroundSize: 'cover'
                    }
                  : kind === 'gradient'
                    ? { background: String(b.css || '') }
                    : { background: String(b.color || '#e6e6e2') };
              const src =
                kind === 'image'
                  ? b.imageUrl
                  : kind === 'gradient'
                    ? String(b.css || '').slice(0, 60)
                    : String(b.color || '');
              return (
                <tr key={b._id} className="border-t border-zinc-800">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedBackgrounds[b._id])}
                      onChange={(e) => toggleOneBackground(b._id, e.target.checked)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="h-8 w-10 rounded border border-zinc-800" style={style} />
                  </td>
                  <td className="px-3 py-2 text-zinc-100">{b.key}</td>
                  <td className="px-3 py-2 text-zinc-100">{b.label}</td>
                  <td className="px-3 py-2 text-zinc-300">{b.kind}</td>
                  <td className="px-3 py-2 text-zinc-300">
                    {kind === 'image' && b.imageUrl ? (
                      <a className="text-sky-300 hover:text-sky-200" href={resolveAssetUrl(b.imageUrl)} target="_blank" rel="noreferrer">
                        open
                      </a>
                    ) : (
                      <span className="text-xs text-zinc-400">{src || '-'}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => openEditBackground(b)}
                      className="mr-2 rounded bg-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-700 disabled:opacity-60"
                    >{t('admin_update_info')}</button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => deleteOneBackground(b._id)}
                      className="rounded bg-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-700 disabled:opacity-60"
                    >{t('admin_delete_btn')}</button>
                  </td>
                </tr>
              );
            })}
            {!loading && backgrounds.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-zinc-400">{t('admin_no_bgs')}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      </section>
      ) : null}

      {activeSection === 'hero' ? (
      <section id="admin-hero" className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">{t('admin_hero_title')}</h2>
            <div className="mt-1 text-sm text-zinc-400">{t('admin_section_hint_hero')}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setHeroScope('landing')}
              disabled={heroBusy}
              className={`rounded px-3 py-2 text-sm font-medium disabled:opacity-60 ${
                heroScope === 'landing' ? 'bg-sky-400 text-zinc-950' : 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700'
              }`}
            >
              {t('admin_hero_scope_landing')}
            </button>
            <button
              type="button"
              onClick={() => setHeroScope('dashboard')}
              disabled={heroBusy}
              className={`rounded px-3 py-2 text-sm font-medium disabled:opacity-60 ${
                heroScope === 'dashboard' ? 'bg-sky-400 text-zinc-950' : 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700'
              }`}
            >
              {t('admin_hero_scope_dashboard')}
            </button>
            <label className="rounded bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                disabled={heroBusy}
                className="hidden"
                onChange={(e) => onUploadHero(e.target.files)}
              />
              {t('admin_hero_upload_btn')}
            </label>
            <button
              type="button"
              onClick={onResetHero}
              disabled={heroBusy}
              className="rounded bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700 disabled:opacity-60"
            >
              {t('admin_hero_reset_btn')}
            </button>
          </div>
        </div>

        {heroError ? (
          <div className="mt-4 rounded-lg border border-red-900/40 bg-red-950/30 p-3 text-sm text-red-200">{heroError}</div>
        ) : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {Array.from(
            { length: 3 },
            (_, i) => String((heroScope === 'dashboard' ? heroDashboardImages : heroLandingImages)?.[i] || '')
          ).map((url, idx) => (
            <div key={idx} className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
              <div className="aspect-[16/10] bg-black">
                {url ? <img src={resolveApiUrl(url)} alt="" className="h-full w-full object-cover" /> : null}
              </div>
              <div className="p-3">
                <div className="truncate text-xs text-zinc-400">{url || t('admin_hero_empty')}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
      ) : null}

      {activeSection === 'users' ? (
      <section id="admin-users" className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">{t('admin_users_title')}</h2>
            <div className="mt-1 text-sm text-zinc-400">{t('admin_section_hint_users')}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="w-72 rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
              placeholder={t('admin_users_search')}
            />
            <select
              value={userRoleFilter}
              onChange={(e) => setUserRoleFilter(e.target.value)}
              className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            >
              <option value="">{t('admin_role')}</option>
              <option value="USER">USER</option>
              <option value="VENDOR">VENDOR</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </div>
        </div>

        {userEditOpen ? (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
            <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
              <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
                <div className="text-lg font-semibold text-zinc-100">{t('admin_edit_user')}</div>
                <button
                  type="button"
                  disabled={userBusyId === String(userEditId)}
                  onClick={closeEditUser}
                  className="rounded bg-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-700 disabled:opacity-60"
                >{t('admin_close')}</button>
              </div>

              <form id="user-edit-form" onSubmit={onSaveUserEdit} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <div className="mb-1 text-sm text-zinc-300">{t('admin_user_name')}</div>
                    <input
                      value={filteredUsers.find((x) => String(x._id) === String(userEditId))?.name || ''}
                      disabled
                      className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-400"
                    />
                  </label>
                  <label className="block">
                    <div className="mb-1 text-sm text-zinc-300">{t('admin_email')}</div>
                    <input
                      value={filteredUsers.find((x) => String(x._id) === String(userEditId))?.email || ''}
                      disabled
                      className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-400"
                    />
                  </label>
                  <label className="block">
                    <div className="mb-1 text-sm text-zinc-300">{t('admin_role')}</div>
                    <select
                      value={userEditRole}
                      disabled={userBusyId === String(userEditId)}
                      onChange={(e) => setUserEditRole(e.target.value)}
                      className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 disabled:opacity-60"
                    >
                      <option value="USER">USER</option>
                      <option value="VENDOR">VENDOR</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2 pt-7 text-sm text-zinc-200">
                    <input
                      type="checkbox"
                      checked={Boolean(userEditVerified)}
                      disabled={userBusyId === String(userEditId)}
                      onChange={(e) => setUserEditVerified(e.target.checked)}
                    />
                    <span>{t('admin_verified')}</span>
                  </label>
                </div>
                {userEditError ? <div className="text-sm text-red-400">{t('admin_error')}{userEditError}</div> : null}
              </form>

              <div className="flex items-center justify-end gap-2 border-t border-zinc-800 bg-zinc-950 px-4 py-3">
                <button
                  type="button"
                  disabled={userBusyId === String(userEditId)}
                  onClick={closeEditUser}
                  className="rounded bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700 disabled:opacity-60"
                >{t('admin_cancel_btn')}</button>
                <button
                  type="submit"
                  form="user-edit-form"
                  disabled={userBusyId === String(userEditId)}
                  className="rounded bg-sky-400 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-sky-300 disabled:opacity-60"
                >{t('admin_update_info')}</button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-4 overflow-hidden rounded-lg border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900/70 text-zinc-200">
              <tr>
                <th className="px-3 py-2">{t('admin_user_name')}</th>
                <th className="px-3 py-2">{t('admin_email')}</th>
                <th className="px-3 py-2">{t('admin_phone')}</th>
                <th className="px-3 py-2">{t('admin_provider')}</th>
                <th className="px-3 py-2">{t('admin_role')}</th>
                <th className="px-3 py-2">{t('admin_vendor')}</th>
                <th className="px-3 py-2">{t('admin_verified')}</th>
                <th className="px-3 py-2">{t('admin_created_at')}</th>
                <th className="w-40 px-3 py-2 text-right">{t('admin_actions')}</th>
              </tr>
            </thead>
            <tbody className="bg-zinc-950">
              {filteredUsers.map((u) => {
                const vendorStatus = u?.vendor?.status ? String(u.vendor.status) : '';
                return (
                  <tr key={u._id} className="border-t border-zinc-800">
                    <td className="px-3 py-2 text-zinc-100">{u.name || '-'}</td>
                    <td className="px-3 py-2 text-zinc-100">{u.email || '-'}</td>
                    <td className="px-3 py-2 text-zinc-300">{u.phone || '-'}</td>
                    <td className="px-3 py-2 text-zinc-300">{u.provider || 'local'}</td>
                    <td className="px-3 py-2">
                      <select
                        value={String(u.role || 'USER').toUpperCase()}
                        disabled={userBusyId === String(u._id)}
                        onChange={(e) => onUpdateUser(u._id, { role: e.target.value })}
                        className="rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 disabled:opacity-60"
                      >
                        <option value="USER">USER</option>
                        <option value="VENDOR">VENDOR</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    </td>
                    <td className="px-3 py-2 text-zinc-300">
                      {u.vendor ? (
                        <span className={`inline-flex items-center rounded px-2 py-1 text-xs ${
                          vendorStatus === 'approved'
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : vendorStatus === 'rejected'
                              ? 'bg-red-500/15 text-red-300'
                              : 'bg-amber-500/15 text-amber-300'
                        }`}>
                          {vendorStatus || 'pending'}{u.vendor?.shopName ? ` • ${u.vendor.shopName}` : ''}
                        </span>
                      ) : (
                        <span className="text-zinc-500">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <label className="inline-flex items-center gap-2 text-zinc-300">
                        <input
                          type="checkbox"
                          checked={Boolean(u.emailVerified)}
                          disabled={userBusyId === String(u._id)}
                          onChange={(e) => onUpdateUser(u._id, { emailVerified: e.target.checked })}
                        />
                        <span className="text-xs">{Boolean(u.emailVerified) ? 'yes' : 'no'}</span>
                      </label>
                    </td>
                    <td className="px-3 py-2 text-zinc-300">{formatDate(u.createdAt)}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        disabled={userBusyId === String(u._id)}
                        onClick={() => openEditUser(u)}
                        className="mr-2 rounded bg-zinc-800 px-3 py-1.5 text-xs text-zinc-100 hover:bg-zinc-700 disabled:opacity-60"
                      >
                        {t('admin_update_info')}
                      </button>
                      <button
                        type="button"
                        disabled={userBusyId === String(u._id)}
                        onClick={() => onDeleteUser(u._id)}
                        className="rounded bg-red-600 px-3 py-1.5 text-xs hover:bg-red-500 disabled:opacity-60"
                      >
                        {t('admin_delete_btn')}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!loading && filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-zinc-400">{t('admin_no_rows')}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
      ) : null}
    </div>
  );
};

export default AdminCars;
