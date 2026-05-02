import { Canvas, useThree } from '@react-three/fiber';
import { Environment, OrbitControls } from '@react-three/drei';
import React, { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Box3, Matrix4, Mesh, Object3D, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { acquireGLTF, releaseGLTF } from './gltfCache.js';
import { getApiBaseUrl } from '../services/api/client.js';
import { useI18n } from '../services/i18n.jsx';

class CarViewerErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full w-full items-center justify-center p-6 text-center text-sm text-zinc-300">
          {this.props.errorText || ''}
        </div>
      );
    }
    return this.props.children;
  }
}

const FitCamera = ({ modelRef, controlsRef, initialCamera, onCamera, viewerMode }) => {
  const { camera } = useThree();
  const fitTokenRef = useRef('');
  const isPreview = String(viewerMode || '').trim().toLowerCase() === 'preview';

  const emitCamera = () => {
    if (!onCamera) return;
    const target = controlsRef.current?.target;
    onCamera({
      position: [camera.position.x, camera.position.y, camera.position.z],
      target: target ? [target.x, target.y, target.z] : [0, 0, 0]
    });
  };

  useEffect(() => {
    if (!controlsRef.current) return;
    const c = controlsRef.current;
    const handle = () => emitCamera();
    c.addEventListener('change', handle);
    return () => c.removeEventListener('change', handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlsRef.current, onCamera]);

  useLayoutEffect(() => {
    const obj = modelRef.current;
    if (!obj) return;

    const cam = initialCamera && typeof initialCamera === 'object' ? initialCamera : null;
    const pos = Array.isArray(cam?.position) ? cam.position.slice(0, 3).map((x) => Number(x)) : null;
    const tgt = Array.isArray(cam?.target) ? cam.target.slice(0, 3).map((x) => Number(x)) : null;
    const posOk = pos && pos.length === 3 && pos.every((x) => Number.isFinite(x));
    const tgtOk = tgt && tgt.length === 3 && tgt.every((x) => Number.isFinite(x));
    if (posOk && tgtOk) {
      camera.position.set(pos[0], pos[1], pos[2]);
      camera.fov = 45;
      camera.near = 0.05;
      camera.far = 200;
      camera.updateProjectionMatrix();
      camera.lookAt(tgt[0], tgt[1], tgt[2]);
      if (controlsRef.current) {
        controlsRef.current.target.set(tgt[0], tgt[1], tgt[2]);
        controlsRef.current.update();
      }
      emitCamera();
      return;
    }

    const token = `${obj.uuid}`;
    if (fitTokenRef.current === token) return;
    fitTokenRef.current = token;

    obj.updateWorldMatrix(true, true);
    const box = new Box3().setFromObject(obj);
    if (box.isEmpty()) return;

    const center = box.getCenter(new Vector3());
    obj.position.x -= center.x;
    obj.position.z -= center.z;
    obj.updateWorldMatrix(true, true);

    const box2 = new Box3().setFromObject(obj);
    if (!box2.isEmpty()) {
      obj.position.y -= box2.min.y;
      obj.position.y += 0.001;
    }
    obj.updateWorldMatrix(true, true);

    const finalBox = new Box3().setFromObject(obj);
    if (finalBox.isEmpty()) return;
    const size = finalBox.getSize(new Vector3());
    const maxAxis = Math.max(size.x, size.y, size.z);
    const targetY = Math.max(0.05, size.y * (isPreview ? 0.33 : 0.35));

    if (controlsRef.current) {
      controlsRef.current.target.set(0, targetY, 0);
      controlsRef.current.update();
    }

    const dist = Math.max(isPreview ? 1.15 : 1.8, maxAxis * (isPreview ? 1.45 : 2.1));
    camera.position.set(dist * (isPreview ? 0.78 : 0.95), dist * (isPreview ? 0.34 : 0.45), dist * (isPreview ? 0.82 : 1));
    camera.fov = isPreview ? 38 : 45;
    camera.near = 0.05;
    camera.far = 200;
    camera.updateProjectionMatrix();
    camera.lookAt(0, targetY, 0);
    emitCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelRef.current, camera, initialCamera, viewerMode]);

  return null;
};

const normalizeName = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[\s\-_.]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim();

const normalizeHex = (value) => {
  const v = String(value || '').trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v)) return v;
  return '';
};

const classifyPaintTarget = (normalizedKey) => {
  const key = String(normalizedKey || '');
  if (!key) return '';

  if (key.includes('wheel') || key.includes('rim') || key.includes('tire') || key.includes('tyre') || key.includes('banh') || key.includes('lop') || key.includes('mam'))
    return 'wheels';
  if (key.includes('exhaust') || key.includes('muffler') || key.includes('pipe') || key.includes('ong xa') || key.includes('po')) return 'exhaust';
  if (key.includes('handlebar') || key.includes('handle') || key.includes('ghi dong')) return 'handlebar';
  if (key.includes('seat') || key.includes('yen')) return 'seat';
  if (key.includes('body') || key.includes('fairing') || key.includes('tank') || key.includes('dan ao') || key.includes('vo')) return 'bodykit';
  return '';
};

const classifySwapTarget = (normalizedKey) => {
  const key = String(normalizedKey || '');
  if (!key) return '';

  // Stricter than paint classification. This avoids hiding large portions of the bike because of generic names like "pipe" or "bar".
  if (key.includes('wheel') || key.includes('rim') || key.includes('tire') || key.includes('tyre') || key.includes('banh') || key.includes('lop') || key.includes('mam'))
    return 'wheels';
  if (key.includes('exhaust') || key.includes('muffler') || key.includes('ong xa') || key.includes('po')) return 'exhaust';
  if (key.includes('handlebar') || key.includes('ghi dong')) return 'handlebar';
  if (key.includes('seat') || key.includes('yen')) return 'seat';
  if (key.includes('bodykit') || key.includes('fairing') || key.includes('dan ao')) return 'bodykit';
  return '';
};

const DEFAULT_ACCESSORY_OFFSETS = {
  sc_project_cr_t_exhaust: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }
};

const normalizeOffsetKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const getOffsetKeyFromUrl = (url) => {
  const u = String(url || '').trim();
  if (!u) return '';
  const last = u.split('?')[0].split('#')[0].split('/').pop() || '';
  return normalizeOffsetKey(last);
};

const clampNum = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const normalizeOffset = (raw) => {
  const o = raw && typeof raw === 'object' ? raw : {};
  const p = Array.isArray(o.position) ? o.position : [0, 0, 0];
  const r = Array.isArray(o.rotation) ? o.rotation : [0, 0, 0];
  const s = Array.isArray(o.scale) ? o.scale : [1, 1, 1];
  return {
    position: [clampNum(p[0]), clampNum(p[1]), clampNum(p[2])],
    rotation: [clampNum(r[0]), clampNum(r[1]), clampNum(r[2])],
    scale: [clampNum(s[0], 1), clampNum(s[1], 1), clampNum(s[2], 1)]
  };
};

