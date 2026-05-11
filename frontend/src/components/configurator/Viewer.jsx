import { forwardRef, memo, useImperativeHandle, useRef } from 'react';
import CarViewer from '../../threejs/CarViewer.jsx';

const Viewer = forwardRef(({
  carModelUrl,
  color,
  paintTargets,
  accessoryColors,
  anchorPreset,
  highlightType,
  onHoverPart,
  onCarMeta,
  onCamera,
  onMechanicalCollisions,
  slots,
  embeddedConfig,
  background,
  backgroundPreset,
  dragHint,
  initialCamera,
  viewerMode
}, ref) => {
  const rootRef = useRef(null);

  useImperativeHandle(
    ref,
    () => ({
      capture: ({ type = 'image/jpeg', quality = 0.86 } = {}) => {
        const el = rootRef.current;
        if (!el) return '';
        const canvas = el.querySelector('canvas');
        if (!canvas) return '';
        try {
          return canvas.toDataURL(type, quality);
        } catch {
          return '';
        }
      }
    }),
    []
  );

  return (
    <div ref={rootRef} className="relative h-full w-full overflow-hidden">
      <CarViewer
        className="h-full w-full rounded-none border-0 bg-transparent"
        carModelUrl={carModelUrl}
        color={color}
        paintTargets={paintTargets && typeof paintTargets === 'object' ? paintTargets : {}}
        accessoryColors={accessoryColors && typeof accessoryColors === 'object' ? accessoryColors : {}}
        anchorPreset={Array.isArray(anchorPreset) ? anchorPreset : []}
        highlightType={highlightType}
        onHoverPart={onHoverPart}
        onCarMeta={onCarMeta}
        onCamera={onCamera}
        onMechanicalCollisions={onMechanicalCollisions}
        slots={slots}
        embeddedConfig={embeddedConfig}
        background={background}
        backgroundPreset={backgroundPreset}
        initialCamera={initialCamera}
        viewerMode={viewerMode}
      />
      {dragHint ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-5 z-20 flex justify-center px-4">
          <div className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-xs font-semibold text-white/80">{dragHint}</div>
        </div>
      ) : null}
    </div>
  );
});

export default memo(Viewer);
