import { useMemo, useState } from 'react';
import { clampNum, clampVec3, exportPresetJson, formatNum, importPresetJson, normalizeAnchorName, normalizeCategory, radToDeg, serializeAnchorsForDb } from './anchorUtils.js';

const cx = (...arr) => arr.filter(Boolean).join(' ');

const fmt = (v) => formatNum(v, 3);
const fmtDeg = (r) => formatNum(radToDeg(r), 1);

const AnchorEditorPanel = ({
  cars,
  selectedCarId,
  onSelectCarId,
  modelUrl,
  onModelUrlChange,
  anchors,
  selectedAnchorId,
  onSelectAnchorId,
  addMode,
  onToggleAddMode,
  transformMode,
  onTransformMode,
  showAnchors,
  onShowAnchors,
  snapEnabled,
  onSnapEnabled,
  snapPosStep,
  onSnapPosStep,
  snapRotDeg,
  onSnapRotDeg,
  onCreateAnchor,
  onDeleteAnchor,
  onSaveAnchorsToDb,
  onImportPreset
}) => {
  const [draftName, setDraftName] = useState('');
  const [draftCategory, setDraftCategory] = useState('');
  const [importText, setImportText] = useState('');
  const [exportText, setExportText] = useState('');
  const [showHelp, setShowHelp] = useState(true);

  const carOptions = Array.isArray(cars) ? cars : [];
  const selectedCar = useMemo(() => carOptions.find((c) => String(c?._id || '') === String(selectedCarId || '')) || null, [carOptions, selectedCarId]);

  const selectedAnchor = useMemo(() => {
    const id = String(selectedAnchorId || '').trim();
    if (!id) return null;
    const arr = Array.isArray(anchors) ? anchors : [];
    return arr.find((a) => String(a?.id || '') === id) || null;
  }, [anchors, selectedAnchorId]);

  const setSelectedName = (value) => {
    const next = normalizeAnchorName(value);
    if (!selectedAnchor) return;
    const id = String(selectedAnchor.id || '');
    const arr = Array.isArray(anchors) ? anchors : [];
    const exists = arr.some((a) => String(a?.id || '') !== id && String(a?.name || '').trim().toLowerCase() === next.toLowerCase());
    if (exists) return;
    onCreateAnchor?.({ type: 'patch', id, patch: { name: next } });
  };

  const setSelectedCategory = (value) => {
    const next = normalizeCategory(value);
    if (!selectedAnchor) return;
    onCreateAnchor?.({ type: 'patch', id: selectedAnchor.id, patch: { category: next } });
  };

  const COMMON_CATEGORIES = useMemo(
    () => [
      { value: 'exhaust', label: 'Pô (exhaust)' },
      { value: 'wheels', label: 'Bánh xe (wheels)' },
      { value: 'tire', label: 'Lốp (tire)' },
      { value: 'handlebar', label: 'Ghi đông (handlebar)' },
      { value: 'seat', label: 'Yên (seat)' },
      { value: 'bodykit', label: 'Dàn áo (bodykit)' },
      { value: 'topbox', label: 'Thùng (topbox)' }
    ],
    []
  );

  const uniqueNameFromBase = (base, existing) => {
    const b0 = normalizeAnchorName(base || 'new_anchor');
    const taken = new Set((Array.isArray(existing) ? existing : []).map((a) => normalizeAnchorName(a?.name || '')).filter(Boolean));
    if (!taken.has(b0)) return b0;
    for (let i = 2; i <= 999; i += 1) {
      const n = `${b0}_${i}`;
      if (!taken.has(n)) return n;
    }
    return `${b0}_${Date.now().toString(36).slice(-4)}`;
  };

  const quickCreate = (category) => {
    const cat = normalizeCategory(category);
    onShowAnchors?.(true);
    onTransformMode?.('translate');
    const arr = Array.isArray(anchors) ? anchors : [];
    const existing = cat ? arr.find((a) => normalizeCategory(a?.category || '') === cat) : null;
    if (existing?.id) {
      onSelectAnchorId?.(String(existing.id));
      return;
    }
    const base = cat ? `${cat}_anchor` : 'new_anchor';
    const name = uniqueNameFromBase(base, anchors);
    onCreateAnchor?.({ type: 'new', name, category: cat });
  };

  const exportNow = () => {
    const bikeId = String(selectedCar?._id || selectedCarId || '').trim();
    setExportText(exportPresetJson({ bikeId, anchors }));
  };

  const importNow = () => {
    try {
      const parsed = importPresetJson(importText);
      onImportPreset?.(parsed);
    } catch {}
  };

  const saveNow = () => {
    onSaveAnchorsToDb?.();
  };

  return (
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-white/10 bg-black/30 p-4 text-zinc-100 shadow-2xl shadow-black/50 backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold tracking-[0.22em] text-zinc-400">3D ANCHOR EDITOR</div>
          <div className="mt-1 text-sm font-black text-zinc-50">{selectedCar?.name || 'Chọn xe'}</div>
        </div>
        <button
          type="button"
          onClick={() => setShowHelp((v) => !v)}
          className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-bold text-zinc-200 hover:bg-white/10"
        >
          {showHelp ? 'Ẩn hướng dẫn' : 'Hướng dẫn'}
        </button>
      </div>

      {showHelp ? (
        <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-[12px] text-zinc-200">
          <div className="font-bold text-zinc-50">Cách dùng nhanh</div>
          <div className="mt-1 text-zinc-300">1) Bấm Add Anchor → click lên xe (khung trái) để tạo điểm gắn.</div>
          <div className="text-zinc-300">2) Bấm Move/Rotate rồi kéo gizmo để chỉnh vị trí/góc.</div>
          <div className="text-zinc-300">3) Đặt category đúng (ví dụ: exhaust cho pô) → bấm Save Anchor.</div>
        </div>
      ) : null}

      <div className="rounded-xl border border-white/10 bg-black/20 p-3">
        <div className="text-[11px] font-semibold text-zinc-300">Tạo nhanh theo loại</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {COMMON_CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => quickCreate(c.value)}
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-bold text-zinc-200 hover:bg-white/10"
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <label className="text-[11px] font-semibold text-zinc-300">Xe (bikeId)</label>
        <select
          value={String(selectedCarId || '')}
          onChange={(e) => onSelectCarId?.(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none"
        >
          <option value="">(chọn xe)</option>
          {carOptions.map((c) => (
            <option key={String(c?._id || '')} value={String(c?._id || '')}>
              {String(c?.name || '')}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <label className="text-[11px] font-semibold text-zinc-300">Model URL (.glb)</label>
        <input
          value={String(modelUrl || '')}
          onChange={(e) => onModelUrlChange?.(e.target.value)}
          placeholder="https://.../bike.glb"
          className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onToggleAddMode}
          className={cx(
            'rounded-xl border px-3 py-2 text-sm font-black transition',
            addMode ? 'border-emerald-400/30 bg-emerald-400/15 text-emerald-200' : 'border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10'
          )}
        >
          Add Anchor
        </button>
        <button
          type="button"
          onClick={saveNow}
          className="rounded-xl bg-sky-500 px-3 py-2 text-sm font-black text-slate-950 transition hover:bg-sky-400"
        >
          Lưu (Save)
        </button>
        <button
          type="button"
          onClick={onDeleteAnchor}
          disabled={!selectedAnchor}
          className="rounded-xl border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-sm font-black text-rose-200 transition hover:bg-rose-400/15 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Xoá
        </button>
        <button
          type="button"
          onClick={() => onShowAnchors?.(!showAnchors)}
          className={cx(
            'rounded-xl border px-3 py-2 text-sm font-black transition',
            showAnchors ? 'border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10' : 'border-white/10 bg-black/30 text-zinc-300 hover:bg-white/10'
          )}
        >
          {showAnchors ? 'Ẩn điểm' : 'Hiện điểm'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onTransformMode?.('translate')}
          className={cx(
            'rounded-xl border px-3 py-2 text-sm font-black transition',
            transformMode === 'translate' ? 'border-white/20 bg-white/10' : 'border-white/10 bg-white/5 hover:bg-white/10'
          )}
        >
          Move
        </button>
        <button
          type="button"
          onClick={() => onTransformMode?.('rotate')}
          className={cx(
            'rounded-xl border px-3 py-2 text-sm font-black transition',
            transformMode === 'rotate' ? 'border-white/20 bg-white/10' : 'border-white/10 bg-white/5 hover:bg-white/10'
          )}
        >
          Rotate
        </button>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/20 p-3">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-semibold text-zinc-300">Snap</div>
          <button
            type="button"
            onClick={() => onSnapEnabled?.(!snapEnabled)}
            className={cx(
              'rounded-lg border px-2 py-1 text-[11px] font-bold transition',
              snapEnabled ? 'border-emerald-400/30 bg-emerald-400/15 text-emerald-200' : 'border-white/10 bg-white/5 text-zinc-200'
            )}
          >
            {snapEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div>
            <div className="text-[10px] font-semibold text-zinc-400">Pos step</div>
            <input
              value={String(snapPosStep ?? '')}
              onChange={(e) => onSnapPosStep?.(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-[12px] outline-none"
              placeholder="0.01"
            />
          </div>
          <div>
            <div className="text-[10px] font-semibold text-zinc-400">Rot step (deg)</div>
            <input
              value={String(snapRotDeg ?? '')}
              onChange={(e) => onSnapRotDeg?.(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-[12px] outline-none"
              placeholder="5"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden rounded-xl border border-white/10 bg-black/20">
        <div className="border-b border-white/10 px-3 py-2">
          <div className="text-[11px] font-semibold text-zinc-300">Anchors ({Array.isArray(anchors) ? anchors.length : 0})</div>
        </div>
        <div className="max-h-[240px] overflow-auto p-2">
          {(Array.isArray(anchors) ? anchors : []).map((a) => {
            const isActive = String(a?.id || '') === String(selectedAnchorId || '');
            return (
              <button
                key={String(a?.id || '')}
                type="button"
                onClick={() => onSelectAnchorId?.(String(a?.id || ''))}
                className={cx(
                  'mb-1 flex w-full items-center justify-between rounded-lg border px-2 py-2 text-left text-[12px] transition',
                  isActive ? 'border-sky-400/25 bg-sky-400/10' : 'border-white/10 bg-white/5 hover:bg-white/10'
                )}
              >
                <div className="min-w-0">
                  <div className="truncate font-bold text-zinc-50">{String(a?.name || '') || '(unnamed)'}</div>
                  <div className="truncate text-[10px] text-zinc-400">{String(a?.category || '') || '—'}</div>
                </div>
                <div className="text-[10px] font-semibold text-zinc-400">{String(a?.id || '')}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/20 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] font-semibold text-zinc-300">Selected</div>
          <button
            type="button"
            onClick={() => {
              const name = normalizeAnchorName(draftName || 'new_anchor');
              const category = normalizeCategory(draftCategory || '');
              onCreateAnchor?.({ type: 'new', name, category });
              setDraftName('');
              setDraftCategory('');
            }}
            className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-bold text-zinc-200 hover:bg-white/10"
          >
            Thêm nhanh
          </button>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="exhaust_anchor"
            className="rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-[12px] outline-none"
          />
          <select
            value={normalizeCategory(draftCategory)}
            onChange={(e) => setDraftCategory(e.target.value)}
            className="rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-[12px] outline-none"
          >
            <option value="">(category)</option>
            {COMMON_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.value}
              </option>
            ))}
          </select>
        </div>
        {selectedAnchor ? (
          <div className="mt-3 space-y-2">
            <div className="grid grid-cols-1 gap-2">
              <div>
                <div className="text-[10px] font-semibold text-zinc-400">name</div>
                <input
                  value={String(selectedAnchor?.name || '')}
                  onChange={(e) => setSelectedName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-[12px] outline-none"
                />
              </div>
              <div>
                <div className="text-[10px] font-semibold text-zinc-400">category</div>
                <select
                  value={normalizeCategory(String(selectedAnchor?.category || ''))}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-[12px] outline-none"
                >
                  <option value="">(category)</option>
                  {COMMON_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.value}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-300">
              <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-2">
                <div className="text-[10px] font-semibold text-zinc-400">position</div>
                <div className="mt-1 font-mono">{clampVec3(selectedAnchor.position).map((x) => fmt(x)).join(', ')}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-2">
                <div className="text-[10px] font-semibold text-zinc-400">rotation (deg)</div>
                <div className="mt-1 font-mono">{clampVec3(selectedAnchor.rotation).map((x) => fmtDeg(x)).join(', ')}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-2 text-[11px] text-zinc-400">Chọn 1 anchor để chỉnh</div>
        )}
      </div>

      <div className="rounded-xl border border-white/10 bg-black/20 p-3">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-semibold text-zinc-300">Export / Import</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={exportNow}
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-bold text-zinc-200 hover:bg-white/10"
            >
              Export
            </button>
            <button
              type="button"
              onClick={importNow}
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-bold text-zinc-200 hover:bg-white/10"
            >
              Import
            </button>
          </div>
        </div>
        <textarea
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder="Dán preset JSON vào đây để import"
          className="mt-2 h-24 w-full rounded-lg border border-white/10 bg-black/40 p-2 text-[11px] text-zinc-100 outline-none"
        />
        <textarea
          value={exportText}
          readOnly
          placeholder="Bấm Export để lấy JSON"
          className="mt-2 h-24 w-full rounded-lg border border-white/10 bg-black/40 p-2 text-[11px] text-zinc-100 outline-none"
        />
      </div>
    </div>
  );
};

export default AnchorEditorPanel;
