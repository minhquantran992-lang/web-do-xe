import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, getApiBaseUrl } from '../services/api/client.js';
import { useAuth } from '../services/auth/AuthContext.jsx';
import { useI18n } from '../services/i18n.jsx';

const cx = (...arr) => arr.filter(Boolean).join(' ');

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

const resolveAssetUrl = (url) => {
  const base = getApiBaseUrl();
  const u = String(url || '').trim();
  if (!u) return '';
  if (u.startsWith('data:') || u.startsWith('blob:')) return u;
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  if (u.startsWith('/')) return `${base}${u}`;
  return `${base}/${u}`;
};

const statusLabel = (s) => {
  const v = String(s || '').trim().toUpperCase();
  if (v === 'PENDING') return 'Mới tạo';
  if (v === 'DISPUTED') return 'Đang tranh chấp';
  if (v === 'UNDER_REVIEW') return 'Đang xử lý';
  if (v === 'RESOLVED') return 'Đã giải quyết';
  if (v === 'REJECTED') return 'Bị từ chối';
  return v || '—';
};

const statusTone = (s) => {
  const v = String(s || '').trim().toUpperCase();
  if (v === 'RESOLVED') return 'green';
  if (v === 'REJECTED') return 'red';
  if (v === 'UNDER_REVIEW' || v === 'DISPUTED') return 'orange';
  return 'gray';
};

const Badge = ({ tone, children }) => {
  const cls =
    tone === 'green'
      ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200'
      : tone === 'red'
        ? 'border-rose-500/25 bg-rose-500/10 text-rose-200'
        : tone === 'orange'
          ? 'border-amber-500/25 bg-amber-500/10 text-amber-200'
          : 'border-white/10 bg-white/5 text-zinc-200';
  return <span className={cx('inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold', cls)}>{children}</span>;
};

const issueTypeLabel = (v) => {
  const s = String(v || '').trim();
  if (s === 'wrong_part') return 'Sai phụ tùng / sai món';
  if (s === 'bad_installation') return 'Lắp đặt kém / lỗi kỹ thuật';
  if (s === 'overpricing') return 'Báo giá/thu phí bất hợp lý';
  return s || '—';
};

const logActionLabel = (action) => {
  const a = String(action || '').trim().toLowerCase();
  if (a === 'created') return 'Tạo khiếu nại';
  if (a === 'evidence_added') return 'Bổ sung bằng chứng';
  if (a === 'evidence_requested') return 'Yêu cầu bổ sung bằng chứng';
  if (a === 'status_changed') return 'Cập nhật trạng thái';
  if (a === 'admin_note_updated') return 'Cập nhật ghi chú nội bộ';
  if (a === 'shop_flagged') return 'Gắn cờ cửa hàng';
  if (a === 'shop_responded') return 'Cửa hàng phản hồi';
  return String(action || '').trim().replaceAll('_', ' ') || '—';
};

