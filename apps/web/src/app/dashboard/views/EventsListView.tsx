'use client';

import React from 'react';
import { Calendar, LayoutList, ArrowLeft } from 'lucide-react';
import ScheduleList from '../ScheduleList';
import { useDashboard } from '../DashboardContext';

export default function EventsListView() {
  const { userId, accessToken, setActiveView } = useDashboard();

  return (
    <div className="w-full max-w-4xl mx-auto py-8 sm:py-12 px-4 sm:px-6 relative z-10 transition-all duration-500">
      {/* Immersive Focused Header */}
      <header className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setActiveView('schedule')}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-indigo-600 transition-colors border border-[var(--card-border)]"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-1">
                <LayoutList className="w-5 h-5 text-indigo-500" />
                <h1 className="text-2xl font-black text-[var(--header-text)] uppercase tracking-tight">Full Schedule</h1>
              </div>
              <p className="text-xs text-[var(--muted-text)] font-bold uppercase tracking-[0.2em] opacity-60 italic">Weekly review mode active</p>
            </div>
          </div>
          
          <div className="px-4 py-2 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-500" />
            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Master Plan</span>
          </div>
        </div>
        
        <div className="h-[1px] w-full bg-gradient-to-r from-[var(--card-border)] via-indigo-500/10 to-transparent" />
      </header>

      {/* Primary List Section */}
      <section className="animate-in fade-in slide-in-from-bottom-4 duration-700">
        <ScheduleList 
          accessToken={accessToken} 
          userId={userId} 
          calendarTimezone={'UTC'} 
        />
      </section>

      {/* Minimal Footer */}
      <footer className="mt-20 pt-8 border-t border-[var(--card-border)] text-center">
        <p className="text-[10px] font-black text-[var(--muted-text)] uppercase tracking-[0.3em] opacity-30 italic">
          Cadence AI Neural Schedule Flow
        </p>
      </footer>
    </div>
  );
}
