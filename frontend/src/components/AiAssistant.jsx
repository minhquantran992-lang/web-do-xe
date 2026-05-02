import { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '../services/api/client.js';
import { useAuth } from '../services/auth/AuthContext.jsx';
import { useI18n } from '../services/i18n.jsx';
import ChatMessage from './chatbot/ChatMessage.jsx';
import ChatInput from './chatbot/ChatInput.jsx';

const STORAGE_CHAT = 'carbanana.ai.chat';
const STORAGE_OPEN = 'carbanana.ai.open';

const normalize = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

const getBlockedKey = (text) => {
  const s = normalize(text);
  if (!s) return null;

  const profanity = [
    /\b(fuck|shit|bitch|cunt|motherfucker)\b/i,
    /\b(dcm|dm)\b/i,
    /(địt|dit|đụ|du|lồn|cặc|cak|buồi|buoi)/i,
    /(chó\s*mày|cho\s*may)/i
  ];
  if (profanity.some((rx) => rx.test(s))) return 'AI_BLOCKED_PROFANITY';

  const sensitive = [
    /\b(porn|xxx|sex|nude)\b/i,
    /(hiếp dâm|hiep dam|\brape\b)/i,
    /(ấu dâm|au dam|pedo|pedophile|child\s*porn)/i,
    /(tự\s*tử|tu\s*tu|suicide|kill\s*(myself|yourself)|cắt\s*tay|cat\s*tay)/i,
    /(ma túy|ma tuy|cocaine|heroin|meth|mdma|\bweed\b|cần sa|can sa)/i
  ];
  if (sensitive.some((rx) => rx.test(s))) return 'AI_BLOCKED_SENSITIVE';

  return null;
};

const detectLangFromText = (text) => {
  const s = String(text || '').trim();
  if (!s) return 'en';
  if (/[\u0E00-\u0E7F]/.test(s)) return 'th';
  if (/[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/.test(s)) return 'ko';
  if (/[\u3040-\u30FF\u31F0-\u31FF]/.test(s)) return 'ja';
  if (/[\u4E00-\u9FFF]/.test(s)) return 'zh';
  if (/[ăâđêôơưáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i.test(s)) return 'vi';
  if (/\b(xin chao|cam on|cảm ơn|toi|tôi|ban|bạn|xe|do|độ|phuoc|phuộc|phanh|po|pô|lop|lốp)\b/i.test(s)) return 'vi';
  const low = s.toLowerCase();
  if (/\b(bonjour|merci|prix|garantie|commande|retour)\b/.test(low) || /[éèêëàâîïôùûç]/.test(low)) return 'fr';
  return 'en';
};

const parseBudgetVnd = (text) => {
  const s = normalize(text);
  const tr = s.match(/(\d+(?:[.,]\d+)?)\s*(tr|triệu|trieu)\b/);
  if (tr) {
    const v = Number(String(tr[1]).replace(',', '.'));
    if (Number.isFinite(v)) return Math.round(v * 1_000_000);
  }
  const rawDigits = s.match(/(\d[\d.,]{2,})/);
  if (rawDigits) {
    const digits = String(rawDigits[1]).replace(/[^\d]/g, '');
    const v = Number(digits);
    if (Number.isFinite(v)) return v;
  }
  return null;
};

const AiAssistant = ({ hidden }) => {
  const { token, user } = useAuth();
  const { lang, t } = useI18n();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [chatLang, setChatLang] = useState(lang);
  const listRef = useRef(null);
  const bottomRef = useRef(null);
  const prevLenRef = useRef(0);
  const [flow, setFlow] = useState({ intent: null, step: 0, vehicle: '', style: '', budgetVnd: null, lang: null });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_CHAT);
      if (raw) setMessages(JSON.parse(raw));
      const o = localStorage.getItem(STORAGE_OPEN);
      if (o === '1') setOpen(true);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_CHAT, JSON.stringify(messages));
    } catch {}
  }, [messages]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_OPEN, open ? '1' : '0');
    } catch {}
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!bottomRef.current) return;
    const behavior = messages.length !== prevLenRef.current ? 'smooth' : 'auto';
    prevLenRef.current = messages.length;
    bottomRef.current.scrollIntoView({ behavior, block: 'end' });
  }, [messages, loading, open]);

  const effectiveLang = useMemo(() => String(chatLang || lang || 'en').trim().toLowerCase(), [chatLang, lang]);
  const greetingFor = (l) => {
    const x = String(l || 'en').trim().toLowerCase();
    if (x === 'vi') return 'Mình có thể giúp gì cho bạn?';
    if (x === 'ja') return '何を手伝いましょうか？';
    if (x === 'ko') return '무엇을 도와드릴까요?';
    if (x === 'zh') return '我可以帮你什么？';
    if (x === 'fr') return 'Je peux vous aider sur quoi ?';
    if (x === 'th') return 'ให้ช่วยเรื่องอะไรดีครับ/ค่ะ?';
    return 'How can I help you?';
  };
  const greeting = useMemo(() => greetingFor(effectiveLang), [effectiveLang]);
  const badge = t('ai_badge');
  const badgeShort = useMemo(() => {
    const b = String(badge || '').trim();
    if (!b) return 'CS';
    if (b.length <= 2) return b.toUpperCase();
    if (b.toUpperCase() === 'CSKH') return 'CS';
    return b.slice(0, 2).toUpperCase();
  }, [badge]);
  const quickActions = useMemo(
    () =>
      effectiveLang === 'vi'
        ? [
            { key: 'build', label: 'Build xe' },
            { key: 'price', label: 'Xem giá & phụ kiện' },
            { key: 'guide', label: 'Hướng dẫn sử dụng' }
          ]
        : effectiveLang === 'ja'
          ? [
              { key: 'build', label: 'カスタム相談' },
              { key: 'price', label: '価格・保証' },
              { key: 'guide', label: '使い方' }
            ]
          : effectiveLang === 'ko'
            ? [
                { key: 'build', label: '커스텀 상담' },
                { key: 'price', label: '가격·보증' },
                { key: 'guide', label: '사용 방법' }
              ]
            : effectiveLang === 'zh'
              ? [
                  { key: 'build', label: '改装建议' },
                  { key: 'price', label: '价格与保修' },
                  { key: 'guide', label: '使用指南' }
                ]
              : effectiveLang === 'fr'
                ? [
                    { key: 'build', label: 'Conseils' },
                    { key: 'price', label: 'Prix & garantie' },
                    { key: 'guide', label: 'Utiliser le site' }
                  ]
                : effectiveLang === 'th'
                  ? [
                      { key: 'build', label: 'แนะนำแต่งรถ' },
                      { key: 'price', label: 'ราคาและประกัน' },
                      { key: 'guide', label: 'วิธีใช้งาน' }
                    ]
        : [
            { key: 'build', label: 'Build' },
            { key: 'price', label: 'Price & parts' },
            { key: 'guide', label: 'How to use' }
          ],
    [effectiveLang]
  );

  const suggestions = useMemo(
    () => ({
      brands: ['Honda', 'Yamaha', 'Suzuki', 'Kawasaki', 'Ducati', 'KTM', 'BMW', 'Vespa', 'Piaggio'],
      models: [
        'CBR150R',
        'Winner X',
        'Vario 160',
        'Air Blade 160',
        'Vision',
        'SH 160i',
        'Exciter 155',
        'R15',
        'MT-15',
        'Raider',
        'Satria',
        'Ninja 400',
        'Z900',
        'CB650R'
      ],
      purposes:
        effectiveLang === 'vi' ? ['đi tour', 'đi phố', 'track', 'kiểng', 'êm', 'bốc'] : ['touring', 'city', 'track', 'show', 'comfort', 'power']
    }),
    [effectiveLang]
  );

  const ensureGreeting = (langHint) => {
    const g = greetingFor(langHint || effectiveLang);
    setMessages((prev) => {
      if (prev?.length) return prev;
      return [{ role: 'assistant', content: g }];
    });
  };

  const textFor = (key, l) => {
    const x = String(l || 'en').trim().toLowerCase();
    const dict = {
      askStyle: {
        vi: 'Bạn muốn độ theo kiểu nào (đi tour / đi phố / track / kiểng)?',
        en: 'What style (touring / city / track / show)?',
        ja: 'どんなスタイル？(ツーリング / 街乗り / サーキット / 見た目)',
        ko: '원하는 스타일은? (투어링 / 시내 / 트랙 / 드레스업)',
        zh: '想要什么风格？(旅行 / 通勤 / 赛道 / 外观)',
        fr: 'Quel style ? (touring / ville / piste / look)',
        th: 'อยากแต่งแนวไหน? (ทัวร์ริ่ง / เมือง / แทร็ค / โชว์)'
      },
      askBudget: {
        vi: 'Ngân sách khoảng bao nhiêu?',
        en: 'What’s your budget?',
        ja: '予算はいくらですか？',
        ko: '예산은 어느 정도인가요?',
        zh: '预算大概多少？',
        fr: 'Quel est votre budget ?',
        th: 'งบประมาณประมาณเท่าไหร่ครับ/ค่ะ?'
      },
      askPrice: {
        vi: 'Bạn muốn xem giá cho xe gì và món nào?',
        en: 'Which bike and which part are you pricing?',
        ja: 'どの車種で、どのパーツの価格ですか？',
        ko: '어떤 바이크와 어떤 부품 가격을 보고 싶으신가요?',
        zh: '你想查哪个车型、哪个配件的价格？',
        fr: 'Pour quel modèle et quelle pièce voulez-vous le prix ?',
        th: 'ต้องการดูราคาของรถรุ่นไหนและชิ้นส่วนอะไรครับ/ค่ะ?'
      },
      askGuide: {
        vi: 'Bạn muốn hướng dẫn mục nào: custom 3D, lưu bản độ, marketplace hay đăng nhập?',
        en: 'Which feature: 3D customizer, save build, marketplace, or login?',
        ja: 'どの機能の案内が必要ですか？(3Dカスタム / 保存 / マーケット / ログイン)',
        ko: '어떤 기능 안내가 필요하세요? (3D 커스터마이저 / 저장 / 마켓 / 로그인)',
        zh: '你需要哪个功能的指引？(3D定制 / 保存方案 / 市集 / 登录)',
        fr: 'De quelle fonctionnalité avez-vous besoin ? (3D / sauvegarde / marketplace / connexion)',
        th: 'อยากให้ช่วยแนะนำส่วนไหน? (แต่ง 3D / บันทึก / marketplace / ล็อกอิน)'
      }
    };
    const table = dict[key] || {};
    return table[x] || table.en || '';
  };

  useEffect(() => {
    if (!open) return;
    ensureGreeting();
  }, [open, greeting]);

  const addAssistantStreaming = (text) => {
    const full = String(text || '');
    const id = `${Date.now()}-${Math.random()}`;
    setMessages((prev) => [...prev, { role: 'assistant', content: '', _streamId: id }]);
    const words = full.split(/(\s+)/);
    let i = 0;
    const tick = () => {
      i += 1;
      setMessages((prev) => {
        const next = [...prev];
        const idx = next.findIndex((m) => m?._streamId === id);
        if (idx === -1) return prev;
        const cur = String(next[idx].content || '');
        next[idx] = { ...next[idx], content: `${cur}${words[i - 1] || ''}` };
        return next;
      });
      if (i < words.length) {
        setTimeout(tick, 18);
      } else {
        setMessages((prev) => prev.map((m) => (m?._streamId === id ? { role: 'assistant', content: full } : m)));
      }
    };
    setTimeout(tick, 60);
  };

  const send = async (text) => {
    const content = String(text || '').trim();
    if (!content || loading) return;
    const blockedKey = getBlockedKey(content);
    if (blockedKey) {
      setError(blockedKey);
      return;
    }

    setError('');
    const msgLang = detectLangFromText(content);
    setChatLang(msgLang);
    ensureGreeting(msgLang);
    setMessages((prev) => [...prev, { role: 'user', content }]);

    if (flow.intent === 'build') {
      if (flow.step === 1) {
        setFlow((p) => ({ ...p, step: 2, vehicle: content }));
        addAssistantStreaming(textFor('askStyle', flow.lang || msgLang));
        return;
      }
      if (flow.step === 2) {
        setFlow((p) => ({ ...p, step: 3, style: content }));
        addAssistantStreaming(textFor('askBudget', flow.lang || msgLang));
        return;
      }
      if (flow.step === 3) {
        const budgetVnd = parseBudgetVnd(content);
        const payload = {
          vehicle: flow.vehicle,
          style: flow.style,
          budgetVnd
        };
        setFlow({ intent: null, step: 0, vehicle: '', style: '', budgetVnd: null, lang: null });
        setLoading(true);
        try {
          const ctx = {
            userName: String(user?.name || '').trim() || undefined,
            page: typeof window === 'undefined' ? undefined : window.location?.pathname,
            budgetVnd: budgetVnd ?? undefined,
            model: payload.vehicle || undefined,
            style: payload.style || undefined
          };
          const prompt =
            flow.lang === 'vi'
              ? `Build xe: ${payload.vehicle}. Mục tiêu: ${payload.style}. Ngân sách: ${budgetVnd ? `${budgetVnd.toLocaleString('vi-VN')}đ` : content}.`
              : `Build: ${payload.vehicle}. Goal: ${payload.style}. Budget: ${budgetVnd ? `${budgetVnd} VND` : content}.`;
          const data = await apiFetch('/api/ai/chat', {
            method: 'POST',
            token,
            body: { lang: msgLang, mode: 'auto', messages: [...messages, { role: 'user', content }, { role: 'user', content: prompt }], context: ctx }
          });
          addAssistantStreaming(String(data?.reply || ''));
        } catch (e) {
          setError(e?.message || 'REQUEST_FAILED');
        } finally {
          setLoading(false);
        }
        return;
      }
    }

    if (flow.intent === 'price' || flow.intent === 'guide') {
      setFlow({ intent: null, step: 0, vehicle: '', style: '', budgetVnd: null, lang: null });
    }

    setLoading(true);
    try {
      const ctx = {
        userName: String(user?.name || '').trim() || undefined,
        page: typeof window === 'undefined' ? undefined : window.location?.pathname
      };
      const data = await apiFetch('/api/ai/chat', {
        method: 'POST',
        token,
        body: { lang: msgLang, mode: 'auto', messages: [...messages, { role: 'user', content }], context: ctx }
      });
      addAssistantStreaming(String(data?.reply || ''));
    } catch (e) {
      setError(e?.message || 'REQUEST_FAILED');
    } finally {
      setLoading(false);
    }
  };

  if (hidden) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={badge}
        className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full border border-white/10 bg-zinc-950/80 px-4 py-3 text-sm font-black text-zinc-100 shadow-[0_20px_70px_-46px_rgba(56,189,248,0.55)] backdrop-blur transition hover:border-sky-400/25 hover:bg-zinc-950/90 hover:shadow-[0_0_34px_rgba(14,165,233,0.32)]"
        style={{ display: open ? 'none' : 'inline-flex' }}
      >
        <span className="relative inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-gradient-to-br from-sky-400 to-cyan-300 text-[11px] font-black text-zinc-950">
          <span className="pointer-events-none absolute -inset-4 bg-[radial-gradient(26px_26px_at_30%_30%,rgba(255,255,255,0.45),transparent_65%)]" />
          <span className="relative">{badgeShort}</span>
        </span>
        <span className="relative">{badge}</span>
        <span className="ml-1 h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.55)]" />
      </button>

      {open ? (
        <div className="fixed bottom-6 right-6 z-40 w-[380px] max-w-[calc(100vw-24px)] overflow-hidden rounded-3xl border border-white/10 bg-[#0b1220]/82 shadow-2xl backdrop-blur">
          <div className="pointer-events-none absolute inset-0 opacity-90">
            <div className="absolute -left-28 -top-28 h-64 w-64 rounded-full bg-sky-500/10 blur-[70px]" />
            <div className="absolute -right-24 top-10 h-64 w-64 rounded-full bg-cyan-500/10 blur-[80px]" />
          </div>

          <div className="relative flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="relative inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-sky-400 to-cyan-300 text-[11px] font-black text-zinc-950">
                  <span className="pointer-events-none absolute -inset-4 bg-[radial-gradient(26px_26px_at_30%_30%,rgba(255,255,255,0.45),transparent_65%)]" />
                  <span className="relative">{badgeShort}</span>
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-black text-zinc-100">{t('ai_title')}</div>
                  <div className="mt-0.5 truncate text-[11px] text-zinc-400">{t('ai_desc')}</div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setMessages([{ role: 'assistant', content: greeting }]);
                  setFlow({ intent: null, step: 0, vehicle: '', style: '', budgetVnd: null, lang: null });
                  setError('');
                  try {
                    localStorage.setItem(STORAGE_CHAT, JSON.stringify([{ role: 'assistant', content: greeting }]));
                  } catch {}
                }}
                className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-200 hover:bg-white/10"
              >
                {t('ai_clear_chat')}
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

          <div className="relative grid max-h-[70vh] grid-rows-[1fr_auto]">
            <div ref={listRef} className="h-[360px] overflow-y-auto px-4 py-4 space-y-2">
              {messages.map((m, idx) => (
                <ChatMessage key={`${m.role}-${idx}`} role={m.role === 'assistant' ? 'ai' : 'user'} text={m.content} />
              ))}
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-gradient-to-br from-sky-300 to-cyan-200 flex items-center justify-center text-[11px] font-black text-zinc-900">
                    {badgeShort}
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
              <div ref={bottomRef} />
            </div>

            <div className="border-t border-white/10 p-4">
              <div className="mb-3 flex items-center gap-2 overflow-x-auto">
                {quickActions.map((q) => (
                  <button
                    key={q.key}
                    type="button"
                    onClick={() => {
                      ensureGreeting();
                      if (q.key === 'build') {
                        setFlow({ intent: 'build', step: 1, vehicle: '', style: '', budgetVnd: null, lang: effectiveLang });
                        addAssistantStreaming(lang === 'vi' ? 'Bạn đang dùng xe gì?' : 'What bike are you riding?');
                        return;
                      }
                      if (q.key === 'price') {
                        setFlow({ intent: 'price', step: 1, vehicle: '', style: '', budgetVnd: null, lang: effectiveLang });
                        addAssistantStreaming(lang === 'vi' ? 'Bạn muốn xem giá cho xe gì và món nào?' : 'Which bike and which part are you pricing?');
                        return;
                      }
                      if (q.key === 'guide') {
                        setFlow({ intent: 'guide', step: 1, vehicle: '', style: '', budgetVnd: null, lang: effectiveLang });
                        addAssistantStreaming(
                          lang === 'vi'
                            ? 'Bạn muốn hướng dẫn mục nào: custom 3D, lưu bản độ, marketplace hay đăng nhập?'
                            : 'Which feature: 3D customizer, save build, marketplace, or login?'
                        );
                      }
                    }}
                    disabled={loading}
                    className="whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-zinc-200 transition hover:border-sky-400/20 hover:bg-white/10 disabled:opacity-60"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
              {error ? (
                <div className="mb-2 rounded-xl border border-red-900/40 bg-red-950/30 p-2 text-xs text-red-200">{t(error)}</div>
              ) : null}
              <ChatInput
                onSend={send}
                disabled={loading}
                placeholder={effectiveLang === 'vi' ? 'Nhập câu hỏi của bạn…' : 'Type your question…'}
                suggestions={suggestions}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default AiAssistant;
