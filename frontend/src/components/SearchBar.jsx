import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchItems } from '../services/api/search.js';
import { getApiBaseUrl } from '../services/api/client.js';
import { useI18n } from '../services/i18n.jsx';

const HISTORY_KEY = 'carbanana.searchHistory';

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildDiacriticsRegex = (query) => {
  const q = String(query || '').trim();
  if (!q) return null;
  const map = {
    a: 'aàáạảãâầấậẩẫăằắặẳẵ',
    e: 'eèéẹẻẽêềếệểễ',
    i: 'iìíịỉĩ',
    o: 'oòóọỏõôồốộổỗơờớợởỡ',
    u: 'uùúụủũưừứựửữ',
    y: 'yỳýỵỷỹ',
    d: 'dđ'
  };
  let pattern = '';
  for (const rawCh of q) {
    const ch = rawCh.toLowerCase();
    if (map[ch]) {
      const chars = map[ch] + map[ch].toUpperCase();
      pattern += `[${escapeRegex(chars)}]`;
      continue;
    }
    if (/\s/.test(rawCh)) {
      pattern += '\\s+';
      continue;
    }
    pattern += escapeRegex(rawCh);
  }
  try {
    return new RegExp(pattern, 'ig');
  } catch {
    return null;
  }
};

const highlightParts = (text, query) => {
  const s = String(text || '');
  const q = String(query || '').trim();
  if (!s || !q) return [{ text: s, highlight: false }];

  const rx = buildDiacriticsRegex(q);
  if (!rx) return [{ text: s, highlight: false }];

  const out = [];
  let last = 0;
  let m;
  while ((m = rx.exec(s)) !== null) {
    const start = m.index;
    const end = start + String(m[0] || '').length;
    if (end <= start) break;
    if (start > last) out.push({ text: s.slice(last, start), highlight: false });
    out.push({ text: s.slice(start, end), highlight: true });
    last = end;
    if (out.length > 50) break;
  }
  if (last < s.length) out.push({ text: s.slice(last), highlight: false });
  return out.length ? out : [{ text: s, highlight: false }];
};

const readHistory = () => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed = JSON.parse(raw || 'null');
    return Array.isArray(parsed) ? parsed.map((x) => String(x || '').trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
};

const writeHistory = (items) => {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
  } catch {}
};

