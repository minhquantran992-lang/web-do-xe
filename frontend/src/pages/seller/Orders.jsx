import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../services/auth/AuthContext.jsx';
import { getApiBaseUrl } from '../../services/api/client.js';
import { completeVendorOrder, getVendorOrderDetail, listVendorOrders, quoteVendorOrder, startVendorOrder, uploadVendorOrderProof } from '../../services/api/orders.js';

const cx = (...arr) => arr.filter(Boolean).join(' ');

const Orders = () => {
  const { token } = useAuth();
  const base = useMemo(() => getApiBaseUrl(), []);

  const resolveAssetUrl = useCallback(
    (url) => {
      const u = String(url || '').trim();
      if (!u) return '';
      if (u.startsWith('data:') || u.startsWith('blob:')) return u;
      if (u.startsWith('http://') || u.startsWith('https://')) return u;
      if (u.startsWith('/')) return `${base}${u}`;
      return `${base}/${u}`;
    },
    [base]
  );

  const [items, setItems] = useState([]);
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const [quotedPrice, setQuotedPrice] = useState('');
  const [note, setNote] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const stepsMap = useMemo(() => new Map((Array.isArray(steps) ? steps : []).map((s) => [String(s?.key || ''), String(s?.label || '')])), [steps]);
  const labelOf = useCallback((key) => {
    const fallback = {
      REQUESTED: 'Yêu cầu báo giá',
      QUOTED: 'Đã có báo giá (chờ khách xác nhận)',
      CONFIRMED: 'Khách đã xác nhận (chờ thi công)',
      IN_PROGRESS: 'Đang thi công',
      COMPLETED: 'Hoàn tất',
      REJECTED: 'Khách từ chối báo giá',
      CANCELLED: 'Đơn bị hủy'
    };
    return stepsMap.get(String(key || '')) || fallback[String(key || '')] || String(key || '');
  }, [stepsMap]);

  const loadList = useCallback(async ({ silent } = {}) => {
    if (!token) return;
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      const data = await listVendorOrders({ token, limit: 50 });
      setItems(Array.isArray(data?.items) ? data.items : []);
      setSteps(Array.isArray(data?.steps) ? data.steps : []);
    } catch (e) {
      setError(String(e?.message || 'FAILED_TO_LOAD'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadDetail = useCallback(async ({ id, silent } = {}) => {
    const oid = String(id || selectedId || '').trim();
    if (!token || !oid) return;
    if (!silent) {
      setDetailLoading(true);
      setDetailError('');
    }
    try {
      const data = await getVendorOrderDetail({ token, id: oid });
      setDetail(data?.item || null);
      setSteps(Array.isArray(data?.steps) ? data.steps : []);
    } catch (e) {
      setDetailError(String(e?.message || 'FAILED_TO_LOAD'));
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, [selectedId, token]);

  useEffect(() => {
    loadList({});
  }, [loadList]);

  useEffect(() => {
    if (!token) return;
    const id = window.setInterval(() => loadList({ silent: true }), 8000);
    return () => window.clearInterval(id);
  }, [loadList, token]);

  useEffect(() => {
    if (!selectedId) return;
    setQuotedPrice('');
    setNote('');
    setProofUrl('');
    loadDetail({ id: selectedId });
  }, [loadDetail, selectedId]);

  useEffect(() => {
    if (!token || !selectedId) return;
    const id = window.setInterval(() => loadDetail({ id: selectedId, silent: true }), 8000);
    return () => window.clearInterval(id);
  }, [loadDetail, selectedId, token]);

  const flow = Array.isArray(steps) ? steps : [];
  const history = Array.isArray(detail?.history) ? detail.history : [];
  const currentIdx = Number(detail?.currentStepIndex) || 0;
  const statusKey = String(detail?.status || '').trim();
  const canQuote = Boolean(detail && statusKey === 'REQUESTED');
  const canStart = Boolean(detail && statusKey === 'CONFIRMED');
  const canComplete = Boolean(detail && statusKey === 'IN_PROGRESS');

  return (
    <div className="space-y-4">
      {toast ? (
        <div className="rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm font-semibold text-sky-100">{toast}</div>
      ) : null}
      {error ? <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="rounded-3xl border border-zinc-800/70 bg-zinc-950/50 p-5 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-bold text-zinc-50">Đơn hàng</div>
            <button
              type="button"
              onClick={() => loadList({})}
              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10"
            >
              Tải lại
            </button>
          </div>

          {loading ? <div className="mt-4 text-sm text-zinc-400">Đang tải...</div> : null}

          <div className="mt-4 space-y-2">
            {items.map((o) => {
              const oid = String(o?._id || '');
              const active = oid === selectedId;
              const buildName = String(o?.build?.name || '').trim() || oid;
              const userName = String(o?.user?.name || o?.user?.email || '').trim();
              const statusKey = String(o?.status || '').trim();
              const statusLabel = labelOf(statusKey);
              const thumb = String(o?.build?.thumbnailUrl || '').trim();
              return (
                <button
                  key={oid}
                  type="button"
                  onClick={() => setSelectedId(oid)}
                  className={cx(
                    'flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition',
                    active ? 'border-sky-400/25 bg-sky-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10'
                  )}
                >
                  <div className="h-10 w-10 overflow-hidden rounded-xl border border-white/10 bg-black/20">
                    {thumb ? <img src={resolveAssetUrl(thumb)} alt="" className="h-full w-full object-cover" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-zinc-100">{buildName}</div>
                    <div className="mt-0.5 truncate text-xs text-zinc-400">
                      {userName ? `${userName} • ${statusLabel}` : statusLabel}
                    </div>
                  </div>
                </button>
              );
            })}

            {!loading && !items.length ? <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-300">Chưa có đơn nào.</div> : null}
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-800/70 bg-zinc-950/50 p-5 backdrop-blur-xl">
          {!selectedId ? <div className="text-sm text-zinc-300">Chọn một đơn để xem chi tiết.</div> : null}

          {detailError ? <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{detailError}</div> : null}
          {detailLoading ? <div className="text-sm text-zinc-400">Đang tải chi tiết...</div> : null}

          {!detailLoading && detail ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white/60">Đơn</div>
                  <div className="mt-1 truncate text-lg font-black tracking-tight text-white">{String(detail?._id || '')}</div>
                  <div className="mt-2 text-sm text-white/70">{labelOf(detail?.status)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => loadDetail({ id: selectedId })}
                    className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10"
                  >
                    Tải lại
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-sm font-semibold text-zinc-100">Tiến độ</div>
                <div className="mt-3 grid gap-2 md:grid-cols-5">
                  {flow.map((s, idx) => {
                    const done = idx < currentIdx || (statusKey === 'COMPLETED' && idx === flow.length - 1);
                    const active = idx === Math.min(flow.length - 1, Math.max(0, currentIdx)) && statusKey !== 'CANCELLED' && statusKey !== 'REJECTED';
                    return (
                      <div key={String(s?.key || idx)} className="flex items-center gap-2 md:block">
                        <div
                          className={cx(
                            'grid h-7 w-7 place-items-center rounded-full border text-xs font-black',
                            done ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200' : active ? 'border-sky-400/30 bg-sky-500/10 text-sky-100' : 'border-white/10 bg-white/5 text-zinc-300'
                          )}
                        >
                          {idx + 1}
                        </div>
                        <div className={cx('text-xs font-semibold', done ? 'text-zinc-100' : active ? 'text-sky-100' : 'text-zinc-400')}>
                          {String(s?.label || '') || labelOf(s?.key)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-sm font-semibold text-zinc-100">Cập nhật trạng thái</div>

                {statusKey === 'QUOTED' ? (
                  <div className="mt-2 text-sm text-zinc-300">
                    Đã gửi báo giá. Chờ khách xác nhận{detail?.quoteExpiresAt ? ` (hết hạn: ${new Date(detail.quoteExpiresAt).toLocaleString('vi-VN')})` : ''}.
                  </div>
                ) : statusKey === 'REJECTED' ? (
                  <div className="mt-2 text-sm text-rose-200">Khách đã từ chối báo giá.</div>
                ) : statusKey === 'CANCELLED' ? (
                  <div className="mt-2 text-sm text-rose-200">Đơn đã bị hủy.</div>
                ) : statusKey === 'COMPLETED' ? (
                  <div className="mt-2 text-sm text-emerald-200">Đơn đã hoàn tất.</div>
                ) : null}

                {canQuote ? (
                  <div className="mt-3 space-y-3">
                    <label className="block space-y-1">
                      <div className="text-xs font-semibold text-zinc-400">Báo giá (VND)</div>
                      <input
                        value={quotedPrice}
                        onChange={(e) => setQuotedPrice(e.target.value)}
                        inputMode="numeric"
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-sky-400/40"
                        placeholder="Ví dụ: 1500000"
                      />
                    </label>
                    <label className="block space-y-1">
                      <div className="text-xs font-semibold text-zinc-400">Ghi chú (tuỳ chọn)</div>
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={3}
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-sky-400/40"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={saving || uploading}
                      onClick={async () => {
                        if (!token || !selectedId) return;
                        const price = Number(String(quotedPrice || '').replace(/[^\d.]/g, ''));
                        if (!Number.isFinite(price) || price <= 0) {
                          setToast('Vui lòng nhập báo giá hợp lệ.');
                          window.setTimeout(() => setToast(''), 3000);
                          return;
                        }
                        setSaving(true);
                        try {
                          await quoteVendorOrder({ token, id: selectedId, quotedPrice: price, note });
                          setNote('');
                          setQuotedPrice('');
                          await loadDetail({ id: selectedId });
                          await loadList({ silent: true });
                          setToast('Đã gửi báo giá.');
                          window.setTimeout(() => setToast(''), 2500);
                        } catch (err) {
                          setToast(String(err?.message || 'FAILED_TO_SAVE'));
                          window.setTimeout(() => setToast(''), 3500);
                        }
                        setSaving(false);
                      }}
                      className="rounded-2xl bg-emerald-400 px-4 py-2 text-sm font-bold text-zinc-950 hover:bg-emerald-300 disabled:opacity-60"
                    >
                      {saving ? 'Đang gửi...' : 'Gửi báo giá'}
                    </button>
                  </div>
                ) : null}

                {canStart || canComplete ? (
                  <>
                    <label className="mt-3 block space-y-1">
                      <div className="text-xs font-semibold text-zinc-400">Ghi chú (tuỳ chọn)</div>
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={3}
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-sky-400/40"
                      />
                    </label>

                    <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
                      <label className="block space-y-1">
                        <div className="text-xs font-semibold text-zinc-400">Ảnh bằng chứng (tuỳ chọn)</div>
                        <input
                          type="file"
                          accept="image/*"
                          disabled={uploading}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file || !token || !selectedId) return;
                            setUploading(true);
                            try {
                              const data = await uploadVendorOrderProof({ token, id: selectedId, file });
                              const url = String(data?.url || '').trim();
                              setProofUrl(url);
                              setToast('Đã tải ảnh.');
                              window.setTimeout(() => setToast(''), 2500);
                            } catch (err) {
                              setToast(String(err?.message || 'UPLOAD_FAILED'));
                              window.setTimeout(() => setToast(''), 3500);
                            }
                            setUploading(false);
                          }}
                          className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 file:mr-3 file:rounded-xl file:border-0 file:bg-sky-500/15 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-sky-100 hover:bg-white/10"
                        />
                      </label>
                      <button
                        type="button"
                        disabled={saving || uploading}
                        onClick={async () => {
                          if (!token || !selectedId) return;
                          setSaving(true);
                          try {
                            if (canStart) {
                              await startVendorOrder({ token, id: selectedId, note, imageUrl: proofUrl });
                              setToast('Đã bắt đầu thi công.');
                            } else if (canComplete) {
                              await completeVendorOrder({ token, id: selectedId, note, imageUrl: proofUrl });
                              setToast('Đã hoàn tất.');
                            }
                            setNote('');
                            setProofUrl('');
                            await loadDetail({ id: selectedId });
                            await loadList({ silent: true });
                            window.setTimeout(() => setToast(''), 2500);
                          } catch (err) {
                            setToast(String(err?.message || 'FAILED_TO_SAVE'));
                            window.setTimeout(() => setToast(''), 3500);
                          }
                          setSaving(false);
                        }}
                        className="mt-6 rounded-2xl border border-sky-400/25 bg-sky-500/10 px-4 py-2 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/15 disabled:opacity-60 md:mt-0"
                      >
                        {saving ? 'Đang cập nhật...' : canStart ? 'Bắt đầu thi công' : 'Hoàn tất'}
                      </button>
                    </div>

                    {proofUrl ? (
                      <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                        <img src={resolveAssetUrl(proofUrl)} alt="" className="max-h-[240px] w-full object-cover" />
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-sm font-semibold text-zinc-100">Lịch sử</div>
                <div className="mt-3 space-y-2">
                  {history.map((h, idx) => {
                    const ts = h?.happenedAt || null;
                    const img = String(h?.imageUrl || '').trim();
                    const n = String(h?.note || '').trim();
                    const toStatus = String(h?.toStatus || '').trim();
                    const fromStatus = h?.fromStatus ? String(h?.fromStatus || '').trim() : '';
                    const who = String(h?.actorRole || '').trim();
                    return (
                      <div key={String(h?._id || idx)} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-zinc-100">
                              {fromStatus ? `${labelOf(fromStatus)} → ` : ''}
                              {labelOf(toStatus)}
                            </div>
                            {who ? <div className="mt-1 text-xs text-zinc-400">{who === 'USER' ? 'Khách' : who === 'WORKSHOP' ? 'Xưởng' : 'Hệ thống'}</div> : null}
                            {ts ? <div className="mt-1 text-xs text-zinc-400">{new Date(ts).toLocaleString('vi-VN')}</div> : null}
                            {n ? <div className="mt-2 whitespace-pre-wrap text-sm text-zinc-200">{n}</div> : null}
                          </div>
                          {img ? (
                            <a
                              href={resolveAssetUrl(img)}
                              target="_blank"
                              rel="noreferrer"
                              className="shrink-0 rounded-xl border border-sky-400/25 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-100 transition hover:bg-sky-500/15"
                            >
                              Xem ảnh
                            </a>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default Orders;