const AdminTickets = () => {
  const { token, user } = useAuth();
  const { t } = useI18n();
  const isAdmin = Boolean(user?.isAdmin) || String(user?.role || '').toUpperCase() === 'ADMIN';

  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);

  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState({ loading: false, error: '', item: null });

  const [action, setAction] = useState({ busy: false, error: '', ok: '' });
  const [statusNext, setStatusNext] = useState('UNDER_REVIEW');
  const [statusNote, setStatusNote] = useState('');
  const [evidenceNote, setEvidenceNote] = useState('');
  const [adminNoteDraft, setAdminNoteDraft] = useState('');
  const [flagEnabled, setFlagEnabled] = useState(false);
  const [flagNote, setFlagNote] = useState('');

  const load = async ({ status: st } = {}) => {
    if (!token || !isAdmin) return;
    setLoading(true);
    setError('');
    try {
      const qs = st ? `?status=${encodeURIComponent(String(st))}` : '';
      const data = await apiFetch(`/api/admin/tickets${qs}`, { token });
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      const msg = String(e?.message || 'Không thể tải danh sách khiếu nại.');
      if (Number(e?.status) === 403) setError(t('admin_forbidden'));
      else if (Number(e?.status) === 401) setError(t('admin_login_req'));
      else setError(msg);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async ({ id }) => {
    const tid = String(id || '').trim();
    if (!token || !isAdmin || !tid) return;
    setDetail({ loading: true, error: '', item: null });
    setAction({ busy: false, error: '', ok: '' });
    try {
      const data = await apiFetch(`/api/admin/tickets/${encodeURIComponent(tid)}`, { token });
      const item = data?.item || null;
      setDetail({ loading: false, error: '', item });
      setAdminNoteDraft(String(item?.adminNote || ''));
      setFlagEnabled(Boolean(item?.shopFlagged));
      setFlagNote('');
      setStatusNote('');
      setEvidenceNote('');
      setStatusNext('UNDER_REVIEW');
    } catch (e) {
      setDetail({ loading: false, error: String(e?.message || 'Không thể tải chi tiết khiếu nại.'), item: null });
    }
  };

  useEffect(() => {
    load({ status });
  }, [token, isAdmin]);

  useEffect(() => {
    if (!selectedId) return;
    loadDetail({ id: selectedId });
  }, [selectedId, token, isAdmin]);

  const selected = detail.item;
  const canFinalize = !['RESOLVED', 'REJECTED'].includes(String(selected?.status || '').toUpperCase());

  const bookingSummary = useMemo(() => {
    const b = selected?.booking || null;
    if (!b) return null;
    const status = String(b.status || '').toLowerCase();
    const timeSlot = b.timeSlot ? new Date(b.timeSlot).toLocaleString('vi-VN') : '—';
    return { status, timeSlot, id: String(b._id || ''), buildId: String(b.buildId || '') };
  }, [selected?.booking]);

  const runAction = async (fn) => {
    if (!token || !isAdmin || action.busy) return;
    setAction({ busy: true, error: '', ok: '' });
    try {
      await fn();
      setAction({ busy: false, error: '', ok: 'OK' });
      if (selectedId) await loadDetail({ id: selectedId });
      await load({ status });
    } catch (e) {
      setAction({ busy: false, error: String(e?.message || 'Không thể thực hiện thao tác.'), ok: '' });
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
        <div className="text-2xl font-black tracking-tight text-zinc-50">Admin • Khiếu nại</div>
        <div className="mt-1 text-sm text-zinc-300">Danh sách khiếu nại + xử lý trạng thái + yêu cầu bổ sung bằng chứng.</div>
      </div>

      {error ? <div className="mb-5 rounded-2xl border border-red-500/25 bg-red-950/30 p-4 text-sm text-red-200">{error}</div> : null}

      <div className="mb-5 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <label className="block w-full max-w-sm">
            <div className="mb-1 text-xs font-semibold tracking-wider text-zinc-400">Lọc theo trạng thái</div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              style={{ colorScheme: 'dark' }}
              className="w-full rounded-xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-sky-400/40"
            >
              <option value="">Tất cả</option>
              <option value="PENDING">Mới tạo</option>
              <option value="UNDER_REVIEW">Đang xử lý</option>
              <option value="DISPUTED">Đang tranh chấp</option>
              <option value="RESOLVED">Đã giải quyết</option>
              <option value="REJECTED">Bị từ chối</option>
            </select>
          </label>
          <button
            onClick={() => load({ status })}
            disabled={loading}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-zinc-100 hover:bg-white/10 disabled:opacity-60"
          >
            {loading ? 'Đang tải…' : 'Tải lại'}
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <div className="rounded-2xl border border-white/10 bg-white/5">
          <div className="border-b border-white/10 px-4 py-3">
            <div className="text-sm font-black tracking-wide text-zinc-50">Danh sách khiếu nại</div>
            <div className="mt-1 text-xs text-zinc-400">Bấm một khiếu nại để xem chi tiết và xử lý</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="text-xs text-zinc-400">
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 font-semibold">Mã khiếu nại</th>
                  <th className="px-4 py-3 font-semibold">Booking</th>
                  <th className="px-4 py-3 font-semibold">Cửa hàng</th>
                  <th className="px-4 py-3 font-semibold">Khách</th>
                  <th className="px-4 py-3 font-semibold">Vấn đề</th>
                  <th className="px-4 py-3 font-semibold">Trạng thái</th>
                  <th className="px-4 py-3 font-semibold">Tạo lúc</th>
                </tr>
              </thead>
              <tbody className="text-zinc-200">
                {items.length ? (
                  items.map((it) => {
                    const active = String(selectedId) === String(it?._id || '');
                    return (
                      <tr
                        key={it._id}
                        className={cx('border-b border-white/5 cursor-pointer', active ? 'bg-white/5' : 'hover:bg-white/5')}
                        onClick={() => setSelectedId(String(it._id))}
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold text-zinc-100">{String(it.ticketId || '').trim() || '—'}</div>
                          <div className="mt-1 text-xs text-zinc-400">{String(it._id || '')}</div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{String(it.bookingId || '').slice(-10) || '—'}</td>
                        <td className="px-4 py-3 font-mono text-xs">{String(it.shopId || '').slice(-10) || '—'}</td>
                        <td className="px-4 py-3 font-mono text-xs">{String(it.userId || '').slice(-10) || '—'}</td>
                        <td className="px-4 py-3">{issueTypeLabel(it.issueType)}</td>
                        <td className="px-4 py-3">
                          <Badge tone={statusTone(it.status)}>{statusLabel(it.status)}</Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-300">{formatDt(it.createdAt)}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="px-4 py-6 text-sm text-zinc-400" colSpan={7}>
                      {loading ? 'Đang tải…' : 'Chưa có khiếu nại.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5">
          <div className="border-b border-white/10 px-4 py-3">
            <div className="text-sm font-black tracking-wide text-zinc-50">Chi tiết</div>
            <div className="mt-1 text-xs text-zinc-400">Booking + bằng chứng + hành động admin</div>
          </div>
          <div className="p-4 space-y-4">
            {!selectedId ? <div className="text-sm text-zinc-400">Chọn 1 khiếu nại để xem chi tiết.</div> : null}
            {detail.loading ? <div className="text-sm text-zinc-400">Đang tải…</div> : null}
            {detail.error ? <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{detail.error}</div> : null}

            {selected ? (
              <>
                <div className="rounded-2xl border border-white/10 bg-zinc-950/40 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold text-zinc-400">Mã khiếu nại</div>
                      <div className="mt-1 text-sm font-black text-zinc-100">{selected.ticketId || '—'}</div>
                      <div className="mt-2 text-xs text-zinc-300">Loại: {issueTypeLabel(selected.issueType)}</div>
                      <div className="mt-1 text-xs text-zinc-400">Tạo lúc: {formatDt(selected.createdAt)}</div>
                    </div>
                    <Badge tone={statusTone(selected.status)}>{statusLabel(selected.status)}</Badge>
                  </div>
                  {selected.needsMoreEvidence ? (
                    <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                      Đang chờ user bổ sung bằng chứng{selected.evidenceRequestNote ? `: ${String(selected.evidenceRequestNote)}` : '.'}
                    </div>
                  ) : null}
                  {selected.shopFlagged ? (
                    <div className="mt-3 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                      Shop đã bị gắn cờ chất lượng (từ khiếu nại này).
                    </div>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-white/10 bg-zinc-950/40 p-4">
                  <div className="text-xs font-semibold text-zinc-400">Mô tả</div>
                  <div className="mt-2 whitespace-pre-wrap text-sm text-zinc-200">{selected.description || '—'}</div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-zinc-950/40 p-4">
                  <div className="text-xs font-semibold text-zinc-400">Booking</div>
                  {bookingSummary ? (
                    <div className="mt-2 space-y-1 text-sm text-zinc-200">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-zinc-400">Mã booking</span>
                        <Link
                          className="font-mono text-xs font-semibold text-sky-300 hover:text-sky-200"
                          to={`/booking/${encodeURIComponent(bookingSummary.id)}`}
                        >
                          {bookingSummary.id}
                        </Link>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-zinc-400">Trạng thái</span>
                        <span className="font-semibold">{bookingSummary.status || '—'}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-zinc-400">Thời gian</span>
                        <span className="font-semibold">{bookingSummary.timeSlot}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-zinc-400">Mã cấu hình</span>
                        <span className="font-mono text-xs">{bookingSummary.buildId.slice(-10) || '—'}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-zinc-400">Không có dữ liệu booking.</div>
                  )}
                  {selected.shop ? (
                    <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                      <div className="text-xs font-semibold text-zinc-400">Shop</div>
                      <div className="mt-1 text-sm font-semibold text-zinc-100">{selected.shop.shopName || '—'}</div>
                      <div className="mt-1 text-xs text-zinc-400">{selected.shop.email || ''}</div>
                    </div>
                  ) : null}
                  {selected.user ? (
                    <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                      <div className="text-xs font-semibold text-zinc-400">User</div>
                      <div className="mt-1 text-sm font-semibold text-zinc-100">{selected.user.name || selected.user.email || '—'}</div>
                      <div className="mt-1 text-xs text-zinc-400">{selected.user.email || ''}</div>
                    </div>
                  ) : null}
                </div>

                {Array.isArray(selected.media) && selected.media.length ? (
                  <div className="rounded-2xl border border-white/10 bg-zinc-950/40 p-4">
                    <div className="text-xs font-semibold text-zinc-400">Bằng chứng</div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {selected.media.slice(0, 12).map((m) => {
                        const url = resolveAssetUrl(m?.fileUrl);
                        const isImage = String(m?.fileType || '') === 'image';
                        const isVideo = String(m?.fileType || '') === 'video';
                        const isVideoFile = /\.mp4$|\.webm$|\.mov$/i.test(url);
                        return (
                          <div key={m._id} className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                            {isImage && url ? <img alt="" src={url} className="h-44 w-full object-cover" /> : null}
                            {isVideo && url && isVideoFile ? <video src={url} controls className="h-44 w-full object-cover" /> : null}
                            {isVideo && url && !isVideoFile ? (
                              <div className="p-4">
                                <a href={url} target="_blank" rel="noreferrer" className="text-sm font-bold text-sky-300 hover:text-sky-200">
                                  Mở link video
                                </a>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-zinc-950/40 p-4 text-sm text-zinc-400">Chưa có bằng chứng.</div>
                )}

                <div className="rounded-2xl border border-white/10 bg-zinc-950/40 p-4">
                  <div className="text-xs font-semibold text-zinc-400">Ghi chú nội bộ</div>
                  <textarea
                    rows={4}
                    value={adminNoteDraft}
                    onChange={(e) => setAdminNoteDraft(e.target.value)}
                    className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-sky-400/40"
                  />
                  <button
                    type="button"
                    disabled={action.busy}
                    onClick={() =>
                      runAction(async () => {
                        await apiFetch(`/api/admin/tickets/${encodeURIComponent(String(selectedId))}/note`, {
                          token,
                          method: 'POST',
                          body: { note: String(adminNoteDraft || '').trim() }
                        });
                      })
                    }
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-zinc-100 hover:bg-white/10 disabled:opacity-60"
                  >
                    Lưu ghi chú
                  </button>
                </div>

                <div className="rounded-2xl border border-white/10 bg-zinc-950/40 p-4">
                  <div className="text-xs font-semibold text-zinc-400">Đổi trạng thái</div>
                  <div className="mt-2 grid gap-2">
                    <select
                      value={statusNext}
                      onChange={(e) => setStatusNext(e.target.value)}
                      disabled={action.busy || !canFinalize}
                      style={{ colorScheme: 'dark' }}
                      className="w-full rounded-2xl border border-white/15 bg-zinc-950/70 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-sky-400/40 disabled:opacity-60"
                    >
                      <option value="UNDER_REVIEW">Đang xử lý</option>
                      <option value="DISPUTED">Đang tranh chấp</option>
                      <option value="RESOLVED">Đã giải quyết</option>
                      <option value="REJECTED">Bị từ chối</option>
                    </select>
                    <textarea
                      rows={3}
                      value={statusNote}
                      onChange={(e) => setStatusNote(e.target.value)}
                      disabled={action.busy || !canFinalize}
                      placeholder="Ghi chú gửi cho khách (tuỳ chọn)"
                      className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-sky-400/40 disabled:opacity-60"
                    />
                    <button
                      type="button"
                      disabled={action.busy || !canFinalize}
                      onClick={() =>
                        runAction(async () => {
                          await apiFetch(`/api/admin/tickets/${encodeURIComponent(String(selectedId))}/status`, {
                            token,
                            method: 'POST',
                            body: { status: statusNext, note: String(statusNote || '').trim() }
                          });
                        })
                      }
                      className="w-full rounded-2xl bg-sky-400 px-4 py-2 text-sm font-black text-zinc-950 hover:bg-sky-300 disabled:opacity-60"
                    >
                      Cập nhật trạng thái
                    </button>
                    {!canFinalize ? <div className="text-xs text-zinc-500">Khiếu nại đã kết thúc, không thể đổi trạng thái.</div> : null}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-zinc-950/40 p-4">
                  <div className="text-xs font-semibold text-zinc-400">Yêu cầu bổ sung bằng chứng</div>
                  <textarea
                    rows={3}
                    value={evidenceNote}
                    onChange={(e) => setEvidenceNote(e.target.value)}
                    disabled={action.busy || !canFinalize}
                    placeholder="Nêu rõ cần bổ sung gì (ảnh/video hoá đơn, ảnh trước/sau, ...)"
                    className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-sky-400/40 disabled:opacity-60"
                  />
                  <button
                    type="button"
                    disabled={action.busy || !canFinalize}
                    onClick={() =>
                      runAction(async () => {
                        await apiFetch(`/api/admin/tickets/${encodeURIComponent(String(selectedId))}/request-evidence`, {
                          token,
                          method: 'POST',
                          body: { note: String(evidenceNote || '').trim() }
                        });
                      })
                    }
                    className="mt-2 w-full rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-2 text-sm font-black text-amber-100 hover:bg-amber-500/15 disabled:opacity-60"
                  >
                    Gửi yêu cầu
                  </button>
                </div>

                <div className="rounded-2xl border border-white/10 bg-zinc-950/40 p-4">
                  <div className="text-xs font-semibold text-zinc-400">Gắn cờ shop</div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-sm text-zinc-200">
                      <input
                        type="checkbox"
                        checked={flagEnabled}
                        onChange={(e) => setFlagEnabled(e.target.checked)}
                        disabled={action.busy}
                      />
                      Gắn cờ chất lượng
                    </label>
                  </div>
                  <textarea
                    rows={2}
                    value={flagNote}
                    onChange={(e) => setFlagNote(e.target.value)}
                    disabled={action.busy}
                    placeholder="Ghi chú (tuỳ chọn)"
                    className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-sky-400/40 disabled:opacity-60"
                  />
                  <button
                    type="button"
                    disabled={action.busy}
                    onClick={() =>
                      runAction(async () => {
                        await apiFetch(`/api/admin/tickets/${encodeURIComponent(String(selectedId))}/flag-shop`, {
                          token,
                          method: 'POST',
                          body: { enabled: Boolean(flagEnabled), note: String(flagNote || '').trim() }
                        });
                      })
                    }
                    className="mt-2 w-full rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-2 text-sm font-black text-rose-100 hover:bg-rose-500/15 disabled:opacity-60"
                  >
                    Lưu gắn cờ
                  </button>
                </div>

                {action.error ? <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{action.error}</div> : null}
                {action.ok ? <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">Đã lưu.</div> : null}

                {Array.isArray(selected.logs) && selected.logs.length ? (
                  <div className="rounded-2xl border border-white/10 bg-zinc-950/40 p-4">
                    <div className="text-xs font-semibold text-zinc-400">Lịch sử</div>
                    <div className="mt-3 space-y-2">
                      {selected.logs.slice(0, 14).map((l) => (
                        <div key={l._id} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                          <div className="flex items-center justify-between gap-2 text-xs text-zinc-400">
                            <div className="font-semibold text-zinc-300">{logActionLabel(l.action)}</div>
                            <div>{formatDt(l.createdAt)}</div>
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-2 text-xs text-zinc-500">
                            <div>Vai trò: {String(l.actorRole || '').toUpperCase()}</div>
                            <div className="font-mono">{String(l.actorId || '').slice(-10)}</div>
                          </div>
                          {l.note ? <div className="mt-1 whitespace-pre-wrap text-xs text-zinc-200">{l.note}</div> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminTickets;
