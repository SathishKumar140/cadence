'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Send, Sparkles } from 'lucide-react';
import AgentMessage from './AgentMessage';
import { useDashboard, WeeklyPlanItem, DashboardMutation } from './DashboardContext';

interface AgentChatPanelProps {
  isOpen: boolean;
  userId: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  thinkingSteps?: string[];
  mutations?: DashboardMutation[];
  discoveries?: WeeklyPlanItem[];
}

export default function AgentChatPanel({ isOpen, userId }: AgentChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentThinkingSteps, setCurrentThinkingSteps] = useState<string[]>([]);
  const [currentResponse, setCurrentResponse] = useState('');
  const [currentMutations, setCurrentMutations] = useState<DashboardMutation[]>([]);
  const [currentDiscoveries, setCurrentDiscoveries] = useState<WeeklyPlanItem[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
    const { applyMutation, setActiveView, setViewData } = useDashboard();

  useEffect(() => {
    if (chatEndRef.current) {
        chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, currentResponse, currentThinkingSteps]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isStreaming) return;
    const userMsg: ChatMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    const userPrompt = input;
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
                // Prevent flicker: only update if the view is changing or if the data is significantly different
                // In a production app, we'd use a deep compare here.
                setActiveView(event.view);
                setViewData(event.data);
              } else if (event.type === 'discoveries') {
                accumulatedDiscoveries = [...accumulatedDiscoveries, ...event.data];
                setCurrentDiscoveries(accumulatedDiscoveries);
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
        thinkingSteps: accumulatedThinkingSteps,
        mutations: accumulatedMutations,
        discoveries: accumulatedDiscoveries
      }]);
      setCurrentResponse('');
      setCurrentThinkingSteps([]);
      setCurrentMutations([]);
      setCurrentDiscoveries([]);
    } catch (err) {
      console.error("Chat error", err);
    } finally {
      setIsStreaming(false);
    }
  };

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
          <AgentMessage key={idx} {...m} />
        ))}

        {isStreaming && (currentResponse || currentThinkingSteps.length > 0 || currentDiscoveries.length > 0) && (
          <AgentMessage 
            role="assistant" 
            content={currentResponse} 
            thinkingSteps={currentThinkingSteps}
            mutations={currentMutations}
            discoveries={currentDiscoveries}
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
