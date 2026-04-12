'use client';

import { Calendar, Clock, CheckCircle2, Loader2, MapPin, Zap, Trash2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { convertTimeRange } from './TimeUtils';
import { WeeklyPlanItem, useDashboard } from './DashboardContext';

interface ScheduleListProps {
  accessToken: string;
  userId: string;
  calendarTimezone: string;
}

export default function ScheduleList({ accessToken, userId, calendarTimezone }: ScheduleListProps) {
  const { plan } = useDashboard();
  // Initialize synced events from server-provided state
  const [syncedEvents, setSyncedEvents] = useState<string[]>(() => 
    plan.filter((item) => item.is_synced).map((item) => item.id)
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
    let apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    if (apiUrl && !apiUrl.startsWith('http')) {
        apiUrl = `https://${apiUrl}`;
    }
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
    let apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    if (apiUrl && !apiUrl.startsWith('http')) {
        apiUrl = `https://${apiUrl}`;
    }
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
    let apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    if (apiUrl && !apiUrl.startsWith('http')) {
        apiUrl = `https://${apiUrl}`;
    }
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
    <div className="space-y-12 pb-16">
      {Object.entries(groupedPlan).map(([day, items]) => (
        <div key={day} className="relative">
          {/* Day Hub Header */}
          <div className="flex items-center gap-4 mb-8">
            <h3 className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em] bg-indigo-500/5 px-3 py-1 rounded-full border border-indigo-500/10">
              {day}
            </h3>
            <div className="h-[1px] flex-1 bg-gradient-to-r from-indigo-500/20 to-transparent" />
          </div>

          <div className="relative pl-8 space-y-6">
            {/* The Neural Rail - continuous vertical line */}
            <div className="absolute left-[11px] top-0 bottom-0 w-[2px] bg-gradient-to-b from-indigo-500/30 via-indigo-500/10 to-transparent rounded-full" />

            {items.map((item, idx) => {
              const isSynced = syncedEvents.includes(item.id);
              const isSyncing = syncingId === item.id;
              const isRethinking = rethinkingId === item.id;

              return (
                <div 
                  key={idx} 
                  className="group relative"
                >
                  {/* Timeline Node Sparkle */}
                  <div className={`absolute -left-[33px] top-6 w-6 h-6 rounded-full border-4 border-[var(--background)] z-10 transition-all duration-500 flex items-center justify-center ${
                    isSynced ? 'bg-emerald-500 scale-90' : 'bg-indigo-500 group-hover:scale-110 shadow-lg shadow-indigo-500/20'
                  }`}>
                    {isSynced ? <CheckCircle2 className="w-2.5 h-2.5 text-white" /> : <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>

                  <div className={`relative bg-[var(--card-bg)] backdrop-blur-xl border border-[var(--card-border)] p-5 rounded-2xl sm:rounded-3xl hover:bg-[var(--card-hover-bg)] transition-all duration-500 ${
                    item.is_discovery ? 'ring-1 ring-amber-500/10' : ''
                  } ${isRethinking ? 'overflow-hidden' : ''}`}>
                    
                    {isRethinking && (
                      <div className="absolute inset-0 z-20 bg-[var(--card-bg)]/80 backdrop-blur-md flex items-center justify-center">
                         <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-500/10 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                         <div className="flex items-center gap-3">
                           <Sparkles className="w-4 h-4 text-indigo-500 animate-spin" />
                           <span className="text-[10px] font-black text-indigo-500 tracking-widest uppercase">Rethinking Slot...</span>
                         </div>
                      </div>
                    )}

                    <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isRethinking ? 'blur-sm opacity-50' : ''}`}>
                      <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className={`text-base font-black tracking-tight ${isSynced ? 'text-[var(--muted-text)] opacity-40 line-through' : 'text-[var(--header-text)]'}`}>
                            {item.title}
                          </h4>
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
                           {item.location && (
                             <div className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--muted-text)] opacity-50">
                                <MapPin className="w-2.5 h-2.5" />
                                {item.location}
                             </div>
                           )}
                        </div>
                        
                        <p className={`text-[11px] leading-relaxed italic ${isSynced ? 'opacity-30' : 'text-[var(--muted-text)] opacity-60'}`}>
                          &ldquo;{item.reason}&rdquo;
                        </p>
                      </div>

                      {/* Unified Action Dock */}
                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <button 
                          onClick={() => isSynced ? unsyncEvent(item) : suggestAlternate(item)}
                          disabled={isSyncing || isRethinking}
                          className={`p-2.5 rounded-xl border transition-all duration-300 ${
                            isSynced 
                              ? 'text-rose-500 border-rose-500/10 hover:bg-rose-500/10 bg-rose-500/5' 
                              : 'text-slate-400 border-[var(--card-border)] hover:bg-indigo-500/10 hover:text-indigo-500'
                          }`}
                        >
                          {isSynced ? <Trash2 className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                        </button>

                        <button 
                          onClick={() => !isSynced && addEventToCalendar(item)}
                          disabled={isSynced || isSyncing || isRethinking}
                          className={`p-2.5 rounded-xl transition-all duration-500 border ${
                            isSynced 
                              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                              : 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-400/20 shadow-lg shadow-indigo-500/20 active:scale-90'
                          }`}
                          title={isSynced ? "Synced" : "Sync to Calendar"}
                        >
                          {isSyncing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Calendar className="w-4 h-4" />
                          )}
                        </button>
                      </div>
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
