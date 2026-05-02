import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { getApiBaseUrl } from '../services/api/client.js';
const DRACO_DECODER_PATH = '/draco/';
const KTX2_TRANSCODER_PATH = '/basis/';

export const resolveModelUrl = (url) => {
  const API_BASE_URL = getApiBaseUrl();
  const u = String(url || '').trim();
  if (!u) return '';
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  if (u.startsWith('/')) return `${API_BASE_URL}${u}`;
  return `${API_BASE_URL}/${u}`;
};

const safeDisposeMaterial = (m) => {
  if (!m) return;
  // Dispose textures referenced by materials when we evict a GLTF from cache (prevents GPU memory leaks).
  const maps = [
    'map',
    'normalMap',
    'metalnessMap',
    'roughnessMap',
    'aoMap',
    'emissiveMap',
    'alphaMap',
    'bumpMap',
    'displacementMap',
    'lightMap',
    'envMap'
  ];
  for (const k of maps) {
    const tex = m[k];
    if (tex && tex.dispose) tex.dispose();
  }
  if (m.dispose) m.dispose();
};

export const disposeGLTF = (gltf) => {
  const scene = gltf?.scene;
  if (!scene?.traverse) return;
  // This is used ONLY when an entry is evicted from cache. Do not call for in-use models.
  scene.traverse((o) => {
    if (!o) return;
    if (o.geometry?.dispose) o.geometry.dispose();
    const mat = o.material;
    if (Array.isArray(mat)) mat.forEach(safeDisposeMaterial);
    else safeDisposeMaterial(mat);
  });
};

const createLoader = (renderer) => {
  const loader = new GLTFLoader();

  // Draco: runtime decompression for .glb/.gltf geometry that was exported with Draco compression.
  const draco = new DRACOLoader();
  draco.setDecoderPath(DRACO_DECODER_PATH);
  loader.setDRACOLoader(draco);

  if (renderer) {
    // KTX2: GPU-friendly compressed textures via BasisU transcoding.
    const ktx2 = new KTX2Loader();
    ktx2.setTranscoderPath(KTX2_TRANSCODER_PATH);
    ktx2.detectSupport(renderer);
    loader.setKTX2Loader(ktx2);
  }

  return loader;
};

const CACHE_LIMIT = 24;

const gltfCache = new Map();
const lru = [];

const touchLRU = (key) => {
  const idx = lru.indexOf(key);
  if (idx !== -1) lru.splice(idx, 1);
  lru.unshift(key);
};

const evictIfNeeded = () => {
  while (lru.length > CACHE_LIMIT) {
    const key = lru.pop();
    const entry = gltfCache.get(key);
    if (!entry) continue;
    if ((entry.refs || 0) > 0) {
      lru.unshift(key);
      break;
    }
    // LRU eviction + disposal keeps memory bounded even when users browse lots of accessories.
    gltfCache.delete(key);
    try {
      disposeGLTF(entry.gltf);
    } catch {}
  }
};

export const acquireGLTF = async ({ url, renderer }) => {
  const resolved = resolveModelUrl(url);
  if (!resolved) throw new Error('MISSING_MODEL_URL');

  const existing = gltfCache.get(resolved);
  if (existing) {
    // Cached models are never re-downloaded; accessories are cloned from cached parse results.
    existing.refs = (existing.refs || 0) + 1;
    touchLRU(resolved);
    return { resolvedUrl: resolved, gltf: await existing.promise };
  }

  const loader = createLoader(renderer);
  const promise = new Promise((resolve, reject) => {
    loader.load(
      resolved,
      (gltf) => resolve(gltf),
      undefined,
      (err) => reject(err)
    );
  });

  gltfCache.set(resolved, { promise, gltf: null, refs: 1 });
  touchLRU(resolved);

  try {
    const gltf = await promise;
    const entry = gltfCache.get(resolved);
    if (entry) entry.gltf = gltf;
    evictIfNeeded();
    return { resolvedUrl: resolved, gltf };
  } catch (e) {
    gltfCache.delete(resolved);
    const idx = lru.indexOf(resolved);
    if (idx !== -1) lru.splice(idx, 1);
    throw e;
  }
};

export const releaseGLTF = (resolvedUrl) => {
  const key = String(resolvedUrl || '').trim();
  if (!key) return;
  const entry = gltfCache.get(key);
  if (!entry) return;
  entry.refs = Math.max(0, (entry.refs || 0) - 1);
  evictIfNeeded();
};