const OFFSETS_STORAGE_KEY = 'carbanana.accessoryOffsets';

const loadOffsetsFromStorage = () => {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(OFFSETS_STORAGE_KEY) : '';
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out = {};
    for (const [k, v] of Object.entries(parsed)) out[normalizeOffsetKey(k)] = normalizeOffset(v);
    return out;
  } catch {
    return {};
  }
};

const saveOffsetsToStorage = (offsets) => {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(OFFSETS_STORAGE_KEY, JSON.stringify(offsets));
  } catch {}
};

const buildOffsetsStore = () => {
  const fromStorage = loadOffsetsFromStorage();
  const out = {};
  for (const [k, v] of Object.entries(DEFAULT_ACCESSORY_OFFSETS)) out[normalizeOffsetKey(k)] = normalizeOffset(v);
  for (const [k, v] of Object.entries(fromStorage)) out[normalizeOffsetKey(k)] = normalizeOffset(v);
  return out;
};

const applyAccessoryOffset = (accessory, key, offsetsStore) => {
  if (!accessory) return;
  const store = offsetsStore && typeof offsetsStore === 'object' ? offsetsStore : {};
  const k = normalizeOffsetKey(key);
  const offset = normalizeOffset(store[k]);
  accessory.rotation.set(offset.rotation[0], offset.rotation[1], offset.rotation[2]);
  accessory.position.set(offset.position[0], offset.position[1], offset.position[2]);
  if (accessory?.userData) delete accessory.userData.__rootBox;
};

const BIKE_REFERENCE_LENGTH = 2;

const clampRange = (v, min, max) => Math.min(max, Math.max(min, v));

const getAccessoryMaxDim = (obj) => {
  if (!obj) return 0;
  obj.updateWorldMatrix(true, true);
  const box = new Box3().setFromObject(obj);
  if (box.isEmpty()) return 0;
  const size = box.getSize(new Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  return Number.isFinite(maxDim) ? maxDim : 0;
};

const getTargetSizeByType = (type) => {
  const t = String(type || '').trim();
  if (t === 'exhaust') return { ideal: 0.5, min: 0.3, max: 0.8 };
  if (t === 'handlebar') return { ideal: 0.55, min: 0.25, max: 0.9 };
  if (t === 'wheels' || t === 'tire') return { ideal: 0.65, min: 0.35, max: 1.1 };
  if (t === 'seat') return { ideal: 0.45, min: 0.2, max: 0.8 };
  if (t === 'bodykit') return { ideal: 0.9, min: 0.45, max: 1.6 };
  return { ideal: 0.5, min: 0.2, max: 1.2 };
};

const computeScaleFactorFixed = ({ accessory, type }) => {
  const maxDim = getAccessoryMaxDim(accessory);
  if (!(maxDim > 0)) return { scaleFactor: 1, maxDim: 0, target: 0 };

  const target = getTargetSizeByType(type);
  let scaleFactor = target.ideal / maxDim;

  // Prefer keeping the final length within a safe band when possible (still based on accessory size only).
  const minF = target.min / maxDim;
  const maxF = target.max / maxDim;
  scaleFactor = clampRange(scaleFactor, minF, maxF);

  // Clamp scaleFactor (VERY IMPORTANT)
  scaleFactor = Math.min(scaleFactor, 2);
  scaleFactor = Math.max(scaleFactor, 0.01);

  // Ensure accessory is never larger than the bike reference length (still no bike bbox usage).
  const finalLen = maxDim * scaleFactor;
  if (finalLen > BIKE_REFERENCE_LENGTH) {
    scaleFactor = BIKE_REFERENCE_LENGTH / maxDim;
    scaleFactor = Math.min(scaleFactor, 2);
    scaleFactor = Math.max(scaleFactor, 0.01);
  }

  return { scaleFactor, maxDim, target: target.ideal };
};

const normalizeAndAttach = ({ accessory, anchor, slot, offsetKey, offsetsStore, debug }) => {
  if (!accessory || !anchor) return { applied: false, scaleFactor: 1 };

  // Attach accessory to bike anchor.
  accessory.position.set(0, 0, 0);
  accessory.quaternion.identity();
  accessory.scale.setScalar(1);
  anchor.add(accessory);

  // Scale FIRST (based on accessory size only), then apply position/rotation offset.
  const { scaleFactor, maxDim, target } = computeScaleFactorFixed({ accessory, type: slot?.type });
  accessory.scale.setScalar(scaleFactor);

  const key = String(offsetKey || '').trim();
  if (key) applyAccessoryOffset(accessory, key, offsetsStore);

  if (debug) {
    const finalLen = maxDim > 0 ? maxDim * scaleFactor : 0;
    console.log('normalizeAndAttach:', {
      slot: String(slot?.slot || ''),
      type: String(slot?.type || ''),
      offsetKey: key,
      targetSize: target,
      maxDim,
      scaleFactor,
      finalLength: finalLen,
      bikeReferenceLength: BIKE_REFERENCE_LENGTH
    });
  }

  accessory.userData = { ...(accessory.userData || {}), scaleFactor, offsetKey: key };
  return { applied: true, scaleFactor };
};

const setMaterialColor = (mat, color) => {
  if (!mat?.color?.set) return;
  try {
    mat.color.set(color);
  } catch {}
};

const ensureOriginalMaterialColors = (root) => {
  if (!root) return null;
  const ud = root.userData && typeof root.userData === 'object' ? root.userData : {};
  const store = ud.__origMaterialColors && typeof ud.__origMaterialColors === 'object' ? ud.__origMaterialColors : {};
  let touched = false;
  root.traverse?.((obj) => {
    if (!obj?.isMesh) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) {
      const id = String(m?.uuid || '').trim();
      if (!id) continue;
      if (store[id]) continue;
      if (!m?.color?.getHexString) continue;
      try {
        store[id] = `#${m.color.getHexString()}`;
        touched = true;
      } catch {}
    }
  });
  if (touched) root.userData = { ...ud, __origMaterialColors: store };
  else if (!ud.__origMaterialColors) root.userData = { ...ud, __origMaterialColors: store };
  return store;
};

const applyPaintOnce = (root, { baseColor, targets } = {}) => {
  const orig = ensureOriginalMaterialColors(root) || {};
  const targetColors = targets && typeof targets === 'object' ? targets : {};
  const base = normalizeHex(baseColor);
  root?.traverse?.((obj) => {
    if (!obj?.isMesh) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) {
      const uuid = String(m?.uuid || '').trim();
      const key = uuid ? `mat:${uuid}` : '';
      const original = uuid && orig[uuid] ? orig[uuid] : '';
      const direct = key && targetColors[key] ? normalizeHex(targetColors[key]) : '';
      if (direct) {
        setMaterialColor(m, direct);
        continue;
      }
      const category = classifyPaintTarget(normalizeName(`${obj?.name || ''} ${m?.name || ''}`));
      const byCat = category && targetColors[category] ? normalizeHex(targetColors[category]) : '';
      if (byCat) setMaterialColor(m, byCat);
      else if (base) setMaterialColor(m, base);
      else if (original) setMaterialColor(m, original);
    }
  });
};

