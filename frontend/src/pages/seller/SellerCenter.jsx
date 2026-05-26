import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { apiFetch, apiFetchForm, getApiBaseUrl } from '../../services/api/client.js';
import { useAuth } from '../../services/auth/AuthContext.jsx';
import { useI18n } from '../../services/i18n.jsx';
import { humanizeImageUploadError } from '../../services/validation.js';
import Header from './Header.jsx';
import Sidebar from './Sidebar.jsx';
import Dashboard from './Dashboard.jsx';
import Requests from './Requests.jsx';
import OrdersTab from './Orders.jsx';
import ShopProfile from './Products.jsx';
import Reviews from './Reviews.jsx';
import Modal from './Modal.jsx';

const cx = (...arr) => arr.filter(Boolean).join(' ');

const resolveAssetUrl = (url) => {
  const base = getApiBaseUrl();
  const u = String(url || '').trim();
  if (!u) return '';
  if (u.startsWith('data:') || u.startsWith('blob:')) return u;
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  if (u.startsWith('/')) return `${base}${u}`;
  return `${base}/${u}`;
};

const fmtMoney = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  try {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${Math.round(n)} ₫`;
  }
};

const ticketStatusLabel = (s) => {
  const v = String(s || '').trim().toUpperCase();
  if (v === 'PENDING') return 'Mới tạo';
  if (v === 'DISPUTED') return 'Đang tranh chấp';
  if (v === 'UNDER_REVIEW') return 'Đang xử lý';
  if (v === 'RESOLVED') return 'Đã giải quyết';
  if (v === 'REJECTED') return 'Bị từ chối';
  return v || '—';
};

const ticketStatusTone = (s) => {
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

const ShopProducts = () => {
  const { token } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [form, setForm] = useState({ title: '', price: '', stock: '0', description: '', coverImage: '' });
  const canCreate = Boolean(String(form.title || '').trim()) && Number(form.price) > 0;

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState('');
  const [editForm, setEditForm] = useState({ title: '', price: '', stock: '0', soldCount: '0', description: '', coverImage: '' });

  const uploadImage = async (file) => {
    if (!token || !file) return '';
    const base = getApiBaseUrl();
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${base}/api/vendor/cars/upload-image`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = data?.error || 'UPLOAD_FAILED';
      throw new Error(msg);
    }
    return String(data?.url || '').trim();
  };

  const load = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch('/api/vendor/cars', { token });
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      setItems([]);
      setError(e?.message || 'FAILED_TO_LOAD');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [token]);

  const create = async () => {
    if (!token || saving || !canCreate) return;
    setSaving(true);
    setError('');
    try {
      await apiFetch('/api/vendor/cars', {
        token,
        method: 'POST',
        body: {
          title: String(form.title || '').trim(),
          price: Number(form.price),
          stock: Number(form.stock || 0),
          description: String(form.description || '').trim(),
          coverImage: String(form.coverImage || '').trim(),
          images: []
        }
      });
      setForm({ title: '', price: '', stock: '0', description: '', coverImage: '' });
      setToast('Đã đăng sản phẩm.');
      window.setTimeout(() => setToast(''), 2500);
      await load();
    } catch (e) {
      setError(e?.message || 'FAILED_TO_SAVE');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (it) => {
    setEditId(String(it?._id || ''));
    setEditForm({
      title: String(it?.title || ''),
      price: String(Number(it?.price) || 0),
      stock: String(Number(it?.stock) || 0),
      soldCount: String(Number(it?.soldCount) || 0),
      description: String(it?.description || ''),
      coverImage: String(it?.coverImage || '')
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!token || saving || !editId) return;
    setSaving(true);
    setError('');
    try {
      await apiFetch(`/api/vendor/cars/${encodeURIComponent(editId)}`, {
        token,
        method: 'PUT',
        body: {
          title: String(editForm.title || '').trim(),
          price: Number(editForm.price),
          stock: Number(editForm.stock || 0),
          soldCount: Number(editForm.soldCount || 0),
          description: String(editForm.description || '').trim(),
          coverImage: String(editForm.coverImage || '').trim()
        }
      });
      setEditOpen(false);
      setEditId('');
      setToast('Đã cập nhật sản phẩm.');
      window.setTimeout(() => setToast(''), 2500);
      await load();
    } catch (e) {
      setError(e?.message || 'FAILED_TO_SAVE');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!token) return;
    const ok = window.confirm('Xoá sản phẩm này?');
    if (!ok) return;
    setError('');
    try {
      await apiFetch(`/api/vendor/cars/${encodeURIComponent(String(id || ''))}`, { token, method: 'DELETE' });
      setItems((prev) => prev.filter((x) => String(x?._id || '') !== String(id || '')));
    } catch (e) {
      setError(e?.message || 'FAILED_TO_DELETE');
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-zinc-800/70 bg-zinc-950/50 p-6 backdrop-blur-xl">
        <div className="text-sm font-bold text-zinc-50">Sản phẩm</div>
        <div className="mt-1 text-xs text-zinc-400">Đăng sản phẩm + đặt giá. Sản phẩm sẽ tự hiển thị trên Marketplace.</div>
      </div>

      {toast ? (
        <div className="rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm font-semibold text-sky-100">{toast}</div>
      ) : null}
      {error ? <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="rounded-3xl border border-zinc-800/70 bg-zinc-950/50 p-5 backdrop-blur-xl">
          <div className="text-sm font-bold text-zinc-50">Đăng sản phẩm mới</div>
          <div className="mt-4 grid gap-3">
            <label className="space-y-1">
              <div className="text-xs font-semibold text-zinc-400">Tên sản phẩm</div>
              <input
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-sky-400/40"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <div className="text-xs font-semibold text-zinc-400">Giá (VND)</div>
                <input
                  value={form.price}
                  onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
                  inputMode="numeric"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-sky-400/40"
                />
              </label>
              <label className="space-y-1">
                <div className="text-xs font-semibold text-zinc-400">Tồn kho</div>
                <input
                  value={form.stock}
                  onChange={(e) => setForm((p) => ({ ...p, stock: e.target.value }))}
                  inputMode="numeric"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-sky-400/40"
                />
              </label>
            </div>

            <label className="space-y-1">
              <div className="text-xs font-semibold text-zinc-400">Mô tả</div>
              <textarea
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                rows={5}
                className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-sky-400/40"
              />
            </label>

            <div className="grid gap-2">
              <label className="space-y-1">
                <div className="text-xs font-semibold text-zinc-400">Ảnh bìa (URL hoặc upload)</div>
                <input
                  value={form.coverImage}
                  onChange={(e) => setForm((p) => ({ ...p, coverImage: e.target.value }))}
                  placeholder="https://… hoặc /uploads/…"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-sky-400/40"
                />
              </label>
              <label className="inline-flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5">
                <div className="text-xs font-semibold text-zinc-300">Upload ảnh</div>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setError('');
                    try {
                      const url = await uploadImage(file);
                      setForm((p) => ({ ...p, coverImage: url }));
                    } catch (err) {
                      setError(humanizeImageUploadError(err));
                    } finally {
                      e.target.value = '';
                    }
                  }}
                  className="block w-[190px] text-xs text-zinc-300 file:mr-3 file:rounded-xl file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:font-bold file:text-zinc-100 hover:file:bg-white/15"
                />
              </label>
              <div className="text-[11px] font-semibold text-zinc-400">Ảnh sẽ được kiểm duyệt. Ảnh nhạy cảm sẽ bị từ chối.</div>
            </div>

            {form.coverImage ? (
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                <img alt="" src={resolveAssetUrl(form.coverImage)} className="max-h-52 w-full object-cover" />
              </div>
            ) : null}

            <button
              type="button"
              disabled={saving || !canCreate}
              onClick={create}
              className="w-full rounded-2xl bg-gradient-to-r from-sky-400 to-cyan-300 px-4 py-2.5 text-sm font-black text-zinc-950 hover:brightness-110 disabled:opacity-60"
            >
              {saving ? 'Đang đăng…' : 'Đăng sản phẩm'}
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-800/70 bg-zinc-950/50 p-5 backdrop-blur-xl">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-zinc-50">Danh sách sản phẩm</div>
              <div className="mt-1 text-xs text-zinc-400">{loading ? 'Đang tải…' : `Có ${items.length} sản phẩm`}</div>
            </div>
            <button
              type="button"
              onClick={load}
              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-zinc-100 hover:bg-white/10"
            >
              Tải lại
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {items.length ? (
              items.slice(0, 60).map((it) => (
                <div key={String(it?._id || '')} className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                  {it?.coverImage ? <img alt="" src={resolveAssetUrl(it.coverImage)} className="h-36 w-full object-cover" /> : null}
                  <div className="space-y-2 p-4">
                    <div className="truncate text-sm font-black text-zinc-50">{it?.title || '—'}</div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
                      <div className="font-extrabold text-sky-300">{fmtMoney(it?.price)}</div>
                      <div>Kho: {Number(it?.stock) || 0}</div>
                      <div>Đã bán: {Number(it?.soldCount) || 0}</div>
                      <div>Xem: {Number(it?.viewCount) || 0}</div>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => openEdit(it)}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-zinc-100 hover:bg-white/10"
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(it?._id)}
                        className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-200 hover:bg-rose-500/15"
                      >
                        Xoá
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : !loading ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-400 sm:col-span-2">Chưa có sản phẩm.</div>
            ) : null}
          </div>
        </div>
      </div>

      <Modal
        open={editOpen}
        title="Cập nhật sản phẩm"
        description="Chỉnh sửa giá/tồn kho và cập nhật số lượt bán."
        onClose={() => {
          setEditOpen(false);
          setEditId('');
        }}
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setEditOpen(false);
                setEditId('');
              }}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-zinc-100 hover:bg-white/10"
            >
              Huỷ
            </button>
            <button
              type="button"
              disabled={saving || !String(editForm.title || '').trim() || Number(editForm.price) < 0}
              onClick={saveEdit}
              className="rounded-2xl bg-gradient-to-r from-sky-400 to-cyan-300 px-4 py-2 text-xs font-black text-zinc-950 hover:brightness-110 disabled:opacity-60"
            >
              {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
            </button>
          </div>
        }
      >
        <div className="grid gap-3">
          <label className="space-y-1">
            <div className="text-xs font-semibold text-zinc-400">Tên sản phẩm</div>
            <input
              value={editForm.title}
              onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-sky-400/40"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1">
              <div className="text-xs font-semibold text-zinc-400">Giá (VND)</div>
              <input
                value={editForm.price}
                onChange={(e) => setEditForm((p) => ({ ...p, price: e.target.value }))}
                inputMode="numeric"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-sky-400/40"
              />
            </label>
            <label className="space-y-1">
              <div className="text-xs font-semibold text-zinc-400">Tồn kho</div>
              <input
                value={editForm.stock}
                onChange={(e) => setEditForm((p) => ({ ...p, stock: e.target.value }))}
                inputMode="numeric"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-sky-400/40"
              />
            </label>
            <label className="space-y-1">
              <div className="text-xs font-semibold text-zinc-400">Đã bán</div>
              <input
                value={editForm.soldCount}
                onChange={(e) => setEditForm((p) => ({ ...p, soldCount: e.target.value }))}
                inputMode="numeric"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-sky-400/40"
              />
            </label>
          </div>

          <label className="space-y-1">
            <div className="text-xs font-semibold text-zinc-400">Mô tả</div>
            <textarea
              value={editForm.description}
              onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
              rows={5}
              className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-sky-400/40"
            />
          </label>

          <div className="grid gap-2">
            <label className="space-y-1">
              <div className="text-xs font-semibold text-zinc-400">Ảnh bìa (URL hoặc upload)</div>
              <input
                value={editForm.coverImage}
                onChange={(e) => setEditForm((p) => ({ ...p, coverImage: e.target.value }))}
                placeholder="https://… hoặc /uploads/…"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-sky-400/40"
              />
            </label>
            <label className="inline-flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5">
              <div className="text-xs font-semibold text-zinc-300">Upload ảnh</div>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setError('');
                  try {
                    const url = await uploadImage(file);
                    setEditForm((p) => ({ ...p, coverImage: url }));
                  } catch (err) {
                    setError(humanizeImageUploadError(err));
                  } finally {
                    e.target.value = '';
                  }
                }}
                className="block w-[190px] text-xs text-zinc-300 file:mr-3 file:rounded-xl file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:font-bold file:text-zinc-100 hover:file:bg-white/15"
              />
            </label>
            <div className="text-[11px] font-semibold text-zinc-400">Ảnh sẽ được kiểm duyệt. Ảnh nhạy cảm sẽ bị từ chối.</div>
          </div>

          {editForm.coverImage ? (
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
              <img alt="" src={resolveAssetUrl(editForm.coverImage)} className="max-h-60 w-full object-cover" />
            </div>
          ) : null}
        </div>
      </Modal>
    </div>
  );
};

