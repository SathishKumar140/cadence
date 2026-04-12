'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, CheckCircle2, XCircle, ArrowUpRight, Target, Clock, Zap, ShieldAlert } from 'lucide-react';
import { useDashboard, PendingAction } from '../DashboardContext';

export default function ReviewCenterView({ data }: { data?: any }) {
  const { pendingActions, listeners, applyMutation, userId, accessToken } = useDashboard();
  
  // Highlight items from the specific agent directive if provided
  const highlightedId = data?.action_id;

  const handleResolve = async (id: string, resolution: string) => {
    // Optimistic update
    applyMutation({
      target: 'actions',
      action: 'remove',
      data: { id }
    });

    try {
      let apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      if (apiUrl && !apiUrl.startsWith('http')) apiUrl = `https://${apiUrl}`;

      await fetch(`${apiUrl}/api/actions/${id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, resolution })
      });
    } catch (e) {
      console.error("Failed to resolve action:", e);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto py-12 px-6">
      <header className="mb-12">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 shadow-[0_0_20px_rgba(99,102,241,0.15)]">
            <ShieldAlert className="w-5 h-5 text-indigo-500" />
          </div>
          <h1 className="text-3xl font-black text-[var(--header-text)] tracking-tight italic">
            Review Center
          </h1>
        </div>
        <p className="text-[var(--muted-text)] text-sm max-w-xl leading-relaxed">
          Proactive signals identified by your AI listeners. Review these items to promote them to goals, calendar events, or dismiss them.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Triage Column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between mb-2 px-2">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              Pending Items ({pendingActions.length})
            </h2>
            <div className="flex items-center gap-2">
               <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
               <span className="text-[10px] font-bold text-indigo-500">Live Listening</span>
            </div>
          </div>

          <AnimatePresence mode="popLayout">
            {pendingActions.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-[var(--card-bg)] border border-[var(--card-border)] border-dashed rounded-3xl p-12 flex flex-col items-center justify-center text-center"
              >
                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-bold text-[var(--header-text)] mb-1">Clear Horizon</h3>
                <p className="text-xs text-[var(--muted-text)] max-w-xs">All signals have been reviewed. Cadence is monitoring your topics for new developments.</p>
              </motion.div>
            ) : (
              pendingActions.map((action) => (
                <motion.div
                  key={action.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`group relative bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl p-6 hover:bg-[var(--card-hover-bg)] transition-all duration-300 ${highlightedId === action.id ? 'ring-2 ring-indigo-500 ring-offset-4 ring-offset-[var(--dashboard-bg)]' : ''}`}
                >
                  <div className="absolute top-4 right-6 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleResolve(action.id, 'dismissed')}
                      className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-500/10 hover:text-rose-500 transition-colors"
                      title="Dismiss"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleResolve(action.id, 'promoted')}
                      className="p-2 rounded-xl bg-indigo-500 text-white hover:bg-indigo-600 transition-colors shadow-lg shadow-indigo-500/20"
                      title="Promote to Action"
                    >
                      <ArrowUpRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-start gap-5">
                    <div className="w-12 h-12 shrink-0 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                      <Zap className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0 pr-12">
                      <h3 className="text-lg font-black text-[var(--header-text)] mb-1 leading-tight">
                        {action.title}
                      </h3>
                      <p className="text-xs text-[var(--muted-text)] leading-relaxed mb-4 line-clamp-2">
                        {action.description}
                      </p>
                      
                      <div className="p-4 rounded-2xl bg-indigo-500/[0.03] border border-indigo-500/10 mb-5">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Eye className="w-3 h-3 text-indigo-500" />
                          <span className="text-[10px] font-black uppercase tracking-wider text-indigo-500">AI Reasoning</span>
                        </div>
                        <p className="text-[11px] text-[var(--muted-text)] italic leading-relaxed">
                          "{action.reasoning}"
                        </p>
                      </div>

                      <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(action.created_at).toLocaleDateString()}
                        </div>
                        {action.source_url && (
                          <a href={action.source_url} target="_blank" className="flex items-center gap-1 hover:text-indigo-500 transition-colors">
                            Source Info
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        {/* Sidebar: Listeners Stats */}
        <div className="space-y-8">
          <section className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl p-6 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-widest text-[#64748b] mb-4 flex items-center gap-2">
              <Zap className="w-3 h-3 text-indigo-500" />
              Active Listeners
            </h3>
            <div className="space-y-3">
              {listeners.map((listener) => (
                <div key={listener.id} className="group p-3 rounded-2xl border border-slate-100 dark:border-slate-800/50 hover:border-indigo-500/30 hover:bg-indigo-500/[0.02] transition-all">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-black text-[var(--header-text)]">{listener.topic}</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  </div>
                  <p className="text-[9px] text-slate-500 leading-tight opacity-0 group-hover:opacity-100 transition-opacity">
                    {listener.context_instruction}
                  </p>
                </div>
              ))}
              {listeners.length === 0 && (
                <p className="text-[10px] text-slate-400 italic">No active topic listeners configured.</p>
              )}
            </div>
          </section>

          <section className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-6 text-white shadow-xl shadow-indigo-500/20">
            <h3 className="text-xs font-black uppercase tracking-widest mb-4 opacity-80">Pro Tip</h3>
            <p className="text-xs leading-relaxed font-medium">
              You can subscribe to broad trends like "AI in Healthcare" or narrow topics like "Next.js 15 updates". 
              Cadence will triage the noise so you only see what matters.
            </p>
            <button className="mt-6 w-full py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/10">
              Configure Alerts
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
