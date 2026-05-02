import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, getApiBaseUrl } from '../services/api/client.js';
import { useAuth } from '../services/auth/AuthContext.jsx';
import { useI18n } from '../services/i18n.jsx';

const cx = (...arr) => arr.filter(Boolean).join(' ');

const formatVnd = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(n)} ₫`;
};

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

const AdminFinance = () => {
  const { token, user } = useAuth();
  const { t } = useI18n();
  const isAdmin = Boolean(user?.isAdmin) || String(user?.role || '').toUpperCase() === 'ADMIN';

  const today = useMemo(() => new Date(), []);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [shopId, setShopId] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [overview, setOverview] = useState(null);
  const [revenue, setRevenue] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const toIso = today.toISOString().slice(0, 10);
    const fromDt = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const fromIso = fromDt.toISOString().slice(0, 10);
    setFrom(fromIso);
    setTo(toIso);
  }, [today]);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams();
      if (from) qs.set('from', from);
      if (to) qs.set('to', to);
      if (String(shopId || '').trim()) qs.set('shopId', String(shopId || '').trim());
      const suffix = qs.toString() ? `?${qs.toString()}` : '';
      const [ov, rv, bk] = await Promise.all([
        apiFetch(`/api/admin/finance/overview${suffix}`, { token }),
        apiFetch(`/api/admin/finance/revenue${suffix}`, { token }),
        apiFetch(`/api/admin/finance/bookings${suffix}`, { token })
      ]);
      setOverview(ov?.item || null);
      setRevenue(rv?.item || null);
      setBookings(Array.isArray(bk?.items) ? bk.items : []);
    } catch (e) {
      const msg = String(e?.message || 'Không thể tải dữ liệu tài chính.');
      if (Number(e?.status) === 403) setError(t('admin_forbidden'));
      else if (Number(e?.status) === 401) setError(t('admin_login_req'));
      else setError(msg);
      setOverview(null);
      setRevenue(null);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token || !from || !to) return;
    load();
  }, [token, from, to]);

  const downloadCsv = async () => {
    if (!token || exporting) return;
    setExporting(true);
    setError('');
    try {
      const base = getApiBaseUrl();
      const qs = new URLSearchParams();
      if (from) qs.set('from', from);
      if (to) qs.set('to', to);
      if (String(shopId || '').trim()) qs.set('shopId', String(shopId || '').trim());
      const url = `${base}/api/admin/finance/export?${qs.toString()}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'EXPORT_FAILED');
      }
      const blob = await res.blob();
      const a = document.createElement('a');
      const objUrl = URL.createObjectURL(blob);
      a.href = objUrl;
      a.download = `bao-cao-tai-chinh-${from || 'from'}-den-${to || 'to'}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
    } catch (e) {
      setError(String(e?.message || 'Không thể xuất báo cáo.'));
    } finally {
      setExporting(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-10">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-lg font-black text-zinc-50">{t('admin_forbidden')}</div>
          <div className="mt-2 text-sm text-zinc-300">{t('admin_login_req')}</div>
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
        <div className="text-2xl font-black tracking-tight text-zinc-50">Admin • Tài chính</div>
        <div className="mt-1 text-sm text-zinc-300">Chỉ admin mới có thể xem dữ liệu doanh thu.</div>
      </div>

      {error ? <div className="mb-5 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div> : null}

      <div className="mb-5 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_1.4fr_auto] md:items-end">
          <label className="block">
            <div className="mb-1 text-xs font-semibold tracking-wider text-zinc-400">Từ ngày</div>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-sky-400/40"
            />
          </label>
          <label className="block">
            <div className="mb-1 text-xs font-semibold tracking-wider text-zinc-400">Đến ngày</div>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-sky-400/40"
            />
          </label>
          <label className="block">
            <div className="mb-1 text-xs font-semibold tracking-wider text-zinc-400">Shop ID (tuỳ chọn)</div>
            <input
              value={shopId}
              onChange={(e) => setShopId(e.target.value)}
              placeholder="ObjectId của shop"
              className="w-full rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-sky-400/40"
            />
          </label>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="rounded-xl bg-sky-400 px-4 py-2 text-sm font-black text-zinc-950 hover:bg-sky-300 disabled:opacity-60"
          >
            {loading ? 'Đang tải…' : 'Lọc'}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-zinc-500">
            Phạm vi: {overview?.from ? String(overview.from).slice(0, 10) : '—'} → {overview?.to ? String(overview.to).slice(0, 10) : '—'}
          </div>
          <button
            type="button"
            onClick={downloadCsv}
            disabled={exporting || loading}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-zinc-100 hover:bg-white/10 disabled:opacity-60"
          >
            {exporting ? 'Đang xuất…' : 'Xuất CSV'}
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-xs font-semibold text-zinc-400">Doanh thu</div>
          <div className="mt-2 text-3xl font-black text-zinc-50">{formatVnd(overview?.totalRevenue)}</div>
          <div className="mt-2 text-xs text-zinc-500">Chỉ tính booking đã hoàn thành.</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-xs font-semibold text-zinc-400">Số booking hoàn thành</div>
          <div className="mt-2 text-3xl font-black text-zinc-50">{Number(overview?.completedBookingsCount) || 0}</div>
          <div className="mt-2 text-xs text-zinc-500">Trong phạm vi lọc.</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-xs font-semibold text-zinc-400">Trạng thái</div>
          <div className="mt-2 text-sm font-semibold text-zinc-100">{loading ? 'Đang tải…' : 'Sẵn sàng'}</div>
          <div className="mt-2 text-xs text-zinc-500">Tuyệt đối không cache ở localStorage.</div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-white/10 bg-white/5">
          <div className="border-b border-white/10 px-4 py-3">
            <div className="text-sm font-black tracking-wide text-zinc-50">Doanh thu theo ngày</div>
            <div className="mt-1 text-xs text-zinc-400">Tổng doanh thu và số booking hoàn thành mỗi ngày</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs text-zinc-400">
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 font-semibold">Ngày</th>
                  <th className="px-4 py-3 font-semibold">Doanh thu</th>
                  <th className="px-4 py-3 font-semibold">Booking</th>
                </tr>
              </thead>
              <tbody className="text-zinc-200">
                {Array.isArray(revenue?.series) && revenue.series.length ? (
                  revenue.series.slice(-45).map((r) => (
                    <tr key={r.date} className="border-b border-white/5">
                      <td className="px-4 py-3 font-mono text-xs">{r.date}</td>
                      <td className="px-4 py-3 font-semibold">{formatVnd(r.revenue)}</td>
                      <td className="px-4 py-3">{Number(r.completedBookingsCount) || 0}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-6 text-sm text-zinc-400" colSpan={3}>
                      {loading ? 'Đang tải…' : 'Chưa có dữ liệu.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5">
          <div className="border-b border-white/10 px-4 py-3">
            <div className="text-sm font-black tracking-wide text-zinc-50">Top cửa hàng</div>
            <div className="mt-1 text-xs text-zinc-400">Theo doanh thu trong phạm vi lọc</div>
          </div>
          <div className="p-4 space-y-3">
            {Array.isArray(overview?.byShop) && overview.byShop.length ? (
              overview.byShop.slice(0, 12).map((s) => (
                <div key={s.shopId} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="text-sm font-bold text-zinc-100">{s.shopName || s.shopId.slice(-10) || '—'}</div>
                  <div className="mt-1 flex items-center justify-between gap-3 text-xs text-zinc-400">
                    <div>{Number(s.completedBookingsCount) || 0} booking</div>
                    <div className="font-semibold text-zinc-200">{formatVnd(s.totalRevenue)}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-zinc-400">{loading ? 'Đang tải…' : 'Chưa có dữ liệu.'}</div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-white/5">
        <div className="border-b border-white/10 px-4 py-3">
          <div className="text-sm font-black tracking-wide text-zinc-50">Booking đã hoàn thành</div>
          <div className="mt-1 text-xs text-zinc-400">Tối đa 500 dòng trong API (xuất CSV để lấy nhiều hơn)</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="text-xs text-zinc-400">
              <tr className="border-b border-white/10">
                <th className="px-4 py-3 font-semibold">Booking</th>
                <th className="px-4 py-3 font-semibold">Cửa hàng</th>
                <th className="px-4 py-3 font-semibold">Hoàn thành lúc</th>
                <th className="px-4 py-3 font-semibold">Doanh thu</th>
              </tr>
            </thead>
            <tbody className="text-zinc-200">
              {bookings.length ? (
                bookings.slice(0, 70).map((b) => (
                  <tr key={b.bookingId} className="border-b border-white/5">
                    <td className="px-4 py-3 font-mono text-xs">{String(b.bookingId || '').slice(-12)}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-semibold text-zinc-100">{b.shop?.shopName || b.shop?.shopId?.slice(-10) || '—'}</div>
                      <div className="mt-1 font-mono text-[11px] text-zinc-400">{b.shop?.shopId || ''}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-300">{formatDt(b.completedAt)}</td>
                    <td className="px-4 py-3 font-semibold">{formatVnd(b.totalRevenue)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-6 text-sm text-zinc-400" colSpan={4}>
                    {loading ? 'Đang tải…' : 'Chưa có dữ liệu.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminFinance;