const ShopContent = () => {
  const { token } = useAuth();
  const [type, setType] = useState('post');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [form, setForm] = useState({ title: '', content: '', mediaUrl: '', thumbnailUrl: '' });

  const uploadPostMedia = async (file) => {
    if (!token || !file) return '';
    const base = getApiBaseUrl();
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${base}/api/vendor/posts/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = data?.error || 'UPLOAD_FAILED';
      throw new Error(msg);
    }
    return String(data?.url || '').trim();
  };

  useEffect(() => {
    if (!token) return;
    let alive = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await apiFetch(`/api/vendor/posts?type=${encodeURIComponent(type)}`, { token });
        if (!alive) return;
        setItems(Array.isArray(data?.items) ? data.items : []);
      } catch (e) {
        if (!alive) return;
        setItems([]);
        setError(e?.message || 'FAILED_TO_LOAD');
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [token, type]);

  const canCreate = Boolean(String(form.title || '').trim()) && (type !== 'video' || Boolean(String(form.mediaUrl || '').trim()));

  const create = async () => {
    if (!token || saving || !canCreate) return;
    setSaving(true);
    setError('');
    try {
      await apiFetch('/api/vendor/posts', {
        token,
        method: 'POST',
        body: {
          type,
          title: String(form.title || '').trim(),
          content: String(form.content || '').trim(),
          mediaUrl: String(form.mediaUrl || '').trim(),
          thumbnailUrl: String(form.thumbnailUrl || '').trim()
        }
      });
      setForm({ title: '', content: '', mediaUrl: '', thumbnailUrl: '' });
      setToast(type === 'video' ? 'Đã đăng video.' : 'Đã đăng bài.');
      window.setTimeout(() => setToast(''), 2500);
      const data = await apiFetch(`/api/vendor/posts?type=${encodeURIComponent(type)}`, { token });
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      setError(e?.message || 'FAILED_TO_SAVE');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!token) return;
    const ok = window.confirm('Xoá nội dung này?');
    if (!ok) return;
    try {
      await apiFetch(`/api/vendor/posts/${encodeURIComponent(String(id || ''))}`, { token, method: 'DELETE' });
      setItems((prev) => prev.filter((x) => String(x?._id || '') !== String(id || '')));
    } catch (e) {
      setError(e?.message || 'FAILED_TO_DELETE');
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-zinc-800/70 bg-zinc-950/50 p-6 backdrop-blur-xl">
        <div className="text-sm font-bold text-zinc-50">Bài viết & Video</div>
        <div className="mt-1 text-xs text-zinc-400">Đăng nội dung để hiển thị trên trang shop (storefront).</div>
      </div>

      {toast ? (
        <div className="rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm font-semibold text-sky-100">{toast}</div>
      ) : null}
      {error ? <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-3xl border border-zinc-800/70 bg-zinc-950/50 p-5 backdrop-blur-xl">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setType('post')}
              className={`rounded-2xl border px-4 py-2 text-xs font-black ${
                type === 'post' ? 'border-sky-400/30 bg-sky-500/15 text-sky-100' : 'border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10'
              }`}
            >
              Bài viết
            </button>
            <button
              type="button"
              onClick={() => setType('video')}
              className={`rounded-2xl border px-4 py-2 text-xs font-black ${
                type === 'video' ? 'border-sky-400/30 bg-sky-500/15 text-sky-100' : 'border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10'
              }`}
            >
              Video
            </button>
          </div>

          <div className="mt-4 grid gap-3">
            <label className="space-y-1">
              <div className="text-xs font-semibold text-zinc-400">Tiêu đề</div>
              <input
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-sky-400/40"
              />
            </label>

            <label className="space-y-1">
              <div className="text-xs font-semibold text-zinc-400">Nội dung</div>
              <textarea
                value={form.content}
                onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
                rows={6}
                className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-sky-400/40"
              />
            </label>

            <label className="space-y-1">
              <div className="text-xs font-semibold text-zinc-400">{type === 'video' ? 'Link video (bắt buộc)' : 'Ảnh minh hoạ (tuỳ chọn)'}</div>
              <input
                value={form.mediaUrl}
                onChange={(e) => setForm((p) => ({ ...p, mediaUrl: e.target.value }))}
                placeholder={type === 'video' ? 'https://… hoặc /uploads/…' : 'https://… hoặc /uploads/…'}
                disabled={saving || uploading}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-sky-400/40 disabled:opacity-60"
              />
            </label>

            <label className="inline-flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5">
              <div className="text-xs font-semibold text-zinc-300">{type === 'video' ? 'Upload video' : 'Upload ảnh minh hoạ'}</div>
              <input
                type="file"
                accept={type === 'video' ? 'video/mp4,video/webm,video/quicktime,video/x-m4v' : 'image/png,image/jpeg,image/webp,image/gif'}
                disabled={saving || uploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setError('');
                  setUploading(true);
                  try {
                    const url = await uploadPostMedia(file);
                    setForm((p) => ({ ...p, mediaUrl: url }));
                  } catch (err) {
                    setError(humanizeImageUploadError(err));
                  } finally {
                    setUploading(false);
                    e.target.value = '';
                  }
                }}
                className="block w-[210px] text-xs text-zinc-300 file:mr-3 file:rounded-xl file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:font-bold file:text-zinc-100 hover:file:bg-white/15 disabled:opacity-60"
              />
            </label>
            {type !== 'video' ? (
              <div className="text-[11px] font-semibold text-zinc-400">Ảnh sẽ được kiểm duyệt. Ảnh nhạy cảm sẽ bị từ chối.</div>
            ) : null}

            {type === 'video' ? (
              <>
                <label className="space-y-1">
                  <div className="text-xs font-semibold text-zinc-400">Thumbnail (tuỳ chọn)</div>
                  <input
                    value={form.thumbnailUrl}
                    onChange={(e) => setForm((p) => ({ ...p, thumbnailUrl: e.target.value }))}
                    placeholder="https://… hoặc /uploads/…"
                    disabled={saving || uploading}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-sky-400/40 disabled:opacity-60"
                  />
                </label>
                <label className="inline-flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5">
                  <div className="text-xs font-semibold text-zinc-300">Upload thumbnail</div>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    disabled={saving || uploading}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setError('');
                      setUploading(true);
                      try {
                        const url = await uploadPostMedia(file);
                        setForm((p) => ({ ...p, thumbnailUrl: url }));
                      } catch (err) {
                        setError(humanizeImageUploadError(err));
                      } finally {
                        setUploading(false);
                        e.target.value = '';
                      }
                    }}
                    className="block w-[210px] text-xs text-zinc-300 file:mr-3 file:rounded-xl file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:font-bold file:text-zinc-100 hover:file:bg-white/15 disabled:opacity-60"
                  />
                </label>
                <div className="text-[11px] font-semibold text-zinc-400">Ảnh sẽ được kiểm duyệt. Ảnh nhạy cảm sẽ bị từ chối.</div>
              </>
            ) : null}

            <button
              type="button"
              disabled={saving || uploading || !canCreate}
              onClick={create}
              className="w-full rounded-2xl bg-gradient-to-r from-sky-400 to-cyan-300 px-4 py-2.5 text-sm font-black text-zinc-950 hover:brightness-110 disabled:opacity-60"
            >
              {uploading ? 'Đang upload…' : saving ? 'Đang đăng…' : type === 'video' ? 'Đăng video' : 'Đăng bài'}
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-800/70 bg-zinc-950/50 p-5 backdrop-blur-xl">
          <div className="text-sm font-bold text-zinc-50">{type === 'video' ? 'Danh sách video' : 'Danh sách bài viết'}</div>
          <div className="mt-1 text-xs text-zinc-400">{loading ? 'Đang tải…' : `Có ${items.length} nội dung`}</div>

          <div className="mt-4 space-y-3">
            {items.length ? (
              items.slice(0, 50).map((it) => {
                const media = String(it?.mediaUrl || '').trim();
                const thumb = String(it?.thumbnailUrl || '').trim();
                const lower = media.toLowerCase();
                const isVideoFile = lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.ogg');
                return (
                  <div key={String(it?._id || '')} className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                    {type === 'post' && media ? <img alt="" src={resolveAssetUrl(media)} className="max-h-44 w-full object-cover" /> : null}
                    {type === 'video' && media && isVideoFile ? (
                      <video src={resolveAssetUrl(media)} controls className="w-full bg-black/40" />
                    ) : null}
                    {type === 'video' && !isVideoFile && thumb ? <img alt="" src={resolveAssetUrl(thumb)} className="max-h-44 w-full object-cover" /> : null}
                    <div className="space-y-2 p-4">
                      <div className="truncate text-sm font-black text-zinc-50">{it?.title || '—'}</div>
                      {it?.content ? <div className="line-clamp-3 whitespace-pre-wrap text-sm text-zinc-200/90">{it.content}</div> : null}
                      {type === 'video' && media && !isVideoFile ? (
                        <a href={media} target="_blank" rel="noreferrer" className="text-xs font-bold text-sky-300 hover:text-sky-200">
                          Mở link video
                        </a>
                      ) : null}
                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => remove(it?._id)}
                          className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-200 hover:bg-rose-500/15"
                        >
                          Xoá
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : !loading ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-400">Chưa có nội dung.</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

const VendorTickets = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('');

  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState({ loading: false, error: '', item: null });

  const [respond, setRespond] = useState({ busy: false, error: '', ok: '' });
  const [respondNote, setRespondNote] = useState('');
  const [respondFiles, setRespondFiles] = useState([]);

  const load = async ({ status } = {}) => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const qs = status ? `?status=${encodeURIComponent(String(status))}` : '';
      const data = await apiFetch(`/api/vendor/tickets${qs}`, { token });
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      setItems([]);
      setError(String(e?.message || 'Không thể tải danh sách khiếu nại.'));
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async ({ id }) => {
    const tid = String(id || '').trim();
    if (!token || !tid) return;
    setDetail({ loading: true, error: '', item: null });
    setRespond({ busy: false, error: '', ok: '' });
    setRespondNote('');
    setRespondFiles([]);
    try {
      const data = await apiFetch(`/api/vendor/tickets/${encodeURIComponent(tid)}`, { token });
      setDetail({ loading: false, error: '', item: data?.item || null });
    } catch (e) {
      setDetail({ loading: false, error: String(e?.message || 'Không thể tải chi tiết khiếu nại.'), item: null });
    }
  };

  useEffect(() => {
    load({ status });
  }, [token]);

  useEffect(() => {
    if (!selectedId) return;
    loadDetail({ id: selectedId });
  }, [selectedId, token]);

  const submitResponse = async () => {
    if (!token || respond.busy || !selectedId) return;
    const note = String(respondNote || '').trim();
    const files = Array.isArray(respondFiles) ? respondFiles : [];
    if (!note && !files.length) {
      setRespond({ busy: false, error: 'Vui lòng nhập nội dung phản hồi hoặc đính kèm bằng chứng.', ok: '' });
      return;
    }
    setRespond({ busy: true, error: '', ok: '' });
    try {
      const formData = new FormData();
      if (note) formData.append('note', note);
      for (const f of files.slice(0, 8)) {
        if (f) formData.append('files', f);
      }
      await apiFetchForm(`/api/vendor/tickets/${encodeURIComponent(String(selectedId))}/respond`, { token, method: 'POST', formData });
      setRespond({ busy: false, error: '', ok: '1' });
      setRespondNote('');
      setRespondFiles([]);
      await loadDetail({ id: selectedId });
      await load({ status });
    } catch (e) {
      setRespond({ busy: false, error: String(e?.message || 'Không thể gửi phản hồi.'), ok: '' });
    }
  };

  const selected = detail.item;

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-zinc-800/70 bg-zinc-950/50 p-6 backdrop-blur-xl">
        <div className="text-sm font-bold text-zinc-50">Khiếu nại</div>
        <div className="mt-1 text-xs text-zinc-400">Xem các khiếu nại liên quan shop và phản hồi khi cần.</div>
      </div>

      {error ? <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-3xl border border-zinc-800/70 bg-zinc-950/50 p-5 backdrop-blur-xl">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="text-sm font-bold text-zinc-50">Danh sách</div>
            <div className="flex items-center gap-2">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                style={{ colorScheme: 'dark' }}
                className="rounded-2xl border border-white/15 bg-zinc-950/70 px-3 py-2 text-xs font-semibold text-zinc-100 outline-none focus:border-sky-400/40"
              >
                <option value="">Tất cả</option>
                <option value="PENDING">Mới tạo</option>
                <option value="UNDER_REVIEW">Đang xử lý</option>
                <option value="DISPUTED">Đang tranh chấp</option>
                <option value="RESOLVED">Đã giải quyết</option>
                <option value="REJECTED">Bị từ chối</option>
              </select>
              <button
                type="button"
                onClick={() => load({ status })}
                disabled={loading}
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-100 hover:bg-white/10 disabled:opacity-60"
              >
                {loading ? 'Đang tải…' : 'Tải lại'}
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {items.length ? (
              items.slice(0, 120).map((t) => (
                <button
                  key={t._id}
                  type="button"
                  onClick={() => setSelectedId(String(t._id))}
                  className={cx(
                    'w-full rounded-2xl border px-4 py-3 text-left transition',
                    selectedId === String(t._id) ? 'border-sky-400/25 bg-sky-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-zinc-100">{String(t.ticketId || '').trim() || '—'}</div>
                      <div className="mt-1 text-xs text-zinc-400">Loại: {issueTypeLabel(t.issueType)}</div>
                      <div className="mt-1 text-xs text-zinc-500">Mã booking: {String(t.bookingId || '').slice(-10) || '—'}</div>
                    </div>
                    <Badge tone={ticketStatusTone(t.status)}>{ticketStatusLabel(t.status)}</Badge>
                  </div>
                </button>
              ))
            ) : !loading ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-400">Chưa có khiếu nại.</div>
            ) : (
              <div className="text-sm text-zinc-500">Đang tải…</div>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-800/70 bg-zinc-950/50 p-5 backdrop-blur-xl">
          <div className="text-sm font-bold text-zinc-50">Chi tiết</div>
          {!selectedId ? <div className="mt-3 text-sm text-zinc-400">Chọn 1 khiếu nại để xem chi tiết.</div> : null}
          {detail.loading ? <div className="mt-3 text-sm text-zinc-500">Đang tải…</div> : null}
          {detail.error ? <div className="mt-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{detail.error}</div> : null}

          {selected ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-zinc-400">Mã khiếu nại</div>
                    <div className="mt-1 text-sm font-black text-zinc-100">{selected.ticketId || '—'}</div>
                    <div className="mt-2 text-xs text-zinc-300">Loại: {issueTypeLabel(selected.issueType)}</div>
                  </div>
                  <Badge tone={ticketStatusTone(selected.status)}>{ticketStatusLabel(selected.status)}</Badge>
                </div>
                {selected.needsMoreEvidence ? (
                  <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                    Admin yêu cầu user bổ sung bằng chứng{selected.evidenceRequestNote ? `: ${String(selected.evidenceRequestNote)}` : '.'}
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs font-semibold text-zinc-400">Mô tả</div>
                <div className="mt-2 whitespace-pre-wrap text-sm text-zinc-200">{selected.description || '—'}</div>
              </div>

              {Array.isArray(selected.media) && selected.media.length ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-xs font-semibold text-zinc-400">Bằng chứng</div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {selected.media.slice(0, 10).map((m) => {
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
              ) : null}

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs font-semibold text-zinc-400">Phản hồi của shop</div>
                {respond.error ? <div className="mt-2 text-xs text-rose-200">{respond.error}</div> : null}
                {respond.ok ? <div className="mt-2 text-xs text-emerald-200">Đã gửi phản hồi.</div> : null}
                <textarea
                  rows={4}
                  value={respondNote}
                  onChange={(e) => setRespondNote(e.target.value)}
                  disabled={respond.busy}
                  placeholder="Giải thích / phản hồi cho admin"
                  className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-sky-400/40 disabled:opacity-60"
                />
                <input
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
                  disabled={respond.busy}
                  onChange={(e) => setRespondFiles(Array.from(e.target.files || []))}
                  className="mt-2 block w-full text-xs text-zinc-300 file:mr-3 file:rounded-xl file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:font-bold file:text-zinc-100 hover:file:bg-white/15"
                />
                <button
                  type="button"
                  onClick={submitResponse}
                  disabled={respond.busy}
                  className="mt-3 inline-flex w-full items-center justify-center rounded-2xl bg-sky-400 px-4 py-2.5 text-sm font-black text-zinc-950 hover:bg-sky-300 disabled:opacity-60"
                >
                  {respond.busy ? 'Đang gửi…' : 'Gửi phản hồi'}
                </button>
              </div>

              {Array.isArray(selected.logs) && selected.logs.length ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-xs font-semibold text-zinc-400">Lịch sử</div>
                  <div className="mt-3 space-y-2">
                    {selected.logs.slice(0, 12).map((l) => (
                      <div key={l._id} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                        <div className="flex items-center justify-between gap-2 text-xs text-zinc-400">
                          <div className="font-semibold text-zinc-300">{logActionLabel(l.action)}</div>
                          <div>{l.createdAt ? new Date(l.createdAt).toLocaleString('vi-VN') : '—'}</div>
                        </div>
                        {l.note ? <div className="mt-1 whitespace-pre-wrap text-xs text-zinc-200">{l.note}</div> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

const SellerCenter = () => {
  const { isAuthed, user, token } = useAuth();
  const { t } = useI18n();
  const role = String(user?.role || '').trim().toUpperCase();
  const isAdmin = Boolean(user?.isAdmin);
  const canAccess = Boolean(isAuthed && role === 'VENDOR');

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [active, setActive] = useState('requests');

  const [shopName, setShopName] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [toast, setToast] = useState('');
  const pendingRef = useRef({ ready: false, count: 0 });

  useEffect(() => {
    if (!canAccess) return;
    let alive = true;
    apiFetch('/api/vendor/shop', { token })
      .then((data) => {
        if (!alive) return;
        const item = data?.item || null;
        setShopName(String(item?.shopName || '').trim());
      })
      .catch(() => {
        if (!alive) return;
        setShopName('');
      });
    return () => {
      alive = false;
    };
  }, [canAccess, token]);

  useEffect(() => {
    if (!canAccess) return;
    let alive = true;
    const load = async () => {
      try {
        const data = await apiFetch('/api/vendor/stats', { token });
        if (!alive) return;
        const next = Number(data?.item?.newRequestsCount) || 0;
        const prev = pendingRef.current;
        if ((prev.ready && next > prev.count) || (!prev.ready && next > 0)) {
          setToast(t('seller_toast_new_request'));
          window.setTimeout(() => setToast(''), 4000);
        }
        pendingRef.current = { ready: true, count: next };
        setPendingCount(next);
      } catch {
        if (!alive) return;
        setPendingCount(0);
      }
    };
    load();
    const timerId = window.setInterval(load, 5000);
    return () => {
      alive = false;
      window.clearInterval(timerId);
    };
  }, [canAccess, token, t]);

  if (!isAuthed) return <Navigate to="/login" replace />;
  if (isAdmin) return <Navigate to="/admin/cars" replace />;
  if (!canAccess) return <Navigate to="/dashboard" replace />;

  const pageTitle = useMemo(() => {
    if (active === 'overview') return t('seller_page_overview');
    if (active === 'requests') return t('seller_page_requests');
    if (active === 'orders') return 'Đơn hàng';
    if (active === 'tickets') return 'Khiếu nại';
    if (active === 'profile') return t('shop_profile_title');
    if (active === 'content') return 'Bài viết & Video';
    if (active === 'products') return t('seller_page_products');
    if (active === 'reviews') return t('seller_reviews_title');
    return t('seller_sidebar_title');
  }, [active, t]);

  return (
    <div
      className="relative min-h-screen text-zinc-100"
      style={{
        backgroundImage:
          'radial-gradient(800px 420px at 15% 0%, rgba(56,189,248,0.30), transparent 60%), radial-gradient(720px 420px at 85% 15%, rgba(34,211,238,0.20), transparent 62%), radial-gradient(700px 460px at 80% 95%, rgba(168,85,247,0.16), transparent 60%), linear-gradient(180deg, #0b2a4a 0%, #070b14 45%, #05060a 100%)'
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.10) 1px, transparent 1px)',
          backgroundSize: '84px 84px'
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/0 via-black/10 to-black/30" />
      <div className="relative">
      <Header
        onOpenSidebar={() => setSidebarOpen(true)}
        userName={String(user?.name || user?.email || 'Vendor')}
        shopName={shopName || 'Garage'}
      />

      <div className="flex w-full gap-6 px-4 py-6">
        <Sidebar
          activeKey={active}
          onSelect={(k) => setActive(k)}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          pendingCount={pendingCount}
        />

        <main className="min-w-0 flex-1">
          {toast ? (
            <div className="mb-4 rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm font-semibold text-sky-100">
              {toast}
            </div>
          ) : null}
          {pendingCount > 0 ? (
            <button
              type="button"
              onClick={() => setActive('requests')}
              className="mb-4 w-full rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-left text-sm font-semibold text-amber-100 hover:bg-amber-500/15"
            >
              Có {pendingCount} yêu cầu mới. Bấm để xem trong Yêu cầu lắp đặt.
            </button>
          ) : null}
          <div className="mb-4 flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-sm font-bold text-zinc-50">{pageTitle}</div>
              <div className="mt-1 text-xs text-zinc-400">{t('seller_center_subtitle')}</div>
            </div>
            <div className="hidden items-center gap-2 md:flex">
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-200">
                {t('seller_chip_vendor_mode')}
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-200">
                {t('seller_chip_live_data')}
              </div>
            </div>
          </div>

          {active === 'overview' ? <Dashboard /> : null}
          {active === 'requests' ? <Requests /> : null}
          {active === 'orders' ? <OrdersTab /> : null}
          {active === 'tickets' ? <VendorTickets /> : null}
          {active === 'profile' ? <ShopProfile onSaved={(name) => setShopName(String(name || '').trim())} /> : null}
          {active === 'content' ? <ShopContent /> : null}
          {active === 'products' ? <ShopProducts /> : null}
          {active === 'reviews' ? <Reviews /> : null}
        </main>
      </div>
      </div>
    </div>
  );
};

export default SellerCenter;
