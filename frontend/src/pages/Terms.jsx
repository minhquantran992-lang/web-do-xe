import { useNavigate } from 'react-router-dom';
import { useI18n } from '../services/i18n.jsx';

const Terms = () => {
  const { t } = useI18n();
  const nav = useNavigate();
  return (
    <div className="min-h-screen bg-[#05070c] px-6 py-12 text-white">
      <div className="mx-auto w-full max-w-3xl">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
          <div className="text-2xl font-black tracking-tight">{t('register_terms_terms')}</div>
          <div className="mt-2 text-sm text-zinc-300">
            {t('terms_mvp_desc')}
          </div>
          <div className="mt-6">
            <button
              type="button"
              onClick={() => nav(-1)}
              className="inline-flex items-center rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-sm font-semibold text-white/90 hover:bg-black/35"
            >
              {t('common_back')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Terms;
