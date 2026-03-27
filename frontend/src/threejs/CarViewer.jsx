import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, MeshReflectorMaterial, OrbitControls, PerformanceMonitor, SpotLight } from '@react-three/drei';
import React, { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Box3, Object3D, PCFSoftShadowMap, Quaternion, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

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
          Không tải được model 3D. Hãy kiểm tra lại đường dẫn model3d (URL .glb/.gltf) hoặc đảm bảo file tồn tại trong /public.
        </div>
      );
    }
    return this.props.children;
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

const resolveModelUrl = (url) => {
  const u = String(url || '').trim();
  if (!u) return '';
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  if (u.startsWith('/')) return `${API_BASE_URL}${u}`;
  return `${API_BASE_URL}/${u}`;
};

const normalizeName = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[\s\-_.]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim();

const classifyTarget = (normalizedKey) => {
  const key = String(normalizedKey || '');
  if (!key) return '';

  if (key.includes('wheel') || key.includes('rim') || key.includes('tire') || key.includes('tyre') || key.includes('banh') || key.includes('lop') || key.includes('mam'))
    return 'wheels';
  if (key.includes('exhaust') || key.includes('muffler') || key.includes('pipe') || key.includes('ong xa')) return 'exhaust';
  if (key.includes('engine') || key.includes('motor') || key.includes('dong co') || key.includes('may')) return 'engine';
  if (key.includes('seat') || key.includes('yen')) return 'seat';
  if (key.includes('frame') || key.includes('chassis') || key.includes('khung')) return 'frame';
  if (
    key.includes('body') ||
    key.includes('fairing') ||
    key.includes('tank') ||
    key.includes('paint') ||
    key.includes('carpaint') ||
    key.includes('vo') ||
    key.includes('dan ao')
  )
    return 'body';
  return '';
};

const applyColorToScene = (scene, color) => {
  if (!scene || !color) return;
  scene.traverse((obj) => {
    if (!obj || !obj.isMesh) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) {
      if (m?.color?.set) m.color.set(color);
    }
  });
};

const applyPaintToScene = (scene, { baseColor, targets } = {}) => {
  if (!scene) return;
  const targetColors = targets && typeof targets === 'object' ? targets : {};

  scene.traverse((obj) => {
    if (!obj || !obj.isMesh) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) {
      if (!m?.color?.set) continue;
      const materialKey = m?.uuid ? `mat:${m.uuid}` : '';
      const materialColor = materialKey ? targetColors[materialKey] : null;
      if (materialColor) {
        m.color.set(materialColor);
        continue;
      }
      const targetId = classifyTarget(normalizeName(`${obj?.name || ''} ${m?.name || ''}`));
      const targetColor = targetId ? targetColors[targetId] : null;
      if (targetColor) m.color.set(targetColor);
      else if (baseColor) m.color.set(baseColor);
    }
  });
};

