const fs = require('fs');

const readHead = async (filePath, bytes) => {
  const p = String(filePath || '').trim();
  if (!p) return Buffer.alloc(0);
  const len = Math.max(0, Math.min(1024 * 1024, Number(bytes) || 0));
  if (!len) return Buffer.alloc(0);
  const fh = await fs.promises.open(p, 'r');
  try {
    const buf = Buffer.alloc(len);
    const { bytesRead } = await fh.read(buf, 0, len, 0);
    return bytesRead === len ? buf : buf.slice(0, bytesRead);
  } finally {
    await fh.close();
  }
};

const isExeSignature = (buf) => {
  if (!Buffer.isBuffer(buf) || buf.length < 4) return false;
  const mz = buf[0] === 0x4d && buf[1] === 0x5a;
  const elf = buf[0] === 0x7f && buf[1] === 0x45 && buf[2] === 0x4c && buf[3] === 0x46;
  const shebang = buf[0] === 0x23 && buf[1] === 0x21;
  return mz || elf || shebang;
};

const detectImageKind = (buf) => {
  if (!Buffer.isBuffer(buf) || buf.length < 16) return '';
  const png = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  if (png) return 'png';
  const jpg = buf[0] === 0xff && buf[1] === 0xd8;
  if (jpg) return 'jpg';
  const riff = buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46;
  const webp = riff && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50;
  if (webp) return 'webp';
  return '';
};

const isGlb = (buf) => {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return false;
  const magic = buf[0] === 0x67 && buf[1] === 0x6c && buf[2] === 0x54 && buf[3] === 0x46;
  return magic;
};

const safeJsonParse = (raw) => {
  const s = String(raw || '').trim();
  if (!s) return { ok: false, error: 'EMPTY_JSON' };
  if (!s.startsWith('{') && !s.startsWith('[')) return { ok: false, error: 'INVALID_JSON' };
  try {
    return { ok: true, value: JSON.parse(s) };
  } catch {
    return { ok: false, error: 'INVALID_JSON' };
  }
};

const estimateGltf = (doc) => {
  const out = { vertices: 0, triangles: 0, meshes: 0, images: 0, embeddedImageBytes: 0 };
  if (!doc || typeof doc !== 'object') return out;
  const accessors = Array.isArray(doc.accessors) ? doc.accessors : [];
  const getAccCount = (idx) => {
    const a = typeof idx === 'number' ? accessors[idx] : null;
    const c = Number(a?.count);
    return Number.isFinite(c) ? Math.max(0, Math.floor(c)) : 0;
  };
  const meshes = Array.isArray(doc.meshes) ? doc.meshes : [];
  out.meshes = meshes.length;
  for (const m of meshes) {
    const prims = Array.isArray(m?.primitives) ? m.primitives : [];
    for (const p of prims) {
      const mode = p?.mode == null ? 4 : Number(p.mode);
      const indices = p?.indices;
      const pos = p?.attributes?.POSITION;
      const idxCount = getAccCount(indices);
      const posCount = getAccCount(pos);
      out.vertices += posCount;
      if (mode === 4 && idxCount) out.triangles += Math.floor(idxCount / 3);
    }
  }
  const images = Array.isArray(doc.images) ? doc.images : [];
  out.images = images.length;
  for (const img of images) {
    const uri = String(img?.uri || '');
    if (uri.startsWith('data:')) {
      const comma = uri.indexOf(',');
      if (comma > 0) out.embeddedImageBytes += Math.max(0, uri.length - comma - 1);
    }
  }
  return out;
};

const validateAvatarFile = async ({ filePath, originalName, maxBytes = 5 * 1024 * 1024 }) => {
  const stat = await fs.promises.stat(filePath);
  if (stat.size > maxBytes) return { ok: false, error: 'FILE_TOO_LARGE' };
  const head = await readHead(filePath, 64);
  if (isExeSignature(head)) return { ok: false, error: 'SUSPICIOUS_FILE' };
  const kind = detectImageKind(head);
  if (!kind) return { ok: false, error: 'INVALID_FILE_TYPE' };
  const name = String(originalName || '').toLowerCase();
  const ext = name.endsWith('.png') ? 'png' : name.endsWith('.webp') ? 'webp' : name.endsWith('.jpg') || name.endsWith('.jpeg') ? 'jpg' : '';
  if (ext && ext !== kind) return { ok: false, error: 'MIME_MISMATCH' };
  return { ok: true, kind };
};

