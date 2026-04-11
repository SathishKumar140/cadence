'use client';

import { Calendar, Clock, CheckCircle2, Loader2, MapPin, Zap, Trash2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { convertTimeRange } from './TimeUtils';

interface WeeklyPlanItem {
  id: string; // Now required for targeted updates
  title: string;
  day: string;
  time: string;
  reason: string;
  is_discovery?: boolean;
  is_synced?: boolean;
  location?: string;
  discovery_source?: string;
}

interface ScheduleListProps {
  plan: WeeklyPlanItem[];
  accessToken: string;
  userId: string;
  calendarTimezone: string;
}

export default function ScheduleList({ plan, accessToken, userId, calendarTimezone }: ScheduleListProps) {
  // Initialize synced events from server-provided state
  const [syncedEvents, setSyncedEvents] = useState<string[]>(() => 
    plan.filter(item => item.is_synced).map(item => item.id)
  );
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [rethinkingId, setRethinkingId] = useState<string | null>(null);
  const localTz = typeof window !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC';

  // Group events by day
  const groupedPlan = plan.reduce((acc, item) => {
    if (!acc[item.day]) acc[item.day] = [];
    acc[item.day].push(item);
    return acc;
  }, {} as Record<string, WeeklyPlanItem[]>);

  const addEventToCalendar = async (item: WeeklyPlanItem) => {
    setSyncingId(item.id);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
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
        if (res.ok) {
            setSyncedEvents([...syncedEvents, item.id]);
        } else {
            const err = await res.json();
            alert(`Failed to sync: ${err.detail || 'Unknown error'}`);
        }
    } catch (e) {
        console.error("Sync error:", e);
    } finally {
        setSyncingId(null);
    }
  };

  const unsyncEvent = async (item: WeeklyPlanItem) => {
    if (!confirm(`Are you sure you want to remove "${item.title}" from your calendar?`)) return;
    
    setSyncingId(item.id);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    try {
        const res = await fetch(`${apiUrl}/api/calendar/event?user_id=${userId}&item_id=${item.id}&access_token=${accessToken}`, {
            method: 'DELETE'
        });
        if (res.ok) {
            setSyncedEvents(syncedEvents.filter(id => id !== item.id));
        } else {
            const err = await res.json();
            alert(`Failed to unsync: ${err.detail || 'Unknown error'}`);
        }
    } catch (e) {
        console.error("Unsync error:", e);
    } finally {
        setSyncingId(null);
    }
  };

  const suggestAlternate = async (item: WeeklyPlanItem) => {
    setRethinkingId(item.id);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    try {
        // REMOVED Global Dispatch to stay inline
        
        const res = await fetch(`${apiUrl}/api/dashboard/items/alternate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                item_id: item.id,
                access_token: accessToken,
                title: item.title,
                day: item.day,
                time: item.time
            })
        });
        
        if (res.ok) {
            window.location.reload();
        }
    } catch (e) {
        console.error("Rethink error:", e);
    } finally {
        setRethinkingId(null);
    }
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
    <div className="space-y-8 pb-12">
      {Object.entries(groupedPlan).map(([day, items]) => (
        <div key={day} className="space-y-4">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] pl-1 border-l-2 border-indigo-500/50 ml-1">
            {day}
          </h3>
          <div className="grid grid-cols-1 gap-4">
            {items.map((item, idx) => {
              const isSynced = syncedEvents.includes(item.id);
              const isSyncing = syncingId === item.id;
              const isRethinking = rethinkingId === item.id;

              return (
                <div 
                  key={idx} 
                  className={`group relative bg-[var(--card-bg)] backdrop-blur-md border border-[var(--card-border)] p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] hover:bg-[var(--card-hover-bg)] transition-all duration-500 hover:shadow-2xl hover:shadow-indigo-500/5 ${item.is_discovery ? 'ring-1 ring-amber-500/20' : ''}`}
                >
                  {isRethinking && (
                    <div className="absolute inset-0 z-20 bg-[var(--card-bg)]/80 backdrop-blur-sm rounded-[2rem] flex items-center justify-center overflow-hidden">
                       <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-500/10 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                       <div className="flex flex-col items-center gap-3">
                         <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center animate-pulse shadow-lg shadow-indigo-500/30">
                            <Sparkles className="w-5 h-5 text-white" />
                         </div>
                         <span className="text-xs font-bold text-indigo-500 tracking-tighter animate-pulse">RETHINKING...</span>
                       </div>
                    </div>
                  )}

                  <div className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-6 ${isRethinking ? 'blur-sm opacity-50' : ''}`}>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h4 className={`text-lg font-semibold tracking-tight ${isSynced ? 'text-[var(--muted-text)] line-through opacity-50' : 'text-[var(--header-text)]'}`}>
                          {item.title}
                        </h4>
                        {item.is_discovery && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[9px] sm:text-[10px] font-bold flex items-center gap-1 border border-amber-500/30">
                            <Zap className="w-2.5 h-2.5" />
                            AI DISCOVERY
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-[10px] sm:text-[11px] text-[var(--muted-text)] font-medium">
                          <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg">
                            <Clock className="w-3.5 h-3.5" />
                            {convertTimeRange(item.time, calendarTimezone, localTz)}
                          </span>
                          {item.location && (
                            <span className="flex items-center gap-1.5 text-[var(--muted-text)] opacity-80">
                                <MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400 dark:text-slate-600" />
                                {item.location}
                            </span>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-[var(--muted-text)] mt-1 italic font-light leading-relaxed line-clamp-2 md:line-clamp-none">&quot;{item.reason}&quot;</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 sm:gap-3 w-full md:w-auto mt-4 md:mt-0">
                      <button 
                        onClick={() => isSynced ? unsyncEvent(item) : suggestAlternate(item)}
                        disabled={isSyncing || isRethinking}
                        className={`p-2 sm:p-2.5 rounded-xl sm:rounded-2xl transition-all duration-300 border ${
                          isSynced 
                            ? 'text-rose-500 border-rose-500/10 hover:bg-rose-500/10 bg-rose-500/5' 
                            : 'text-indigo-400 border-[var(--card-border)] hover:bg-indigo-500/10'
                        }`}
                        title={isSynced ? "Unsync from Calendar" : "Ask for Alternate"}
                      >
                        {isSynced ? <Trash2 className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                      </button>

                      <button 
                        onClick={() => !isSynced && addEventToCalendar(item)}
                        disabled={isSynced || isSyncing || isRethinking}
                        className={`flex-1 md:flex-none flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-bold transition-all duration-300 md:min-w-[160px] justify-center ${
                          isSynced 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-default' 
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-500/20 active:scale-95 border border-indigo-400/20'
                        }`}
                      >
                        {isSyncing ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : isSynced ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          <Calendar className="w-3.5 h-3.5" />
                        )}
                        {isSyncing ? "Syncing" : isSynced ? "Synced" : "Sync to Calendar"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