const ensureOriginalMaterialProps = (root) => {
  if (!root) return null;
  const ud = root.userData && typeof root.userData === 'object' ? root.userData : {};
  const store = ud.__origMaterialProps && typeof ud.__origMaterialProps === 'object' ? ud.__origMaterialProps : {};
  let touched = false;
  root.traverse?.((obj) => {
    if (!obj?.isMesh) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) {
      const id = String(m?.uuid || '').trim();
      if (!id) continue;
      if (store[id]) continue;
      const snap = {};
      if (m?.color?.getHexString) {
        try {
          snap.color = `#${m.color.getHexString()}`;
        } catch {}
      }
      if (m?.emissive?.getHexString) {
        try {
          snap.emissive = `#${m.emissive.getHexString()}`;
        } catch {}
      }
      if (typeof m?.emissiveIntensity === 'number') snap.emissiveIntensity = m.emissiveIntensity;
      if (typeof m?.metalness === 'number') snap.metalness = m.metalness;
      if (typeof m?.roughness === 'number') snap.roughness = m.roughness;
      snap.map = m?.map || null;
      snap.normalMap = m?.normalMap || null;
      snap.roughnessMap = m?.roughnessMap || null;
      snap.metalnessMap = m?.metalnessMap || null;
      snap.emissiveMap = m?.emissiveMap || null;
      snap.aoMap = m?.aoMap || null;
      snap.alphaMap = m?.alphaMap || null;
      store[id] = snap;
      touched = true;
    }
  });
  if (touched) root.userData = { ...ud, __origMaterialProps: store };
  else if (!ud.__origMaterialProps) root.userData = { ...ud, __origMaterialProps: store };
  return store;
};

const applyAccessoryPaintOverride = (root, paintColor) => {
  const color = normalizeHex(paintColor);
  const store = ensureOriginalMaterialProps(root) || {};
  root?.traverse?.((obj) => {
    if (!obj?.isMesh) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) {
      const id = String(m?.uuid || '').trim();
      const snap = id && store[id] ? store[id] : null;
      if (!m) continue;

      if (!color) {
        if (snap) {
          if (snap.color && m?.color?.set) {
            try {
              m.color.set(snap.color);
            } catch {}
          }
          if (snap.emissive && m?.emissive?.set) {
            try {
              m.emissive.set(snap.emissive);
            } catch {}
          }
          if (typeof snap.emissiveIntensity === 'number') m.emissiveIntensity = snap.emissiveIntensity;
          if (typeof snap.metalness === 'number') m.metalness = snap.metalness;
          if (typeof snap.roughness === 'number') m.roughness = snap.roughness;
          if ('map' in snap) m.map = snap.map || null;
          if ('normalMap' in snap) m.normalMap = snap.normalMap || null;
          if ('roughnessMap' in snap) m.roughnessMap = snap.roughnessMap || null;
          if ('metalnessMap' in snap) m.metalnessMap = snap.metalnessMap || null;
          if ('emissiveMap' in snap) m.emissiveMap = snap.emissiveMap || null;
          if ('aoMap' in snap) m.aoMap = snap.aoMap || null;
          if ('alphaMap' in snap) m.alphaMap = snap.alphaMap || null;
        }
        m.needsUpdate = true;
        continue;
      }

      if (m?.color?.set) {
        try {
          m.color.set(color);
        } catch {}
      }
      if (m?.emissive?.set) {
        try {
          m.emissive.set(color);
        } catch {}
        if (typeof m.emissiveIntensity === 'number') m.emissiveIntensity = 0.18;
      }
      if (typeof m?.metalness === 'number') m.metalness = 0.25;
      if (typeof m?.roughness === 'number') m.roughness = 0.55;
      if ('map' in m) m.map = null;
      if ('normalMap' in m) m.normalMap = null;
      if ('roughnessMap' in m) m.roughnessMap = null;
      if ('metalnessMap' in m) m.metalnessMap = null;
      if ('emissiveMap' in m) m.emissiveMap = null;
      if ('aoMap' in m) m.aoMap = null;
      m.needsUpdate = true;
    }
  });
};

const findFirstByName = (root, candidates) => {
  const wanted = (Array.isArray(candidates) ? candidates : [])
    .map((x) => String(x || '').trim())
    .filter(Boolean);
  if (!wanted.length) return null;

  const wantedLower = new Set(wanted.map((x) => x.toLowerCase()));
  let found = null;
  root?.traverse?.((o) => {
    if (found) return;
    const n = String(o?.name || '').trim();
    if (!n) return;
    if (wantedLower.has(n.toLowerCase())) found = o;
  });
  return found;
};

const anchorCandidatesByType = (type, slotKey) => {
  const t = String(type || '').trim();
  const key = String(slotKey || '').trim();
  if (!t) return [];

  const out = [
    `${t}_anchor`,
    `${t}_mount`,
    `${t}_socket`,
    `${t}_attach`,
    `${t} anchor`,
    `${t} mount`,
    `${t} socket`
  ];

  if (t === 'handlebar') out.push('handle_anchor', 'handle_mount', 'handle_socket');
  if (t === 'wheels' || t === 'tire') out.push('wheel_anchor', 'wheel_mount', 'wheel_socket');

  if (key.includes(':front')) out.push('front_wheel_anchor', 'front_wheel_mount', 'front_wheel_socket', 'wheel_front_anchor', 'wheel_front_mount');
  if (key.includes(':rear')) out.push('rear_wheel_anchor', 'rear_wheel_mount', 'rear_wheel_socket', 'wheel_rear_anchor', 'wheel_rear_mount');

  return out;
};

const accessoryMountCandidatesByType = (type, slotKey) => {
  const t = String(type || '').trim();
  const key = String(slotKey || '').trim();
  if (!t) return ['mount', 'anchor', 'socket'];

  const out = [
    `${t}_mount`,
    `${t}_anchor`,
    `${t}_socket`,
    'mount',
    'anchor',
    'socket',
    'attach',
    'attachment'
  ];

  if (t === 'handlebar') out.push('handle_mount', 'handle_anchor', 'handle_socket');
  if (t === 'wheels' || t === 'tire') out.push('wheel_mount', 'wheel_anchor', 'wheel_socket');

  if (key.includes(':front')) out.push('front_mount', 'front_anchor', 'front_socket', 'front_wheel_mount', 'front_wheel_anchor');
  if (key.includes(':rear')) out.push('rear_mount', 'rear_anchor', 'rear_socket', 'rear_wheel_mount', 'rear_wheel_anchor');

  return out;
};