const validateModelFile = async ({ filePath, originalName, maxBytes = 200 * 1024 * 1024 }) => {
  const stat = await fs.promises.stat(filePath);
  if (stat.size > maxBytes) return { ok: false, error: 'FILE_TOO_LARGE' };
  const head = await readHead(filePath, 64);
  if (isExeSignature(head)) return { ok: false, error: 'SUSPICIOUS_FILE' };

  const name = String(originalName || '').toLowerCase();
  const ext = name.endsWith('.gltf') || name.endsWith('.gltf.gltf') ? 'gltf' : name.endsWith('.glb') || name.endsWith('.glb.glb') ? 'glb' : '';
  if (!ext) return { ok: false, error: 'INVALID_FILE_TYPE' };

  const maxGltfBytes = Math.min(maxBytes, 20 * 1024 * 1024);
  const maxGlbJsonBytes = 5 * 1024 * 1024;
  const maxMeshes = 400;
  const maxTriangles = 2_000_000;
  const maxVertices = 6_000_000;
  const maxEmbeddedImageBytes = 12 * 1024 * 1024;

  if (ext === 'gltf') {
    if (stat.size > maxGltfBytes) return { ok: false, error: 'GLTF_TOO_LARGE' };
    const raw = await fs.promises.readFile(filePath, 'utf8');
    const parsed = safeJsonParse(raw);
    if (!parsed.ok) return { ok: false, error: 'INVALID_GLTF' };
    const est = estimateGltf(parsed.value);
    if (est.meshes > maxMeshes) return { ok: false, error: 'MODEL_TOO_COMPLEX' };
    if (est.triangles > maxTriangles || est.vertices > maxVertices) return { ok: false, error: 'MODEL_TOO_COMPLEX' };
    if (est.embeddedImageBytes > maxEmbeddedImageBytes) return { ok: false, error: 'TEXTURE_TOO_LARGE' };
    return { ok: true, kind: 'gltf', stats: est };
  }

  if (!isGlb(head)) return { ok: false, error: 'INVALID_GLB' };
  const fh = await fs.promises.open(filePath, 'r');
  try {
    const header = Buffer.alloc(12);
    const { bytesRead } = await fh.read(header, 0, 12, 0);
    if (bytesRead !== 12) return { ok: false, error: 'INVALID_GLB' };
    const totalLen = header.readUInt32LE(8);
    if (totalLen !== stat.size) return { ok: false, error: 'INVALID_GLB' };

    const chunkHeader = Buffer.alloc(8);
    const { bytesRead: chRead } = await fh.read(chunkHeader, 0, 8, 12);
    if (chRead !== 8) return { ok: false, error: 'INVALID_GLB' };
    const jsonLen = chunkHeader.readUInt32LE(0);
    const jsonType = chunkHeader.readUInt32LE(4);
    if (jsonType !== 0x4e4f534a) return { ok: false, error: 'INVALID_GLB' };
    if (jsonLen <= 0 || jsonLen > maxGlbJsonBytes) return { ok: false, error: 'MODEL_TOO_LARGE' };

    const jsonBuf = Buffer.alloc(jsonLen);
    const { bytesRead: jsonRead } = await fh.read(jsonBuf, 0, jsonLen, 20);
    if (jsonRead !== jsonLen) return { ok: false, error: 'INVALID_GLB' };
    const jsonText = jsonBuf.toString('utf8').replace(/\0+$/g, '');
    const parsed = safeJsonParse(jsonText);
    if (!parsed.ok) return { ok: false, error: 'INVALID_GLB' };

    const est = estimateGltf(parsed.value);
    if (est.meshes > maxMeshes) return { ok: false, error: 'MODEL_TOO_COMPLEX' };
    if (est.triangles > maxTriangles || est.vertices > maxVertices) return { ok: false, error: 'MODEL_TOO_COMPLEX' };
    if (est.embeddedImageBytes > maxEmbeddedImageBytes) return { ok: false, error: 'TEXTURE_TOO_LARGE' };
    return { ok: true, kind: 'glb', stats: est };
  } finally {
    await fh.close();
  }
};

module.exports = { validateAvatarFile, validateModelFile };