const cloneSceneForInstance = (scene) => {
  const cloned = scene.clone(true);
  cloned.traverse((obj) => {
    if (!obj || !obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;
    if (obj.geometry?.clone) obj.geometry = obj.geometry.clone();
    if (Array.isArray(obj.material)) {
      obj.material = obj.material.map((m) => (m?.clone ? m.clone() : m));
    } else if (obj.material?.clone) {
      obj.material = obj.material.clone();
    }
  });
  return cloned;
};

const disposeObject = (root) => {
  if (!root) return;
  root.traverse((obj) => {
    if (obj?.geometry?.dispose) obj.geometry.dispose();
    const mats = Array.isArray(obj?.material) ? obj.material : obj?.material ? [obj.material] : [];
    for (const m of mats) {
      if (!m) continue;
      for (const v of Object.values(m)) {
        if (v && typeof v === 'object' && v.isTexture && v.dispose) v.dispose();
      }
      if (m.dispose) m.dispose();
    }
  });
};

const isAccessoryRoot = (obj) => {
  const name = String(obj?.name || '');
  if (name.startsWith('__accessory:')) return true;
  return Boolean(obj?.userData?.__isAccessoryRoot);
};

const isDescendantOfAccessory = (obj, carRoot) => {
  let p = obj;
  while (p && p !== carRoot) {
    if (isAccessoryRoot(p)) return true;
    p = p.parent;
  }
  return false;
};

const isStockPartOfType = (obj, type, carRoot) => {
  if (!obj) return false;
  if (isDescendantOfAccessory(obj, carRoot)) return false;

  const t = String(type || '').trim().toLowerCase();
  if (!t) return false;

  const name = String(obj?.name || '').trim().toLowerCase();
  const userType = String(obj?.userData?.type || '').trim().toLowerCase();
  const isStock = obj?.userData?.isStock === true;

  if (isStock && userType === t) return true;

  if (t === 'exhaust') {
    if (name.includes('exhaust')) return true;
    return false;
  }

  if (t === 'wheels' || t === 'tire') {
    if (name === 'stock_wheels' || name.startsWith('stock_wheels_')) return true;
    if (name === 'stock_tire' || name.startsWith('stock_tire_')) return true;
    if (name === 'stock_wheel' || name.startsWith('stock_wheel_')) return true;
    return false;
  }

  if (name === `stock_${t}` || name.startsWith(`stock_${t}_`)) return true;
  return false;
};

const setStockPartsVisible = (carRoot, type, visible) => {
  if (!carRoot) return;
  carRoot.traverse((obj) => {
    if (!isStockPartOfType(obj, type, carRoot)) return;
    obj.visible = Boolean(visible);
  });
};

const normalizeModel = (model, targetSize = 0.5) => {
  if (!model) return;
  model.updateWorldMatrix(true, true);

  const box = new Box3().setFromObject(model);
  if (box.isEmpty()) return;

  const center = box.getCenter(new Vector3());
  const size = box.getSize(new Vector3());

  model.position.sub(center);

  const maxAxis = Math.max(size.x, size.y, size.z);
  if (!maxAxis || !Number.isFinite(maxAxis)) return;
  const s = Number(targetSize) / maxAxis;
  if (!Number.isFinite(s) || s <= 0) return;

  model.scale.multiplyScalar(s);
  model.updateWorldMatrix(true, true);
};

const findBestNamedMesh = (carRoot, keywords) => {
  if (!carRoot) return null;
  const list = Array.isArray(keywords) ? keywords : [];
  const keys = list.map((k) => String(k || '').trim().toLowerCase()).filter(Boolean);
  if (!keys.length) return null;

  carRoot.updateWorldMatrix(true, true);
  let best = null;
  carRoot.traverse((obj) => {
    if (!obj?.isMesh) return;
    if (isDescendantOfAccessory(obj, carRoot)) return;
    const name = String(obj?.name || '').trim().toLowerCase();
    if (!name) return;
    if (!keys.some((k) => name.includes(k))) return;
    const box = new Box3().setFromObject(obj);
    if (box.isEmpty()) return;
    const size = box.getSize(new Vector3());
    const volume = size.x * size.y * size.z;
    const centerWorld = box.getCenter(new Vector3());
    const quatWorld = new Quaternion();
    obj.getWorldQuaternion(quatWorld);
    const maxAxis = Math.max(size.x, size.y, size.z);
    const score = Number.isFinite(volume) ? volume : 0;
    if (!best || score > best.score) best = { score, centerWorld, quatWorld, size, maxAxis };
  });
  return best;
};

const centerModelAtOrigin = (root) => {
  if (!root) return;
  root.updateWorldMatrix(true, true);
  const box = new Box3().setFromObject(root);
  if (box.isEmpty()) return;
  const center = box.getCenter(new Vector3());
  root.position.sub(center);
  root.updateWorldMatrix(true, true);
};

const findWheelCenters = (carRoot) => {
  if (!carRoot) return null;
  const hits = [];
  carRoot.updateWorldMatrix(true, true);
  carRoot.traverse((obj) => {
    if (!obj?.isMesh) return;
    if (isDescendantOfAccessory(obj, carRoot)) return;
    const name = String(obj?.name || '').trim().toLowerCase();
    if (!name) return;
    if (
      !name.includes('wheel') &&
      !name.includes('tire') &&
      !name.includes('tyre') &&
      !name.includes('banh') &&
      !name.includes('lop') &&
      !name.includes('mam')
    )
      return;
    const box = new Box3().setFromObject(obj);
    if (box.isEmpty()) return;
    const centerWorld = box.getCenter(new Vector3());
    const local = carRoot.worldToLocal(centerWorld.clone());
    hits.push({ local, centerWorld });
  });

  if (hits.length < 2) return null;
  hits.sort((a, b) => a.local.z - b.local.z);
  const rear = hits[0];
  const front = hits[hits.length - 1];
  return { front: front.centerWorld, rear: rear.centerWorld };
};

const getOrCreateSocket = (carRoot, socketName) => {
  if (!carRoot) return null;
  const existing = carRoot.getObjectByName(socketName);
  if (existing) return existing;

  const box = new Box3().setFromObject(carRoot);
  const size = new Vector3();
  box.getSize(size);
  const center = new Vector3();
  box.getCenter(center);

  const socket = new Object3D();
  socket.name = socketName;
  socket.userData.__implicit = true;

  const baseY = box.min.y + size.y * 0.18;
  const frontZ = box.max.z - size.z * 0.18;
  const rearZ = box.min.z + size.z * 0.18;

  const n = String(socketName || '');

  const wheelCenters = n.includes('wheel') || n.includes('tire') ? findWheelCenters(carRoot) : null;
  if ((n === 'front_wheel_socket' || n === 'front_wheel_mount') && wheelCenters?.front) {
    socket.position.copy(carRoot.worldToLocal(wheelCenters.front.clone()));
  } else if ((n === 'rear_wheel_socket' || n === 'rear_wheel_mount') && wheelCenters?.rear) {
    socket.position.copy(carRoot.worldToLocal(wheelCenters.rear.clone()));
  } else if (n === 'exhaust_socket' || n === 'exhaust_mount') {
    const hit = findBestNamedMesh(carRoot, ['exhaust', 'muffler', 'pipe', 'ong xa', 'ong_xa', 'ongxa']);
    if (hit?.centerWorld) {
      socket.position.copy(carRoot.worldToLocal(hit.centerWorld.clone()));
      const rootQ = new Quaternion();
      carRoot.getWorldQuaternion(rootQ);
      socket.quaternion.copy(rootQ.invert().multiply(hit.quatWorld.clone()));
    } else {
      socket.position.set(center.x + size.x * 0.22, baseY + size.y * 0.08, rearZ);
    }
  } else if (n === 'handlebar_mount') {
    const hit = findBestNamedMesh(carRoot, ['handlebar', 'bar', 'steer', 'ghi dong', 'ghidong']);
    if (hit?.centerWorld) socket.position.copy(carRoot.worldToLocal(hit.centerWorld.clone()));
    else socket.position.set(center.x, box.min.y + size.y * 0.55, frontZ - size.z * 0.08);
  } else if (n === 'seat_mount') {
    const hit = findBestNamedMesh(carRoot, ['seat', 'yen']);
    if (hit?.centerWorld) socket.position.copy(carRoot.worldToLocal(hit.centerWorld.clone()));
    else socket.position.set(center.x, box.min.y + size.y * 0.45, rearZ + size.z * 0.08);
  } else if (n === 'bodykit_socket' || n === 'bodykit_mount') {
    const hit = findBestNamedMesh(carRoot, ['body', 'fairing', 'cowl', 'dan ao', 'danao', 'vo']);
    if (hit?.centerWorld) socket.position.copy(carRoot.worldToLocal(hit.centerWorld.clone()));
    else socket.position.set(center.x, box.min.y + size.y * 0.45, center.z);
  } else if (n === 'front_wheel_socket' || n === 'front_wheel_mount') {
    socket.position.set(center.x, baseY, frontZ);
  } else if (n === 'rear_wheel_socket' || n === 'rear_wheel_mount') {
    socket.position.set(center.x, baseY, rearZ);
  } else {
    socket.position.copy(center);
  }

  carRoot.add(socket);
  return socket;
};

const Scene = ({
  carModelUrl,
  color,
  paintTargets,
  onCarMeta,
  wheelModelUrl,
  bodykitModelUrls,
  exhaustModelUrl,
  wheelScale,
  bodykitScale,
  exhaustScale,
  slots,
  allowImplicitSockets = true,
  background = 'gray',
  backgroundPreset = null,
  perf = 'high'
}) => {
  const [carRoot, setCarRoot] = useState(null);
  const { camera, gl } = useThree();
  const controlsRef = useRef(null);
  const loader = useMemo(() => new GLTFLoader(), []);
  const gltfCacheRef = useRef(new Map());
  const slotTokensRef = useRef(new Map());
  const socketsRef = useRef(new Map());
  const animatingRef = useRef(new Set());
  const fitTokenRef = useRef('');

  const preset = backgroundPreset && typeof backgroundPreset === 'object' ? backgroundPreset : null;
  const presetKind = String(preset?.kind || '').trim();
  const backgroundKey = String(background || 'gray');
  const showroomMode = presetKind === 'image' || preset?.key === 'showroom' || backgroundKey === 'showroom';
  const stageMode = preset?.key === 'stage' || backgroundKey === 'stage';
  const garageMode = preset?.key === 'garage' || backgroundKey === 'garage';
  const studioMode = preset?.key === 'dark-studio' || backgroundKey === 'dark-studio';
  const groundedMode = showroomMode || stageMode || garageMode || studioMode || Boolean(backgroundKey);

  useEffect(() => {
    return () => {
      controlsRef.current?.dispose?.();
      gl?.dispose?.();
    };
  }, [gl]);

  useEffect(() => {
    if (!carRoot) return;
    carRoot.traverse((obj) => {
      if (!obj?.isMesh) return;
      obj.castShadow = true;
      obj.receiveShadow = true;
      const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
      for (const m of mats) {
        if (!m) continue;
        if (typeof m.shadowSide === 'number') m.shadowSide = m.shadowSide;
      }
    });
  }, [carRoot]);

  const wheelFinalScale = useMemo(() => (Number.isFinite(wheelScale) ? wheelScale : 1), [wheelScale]);
  const bodykitFinalScale = useMemo(() => (Number.isFinite(bodykitScale) ? bodykitScale : 1), [bodykitScale]);
  const exhaustFinalScale = useMemo(() => (Number.isFinite(exhaustScale) ? exhaustScale : 1), [exhaustScale]);

  const activeBodykitUrl = useMemo(() => {
    const list = Array.isArray(bodykitModelUrls) ? bodykitModelUrls.filter(Boolean) : [];
    return list.length ? list[list.length - 1] : '';
  }, [bodykitModelUrls]);

  const desiredSlots = useMemo(() => {
    const custom = Array.isArray(slots) ? slots : null;
    if (custom) return custom;
    return [
      { slot: 'exhaust', type: 'exhaust', socket: 'exhaust_socket', url: exhaustModelUrl, scale: exhaustFinalScale },
      { slot: 'front_wheel', type: 'wheels', socket: 'front_wheel_socket', url: wheelModelUrl, scale: wheelFinalScale },
      { slot: 'rear_wheel', type: 'wheels', socket: 'rear_wheel_socket', url: wheelModelUrl, scale: wheelFinalScale },
      { slot: 'bodykit', type: 'bodykit', socket: 'bodykit_socket', url: activeBodykitUrl, scale: bodykitFinalScale }
    ];
  }, [activeBodykitUrl, bodykitFinalScale, exhaustFinalScale, exhaustModelUrl, slots, wheelFinalScale, wheelModelUrl]);

  const removeSlotAccessory = (slot, socketObj) => {
    if (!socketObj) return;
    const toRemove = socketObj.children.filter((c) => String(c?.name || '') === `__accessory:${slot}`);
    for (const child of toRemove) {
      animatingRef.current.delete(child);
      socketObj.remove(child);
      disposeObject(child);
    }
  };

  const getSocket = (socketName) => {
    if (!carRoot) return null;
    const existing = socketsRef.current.get(socketName);
    if (existing && existing.parent) return existing;
    const fromModel = carRoot.getObjectByName(socketName);
    if (fromModel) {
      socketsRef.current.set(socketName, fromModel);
      return fromModel;
    }
    if (!allowImplicitSockets) return null;

    const socket = getOrCreateSocket(carRoot, socketName);
    if (socket) socketsRef.current.set(socketName, socket);
    return socket;
  };

  const loadGLTF = (modelUrl) => {
    const resolved = resolveModelUrl(modelUrl);
    if (!resolved) return Promise.reject(new Error('MISSING_MODEL_URL'));
    const cache = gltfCacheRef.current;
    if (cache.has(resolved)) return cache.get(resolved);
    const p = loader.loadAsync(resolved);
    cache.set(resolved, p);
    return p;
  };

  useEffect(() => {
    let cancelled = false;
    const url = String(carModelUrl || '').trim();
    if (!url) {
      setCarRoot((prev) => {
        if (prev) disposeObject(prev);
        return null;
      });
      return () => {
        cancelled = true;
      };
    }

    loadGLTF(url)
      .then((gltf) => {
        if (cancelled) return;
        const raw = gltf?.scene || gltf?.scenes?.[0] || gltf;
        if (!raw) throw new Error('INVALID_GLTF');
        const inst = cloneSceneForInstance(raw);

        if (paintTargets && Object.keys(paintTargets).length) applyPaintToScene(inst, { baseColor: color, targets: paintTargets });
        else if (color) applyColorToScene(inst, color);

        if (onCarMeta) {
          const mats = new Map();
          const nodes = new Set();
          inst.traverse((obj) => {
            const objName = String(obj?.name || '').trim();
            if (objName) nodes.add(objName);
            if (!obj || !obj.isMesh) return;
            const arr = Array.isArray(obj.material) ? obj.material : [obj.material];
            for (const m of arr) {
              if (!m || !m.uuid) continue;
              const key = `mat:${m.uuid}`;
              const existing = mats.get(key);
              const name = String(m.name || '').trim();
              const meshName = String(obj.name || '').trim();
              const category = classifyTarget(normalizeName(`${meshName} ${name}`));
              if (!existing) {
                mats.set(key, { key, name, meshName, category });
                continue;
              }
              if (!existing.name && name) existing.name = name;
              if (!existing.meshName && meshName) existing.meshName = meshName;
              if (!existing.category && category) existing.category = category;
            }
          });
          onCarMeta({ materials: Array.from(mats.values()), nodes: Array.from(nodes.values()) });
        }

        setCarRoot((prev) => {
          if (prev) disposeObject(prev);
          return inst;
        });
      })
      .catch(() => {
        if (cancelled) return;
        setCarRoot((prev) => {
          if (prev) disposeObject(prev);
          return null;
        });
      });

    return () => {
      cancelled = true;
    };
  }, [carModelUrl, onCarMeta, loader]);

  useEffect(() => {
    if (!carRoot) return;
    if (paintTargets && Object.keys(paintTargets).length) applyPaintToScene(carRoot, { baseColor: color, targets: paintTargets });
    else if (color) applyColorToScene(carRoot, color);
  }, [carRoot, color, paintTargets]);

  const pickSocketName = (socket) => {
    const list = Array.isArray(socket) ? socket : [socket];
    const names = list.map((x) => String(x || '').trim()).filter(Boolean);
    if (!names.length) return '';
    if (!carRoot) return names[0];
    for (const n of names) {
      const existing = carRoot.getObjectByName(n);
      if (existing) return n;
    }
    return names[0];
  };

  const attachToSlot = async ({ slot, type, socket, url, scale, autoScale, targetSize }) => {
    const socketName = pickSocketName(socket);
    const socketObj = getSocket(socketName);
    if (!socketObj) return;

    const token = (slotTokensRef.current.get(slot) || 0) + 1;
    slotTokensRef.current.set(slot, token);

    removeSlotAccessory(slot, socketObj);

    const modelUrl = String(url || '').trim();
    if (!modelUrl) return;

    const gltf = await loadGLTF(modelUrl).catch(() => null);
    if (!gltf) return;
    if (slotTokensRef.current.get(slot) !== token) return;

    const inst = cloneSceneForInstance(gltf.scene || gltf.scenes?.[0] || gltf);
    inst.name = `__accessory:${slot}`;
    inst.userData.type = String(type || slot || '').trim();
    inst.userData.isStock = false;
    inst.userData.__isAccessoryRoot = true;
    inst.position.set(0, 0, 0);
    inst.rotation.set(0, 0, 0);
    inst.scale.setScalar(1);

    const isExhaust = String(inst.userData.type || '').trim().toLowerCase() === 'exhaust';
    const exhaustFit = isExhaust ? findBestNamedMesh(carRoot, ['exhaust', 'muffler', 'pipe', 'ong xa', 'ong_xa', 'ongxa']) : null;

    if (isExhaust && exhaustFit && socketObj?.userData?.__implicit === true) {
      socketObj.position.copy(carRoot.worldToLocal(exhaustFit.centerWorld.clone()));
      const rootQ = new Quaternion();
      carRoot.getWorldQuaternion(rootQ);
      socketObj.quaternion.copy(rootQ.invert().multiply(exhaustFit.quatWorld.clone()));
      socketObj.updateWorldMatrix(true, true);
    }

    centerModelAtOrigin(inst);

    if (isExhaust && exhaustFit && Number.isFinite(exhaustFit.maxAxis) && exhaustFit.maxAxis > 0) {
      inst.updateWorldMatrix(true, true);
      const box = new Box3().setFromObject(inst);
      if (!box.isEmpty()) {
        const size = new Vector3();
        box.getSize(size);
        const maxAxis = Math.max(size.x, size.y, size.z);
        if (maxAxis > 0 && Number.isFinite(maxAxis)) {
          const k = exhaustFit.maxAxis / maxAxis;
          const clamped = Math.min(5, Math.max(0.2, k));
          inst.scale.multiplyScalar(clamped);
        }
      }
    } else if (autoScale && Number.isFinite(Number(targetSize)) && Number(targetSize) > 0) {
      inst.updateWorldMatrix(true, true);
      const box = new Box3().setFromObject(inst);
      if (!box.isEmpty()) {
        const size = new Vector3();
        box.getSize(size);
        const maxAxis = Math.max(size.x, size.y, size.z);
        if (maxAxis > 0 && Number.isFinite(maxAxis)) {
          const k = Number(targetSize) / maxAxis;
          if (Number.isFinite(k) && k > 0) inst.scale.multiplyScalar(k);
        }
      }
    }

    inst.scale.multiplyScalar(Number.isFinite(scale) ? scale : 1);
    socketObj.add(inst);
    setStockPartsVisible(carRoot, inst.userData.type, false);

    const target = inst.scale.clone();
    inst.scale.copy(target).multiplyScalar(0.85);
    inst.userData.__targetScale = target;
    inst.userData.__animT = 0;
    animatingRef.current.add(inst);
  };

  useEffect(() => {
    socketsRef.current = new Map();
    slotTokensRef.current = new Map();
    animatingRef.current = new Set();
    return () => {
      socketsRef.current = new Map();
      slotTokensRef.current = new Map();
      animatingRef.current = new Set();
    };
  }, [carRoot]);

  useFrame((_state, delta) => {
    const items = animatingRef.current;
    if (!items.size) return;
    for (const obj of items) {
      if (!obj || !obj.parent) {
        items.delete(obj);
        continue;
      }
      const target = obj.userData.__targetScale;
      if (!target) {
        items.delete(obj);
        continue;
      }
      const nextT = Math.min(1, Number(obj.userData.__animT || 0) + delta * 5);
      obj.userData.__animT = nextT;
      const eased = 1 - Math.pow(1 - nextT, 3);
      const k = 0.85 + (1 - 0.85) * eased;
      obj.scale.copy(target).multiplyScalar(k);
      if (nextT >= 1) items.delete(obj);
    }
  });

  useEffect(() => {
    if (!carRoot) return;
    let alive = true;
    (async () => {
      for (const s of desiredSlots) {
        if (!alive) return;
        await attachToSlot(s);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carRoot, desiredSlots]);

  useEffect(() => {
    if (!carRoot) return;
    const activeTypes = new Set(
      (Array.isArray(desiredSlots) ? desiredSlots : [])
        .map((s) => String(s?.type || s?.slot || '').trim())
        .filter(Boolean)
    );

    const knownTypes = new Set();
    carRoot.traverse((obj) => {
      if (isDescendantOfAccessory(obj, carRoot)) return;
      const name = String(obj?.name || '').trim().toLowerCase();
      if (!name) return;

      const userType = String(obj?.userData?.type || '').trim();
      if (obj?.userData?.isStock === true && userType) knownTypes.add(userType);

      if (name.includes('exhaust')) knownTypes.add('exhaust');

      if (name.startsWith('stock_')) {
        const rest = name.slice('stock_'.length);
        const base = rest.split(/[_:]/)[0];
        if (base) knownTypes.add(base);
        if (base === 'wheel') knownTypes.add('wheels');
        if (base === 'wheels') knownTypes.add('wheels');
        if (base === 'tire') knownTypes.add('tire');
      }
    });

    for (const t of knownTypes) {
      if (!activeTypes.has(t)) setStockPartsVisible(carRoot, t, true);
    }
  }, [carRoot, desiredSlots]);

  useLayoutEffect(() => {
    if (!carRoot) return;
    const fitToken = `${showroomMode ? 'showroom' : stageMode ? 'stage' : garageMode ? 'garage' : studioMode ? 'studio' : 'other'}:${String(preset?.key || '')}:${String(carModelUrl || '')}`;
    if (fitTokenRef.current === fitToken) return;
    fitTokenRef.current = fitToken;

    // Fix model position (Box3): scale if too small, center X/Z, then snap bottom to y=0
    carRoot.updateWorldMatrix(true, true);
    let box = new Box3().setFromObject(carRoot);
    if (box.isEmpty()) return;

    const size = box.getSize(new Vector3());
    const maxAxis = Math.max(size.x, size.y, size.z);
    if (Number.isFinite(maxAxis) && maxAxis > 0) {
      // Chuẩn hoá kích thước mọi loại xe (to hay nhỏ) về một kích thước chuẩn (khoảng 2.4)
      // để camera và orbit controls luôn hoạt động hoàn hảo.
      const targetSize = 2.4;
      const k = targetSize / maxAxis;
      const clampedK = Math.min(20, Math.max(0.05, k));
      carRoot.scale.multiplyScalar(clampedK);
    }

    carRoot.updateWorldMatrix(true, true);
    box = new Box3().setFromObject(carRoot);
    if (box.isEmpty()) return;

    const center = box.getCenter(new Vector3());
    carRoot.position.x -= center.x;
    carRoot.position.z -= center.z;

    carRoot.updateWorldMatrix(true, true);
    box = new Box3().setFromObject(carRoot);
    if (box.isEmpty()) return;
    carRoot.position.y -= box.min.y;
    carRoot.position.y += 0.001;

    carRoot.updateWorldMatrix(true, true);
    box = new Box3().setFromObject(carRoot);
    if (!box.isEmpty()) {
      const postSize = box.getSize(new Vector3());
      // Hạ targetY xuống một chút (0.35 thay vì 0.5) để camera nhìn thấp xuống, 
      // qua đó đẩy xe lên cao hơn trên màn hình, tránh bị che bởi menu UI bên dưới.
      const targetY = postSize.y * 0.35;
      if (controlsRef.current) {
        controlsRef.current.target.set(0, targetY, 0);
        controlsRef.current.update();
      }
    }

    if (showroomMode) {
      carRoot.rotation.y = 0.55;
    } else if (studioMode || garageMode || stageMode) {
      carRoot.rotation.y = 0.5; // Góc nhìn chéo 3/4 để thấy rõ xe
    }
  }, [carRoot, showroomMode, preset?.key, carModelUrl]);

  useEffect(() => {
    if (!groundedMode) return;
    
    // Nếu xe đã load, ta muốn giữ nguyên target Y của nó. Nếu chưa, dùng 0.65 mặc định.
    const currentTargetY = controlsRef.current ? controlsRef.current.target.y : 0.65;
    const finalTargetY = currentTargetY > 0 ? currentTargetY : 0.65;

    if (studioMode) {
      // Đẩy camera lùi ra xa và nâng cao lên để bao quát toàn xe, nhường không gian cho UI
      camera.position.set(0, 1.35, 4.0);
      camera.fov = 45;
      camera.near = 0.05;
      camera.far = 200;
      camera.updateProjectionMatrix();
      camera.lookAt(0, finalTargetY, 0);
      camera.rotation.z = 0;
      if (controlsRef.current) {
        controlsRef.current.target.set(0, finalTargetY, 0);
        controlsRef.current.update();
      }
      return;
    }

    if (garageMode) {
      camera.position.set(0, 1.35, 4.2);
      camera.fov = 45;
      camera.near = 0.05;
      camera.far = 200;
      camera.updateProjectionMatrix();
      camera.lookAt(0, finalTargetY, 0);
      camera.rotation.z = 0;
      if (controlsRef.current) {
        controlsRef.current.target.set(0, finalTargetY, 0);
        controlsRef.current.update();
      }
      return;
    }

    if (showroomMode || stageMode) {
      camera.position.set(2.5, 1.35, 3.8);
      camera.fov = 45;
      camera.near = 0.05;
      camera.far = 200;
      camera.updateProjectionMatrix();
      camera.lookAt(0, finalTargetY, 0);
      camera.rotation.z = -0.015;
      if (controlsRef.current) {
        controlsRef.current.target.set(0, finalTargetY, 0);
        controlsRef.current.update();
      }
      return;
    }

    camera.position.set(2.8, 1.45, 4.0);
    camera.fov = 42;
    camera.near = 0.05;
    camera.far = 200;
    camera.updateProjectionMatrix();
    camera.lookAt(0, finalTargetY, 0);
    camera.rotation.z = -0.008;
    if (controlsRef.current) {
      controlsRef.current.target.set(0, finalTargetY, 0);
      controlsRef.current.update();
    }
  }, [camera, groundedMode, showroomMode, stageMode, garageMode, studioMode, backgroundKey]);

  const perfHigh = String(perf) !== 'low';

  return (
    <>
      {garageMode && <fog attach="fog" args={['#05070a', 5, 25]} />}
      {/* Lighting + environment (studio-like) */}
      <ambientLight intensity={studioMode ? 0.6 : garageMode ? 0.25 : stageMode ? 0.2 : showroomMode ? (perfHigh ? 0.55 : 0.5) : (perfHigh ? 0.7 : 0.6)} />
      
      {!stageMode && !garageMode && !studioMode && (
        <directionalLight
          position={showroomMode ? [-3.5, 6.5, 3.5] : [5, 5, 5]}
          intensity={showroomMode ? (perfHigh ? 1.25 : 1.1) : (perfHigh ? 1.1 : 0.95)}
          castShadow
          shadow-mapSize-width={perfHigh ? 1024 : 512}
          shadow-mapSize-height={perfHigh ? 1024 : 512}
          shadow-camera-near={0.1}
          shadow-camera-far={40}
          shadow-camera-left={-10}
          shadow-camera-right={10}
          shadow-camera-top={10}
          shadow-camera-bottom={-10}
          shadow-bias={-0.00035}
          shadow-normalBias={0.04}
        />
      )}

      {studioMode && (
        <group>
          {/* Key light: Above front */}
          <SpotLight position={[2, 3, -4]} angle={0.4} penumbra={0.8} intensity={1.2} distance={15} color="#ffffff" castShadow={false} />
          {/* Fill light: Left */}
          <SpotLight position={[-4, 2, 0]} angle={0.6} penumbra={0.9} intensity={0.6} distance={15} color="#ffffff" castShadow={false} />
          {/* Fill light: Right */}
          <SpotLight position={[4, 2, 0]} angle={0.6} penumbra={0.9} intensity={0.6} distance={15} color="#ffffff" castShadow={false} />
        </group>
      )}

      {garageMode && (
        <group>
          {/* Center soft overhead */}
          <SpotLight position={[0, 6, 0]} angle={0.8} penumbra={1} intensity={1.5} distance={15} color="#e0e8f0" castShadow={false} opacity={0.2} attenuation={5} anglePower={3} />
          {/* Left cool light */}
          <SpotLight position={[-4, 4, 2]} angle={0.6} penumbra={1} intensity={1.2} distance={15} color="#aaccff" castShadow={false} opacity={0.2} attenuation={5} />
          {/* Right cool light */}
          <SpotLight position={[4, 4, 2]} angle={0.6} penumbra={1} intensity={1.2} distance={15} color="#aaccff" castShadow={false} opacity={0.2} attenuation={5} />
          {/* Back subtle neon green accent */}
          <SpotLight position={[0, 2, -5]} angle={1.2} penumbra={1} intensity={1.5} distance={12} color="#00ff66" castShadow={false} opacity={0.1} />
        </group>
      )}

      {stageMode && (
        <group>
          {/* Main center spotlight */}
          <SpotLight
            position={[0, 6, 0]}
            angle={0.5}
            penumbra={0.8}
            intensity={2}
            distance={12}
            color="#ffffff"
            castShadow
            shadow-mapSize-width={perfHigh ? 1024 : 512}
            shadow-mapSize-height={perfHigh ? 1024 : 512}
            shadow-bias={-0.00035}
            opacity={0.3}
            attenuation={5}
            anglePower={4}
          />
          {/* Left accent light */}
          <SpotLight
            position={[-4, 5, 2]}
            angle={0.4}
            penumbra={1}
            intensity={2}
            distance={12}
            color="#55ff88"
            castShadow
            opacity={0.4}
            attenuation={4}
            anglePower={5}
          />
          {/* Right accent light */}
          <SpotLight
            position={[4, 5, 2]}
            angle={0.4}
            penumbra={1}
            intensity={2}
            distance={12}
            color="#55ff88"
            castShadow
            opacity={0.4}
            attenuation={4}
            anglePower={5}
          />
          {/* Back light for rim lighting */}
          <SpotLight
            position={[0, 4, -5]}
            angle={0.6}
            penumbra={0.5}
            intensity={1.5}
            distance={10}
            color="#aaffcc"
            opacity={0.1}
          />
        </group>
      )}

      <Environment preset={showroomMode || stageMode || garageMode || studioMode ? 'warehouse' : 'studio'} blur={showroomMode || stageMode || garageMode || studioMode ? (perfHigh ? 0.35 : 0.2) : 0} />
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableDamping
        dampingFactor={0.04}
        rotateSpeed={0.7}
        zoomSpeed={0.8}
        minDistance={showroomMode || stageMode || garageMode || studioMode ? 1.5 : 1.2}
        maxDistance={showroomMode || stageMode || garageMode || studioMode ? 6.5 : 7.0}
        minPolarAngle={Math.PI * 0.05}
        maxPolarAngle={Math.PI / 2 - 0.02}
      />

      {/* Ground plane at y = 0 (invisible when not showroom; only shows shadows) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        {showroomMode || stageMode || garageMode || studioMode ? (
          <MeshReflectorMaterial
            transparent
            opacity={perfHigh ? 0.9 : 0.85}
            blur={studioMode ? [200, 80] : garageMode ? [300, 100] : perfHigh ? [120, 60] : [60, 30]}
            mixBlur={studioMode ? 0.6 : garageMode ? 0.8 : perfHigh ? 0.5 : 0.35}
            mixStrength={studioMode ? 0.15 : garageMode ? 0.1 : perfHigh ? 0.25 : 0.18}
            roughness={studioMode ? 0.7 : garageMode ? 0.6 : perfHigh ? 0.85 : 0.9}
            metalness={0.0}
            depthScale={perfHigh ? 0.15 : 0.12}
            minDepthThreshold={0.2}
            maxDepthThreshold={1}
            color={studioMode ? "#0a0c12" : garageMode ? "#0a0d14" : stageMode ? "#050806" : "#1a1a1a"}
          />
        ) : (
          <shadowMaterial transparent opacity={perfHigh ? 0.28 : 0.22} />
        )}
      </mesh>

      <ContactShadows
        position={[0, 0.001, 0]}
        opacity={showroomMode || stageMode || garageMode || studioMode ? (perfHigh ? 0.75 : 0.6) : (perfHigh ? 0.6 : 0.5)}
        blur={showroomMode || stageMode || garageMode || studioMode ? (perfHigh ? 2.5 : 1.8) : (perfHigh ? 3.0 : 2.2)}
        far={showroomMode || stageMode || garageMode || studioMode ? (perfHigh ? 3.0 : 2.5) : (perfHigh ? 4.0 : 3.0)}
        width={showroomMode || stageMode || garageMode || studioMode ? (perfHigh ? 8 : 6) : (perfHigh ? 10 : 8)}
        height={showroomMode || stageMode || garageMode || studioMode ? (perfHigh ? 8 : 6) : (perfHigh ? 10 : 8)}
        resolution={perfHigh ? 512 : 256}
        color="#000000"
      />

      {carRoot ? <primitive object={carRoot} /> : null}
    </>
  );
};

const CarViewer = ({
  carModelUrl,
  color,
  paintTargets,
  onCarMeta,
  wheelModelUrl,
  bodykitModelUrls,
  exhaustModelUrl,
  wheelScale = 1,
  bodykitScale = 1,
  exhaustScale = 1,
  slots,
  allowImplicitSockets = true,
  background = 'gray',
  backgroundPreset = null,
  className = ''
}) => {
  const bg = String(background || 'gray');
  const [perf, setPerf] = React.useState('high');

  const resolveBackgroundUrl = (url) => {
    const u = String(url || '').trim();
    if (!u) return '';
    if (u.startsWith('http://') || u.startsWith('https://')) return u;
    if (u.startsWith('/')) return `${API_BASE_URL}${u}`;
    return `${API_BASE_URL}/${u}`;
  };

  const preset = backgroundPreset && typeof backgroundPreset === 'object' ? backgroundPreset : null;
  const presetKind = String(preset?.kind || '').trim();
  const presetColor = String(preset?.color || '').trim();
  const presetCss = String(preset?.css || '').trim();
  const presetImageUrl = String(preset?.imageUrl || '').trim();

  const imageUrl = presetKind === 'image' && presetImageUrl ? resolveBackgroundUrl(presetImageUrl) : '';

  const backgroundStyle =
    presetKind === 'image' && presetImageUrl
      ? {
          backgroundColor: '#0b0b0b',
          backgroundImage: `url('${imageUrl}')`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          backgroundSize: 'cover'
        }
      : presetKind === 'gradient' && presetCss
        ? { background: presetCss }
        : presetKind === 'color' && presetColor
          ? { background: presetColor }
          : bg === 'white'
            ? { background: '#ffffff' }
            : bg === 'sunset'
              ? { background: 'linear-gradient(180deg, #f9b9a1 0%, #b9d9ff 42%, #163a8a 43%, #091a3a 100%)' }
              : bg === 'sky'
                ? { background: 'linear-gradient(180deg, #cfe9ff 0%, #8bc1ff 55%, #2a4c85 56%, #102a4a 100%)' }
                : bg === 'studio'
                  ? { background: 'radial-gradient(circle at 50% 30%, #2a2a2a 0%, #0b0b0b 70%, #050505 100%)' }
                  : bg === 'showroom'
                    ? {
                        backgroundColor: '#0b0b0b',
                        backgroundImage:
                          "url('/bg/showroom.jpg'), radial-gradient(circle at 50% 35%, #ffffff 0%, #f2f2f2 55%, #d6d6d6 100%)",
                        backgroundRepeat: 'no-repeat, no-repeat',
                        backgroundPosition: 'center, center',
                        backgroundSize: 'cover, cover'
                      }
                  : bg === 'stage'
                    ? {
                        backgroundColor: '#050505',
                        backgroundImage: 'radial-gradient(ellipse at 50% 90%, #15251a 0%, #080d0a 40%, #020202 100%)',
                      }
                  : bg === 'garage'
                    ? {
                        backgroundColor: '#05070a',
                        backgroundImage: 'radial-gradient(circle at 50% 50%, #11141a 0%, #05070a 60%, #000000 100%)',
                      }
                  : bg === 'dark-studio'
                    ? {
                        backgroundColor: '#0a0c12',
                        backgroundImage: 'radial-gradient(circle at 50% 40%, #1a1f2e 0%, #0a0c12 50%, #000000 100%)',
                      }
                    : { background: '#e6e6e2' };
  return (
    <div
      className={`relative w-full overflow-hidden rounded-lg border border-zinc-800 ${className}`}
      style={imageUrl ? { background: '#0b0b0b' } : backgroundStyle}
    >
      {imageUrl ? (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url('${imageUrl}')`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center 55%',
            backgroundSize: 'cover',
            filter: 'blur(2.5px)',
            transform: 'scale(1.06)'
          }}
        />
      ) : null}
      <CarViewerErrorBoundary>
        <Canvas
          camera={{ position: [2.8, 1.45, 4.0], fov: 45 }}
          dpr={perf === 'high' ? [1, 1.5] : [1, 1]}
          shadows
          gl={{ alpha: true, antialias: perf === 'high', powerPreference: 'high-performance' }}
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0);
            gl.physicallyCorrectLights = true;
            gl.shadowMap.enabled = true;
            gl.shadowMap.type = PCFSoftShadowMap;
            gl.toneMappingExposure = perf === 'high' ? 1.05 : 0.98;
          }}
          style={{ background: 'transparent' }}
        >
          <PerformanceMonitor onDecline={() => setPerf('low')} onIncline={() => setPerf('high')}>
            <Suspense fallback={null}>
              <Scene
                carModelUrl={carModelUrl}
                color={color}
                paintTargets={paintTargets}
                onCarMeta={onCarMeta}
                wheelModelUrl={wheelModelUrl}
                bodykitModelUrls={bodykitModelUrls}
                exhaustModelUrl={exhaustModelUrl}
                wheelScale={wheelScale}
                bodykitScale={bodykitScale}
                exhaustScale={exhaustScale}
                slots={slots}
                allowImplicitSockets={allowImplicitSockets}
                background={background}
                backgroundPreset={backgroundPreset}
                perf={perf}
              />
            </Suspense>
          </PerformanceMonitor>
        </Canvas>
      </CarViewerErrorBoundary>
    </div>
  );
};

export default CarViewer;
