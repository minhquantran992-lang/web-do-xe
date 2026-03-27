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
  deleteAdminBrand,
  deleteAdminBackground,
  deleteAdminPart,
  getAdminBrands,
  getAdminBackgrounds,
  getAdminCars,
  getAdminParts,
  uploadAdminCarModel,
  uploadAdminBackgroundImage,
  uploadAdminPartModel,
  uploadAdminBrandLogo,
  updateAdminBrand,
  importAdminBrandLogoFromUrl
} from '../services/api/adminCars.js';

const AdminCars = () => {
  const { token, isAuthed } = useAuth();
  const { t } = useI18n();

  const [cars, setCars] = useState([]);
  const [selectedCars, setSelectedCars] = useState({});
  const [parts, setParts] = useState([]);
  const [selectedParts, setSelectedParts] = useState({});
  const [brands, setBrands] = useState([]);
  const [selectedBrands, setSelectedBrands] = useState({});
  const [backgrounds, setBackgrounds] = useState([]);
  const [selectedBackgrounds, setSelectedBackgrounds] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [carForm, setCarForm] = useState({ name: '', brand: '', category: '', engineCc: '', image: '', model3d: '' });
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
    powerHp: '',
    torqueNm: '',
    weightKg: '',
    topSpeedKph: '',
    fuelL: '',
    engineType: '',
    gearbox: ''
  });

  const [partForm, setPartForm] = useState({ 
    name: '', 
    type: 'wheels', 
    thumbnailUrl: '', 
    modelUrl: '', 
    mountPoint: '', 
    price: '',
    powerHp: '',
    torqueNm: '',
    weightKg: '',
    topSpeedKph: ''
  });
  const [partCreateError, setPartCreateError] = useState('');
  const [partUploading, setPartUploading] = useState(false);
  const [partUploadError, setPartUploadError] = useState('');

  const selectedCarIds = useMemo(() => Object.keys(selectedCars).filter((k) => selectedCars[k]), [selectedCars]);
  const selectedPartIds = useMemo(() => Object.keys(selectedParts).filter((k) => selectedParts[k]), [selectedParts]);
  const selectedBrandIds = useMemo(() => Object.keys(selectedBrands).filter((k) => selectedBrands[k]), [selectedBrands]);
  const selectedBackgroundIds = useMemo(
    () => Object.keys(selectedBackgrounds).filter((k) => selectedBackgrounds[k]),
    [selectedBackgrounds]
  );

  const [brandName, setBrandName] = useState('');
  const [brandVehicleType, setBrandVehicleType] = useState('pkl');
  const [brandError, setBrandError] = useState('');
  const [brandLogoUrl, setBrandLogoUrl] = useState('');
  const [brandLogoUploading, setBrandLogoUploading] = useState(false);
  const [brandLogoUploadError, setBrandLogoUploadError] = useState('');

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

  const load = async () => {
    setLoading(true);
    setError('');
    setForbidden(false);
    try {
      const [carItems, partItems, brandItems, bgItems] = await Promise.all([
        getAdminCars({ token }),
        getAdminParts({ token }),
        getAdminBrands({ token }),
        getAdminBackgrounds({ token })
      ]);
      setCars(carItems);
      setParts(partItems);
      setBrands(brandItems);
      setBackgrounds(bgItems);
      setSelectedCars({});
      setSelectedParts({});
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
      await createAdminCar({
        token,
        payload: {
          name: carForm.name,
          brand: carForm.brand,
          category: carForm.category,
          engineCc: carForm.engineCc === '' ? null : Number(carForm.engineCc),
          image: carForm.image,
          model3d: carForm.model3d
        }
      });
      setCarForm({ name: '', brand: '', category: '', engineCc: '', image: '', model3d: '' });
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
    setCarEditError('');
    setCarEditId(String(car?._id || ''));
    setCarEditForm({
      name: String(car?.name || ''),
      brand: String(car?.brand || ''),
      category: String(car?.category || ''),
      engineCc: car?.engineCc === null || car?.engineCc === undefined ? '' : String(car.engineCc),
      image: String(car?.image || ''),
      model3d: String(car?.model3d || ''),
      powerHp: s?.powerHp === null || s?.powerHp === undefined ? '' : String(s.powerHp),
      torqueNm: s?.torqueNm === null || s?.torqueNm === undefined ? '' : String(s.torqueNm),
      weightKg: s?.weightKg === null || s?.weightKg === undefined ? '' : String(s.weightKg),
      topSpeedKph: s?.topSpeedKph === null || s?.topSpeedKph === undefined ? '' : String(s.topSpeedKph),
      fuelL: s?.fuelL === null || s?.fuelL === undefined ? '' : String(s.fuelL),
      engineType: String(s?.engineType || ''),
      gearbox: String(s?.gearbox || '')
    });
    setCarEditOpen(true);
  };

  const closeEditCar = () => {
    setCarEditOpen(false);
    setCarEditId('');
    setCarEditError('');
  };

  const onUpdateCar = async (e) => {
    e.preventDefault();
    if (!carEditId) return;
    setCarEditError('');
    setBusy(true);
    try {
      const toNumOrNull = (v) => {
        if (v === '' || v === null || v === undefined) return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      };
      await updateAdminCar({
        token,
        id: carEditId,
        payload: {
          name: carEditForm.name,
          brand: carEditForm.brand,
          category: carEditForm.category,
          engineCc: toNumOrNull(carEditForm.engineCc),
          image: carEditForm.image,
          model3d: carEditForm.model3d,
          specs: {
            powerHp: toNumOrNull(carEditForm.powerHp),
            torqueNm: toNumOrNull(carEditForm.torqueNm),
            weightKg: toNumOrNull(carEditForm.weightKg),
            topSpeedKph: toNumOrNull(carEditForm.topSpeedKph),
            fuelL: toNumOrNull(carEditForm.fuelL),
            engineType: carEditForm.engineType,
            gearbox: carEditForm.gearbox
          }
        }
      });
      closeEditCar();
      await load();
    } catch (e2) {
      setCarEditError(e2?.message || 'UPDATE_FAILED');
    } finally {
      setBusy(false);
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

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
  const resolveAssetUrl = (url) => {
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
      const toNumOrNull = (v) => {
        if (v === '' || v === null || v === undefined) return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      };

      await createAdminPart({
        token,
        payload: {
          name: partForm.name,
          type: partForm.type,
          thumbnailUrl: partForm.thumbnailUrl,
          modelUrl: partForm.modelUrl,
          mountPoint: partForm.mountPoint,
          price: partForm.price,
          specs: {
            powerHp: toNumOrNull(partForm.powerHp),
            torqueNm: toNumOrNull(partForm.torqueNm),
            weightKg: toNumOrNull(partForm.weightKg),
            topSpeedKph: toNumOrNull(partForm.topSpeedKph)
          }
        }
      });
      setPartForm({ 
        name: '', type: 'wheels', thumbnailUrl: '', modelUrl: '', mountPoint: '', price: '',
        powerHp: '', torqueNm: '', weightKg: '', topSpeedKph: ''
      });
      await load();
    } catch (err) {
      setPartCreateError(err?.message || 'CREATE_FAILED');
    } finally {
      setBusy(false);
    }
  };

  const onUploadPartModel = async (file) => {
    if (!file) return;
    setPartUploadError('');
    setPartUploading(true);
    try {
      const data = await uploadAdminPartModel({ token, file });
      setPartForm((p) => ({ ...p, modelUrl: data?.url || '' }));
    } catch (e) {
      setPartUploadError(e?.message || 'UPLOAD_FAILED');
    } finally {
      setPartUploading(false);
    }
  };

  const toggleAllParts = (checked) => {
    const next = {};
    for (const p of parts) next[p._id] = checked;
    setSelectedParts(next);
  };

  const toggleOnePart = (id, checked) => {
    setSelectedParts((prev) => ({ ...prev, [id]: checked }));
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

  const deleteSelectedParts = async () => {
    if (!selectedPartIds.length) return;
    if (!confirm(t('admin_delete_parts_confirm').replace('{count}', selectedPartIds.length))) return;
    setBusy(true);
    setError('');
    try {
      await Promise.all(selectedPartIds.map((id) => deleteAdminPart({ token, id })));
      await load();
    } catch (e) {
      setError(e?.message || 'DELETE_FAILED');
    } finally {
      setBusy(false);
    }
  };

  if (!isAuthed) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5">
        <div className="text-zinc-300">{t('admin_login_req')}</div>
        <div className="mt-3">
          <Link to="/login" className="rounded bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500">{t('nav_login')}</Link>
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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{t('admin_cars_title')}</h1>
        <button
          disabled={!selectedCarIds.length || busy}
          onClick={deleteSelectedCars}
          className="rounded bg-red-600 px-3 py-2 text-sm font-medium hover:bg-red-500 disabled:opacity-60"
        >{t('admin_delete_selected_cars')}</button>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t('admin_brands_title')}</h2>
        <button
          disabled={!selectedBrandIds.length || busy}
          onClick={deleteSelectedBrands}
          className="rounded bg-red-600 px-3 py-2 text-sm font-medium hover:bg-red-500 disabled:opacity-60"
        >{t('admin_delete_selected_brands')}</button>
      </div>

      <form onSubmit={onCreateBrand} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
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
              className="rounded bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-60"
            >{t('admin_add_brand_btn')}</button>
          </div>
        </div>
        {brandError ? <div className="mt-2 text-sm text-red-400">{t('admin_error')}{brandError}</div> : null}
      </form>

      <div className="overflow-hidden rounded-lg border border-zinc-800">
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
              <th className="w-28 px-3 py-2 text-right">{t('admin_actions')}</th>
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

      <form onSubmit={onCreateCar} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
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

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="text-xs text-zinc-400">{t('admin_model_hint')}</div>
          <button
            disabled={busy}
            className="rounded bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-60"
          >{t('admin_add_car_btn')}</button>
        </div>
        {carCreateError ? <div className="mt-2 text-sm text-red-400">{t('admin_error')}{carCreateError}</div> : null}
      </form>

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
                  <input
                    value={carEditForm.category}
                    onChange={(e) => setCarEditForm((p) => ({ ...p, category: e.target.value }))}
                    className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                  />
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
                className="rounded bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-60"
              >{t('admin_update_info')}</button>
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
                    <a className="text-emerald-400 hover:text-emerald-300" href={c.image} target="_blank" rel="noreferrer">
                      open
                    </a>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="px-3 py-2 text-zinc-300">
                  {c.model3d ? (
                    <a className="text-emerald-400 hover:text-emerald-300" href={c.model3d} target="_blank" rel="noreferrer">
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

      <div className="mt-8 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t('admin_parts_title')}</h2>
        <button
          disabled={!selectedPartIds.length || busy}
          onClick={deleteSelectedParts}
          className="rounded bg-red-600 px-3 py-2 text-sm font-medium hover:bg-red-500 disabled:opacity-60"
        >{t('admin_delete_selected_parts')}</button>
      </div>

      <form onSubmit={onCreatePart} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
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
              onChange={(e) => setPartForm((p) => ({ ...p, type: e.target.value }))}
              className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            >
              <option value="exhaust">Exhaust</option>
              <option value="clutch">Clutch</option>
              <option value="wheels">Wheels</option>
              <option value="brake">Brake</option>
              <option value="suspension">Suspension</option>
              <option value="tire">Tire</option>
              <option value="handlebar">Handlebar</option>
              <option value="bodykit">Bodykit</option>
              <option value="seat">Seat</option>
              <option value="lighting">Lighting</option>
              <option value="throttle_housing">Throttle housing</option>
            </select>
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
            <div className="text-sm text-zinc-300">Model URL (.glb/.gltf) *</div>
            <input
              value={partForm.modelUrl}
              onChange={(e) => setPartForm((p) => ({ ...p, modelUrl: e.target.value }))}
              className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
              placeholder={t('admin_model_url_placeholder')}
              required
            />
            <div className="flex items-center justify-between gap-3 pt-1">
              <input
                type="file"
                accept=".glb,.gltf"
                disabled={partUploading || busy}
                onChange={(e) => onUploadPartModel(e.target.files?.[0])}
                className="block w-full text-xs text-zinc-300 file:mr-3 file:rounded file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-xs file:text-zinc-100 hover:file:bg-zinc-700 disabled:opacity-60"
              />
            </div>
            {partUploading ? <div className="text-xs text-zinc-400">{t('admin_uploading_model')}</div> : null}
            {partUploadError ? <div className="text-xs text-red-400">{t('admin_upload_error')}{partUploadError}</div> : null}
          </div>

          <div className="space-y-1">
            <div className="text-sm text-zinc-300">Mount point</div>
            <input
              value={partForm.mountPoint}
              onChange={(e) => setPartForm((p) => ({ ...p, mountPoint: e.target.value }))}
              className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
              placeholder="exhaust_mount / front_wheel_mount / seat_mount ..."
            />
          </div>

          <div className="space-y-1">
            <div className="text-sm text-zinc-300">Price</div>
            <input
              value={partForm.price}
              onChange={(e) => setPartForm((p) => ({ ...p, price: e.target.value }))}
              className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
              placeholder="350"
              inputMode="numeric"
            />
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
          <div className="mb-2 text-sm font-semibold text-zinc-200">{t('admin_bonus_specs')}</div>
          <div className="grid gap-3 md:grid-cols-4">
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
            <label className="block">
              <div className="mb-1 text-sm text-zinc-300">{t('admin_bonus_torque')}</div>
              <input
                value={partForm.torqueNm}
                onChange={(e) => setPartForm((p) => ({ ...p, torqueNm: e.target.value }))}
                className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                inputMode="decimal"
              />
            </label>
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
            <label className="block">
              <div className="mb-1 text-sm text-zinc-300">Max Speed (+Km/h)</div>
              <input
                value={partForm.topSpeedKph}
                onChange={(e) => setPartForm((p) => ({ ...p, topSpeedKph: e.target.value }))}
                className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                inputMode="decimal"
              />
            </label>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-end gap-3">
          <button
            disabled={busy}
            className="rounded bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-60"
          >{t('admin_add_part_btn')}</button>
        </div>
        {partCreateError ? <div className="mt-2 text-sm text-red-400">{t('admin_error')}{partCreateError}</div> : null}
      </form>

      <div className="overflow-hidden rounded-lg border border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-900/70 text-zinc-200">
            <tr>
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  checked={parts.length > 0 && selectedPartIds.length === parts.length}
                  onChange={(e) => toggleAllParts(e.target.checked)}
                />
              </th>
              <th className="px-3 py-2">{t('admin_name')}</th>
              <th className="px-3 py-2">{t('admin_type')}</th>
              <th className="px-3 py-2">Thumbnail</th>
              <th className="px-3 py-2">Model</th>
              <th className="px-3 py-2">Mount</th>
              <th className="px-3 py-2">Price</th>
              <th className="w-28 px-3 py-2 text-right">{t('admin_actions')}</th>
            </tr>
          </thead>
          <tbody className="bg-zinc-950">
            {parts.map((p) => (
              <tr key={p._id} className="border-t border-zinc-800">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedParts[p._id])}
                    onChange={(e) => toggleOnePart(p._id, e.target.checked)}
                  />
                </td>
                <td className="px-3 py-2 text-zinc-100">{p.name}</td>
                <td className="px-3 py-2 text-zinc-300">{p.type}</td>
                <td className="px-3 py-2 text-zinc-300">
                  {p.thumbnailUrl ? (
                    <a className="text-emerald-400 hover:text-emerald-300" href={p.thumbnailUrl} target="_blank" rel="noreferrer">
                      open
                    </a>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="px-3 py-2 text-zinc-300">
                  {p.modelUrl ? (
                    <a className="text-emerald-400 hover:text-emerald-300" href={p.modelUrl} target="_blank" rel="noreferrer">
                      open
                    </a>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="px-3 py-2 text-zinc-300">{p.mountPoint || '-'}</td>
                <td className="px-3 py-2 text-zinc-300">{Number.isFinite(Number(p.price)) ? Number(p.price) : '-'}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    disabled={busy}
                    onClick={() => deleteOnePart(p._id)}
                    className="rounded bg-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-700 disabled:opacity-60"
                  >{t('admin_delete_btn')}</button>
                </td>
              </tr>
            ))}
            {!loading && parts.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-zinc-400">{t('admin_no_parts')}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t('admin_bgs_title')}</h2>
        <button
          disabled={!selectedBackgroundIds.length || busy}
          onClick={deleteSelectedBackgrounds}
          className="rounded bg-red-600 px-3 py-2 text-sm font-medium hover:bg-red-500 disabled:opacity-60"
        >{t('admin_delete_selected_bgs')}</button>
      </div>

      <form onSubmit={onCreateBackground} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
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
              className="rounded bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-60"
            >{t('admin_add_bg_btn')}</button>
          </div>
        </div>
        {bgCreateError ? <div className="mt-2 text-sm text-red-400">{t('admin_error')}{bgCreateError}</div> : null}
      </form>

      <div className="overflow-hidden rounded-lg border border-zinc-800">
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
              <th className="w-28 px-3 py-2 text-right">{t('admin_actions')}</th>
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
                      <a className="text-emerald-400 hover:text-emerald-300" href={resolveAssetUrl(b.imageUrl)} target="_blank" rel="noreferrer">
                        open
                      </a>
                    ) : (
                      <span className="text-xs text-zinc-400">{src || '-'}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
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
    </div>
  );
};

export default AdminCars;
