import { memo } from 'react';
import { motion } from 'framer-motion';

const Step = memo(({ n, active }) => (
  <div
    className={`grid h-9 w-9 place-items-center rounded-xl border text-xs font-black transition ${
      active ? 'border-sky-300/50 bg-sky-500/14 text-white' : 'border-white/10 bg-black/20 text-white/70'
    }`}
  >
    {n}
  </div>
));

const Header = ({
  title,
  subtitle,
  step = 1,
  onGoHome,
  homeLabel,
  onChangeBike,
  changeBikeLabel,
  onShareBuild,
  shareLabel,
  shareDisabled,
  onSaveBuild,
  saveLabel,
  saveDisabled,
  onReset,
  resetLabel,
  onOpenBackgroundPicker,
  backgroundLabel,
  onToggleSidebar,
  onToggleOptions,
  optionsLabel
}) => {
  const s = Number(step) || 1;
  const navBtnBase =
    'inline-flex h-10 items-center rounded-xl border px-3 text-white/95 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50';
  const navBtnDangerBase =
    'inline-flex h-10 items-center rounded-xl border px-3 text-white/95 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50';
  return (
    <div className="sticky top-0 z-40 border-b border-white/10 bg-[#05070c]/70 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {onGoHome ? (
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={onGoHome}
              className={`${navBtnBase} border-white/15 bg-white/5 hover:border-white/25 hover:bg-white/10`}
              title={homeLabel || 'Home'}
            >
              <span className="text-sm font-semibold">{homeLabel || 'Home'}</span>
            </motion.button>
          ) : null}
          {onChangeBike ? (
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={onChangeBike}
              className={`${navBtnBase} border-sky-300/25 bg-sky-500/15 shadow-[0_0_0_1px_rgba(56,189,248,0.10)] hover:bg-sky-500/22 hover:border-sky-200/35 w-10 place-items-center px-0 sm:w-auto sm:grid-flow-col sm:gap-2 sm:px-3`}
              title={changeBikeLabel || 'Change bike'}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 6h13" strokeLinecap="round" />
                <path d="M8 12h13" strokeLinecap="round" />
                <path d="M8 18h13" strokeLinecap="round" />
                <path d="M3 6h.01" strokeLinecap="round" />
                <path d="M3 12h.01" strokeLinecap="round" />
                <path d="M3 18h.01" strokeLinecap="round" />
              </svg>
              <span className="hidden text-sm font-semibold sm:inline">{changeBikeLabel || 'Change bike'}</span>
            </motion.button>
          ) : null}
          <button
            type="button"
            onClick={onToggleSidebar}
            className="lg:hidden grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-black/20 text-white/90 transition hover:bg-black/35"
            title="Menu"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
          </button>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white/90">{title || 'Configurator'}</div>
            <div className="truncate text-[11px] text-white/50">{subtitle || 'Vehicle configurator'}</div>
          </div>
        </div>

        <div className="hidden items-center gap-2 sm:flex">
          {[1, 2, 3].map((n) => (
            <Step key={n} n={n} active={s === n} />
          ))}
        </div>

        <div className="flex items-center gap-2">
          {onShareBuild ? (
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={onShareBuild}
              disabled={Boolean(shareDisabled)}
              className={`hidden sm:inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                shareDisabled
                  ? 'cursor-not-allowed border border-white/10 bg-black/10 text-white/40'
                  : 'border border-emerald-300/20 bg-emerald-400 text-zinc-950 hover:bg-emerald-300'
              }`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12 16V3" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M7 8l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="hidden sm:inline">{shareLabel || 'Share'}</span>
            </motion.button>
          ) : null}
          {onSaveBuild ? (
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={onSaveBuild}
              disabled={Boolean(saveDisabled)}
              className={`hidden sm:inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                saveDisabled
                  ? 'cursor-not-allowed border border-white/10 bg-black/10 text-white/40'
                  : 'border border-sky-300/25 bg-sky-400 text-zinc-950 hover:bg-sky-300'
              }`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path
                  d="M19 21H5a2 2 0 01-2-2V7a2 2 0 012-2h11l5 5v9a2 2 0 01-2 2z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path d="M17 21v-8H7v8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M7 5v5h8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="hidden sm:inline">{saveLabel || 'Save build'}</span>
            </motion.button>
          ) : null}
          {onOpenBackgroundPicker ? (
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={onOpenBackgroundPicker}
              className={`hidden sm:inline-flex ${navBtnBase} gap-2 border-white/15 bg-white/5 px-4 hover:border-white/25 hover:bg-white/10`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path
                  d="M4 7a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V7z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path d="M8 13l2-2 3 3 2-2 3 3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="hidden sm:inline">{backgroundLabel || 'Background'}</span>
            </motion.button>
          ) : null}
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={onReset}
            className={`${navBtnDangerBase} gap-2 border-rose-300/25 bg-rose-500/15 px-3 shadow-[0_0_0_1px_rgba(244,63,94,0.10)] hover:border-rose-200/35 hover:bg-rose-500/22 sm:px-4`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 11-3-6.708M21 3v6h-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{resetLabel || 'Reset'}</span>
          </motion.button>
          <button
            type="button"
            onClick={onToggleOptions}
            className="lg:hidden grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-black/20 text-white/90 transition hover:bg-black/35"
            title={optionsLabel || 'Options'}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h10M4 18h16" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default memo(Header);
