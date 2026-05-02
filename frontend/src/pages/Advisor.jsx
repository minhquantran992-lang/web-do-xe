import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../services/api/client.js';
import { checkModLegality } from '../services/api/ai.js';
import { useAuth } from '../services/auth/AuthContext.jsx';
import { useI18n } from '../services/i18n.jsx';

const Advisor = () => {
  const { token, user } = useAuth();
  const { lang, t } = useI18n();
  const [vehicleType, setVehicleType] = useState('pkl');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [budgetVnd, setBudgetVnd] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [lawBike, setLawBike] = useState('Yamaha XSR155');
  const [lawPartName, setLawPartName] = useState('');
  const [lawPartType, setLawPartType] = useState('exhaust');
  const [lawLoading, setLawLoading] = useState(false);
  const [lawError, setLawError] = useState('');
  const [lawResult, setLawResult] = useState(null);

  const quickReplies = useMemo(
    () => [t('ai_quick_1'), t('ai_quick_2'), t('ai_quick_3')],
    [lang, t]
  );

  const send = async (text) => {
    const content = String(text || '').trim();
    if (!content || loading) return;
    setError('');
    setLoading(true);
    setMessages((prev) => [...prev, { role: 'user', content }]);
    try {
      const ctx = {
        vehicleType,
        brand: String(brand || '').trim(),
        model: String(model || '').trim(),
        budgetVnd: budgetVnd ? Number(String(budgetVnd).replace(/[^\d]/g, '')) : undefined
      };
      const data = await apiFetch('/api/ai/advice', {
        method: 'POST',
        token,
        body: { lang, message: content, context: ctx }
      });
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: String(data?.reply || ''),
          plan: Array.isArray(data?.plan) ? data.plan : [],
          quickReplies: Array.isArray(data?.quickReplies) ? data.quickReplies : []
        }
      ]);
      setInput('');
    } catch (e) {
      setError(e?.message || 'REQUEST_FAILED');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    send(input);
  };

  const onCheckLaw = async () => {
    setLawLoading(true);
    setLawError('');
    try {
      const data = await checkModLegality({ motorcycle: lawBike, partName: lawPartName, partType: lawPartType });
      setLawResult(data && typeof data === 'object' ? data : null);
    } catch (e) {
      setLawResult(null);
      setLawError(e?.message || 'REQUEST_FAILED');
    } finally {
      setLawLoading(false);
    }
  };

  const lawBadge = useMemo(() => {
    const s = String(lawResult?.status || '').trim();
    if (s === 'legal') return { text: t('law_result'), cls: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200' };
    if (s === 'illegal') return { text: t('law_result'), cls: 'border-red-500/25 bg-red-500/10 text-red-200' };
    return { text: t('law_result'), cls: 'border-amber-500/25 bg-amber-500/10 text-amber-200' };
  }, [lawResult?.status, t]);
  const lawStatusLabel = useMemo(() => {
    const s = String(lawResult?.status || '').trim();
    if (String(lawResult?.label_vi || '').trim()) return String(lawResult.label_vi).trim();
    if (s === 'legal') return 'Hợp pháp';
    if (s === 'illegal') return 'Vi phạm luật';
    if (s === 'warning') return 'Có nguy cơ bị phạt';
    return 'Kết quả';
  }, [lawResult?.label_vi, lawResult?.status]);

  const isVietnameseUser = useMemo(() => {
    const raw = String(user?.country || '').trim();
    if (!raw) return false;
    const k = raw
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (k === 'vn' || k === 'vietnam' || k === 'viet nam') return true;
    if (k.includes('viet')) return true;
    return false;
  }, [user?.country]);
  const canShowLawCheck = String(lang || '').trim().toLowerCase() === 'vi' || isVietnameseUser;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-zinc-800/70 bg-zinc-950/50 p-6 backdrop-blur-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-sm font-semibold text-sky-300">{t('ai_badge')}</div>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-zinc-50 sm:text-3xl">{t('ai_title')}</h1>
            <div className="mt-2 max-w-2xl text-sm text-zinc-400">{t('ai_desc')}</div>
          </div>
          <Link to="/" className="text-sm font-semibold text-sky-300 hover:text-sky-200">
            {t('common_back_home')}
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="rounded-3xl border border-zinc-800/70 bg-zinc-950/40 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm font-semibold text-zinc-200">{t('ai_chat_title')}</div>
            <button
              type="button"
              onClick={() => {
                setMessages([]);
                setError('');
              }}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10"
            >
              {t('ai_clear')}
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {messages.length ? (
              messages.map((m, idx) => (
                <div
                  key={`${m.role}-${idx}`}
                  className={
                    m.role === 'user'
                      ? 'ml-auto max-w-[92%] rounded-2xl bg-sky-500/15 px-4 py-3 text-sm text-sky-50 border border-sky-500/20'
                      : 'mr-auto max-w-[92%] rounded-2xl bg-white/5 px-4 py-3 text-sm text-zinc-100 border border-white/10'
                  }
                >
                  <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
                  {m.role === 'assistant' && Array.isArray(m.plan) && m.plan.length ? (
                    <div className="mt-3 space-y-2">
                      {m.plan.map((p, i) => (
                        <div key={`${idx}-plan-${i}`} className="rounded-xl border border-white/10 bg-black/20 p-3">
                          <div className="text-xs font-semibold text-zinc-200">{p.title}</div>
                          <div className="mt-2 space-y-1 text-xs text-zinc-300">
                            {(Array.isArray(p.items) ? p.items : []).map((it, k) => (
                              <div key={`${idx}-plan-${i}-${k}`}>{it}</div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
                {t('ai_empty_hint')}
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {quickReplies.map((q) => (
              <button
                key={q}
                type="button"
                disabled={loading}
                onClick={() => send(q)}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10 disabled:opacity-60"
              >
                {q}
              </button>
            ))}
          </div>

          {error ? <div className="mt-4 rounded-2xl border border-red-900/40 bg-red-950/30 p-4 text-sm text-red-200">{error}</div> : null}

          <form onSubmit={onSubmit} className="mt-4 flex items-end gap-2">
            <label className="flex-1">
              <div className="sr-only">{t('ai_input_label')}</div>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={2}
                className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-sky-500/40"
                placeholder={t('ai_input_placeholder')}
              />
            </label>
            <button
              type="submit"
              disabled={loading || !String(input || '').trim()}
              className="rounded-2xl bg-sky-400 px-5 py-3 text-sm font-semibold text-zinc-950 hover:bg-sky-300 disabled:opacity-60"
            >
              {loading ? t('auth_processing') : t('ai_send')}
            </button>
          </form>
        </div>

        <aside className="h-fit space-y-6">
          <div className="rounded-3xl border border-zinc-800/70 bg-zinc-950/40 p-5">
            <div className="text-sm font-semibold text-zinc-200">{t('ai_profile')}</div>
            <div className="mt-4 grid gap-3">
            <label className="grid gap-1 text-sm">
              <div className="text-xs text-zinc-500">{t('ai_vehicle_type')}</div>
              <select
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-sky-500/40"
              >
                <option value="pkl">{t('ai_vehicle_pkl')}</option>
                <option value="scooter">{t('ai_vehicle_scooter')}</option>
                <option value="oto">{t('ai_vehicle_oto')}</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <div className="text-xs text-zinc-500">{t('custom_summary_brand')}</div>
              <input
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-sky-500/40"
                placeholder={t('ai_brand_placeholder')}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <div className="text-xs text-zinc-500">{t('custom_summary_model')}</div>
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-sky-500/40"
                placeholder={t('ai_model_placeholder')}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <div className="text-xs text-zinc-500">{t('ai_budget')}</div>
              <input
                value={budgetVnd}
                onChange={(e) => setBudgetVnd(e.target.value)}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-sky-500/40"
                placeholder={t('ai_budget_placeholder')}
              />
            </label>
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-zinc-400">
            {t('ai_privacy_hint')}
          </div>
          </div>

          {canShowLawCheck ? (
          <div className="rounded-3xl border border-zinc-800/70 bg-zinc-950/40 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-zinc-200">Kiểm tra hợp pháp (VN)</div>
                <div className="mt-1 text-xs text-zinc-500">Theo Nghị định 100/2019 & 123/2021</div>
              </div>
              {lawResult ? (
                <div className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold ${lawBadge.cls}`}>
                  {lawStatusLabel}
                </div>
              ) : null}
            </div>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-sm">
                <div className="text-xs text-zinc-500">{t('law_bike_label')}</div>
                <input
                  value={lawBike}
                  onChange={(e) => setLawBike(e.target.value)}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-sky-500/40"
                  placeholder="Yamaha XSR155"
                />
              </label>

              <label className="grid gap-1 text-sm">
                <div className="text-xs text-zinc-500">{t('law_part_name')}</div>
                <input
                  value={lawPartName}
                  onChange={(e) => setLawPartName(e.target.value)}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-sky-500/40"
                  placeholder={t('law_part_name_placeholder')}
                />
              </label>

              <label className="grid gap-1 text-sm">
                <div className="text-xs text-zinc-500">{t('law_part_type')}</div>
                <select
                  value={lawPartType}
                  onChange={(e) => setLawPartType(e.target.value)}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-sky-500/40"
                >
                  <option value="exhaust">{t('part_exhaust')}</option>
                  <option value="lighting">{t('part_lighting')}</option>
                  <option value="wheels">{t('part_wheels')}</option>
                  <option value="tire">{t('part_tire')}</option>
                  <option value="brake">{t('part_brake')}</option>
                  <option value="suspension">{t('part_suspension')}</option>
                  <option value="handlebar">{t('part_handlebar')}</option>
                  <option value="bodykit">{t('part_bodykit')}</option>
                  <option value="seat">{t('part_seat')}</option>
                  <option value="clutch">{t('part_clutch')}</option>
                </select>
              </label>
            </div>

            {lawError ? <div className="mt-3 rounded-2xl border border-red-900/40 bg-red-950/30 p-3 text-xs text-red-200">{lawError}</div> : null}

            <button
              type="button"
              onClick={onCheckLaw}
              disabled={lawLoading || !String(lawPartName || '').trim()}
              className="mt-4 w-full rounded-2xl bg-gradient-to-r from-sky-400 to-cyan-300 px-4 py-3 text-sm font-black text-zinc-950 hover:brightness-110 disabled:opacity-60"
            >
              {lawLoading ? t('auth_processing') : t('law_check_btn')}
            </button>

            {lawResult ? (
              <div className="mt-4 space-y-2 text-sm text-zinc-200">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs font-semibold text-zinc-400">{t('law_result')}</div>
                  <div className="mt-2 text-sm text-zinc-100">{lawResult?.reason || ''}</div>
                  {lawResult?.fine ? <div className="mt-3 text-xs text-zinc-400">{lawResult.fine}</div> : null}
                  {Array.isArray(lawResult?.alternatives) && lawResult.alternatives.length ? (
                    <div className="mt-3 space-y-1 text-xs text-zinc-300">
                      {lawResult.alternatives.map((a) => (
                        <div key={a}>- {a}</div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
};

export default Advisor;
