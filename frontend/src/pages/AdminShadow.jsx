import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../services/auth/AuthContext.jsx';
import { useI18n } from '../services/i18n.jsx';
import { getApiBaseUrl } from '../services/api/client.js';
import { getAdminShadowHeatmap, getAdminShadowLogs, getAdminShadowSuspicious, issueAdminShadowToken } from '../services/api/adminCars.js';

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

const AdminShadow = () => {
  const { token, user } = useAuth();
  const { t } = useI18n();
  const isAdmin = Boolean(user?.isAdmin) || String(user?.role || '').toUpperCase() === 'ADMIN';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [designs, setDesigns] = useState([]);
  const [events, setEvents] = useState([]);
  const [suspicious, setSuspicious] = useState({ ipSummary: [], events: [] });
  const [heatmap, setHeatmap] = useState({ buckets: [] });
  const [designIdFilter, setDesignIdFilter] = useState('');

  const [tokenModalOpen, setTokenModalOpen] = useState(false);
  const [issuedForId, setIssuedForId] = useState('');
  const [issuedToken, setIssuedToken] = useState('');
  const [issueBusy, setIssueBusy] = useState(false);
  const [issueError, setIssueError] = useState('');

  const trackUrl = useMemo(() => {
    if (!issuedToken) return '';
    const base = getApiBaseUrl();
    return `${base}/track/design/${encodeURIComponent(issuedToken)}`;
  }, [issuedToken]);

  const load = async ({ designId } = {}) => {
    if (!token || !isAdmin) return;
    setLoading(true);
    setError('');
    try {
      const [logs, susp, hm] = await Promise.all([
        getAdminShadowLogs({ token, designId: String(designId || '').trim() || undefined }),
        getAdminShadowSuspicious({ token }),
        getAdminShadowHeatmap({ token })
      ]);
      setDesigns(Array.isArray(logs?.designs) ? logs.designs : []);
      setEvents(Array.isArray(logs?.events) ? logs.events : []);
      setSuspicious({
        ipSummary: Array.isArray(susp?.ipSummary) ? susp.ipSummary : [],
        events: Array.isArray(susp?.events) ? susp.events : []
      });
      setHeatmap({ buckets: Array.isArray(hm?.buckets) ? hm.buckets : [] });
    } catch (e) {
      const msg = String(e?.message || 'REQUEST_FAILED');
      if (Number(e?.status) === 403) setError(t('admin_forbidden'));
      else if (Number(e?.status) === 401) setError(t('admin_login_req'));
      else setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load({ designId: '' });
  }, [token, isAdmin]);

  const onIssueToken = async (designId) => {
    if (!token) return;
    setIssueBusy(true);
    setIssueError('');
    try {
      const tok = await issueAdminShadowToken({ token, designId });
      setIssuedForId(String(designId || ''));
      setIssuedToken(String(tok || ''));
      setTokenModalOpen(true);
    } catch (e) {
      const msg = String(e?.message || 'REQUEST_FAILED');
      setIssueError(msg);
    } finally {
      setIssueBusy(false);
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
        <div className="text-2xl font-black tracking-tight text-zinc-50">Admin • Shadow Mode</div>
        <div className="mt-1 text-sm text-zinc-300">Chỉ dành cho admin. Dữ liệu tracking được lưu server-side.</div>
      </div>

      {error ? <div className="mb-5 rounded-2xl border border-red-500/25 bg-red-950/30 p-4 text-sm text-red-200">{error}</div> : null}

      <div className="mb-5 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <label className="block w-full max-w-xl">
            <div className="mb-1 text-xs font-semibold tracking-wider text-zinc-400">Lọc theo Design ID</div>
            <input
              value={designIdFilter}
              onChange={(e) => setDesignIdFilter(e.target.value)}
              placeholder="ObjectId của Configuration"
              className="w-full rounded-xl border border-white/10 bg-zinc-950/40 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-sky-500/40"
            />
          </label>
          <button
            onClick={() => load({ designId: String(designIdFilter || '').trim() })}
            disabled={loading}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-zinc-100 hover:bg-white/10 disabled:opacity-60"
          >
            {loading ? 'Đang tải…' : 'Tải lại'}
          </button>
        </div>
        {issueError ? <div className="mt-3 text-sm text-red-200">{issueError}</div> : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5">
          <div className="border-b border-white/10 px-4 py-3">
            <div className="text-sm font-black tracking-wide text-zinc-50">Tracked Designs</div>
            <div className="mt-1 text-xs text-zinc-400">Scan count • leak risk score • suspicious flags</div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] text-left text-sm">
              <thead className="text-xs text-zinc-400">
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 font-semibold">Design</th>
                  <th className="px-4 py-3 font-semibold">Scans</th>
                  <th className="px-4 py-3 font-semibold">Unique IPs</th>
                  <th className="px-4 py-3 font-semibold">Suspicious</th>
                  <th className="px-4 py-3 font-semibold">Risk</th>
                  <th className="px-4 py-3 font-semibold">Last scan</th>
                  <th className="px-4 py-3 font-semibold">Token</th>
                </tr>
              </thead>
              <tbody className="text-zinc-200">
                {designs.length ? (
                  designs.map((d) => (
                    <tr key={d.designId} className="border-b border-white/5">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-zinc-100">{d.name || '—'}</div>
                        <div className="mt-1 text-xs text-zinc-400">{d.designId}</div>
                      </td>
                      <td className="px-4 py-3">{Number(d.scanCount) || 0}</td>
                      <td className="px-4 py-3">{Number(d.uniqueIpCount) || 0}</td>
                      <td className="px-4 py-3">{Number(d.suspiciousCount) || 0}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-lg border px-2 py-1 text-xs font-bold ${
                            Number(d.leakRiskScore) >= 70
                              ? 'border-red-500/30 bg-red-950/30 text-red-200'
                              : Number(d.leakRiskScore) >= 40
                                ? 'border-amber-500/30 bg-amber-950/20 text-amber-200'
                                : 'border-emerald-500/25 bg-emerald-950/20 text-emerald-200'
                          }`}
                        >
                          {Number(d.leakRiskScore) || 0}/100
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-300">{formatDt(d.lastScanAt)}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => onIssueToken(d.designId)}
                          disabled={issueBusy}
                          className="rounded-lg border border-sky-500/25 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-200 hover:bg-sky-500/15 disabled:opacity-60"
                        >
                          Tạo token
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-6 text-sm text-zinc-400" colSpan={7}>
                      {loading ? 'Đang tải…' : 'Chưa có dữ liệu tracking.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5">
          <div className="border-b border-white/10 px-4 py-3">
            <div className="text-sm font-black tracking-wide text-zinc-50">Suspicious IPs</div>
            <div className="mt-1 text-xs text-zinc-400">Tổng hợp theo ipHash</div>
          </div>
          <div className="max-h-[420px] overflow-auto px-4 py-3">
            {suspicious.ipSummary?.length ? (
              <div className="space-y-3">
                {suspicious.ipSummary.slice(0, 40).map((x) => (
                  <div key={x.ipHash} className="rounded-xl border border-white/10 bg-zinc-950/30 p-3">
                    <div className="text-xs font-semibold text-zinc-300">{x.ipHash}</div>
                    <div className="mt-2 flex items-center justify-between text-xs text-zinc-400">
                      <span>Events: {Number(x.suspiciousCount) || 0}</span>
                      <span>Designs: {Number(x.designCount) || 0}</span>
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-500">Last: {formatDt(x.lastSeenAt)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-zinc-400">{loading ? 'Đang tải…' : 'Không có dấu hiệu bất thường.'}</div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5">
          <div className="border-b border-white/10 px-4 py-3">
            <div className="text-sm font-black tracking-wide text-zinc-50">Recent Events</div>
            <div className="mt-1 text-xs text-zinc-400">Log ẩn danh (hash IP/UA)</div>
          </div>
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] text-zinc-500">
                <tr className="border-b border-white/10">
                  <th className="px-4 py-2 font-semibold">Time</th>
                  <th className="px-4 py-2 font-semibold">Design</th>
                  <th className="px-4 py-2 font-semibold">IP Hash</th>
                  <th className="px-4 py-2 font-semibold">Flags</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300">
                {events?.length ? (
                  events.slice(0, 120).map((e, idx) => (
                    <tr key={`${e.designId || 'n'}:${e.createdAt || idx}`} className="border-b border-white/5">
                      <td className="px-4 py-2 whitespace-nowrap">{formatDt(e.createdAt)}</td>
                      <td className="px-4 py-2">
                        <div className="text-[11px] text-zinc-400">{String(e.designId || '—')}</div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="text-[11px] text-zinc-400">{String(e.ipHash || '—')}</div>
                      </td>
                      <td className="px-4 py-2">
                        {e.suspicious ? (
                          <span className="inline-flex rounded-lg border border-amber-500/25 bg-amber-950/20 px-2 py-1 text-[11px] font-bold text-amber-200">
                            {Array.isArray(e.suspiciousReasons) && e.suspiciousReasons.length ? e.suspiciousReasons.join(', ') : 'SUSPICIOUS'}
                          </span>
                        ) : (
                          <span className="text-[11px] text-zinc-500">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-6 text-sm text-zinc-400" colSpan={4}>
                      {loading ? 'Đang tải…' : 'Chưa có log.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5">
          <div className="border-b border-white/10 px-4 py-3">
            <div className="text-sm font-black tracking-wide text-zinc-50">Heatmap</div>
            <div className="mt-1 text-xs text-zinc-400">Số scan theo ngày/giờ</div>
          </div>
          <div className="px-4 py-3">
            {heatmap?.buckets?.length ? (
              <div className="space-y-2">
                {heatmap.buckets.slice(-24).map((b) => (
                  <div key={`${b.day}-${b.hour}`} className="flex items-center justify-between rounded-xl border border-white/10 bg-zinc-950/30 px-3 py-2">
                    <div className="text-xs text-zinc-300">
                      {b.day} • {String(b.hour).padStart(2, '0')}:00
                    </div>
                    <div className="text-xs font-bold text-zinc-100">{Number(b.count) || 0}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-zinc-400">{loading ? 'Đang tải…' : 'Chưa có dữ liệu heatmap.'}</div>
            )}
          </div>
        </div>
      </div>

      {tokenModalOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4">
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-zinc-950 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-lg font-black text-zinc-50">Tracking Token</div>
                <div className="mt-1 text-xs text-zinc-400">Design: {issuedForId}</div>
              </div>
              <button
                onClick={() => setTokenModalOpen(false)}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-zinc-100 hover:bg-white/10"
              >
                Đóng
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-xs font-semibold tracking-wider text-zinc-400">TOKEN</div>
                <div className="mt-2 break-all text-xs text-zinc-200">{issuedToken}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-xs font-semibold tracking-wider text-zinc-400">TRACK URL (QR)</div>
                <div className="mt-2 break-all text-xs text-sky-200">{trackUrl}</div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(issuedToken);
                    } catch {}
                  }}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-zinc-100 hover:bg-white/10"
                >
                  Copy token
                </button>
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(trackUrl);
                    } catch {}
                  }}
                  className="rounded-xl border border-sky-500/25 bg-sky-500/10 px-4 py-2 text-sm font-semibold text-sky-200 hover:bg-sky-500/15"
                >
                  Copy URL
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminShadow;
