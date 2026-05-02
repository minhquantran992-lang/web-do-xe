import React, { useEffect, useMemo, useRef, useState } from 'react';
import ChatMessage from './ChatMessage.jsx';
import ChatInput from './ChatInput.jsx';
import { useI18n } from '../../services/i18n.jsx';

const ChatWidget = () => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    if (!messages.length) {
      setMessages([{ role: 'ai', text: t('chat_welcome') }]);
    }
  }, [open, t]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, typing, open]);

  const send = (text) => {
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setTyping(true);
    const reply = mockReply(text);
    setTimeout(() => {
      setTyping(false);
      setMessages((prev) => [...prev, { role: 'ai', text: reply }]);
    }, 1000 + Math.floor(Math.random() * 600));
  };

  const mockReply = (s) => {
    const q = String(s || '').toLowerCase();
    if (/giá|bao nhiêu|price|cost/.test(q)) return t('chat_reply_price');
    if (/bảo hành|warranty/.test(q)) return t('chat_reply_warranty');
    if (/tour|đi xa|comfort/.test(q)) return t('chat_reply_tour');
    return t('chat_reply_default');
  };

  const ToggleButton = useMemo(
    () => (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-cyan-300 text-zinc-950 shadow-lg transition hover:from-sky-300 hover:to-cyan-200"
        aria-label="CSKH"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
          <path d="M12 2a7 7 0 00-7 7v2.5A4.5 4.5 0 009.5 16H10l2 4 2-4h.5A4.5 4.5 0 0019 11.5V9a7 7 0 00-7-7z" />
        </svg>
      </button>
    ),
    []
  );

  if (!open) return ToggleButton;

  return (
    <div
      className={`fixed bottom-6 right-6 z-40 w-[350px] max-w-[92vw] rounded-2xl border border-white/10 bg-[#0f172a]/95 shadow-2xl backdrop-blur transition-transform ${
        minimized ? 'scale-95 opacity-90' : 'scale-100 opacity-100'
      }`}
      style={{ height: 500 }}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-cyan-300 text-zinc-900 text-sm font-extrabold">
            CSKH
          </div>
          <div className="text-sm font-semibold text-zinc-100">CSKH</div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setMinimized((v) => !v)}
            className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-200 hover:bg-white/10"
          >
            {minimized ? t('chat_btn_open') : t('chat_btn_minimize')}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-200 hover:bg-white/10"
          >
            ×
          </button>
        </div>
      </div>

      <div className="grid h-[calc(500px-44px)] grid-rows-[1fr_auto]">
        <div ref={listRef} className="overflow-y-auto px-3 py-3 space-y-2">
          {messages.map((m, i) => (
            <ChatMessage key={i} role={m.role} text={m.text} />
          ))}
          {typing ? (
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-gradient-to-br from-sky-300 to-cyan-200 flex items-center justify-center text-[11px] font-bold text-zinc-900">
                CSKH
              </div>
              <div className="rounded-2xl border border-white/10 bg-zinc-800/70 px-3 py-2 text-sm text-zinc-300">
                <span className="inline-flex gap-1">
                  <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-zinc-300 [animation-delay:-0.2s]"></span>
                  <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-zinc-300 [animation-delay:-0.1s]"></span>
                  <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-zinc-300"></span>
                </span>
              </div>
            </div>
          ) : null}
        </div>
        <div className="border-t border-white/10 p-3">
          <ChatInput onSend={send} disabled={typing} />
        </div>
      </div>
    </div>
  );
};

export default ChatWidget;
