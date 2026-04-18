import { useState } from 'react';
import { Brain, ChevronDown, Zap, Maximize2, Calendar, Clock } from 'lucide-react';
import { DashboardMutation, WeeklyPlanItem, useDashboard } from './DashboardContext';
import TacticalPulse, { MetricPoint } from './TacticalPulse';

interface AgentMessageProps {
  role: 'user' | 'assistant';
  content: string;
  thinkingTitle?: string;
  thinking?: string;
  thinkingSteps?: string[];
  mutations?: DashboardMutation[];
  discoveries?: WeeklyPlanItem[];
  promotion?: { topic: string; target: string };
  uiDirective?: { view: string; data?: Record<string, unknown> };
  metrics?: {
    type: 'line' | 'bar';
    title: string;
    data: MetricPoint[];
  };
  pendingToolCalls?: { id: string; name: string; args: Record<string, unknown> }[];
  toolApprovalStatus?: 'pending' | 'approved' | 'rejected';
  onResume?: (action: 'approve' | 'reject') => void;
}

const TacticalTable = ({ rows }: { rows: string[] }) => {
  if (rows.length < 2) return null;
  
  // Extract header and body
  const headerRow = rows[0];
  const bodyRows = rows.slice(2);
  
  const parseRow = (row: string) => {
    // Split by |, but avoid empty strings from the start/end pipes
    const cells = row.split('|');
    if (row.startsWith('|')) cells.shift();
    if (row.endsWith('|')) cells.pop();
    return cells.map(cell => cell.trim());
  };

  const headers = parseRow(headerRow);
  const data = bodyRows.map(parseRow);

  return (
    <div className="my-[20px] overflow-hidden rounded-2xl border border-indigo-500/10 bg-black/5 dark:bg-white/5 backdrop-blur-sm shadow-xl">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-indigo-500/5 border-b border-indigo-500/10">
            {headers.map((header, i) => (
              <th key={i} className="px-5 py-4 text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">
                {parseInline(header)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-indigo-500/5">
          {data.map((row, i) => (
            <tr key={i} className="hover:bg-indigo-500/[0.02] transition-colors">
              {row.map((cell, j) => (
                <td key={j} className="px-5 py-4 text-[12px] font-medium text-[var(--header-text)]">
                  {parseInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const MarkdownText = ({ text }: { text: string }) => {
  if (!text) return null;
  
  const lines = text.split('\n');
  const renderedElements: React.ReactNode[] = [];
  let currentTableRows: string[] = [];

  const flushTable = (key: number) => {
    if (currentTableRows.length > 0) {
      renderedElements.push(<TacticalTable key={`table-${key}`} rows={[...currentTableRows]} />);
      currentTableRows = [];
    }
  };

  lines.forEach((line, i) => {
    const trimmedLine = line.trim();
    const isTableLine = trimmedLine.startsWith('|') && trimmedLine.endsWith('|');

    if (isTableLine) {
      currentTableRows.push(trimmedLine);
    } else {
      flushTable(i);
      
      // H3 Header
      if (trimmedLine.startsWith('### ')) {
        renderedElements.push(<h3 key={i} className="text-[14px] font-black text-[var(--header-text)] uppercase tracking-tight italic mt-4 mb-2">{parseInline(trimmedLine.substring(4))}</h3>);
      }
      // H2 Header
      else if (trimmedLine.startsWith('## ')) {
        renderedElements.push(<h2 key={i} className="text-[16px] font-black text-[var(--header-text)] uppercase tracking-tight italic mt-6 mb-3 border-b border-indigo-500/10 pb-1">{parseInline(trimmedLine.substring(3))}</h2>);
      }
      // H1 Header
      else if (trimmedLine.startsWith('# ')) {
        renderedElements.push(<h1 key={i} className="text-[18px] font-black text-indigo-500 uppercase tracking-tighter italic mt-8 mb-4">{parseInline(trimmedLine.substring(2))}</h1>);
      }
      // Bulleted lists
      else if (trimmedLine.startsWith('* ') || trimmedLine.startsWith('- ')) {
        renderedElements.push(
          <div key={i} className="flex gap-2 pl-2">
            <span className="text-indigo-500 font-bold">•</span>
            <span className="flex-1">{parseInline(trimmedLine.substring(2))}</span>
          </div>
        );
      }
      // Horizontal rule
      else if (trimmedLine === '---') {
        renderedElements.push(<hr key={i} className="my-4 border-[var(--card-border)] opacity-30" />);
      }
      // Blank lines
      else if (trimmedLine === '') {
        renderedElements.push(<div key={i} className="h-1" />);
      }
      // Normal line
      else {
        renderedElements.push(<div key={i} className="leading-relaxed">{parseInline(line)}</div>);
      }
    }
  });

  flushTable(lines.length);

  return (
    <div className="space-y-1.5">
      {renderedElements}
    </div>
  );
};

const parseInline = (text: string) => {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-black text-[var(--header-text)]">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i} className="italic text-indigo-500">{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-indigo-500 font-mono text-[11px]">{part.slice(1, -1)}</code>;
    }
    return part;
  });
};
;

export default function AgentMessage({ role, content, thinkingTitle, thinking, thinkingSteps, mutations, discoveries, promotion, uiDirective, metrics, pendingToolCalls, toolApprovalStatus, onResume }: AgentMessageProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isToolsExpanded, setIsToolsExpanded] = useState(false);
  const { setActiveView, setViewData, activeView } = useDashboard();
  const isUser = role === 'user';
  const allThinking = thinkingSteps || (thinking ? [thinking] : []);
  
  // Logic to determine if the thinking process has concluded and should revert to the standard header
  const isThinkingResolved = !!(content || (discoveries && discoveries.length > 0));
  const isRedundantNav = uiDirective?.view === activeView;

  const handleNavigate = () => {
    if (uiDirective) {
      setActiveView(uiDirective.view);
      if (uiDirective.data) {
        setViewData(uiDirective.data);
      }
    }
  };

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} mb-1.5 group w-full`}>
      {allThinking.length > 0 && !isUser && !isThinkingResolved && (
        <div className="w-full max-w-[90%] mb-2 px-1 opacity-60 hover:opacity-100 transition-opacity">
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all group ${
              isExpanded 
                ? 'bg-indigo-500/[0.05] border-indigo-500/20 shadow-sm' 
                : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-zinc-900/50'
            }`}
          >
            <div className={`p-1 rounded-md transition-colors ${isExpanded ? 'bg-indigo-500/10' : 'bg-transparent group-hover:bg-indigo-500/10'}`}>
              <Brain className={`w-3.5 h-3.5 ${isThinkingResolved ? 'text-indigo-400' : 'text-indigo-500 animate-pulse'}`} />
            </div>
            <span className="text-[10px] font-black text-indigo-500/60 uppercase tracking-widest flex items-center gap-2">
              {(() => {
                if (!thinkingTitle) return "Thought Process";
                if (!isThinkingResolved) return thinkingTitle;
                
                // Transform to "Resolved" state title
                if (thinkingTitle.startsWith("SYNCHRONIZING ")) return thinkingTitle.replace("SYNCHRONIZING ", "") + " SYNCHRONIZED";
                if (thinkingTitle.startsWith("CALIBRATING ")) return thinkingTitle.replace("CALIBRATING ", "") + " CALIBRATED";
                if (thinkingTitle.startsWith("MAPPING ")) return thinkingTitle.replace("MAPPING ", "") + " MAPPED";
                if (thinkingTitle.startsWith("HARVESTING ")) return thinkingTitle.replace("HARVESTING ", "") + " HARVESTED";
                if (thinkingTitle.startsWith("ANALYZING ")) return thinkingTitle.replace("ANALYZING ", "") + " ANALYZED";
                if (thinkingTitle.startsWith("RESOLVING ")) return thinkingTitle.replace("RESOLVING ", "") + " RESOLVED";
                if (thinkingTitle.startsWith("RECONSTRUCTING ")) return thinkingTitle.replace("RECONSTRUCTING ", "") + " RECONSTRUCTED";
                if (thinkingTitle.startsWith("RETRIEVING ")) return thinkingTitle.replace("RETRIEVING ", "") + " RETRIEVED";
                if (thinkingTitle.startsWith("SYNTHESIZING ")) return thinkingTitle.replace("SYNTHESIZING ", "") + " SYNTHESIZED";
                
                return thinkingTitle + " COMPLETE";
              })()}
              <ChevronDown className={`w-3 h-3 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
            </span>
          </button>

          {isExpanded && (
            <div className="mt-2 pl-4 border-l border-indigo-500/20 animate-in slide-in-from-top-2 duration-300">
               <div className="space-y-3 pt-2 pb-4 pr-4">
                {allThinking.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-3 animate-in fade-in duration-500 fill-mode-both" style={{ animationDelay: `${idx * 100}ms` }}>
                    <div className="mt-1 flex-shrink-0">
                      <div className="w-1 h-1 rounded-full bg-indigo-500/40" />
                    </div>
                    <span className="text-[11px] text-[var(--muted-text)] font-medium leading-normal tracking-wide italic">
                      {step}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {promotion ? (
        <div className={`w-full max-w-[90%] p-4 rounded-[1.5rem] shadow-lg relative transition-all duration-300 border ${
          isUser 
            ? 'bg-gradient-to-br from-indigo-600 to-violet-700 text-white border-white/10 rounded-tr-none' 
            : 'bg-[var(--card-bg)] text-[var(--header-text)] border-indigo-500/10 rounded-tl-none'
        }`}>
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center relative overflow-hidden flex-shrink-0">
                <Zap className="w-5 h-5 text-white animate-pulse" />
                <div className="absolute inset-0 bg-white/5 animate-ping opacity-20" />
             </div>
             <div className="flex-1 min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[0.15em] opacity-60 mb-0.5">Promotion Signal</p>
                <h4 className="text-[12px] font-bold tracking-tight leading-tight truncate">
                  Drafting {promotion.target}: <span className="italic font-normal">&quot;{promotion.topic}&quot;</span>
                </h4>
             </div>
          </div>
        </div>
      ) : content && (
        <div 
          onClick={uiDirective && !isRedundantNav ? handleNavigate : undefined}
          className={`max-w-[90%] px-5 py-4 rounded-[1.2rem] shadow-sm relative transition-all duration-300 border ${
            uiDirective && !isRedundantNav ? 'cursor-pointer hover:ring-2 hover:ring-indigo-500/10 hover:shadow-lg' : ''
          } ${
          isUser 
            ? 'bg-indigo-600 text-white rounded-tr-none border-white/10' 
            : 'bg-[var(--card-bg)] text-[var(--header-text)] border-[var(--card-border)] backdrop-blur-xl rounded-tl-none group-hover:bg-[var(--card-hover-bg)]'
        }`}>
          <div className="text-[13px] leading-relaxed font-medium">
             <MarkdownText text={content} />
          </div>
          
          {metrics && (
             <TacticalPulse 
               data={metrics.data} 
               type={metrics.type} 
               title={metrics.title} 
             />
          )}
          
          {uiDirective && !isRedundantNav && (
            <div className={`mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/50 flex items-center justify-between transition-all ${isUser ? 'border-white/10' : ''}`}>
               <div className="flex items-center gap-2">
                 <div className={`w-5 h-5 rounded-md flex items-center justify-center ${isUser ? 'bg-white/10' : 'bg-indigo-500/10 border border-indigo-500/20'}`}>
                    <Maximize2 className={`w-2.5 h-2.5 ${isUser ? 'text-white' : 'text-indigo-500'}`} />
                 </div>
                 <span className={`text-[8px] font-black uppercase tracking-wider ${isUser ? 'text-white/60' : 'text-zinc-500 dark:text-zinc-500'}`}>
                   Focus Scope: {uiDirective.view.replace('_', ' ')}
                 </span>
               </div>
               <div className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-tighter shadow-sm border ${
                 isUser ? 'bg-white/10 text-white border-white/20' : 'bg-indigo-600 text-white border-indigo-700 shadow-indigo-600/15 group-hover:scale-105 transition-transform'
               }`}>
                 Navigate
               </div>
            </div>
          )}
        </div>
      )}

      {toolApprovalStatus && pendingToolCalls && pendingToolCalls.length > 0 && (
        <div className="mt-1 flex flex-col gap-2 w-full max-w-[85%]">
            <div className={`p-3 rounded-[1.2rem] border transition-all animate-in zoom-in-95 ${
              toolApprovalStatus === 'pending' ? 'bg-amber-500/10 border-amber-500/20 shadow-sm shadow-amber-500/5' : 
              toolApprovalStatus === 'approved' ? 'bg-emerald-500/10 border-emerald-500/20' : 
              'bg-red-500/10 border-red-500/20'
            }`}>
               <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2">
                   <div className={`p-1 rounded-md ${
                      toolApprovalStatus === 'pending' ? 'bg-amber-500/20 text-amber-500' : 
                      toolApprovalStatus === 'approved' ? 'bg-emerald-500/20 text-emerald-500' : 
                      'bg-red-500/20 text-red-500'
                   }`}>
                     <Zap className="w-3 h-3" />
                   </div>
                   <h4 className={`text-[10px] font-black uppercase tracking-widest ${
                      toolApprovalStatus === 'pending' ? 'text-amber-500' : 
                      toolApprovalStatus === 'approved' ? 'text-emerald-500' : 
                      'text-red-500'
                   }`}>
                     {toolApprovalStatus === 'pending' ? 'System Action Required' : 
                      toolApprovalStatus === 'approved' ? 'Action Approved' : 
                      'Action Rejected'}
                   </h4>
                   
                   {/* Compact Summary for Approved/Rejected states */}
                   {toolApprovalStatus !== 'pending' && !isToolsExpanded && (
                     <span className="text-[10px] text-[var(--muted-text)] font-medium italic opacity-60">
                        — {pendingToolCalls.length} sequence{pendingToolCalls.length > 1 ? 's' : ''} executed
                     </span>
                   )}
                 </div>
                 
                 <div className="flex items-center gap-3">
                   {toolApprovalStatus === 'pending' && onResume && (
                     <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-right-2 duration-300">
                        <button 
                          onClick={(e) => { e.stopPropagation(); onResume('approve'); }}
                          className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] font-black uppercase tracking-widest transition-all shadow-md shadow-indigo-600/20"
                        >
                          Approve
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); onResume('reject'); }}
                          className="px-3 py-1 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-red-500/10 text-[var(--muted-text)] hover:text-red-500 text-[9px] font-black uppercase tracking-widest transition-all"
                        >
                          Dismiss
                        </button>
                     </div>
                   )}
                   <button 
                     onClick={() => setIsToolsExpanded(!isToolsExpanded)}
                     className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-md transition-colors"
                   >
                     <ChevronDown className={`w-3.5 h-3.5 text-[var(--muted-text)] transition-transform duration-300 ${isToolsExpanded ? 'rotate-180' : ''}`} />
                   </button>
                 </div>
               </div>
               
               {isToolsExpanded && (
                 <div className="mt-4 animate-in slide-in-from-top-2 duration-300">
                    {/* ... details move here ... */}
                   <div className="space-y-2 mb-4">
                     {pendingToolCalls.map((tc, idx) => {
                        const isScheduleItem = tc.name === 'add_plan_item';
                        
                        if (isScheduleItem) {
                          const args = tc.args as Record<string, string>;
                          const { title, day, time, reason, date } = args;
                          return (
                            <div key={idx} className="bg-[var(--card-bg)] border border-indigo-500/20 rounded-2xl p-4 shadow-sm">
                              <div className="flex items-start gap-4">
                                 <div className="w-12 h-12 rounded-xl bg-indigo-600/10 flex flex-col items-center justify-center text-indigo-600 border border-indigo-600/20 shrink-0">
                                    <Brain className="w-5 h-5 mb-0.5" />
                                    <span className="text-[7px] font-black uppercase tracking-tighter">
                                       {date ? date.split(' ')[0] : day?.substring(0, 3)}
                                    </span>
                                 </div>
                                 <div className="flex-1 min-w-0">
                                    <h5 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">Scheduling Suggestion</h5>
                                    <p className="text-sm font-bold text-[var(--header-text)] truncate mb-1">{title}</p>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                                       <div className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--muted-text)]">
                                          <Zap className="w-3 h-3 text-indigo-400" />
                                          {day}{date ? `, ${date}` : ''}
                                       </div>
                                       <div className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--muted-text)]">
                                          <Zap className="w-3 h-3 text-indigo-400" />
                                          {time}
                                       </div>
                                    </div>
                                 </div>
                              </div>
                              {reason && (
                                <div className="mt-3 pt-3 border-t border-indigo-500/10 text-[10px] text-[var(--muted-text)] italic leading-relaxed">
                                   &ldquo;{reason}&rdquo;
                                </div>
                              )}
                            </div>
                          );
                        }

                        return (
                          <div key={idx} className="text-xs bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-3">
                            <p className="font-bold text-[var(--header-text)] mb-1 font-mono">{tc.name}</p>
                            <pre className="text-[10px] text-[var(--muted-text)] whitespace-pre-wrap font-mono overflow-hidden">
                              {JSON.stringify(tc.args, null, 2)}
                            </pre>
                          </div>
                        );
                      })}
                   </div>

                   {/* All execution controls are now in the header */}
                 </div>
               )}
            </div>
        </div>
      )}

    </div>
  );
}
