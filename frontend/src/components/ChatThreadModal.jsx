import { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '../services/api/client.js';
import { useAuth } from '../services/auth/AuthContext.jsx';
import ChatInput from './chatbot/ChatInput.jsx';
import ChatMessage from './chatbot/ChatMessage.jsx';

const cx = (...arr) => arr.filter(Boolean).join(' ');

const initials = (value) => {
  const s = String(value || '').trim();
  if (!s) return '';
  const parts = s.split(/\s+/).filter(Boolean);
  const a = parts[0] ? parts[0].slice(0, 1) : '';
  const b = parts.length > 1 ? parts[parts.length - 1].slice(0, 1) : '';
  return `${a}${b}`.toUpperCase().slice(0, 2);
};

const ChatThreadModal = ({ open, onClose, mode = 'user', shopId, userId }) => {
  const { token } = useAuth();
  const [thread, setThread] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const listRef = useRef(null);

  const base = mode === 'vendor' ? '/api/vendor/chat' : '/api/chat';

  const title = useMemo(() => {
    if (mode === 'vendor') {
      const u = thread?.user || null;
      return String(u?.name || u?.email || 'Khách hàng');
    }
    const s = thread?.shop || null;
    return String(s?.shopName || 'Shop');
  }, [mode, thread?.shop, thread?.user]);

  const subtitle = useMemo(() => {
    if (mode === 'vendor') {
      const u = thread?.user || null;
      return String(u?.email || '').trim();
    }
    const s = thread?.shop || null;
    if (s?.acceptingBookings === false) return 'Shop tạm thời ngưng nhận vì khách đông, mong bạn thông cảm.';
    return '';
  }, [mode, thread?.shop, thread?.user]);

  const normalizeRole = (senderType) => {
    const st = String(senderType || '').trim().toLowerCase();
    if (mode === 'vendor') return st === 'shop' ? 'user' : 'ai';
    return st === 'user' ? 'user' : 'ai';
  };

  const otherBadge = useMemo(() => {
    if (mode === 'vendor') {
      const u = thread?.user || null;
      return initials(u?.name || u?.email) || 'KH';
    }
    const s = thread?.shop || null;
    return initials(s?.shopName) || 'SH';
  }, [mode, thread?.shop, thread?.user]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const loadMessages = async ({ threadId }) => {
    const res = await apiFetch(`${base}/threads/${encodeURIComponent(String(threadId))}/messages?limit=60`, { token });
    return Array.isArray(res?.items) ? res.items : [];
  };

  useEffect(() => {
    if (!open) return;
    if (!token) return;
    let alive = true;
    setLoading(true);
    setError('');
    setThread(null);
    setItems([]);

    const init = async () => {
      try {
        const body = mode === 'vendor' ? { userId } : { shopId };
        const r = await apiFetch(`${base}/threads`, { token, method: 'POST', body });
        if (!alive) return;
        const th = r?.item || null;
        setThread(th);
        const msgs = th?._id ? await loadMessages({ threadId: th._id }) : [];
        if (!alive) return;
        setItems(msgs);
      } catch (e) {
        if (!alive) return;
        setError(String(e?.message || 'REQUEST_FAILED'));
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    };

    init();
    return () => {
      alive = false;
    };
  }, [open, token, mode, shopId, userId, base]);

  useEffect(() => {
    if (!open) return;
    if (!token) return;
    const id = String(thread?._id || '').trim();
    if (!id) return;
    let alive = true;
    const tick = async () => {
      try {
        const msgs = await loadMessages({ threadId: id });
        if (!alive) return;
        setItems(msgs);
      } catch {}
    };
    tick();
    const tm = window.setInterval(tick, 2000);
    return () => {
      alive = false;
      window.clearInterval(tm);
    };
  }, [open, token, base, thread?._id]);

  useEffect(() => {
    if (!open) return;
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [open, items.length, loading, sending]);

  const send = async (text) => {
    if (!token || sending) return;
    const id = String(thread?._id || '').trim();
    if (!id) return;
    const clean = String(text || '').trim();
    if (!clean) return;
    setSending(true);
    setError('');
    try {
      const r = await apiFetch(`${base}/threads/${encodeURIComponent(id)}/messages`, { token, method: 'POST', body: { text: clean } });
      const msg = r?.item || null;
      if (msg) setItems((prev) => [...(Array.isArray(prev) ? prev : []), msg]);
    } catch (e) {
      setError(String(e?.message || 'REQUEST_FAILED'));
    } finally {
      setSending(false);
    }
  };

  const deleteThread = async () => {
    if (!token || deleting || sending) return;
    const id = String(thread?._id || '').trim();
    if (!id) return;
    const ok = window.confirm('Xóa cuộc trò chuyện này?');
    if (!ok) return;
    setDeleting(true);
    setError('');
    try {
      await apiFetch(`${base}/threads/${encodeURIComponent(id)}`, { token, method: 'DELETE', failoverOnNotFound: true });
      setThread(null);
      setItems([]);
      onClose?.();
    } catch (e) {
      setError(String(e?.message || 'REQUEST_FAILED'));
    } finally {
      setDeleting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95]">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => {
          if (sending) return;
          onClose?.();
        }}
        aria-label="Close"
      />
      <div className="absolute inset-x-0 bottom-0 top-0 mx-auto w-[min(760px,100%)] sm:top-[46%] sm:h-auto sm:max-w-[760px] sm:-translate-y-1/2">
        <div className="h-full overflow-hidden border border-white/10 bg-zinc-950/90 shadow-2xl shadow-black/50 backdrop-blur-2xl sm:h-auto sm:rounded-3xl">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5 sm:py-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-sky-400 to-cyan-300 text-xs font-black text-zinc-950">
                <span className="pointer-events-none absolute -inset-6 bg-[radial-gradient(26px_26px_at_35%_35%,rgba(255,255,255,0.55),transparent_65%)]" />
                <span className="relative">{otherBadge}</span>
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-black text-zinc-50">{title}</div>
                {subtitle ? <div className="mt-0.5 truncate text-xs font-semibold text-zinc-400">{subtitle}</div> : null}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={deleteThread}
                disabled={deleting || sending || !thread?._id}
                className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-500/15 disabled:opacity-60"
              >
                {deleting ? 'Đang xóa…' : 'Xóa'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (sending || deleting) return;
                  onClose?.();
                }}
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10"
              >
                Đóng
              </button>
            </div>
          </div>

          <div className="grid h-[calc(100vh-56px)] grid-rows-[1fr_auto] sm:h-[70vh] sm:max-h-[680px]">
            <div
              ref={listRef}
              className="overflow-y-auto px-4 py-4 space-y-3 bg-[radial-gradient(560px_320px_at_30%_0%,rgba(34,211,238,0.10),transparent_60%),radial-gradient(520px_340px_at_80%_100%,rgba(56,189,248,0.10),transparent_60%)]"
            >
              {loading ? <div className="text-sm font-semibold text-zinc-500">Đang tải…</div> : null}
              {error ? <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}
              {!loading && !error && !items.length ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-300">Chưa có tin nhắn.</div>
              ) : null}
              {items.map((m) => {
                const role = normalizeRole(m?.senderType);
                return (
                  <ChatMessage
                    key={String(m?._id || '')}
                    role={role}
                    text={String(m?.text || '')}
                    createdAt={m?.createdAt}
                    avatarText={role === 'user' ? '' : otherBadge}
                  />
                );
              })}
            </div>
            <div className={cx('border-t border-white/10 bg-zinc-950/60 p-3', sending ? 'opacity-80' : '')}>
              <ChatInput onSend={send} disabled={sending || loading || !thread?._id} placeholder="Nhập tin nhắn…" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatThreadModal;
