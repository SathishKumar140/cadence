'use client';

import React from 'react';
import { Activity, Clock, Zap, Users, BookOpen, Target } from 'lucide-react';
import ScheduleList from '../ScheduleList';
import TimeZoneBadge from '../TimeZoneBadge';
import GoalsAction from '../GoalsAction';
import RegenerateButton from '../RegenerateButton';
import { useDashboard } from '../DashboardContext';

export default function ScheduleView() {
  const { userId, accessToken, insights, goals } = useDashboard();

  const getIcon = (type: string) => {
    switch (type) {
      case 'productivity': return <Zap className="w-5 h-5" />;
      case 'wellness': return <Activity className="w-5 h-5" />;
      case 'learning': return <BookOpen className="w-5 h-5" />;
      case 'social': return <Users className="w-5 h-5" />;
      case 'focus': return <Target className="w-5 h-5" />;
      default: return <Clock className="w-5 h-5" />;
    }
  };

  const getColors = (type: string) => {
    switch (type) {
      case 'productivity': return {
        bg: 'bg-blue-500/10',
        text: 'text-blue-500 dark:text-blue-400',
        border: 'border-blue-500/20',
        glow: 'shadow-blue-500/20',
        bar: 'bg-blue-500'
      };
      case 'wellness': return {
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-500 dark:text-emerald-400',
        border: 'border-emerald-500/20',
        glow: 'shadow-emerald-500/20',
        bar: 'bg-emerald-500'
      };
      case 'learning': return {
        bg: 'bg-purple-500/10',
        text: 'text-purple-500 dark:text-purple-400',
        border: 'border-purple-500/20',
        glow: 'shadow-purple-500/20',
        bar: 'bg-purple-500'
      };
      case 'social': return {
        bg: 'bg-orange-500/10',
        text: 'text-orange-500 dark:text-orange-400',
        border: 'border-orange-500/20',
        glow: 'shadow-orange-500/20',
        bar: 'bg-orange-500'
      };
      case 'focus': return {
        bg: 'bg-rose-500/10',
        text: 'text-rose-500 dark:text-rose-400',
        border: 'border-rose-500/20',
        glow: 'shadow-rose-500/20',
        bar: 'bg-rose-500'
      };
      default: return {
        bg: 'bg-slate-500/10',
        text: 'text-slate-500 dark:text-slate-400',
        border: 'border-slate-500/20',
        glow: 'shadow-slate-500/20',
        bar: 'bg-slate-500'
      };
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-6 sm:py-8 px-4 sm:px-6 relative z-10 transition-all duration-500">
      {/* Ultra-Minimalist Unified Header */}
      <header className="mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-[var(--card-border)]">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-[var(--header-text)] italic tracking-tight uppercase">Strategic Hub</h1>
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
               <span className="text-[10px] font-black text-indigo-500">{insights.optimization_score || 0}%</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 px-2 py-1 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-md">
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
               <span className="text-[9px] font-black text-[var(--muted-text)] uppercase tracking-widest">Optimized</span>
            </div>
            <TimeZoneBadge userId={userId} accessToken={accessToken} />
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <RegenerateButton userId={userId} />
          <GoalsAction 
            userId={userId} 
            initialGoals={goals} 
            initialInterests={[]}
          />
        </div>
      </header>

      {/* Condensed Intelligence Bar */}
      {insights.insight_cards && insights.insight_cards.length > 0 && (
        <section className="mb-10 relative z-0">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-[10px] font-black italic tracking-[0.2em] text-[var(--header-text)] uppercase opacity-60">Intelligence</h2>
            <div className="h-[1px] flex-1 bg-gradient-to-r from-[var(--card-border)] to-transparent" />
          </div>

          <div className="flex flex-wrap gap-4">
            {insights.insight_cards.map((card, idx) => {
              const styles = getColors(card.score_type);
              return (
                <div 
                  key={idx} 
                  title={card.description}
                  className="group relative flex-1 min-w-[160px] bg-[var(--card-bg)] border border-[var(--card-border)] px-4 py-3 rounded-xl hover:bg-[var(--card-hover-bg)] transition-all duration-300 overflow-hidden cursor-help"
                >
                  <div className="relative z-10 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center ${styles.bg} ${styles.text} border ${styles.border}`}>
                        {getIcon(card.score_type)}
                      </div>
                      <h3 className="text-[11px] font-bold text-[var(--header-text)] leading-tight tracking-tight uppercase">{card.title}</h3>
                    </div>
                    <div className="w-full h-[3px] bg-slate-100 dark:bg-slate-800/50 rounded-full overflow-hidden">
                      <div className={`h-full ${styles.bar} transition-all duration-1000`} style={{ width: `${card.impact}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <ScheduleList 
          accessToken={accessToken} 
          userId={userId} 
          calendarTimezone={'UTC'} // Could be from context
        />
      </section>
    </div>
  );
}
