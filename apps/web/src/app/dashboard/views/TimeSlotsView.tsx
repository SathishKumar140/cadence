import React, { useState } from 'react';
import { Calendar, Clock, CheckCircle2, AlertCircle, Plus, Star, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useDashboard } from '../DashboardContext';

interface TimeSlotsViewProps {
  data: {
    slots?: Array<{
      day: string;
      date: string;
      start: string;
      end: string;
      duration_minutes: number;
      quality: 'high' | 'medium';
    }>;
    recommended?: any;
    activity?: string;
    goal?: string;
  };
}

export default function TimeSlotsView({ data }: TimeSlotsViewProps) {
  const { userId, accessToken, applyMutation } = useDashboard();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  const slots = data.slots || [];
  const recommended = data.recommended;

  const handleLockSlot = async (slot: any, id: string) => {
    if (successId === id) return;
    setLoadingId(id);
    try {
      let apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      if (apiUrl && !apiUrl.startsWith('http')) apiUrl = `https://${apiUrl}`;

      const response = await fetch(`${apiUrl}/api/calendar/add-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          item_id: `slot-${id}`,
          access_token: accessToken,
          title: data.activity || data.goal || 'Focused Activity',
          day: slot.day,
          time: `${slot.start}-${slot.end}`,
          description: `Automatically optimized slot via Cadence AI for: ${data.activity || data.goal || 'General Focus'}`
        })
      });

      if (response.ok) {
        setSuccessId(id);
        
        // Update local viewData so the 'locked' state persists even if component re-renders from external data
        if (data.slots) {
          const updatedSlots = data.slots.map((s, idx) => 
            (id === `slot-${idx}` || (id === 'recommended' && s === recommended)) 
            ? { ...s, locked: true } 
            : s
          );
          setViewData({ ...data, slots: updatedSlots });
        }

        // Add to weekly plan optimistically
        applyMutation({
          target: 'weekly_plan',
          action: 'add',
          data: {
            id: `event-${Date.now()}`,
            title: data.activity || data.goal || 'Focused Activity',
            day: slot.day,
            time: `${slot.start}-${slot.end}`,
            reason: "AI Optimized deep work slot",
            is_synced: true
          }
        });
        
        // Longer timeout for visibility
        setTimeout(() => setSuccessId(null), 10000);
      }
    } catch (error) {
      console.error("Failed to lock slot:", error);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-8 sm:py-12 px-4 sm:px-6 relative z-10">
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/10 flex items-center justify-center text-indigo-600 border border-indigo-600/20 shadow-sm">
            <Calendar className="w-5 h-5" />
          </div>
          <h1 className="text-2xl font-black text-[var(--header-text)]">Time Optimization</h1>
        </div>
        <p className="text-[var(--muted-text)] text-sm font-medium">
          Found {slots.length} available slots for your {data.activity || data.goal || 'next activity'}.
        </p>
      </header>

      <div className="space-y-8">
        {/* Recommended Slot */}
        {recommended && (
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl blur opacity-10 group-hover:opacity-20 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative bg-[var(--card-bg)] border-2 border-indigo-500/30 p-8 rounded-3xl shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="px-3 py-1 rounded-full bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-lg shadow-indigo-500/20">
                    <Star className="w-3 h-3 fill-white" />
                    AI Best Pick
                  </div>
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 italic">Highly Recommended</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black text-[var(--header-text)] uppercase opacity-40">Est. Productivity</span>
                  <p className="text-lg font-black text-indigo-500">95%</p>
                </div>
              </div>

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h3 className="text-2xl font-black text-[var(--header-text)] mb-1">
                    {recommended.day}, {recommended.date}
                  </h3>
                  <div className="flex items-center gap-4 text-slate-500 font-bold italic text-sm">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      {recommended.start} - {recommended.end}
                    </div>
                    <span>({recommended.duration_minutes} min)</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button 
                    disabled={loadingId === 'recommended' || successId === 'recommended' || recommended?.locked}
                    onClick={() => handleLockSlot(recommended, 'recommended')}
                    className={`px-6 py-3 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 shadow-xl ${
                      (successId === 'recommended' || recommended?.locked)
                      ? 'bg-emerald-500 text-white shadow-emerald-500/20' 
                      : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-600/20'
                    }`}
                  >
                    {loadingId === 'recommended' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (successId === 'recommended' || recommended?.locked) ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    {(successId === 'recommended' || recommended?.locked) ? 'Locked!' : 'Lock this Slot'}
                  </button>
                </div>
              </div>
              
              <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800/50">
                <p className="text-sm text-slate-500 leading-relaxed italic">
                  &ldquo;This slot aligns perfectly with your historical focus peaks and leaves enough buffer for your evening routine.&rdquo;
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Other Slots Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {slots.filter(s => s !== recommended).map((slot, idx) => {
            const id = `slot-${idx}`;
            return (
              <div key={idx} className="bg-[var(--card-bg)] border border-[var(--card-border)] p-6 rounded-2xl hover:bg-[var(--card-hover-bg)] hover:border-indigo-500/20 transition-all duration-300 group">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{slot.day}</span>
                    <h4 className="font-black text-[var(--header-text)] italic tracking-tight">{slot.start} - {slot.end}</h4>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${slot.quality === 'high' ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 italic uppercase tracking-wider">{slot.duration_minutes} minutes free</span>
                  <button 
                    disabled={loadingId === id || successId === id || slot.locked}
                    onClick={() => handleLockSlot(slot, id)}
                    className={`p-2 rounded-xl transition-all ${
                      (successId === id || slot.locked)
                      ? 'bg-emerald-500/10 text-emerald-500 shadow-lg shadow-emerald-500/5' 
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 group-hover:bg-indigo-500/10'
                    }`}
                  >
                    {loadingId === id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (successId === id || slot.locked) ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {slots.length === 0 && (
          <div className="p-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl flex flex-col items-center justify-center text-center">
            <AlertCircle className="w-8 h-8 text-slate-300 dark:text-slate-700 mb-4" />
            <p className="text-slate-500 font-bold italic">No open slots found within your working hours.</p>
            <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">Adjust your range or density in settings</p>
          </div>
        )}
      </div>
    </div>
  );
}
