import { useI18n } from '../../services/i18n.jsx';

const cx = (...arr) => arr.filter(Boolean).join(' ');

const Item = ({ active, label, onClick, right }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'flex w-full items-center justify-between rounded-2xl border border-transparent px-3 py-2 text-left text-sm transition',
        active ? 'border-sky-400/25 bg-sky-500/10 text-zinc-50' : 'text-zinc-300 hover:bg-white/5 hover:text-zinc-100'
      )}
    >
      <span className="truncate font-medium">{label}</span>
      <span className="ml-3 flex shrink-0 items-center gap-2">
        {right}
        {active ? <span className="h-1.5 w-1.5 rounded-full bg-sky-300" /> : null}
      </span>
    </button>
  );
};

const Section = ({ title, children }) => {
  return (
    <div className="space-y-2">
      <div className="px-3 text-[11px] font-bold uppercase tracking-wide text-zinc-500">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
};

const Sidebar = ({ activeKey, onSelect, open, onClose, pendingCount }) => {
  const { t } = useI18n();
  const Panel = ({ inDrawer }) => (
    <aside className="h-full w-full rounded-3xl border border-zinc-800/70 bg-zinc-950/55 backdrop-blur-2xl">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-4">
        <div className="min-w-0">
          <div className="truncate text-sm font-black text-zinc-50">{t('seller_sidebar_title')}</div>
          <div className="mt-1 truncate text-[11px] text-zinc-400">{t('seller_sidebar_subtitle')}</div>
        </div>
        {inDrawer ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10"
          >
            {t('seller_common_close')}
          </button>
        ) : null}
      </div>

      <div className="h-[calc(100%-65px)] overflow-y-auto px-3 py-4">
        <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs font-bold text-zinc-100">{t('seller_sidebar_overview_title')}</div>
          <div className="mt-1 text-xs text-zinc-400">{t('seller_sidebar_overview_desc')}</div>
        </div>

        <div className="space-y-5">
          <Section title={t('seller_sidebar_section_ops')}>
            <Item active={activeKey === 'overview'} label={t('seller_sidebar_menu_dashboard')} onClick={() => onSelect('overview')} />
            <Item
              active={activeKey === 'requests'}
              label={t('seller_sidebar_menu_requests')}
              onClick={() => onSelect('requests')}
              right={
                pendingCount ? (
                  <span className="rounded-full border border-amber-400/25 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-200">
                    {Number(pendingCount) || 0}
                  </span>
                ) : null
              }
            />
            <Item active={activeKey === 'tickets'} label="Khiếu nại" onClick={() => onSelect('tickets')} />
          </Section>

          <Section title={t('seller_sidebar_section_shop')}>
            <Item active={activeKey === 'profile'} label={t('shop_profile_title')} onClick={() => onSelect('profile')} />
            <Item active={activeKey === 'content'} label="Bài viết & Video" onClick={() => onSelect('content')} />
            <Item active={activeKey === 'products'} label={t('seller_sidebar_menu_products')} onClick={() => onSelect('products')} />
            <Item active={activeKey === 'reviews'} label={t('seller_reviews_title')} onClick={() => onSelect('reviews')} />
          </Section>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden w-[260px] shrink-0 lg:block">
        <Panel />
      </div>

      {open ? (
        <button type="button" className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm lg:hidden" onClick={onClose} aria-label="Close sidebar" />
      ) : null}

      <div className={cx('fixed inset-y-0 left-0 z-50 w-[86vw] max-w-[300px] -translate-x-full transform transition-transform lg:hidden', open ? 'translate-x-0' : '')}>
        <Panel inDrawer />
      </div>
    </>
  );
};

export default Sidebar;
