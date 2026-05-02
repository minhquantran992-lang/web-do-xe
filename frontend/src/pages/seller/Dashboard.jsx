import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../services/auth/AuthContext.jsx';
import { apiFetch } from '../../services/api/client.js';
import { useI18n } from '../../services/i18n.jsx';

const cx = (...arr) => arr.filter(Boolean).join(' ');

const StatCard = ({ title, value, tone = 'gray' }) => {
  const bar =
    tone === 'orange'
      ? 'bg-amber-400'
      : tone === 'green'
        ? 'bg-emerald-500'
        : tone === 'red'
          ? 'bg-red-500'
          : tone === 'blue'
            ? 'bg-sky-500'
            : 'bg-gray-300';
  return (
    <div className="rounded-3xl border border-zinc-800/70 bg-zinc-950/50 p-5 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-zinc-400">{title}</div>
          <div className="mt-2 text-2xl font-black text-zinc-50">{value}</div>
        </div>
        <div className="h-10 w-1.5 rounded-full bg-white/5">
          <div className={cx('h-7 w-1.5 rounded-full', bar)} />
        </div>
      </div>
    </div>
  );
};

const withinToday = (date) => {
  if (!date) return false;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return d >= start && d < end;
};

const Dashboard = () => {
  const { token } = useAuth();
  const { lang, t } = useI18n();
  const [stats, setStats] = useState({
    newRequestsCount: 0,
    todaysAppointments: 0,
    totalCompletedJobs: 0,
    averageRating: 0,
    capacity: { maxSlots: 0, mechanicCount: 0, activeBookingsToday: 0, availableSlotsToday: 0 }
  });
  const [weekItems, setWeekItems] = useState([]);
  const [alert, setAlert] = useState('');
  const prevNewCount = useRef(0);
  const locale = lang === 'en' ? 'en-US' : 'vi-VN';
  const HOUR_ROW_PX = 56;
  const MIN_PX = HOUR_ROW_PX / 60;

  const formatTime = (date) => {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return '--:--';
    return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(d);
  };

  const todayDateLabel = useMemo(() => {
    const now = new Date();
    return new Intl.DateTimeFormat(locale, { weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  }, [locale]);

  const weekCalendar = useMemo(() => {
    const startOfDay = (d) => {
      const x = new Date(d);
      x.setHours(0, 0, 0, 0);
      return x;
    };
    const addDays = (d, n) => {
      const x = new Date(d);
      x.setDate(x.getDate() + n);
      return x;
    };

    const weekStart = startOfDay(new Date());
    const weekEnd = addDays(weekStart, 7);
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const dayKey = (d) => startOfDay(d).getTime();
    const dayIndexByKey = new Map(days.map((d, i) => [dayKey(d), i]));

    const items = Array.isArray(weekItems) ? weekItems.slice() : [];
    const rawEvents = items
      .map((b) => {
        const start = b?.timeSlot ? new Date(b.timeSlot) : null;
        if (!start || Number.isNaN(start.getTime())) return null;
        if (start < weekStart || start >= weekEnd) return null;
        const end = new Date(start.getTime() + 60 * 60 * 1000);
        const idx = dayIndexByKey.get(dayKey(start));
        if (idx == null) return null;
        const startMin = start.getHours() * 60 + start.getMinutes();
        const endMin = end.getHours() * 60 + end.getMinutes();
        return { id: String(b?._id || ''), dayIndex: idx, start, end, startMin, endMin, raw: b };
      })
      .filter(Boolean)
      .sort((a, b) => (a.dayIndex !== b.dayIndex ? a.dayIndex - b.dayIndex : a.start.getTime() - b.start.getTime()));

    const groups = Array.from({ length: 7 }, () => []);
    for (const e of rawEvents) groups[e.dayIndex].push(e);

    let globalMin = null;
    let globalMax = null;
    const laidOutGroups = groups.map((list) => {
      const cols = [];
      const placed = list
        .slice()
        .sort((a, b) => a.startMin - b.startMin)
        .map((e) => {
          const startMin = e.startMin;
          const endMin = e.endMin;
          if (globalMin == null || startMin < globalMin) globalMin = startMin;
          if (globalMax == null || endMin > globalMax) globalMax = endMin;
          let col = 0;
          for (; col < cols.length; col += 1) {
            if (cols[col] <= startMin) break;
          }
          cols[col] = endMin;
          return { ...e, col };
        });
      const colCount = Math.max(1, cols.length);
      return placed.map((e) => ({ ...e, colCount }));
    });

    const fallbackMin = 9 * 60;
    const fallbackMax = 18 * 60;
    const minStart = globalMin == null ? fallbackMin : globalMin;
    const maxEnd = globalMax == null ? fallbackMax : globalMax;
    const minHour = Math.floor(minStart / 60);
    const maxHour = Math.ceil(maxEnd / 60);
    let startHour = Math.max(0, minHour - 1);
    let endHour = Math.min(24, Math.max(startHour + 8, maxHour + 1));
    if (endHour - startHour < 8) endHour = Math.min(24, startHour + 8);
    const hours = Array.from({ length: Math.max(1, endHour - startHour + 1) }, (_, i) => startHour + i);

    const labelFmt = new Intl.DateTimeFormat(locale, { weekday: 'short', day: '2-digit', month: '2-digit' });
    const dayLabels = days.map((d) => labelFmt.format(d));
    return { weekStart, weekEnd, days, dayLabels, hours, startHour, eventsByDay: laidOutGroups };
  }, [locale, weekItems]);

  useEffect(() => {
    let alive = true;
    const safeLoad = async () => {
      try {
        const s = await apiFetch('/api/vendor/stats', { token });
        if (!alive) return;
        const cap = s?.item?.capacity || null;
        const nextStats = {
          newRequestsCount: Number(s?.item?.newRequestsCount) || 0,
          todaysAppointments: Number(s?.item?.todaysAppointments) || 0,
          totalCompletedJobs: Number(s?.item?.totalCompletedJobs) || 0,
          averageRating: Number(s?.item?.averageRating) || 0,
          capacity: {
            maxSlots: Number(cap?.maxSlots) || 0,
            mechanicCount: Number(cap?.mechanicCount) || 0,
            activeBookingsToday: Number(cap?.activeBookingsToday) || 0,
            availableSlotsToday: Number(cap?.availableSlotsToday) || 0
          }
        };
        setStats(nextStats);
        if (prevNewCount.current && nextStats.newRequestsCount > prevNewCount.current) {
          setAlert(t('seller_toast_new_request'));
          window.setTimeout(() => setAlert(''), 4000);
        }
        prevNewCount.current = nextStats.newRequestsCount;

        const [accepted, inProgress] = await Promise.all([
          apiFetch('/api/vendor/bookings?status=accepted', { token }),
          apiFetch('/api/vendor/bookings?status=in_progress', { token })
        ]);
        if (!alive) return;
        const rowsA = Array.isArray(accepted?.items) ? accepted.items : [];
        const rowsB = Array.isArray(inProgress?.items) ? inProgress.items : [];
        const rows = [...rowsA, ...rowsB];
        const now = new Date();
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 7);
        setWeekItems(rows.filter((x) => x?.timeSlot && new Date(x.timeSlot) >= start && new Date(x.timeSlot) < end));
      } catch {
        if (!alive) return;
      }
    };
    safeLoad();
    const timerId = window.setInterval(safeLoad, 8000);
    return () => {
      alive = false;
      window.clearInterval(timerId);
    };
  }, [token, t]);

  return (
    <div className="space-y-4">
      {alert ? (
        <div className="rounded-3xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm font-semibold text-amber-100">
          {alert}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title={t('seller_dashboard_new_requests')} value={stats.newRequestsCount} tone="orange" />
        <StatCard title={t('seller_dashboard_today_appointments')} value={stats.todaysAppointments} tone="blue" />
        <StatCard title={t('seller_dashboard_completed_jobs')} value={stats.totalCompletedJobs} tone="green" />
        <StatCard title={t('seller_dashboard_average_rating')} value={stats.averageRating || '—'} tone="gray" />
      </div>

      <div className="rounded-3xl border border-zinc-800/70 bg-zinc-950/50 p-5 backdrop-blur-xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-bold text-zinc-50">Công suất hôm nay</div>
            <div className="mt-1 text-xs text-zinc-400">Slot còn trống = maxSlots - booking đang chạy</div>
          </div>
          {stats.capacity?.mechanicCount > 0 && stats.capacity?.maxSlots >= stats.capacity.mechanicCount * 5 ? (
            <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100">
              Cảnh báo: thợ ít so với số slot (không chặn đặt lịch).
            </div>
          ) : null}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="text-xs font-semibold text-zinc-400">Tổng số slot</div>
            <div className="mt-2 text-2xl font-black text-zinc-50">{Number(stats.capacity?.maxSlots) || 0}</div>
            <div className="mt-1 text-xs text-zinc-500">Số thợ: {Number(stats.capacity?.mechanicCount) || 0}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="text-xs font-semibold text-zinc-400">Booking đang chạy</div>
            <div className="mt-2 text-2xl font-black text-zinc-50">{Number(stats.capacity?.activeBookingsToday) || 0}</div>
            <div className="mt-1 text-xs text-zinc-500">Chờ / Đã nhận / Đang làm</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="text-xs font-semibold text-zinc-400">Slot còn trống</div>
            <div className="mt-2 text-2xl font-black text-zinc-50">{Number(stats.capacity?.availableSlotsToday) || 0}</div>
            <div className="mt-1 text-xs text-zinc-500">Hết slot sẽ tự chặn đặt lịch</div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-zinc-800/70 bg-zinc-950/50 backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="text-sm font-bold text-zinc-50">Lịch hẹn 7 ngày tới</div>
          <div className="text-xs font-semibold text-zinc-400">{todayDateLabel}</div>
        </div>
        <div className="px-5 py-5">
          {!weekItems.length ? <div className="mb-3 text-sm text-zinc-400">{t('seller_dashboard_today_empty')}</div> : null}
          <div className="overflow-x-auto">
            <div className="min-w-[980px] overflow-hidden rounded-3xl border border-white/10 bg-black/20">
              <div className="grid grid-cols-[76px_repeat(7,minmax(0,1fr))] border-b border-white/10 bg-black/10">
                <div className="px-3 py-3 text-[11px] font-semibold text-zinc-500">Giờ</div>
                {weekCalendar.dayLabels.map((label, i) => (
                  <div key={String(i)} className="px-3 py-3 text-[11px] font-semibold text-zinc-300">
                    {label}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-[76px_repeat(7,minmax(0,1fr))]">
                <div className="border-r border-white/10 bg-black/10">
                  <div className="h-3" />
                  {weekCalendar.hours.map((h) => (
                    <div key={h} className="flex h-[56px] items-start justify-end pr-3 pt-1 text-[11px] font-semibold text-zinc-500">
                      {String(h).padStart(2, '0')}:00
                    </div>
                  ))}
                  <div className="h-3" />
                </div>

                {weekCalendar.days.map((_, dayIdx) => (
                  <div key={String(dayIdx)} className={cx('relative', dayIdx !== 6 ? 'border-r border-white/10' : '')}>
                    <div className="pointer-events-none absolute inset-0">
                      <div className="h-3" />
                      {weekCalendar.hours.map((h) => (
                        <div key={h} className="h-[56px] border-b border-white/10" />
                      ))}
                      <div className="h-3" />
                    </div>

                    <div className="relative">
                      <div className="h-3" />
                      <div style={{ height: (weekCalendar.hours.length || 1) * HOUR_ROW_PX }} />
                      <div className="h-3" />

                      {(weekCalendar.eventsByDay?.[dayIdx] || []).map((e) => {
                        const topMin = e.startMin - weekCalendar.startHour * 60;
                        const durMin = Math.max(30, e.endMin - e.startMin);
                        const top = 12 + topMin * MIN_PX;
                        const height = Math.max(44, durMin * MIN_PX);
                        const gap = 8;
                        const wPct = 100 / e.colCount;
                        const left = `calc(${e.col * wPct}% + ${gap / 2}px)`;
                        const width = `calc(${wPct}% - ${gap}px)`;
                        const b = e.raw;
                        const customer = b?.user?.name || b?.user?.email || t('seller_requests_customer_fallback');
                        const status = String(b?.status || '').toLowerCase();
                        const tone =
                          status === 'in_progress'
                            ? 'border-amber-400/20 bg-amber-500/10 shadow-[0_14px_40px_-22px_rgba(251,191,36,0.45)]'
                            : 'border-sky-400/20 bg-sky-500/10 shadow-[0_14px_40px_-22px_rgba(56,189,248,0.55)]';
                        const badge = status === 'in_progress' ? t('seller_status_in_progress') : t('seller_status_accepted');
                        return (
                          <div key={e.id} className={cx('absolute rounded-2xl border px-3 py-2', tone)} style={{ top, left, width, height }}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="truncate text-xs font-black text-zinc-50">{formatTime(e.start)}</div>
                                <div className="mt-1 truncate text-[11px] font-semibold text-zinc-200">{customer}</div>
                              </div>
                              <div className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-zinc-200">
                                {badge}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
