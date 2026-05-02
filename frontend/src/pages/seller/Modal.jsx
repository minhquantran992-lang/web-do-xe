import { useEffect } from 'react';

const cx = (...arr) => arr.filter(Boolean).join(' ');

const Modal = ({ open, title, description, children, footer, onClose, size = 'lg' }) => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const maxW =
    size === 'sm' ? 'max-w-md' : size === 'md' ? 'max-w-xl' : size === 'xl' ? 'max-w-4xl' : 'max-w-2xl';

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="Close modal"
        onClick={onClose}
      />
      <div className="relative mx-auto mt-10 w-[92vw] px-2 sm:mt-14">
        <div className={cx('mx-auto overflow-hidden rounded-3xl border border-zinc-800/70 bg-zinc-950/85 shadow-2xl backdrop-blur-xl', maxW)}>
          <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
            <div className="min-w-0">
              <div className="truncate text-base font-bold text-zinc-50">{title}</div>
              {description ? <div className="mt-1 text-xs text-zinc-400">{description}</div> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10"
            >
              Đóng
            </button>
          </div>
          <div className="px-5 py-5">{children}</div>
          {footer ? <div className="border-t border-white/10 px-5 py-4">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
};

export default Modal;