const formatPrice = (raw) => {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return '';
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(n)} ₫`;
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

const SearchBar = ({ className = '' }) => {
  const nav = useNavigate();
  const { t } = useI18n();
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const reqIdRef = useRef(0);

  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [history, setHistory] = useState(() => readHistory().slice(0, 6));

  const canSearch = String(q || '').trim().length > 0;

  useEffect(() => {
    const onDown = (e) => {
      const el = rootRef.current;
      if (!el) return;
      if (!el.contains(e.target)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (!canSearch) {
      setItems([]);
      setLoading(false);
      setActiveIndex(-1);
      return;
    }
    const myReqId = ++reqIdRef.current;
    setLoading(true);
    const id = window.setTimeout(() => {
      searchItems({ q, limit: 8 })
        .then((res) => {
          if (reqIdRef.current !== myReqId) return;
          setItems(Array.isArray(res) ? res : []);
          setActiveIndex(-1);
        })
        .catch(() => {
          if (reqIdRef.current !== myReqId) return;
          setItems([]);
          setActiveIndex(-1);
        })
        .finally(() => {
          if (reqIdRef.current !== myReqId) return;
          setLoading(false);
        });
    }, 300);
    return () => window.clearTimeout(id);
  }, [canSearch, open, q]);

  const commitHistory = (term) => {
    const v = String(term || '').trim();
    if (!v) return;
    const next = [v, ...history.filter((x) => x.toLowerCase() !== v.toLowerCase())].slice(0, 8);
    setHistory(next);
    writeHistory(next);
  };

  const goToItem = (it) => {
    const href = String(it?.href || '').trim();
    if (!href) return;
    commitHistory(q);
    setOpen(false);
    nav(href);
  };

  const goToSearchPage = () => {
    const term = String(q || '').trim();
    if (!term) return;
    commitHistory(term);
    setOpen(false);
    nav(`/search?q=${encodeURIComponent(term)}`);
  };

  const suggestions = useMemo(() => (open && !canSearch ? history : []), [canSearch, history, open]);

  return (
    <div ref={rootRef} className={`relative w-full ${className}`}>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/55">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
          </svg>
        </span>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false);
              return;
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              const max = (canSearch ? items : suggestions).length;
              if (!max) return;
              setActiveIndex((i) => (i + 1) % max);
              return;
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              const max = (canSearch ? items : suggestions).length;
              if (!max) return;
              setActiveIndex((i) => (i - 1 + max) % max);
              return;
            }
            if (e.key === 'Enter') {
              e.preventDefault();
              const list = canSearch ? items : suggestions.map((x) => ({ href: `/search?q=${encodeURIComponent(x)}` }));
              const picked = activeIndex >= 0 ? list[activeIndex] : null;
              if (picked?.href) {
                setOpen(false);
                if (!canSearch) {
                  const h = suggestions[activeIndex] || '';
                  if (h) commitHistory(h);
                } else {
                  commitHistory(q);
                }
                nav(picked.href);
                return;
              }
              goToSearchPage();
            }
          }}
          placeholder={t('search_placeholder')}
          className="h-11 w-full rounded-2xl border border-white/10 bg-white/5 pl-11 pr-4 text-sm text-white placeholder:text-white/45 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_20px_70px_-50px_rgba(56,189,248,0.45)] outline-none transition focus:border-sky-400/35 focus:bg-white/8"
        />
        {loading ? (
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/55">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2a10 10 0 1010 10" strokeLinecap="round" />
            </svg>
          </span>
        ) : null}
      </div>

      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-50 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/95 shadow-2xl backdrop-blur">
          {!canSearch ? (
            <div className="p-2">
              {suggestions.length ? (
                <div className="p-2 text-xs font-semibold text-white/55">{t('search_recent')}</div>
              ) : (
                <div className="p-3 text-sm text-white/70">{t('search_hint')}</div>
              )}
              {suggestions.length ? (
                <div className="grid gap-1 p-1">
                  {suggestions.map((h, idx) => (
                    <button
                      key={h}
                      type="button"
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => {
                        setQ(h);
                        setOpen(true);
                        inputRef.current?.focus?.();
                      }}
                      className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${
                        idx === activeIndex ? 'bg-white/10 text-white' : 'text-white/85 hover:bg-white/8'
                      }`}
                    >
                      <span className="truncate">{h}</span>
                      <span className="text-[11px] text-white/45">{t('search_open')}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="max-h-[380px] overflow-y-auto p-2">
              {items.length ? (
                <div className="grid gap-1">
                  {items.map((it, idx) => {
                    const img = String(it?.image || '').trim();
                    const imgResolved = resolveAssetUrl(img);
                    const price = it?.price != null ? formatPrice(it.price) : '';
                    const kind = String(it?.kind || '').trim();
                    return (
                      <button
                        key={`${kind}:${it?.id || it?.code || idx}`}
                        type="button"
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => goToItem(it)}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition ${
                          idx === activeIndex ? 'bg-white/10' : 'hover:bg-white/8'
                        }`}
                      >
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/30">
                          {imgResolved ? <img src={imgResolved} alt="" className="h-full w-full object-cover" /> : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-white">
                            {highlightParts(it?.name, q).map((p, i) =>
                              p.highlight ? (
                                <mark key={i} className="rounded bg-sky-400/25 px-1 text-white">
                                  {p.text}
                                </mark>
                              ) : (
                                <span key={i}>{p.text}</span>
                              )
                            )}
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-white/55">
                            <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 uppercase">{kind || 'item'}</span>
                            {it?.code ? <span className="truncate">{String(it.code)}</span> : null}
                          </div>
                        </div>
                        {price ? <div className="shrink-0 text-sm font-semibold text-sky-200">{price}</div> : null}
                      </button>
                    );
                  })}
                </div>
              ) : loading ? (
                <div className="p-3 text-sm text-white/70">{t('search_loading')}</div>
              ) : (
                <div className="p-3 text-sm text-white/70">{t('search_no_results')}</div>
              )}

              <div className="mt-2 border-t border-white/10 pt-2">
                <button
                  type="button"
                  onClick={goToSearchPage}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold text-white/90 hover:bg-white/8"
                >
                  <span className="truncate">{t('search_view_all')}</span>
                  <span className="text-white/60">↵</span>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default SearchBar;
