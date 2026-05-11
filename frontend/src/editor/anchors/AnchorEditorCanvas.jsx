import { OrbitControls, TransformControls, useGLTF } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Box3, Color, Vector3 } from 'three';
import { getApiBaseUrl } from '../../services/api/client.js';
import { clampNum, clampVec3, degToRad, radToDeg } from './anchorUtils.js';

const normalizeUrl = (value) => {
  const u = String(value || '').trim();
  if (!u) return '';
  if (u.startsWith('data:') || u.startsWith('blob:')) return u;
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  const base = getApiBaseUrl();
  if (u.startsWith('/')) return `${base}${u}`;
  return `${base}/${u}`;
};

class AnchorCanvasErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      const msg = String(this.state.error?.message || 'LOAD_FAILED');
      return (
        <div className="flex h-full w-full items-center justify-center p-6 text-center text-sm text-zinc-300">
          {msg}
        </div>
      );
    }
    return this.props.children;
  }
}

const centerOnGround = (root) => {
  if (!root) return;
  root.updateWorldMatrix(true, true);
  const box = new Box3().setFromObject(root);
  if (box.isEmpty()) return;
  const center = box.getCenter(new Vector3());
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.updateWorldMatrix(true, true);
  const box2 = new Box3().setFromObject(root);
  if (box2.isEmpty()) return;
  root.position.y -= box2.min.y;
  root.position.y += 0.001;
  root.updateWorldMatrix(true, true);
};

const BikeModel = ({ url, modelRef, onPointerDown }) => {
  const resolved = normalizeUrl(url);
  const gltf = useGLTF(resolved, true);
  const scene = gltf?.scene;

  useLayoutEffect(() => {
    if (!scene) return;
    centerOnGround(scene);
    scene.traverse?.((o) => {
      if (!o?.isMesh) return;
      o.castShadow = false;
      o.receiveShadow = false;
    });
  }, [scene]);

  return (
    <group ref={modelRef} onPointerDown={onPointerDown}>
      {scene ? <primitive object={scene} /> : null}
    </group>
  );
};

const AnchorDot = ({ id, isActive, isHover, onSelect, onHover, onOut }) => {
  const color = useMemo(() => {
    if (isActive) return new Color('#22c55e');
    if (isHover) return new Color('#38bdf8');
    return new Color('#f59e0b');
  }, [isActive, isHover]);

  return (
    <mesh
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelect?.(id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover?.(id);
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        onOut?.();
      }}
    >
      <sphereGeometry args={[0.05, 16, 16]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.15} />
    </mesh>
  );
};

