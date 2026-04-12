'use client';

import React from 'react';
import { Target, TrendingUp, Calendar, Plus, Sparkles, ChevronRight, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface Goal {
  id: string;
  title: string;
  target_value: number;
  current_value: number;
  unit: string;
  category: string;
  progress_pct: number;
  deadline: string | null;
}

interface GoalEditorProps {
  data: {
    goals?: Goal[];
    suggestions?: { title: string; why: string }[];
    action?: string;
    goal_id?: string;
  };
}

export default function GoalEditorView({ data }: GoalEditorProps) {
  const goals = data.goals || [];
  const suggestions = data.suggestions || [];

  return (
    <div className="w-full max-w-4xl mx-auto py-8 sm:py-12 px-4 sm:px-6 relative z-10">
      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/10 flex items-center justify-center text-indigo-600 border border-indigo-600/20 shadow-sm">
              <Target className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-black text-[var(--header-text)]">Goal Architecture</h1>
          </div>
          <p className="text-[var(--muted-text)] text-sm font-medium">Measuring {goals.length} high-impact objectives.</p>
        </div>

        <button className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all">
          <Plus className="w-4 h-4" />
          New Objective
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        {goals.map((goal, idx) => (
          <motion.div 
            key={goal.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.05 }}
            className="group relative bg-[var(--card-bg)] border border-[var(--card-border)] p-6 rounded-3xl hover:bg-[var(--card-hover-bg)] transition-all duration-300 shadow-sm overflow-hidden"
          >
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 group-hover:bg-indigo-500/10 group-hover:text-indigo-500 transition-colors">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{goal.category}</span>
                    <h3 className="text-sm font-black text-[var(--header-text)] leading-tight mt-1">{goal.title}</h3>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black text-indigo-500 leading-none">{Math.round(goal.progress_pct)}%</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800/50 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${goal.progress_pct}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className={`h-full ${goal.progress_pct >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                  />
                </div>
                
                <div className="flex items-center justify-between font-bold italic text-xs text-slate-500">
                  <span>{goal.current_value} / {goal.target_value} {goal.unit}</span>
                  {goal.deadline && (
                    <span className="flex items-center gap-1.5 opacity-60">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(goal.deadline).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {goal.progress_pct >= 100 && (
              <div className="absolute top-0 right-0 p-4">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              </div>
            )}
          </motion.div>
        ))}

        {goals.length === 0 && (
          <div className="col-span-full p-20 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[3rem] flex flex-col items-center justify-center text-center">
            <Target className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-6" />
            <p className="text-slate-500 font-bold italic mb-2">Zero objectives detected.</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">Type: &quot;I want to read 2 books this month&quot;</p>
          </div>
        )}
      </div>

      {/* AI Suggestions Section */}
      {suggestions.length > 0 && (
        <section className="relative pt-8 border-t border-slate-100 dark:border-slate-800/50">
          <div className="flex items-center gap-3 mb-8">
            <Sparkles className="w-5 h-5 text-indigo-500" />
            <h2 className="text-lg font-black italic text-[var(--header-text)]">AI Recommended Path</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {suggestions.map((suggestion, idx) => (
              <div key={idx} className="bg-indigo-500/[0.03] border border-indigo-500/10 p-5 rounded-2xl flex items-center justify-between group hover:border-indigo-500/30 transition-all cursor-pointer">
                <div>
                  <h4 className="text-xs font-black text-[var(--header-text)] mb-1 leading-tight">{suggestion.title}</h4>
                  <p className="text-[10px] text-slate-500 font-medium italic">{suggestion.why}</p>
                </div>
                <button className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-indigo-500 hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
