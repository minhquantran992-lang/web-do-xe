export const clampNum = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export const clampVec3 = (value, fallback = [0, 0, 0]) => {
  const arr = Array.isArray(value) ? value : fallback;
  return [clampNum(arr[0]), clampNum(arr[1]), clampNum(arr[2])];
};

export const radToDeg = (r) => (Number.isFinite(Number(r)) ? (Number(r) * 180) / Math.PI : 0);
export const degToRad = (d) => (Number.isFinite(Number(d)) ? (Number(d) * Math.PI) / 180 : 0);

export const formatNum = (v, digits = 3) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '0';
  const d = Math.max(0, Math.min(10, Number(digits) || 0));
  return n.toFixed(d);
};

export const normalizeAnchorName = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_:-]+/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

export const normalizeCategory = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_:-]+/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

export const parseAnchorsFromDb = (value) => {
  const arr = Array.isArray(value) ? value : [];
  const out = [];
  const seen = new Set();
  for (const a of arr) {
    const name = normalizeAnchorName(a?.name);
    if (!name) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    const category = normalizeCategory(a?.category);
    const position = clampVec3(a?.position);
    const rotDeg = clampVec3(a?.rotation);
    const rotation = [degToRad(rotDeg[0]), degToRad(rotDeg[1]), degToRad(rotDeg[2])];
    out.push({
      id: String(a?.id || name).trim() || name,
      name,
      category,
      position,
      rotation
    });
  }
  return out;
};

export const serializeAnchorsForDb = (anchors) => {
  const arr = Array.isArray(anchors) ? anchors : [];
  const out = [];
  const seen = new Set();
  for (const a of arr) {
    const name = normalizeAnchorName(a?.name);
    if (!name) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    const category = normalizeCategory(a?.category);
    const position = clampVec3(a?.position);
    const rotRad = clampVec3(a?.rotation);
    const rotation = [radToDeg(rotRad[0]), radToDeg(rotRad[1]), radToDeg(rotRad[2])];
    out.push({
      id: String(a?.id || name).trim() || name,
      name,
      category,
      position,
      rotation
    });
  }
  return out;
};

export const exportPresetJson = ({ bikeId, anchors }) => {
  const payload = {
    bikeId: String(bikeId || '').trim(),
    anchors: serializeAnchorsForDb(anchors)
  };
  return JSON.stringify(payload, null, 2);
};

export const importPresetJson = (text) => {
  const raw = String(text || '').trim();
  if (!raw) return { bikeId: '', anchors: [] };
  const parsed = JSON.parse(raw);
  const bikeId = String(parsed?.bikeId || '').trim();
  const anchors = parseAnchorsFromDb(parsed?.anchors);
  return { bikeId, anchors };
};

