import { memo } from 'react';
import { motion } from 'framer-motion';

const Icon = memo(({ type, active }) => {
  const stroke = active ? '#e0f2fe' : 'rgba(255,255,255,0.72)';
  const cls = 'h-5 w-5';
  const t = String(type || '');

  if (t === 'wheels')
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" className={cls}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 20a8 8 0 100-16 8 8 0 000 16z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 2" />
      </svg>
    );
  if (t === 'brake')
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" className={cls}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 20a8 8 0 100-16 8 8 0 000 16z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h8" />
      </svg>
    );
  if (t === 'bodykit')
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" className={cls}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l2-6h12l2 6" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16h10" />
      </svg>
    );
  if (t === 'exhaust')
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" className={cls}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h7l2 2h5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 10h7l2 2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 14v-2" />
      </svg>
    );
  if (t === 'topbox')
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" className={cls}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 9h10l2 3v7a2 2 0 01-2 2H7a2 2 0 01-2-2v-7l2-3z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 9V7a2 2 0 012-2h6a2 2 0 012 2v2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 15h6" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" className={cls}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h18" />
    </svg>
  );
});

const Sidebar = ({
  groups,
  activeType,
  onSelectType,
  partLabel,
  titleLabel,
  activeHintLabel,
  selectHintLabel,
  conflictTypes,
  combos,
  comboTitle,
  comboHint,
  comboApplyLabel,
  comboPreviewLabel,
  onPreviewCombo,
  onApplyCombo
}) => {
  const a = String(activeType || '');
  const comboList = Array.isArray(combos) ? combos : [];
  const blockedCombos = new Set(['akrapovic', 'tobox', 'topbox', 'thung']);
  const visibleCombos = comboList.filter((c) => {
    const raw = String(c?.key || c?.title || '').trim().toLowerCase().replace(/\s+/g, '');
    if (!raw) return false;
    return !blockedCombos.has(raw);
  });
  return (
    <div className="h-full overflow-hidden border-r border-white/10 bg-white/[0.03]">
      <div className="h-full overflow-y-auto px-3 py-4">
        {visibleCombos.length ? (
          <div className="mb-4 rounded-2xl border border-white/10 bg-black/15 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-white/45">{comboTitle || 'Combo'}</div>
            {comboHint ? <div className="mt-1 text-[11px] text-white/55">{comboHint}</div> : null}
            <div className="mt-3 space-y-2">
              {visibleCombos.slice(0, 4).map((c) => {
                const key = String(c?.key || '').trim();
                const title = String(c?.title || '').trim();
                const onClick = () => (onPreviewCombo ? onPreviewCombo(key) : onApplyCombo?.(key));
                return (
                  <button
                    key={key || title}
                    type="button"
                    onClick={onClick}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left transition hover:bg-white/10"
                    >
                      <div className="min-w-0 truncate text-[13px] font-semibold text-white/90">{title || 'Combo'}</div>
                    <div className="shrink-0 rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5 text-[10px] font-bold text-white/85">
                      {comboPreviewLabel || comboApplyLabel || 'Preview'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
        <div className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-wider text-white/45">{titleLabel || 'Categories'}</div>
        <div className="space-y-4">
          {(Array.isArray(groups) ? groups : []).map((g) => (
            <div key={g.key} className="space-y-2">
              <div className="px-2 text-[11px] font-semibold text-white/60">{g.label}</div>
              <div className="space-y-1">
                {(Array.isArray(g.types) ? g.types : []).map((type) => {
                  const t = String(type || '');
                  const active = a === t;
                  const hasConflict = Boolean(conflictTypes?.has?.(t));
                  return (
                    <motion.button
                      key={t}
                      type="button"
                      whileTap={{ scale: 0.99 }}
                      onClick={() => onSelectType?.(t)}
                      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                        active
                          ? 'border-sky-300/50 bg-sky-500/12 text-white'
                          : hasConflict
                            ? 'border-rose-300/30 bg-rose-500/10 text-white/90 hover:bg-rose-500/14'
                            : 'border-white/10 bg-black/10 text-white/85 hover:bg-black/20'
                      }`}
                      title={t}
                    >
                      <div className="relative">
                        <div
                          className={`grid h-9 w-9 place-items-center rounded-xl border ${
                            active ? 'border-sky-300/40 bg-sky-500/10' : hasConflict ? 'border-rose-300/25 bg-rose-500/10' : 'border-white/10 bg-black/15'
                          }`}
                        >
                          <Icon type={t} active={active} />
                        </div>
                        {hasConflict ? (
                          <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-black/40 bg-rose-400 shadow-[0_0_18px_rgba(251,113,133,0.55)]" />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{partLabel?.(t) || t}</div>
                        <div className="truncate text-[11px] text-white/50">
                          {active ? activeHintLabel || 'Active' : selectHintLabel || 'Select'}
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default memo(Sidebar);