const Scene = ({
  modelUrl,
  anchors,
  selectedId,
  focusPosition,
  showAnchors,
  addMode,
  transformMode,
  snapEnabled,
  snapPosStep,
  snapRotDeg,
  onAddAnchorAt,
  onSelectAnchor,
  onUpdateAnchorTransform
}) => {
  const orbitRef = useRef(null);
  const transformRef = useRef(null);
  const modelRef = useRef(null);
  const [hoverId, setHoverId] = useState('');

  useEffect(() => {
    const oc = orbitRef.current;
    if (!oc) return;
    const arr = Array.isArray(focusPosition) ? focusPosition : null;
    if (!arr) return;
    const p = clampVec3(arr);
    const next = new Vector3(p[0], p[1], p[2]);
    oc.target.copy(next);
    const cam = oc.object;
    if (cam) {
      const dx = cam.position.x - next.x;
      const dy = cam.position.y - next.y;
      const dz = cam.position.z - next.z;
      const dist = Math.max(0.4, Math.sqrt(dx * dx + dy * dy + dz * dz) || 2.6);
      cam.position.set(next.x + dist * 0.75, next.y + dist * 0.32, next.z + dist * 0.85);
    }
    oc.update?.();
  }, [selectedId, focusPosition]);

  useEffect(() => {
    const tc = transformRef.current;
    const oc = orbitRef.current;
    if (!tc || !oc) return;
    const handler = (e) => {
      oc.enabled = !Boolean(e?.value);
    };
    tc.addEventListener('dragging-changed', handler);
    return () => tc.removeEventListener('dragging-changed', handler);
  }, [selectedId, transformMode]);

  const applySnap = (pos, rotRad) => {
    const posStep = Math.max(0, clampNum(snapPosStep, 0));
    const rotStep = Math.max(0, clampNum(snapRotDeg, 0));
    const p0 = clampVec3(pos);
    const r0 = clampVec3(rotRad);
    if (!snapEnabled) return { position: p0, rotation: r0 };

    const p = posStep > 0 ? p0.map((x) => Math.round(x / posStep) * posStep) : p0;
    const rDeg = r0.map((x) => radToDeg(x));
    const rDegSnapped = rotStep > 0 ? rDeg.map((x) => Math.round(x / rotStep) * rotStep) : rDeg;
    const r = rDegSnapped.map((x) => degToRad(x));
    return { position: p, rotation: r };
  };

  const onCanvasPointerDown = (e) => {
    if (!addMode) return;
    const root = modelRef.current;
    if (!root) return;
    const p = e?.point;
    if (!p) return;
    const local = root.worldToLocal(p.clone());
    onAddAnchorAt?.([local.x, local.y, local.z]);
  };

  return (
    <>
      <ambientLight intensity={0.65} />
      <directionalLight position={[4, 7, 3]} intensity={1.1} />
      <directionalLight position={[-4, 4, -3]} intensity={0.6} />
      <Suspense fallback={null}>
        <BikeModel url={modelUrl} modelRef={modelRef} onPointerDown={onCanvasPointerDown} />
      </Suspense>

      {showAnchors
        ? anchors.map((a) => {
            const isActive = String(a?.id || '') === String(selectedId || '');
            const isHover = String(a?.id || '') && String(a?.id || '') === String(hoverId || '');
            const position = clampVec3(a?.position);
            const rotation = clampVec3(a?.rotation);
            const group = (
              <group key={a.id} position={position} rotation={rotation}>
                <AnchorDot
                  id={a.id}
                  isActive={isActive}
                  isHover={isHover}
                  onSelect={onSelectAnchor}
                  onHover={(id) => setHoverId(id)}
                  onOut={() => setHoverId('')}
                />
              </group>
            );

            if (!isActive) return group;

            return (
              <TransformControls
                key={a.id}
                ref={transformRef}
                mode={transformMode}
                showX
                showY
                showZ
                onObjectChange={() => {
                  const tc = transformRef.current;
                  const obj = tc?.object;
                  if (!obj) return;
                  const nextPos = [obj.position.x, obj.position.y, obj.position.z];
                  const nextRot = [obj.rotation.x, obj.rotation.y, obj.rotation.z];
                  const snapped = applySnap(nextPos, nextRot);
                  obj.position.set(snapped.position[0], snapped.position[1], snapped.position[2]);
                  obj.rotation.set(snapped.rotation[0], snapped.rotation[1], snapped.rotation[2]);
                  onUpdateAnchorTransform?.(a.id, snapped.position, snapped.rotation);
                }}
              >
                {group}
              </TransformControls>
            );
          })
        : null}

      <OrbitControls ref={orbitRef} makeDefault enableDamping dampingFactor={0.12} rotateSpeed={0.6} />
    </>
  );
};

const AnchorEditorCanvas = ({
  modelUrl,
  anchors,
  selectedId,
  focusPosition,
  showAnchors,
  addMode,
  transformMode,
  snapEnabled,
  snapPosStep,
  snapRotDeg,
  onAddAnchorAt,
  onSelectAnchor,
  onUpdateAnchorTransform
}) => {
  const url = normalizeUrl(modelUrl);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-white/10 bg-white/90">
      {addMode ? (
        <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-100">
          Add mode ON: click lên xe để tạo anchor
        </div>
      ) : null}
      {!showAnchors ? (
        <div className="pointer-events-none absolute left-3 top-3 z-10 mt-12 rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-xs font-semibold text-zinc-200">
          Anchors đang ẩn (bật Show Anchors để thấy)
        </div>
      ) : null}
      <AnchorCanvasErrorBoundary resetKey={url}>
        <Canvas
          camera={{ position: [2.2, 1.25, 3.2], fov: 45, near: 0.05, far: 200 }}
          dpr={[1, 1.75]}
          gl={{ alpha: true, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
          style={{ background: 'transparent', touchAction: 'none' }}
        >
          <color attach="background" args={['#ffffff']} />
          {url ? (
            <Scene
              modelUrl={url}
              anchors={Array.isArray(anchors) ? anchors : []}
              selectedId={selectedId}
              focusPosition={focusPosition}
              showAnchors={showAnchors}
              addMode={addMode}
              transformMode={transformMode}
              snapEnabled={snapEnabled}
              snapPosStep={snapPosStep}
              snapRotDeg={snapRotDeg}
              onAddAnchorAt={onAddAnchorAt}
              onSelectAnchor={onSelectAnchor}
              onUpdateAnchorTransform={onUpdateAnchorTransform}
            />
          ) : null}
        </Canvas>
      </AnchorCanvasErrorBoundary>
    </div>
  );
};

export default AnchorEditorCanvas;
