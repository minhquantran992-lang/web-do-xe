import { useGLTF } from '@react-three/drei';
import { useEffect, useMemo } from 'react';

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

const cloneWithMaterials = (scene) => {
  // useGLTF caches scene globally; we clone per-instance so color changes don't leak
  const cloned = scene.clone(true);
  cloned.traverse((obj) => {
    if (!obj || !obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = false;
    if (Array.isArray(obj.material)) {
      obj.material = obj.material.map((m) => (m?.clone ? m.clone() : m));
    } else if (obj.material?.clone) {
      obj.material = obj.material.clone();
    }
  });
  return cloned;
};

const applyColorToScene = (scene, color) => {
  // MVP colorization: apply to any material that has a .color
  scene.traverse((obj) => {
    if (!obj || !obj.isMesh) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) {
      if (m?.color?.set) m.color.set(color);
    }
  });
};

const applyPaintToScene = (scene, { baseColor, targets } = {}) => {
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

const Model = ({ url, color, paint, onMeta, onObject, ...props }) => {
  const resolvedUrl = resolveModelUrl(url);
  const { scene } = useGLTF(resolvedUrl);
  const cloned = useMemo(() => cloneWithMaterials(scene), [scene]);

  useEffect(() => {
    if (!onMeta) return;
    const mats = new Map();
    const nodes = new Set();
    cloned.traverse((obj) => {
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
    onMeta({ materials: Array.from(mats.values()), nodes: Array.from(nodes.values()) });
  }, [cloned, onMeta]);

  useEffect(() => {
    if (!onObject) return;
    onObject(cloned);
  }, [cloned, onObject]);

  useEffect(() => {
    if (paint && (paint.baseColor || paint.targets)) {
      applyPaintToScene(cloned, paint);
      return;
    }
    if (!color) return;
    applyColorToScene(cloned, color);
  }, [cloned, color, paint]);

  return <primitive object={cloned} {...props} />;
};

export default Model;
