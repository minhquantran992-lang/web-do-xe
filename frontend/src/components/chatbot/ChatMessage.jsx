import React from 'react';

const fmtTime = (value) => {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(d);
  } catch {
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }
};

const ChatMessage = ({ role, text, createdAt, avatarText }) => {
  const isUser = role === 'user';
  const time = fmtTime(createdAt);
  const badge = String(avatarText || 'CS')
    .trim()
    .slice(0, 4)
    .toUpperCase();
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} items-end gap-2`}>
      {!isUser ? (
        <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full border border-white/10 bg-gradient-to-br from-sky-300 to-cyan-200 flex items-center justify-center text-[11px] font-black text-zinc-900 shadow-[0_14px_40px_-30px_rgba(56,189,248,0.9)]">
          <span className="pointer-events-none absolute -inset-4 bg-[radial-gradient(22px_22px_at_30%_30%,rgba(255,255,255,0.45),transparent_65%)]" />
          <span className="relative">{badge || 'CS'}</span>
        </div>
      ) : null}
      <div className={`${isUser ? 'text-right' : 'text-left'} max-w-[78%]`}>
        <div
          className={
            isUser
              ? 'rounded-2xl bg-gradient-to-br from-sky-400 to-cyan-300 px-4 py-2 text-sm font-semibold text-zinc-950 shadow'
              : 'rounded-2xl border border-white/10 bg-zinc-800/70 px-4 py-2 text-sm text-zinc-100 shadow-[0_22px_70px_-54px_rgba(0,0,0,0.9)]'
          }
        >
          <div className="whitespace-pre-wrap leading-relaxed">{text}</div>
        </div>
        {time ? (
          <div className={`mt-1 text-[11px] font-semibold ${isUser ? 'text-zinc-400' : 'text-zinc-500'}`}>{time}</div>
        ) : null}
      </div>
    </div>
  );
};

export default ChatMessage;
