'use client';

import React from 'react';
import { Repeat, Trophy, Flame, ChevronRight, CheckCircle2, Circle, Clock, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

interface Routine {
  id: string;
  name: string;
  description: string;
  schedule: string;
  alert_time: string | null;
  streak_count: number;
  done_today: boolean;
  last_completed: string | null;
}

interface RoutineDashboardProps {
  data: {
    routines?: Routine[];
    action?: string;
    routine_id?: string;
  };
}

export default function RoutineDashboardView({ data }: RoutineDashboardProps) {
  const routines = data.routines || [];

  return (
    <div className="w-full max-w-4xl mx-auto py-8 sm:py-12 px-4 sm:px-6 relative z-10">
      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-orange-600/10 flex items-center justify-center text-orange-600 border border-orange-600/20 shadow-sm">
              <Repeat className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-black text-[var(--header-text)]">Routine Matrix</h1>
          </div>
          <p className="text-[var(--muted-text)] text-sm font-medium">Tracking {routines.length} habitual loops for peak consistency.</p>
        </div>

        <div className="flex items-center gap-4 bg-orange-500/10 border border-orange-500/20 p-4 rounded-2xl">
          <div className="p-2 bg-orange-500 rounded-xl text-white">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-orange-600 dark:text-orange-400">Total Mastery</span>
            <p className="text-lg font-black text-[var(--header-text)] leading-none">
              {routines.reduce((acc, r) => acc + (r.streak_count || 0), 0)} Day Streak
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4">
        {routines.map((routine, idx) => (
          <motion.div 
            key={routine.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className={`group relative bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-6 transition-all duration-300 hover:bg-[var(--card-hover-bg)] overflow-hidden ${
              routine.done_today ? 'border-orange-500/30 ring-1 ring-orange-500/10 shadow-lg shadow-orange-500/10' : ''
            }`}
          >
            {/* Background Glow for completion */}
            {routine.done_today && (
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 blur-[40px] rounded-full pointer-events-none" />
            )}

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
              <div className="flex items-start gap-4">
                <button className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                  routine.done_today ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/40' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 hover:text-orange-500'
                }`}>
                  {routine.done_today ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                </button>
                <div>
                  <h3 className="text-lg font-black text-[var(--header-text)] italic tracking-tight mb-1">{routine.name}</h3>
                  <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest opacity-60">
                    <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> {routine.alert_time || 'No Alert'}</span>
                    <span className="flex items-center gap-1.5"><Repeat className="w-3 h-3" /> {routine.schedule}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-8">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Streak</span>
                  <div className="flex items-center gap-1">
                    <Flame className={`w-4 h-4 ${routine.streak_count > 0 ? 'text-orange-500 animate-pulse' : 'text-slate-300 dark:text-slate-700'}`} />
                    <span className="text-xl font-black text-[var(--header-text)] leading-none">{routine.streak_count}</span>
                  </div>
                </div>

                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Growth</span>
                  <TrendingUp className="w-5 h-5 text-emerald-500 opacity-60" />
                </div>

                <button className="p-3 rounded-xl bg-slate-100/50 dark:bg-slate-800/50 text-slate-400 hover:text-slate-600 transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            {routine.description && (
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/30 text-[11px] text-[var(--muted-text)] font-medium">
                Target: {routine.description}
              </div>
            )}
          </motion.div>
        ))}

        {routines.length === 0 && (
          <div className="p-16 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl flex flex-col items-center justify-center text-center">
            <Repeat className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-6" />
            <p className="text-slate-500 font-bold italic mb-2">Your routine matrix is void.</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">Ask me: "Start a morning routine" to begin</p>
          </div>
        )}
      </div>
    </div>
  );
}
