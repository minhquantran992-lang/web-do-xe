import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../services/auth/AuthContext.jsx';
import { apiFetch } from '../services/api/client.js';

const formatDt = (d) => {
  if (!d) return '—';
  const dt = d instanceof Date ? d : new Date(d);
  if (!dt || Number.isNaN(dt.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(dt);
  } catch {
    return dt.toISOString();
  }
};

const AdminSecurity = () => {
  const { token, user } = useAuth();
  const isAdmin = Boolean(user?.isAdmin) || String(user?.role || '').toUpperCase() === 'ADMIN';
  const [state, setState] = useState({ loading: true, error: '', items: [], nextBefore: null });
  const [filters, setFilters] = useState({ kind: '', outcome: '', ip: '', userId: '' });
  const [limit, setLimit] = useState(60);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    p.set('limit', String(Math.max(1, Math.min(200, Number(limit) || 60))));
    if (filters.kind) p.set('kind', filters.kind);
    if (filters.outcome) p.set('outcome', filters.outcome);
    if (filters.ip) p.set('ip', filters.ip);
    if (filters.userId) p.set('userId', filters.userId);
    return p.toString();
  }, [filters.kind, filters.ip, filters.outcome, filters.userId, limit]);

  const load = async () => {
    if (!token || !isAdmin) return;
    setState((p) => ({ ...p, loading: true, error: '' }));
    try {
      const data = await apiFetch(`/api/admin/security/events?${query}`, { token });
      setState({
        loading: false,
        error: '',
        items: Array.isArray(data?.items) ? data.items : [],
        nextBefore: data?.nextBefore || null
      });
    } catch (e) {
      setState((p) => ({ ...p, loading: false, error: String(e?.message || 'REQUEST_FAILED') }));
    }
  };

  useEffect(() => {
    load();
  }, [query, token, isAdmin]);

  if (!isAdmin) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-10">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-lg font-black text-zinc-50">Không có quyền truy cập</div>
          <div className="mt-2 text-sm text-zinc-300">Trang này chỉ dành cho admin.</div>
          <div className="mt-4">
            <Link to="/dashboard" className="text-sm font-semibold text-sky-300 hover:text-sky-200">
              ← Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-6">
        <div className="text-2xl font-black tracking-tight text-zinc-50">Admin • Bảo mật</div>
        <div className="mt-1 text-sm text-zinc-300">Theo dõi các sự kiện bảo mật (spam/bot, rate limit, captcha...).</div>
      </div>

      {state.error ? <div className="mb-5 rounded-2xl border border-red-500/25 bg-red-950/30 p-4 text-sm text-red-200">{state.error}</div> : null}

      <div className="mb-5 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="grid gap-3 md:grid-cols-5">
          <label className="block">
            <div className="mb-1 text-xs font-semibold tracking-wider text-zinc-400">Loại sự kiện</div>
            <input
              value={filters.kind}
              onChange={(e) => setFilters((p) => ({ ...p, kind: e.target.value }))}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-sky-400/40"
              placeholder="Ví dụ: rate_limit, captcha, bot..."
            />
          </label>
          <label className="block">
            <div className="mb-1 text-xs font-semibold tracking-wider text-zinc-400">Kết quả</div>
            <input
              value={filters.outcome}
              onChange={(e) => setFilters((p) => ({ ...p, outcome: e.target.value }))}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-sky-400/40"
              placeholder="Ví dụ: blocked, allowed..."
            />
          </label>
          <label className="block">
            <div className="mb-1 text-xs font-semibold tracking-wider text-zinc-400">IP</div>
            <input
              value={filters.ip}
              onChange={(e) => setFilters((p) => ({ ...p, ip: e.target.value }))}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-sky-400/40"
              placeholder="1.2.3.4"
            />
          </label>
          <label className="block md:col-span-2">
            <div className="mb-1 text-xs font-semibold tracking-wider text-zinc-400">User ID</div>
            <input
              value={filters.userId}
              onChange={(e) => setFilters((p) => ({ ...p, userId: e.target.value }))}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-sky-400/40"
              placeholder="Ví dụ: Mongo ObjectId"
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="text-xs font-semibold tracking-wider text-zinc-500">Số dòng</div>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value) || 60)}
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-sky-400/40"
            >
              <option value={30}>30</option>
              <option value={60}>60</option>
              <option value={120}>120</option>
              <option value={200}>200</option>
            </select>
          </div>
          <button
            type="button"
            onClick={load}
            className="rounded-xl bg-sky-400 px-4 py-2 text-sm font-black text-zinc-950 hover:bg-sky-300 disabled:opacity-60"
            disabled={state.loading}
          >
            {state.loading ? 'Đang tải…' : 'Tải lại'}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-black/30 text-xs font-bold tracking-wider text-zinc-300">
              <tr>
                <th className="px-4 py-3">Thời gian</th>
                <th className="px-4 py-3">Loại</th>
                <th className="px-4 py-3">Kết quả</th>
                <th className="px-4 py-3">Điểm</th>
                <th className="px-4 py-3">IP</th>
                <th className="px-4 py-3">User ID</th>
                <th className="px-4 py-3">API</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {state.items.map((e) => (
                <tr key={String(e?._id || Math.random())} className="hover:bg-white/5">
                  <td className="px-4 py-3 whitespace-nowrap text-zinc-200">{formatDt(e?.at)}</td>
                  <td className="px-4 py-3 text-zinc-100">{String(e?.kind || '')}</td>
                  <td className="px-4 py-3 text-zinc-200">{String(e?.outcome || '')}</td>
                  <td className="px-4 py-3 text-zinc-200">{Number(e?.score) || 0}</td>
                  <td className="px-4 py-3 text-zinc-200">{String(e?.ip || '')}</td>
                  <td className="px-4 py-3 text-zinc-200">{String(e?.userId || '')}</td>
                  <td className="px-4 py-3 text-zinc-200">{String(e?.method || '')} {String(e?.endpoint || '')}</td>
                </tr>
              ))}
              {!state.items.length && !state.loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-zinc-400">
                    Chưa có sự kiện.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminSecurity;
