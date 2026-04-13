'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { Send, Sparkles, User as UserIcon, Settings } from 'lucide-react';
import AgentMessage from './AgentMessage';
import { useDashboard, WeeklyPlanItem, DashboardMutation } from './DashboardContext';
import LogoutButton from './LogoutButton';

interface AgentChatPanelProps {
  isOpen: boolean;
  userId: string;
  user: { email: string | undefined; full_name: string; avatar_url?: string };
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  thinkingTitle?: string;
  thinkingSteps?: string[];
  mutations?: DashboardMutation[];
  discoveries?: WeeklyPlanItem[];
  promotion?: { topic: string; target: string };
  uiDirective?: { view: string; data?: Record<string, unknown> };
  pendingToolCalls?: { id: string; name: string; args: any }[];
  toolApprovalStatus?: 'pending' | 'approved' | 'rejected';
}

export default function AgentChatPanel({ isOpen, userId, user }: AgentChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentThinkingTitle, setCurrentThinkingTitle] = useState('');
  const [currentThinkingSteps, setCurrentThinkingSteps] = useState<string[]>([]);
  const [currentResponse, setCurrentResponse] = useState('');
  const [currentMutations, setCurrentMutations] = useState<DashboardMutation[]>([]);
  const [currentDiscoveries, setCurrentDiscoveries] = useState<WeeklyPlanItem[]>([]);
  const [currentUiDirective, setCurrentUiDirective] = useState<{ view: string; data?: Record<string, unknown> } | undefined>(undefined);
  const [currentPendingToolCalls, setCurrentPendingToolCalls] = useState<{ id: string; name: string; args: any }[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { applyMutation, setActiveView, setViewData, onOpenSettings, activeView } = useDashboard();

  const handleSend = useCallback(async (e?: React.FormEvent, overridePrompt?: string, promotionMetadata?: { topic: string; target: string }) => {
    if (e) e.preventDefault();
    const userPrompt = overridePrompt || input;
    if (!userPrompt.trim() || isStreaming) return;
    
    const userMsg: ChatMessage = { 
      role: 'user', 
      content: userPrompt,
      promotion: promotionMetadata
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsStreaming(true);
    setCurrentResponse('');
    setCurrentThinkingSteps([]);
    setCurrentMutations([]);
    setCurrentDiscoveries([]);
    let accumulatedResponse = '';
    let accumulatedThinkingSteps: string[] = [];
    let accumulatedMutations: DashboardMutation[] = [];
    let accumulatedDiscoveries: WeeklyPlanItem[] = [];
    let accumulatedUiDirective: { view: string; data?: Record<string, unknown> } | undefined = undefined;
    let accumulatedPendingToolCalls: { id: string; name: string; args: any }[] = [];
    setCurrentPendingToolCalls([]);
    try {
      let apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      if (apiUrl && !apiUrl.startsWith('http')) apiUrl = `https://${apiUrl}`;
      const response = await fetch(`${apiUrl}/api/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userPrompt, user_id: userId })
      });
      if (!response.body) return;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value);
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.substring(6));
              if (event.type === 'response') {
                accumulatedResponse += event.content;
                setCurrentResponse(accumulatedResponse);
                
                // If we are currently in the LinkedIn Composer view, sync the draft live
                // Use a functional update logic or check current state
                if (accumulatedUiDirective?.view === 'linkedin_composer' || activeView === 'linkedin_composer') {
                   setViewData((prev: Record<string, unknown> | null) => ({ ...prev, draft: accumulatedResponse }));
                }
              } else if (event.type === 'thinking_title') {
                setCurrentThinkingTitle(event.content);
              } else if (event.type === 'thinking') {
                if (!accumulatedThinkingSteps.includes(event.content)) {
                  accumulatedThinkingSteps = [...accumulatedThinkingSteps, event.content];
                  setCurrentThinkingSteps(accumulatedThinkingSteps);
                }
              } else if (event.type === 'mutation') {
                applyMutation(event.data);
                accumulatedMutations = [...accumulatedMutations, event.data];
                setCurrentMutations(accumulatedMutations);
              } else if (event.type === 'ui_directive') {
                accumulatedUiDirective = { view: event.view, data: event.data };
                setCurrentUiDirective(accumulatedUiDirective);
                setActiveView(event.view);
                setViewData(event.data);
              } else if (event.type === 'discoveries') {
                accumulatedDiscoveries = [...accumulatedDiscoveries, ...event.data];
                setCurrentDiscoveries(accumulatedDiscoveries);
              } else if (event.type === 'approval_required') {
                accumulatedPendingToolCalls = event.tool_calls;
                setCurrentPendingToolCalls(accumulatedPendingToolCalls);
              }
            } catch (err) {
              console.error("Error parsing SSE event", err);
            }
          }
        }
      }
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: accumulatedResponse,
        thinkingTitle: currentThinkingTitle,
        thinkingSteps: accumulatedThinkingSteps,
        mutations: accumulatedMutations,
        discoveries: accumulatedDiscoveries,
        uiDirective: accumulatedUiDirective,
        pendingToolCalls: accumulatedPendingToolCalls,
        toolApprovalStatus: accumulatedPendingToolCalls.length > 0 ? 'pending' : undefined
      }]);
      setCurrentResponse('');
      setCurrentThinkingTitle('');
      setCurrentThinkingSteps([]);
      setCurrentMutations([]);
      setCurrentDiscoveries([]);
      setCurrentUiDirective(undefined);
      setCurrentPendingToolCalls([]);
    } catch (err) {
      console.error("Chat error", err);
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, userId, activeView, setActiveView, setViewData, applyMutation]);

  const handleResume = useCallback(async (msgIdx: number, action: 'approve' | 'reject') => {
    if (isStreaming) return;
    
    // Optimistically update status
    const status = action === 'approve' ? 'approved' : 'rejected';
    setMessages(prev => prev.map((msg, i) => i === msgIdx ? { ...msg, toolApprovalStatus: status } : msg));
    
    setIsStreaming(true);
    let accumulatedResponse = '';
    let accumulatedThinkingSteps: string[] = [];
    let accumulatedMutations: DashboardMutation[] = [];
    let accumulatedDiscoveries: WeeklyPlanItem[] = [];
    let accumulatedUiDirective: { view: string; data?: Record<string, unknown> } | undefined = undefined;
    let accumulatedPendingToolCalls: { id: string; name: string; args: any }[] = [];
    try {
      let apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      if (apiUrl && !apiUrl.startsWith('http')) apiUrl = `https://${apiUrl}`;
      const response = await fetch(`${apiUrl}/api/agent/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, action })
      });
      if (!response.body) return;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value);
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.substring(6));
              if (event.type === 'response') {
                accumulatedResponse += event.content;
                setCurrentResponse(accumulatedResponse);
              } else if (event.type === 'thinking_title') {
                setCurrentThinkingTitle(event.content);
              } else if (event.type === 'thinking') {
                if (!accumulatedThinkingSteps.includes(event.content)) {
                  accumulatedThinkingSteps = [...accumulatedThinkingSteps, event.content];
                  setCurrentThinkingSteps(accumulatedThinkingSteps);
                }
              } else if (event.type === 'mutation') {
                applyMutation(event.data);
                accumulatedMutations = [...accumulatedMutations, event.data];
                setCurrentMutations(accumulatedMutations);
              } else if (event.type === 'ui_directive') {
                accumulatedUiDirective = { view: event.view, data: event.data };
                setCurrentUiDirective(accumulatedUiDirective);
                setActiveView(event.view);
                setViewData(event.data);
              } else if (event.type === 'discoveries') {
                accumulatedDiscoveries = [...accumulatedDiscoveries, ...event.data];
                setCurrentDiscoveries(accumulatedDiscoveries);
              } else if (event.type === 'approval_required') {
                accumulatedPendingToolCalls = event.tool_calls;
                setCurrentPendingToolCalls(accumulatedPendingToolCalls);
              }
            } catch (err) {}
          }
        }
      }
      // Depending on whether we already had text in the original message, we append a new message for the resumed chunk
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: accumulatedResponse,
        thinkingTitle: currentThinkingTitle,
        thinkingSteps: accumulatedThinkingSteps,
        mutations: accumulatedMutations,
        discoveries: accumulatedDiscoveries,
        uiDirective: accumulatedUiDirective,
        pendingToolCalls: accumulatedPendingToolCalls,
        toolApprovalStatus: accumulatedPendingToolCalls.length ? 'pending' : undefined
      }]);
      setCurrentResponse('');
      setCurrentThinkingTitle('');
      setCurrentThinkingSteps([]);
      setCurrentMutations([]);
      setCurrentDiscoveries([]);
      setCurrentUiDirective(undefined);
      setCurrentPendingToolCalls([]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsStreaming(false);
    }
  }, [isStreaming, userId, setActiveView, setViewData, applyMutation]);

  // Listen for skill handoffs
  useEffect(() => {
    const handleLinkedInPromote = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const { topic, context, reasoning } = detail;
      const prompt = `I want to promote a discovery to LinkedIn. 
Topic: ${topic}
Context: ${context}
AI Reasoning: ${reasoning}

Please draft a high-impact LinkedIn post about this for my network. Start a thought leadership draft.`;
      
      // Proactively switch view so the user sees the workspace being prepared
      setActiveView('linkedin_composer');
      setViewData({ topic, context, reasoning });
      
      handleSend(undefined, prompt, { topic, target: 'LinkedIn' });
    };

    window.addEventListener('cadence:promote_to_linkedin', handleLinkedInPromote);
    return () => window.removeEventListener('cadence:promote_to_linkedin', handleLinkedInPromote);
  }, [setActiveView, setViewData, handleSend]);

  useEffect(() => {
    const handleAddToSchedule = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const { title, date, time } = detail;
      const prompt = `Add this event to my schedule:
Title: ${title}
Timing: ${date} ${time || ''}

Please analyze where this fits best in my current plan.`;
      
      handleSend(undefined, prompt);
    };

    window.addEventListener('cadence:add_to_schedule', handleAddToSchedule);
    return () => window.removeEventListener('cadence:add_to_schedule', handleAddToSchedule);
  }, [handleSend]);

  useEffect(() => {
    if (chatEndRef.current) {
        chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, currentResponse, currentThinkingSteps]);

  return (
    <div className={`h-full bg-[var(--background)] lg:border-r border-[var(--card-border)] flex flex-col relative transition-all duration-500 overflow-hidden ${
      !isOpen ? 'lg:flex hidden' : 'fixed inset-0 lg:relative z-[160] lg:z-0 lg:flex'
    }`}>
      {/* Header - Ultra-Minimalist Branded Identity */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--card-border)] bg-[var(--background)]/80 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-4">
          <Image 
            src="/logo.png" 
            alt="Cadence Logo" 
            width={72} 
            height={24} 
            className="h-6 w-auto object-contain brightness-110" 
            priority
          />
          <h2 className="text-[11px] font-black text-[var(--header-text)] uppercase tracking-[0.4em] opacity-60">Cadence AI</h2>
        </div>
        
        <div className="flex items-center gap-4">
           {/* User Profile minimalist view */}
           <div className="hidden sm:flex items-center gap-3 pr-2 border-r border-[var(--card-border)]">
              <div className="flex flex-col items-end min-w-0">
                 <span className="text-[10px] font-black text-[var(--header-text)] italic leading-none truncate max-w-[100px]">{user.full_name}</span>
              </div>
              <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center border border-indigo-500/20 shadow-sm shadow-indigo-500/5 bg-indigo-500/10 relative">
                 {user.avatar_url ? (
                    <Image src={user.avatar_url} alt={user.full_name} fill className="object-cover" />
                 ) : (
                    <UserIcon className="w-4 h-4 text-indigo-500" />
                 )}
              </div>
           </div>
           
           <button 
             onClick={onOpenSettings}
             className="p-2 text-[var(--muted-text)] hover:text-indigo-500 transition-colors group"
             title="System Settings"
           >
             <Settings className="w-4 h-4 group-hover:rotate-90 transition-transform duration-500" />
           </button>
           
           <LogoutButton />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 scroll-smooth custom-scrollbar">
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-10 animate-in fade-in zoom-in-95 duration-1000">
            <div className="space-y-3 pb-4">
              <h3 className="text-xl font-black text-[var(--header-text)] italic tracking-tight uppercase">Cadence AI</h3>
              <p className="text-[9px] text-[var(--muted-text)] max-w-[240px] uppercase font-bold tracking-[0.2em] leading-relaxed opacity-40">
                Strategic Intelligence & Schedule Optimization
              </p>
            </div>
            <div className="flex flex-col gap-2.5 w-full max-w-[280px]">
               <button onClick={() => setInput("Optimize my schedule")} className="group flex items-center justify-between px-5 py-4 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-indigo-500 hover:border-indigo-500/30 transition-all hover:bg-indigo-500/[0.02]">
                  <span>Analyze current plan</span>
                  <Sparkles className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
               </button>
               <button onClick={() => setInput("Scout for local events")} className="group flex items-center justify-between px-5 py-4 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-indigo-500 hover:border-indigo-500/30 transition-all hover:bg-indigo-500/[0.02]">
                  <span>Scout nearby events</span>
                  <Sparkles className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
               </button>
            </div>
          </div>
        )}

        {messages.map((m, idx) => (
          <AgentMessage key={idx} {...m} onResume={(action) => handleResume(idx, action)} />
        ))}

        {isStreaming && (currentResponse || currentThinkingSteps.length > 0 || currentDiscoveries.length > 0 || currentPendingToolCalls.length > 0) && (
          <AgentMessage 
            role="assistant" 
            content={currentResponse} 
            thinkingTitle={currentThinkingTitle}
            thinkingSteps={currentThinkingSteps}
            mutations={currentMutations}
            discoveries={currentDiscoveries}
            uiDirective={currentUiDirective}
            pendingToolCalls={currentPendingToolCalls}
            toolApprovalStatus={currentPendingToolCalls.length > 0 ? 'pending' : undefined}
          />
        )}
        
        <div ref={chatEndRef} />
      </div>

      {/* Input - Modernized Minimal Bar */}
      <div className="p-6 border-t border-[var(--card-border)] bg-[var(--background)]/50 backdrop-blur-xl shrink-0">
        <form onSubmit={handleSend} className="relative group max-w-2xl mx-auto w-full">
          <input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isStreaming}
            placeholder="Instruct the agent..."
            className="w-full bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl py-4 pl-6 pr-14 text-sm text-[var(--header-text)] shadow-lg shadow-black/5 dark:shadow-none outline-none focus:border-indigo-500/50 transition-all"
          />
          <button 
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white rounded-xl transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
