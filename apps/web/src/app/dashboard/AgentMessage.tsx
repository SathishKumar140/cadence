'use client';

import { Brain, Zap, Sparkles, Maximize2 } from 'lucide-react';
import { CheckCircle2 } from 'lucide-react';
import { DashboardMutation, WeeklyPlanItem, useDashboard } from './DashboardContext';

interface AgentMessageProps {
  role: 'user' | 'assistant';
  content: string;
  thinking?: string;
  thinkingSteps?: string[];
  mutations?: DashboardMutation[];
  discoveries?: WeeklyPlanItem[];
  promotion?: { topic: string; target: string };
  uiDirective?: { view: string; data?: Record<string, unknown> };
}

export default function AgentMessage({ role, content, thinking, thinkingSteps, mutations, discoveries, promotion, uiDirective }: AgentMessageProps) {
  const { setActiveView, setViewData } = useDashboard();
  const isUser = role === 'user';
  const allThinking = thinkingSteps || (thinking ? [thinking] : []);

  const handleNavigate = () => {
    if (uiDirective) {
      setActiveView(uiDirective.view);
      if (uiDirective.data) {
        setViewData(uiDirective.data);
      }
    }
  };

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} mb-8 group w-full`}>
      {allThinking.length > 0 && !isUser && (
        <div className={`flex flex-col gap-2.5 mb-4 px-5 py-4 border-l-2 rounded-r-2xl rounded-bl-sm animate-in fade-in slide-in-from-left-3 duration-700 w-full max-w-[90%] relative overflow-hidden transition-all duration-500 ease-in-out ${
          (content || (discoveries && discoveries.length > 0))
            ? 'bg-indigo-500/[0.02] border-indigo-500/20 opacity-70 scale-[0.98] origin-left'
            : 'bg-indigo-500/[0.04] border-indigo-500/40 backdrop-blur-md opacity-100'
        }`}>
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/[0.02] to-transparent pointer-none" />
          <div className="flex items-center gap-2.5 mb-1 relative z-10">
            <div className="p-1 bg-indigo-500/10 rounded-lg">
              <Brain className={`w-3.5 h-3.5 text-indigo-400 ${(content || (discoveries && discoveries.length > 0)) ? '' : 'animate-pulse'}`} />
            </div>
            <span className="text-[11px] text-indigo-600 dark:text-indigo-300 font-bold uppercase tracking-[0.15em] leading-none">
              Cognitive Reasoning Process
            </span>
          </div>
          <div className="space-y-2.5 pl-0.5 relative z-10">
            {allThinking.map((step, idx) => (
              <div key={idx} className="flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-500 fill-mode-both" style={{ animationDelay: `${idx * 150}ms` }}>
                <div className="mt-1">
                  <CheckCircle2 className="w-3 h-3 text-indigo-500/80 shadow-[0_0_8px_rgba(99,102,241,0.3)]" />
                </div>
                <span className="text-[12px] text-slate-700 dark:text-zinc-100 font-medium leading-normal tracking-wide transition-all">
                  {step}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {promotion ? (
        <div className={`w-full max-w-[85%] p-5 rounded-[2.5rem] shadow-xl relative transition-all duration-300 border-2 ${
          isUser 
            ? 'bg-gradient-to-br from-indigo-600 to-violet-700 text-white border-white/10 rounded-tr-none' 
            : 'bg-[var(--card-bg)] text-[var(--header-text)] border-indigo-500/20 rounded-tl-none'
        }`}>
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center relative overflow-hidden">
                <Zap className="w-6 h-6 text-white animate-pulse" />
                <div className="absolute inset-0 bg-white/5 animate-ping opacity-20" />
             </div>
             <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-1">Promotion Signal</p>
                <h4 className="text-sm font-bold tracking-tight leading-tight">
                  Drafting {promotion.target} post for: <span className="italic">&quot;{promotion.topic}&quot;</span>
                </h4>
             </div>
          </div>
          <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center opacity-60">
             <span className="text-[9px] font-bold tracking-widest uppercase">System Bridge Active</span>
             <Sparkles className="w-3 h-3" />
          </div>
        </div>
      ) : content && (
        <div 
          onClick={uiDirective ? handleNavigate : undefined}
          className={`max-w-[85%] px-5 py-4 rounded-[2rem] shadow-sm relative transition-all duration-300 ${
            uiDirective ? 'cursor-pointer hover:ring-2 hover:ring-indigo-500/30 hover:shadow-indigo-500/10' : ''
          } ${
          isUser 
            ? 'bg-indigo-600 text-white rounded-tr-none' 
            : 'bg-[var(--card-bg)] text-[var(--header-text)] border border-[var(--card-border)] backdrop-blur-xl rounded-tl-none group-hover:bg-[var(--card-hover-bg)]'
        }`}>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
          {uiDirective && (
            <div className={`mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between transition-all ${isUser ? 'border-white/20' : ''}`}>
               <span className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 ${isUser ? 'text-white/70' : 'text-indigo-500'}`}>
                 <Maximize2 className="w-3 h-3" />
                 Navigation Link Available
               </span>
               <div className={`px-2 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-tighter ${isUser ? 'bg-white/10 text-white' : 'bg-indigo-500/10 text-indigo-500'}`}>
                 Jump to {uiDirective.view.replace('_', ' ')}
               </div>
            </div>
          )}
        </div>
      )}

      {mutations && mutations.length > 0 && (
        <div className="mt-3 flex flex-col gap-2 w-full max-w-[85%]">
          {mutations.map((mut, idx) => (
            <div key={idx} className="flex items-center gap-3 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl animate-in zoom-in-95">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Zap className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-emerald-500 uppercase tracking-tight">AI Mutation Applied</p>
                <p className="text-xs text-[var(--muted-text)] truncate">
                  {mut.action === 'add' ? (
                    (mut.data as Record<string, unknown>).title ? `Added "${(mut.data as Record<string, unknown>).title}"` : 
                    (mut.data as Record<string, unknown>).topic ? (
                      <span className="flex items-center gap-1.5">
                        Added topic: <span className="font-bold text-[var(--header-text)]">{String((mut.data as Record<string, unknown>).topic)}</span>
                        {!!(mut.data as Record<string, unknown>).scouting_frequency && (
                          <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-[9px] font-black tracking-tighter">
                            { String((mut.data as Record<string, unknown>).scouting_frequency) } Pulse
                          </span>
                        )}
                      </span>
                    ) : 
                    'Added new item'
                  ) : 
                   mut.action === 'remove' ? `Removed item` : 
                   mut.action === 'update' ? `Updated dashboard data` : 'Modified state'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
