'use client';

import { Brain, MapPin, ExternalLink, Zap } from 'lucide-react';

import { CheckCircle2 } from 'lucide-react';
import { DashboardMutation, WeeklyPlanItem } from './DashboardContext';

interface AgentMessageProps {
  role: 'user' | 'assistant';
  content: string;
  thinking?: string;
  thinkingSteps?: string[];
  mutations?: DashboardMutation[];
  discoveries?: WeeklyPlanItem[];
}

export default function AgentMessage({ role, content, thinking, thinkingSteps, mutations, discoveries }: AgentMessageProps) {
  const isUser = role === 'user';
  const allThinking = thinkingSteps || (thinking ? [thinking] : []);

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
            <span className="text-[11px] text-indigo-300 font-bold uppercase tracking-[0.15em] leading-none">
              Cognitive Reasoning Process
            </span>
          </div>
          <div className="space-y-2.5 pl-0.5 relative z-10">
            {allThinking.map((step, idx) => (
              <div key={idx} className="flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-500 fill-mode-both" style={{ animationDelay: `${idx * 150}ms` }}>
                <div className="mt-1">
                  <CheckCircle2 className="w-3 h-3 text-indigo-500/80 shadow-[0_0_8px_rgba(99,102,241,0.3)]" />
                </div>
                <span className="text-[12px] text-zinc-100 font-medium leading-normal tracking-wide transition-all">
                  {step}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {content && (
        <div className={`max-w-[85%] px-5 py-4 rounded-[2rem] shadow-sm relative transition-all duration-300 ${
          isUser 
            ? 'bg-indigo-600 text-white rounded-tr-none' 
            : 'bg-[var(--card-bg)] text-[var(--header-text)] border border-[var(--card-border)] backdrop-blur-xl rounded-tl-none group-hover:bg-[var(--card-hover-bg)]'
        }`}>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
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
                  {mut.action === 'add' ? `Added "${(mut.data as WeeklyPlanItem).title}"` : 
                   mut.action === 'remove' ? `Removed item` : 
                   mut.action === 'update' ? `Updated dashboard data` : 'Modified state'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {discoveries && discoveries.length > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-3 w-full">
          {discoveries.map((disco, idx) => (
            <a 
              key={idx} 
              href={disco.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-start gap-4 p-4 bg-[var(--background)] hover:bg-slate-50 dark:hover:bg-slate-900 border border-[var(--card-border)] rounded-3xl transition-all hover:scale-[1.01] hover:shadow-lg group/disco"
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-all group-hover/disco:rotate-3 ${
                disco.discovery_source === 'eventbrite' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' :
                disco.discovery_source === 'meetup' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                'bg-indigo-500/10 text-indigo-500 border-indigo-500/20'
              }`}>
                <span className="text-[10px] font-black uppercase text-center leading-none">
                  {disco.discovery_source?.substring(0, 2)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{disco.discovery_source}</span>
                  <ExternalLink className="w-3 h-3 text-slate-400 opacity-0 group-hover/disco:opacity-100 transition-opacity" />
                </div>
                <h4 className="text-xs font-bold text-[var(--header-text)] mb-1 line-clamp-1">{disco.title}</h4>
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  <MapPin className="w-3 h-3" />
                  <span className="truncate">{disco.location || "TBD"}</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