const computeAutoScale = (obj, targetSize) => {
  const t = Number(targetSize);
  if (!Number.isFinite(t) || t <= 0) return 1;
  obj.updateWorldMatrix(true, true);
  const box = new Box3().setFromObject(obj);
  if (box.isEmpty()) return 1;
  const size = box.getSize(new Vector3());
  const maxAxis = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(maxAxis) || maxAxis <= 0) return 1;
  return t / maxAxis;
};

const computeMeshCenterInRoot = (mesh, root) => {
  if (!mesh?.isMesh || !mesh.geometry) return new Vector3();
  const geom = mesh.geometry;
  if (!geom.boundingBox) {
    try {
      geom.computeBoundingBox();
    } catch {}
  }
  if (!geom.boundingBox) return new Vector3();

  root.updateWorldMatrix(true, true);
  mesh.updateWorldMatrix(true, false);
  const rootInv = new Matrix4().copy(root.matrixWorld).invert();
  const m = new Matrix4().multiplyMatrices(rootInv, mesh.matrixWorld);
  const box = geom.boundingBox.clone();
  box.applyMatrix4(m);
  return box.getCenter(new Vector3());
};

const computeMeshesBBoxCenterInRoot = (meshes, root) => {
  const arr = Array.isArray(meshes) ? meshes : [];
  if (!arr.length || !root) return null;
  root.updateWorldMatrix(true, true);
  const rootInv = new Matrix4().copy(root.matrixWorld).invert();
  const out = new Box3();
  let has = false;

  for (const mesh of arr) {
    if (!mesh?.isMesh || !mesh.geometry) continue;
    const geom = mesh.geometry;
    if (!geom.boundingBox) {
      try {
        geom.computeBoundingBox();
      } catch {}
    }
    if (!geom.boundingBox) continue;
    mesh.updateWorldMatrix(true, false);
    const m = new Matrix4().multiplyMatrices(rootInv, mesh.matrixWorld);
    const box = geom.boundingBox.clone();
    box.applyMatrix4(m);
    if (!has) {
      out.copy(box);
      has = true;
    } else {
      out.union(box);
    }
  }

  if (!has || out.isEmpty()) return null;
  return out.getCenter(new Vector3());
};

const disableShadowsAndEnableCulling = (root) => {
  root?.traverse?.((o) => {
    if (!o?.isMesh) return;
    o.castShadow = false;
    o.receiveShadow = false;
    o.frustumCulled = true;
  });
};

