'use client';

import React, { useState, useMemo } from 'react';
import { 
  Calendar,
  Clock, 
  MapPin, 
  CheckCircle2, 
  Zap, 
  Sparkles,
  ArrowLeft,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { WeeklyPlanItem, useDashboard } from '../DashboardContext';

export default function TacticalTimelineView({ data: viewData }: { data?: Record<string, any> }) {
  const { plan, setActiveView } = useDashboard();
  const [selectedWeek, setSelectedWeek] = useState(0); // 0 = Current, 1 = Next, etc.

  React.useEffect(() => {
    if (viewData?.selected_week_index !== undefined) {
      setSelectedWeek(viewData.selected_week_index);
    }
  }, [viewData]);

  // Helper to resolve an item's absolute date
  const resolveItemDate = (item: WeeklyPlanItem, weekOffset: number) => {
    if (item.date && !isNaN(new Date(item.date).getTime())) {
      return item.date;
    }

    // Legacy fallback: Resolution based on current week start
    const now = new Date();
    const startOfTargetWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Adjust to Monday of the target week
    const currentDay = startOfTargetWeek.getDay(); // 0 (Sun) to 6 (Sat)
    const daysToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    startOfTargetWeek.setDate(startOfTargetWeek.getDate() + daysToMonday + (weekOffset * 7));

    const weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    const targetIdx = weekdays.indexOf(item.day?.toLowerCase() || "");
    
    if (targetIdx !== -1) {
      const resolvedDate = new Date(startOfTargetWeek);
      resolvedDate.setDate(resolvedDate.getDate() + targetIdx);
      return resolvedDate.toISOString().split('T')[0];
    }

    return 'TBA';
  };

  // Group and Sort Logic
  const processedGroups = useMemo(() => {
    const groups: Record<string, WeeklyPlanItem[]> = {};
    
    // 1. Group items by resolved date
    plan.forEach(item => {
      const dateKey = resolveItemDate(item, selectedWeek);
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(item);
    });

    // 2. Filter for selected week if not Tactical Overview (selectedWeek === 2)
    const filteredGroups: Record<string, WeeklyPlanItem[]> = {};
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const msInDay = 24 * 60 * 60 * 1000;

    Object.keys(groups).forEach(dateStr => {
      if (dateStr === 'TBA') {
        if (selectedWeek === 0) filteredGroups[dateStr] = groups[dateStr];
        return;
      }

      if (selectedWeek === 2) {
        filteredGroups[dateStr] = groups[dateStr];
        return;
      }

      const itemTime = new Date(dateStr).getTime();
      const diffDays = Math.floor((itemTime - startOfToday) / msInDay);

      if (selectedWeek === 0 && diffDays >= -7 && diffDays < 7) {
        filteredGroups[dateStr] = groups[dateStr];
      } else if (selectedWeek === 1 && diffDays >= 7 && diffDays < 14) {
        filteredGroups[dateStr] = groups[dateStr];
      }
    });

    // 3. Sort items within each group by TIME
    Object.keys(filteredGroups).forEach(dateKey => {
      filteredGroups[dateKey].sort((a, b) => {
        const timeA = a.time?.split('-')[0] || "00:00";
        const timeB = b.time?.split('-')[0] || "00:00";
        return timeA.localeCompare(timeB);
      });
    });

    return filteredGroups;
  }, [plan, selectedWeek]);

  const sortedDates = useMemo(() => {
    return Object.keys(processedGroups).sort((a, b) => {
      if (a === 'TBA') return 1;
      if (b === 'TBA') return -1;
      return new Date(a).getTime() - new Date(b).getTime();
    });
  }, [processedGroups]);

  const formatDateLabel = (dateStr: string) => {
    if (dateStr === 'TBA') return { day: 'TBA', date: 'Upcoming' };
    
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return { day: dateStr, date: "" };

    return {
      day: date.toLocaleDateString('en-US', { weekday: 'long' }),
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    };
  };

  return (
    <div className="w-full h-full bg-[var(--background)] px-4 sm:px-6 py-6 sm:py-8 relative">
      {/* Background Ambience */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="max-w-4xl mx-auto relative z-10">
        
        {/* Premium Tactical Header - Unified with Hub */}
        <header className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-4 border-b border-[var(--card-border)]">
          <div className="space-y-2">
            <button 
              onClick={() => setActiveView('schedule')}
              className="group flex items-center gap-1.5 text-[9px] font-black text-indigo-500 uppercase tracking-widest hover:translate-x-[-4px] transition-transform"
            >
              <ArrowLeft className="w-3 h-3" />
              Strategic Hub
            </button>
            <div className="flex items-center gap-3">
               <div className="flex flex-col">
                 <div className="flex items-center gap-2">
                   <h1 className="text-2xl font-black text-[var(--header-text)] italic tracking-tight uppercase">Tactical Timeline</h1>
                   <div className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded-md shrink-0">
                      <span className="text-[10px] font-black text-indigo-500 uppercase">Multi-Week</span>
                   </div>
                 </div>
                 <p className="text-[11px] font-black text-[var(--muted-text)] opacity-40 uppercase tracking-[0.2em] mt-0.5 italic">
                   Chronological sequence engine
                 </p>
               </div>
            </div>
          </div>

          <div className="flex items-center bg-[var(--card-bg)] border border-[var(--card-border)] p-1.5 rounded-xl shadow-sm backdrop-blur-md shrink-0">
            {['This Week', 'Next Week', 'Tactical Overview'].map((tab, idx) => (
              <button
                key={tab}
                onClick={() => setSelectedWeek(idx)}
                className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                  selectedWeek === idx 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                    : 'text-slate-400 hover:text-indigo-500 hover:bg-indigo-500/5'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </header>

        {/* Chronological Flux Section */}
        <div className="relative space-y-8 pl-0 sm:pl-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedWeek}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              {sortedDates.map((dateStr) => {
                const { day, date } = formatDateLabel(dateStr);
                const items = processedGroups[dateStr];

                return (
                  <div key={dateStr} className="relative group flex flex-col lg:flex-row gap-4 lg:gap-8">
                    {/* Sticky Day Marker - Refined for Alignment */}
                    <div className="lg:w-28 lg:shrink-0 flex flex-row lg:flex-col lg:items-end gap-1.5 group-hover:translate-x-1 transition-transform duration-500 lg:sticky lg:top-8 self-start pt-1">
                       <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest opacity-40 group-hover:opacity-100">{day}</span>
                       <span className="text-xl font-black text-[var(--header-text)] italic tracking-tighter sm:text-2xl">{date}</span>
                    </div>

                    <div className="flex-1 space-y-4">
                      {items.map((item, itemIdx) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: itemIdx * 0.1 }}
                        >
                          <div className="bg-[var(--card-bg)] border border-[var(--card-border)] p-4 sm:p-5 rounded-2xl hover:bg-[var(--card-hover-bg)] transition-all duration-500 group/card shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 flex flex-col md:flex-row md:items-center gap-6 overflow-hidden relative">
                            {/* Visual Accent */}
                            <div className="absolute right-0 top-0 w-24 h-24 bg-indigo-600/[0.03] blur-2xl rounded-full group-hover/card:bg-indigo-600/[0.1] transition-colors" />
                            
                            <div className="flex-1 space-y-2.5 relative z-10">
                              <div className="flex flex-wrap items-center gap-2.5">
                                {item.is_discovery && (
                                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                                     <Zap className="w-3 h-3 text-amber-500" />
                                     <span className="text-[9px] font-black text-amber-500 uppercase tracking-tighter">AI Discovery</span>
                                  </div>
                                )}
                                {item.source && (
                                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-500/5 border border-indigo-500/10 rounded-lg">
                                     <span className="text-[9px] font-black text-indigo-500 opacity-60 uppercase tracking-widest">{item.source}</span>
                                     {item.url && (
                                       <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-indigo-600 transition-colors">
                                         <ExternalLink className="w-2.5 h-2.5" />
                                       </a>
                                     )}
                                  </div>
                                )}
                                <h3 className="text-xl font-black text-[var(--header-text)] italic tracking-tight group-hover/card:text-indigo-600 transition-colors uppercase">
                                  {item.title}
                                </h3>
                              </div>

                              <div className="flex flex-wrap items-center gap-4">
                                <div className="flex items-center gap-2 text-[11px] font-black text-indigo-500/70 uppercase tracking-widest">
                                  <Clock className="w-3.5 h-3.5" />
                                  {item.time}
                                </div>
                                {item.location && (
                                  <div className="flex items-center gap-2 text-[11px] font-bold text-[var(--muted-text)] opacity-50 uppercase tracking-widest">
                                    <MapPin className="w-3.5 h-3.5" />
                                    {item.location}
                                  </div>
                                )}
                                {item.is_synced && (
                                  <div className="flex items-center gap-1.5 text-[10px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/5 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Synced
                                  </div>
                                )}
                              </div>

                              <p className="text-xs text-[var(--muted-text)] opacity-60 font-medium italic leading-relaxed max-w-2xl">
                                &ldquo;{item.reason}&rdquo;
                              </p>
                            </div>

                            <div className="flex items-center gap-2 self-end md:self-center relative z-10 scale-90 sm:scale-95">
                               <button className="w-8 h-8 rounded-xl border border-[var(--card-border)] flex items-center justify-center text-[var(--muted-text)] hover:text-indigo-600 hover:bg-indigo-500/5 transition-all">
                                  <Sparkles className="w-3.5 h-3.5" />
                                </button>
                               <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-md shadow-indigo-600/10 active:scale-95 transition-all">
                                  Modify
                               </button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                );
              })}


              {sortedDates.length === 0 && (
                <div className="py-10 text-center space-y-4">
                   <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-[2rem] flex items-center justify-center mx-auto border border-[var(--card-border)]">
                      <Calendar className="w-8 h-8 text-slate-300" />
                   </div>
                   <div>
                      <h3 className="text-lg font-black text-[var(--header-text)] italic uppercase tracking-tight">Timeline Quiescent</h3>
                      <p className="text-[9px] uppercase font-black tracking-widest text-[var(--muted-text)] opacity-40 mt-1">No upcoming tactical maneuvers detected</p>
                   </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <footer className="mt-12 pt-6 border-t border-[var(--card-border)] flex flex-col md:flex-row items-center justify-between gap-4 opacity-30">
          <p className="text-[9px] font-black uppercase tracking-[0.5em] italic">Tactical Cadence Sequence Engine v2.0</p>
          <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-[0.2em]">
            <span>Latency: 12ms</span>
            <div className="w-1 h-1 bg-emerald-500 rounded-full" />
            <span>Neural Link: Active</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
