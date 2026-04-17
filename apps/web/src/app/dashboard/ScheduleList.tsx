'use client';

import { Calendar, Clock, CheckCircle2, Loader2, MapPin, Zap, Trash2, Sparkles } from 'lucide-react';
import { useState, useMemo } from 'react';
import { resolveItemDate, getDiffDays, convertTimeRange } from './TimeUtils';
import { WeeklyPlanItem, useDashboard } from './DashboardContext';

interface ScheduleListProps {
  accessToken: string;
  userId: string;
  calendarTimezone: string;
}

export default function ScheduleList({ accessToken, userId, calendarTimezone }: ScheduleListProps) {
  const { plan } = useDashboard();
  const [syncedEvents, setSyncedEvents] = useState<string[]>(() => 
    plan.filter((item) => item.is_synced).map((item) => item.id)
  );
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [rethinkingId, setRethinkingId] = useState<string | null>(null);
  const localTz = typeof window !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC';

  const processedPlan = useMemo(() => {
    return plan
      .map(item => ({ ...item, resolvedDate: resolveItemDate(item) }))
      .filter(item => {
        const diff = getDiffDays(item.resolvedDate);
        return diff >= 0 && diff < 7;
      })
      .sort((a, b) => {
        const dateComp = (a.resolvedDate || '').localeCompare(b.resolvedDate || '');
        if (dateComp !== 0) return dateComp;
        return (a.time || '').split('-')[0].localeCompare((b.time || '').split('-')[0]);
      });
  }, [plan]);

  const groupedPlan = useMemo(() => {
    const groups: Record<string, WeeklyPlanItem[]> = {};
    processedPlan.forEach(item => {
      const dateKey = item.resolvedDate || 'TBA';
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(item);
    });
    return groups;
  }, [processedPlan]);

  const sortedDates = useMemo(() => Object.keys(groupedPlan).sort(), [groupedPlan]);

  const addEventToCalendar = async (item: WeeklyPlanItem) => {
    setSyncingId(item.id);
    let apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    if (apiUrl && !apiUrl.startsWith('http')) apiUrl = `https://${apiUrl}`;
    try {
        const res = await fetch(`${apiUrl}/api/calendar/add-event`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                item_id: item.id,
                access_token: accessToken,
                title: item.title,
                day: item.day,
                time: item.time,
                description: item.reason
            })
        });
        if (res.ok) setSyncedEvents([...syncedEvents, item.id]);
    } catch (e) { console.error("Sync error:", e); }
    finally { setSyncingId(null); }
  };

  const unsyncEvent = async (item: WeeklyPlanItem) => {
    if (!confirm(`Remove "${item.title}" from calendar?`)) return;
    setSyncingId(item.id);
    let apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    if (apiUrl && !apiUrl.startsWith('http')) apiUrl = `https://${apiUrl}`;
    try {
        const res = await fetch(`${apiUrl}/api/calendar/event?user_id=${userId}&item_id=${item.id}&access_token=${accessToken}`, {
            method: 'DELETE'
        });
        if (res.ok) setSyncedEvents(syncedEvents.filter(id => id !== item.id));
    } catch (e) { console.error("Unsync error:", e); }
    finally { setSyncingId(null); }
  };

  const suggestAlternate = async (item: WeeklyPlanItem) => {
    setRethinkingId(item.id);
    let apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    if (apiUrl && !apiUrl.startsWith('http')) apiUrl = `https://${apiUrl}`;
    try {
        const res = await fetch(`${apiUrl}/api/dashboard/items/alternate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, item_id: item.id, access_token: accessToken })
        });
        if (res.ok) window.location.reload();
    } catch (e) { console.error("Rethink error:", e); }
    finally { setRethinkingId(null); }
  };

  if (plan.length === 0) {
    return (
      <div className="p-12 text-center bg-[var(--card-bg)] backdrop-blur-xl border border-[var(--card-border)] rounded-3xl">
        <p className="text-[var(--muted-text)] mb-2 font-medium italic">Cadence is still listening to your patterns...</p>
        <p className="text-xs text-[var(--muted-text)] opacity-60">Sync your calendar or set goals to begin discovery.</p>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-16">
      {sortedDates.map((dateKey) => {
        const items = groupedPlan[dateKey];
        const dateObj = new Date(dateKey);
        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
        const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        return (
          <div key={dateKey} className="relative">
            <div className="flex items-center gap-4 mb-8 group/header">
              <div className="flex items-center gap-3 bg-indigo-500/5 px-4 py-1.5 rounded-full border border-indigo-500/10 transition-all group-hover/header:bg-indigo-500/10">
                <h3 className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em]">{dayName}</h3>
                <span className="w-1 h-1 rounded-full bg-indigo-500/20" />
                <span className="text-[10px] font-black text-[var(--header-text)] opacity-40 uppercase tracking-widest">{dateStr}</span>
              </div>
              <div className="h-[1px] flex-1 bg-gradient-to-r from-indigo-500/20 to-transparent" />
            </div>

            <div className="relative pl-8 space-y-6">
              <div className="absolute left-[11px] top-0 bottom-0 w-[2px] bg-gradient-to-b from-indigo-500/30 via-indigo-500/10 to-transparent rounded-full" />
              {items.map((item) => {
                const isSynced = syncedEvents.includes(item.id);
                const isSyncing = syncingId === item.id;
                const isRethinking = rethinkingId === item.id;
                return (
                  <div key={item.id} className="group relative">
                    <div className={`absolute -left-[33px] top-6 w-6 h-6 rounded-full border-4 border-[var(--background)] z-10 transition-all duration-500 flex items-center justify-center ${
                      isSynced ? 'bg-emerald-500 scale-90' : 'bg-indigo-500 group-hover:scale-110 shadow-lg shadow-indigo-500/20'
                    }`}>
                      {isSynced ? <CheckCircle2 className="w-2.5 h-2.5 text-white" /> : <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>

                    <div className={`relative bg-[var(--card-bg)] backdrop-blur-xl border border-[var(--card-border)] p-5 rounded-2xl sm:rounded-3xl hover:bg-[var(--card-hover-bg)] transition-all duration-500 ${isRethinking ? 'overflow-hidden' : ''}`}>
                      {isRethinking && (
                        <div className="absolute inset-0 z-20 bg-[var(--card-bg)]/80 backdrop-blur-md flex items-center justify-center">
                           <div className="flex items-center gap-3">
                             <Sparkles className="w-4 h-4 text-indigo-500 animate-spin" />
                             <span className="text-[10px] font-black text-indigo-500 tracking-widest uppercase">Rethinking...</span>
                           </div>
                        </div>
                      )}

                      <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isRethinking ? 'blur-sm opacity-50' : ''}`}>
                        <div className="flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className={`text-base font-black tracking-tight ${isSynced ? 'text-[var(--muted-text)] opacity-40 line-through' : 'text-[var(--header-text)]'}`}>{item.title}</h4>
                            {item.is_discovery && (
                              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                                 <Zap className="w-2.5 h-2.5 text-amber-500" />
                                 <span className="text-[8px] font-black text-amber-500 uppercase tracking-tighter">AI Discovery</span>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-4">
                             <div className="flex items-center gap-2 text-[10px] font-black text-indigo-500/60 uppercase tracking-wide">
                                <Clock className="w-3 h-3" />
                                {convertTimeRange(item.time, calendarTimezone, localTz)}
                             </div>
                             {item.location && <div className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--muted-text)] opacity-50"><MapPin className="w-2.5 h-2.5" />{item.location}</div>}
                          </div>
                          <p className={`text-[11px] leading-relaxed italic ${isSynced ? 'opacity-30' : 'text-[var(--muted-text)] opacity-60'}`}>&ldquo;{item.reason}&rdquo;</p>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <button onClick={() => isSynced ? unsyncEvent(item) : suggestAlternate(item)} disabled={isSyncing || isRethinking} className={`p-2.5 rounded-xl border transition-all duration-300 ${isSynced ? 'text-rose-500 border-rose-500/10 hover:bg-rose-500/10 bg-rose-500/5' : 'text-slate-400 border-[var(--card-border)] hover:bg-indigo-500/10 hover:text-indigo-500'}`}>
                            {isSynced ? <Trash2 className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => !isSynced && addEventToCalendar(item)} disabled={isSynced || isSyncing || isRethinking} className={`p-2.5 rounded-xl transition-all duration-500 border ${isSynced ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-400/20 shadow-lg shadow-indigo-500/20 active:scale-90'}`}>
                            {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