const collectMeshesByCategory = (root) => {
  const map = new Map();
  root?.traverse?.((o) => {
    if (!o?.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    let category = '';
    for (const m of mats) {
      category = classifySwapTarget(normalizeName(`${o?.name || ''} ${m?.name || ''}`));
      if (category) break;
    }
    if (!category) return;
    const arr = map.get(category) || [];
    arr.push(o);
    map.set(category, arr);
  });
  return map;
};

const mergeStaticMeshesByMaterial = (root, { excludeMeshes = new Set() } = {}) => {
  if (!root?.traverse) return;

  // Draw-call reduction: merge static meshes (same material) into one BufferGeometry.
  // We intentionally exclude swappable categories (exhaust/wheels/handlebar...) so customization stays functional.
  root.updateWorldMatrix(true, true);
  const rootInv = new Matrix4().copy(root.matrixWorld).invert();

  const byMaterial = new Map();
  const removable = [];

  root.traverse((o) => {
    if (!o?.isMesh) return;
    if (excludeMeshes.has(o)) return;
    if (o.isSkinnedMesh) return;
    if (!o.geometry?.isBufferGeometry) return;
    if (o.morphTargetInfluences && o.morphTargetInfluences.length) return;
    if (!(o instanceof Mesh)) return;
    if (!o.material) return;

    const matKey = Array.isArray(o.material) ? null : o.material.uuid;
    if (!matKey) return;

    o.updateWorldMatrix(true, false);
    const geom = o.geometry.clone();
    const m = new Matrix4().multiplyMatrices(rootInv, o.matrixWorld);
    geom.applyMatrix4(m);

    const bucket = byMaterial.get(matKey) || { material: o.material, geoms: [] };
    bucket.geoms.push(geom);
    byMaterial.set(matKey, bucket);
    removable.push(o);
  });

  for (const bucket of byMaterial.values()) {
    if (!bucket.geoms.length) continue;
    const merged = mergeGeometries(bucket.geoms, false);
    if (!merged) continue;
    const mergedMesh = new Mesh(merged, bucket.material);
    mergedMesh.name = `merged_${String(bucket.material?.name || bucket.material?.uuid || '').slice(0, 16)}`;
    mergedMesh.castShadow = false;
    mergedMesh.receiveShadow = false;
    mergedMesh.frustumCulled = true;
    root.add(mergedMesh);
  }

  for (const o of removable) {
    if (!o?.parent) continue;
    o.parent.remove(o);
  }
};

const OffsetDebugPanel = ({ enabled, getAttachmentsSnapshot, getOffsetKeyForAttachment, onApply, onSave, onLog }) => {
  const [selected, setSelected] = useState('');
  const [draft, setDraft] = useState(() => ({ position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }));
  const [attachments, setAttachments] = useState([]);

  useEffect(() => {
    if (!enabled) return;
    const next = getAttachmentsSnapshot?.() || [];
    setAttachments(next);
    if (!selected && next.length) setSelected(next[0]);
  }, [enabled, getAttachmentsSnapshot, selected]);

  useEffect(() => {
    if (!enabled) return;
    const key = getOffsetKeyForAttachment?.(selected);
    const store = buildOffsetsStore();
    const existing = key ? store[normalizeOffsetKey(key)] : null;
    setDraft(normalizeOffset(existing));
  }, [enabled, selected, getOffsetKeyForAttachment]);

  if (!enabled) return null;

  const setAxis = (group, idx, value) => {
    setDraft((prev) => {
      const next = normalizeOffset(prev);
      next[group][idx] = clampNum(value, next[group][idx]);
      return next;
    });
  };

  const applyNow = () => {
    const key = getOffsetKeyForAttachment?.(selected);
    if (!key) return;
    const store = buildOffsetsStore();
    store[normalizeOffsetKey(key)] = normalizeOffset(draft);
    onApply?.({ attachmentKey: selected, offsetKey: key, store });
  };

  const saveNow = () => {
    const key = getOffsetKeyForAttachment?.(selected);
    if (!key) return;
    const store = buildOffsetsStore();
    store[normalizeOffsetKey(key)] = normalizeOffset(draft);
    saveOffsetsToStorage(store);
    onSave?.({ offsetKey: key, store });
  };

  const logNow = () => {
    const key = getOffsetKeyForAttachment?.(selected);
    if (!key) return;
    const store = buildOffsetsStore();
    store[normalizeOffsetKey(key)] = normalizeOffset(draft);
    onLog?.({ offsetKey: key, offset: store[normalizeOffsetKey(key)] });
  };

  return (
    <div className="pointer-events-auto absolute left-3 top-3 z-50 w-[320px] rounded-xl border border-white/10 bg-black/60 p-3 text-xs text-white backdrop-blur">
      <div className="flex items-center justify-between">
        <div className="font-semibold">Offset Debug</div>
        <div className="text-[10px] text-white/70">?debug3d=1</div>
      </div>
      <div className="mt-2 space-y-2">
        <label className="block">
          <div className="mb-1 text-white/80">Attachment</div>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1 outline-none"
          >
            {attachments.length ? (
              attachments.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))
            ) : (
              <option value="">(no attachments)</option>
            )}
          </select>
        </label>

        <div className="grid grid-cols-4 gap-2">
          <div className="col-span-4 text-white/80">Position</div>
          <input className="col-span-1 rounded border border-white/10 bg-black/40 px-2 py-1" value={draft.position[0]} onChange={(e) => setAxis('position', 0, e.target.value)} />
          <input className="col-span-1 rounded border border-white/10 bg-black/40 px-2 py-1" value={draft.position[1]} onChange={(e) => setAxis('position', 1, e.target.value)} />
          <input className="col-span-1 rounded border border-white/10 bg-black/40 px-2 py-1" value={draft.position[2]} onChange={(e) => setAxis('position', 2, e.target.value)} />
          <button onClick={applyNow} className="col-span-1 rounded bg-cyan-600/80 px-2 py-1 font-semibold hover:bg-cyan-500/80">
            Apply
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <div className="col-span-4 text-white/80">Rotation (radians)</div>
          <input className="col-span-1 rounded border border-white/10 bg-black/40 px-2 py-1" value={draft.rotation[0]} onChange={(e) => setAxis('rotation', 0, e.target.value)} />
          <input className="col-span-1 rounded border border-white/10 bg-black/40 px-2 py-1" value={draft.rotation[1]} onChange={(e) => setAxis('rotation', 1, e.target.value)} />
          <input className="col-span-1 rounded border border-white/10 bg-black/40 px-2 py-1" value={draft.rotation[2]} onChange={(e) => setAxis('rotation', 2, e.target.value)} />
          <button onClick={logNow} className="col-span-1 rounded bg-white/10 px-2 py-1 font-semibold hover:bg-white/15">
            Log
          </button>
        </div>

        <div className="flex justify-end">
          <button onClick={saveNow} className="rounded bg-emerald-600/80 px-3 py-1.5 font-semibold hover:bg-emerald-500/80">
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

const BikeRig = ({
  url,
  color,
  paintTargets,
  slots,
  embeddedConfig,
  accessoryColors,
  onMeta,
  onObject,
  onAttachmentsChange,
  onAttachmentObject,
  debugEnabled
}) => {
  const { gl } = useThree();
  const rootRef = useRef(null);
  const baseResolvedUrlRef = useRef('');
  const baseSceneRef = useRef(null);
  const anchorsRef = useRef(new Map());
  const attachmentsRef = useRef(new Map());
  const pendingTokenRef = useRef(new Map());
  const meshesByCategoryRef = useRef(new Map());
  const meshCentersRef = useRef(new WeakMap());
  const [ready, setReady] = useState(false);

  const emitMeta = () => {
    if (!onMeta) return;
    const root = rootRef.current;
    if (!root) return;
    const nodes = new Set();
    root.traverse((o) => {
      const n = String(o?.name || '').trim();
      if (n) nodes.add(n);
    });
    const anchors = [];
    for (const [key, a] of anchorsRef.current.entries()) {
      anchors.push({
        key,
        hasSocket: Boolean(a?.userData?.hasSocket),
        fallback: a?.userData?.fallback ? String(a.userData.fallback) : '',
        position: a ? [a.position.x, a.position.y, a.position.z] : [0, 0, 0]
      });
    }
    onMeta({
      nodes: Array.from(nodes.values()),
      anchors
    });
  };

  const ensureAnchor = (slotKey, type, socketCandidates) => {
    const cacheKey = String(slotKey || type || '').trim();
    if (!cacheKey) return null;
    const existing = anchorsRef.current.get(cacheKey);
    if (existing) return existing;

    const root = rootRef.current;
    const base = baseSceneRef.current;
    if (!root || !base) return null;

    // Attachment anchors are created once and kept under the Bike root (no per-frame transform recompute).
    // Priority:
    // 1) Exact mount socket in base bike (recommended).
    // 2) Fallback: approximate from original category meshes bounding box (keeps UI usable even when GLB has no anchors).
    const socketObj = findFirstByName(base, [
      ...(Array.isArray(socketCandidates) ? socketCandidates : []),
      ...anchorCandidatesByType(type, cacheKey)
    ]);
    const anchor = new Object3D();
    anchor.name = `${cacheKey.replaceAll(':', '_')}_anchor`;
    anchor.userData = { ...(anchor.userData || {}), hasSocket: Boolean(socketObj), fallback: '' };

    if (socketObj) {
      base.updateWorldMatrix(true, true);
      root.updateWorldMatrix(true, true);
      socketObj.updateWorldMatrix(true, false);
      const inv = new Matrix4().copy(root.matrixWorld).invert();
      const local = new Matrix4().multiplyMatrices(inv, socketObj.matrixWorld);
      anchor.matrixAutoUpdate = false;
      anchor.matrix.copy(local);
      anchor.matrix.decompose(anchor.position, anchor.quaternion, anchor.scale);
      anchor.matrixAutoUpdate = true;
    } else {
      const category = type === 'tire' ? 'wheels' : String(type || '').trim();
      const meshes = meshesByCategoryRef.current.get(category) || [];
      let center = null;

      if (cacheKey.includes(':front') || cacheKey.includes(':rear')) {
        const isFront = cacheKey.includes(':front');
        const candidates = meshes.filter((m) => {
          const n = normalizeName(m?.name || '');
          if (!n) return false;
          if (isFront) return n.includes('front') || n.includes('truoc') || n.includes('trc');
          return n.includes('rear') || n.includes('back') || n.includes('sau');
        });
        center = computeMeshesBBoxCenterInRoot(candidates, root);
        if (!center && meshes.length) {
          const scored = meshes
            .map((m) => ({ m, c: computeMeshCenterInRoot(m, root) }))
            .filter((x) => x.m && x.c);
          if (scored.length) {
            scored.sort((a, b) => (isFront ? b.c.z - a.c.z : a.c.z - b.c.z));
            center = scored[0].c;
          }
        }
      }

      if (!center) center = computeMeshesBBoxCenterInRoot(meshes, root);
      if (center) {
        anchor.position.copy(center);
        anchor.userData.fallback = 'mesh_bbox';
      } else {
        base.updateWorldMatrix(true, true);
        root.updateWorldMatrix(true, true);
        const rootInv = new Matrix4().copy(root.matrixWorld).invert();
        const box = new Box3().setFromObject(base);
        if (!box.isEmpty()) {
          const localBox = box.clone().applyMatrix4(rootInv);
          const size = localBox.getSize(new Vector3());
          const t = String(type || '').trim();

          const pos = new Vector3(0, 0, 0);
          if (t === 'exhaust') {
            pos.set(localBox.max.x * 0.35, Math.max(0.08, size.y * 0.18), localBox.min.z + size.z * 0.18);
          } else if (t === 'topbox') {
            pos.set(0, Math.max(0.12, size.y * 0.78), localBox.min.z + size.z * 0.22);
          } else if (t === 'handlebar') {
            pos.set(0, Math.max(0.12, size.y * 0.78), localBox.max.z - size.z * 0.22);
          } else if (t === 'seat') {
            pos.set(0, Math.max(0.12, size.y * 0.62), localBox.min.z + size.z * 0.5);
          } else if (t === 'bodykit') {
            pos.set(0, Math.max(0.08, size.y * 0.5), 0);
          } else {
            pos.set(0, Math.max(0.08, size.y * 0.5), 0);
          }

          anchor.position.copy(pos);
          anchor.userData.fallback = 'bbox_heuristic';
        } else {
          anchor.userData.fallback = 'origin';
        }
      }
    }

    root.add(anchor);
    anchorsRef.current.set(cacheKey, anchor);
    emitMeta();
    return anchor;
  };

  const applyEmbeddedConfig = () => {
    const base = baseSceneRef.current;
    const cfg = embeddedConfig && typeof embeddedConfig === 'object' ? embeddedConfig : null;
    if (!base || !cfg) return;

    for (const [type, variant] of Object.entries(cfg)) {
      const t = normalizeName(type);
      const v = normalizeName(variant);
      if (!t || !v) continue;
      base.traverse((o) => {
        const n = normalizeName(o?.name || '');
        if (!n) return;
        const looksLikeVariant = n.includes(t) && (n.includes(v) || n.includes(`${t} ${v}`));
        if (looksLikeVariant) o.visible = true;
      });
    }
  };

  const syncOriginalVisibility = (nextSlots) => {
    // Swap system: when an accessory is active for a category, hide the original meshes for that category.
    const root = rootRef.current;
    if (!root) return;
    const slotArr = Array.isArray(nextSlots) ? nextSlots : [];

    const radiusByType = {
      exhaust: 0.45,
      handlebar: 0.35,
      wheels: 0.65,
      tire: 0.65,
      seat: 0.45,
      bodykit: 0.9
    };

    const rules = [];
    for (const s of slotArr) {
      const type = String(s?.type || '').trim();
      const key = String(s?.slot || type || '').trim();
      if (!type || !key) continue;
      const category = type === 'tire' ? 'wheels' : type;
      const anchor = ensureAnchor(key, type, s?.socket);
      if (!anchor || !anchor.userData?.hasSocket) continue;
      const r0 = Number(s?.targetSize) || 0;
      const radius = r0 > 0 ? Math.max(0.08, r0 * 1.2) : radiusByType[type] || 0.45;
      rules.push({ category, radius, anchor });
    }

    const meshesByCategory = meshesByCategoryRef.current;
    for (const [category, meshes] of meshesByCategory.entries()) {
      const categoryRules = rules.filter((r) => r.category === category);
      const shouldUseSpatial = categoryRules.length > 0;
      for (const m of meshes) {
        if (!m) continue;
        if (!shouldUseSpatial) {
          m.visible = true;
          continue;
        }
        let center = meshCentersRef.current.get(m);
        if (!center) {
          center = computeMeshCenterInRoot(m, root);
          meshCentersRef.current.set(m, center);
        }
        let hide = false;
        for (const rule of categoryRules) {
          const ap = rule.anchor.position;
          const dx = center.x - ap.x;
          const dy = center.y - ap.y;
          const dz = center.z - ap.z;
          if (dx * dx + dy * dy + dz * dz <= rule.radius * rule.radius) {
            hide = true;
            break;
          }
        }
        m.visible = !hide;
      }
    }
  };

  useEffect(() => {
    let canceled = false;
    setReady(false);

    // Base bike load is isolated to URL changes only (no re-build on every interaction).
    const prevResolved = baseResolvedUrlRef.current;
    if (prevResolved) {
      releaseGLTF(prevResolved);
      baseResolvedUrlRef.current = '';
    }

    baseSceneRef.current = null;
    anchorsRef.current.clear();
    for (const att of attachmentsRef.current.values()) {
      try {
        att?.parent?.remove(att);
      } catch {}
    }
    attachmentsRef.current.clear();
    meshesByCategoryRef.current = new Map();

    const root = rootRef.current;
    if (root) {
      while (root.children.length) root.remove(root.children[0]);
    }

    (async () => {
      try {
        const { resolvedUrl, gltf } = await acquireGLTF({ url, renderer: gl });
        if (canceled) {
          releaseGLTF(resolvedUrl);
          return;
        }
        baseResolvedUrlRef.current = resolvedUrl;

        const base = gltf?.scene ? gltf.scene.clone(true) : null;
        if (!base) throw new Error('INVALID_GLTF_SCENE');
        base.name = 'BikeBase';
        disableShadowsAndEnableCulling(base);
        applyPaintOnce(base, { baseColor: color, targets: paintTargets });

        const nextMeshesByCategory = collectMeshesByCategory(base);
        meshesByCategoryRef.current = nextMeshesByCategory;
        meshCentersRef.current = new WeakMap();
        for (const meshes of nextMeshesByCategory.values()) {
          for (const m of meshes) {
            if (!m) continue;
            const c = computeMeshCenterInRoot(m, rootRef.current);
            meshCentersRef.current.set(m, c);
          }
        }

        const excluded = new Set();
        for (const arr of nextMeshesByCategory.values()) for (const m of arr) excluded.add(m);
        mergeStaticMeshesByMaterial(base, { excludeMeshes: excluded });

        baseSceneRef.current = base;
        rootRef.current?.add(base);
        applyEmbeddedConfig();
        emitMeta();
        onObject?.(rootRef.current);
        setReady(true);
      } catch {
        setReady(false);
      }
    })();

    return () => {
      canceled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useEffect(() => {
    if (!ready) return;
    const base = baseSceneRef.current;
    if (!base) return;
    applyPaintOnce(base, { baseColor: color, targets: paintTargets });
  }, [ready, color, paintTargets]);

  useEffect(() => {
    if (!ready) return;
    applyEmbeddedConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, embeddedConfig]);

  useEffect(() => {
    if (!ready) return;
    // Lazy-load accessories only when selected; cache prevents re-downloading on re-select.
    const next = Array.isArray(slots) ? slots : [];
    const desired = new Map(next.map((s) => [String(s?.slot || s?.type || ''), s]).filter(([k]) => k));
    const cancels = new Map();

    syncOriginalVisibility(next);

    for (const [key, obj] of attachmentsRef.current.entries()) {
      if (desired.has(key)) continue;
      try {
        obj?.parent?.remove(obj);
      } catch {}
      attachmentsRef.current.delete(key);
      onAttachmentObject?.(key, null);
      const resolved = String(obj?.userData?.resolvedUrl || '').trim();
      if (resolved) releaseGLTF(resolved);
    }
    onAttachmentsChange?.(Array.from(attachmentsRef.current.keys()));

    for (const [key, s] of desired.entries()) {
      const urlToLoad = String(s?.url || '').trim();
      if (!urlToLoad) continue;
      const existing = attachmentsRef.current.get(key);
      const existingUrl = String(existing?.userData?.sourceUrl || '').trim();
      if (existing && existingUrl === urlToLoad) continue;

      if (existing) {
        try {
          existing?.parent?.remove(existing);
        } catch {}
        attachmentsRef.current.delete(key);
        const resolved = String(existing?.userData?.resolvedUrl || '').trim();
        if (resolved) releaseGLTF(resolved);
      }

      const token = `${key}:${Date.now()}`;
      pendingTokenRef.current.set(key, token);
      const state = { canceled: false };
      cancels.set(key, () => {
        state.canceled = true;
      });
      (async () => {
        try {
          const { resolvedUrl, gltf } = await acquireGLTF({ url: urlToLoad, renderer: gl });
          if (state.canceled || pendingTokenRef.current.get(key) !== token) {
            releaseGLTF(resolvedUrl);
            return;
          }

          const inst = gltf?.scene ? gltf.scene.clone(true) : null;
          if (!inst) {
            releaseGLTF(resolvedUrl);
            return;
          }
          inst.name = `Accessory_${key}`;
          disableShadowsAndEnableCulling(inst);
          const paintMap = accessoryColors && typeof accessoryColors === 'object' ? accessoryColors : {};
          const paintColor = normalizeHex(paintMap[key] || paintMap[String(s?.type || '').trim()] || '');
          applyAccessoryPaintOverride(inst, paintColor);
          const anchor = ensureAnchor(key, s?.type, s?.socket);
          if (!anchor) {
            releaseGLTF(resolvedUrl);
            return;
          }

          const offsetKey = String(s?.offsetKey || getOffsetKeyFromUrl(urlToLoad) || '').trim();
          const store = buildOffsetsStore();
          inst.userData = { ...(inst.userData || {}), sourceUrl: urlToLoad, resolvedUrl, token, offsetKey, slotType: String(s?.type || '').trim() };
          normalizeAndAttach({
            accessory: inst,
            anchor,
            slot: s,
            offsetKey,
            offsetsStore: store,
            debug: Boolean(debugEnabled)
          });

          attachmentsRef.current.set(key, inst);
          onAttachmentObject?.(key, inst);
          onAttachmentsChange?.(Array.from(attachmentsRef.current.keys()));
          emitMeta();
        } catch {}
      })();
    }
    return () => {
      for (const cancel of cancels.values()) cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, slots, accessoryColors]);

  useEffect(() => {
    if (!ready) return;
    const paintMap = accessoryColors && typeof accessoryColors === 'object' ? accessoryColors : {};
    for (const [key, obj] of attachmentsRef.current.entries()) {
      const slotType = String(obj?.userData?.slotType || '').trim();
      const colorValue = normalizeHex(paintMap[key] || paintMap[slotType] || '');
      applyAccessoryPaintOverride(obj, colorValue);
    }
  }, [ready, accessoryColors]);

  useEffect(() => {
    return () => {
      const resolved = baseResolvedUrlRef.current;
      if (resolved) releaseGLTF(resolved);
      baseResolvedUrlRef.current = '';
      for (const obj of attachmentsRef.current.values()) {
        const r = String(obj?.userData?.resolvedUrl || '').trim();
        if (r) releaseGLTF(r);
      }
      attachmentsRef.current.clear();
    };
  }, []);

  return <group ref={rootRef} name="Bike" />;
};

const Scene = ({
  carModelUrl,
  color,
  paintTargets,
  slots,
  embeddedConfig,
  accessoryColors,
  onCarMeta,
  onHoverPart,
  onCamera,
  onMechanicalCollisions,
  initialCamera,
  viewerMode
}) => {
  const controlsRef = useRef(null);
  const modelRef = useRef(null);
  const attachmentsRef = useRef(new Map());
  const [debugAttachments, setDebugAttachments] = useState([]);
  const lastMechKeyRef = useRef('');
  const isPreview = String(viewerMode || '').trim().toLowerCase() === 'preview';

  const paint = useMemo(() => {
    if (!paintTargets || typeof paintTargets !== 'object') return null;
    return { baseColor: color, targets: paintTargets };
  }, [color, paintTargets]);

  const debugEnabled = useMemo(() => {
    try {
      if (typeof window === 'undefined') return false;
      const v = new URLSearchParams(window.location.search).get('debug3d');
      return v === '1' || v === 'true';
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (!onMechanicalCollisions) return;
    const root = modelRef.current;
    if (!root) return;

    const raf = requestAnimationFrame(() => {
      const root2 = modelRef.current;
      if (!root2) return;
      root2.updateWorldMatrix(true, true);
      const inv = new Matrix4().copy(root2.matrixWorld).invert();

      const boxes = [];
      for (const [key, obj] of attachmentsRef.current.entries()) {
        if (!key || !obj) continue;
        const cached = obj?.userData?.__rootBox;
        if (cached && Array.isArray(cached.min) && Array.isArray(cached.max)) {
          boxes.push({ key, min: cached.min, max: cached.max });
          continue;
        }
        try {
          obj.updateWorldMatrix(true, true);
          const world = new Box3().setFromObject(obj);
          if (world.isEmpty()) continue;
          const local = world.clone().applyMatrix4(inv);
          const min = [local.min.x, local.min.y, local.min.z];
          const max = [local.max.x, local.max.y, local.max.z];
          obj.userData = { ...(obj.userData || {}), __rootBox: { min, max } };
          boxes.push({ key, min, max });
        } catch {}
      }

      const hits = [];
      const intersects = (a, b) =>
        a.min[0] <= b.max[0] &&
        a.max[0] >= b.min[0] &&
        a.min[1] <= b.max[1] &&
        a.max[1] >= b.min[1] &&
        a.min[2] <= b.max[2] &&
        a.max[2] >= b.min[2];

      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          const a = boxes[i];
          const b = boxes[j];
          if (!a || !b) continue;
          if (intersects(a, b)) hits.push([a.key, b.key]);
        }
      }

      hits.sort((x, y) => `${x[0]}|${x[1]}`.localeCompare(`${y[0]}|${y[1]}`));
      const key = JSON.stringify(hits);
      if (key !== lastMechKeyRef.current) {
        lastMechKeyRef.current = key;
        onMechanicalCollisions(hits);
      }
    });

    return () => cancelAnimationFrame(raf);
  }, [carModelUrl, debugAttachments, onMechanicalCollisions, slots]);

  return (
    <>
      <ambientLight intensity={0.75} />
      <directionalLight position={[6, 6, 5]} intensity={1.05} />
      <Environment preset="studio" />

      <OrbitControls
        ref={controlsRef}
        enableDamping={!isPreview}
        dampingFactor={0.05}
        enableZoom={!isPreview}
        enablePan={!isPreview}
        enableRotate={!isPreview}
        autoRotate={false}
        rotateSpeed={1.0}
        zoomSpeed={1.2}
        panSpeed={0.8}
        minDistance={0.25}
        maxDistance={40}
        minPolarAngle={0}
        maxPolarAngle={Math.PI}
        minAzimuthAngle={-Infinity}
        maxAzimuthAngle={Infinity}
      />

      <Suspense fallback={null}>
        <group
          onPointerMove={(e) => {
            if (!onHoverPart) return;
            const label = String(e?.object?.name || '').trim();
            if (!label) return;
            onHoverPart({ label, x: e.clientX, y: e.clientY });
          }}
          onPointerOut={() => onHoverPart?.(null)}
        >
          <OffsetDebugPanel
            enabled={debugEnabled}
            getAttachmentsSnapshot={() => debugAttachments}
            getOffsetKeyForAttachment={(attachmentKey) => {
              const a = attachmentsRef.current.get(String(attachmentKey || ''));
              const url = String(a?.userData?.sourceUrl || '').trim();
              return a?.userData?.offsetKey || getOffsetKeyFromUrl(url);
            }}
            onApply={({ attachmentKey, offsetKey, store }) => {
              const a = attachmentsRef.current.get(String(attachmentKey || ''));
              if (!a) return;
              a.userData = { ...(a.userData || {}), offsetKey: String(offsetKey || '').trim() };
              applyAccessoryOffset(a, offsetKey, store);
            }}
            onSave={({ offsetKey }) => {
              const k = normalizeOffsetKey(offsetKey);
              const store = buildOffsetsStore();
              const v = store[k];
              if (!v) return;
              console.log('Saved accessory offset:', k, v);
            }}
            onLog={({ offsetKey, offset }) => {
              const k = normalizeOffsetKey(offsetKey);
              console.log('Accessory offset draft:', k, offset);
            }}
          />
          <BikeRig
            url={carModelUrl}
            color={color}
            paintTargets={paint?.targets}
            slots={slots}
            embeddedConfig={embeddedConfig}
            accessoryColors={accessoryColors}
            onMeta={onCarMeta}
            onObject={(o) => (modelRef.current = o)}
            onAttachmentsChange={(keys) => {
              const arr = Array.isArray(keys) ? keys : [];
              setDebugAttachments(arr);
            }}
            onAttachmentObject={(key, obj) => {
              const k = String(key || '').trim();
              if (!k) return;
              if (!obj) attachmentsRef.current.delete(k);
              else attachmentsRef.current.set(k, obj);
            }}
            debugEnabled={debugEnabled}
          />
        </group>
      </Suspense>

      <FitCamera modelRef={modelRef} controlsRef={controlsRef} initialCamera={initialCamera} onCamera={onCamera} viewerMode={viewerMode} />
    </>
  );
};

const CarViewer = ({
  className = '',
  carModelUrl,
  color,
  paintTargets,
  accessoryColors,
  onCarMeta,
  onHoverPart,
  onCamera,
  onMechanicalCollisions,
  initialCamera,
  background = 'transparent',
  slots = [],
  embeddedConfig = {},
  viewerMode,
  backgroundPreset
}) => {
  const { t } = useI18n();
  const errorText = t('viewer_load_failed');
  const isPreview = String(viewerMode || '').trim().toLowerCase() === 'preview';
  const resolveBgUrl = (url) => {
    const API_BASE_URL = getApiBaseUrl();
    const u = String(url || '').trim();
    if (!u) return '';
    if (u.startsWith('data:') || u.startsWith('blob:')) return u;
    if (u.startsWith('http://') || u.startsWith('https://')) return u;
    if (u.startsWith('/')) return `${API_BASE_URL}${u}`;
    return `${API_BASE_URL}/${u}`;
  };

  const style = useMemo(() => {
    if (backgroundPreset && typeof backgroundPreset === 'object') {
      const kind = String(backgroundPreset?.kind || '').trim();
      const css = String(backgroundPreset?.css || '').trim();
      const colorValue = String(backgroundPreset?.color || '').trim();
      const imageUrl = kind === 'image' ? resolveBgUrl(backgroundPreset?.imageUrl || '') : '';
      if (kind === 'image' && imageUrl) {
        return {
          backgroundColor: '#0b0b0b',
          backgroundImage: `url('${imageUrl}')`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          backgroundSize: 'cover'
        };
      }
      if (kind === 'gradient' && css) return { background: css };
      if (kind === 'color' && colorValue) return { background: colorValue };
    }
    if (background && String(background) !== 'transparent') return { background: String(background) };
    return { background: 'transparent' };
  }, [
    background,
    backgroundPreset?.kind,
    backgroundPreset?.css,
    backgroundPreset?.color,
    backgroundPreset?.imageUrl
  ]);

  return (
    <div className={`relative w-full overflow-hidden rounded-lg border border-zinc-800 ${className}`} style={style}>
      <CarViewerErrorBoundary errorText={errorText}>
        <Canvas
          camera={{ position: [2.1, 1.25, 3.1], fov: 45 }}
          dpr={[1, 1.75]}
          gl={{ alpha: true, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: !isPreview }}
          style={{ background: 'transparent', touchAction: 'none' }}
        >
        <Scene
            carModelUrl={carModelUrl}
            color={color}
            paintTargets={paintTargets}
            accessoryColors={accessoryColors}
            slots={slots}
            embeddedConfig={embeddedConfig}
            onCarMeta={onCarMeta}
            onHoverPart={onHoverPart}
            onCamera={onCamera}
          onMechanicalCollisions={onMechanicalCollisions}
            initialCamera={initialCamera}
            viewerMode={viewerMode}
          />
        </Canvas>
      </CarViewerErrorBoundary>
    </div>
  );
};

export default CarViewer;
