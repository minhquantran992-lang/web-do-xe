import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AnchorEditorCanvas from '../editor/anchors/AnchorEditorCanvas.jsx';
import AnchorEditorPanel from '../editor/anchors/AnchorEditorPanel.jsx';
import { parseAnchorsFromDb, serializeAnchorsForDb } from '../editor/anchors/anchorUtils.js';
import { getAdminCars, updateAdminCar } from '../services/api/adminCars.js';
import { useAuth } from '../services/auth/AuthContext.jsx';

const clampNum = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const makeId = () => `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const AdminAnchorEditor = () => {
  const { token } = useAuth();
  const params = useParams();
  const navigate = useNavigate();
  const carIdFromPath = String(params?.carId || '').trim();

  const [cars, setCars] = useState([]);
  const [loadingCars, setLoadingCars] = useState(true);
  const [error, setError] = useState('');

  const [selectedCarId, setSelectedCarId] = useState(carIdFromPath);
  const [modelUrl, setModelUrl] = useState('');

  const [anchors, setAnchors] = useState([]);
  const [selectedAnchorId, setSelectedAnchorId] = useState('');
  const [addMode, setAddMode] = useState(false);
  const [transformMode, setTransformMode] = useState('translate');
  const [showAnchors, setShowAnchors] = useState(true);

  const [snapEnabled, setSnapEnabled] = useState(false);
  const [snapPosStep, setSnapPosStep] = useState('0.01');
  const [snapRotDeg, setSnapRotDeg] = useState('5');

  useEffect(() => {
    let alive = true;
    setLoadingCars(true);
    setError('');
    getAdminCars({ token })
      .then((items) => {
        if (!alive) return;
        const list = Array.isArray(items) ? items : [];
        setCars(list);
        setLoadingCars(false);
        if (!selectedCarId && list.length) setSelectedCarId(String(list[0]?._id || ''));
      })
      .catch((e) => {
        if (!alive) return;
        setLoadingCars(false);
        setError(String(e?.message || 'LOAD_FAILED'));
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const selectedCar = useMemo(() => {
    const id = String(selectedCarId || '').trim();
    if (!id) return null;
    return (Array.isArray(cars) ? cars : []).find((c) => String(c?._id || '') === id) || null;
  }, [cars, selectedCarId]);

  useEffect(() => {
    const id = String(selectedCarId || '').trim();
    if (!id) return;
    if (carIdFromPath !== id) navigate(`/admin/anchors/${encodeURIComponent(id)}`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCarId]);

  useEffect(() => {
    if (!selectedCar) return;
    const url = String(selectedCar?.model3d || selectedCar?.modelUrl || '').trim();
    setModelUrl(url);
    setAnchors(parseAnchorsFromDb(selectedCar?.anchors));
    setSelectedAnchorId('');
    setAddMode(false);
  }, [selectedCar?._id]);

  const upsertAnchorById = (id, patch) => {
    const k = String(id || '').trim();
    if (!k) return;
    setAnchors((prev) =>
      (Array.isArray(prev) ? prev : []).map((a) => (String(a?.id || '') === k ? { ...a, ...(patch || {}) } : a))
    );
  };

  const createAnchor = ({ name, category, position, rotation } = {}) => {
    const id = makeId();
    const next = {
      id,
      name: String(name || '').trim() || `anchor_${id.slice(-6)}`,
      category: String(category || '').trim(),
      position: Array.isArray(position) ? position.slice(0, 3) : [0, 0, 0],
      rotation: Array.isArray(rotation) ? rotation.slice(0, 3) : [0, 0, 0]
    };
    setAnchors((prev) => [...(Array.isArray(prev) ? prev : []), next]);
    setSelectedAnchorId(id);
    return id;
  };

  const onAddAnchorAt = (pos) => {
    const p = Array.isArray(pos) ? pos.slice(0, 3).map((x) => clampNum(x)) : [0, 0, 0];
    const id = createAnchor({ name: 'new_anchor', category: '', position: p, rotation: [0, 0, 0] });
    setAddMode(false);
    return id;
  };

  const onUpdateAnchorTransform = (id, position, rotation) => {
    upsertAnchorById(id, { position, rotation });
  };

  const onCreateAnchor = (action) => {
    const kind = String(action?.type || '').trim();
    if (kind === 'new') {
      const name = String(action?.name || '').trim();
      const category = String(action?.category || '').trim();
      createAnchor({ name, category });
      return;
    }
    if (kind === 'patch') {
      const id = String(action?.id || '').trim();
      const patch = action?.patch && typeof action.patch === 'object' ? action.patch : {};
      upsertAnchorById(id, patch);
      return;
    }
  };

  const onDeleteAnchor = () => {
    const id = String(selectedAnchorId || '').trim();
    if (!id) return;
    setAnchors((prev) => (Array.isArray(prev) ? prev : []).filter((a) => String(a?.id || '') !== id));
    setSelectedAnchorId('');
  };

  const onSaveAnchorsToDb = async () => {
    const carId = String(selectedCarId || '').trim();
    if (!carId) return;
    setError('');
    try {
      const payload = { anchors: serializeAnchorsForDb(anchors) };
      const updated = await updateAdminCar({ token, id: carId, payload });
      setCars((prev) => (Array.isArray(prev) ? prev : []).map((c) => (String(c?._id || '') === carId ? updated : c)));
    } catch (e) {
      setError(String(e?.message || 'SAVE_FAILED'));
    }
  };

  const onImportPreset = ({ bikeId, anchors: imported }) => {
    const arr = Array.isArray(imported) ? imported : [];
    setAnchors(arr);
    setSelectedAnchorId('');
    const nextCarId = String(bikeId || '').trim();
    if (nextCarId) setSelectedCarId(nextCarId);
  };

  const snapPosStepNum = clampNum(snapPosStep, 0.01);
  const snapRotDegNum = clampNum(snapRotDeg, 5);

  return (
    <div className="min-h-[calc(100vh-80px)] bg-zinc-950 p-4 text-zinc-100">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold tracking-[0.22em] text-zinc-400">ADMIN</div>
                <div className="mt-1 truncate text-lg font-black text-zinc-50">3D Anchor Editor</div>
                <div className="mt-1 text-xs text-zinc-400">
                  Click vào xe khi bật Add Anchor để tạo điểm gắn. Chọn anchor để Move/Rotate.
                </div>
              </div>
              {loadingCars ? <div className="text-xs text-zinc-400">Đang tải xe…</div> : null}
              {error ? <div className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">{error}</div> : null}
            </div>
          </div>

          <div className="h-[70vh]">
            <AnchorEditorCanvas
              modelUrl={modelUrl}
              anchors={anchors}
              selectedId={selectedAnchorId}
              showAnchors={showAnchors}
              addMode={addMode}
              transformMode={transformMode}
              snapEnabled={snapEnabled}
              snapPosStep={snapPosStepNum}
              snapRotDeg={snapRotDegNum}
              onAddAnchorAt={onAddAnchorAt}
              onSelectAnchor={(id) => setSelectedAnchorId(String(id || ''))}
              onUpdateAnchorTransform={onUpdateAnchorTransform}
            />
          </div>
        </div>

        <div className="h-[calc(70vh+92px)]">
          <AnchorEditorPanel
            cars={cars}
            selectedCarId={selectedCarId}
            onSelectCarId={(id) => setSelectedCarId(String(id || ''))}
            modelUrl={modelUrl}
            onModelUrlChange={(v) => setModelUrl(String(v || '').trim())}
            anchors={anchors}
            selectedAnchorId={selectedAnchorId}
            onSelectAnchorId={(id) => setSelectedAnchorId(String(id || ''))}
            addMode={addMode}
            onToggleAddMode={() => setAddMode((v) => !v)}
            transformMode={transformMode}
            onTransformMode={(m) => setTransformMode(String(m || 'translate'))}
            showAnchors={showAnchors}
            onShowAnchors={(v) => setShowAnchors(Boolean(v))}
            snapEnabled={snapEnabled}
            onSnapEnabled={(v) => setSnapEnabled(Boolean(v))}
            snapPosStep={snapPosStep}
            onSnapPosStep={(v) => setSnapPosStep(String(v || ''))}
            snapRotDeg={snapRotDeg}
            onSnapRotDeg={(v) => setSnapRotDeg(String(v || ''))}
            onCreateAnchor={onCreateAnchor}
            onDeleteAnchor={onDeleteAnchor}
            onSaveAnchorsToDb={onSaveAnchorsToDb}
            onImportPreset={onImportPreset}
          />
        </div>
      </div>
    </div>
  );
};

export default AdminAnchorEditor;

