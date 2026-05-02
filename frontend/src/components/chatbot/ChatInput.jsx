
import React, { useMemo, useRef, useState } from 'react';
import { useI18n } from '../../services/i18n.jsx';

const normalize = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

const ChatInput = ({ onSend, disabled, placeholder, suggestions }) => {
  const { t } = useI18n();
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const handleSend = () => {
    const v = String(value || '').trim();
    if (!v) return;
    onSend?.(v);
    setValue('');
    setOpen(false);
  };

  const items = useMemo(() => {
    const q = normalize(value);
    if (!q) return [];
    const labels = {
      brand: t('chat_suggest_brand'),
      model: t('chat_suggest_model'),
      purpose: t('chat_suggest_purpose')
    };
    const brands = Array.isArray(suggestions?.brands) ? suggestions.brands : [];
    const models = Array.isArray(suggestions?.models) ? suggestions.models : [];
    const purposes = Array.isArray(suggestions?.purposes) ? suggestions.purposes : [];

    const take = (arr, type) =>
      arr
        .map((x) => String(x || '').trim())
        .filter(Boolean)
        .filter((x) => normalize(x).includes(q))
        .slice(0, 4)
        .map((x) => ({ type, value: x }));

    const out = [...take(brands, labels.brand), ...take(models, labels.model), ...take(purposes, labels.purpose)];
    const uniq = [];
    const seen = new Set();
    for (const it of out) {
      const k = `${it.type}:${it.value}`;
      if (seen.has(k)) continue;
      seen.add(k);
      uniq.push(it);
      if (uniq.length >= 6) break;
    }
    return uniq;
  }, [value, suggestions, t]);

  const applySuggestion = (s) => {
    const next = value ? `${String(value).replace(/\s+$/, '')} ${s}` : s;
    setValue(next);
    setOpen(false);
  };

  return (
    <div
      ref={rootRef}
      className="relative flex items-end gap-2"
      onBlur={(e) => {
        if (!rootRef.current) return;
        if (rootRef.current.contains(e.relatedTarget)) return;
        setOpen(false);
      }}
    >
      <div className="relative flex-1">
        <textarea
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          rows={2}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
            if (e.key === 'Escape') setOpen(false);
          }}
          placeholder={placeholder || t('chat_input_placeholder')}
          className="min-h-[44px] w-full resize-none rounded-2xl border border-white/10 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-sky-400/70 focus:shadow-[0_0_0_3px_rgba(14,165,233,0.15)]"
          disabled={disabled}
        />
        {open && items.length ? (
          <div className="absolute bottom-[calc(100%+8px)] left-0 right-0 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/95 shadow-2xl backdrop-blur">
            {items.map((it) => (
              <button
                key={`${it.type}:${it.value}`}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applySuggestion(it.value)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/5"
              >
                <span className="truncate">{it.value}</span>
                <span className="ml-3 shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-sky-200">
                  {it.type}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={handleSend}
        disabled={disabled}
        className="group rounded-2xl bg-gradient-to-br from-sky-400 to-cyan-300 px-3 py-2 text-zinc-950 shadow hover:from-sky-300 hover:to-cyan-200 disabled:opacity-60"
        aria-label="Send"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="2"
          stroke="currentColor"
          className="h-5 w-5"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 12l12-6-6 12-1.5-4.5L6 12z" />
        </svg>
      </button>
    </div>
  );
};

export default ChatInput;
