import { MathUtils, Object3D } from 'three';

const clampNum = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const clampVec3 = (value) => {
  const arr = Array.isArray(value) ? value : [0, 0, 0];
  return [clampNum(arr[0]), clampNum(arr[1]), clampNum(arr[2])];
};

export const buildAnchorsRuntime = ({ bikeRoot, anchors }) => {
  const root = bikeRoot;
  const list = Array.isArray(anchors) ? anchors : [];
  const map = new Map();
  if (!root) return map;

  for (const a of list) {
    const name = String(a?.name || '').trim();
    if (!name) continue;
    if (map.has(name)) continue;
    const pos = clampVec3(a?.position);
    const rotDeg = clampVec3(a?.rotation);
    const node = new Object3D();
    node.name = name;
    node.position.set(pos[0], pos[1], pos[2]);
    node.rotation.set(MathUtils.degToRad(rotDeg[0]), MathUtils.degToRad(rotDeg[1]), MathUtils.degToRad(rotDeg[2]));
    root.add(node);
    map.set(name, node);
  }
  return map;
};

export const attachPartToAnchor = (partModel, anchorName, { bikeRoot, anchorMap } = {}) => {
  const part = partModel;
  const name = String(anchorName || '').trim();
  if (!part || !name) return false;

  const root = bikeRoot;
  const map = anchorMap instanceof Map ? anchorMap : null;
  const anchor = (map && map.get(name)) || (root?.getObjectByName?.(name)) || null;
  if (!anchor) return false;

  part.position.set(0, 0, 0);
  part.quaternion.identity();
  part.scale.setScalar(1);
  anchor.add(part);
  return true;
};

