'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, CheckCircle2, XCircle, ArrowUpRight, Clock, Zap, ShieldAlert, RefreshCw } from 'lucide-react';
import { useDashboard, PendingAction } from '../DashboardContext';
import PromotionModal from '../modals/PromotionModal';

export default function ReviewCenterView({ data }: { data?: Record<string, unknown> }) {
  const { pendingActions, listeners, applyMutation, userId, reviewFilters, setReviewFilters, onOpenSettings } = useDashboard();
  const [promotingAction, setPromotingAction] = React.useState<PendingAction | null>(null);
  const [scoutingMap, setScoutingMap] = React.useState<Record<string, boolean>>({});
  
  const selectedTopic = reviewFilters.topic;
  const setSelectedTopic = (topic: string | null) => setReviewFilters({ topic });
  
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

  const handleToggleListener = async (listenerId: string) => {
    const listener = (listeners || []).find(l => l.id === listenerId);
    if (!listener) return;

    // Optimistic update
    applyMutation({
      target: 'listeners',
      action: 'update',
      data: { id: listenerId, is_active: !listener.is_active }
    });

    try {
      let apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      if (apiUrl && !apiUrl.startsWith('http')) apiUrl = `https://${apiUrl}`;

      await fetch(`${apiUrl}/api/listeners/${listenerId}/toggle?user_id=${userId}`, {
        method: 'PATCH'
      });
    } catch (e) {
      console.error("Failed to toggle listener:", e);
    }
  };

  const handleRemoveListener = async (listenerId: string) => {
    // Optimistic update
    applyMutation({
      target: 'listeners',
      action: 'remove',
      data: { id: listenerId }
    });

    try {
      let apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      if (apiUrl && !apiUrl.startsWith('http')) apiUrl = `https://${apiUrl}`;

      await fetch(`${apiUrl}/api/listeners/${listenerId}?user_id=${userId}`, {
        method: 'DELETE'
      });
    } catch (e) {
      console.error("Failed to remove listener:", e);
    }
  };

  const handleUpdateFrequency = async (listenerId: string, frequency: string) => {
    // Optimistic update
    applyMutation({
      target: 'listeners',
      action: 'update',
      data: { id: listenerId, scouting_frequency: frequency }
    });

    try {
      let apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      if (apiUrl && !apiUrl.startsWith('http')) apiUrl = `https://${apiUrl}`;

      await fetch(`${apiUrl}/api/listeners/${listenerId}/frequency?user_id=${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, frequency })
      });
    } catch (e) {
      console.error("Failed to update frequency:", e);
    }
  };

  const handleScoutNow = async (listenerId: string) => {
    setScoutingMap(prev => ({ ...prev, [listenerId]: true }));
    try {
      let apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      if (apiUrl && !apiUrl.startsWith('http')) apiUrl = `https://${apiUrl}`;

      const res = await fetch(`${apiUrl}/api/listeners/${listenerId}/scout?user_id=${userId}`, {
        method: 'POST'
      });
      
      if (res.ok) {
        const result = await res.json();
        // Refresh the actions list if items were found
        window.dispatchEvent(new CustomEvent('cadence:scout_complete', { detail: result }));
        // Reload is overkill, but we need to fetch pending actions.
        // Actually, the background pulse should also trigger a refresh.
        // For now, let's just reload to be 100% sure we see the new items.
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (e) {
      console.error("Failed to scout now:", e);
    } finally {
      // Keep loading for a moment for better UX feedback
      setTimeout(() => {
        setScoutingMap(prev => ({ ...prev, [listenerId]: false }));
      }, 2000);
    }
  };

  const filteredActions = React.useMemo(() => {
    let actions = pendingActions || [];
    if (selectedTopic) {
      // Find the listener ID for this topic to filter accurately
      const listener = (listeners || []).find(l => l.topic === selectedTopic);
      // Fallback to title matching if listener ID isn't directly on action (usually it is listener_id)
      actions = actions.filter(a => (a as PendingAction & { listener_id?: string }).listener_id === listener?.id || a.reasoning.includes(selectedTopic));
    }
    return actions;
  }, [pendingActions, selectedTopic, listeners]);

  return (
    <div className="w-full max-w-5xl mx-auto py-12 px-6">
      <header className="mb-12">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 shadow-[0_0_20px_rgba(99,102,241,0.15)]">
            <ShieldAlert className="w-5 h-5 text-indigo-500" />
          </div>
          <h1 className="text-3xl font-black text-[var(--header-text)] tracking-tight italic">
            Discovery Feed
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
            <div className="flex items-center gap-3">
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                {selectedTopic ? `Topic: ${selectedTopic}` : 'All Pending Items'} ({(filteredActions).length})
              </h2>
              {selectedTopic && (
                <button 
                  onClick={() => setSelectedTopic(null)}
                  className="text-[9px] font-bold text-indigo-500 hover:text-indigo-600 underline underline-offset-2"
                >
                  Clear Filter
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
               <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
               <span className="text-[10px] font-bold text-indigo-500">Live Listening</span>
            </div>
          </div>

          <AnimatePresence mode="popLayout">
            {filteredActions.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-[var(--card-bg)] border border-[var(--card-border)] border-dashed rounded-3xl p-12 flex flex-col items-center justify-center text-center"
              >
                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-bold text-[var(--header-text)] mb-1">Clear Horizon</h3>
                <p className="text-xs text-[var(--muted-text)] max-w-xs">{selectedTopic ? `No pending items found for "${selectedTopic}".` : 'All signals have been reviewed. Cadence is monitoring your topics for new developments.'}</p>
              </motion.div>
            ) : (
              filteredActions.map((action) => (
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
                      onClick={() => setPromotingAction(action)}
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
                          &quot;{action.reasoning}&quot;
                        </p>
                      </div>

                      <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(action.created_at).toLocaleDateString()}
                        </div>
                        {action.source_url && (
                          <a 
                            href={action.source_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-indigo-500 transition-all border border-slate-200 dark:border-slate-700 hover:border-indigo-500/30 font-black italic tracking-tight"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                            Visit Website
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
              {(listeners || []).map((listener) => (
                <div 
                  key={listener.id} 
                  className={`group p-3 rounded-2xl border transition-all cursor-pointer relative ${selectedTopic === listener.topic ? 'border-indigo-500/50 bg-indigo-500/[0.05]' : 'border-slate-100 dark:border-slate-800/50 hover:border-indigo-500/30 hover:bg-indigo-500/[0.02]'}`}
                  onClick={() => setSelectedTopic(selectedTopic === listener.topic ? null : listener.topic)}
                >
                  <div className="relative z-10">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${listener.is_active ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]' : 'bg-slate-300 dark:bg-slate-700'}`} />
                        <span className={`text-[12px] font-bold tracking-tight ${selectedTopic === listener.topic ? 'text-indigo-600 dark:text-indigo-400' : 'text-[var(--header-text)]'}`}>
                          {listener.topic}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleToggleListener(listener.id); }}
                          className={`p-1 rounded-md transition-colors ${listener.is_active ? 'hover:bg-amber-500/10 text-amber-500/50 hover:text-amber-500' : 'hover:bg-emerald-500/10 text-emerald-500/50 hover:text-emerald-500'}`}
                        >
                          <Zap className="w-3 h-3" />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleRemoveListener(listener.id); }}
                          className="p-1 rounded-md hover:bg-rose-500/10 text-rose-500/50 hover:text-rose-500 transition-colors"
                        >
                          <XCircle className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex items-center bg-slate-50 dark:bg-slate-800/50 rounded-lg p-0.5 border border-slate-100 dark:border-slate-800 shadow-sm">
                        <select
                          value={listener.scouting_frequency}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleUpdateFrequency(listener.id, e.target.value);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="appearance-none bg-transparent hover:bg-white dark:hover:bg-slate-800 text-indigo-500 text-[10px] font-bold uppercase tracking-tight pl-2 pr-6 py-1 rounded-md cursor-pointer focus:outline-none transition-all"
                        >
                          <option value="10m">10m</option>
                          <option value="30m">30m</option>
                          <option value="1h">1h</option>
                          <option value="2h">2h</option>
                          <option value="6h">6h</option>
                          <option value="12h">12h</option>
                          <option value="24h">24h</option>
                          <option value="manual">Manual</option>
                        </select>
                        <div className="absolute left-[38px] top-[40%] pointer-events-none text-indigo-500/30">
                           <div className="w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[3px] border-t-current" />
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleScoutNow(listener.id);
                          }}
                          disabled={scoutingMap[listener.id]}
                          className={`p-1 rounded-md transition-all ${
                            scoutingMap[listener.id] 
                              ? 'bg-indigo-500/20 text-indigo-500' 
                              : 'text-slate-400 hover:text-indigo-500 hover:bg-white dark:hover:bg-slate-800'
                          }`}
                        >
                          <RefreshCw className={`w-3 h-3 ${scoutingMap[listener.id] ? 'animate-spin' : ''}`} />
                        </button>
                      </div>
                    </div>
                    
                    <p className="text-[10px] text-[var(--muted-text)] line-clamp-1 opacity-60 italic group-hover:opacity-100 group-hover:line-clamp-none transition-all duration-300 mb-2">
                      {listener.context_instruction}
                    </p>

                    {listener.last_processed && (
                      <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-medium tracking-tight mt-2 border-t border-slate-100 dark:border-slate-800/50 pt-2 group-hover:opacity-100 opacity-60 transition-opacity">
                        <Clock className="w-2.5 h-2.5 text-indigo-500/50" />
                        <span>Last Pulled: {new Date(listener.last_processed).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {(listeners || []).length === 0 && (
                <p className="text-[10px] text-slate-400 italic">No active topic listeners configured.</p>
              )}
            </div>
          </section>

          <section className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-6 text-white shadow-xl shadow-indigo-500/20">
            <h3 className="text-xs font-black uppercase tracking-widest mb-4 opacity-80">Pro Tip</h3>
            <p className="text-xs leading-relaxed font-medium">
              You can subscribe to broad trends like &quot;AI in Healthcare&quot; or narrow topics like &quot;Next.js 15 updates&quot;. 
              Cadence will triage the noise so you only see what matters.
            </p>
            <button 
              onClick={onOpenSettings}
              className="mt-6 w-full py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/10"
            >
              Configure Alerts
            </button>
          </section>
        </div>
      </div>

      <AnimatePresence>
        {promotingAction && (
          <PromotionModal 
            isOpen={!!promotingAction}
            onClose={() => setPromotingAction(null)}
            action={promotingAction}
            userId={userId}
            onSuccess={handleResolve}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
