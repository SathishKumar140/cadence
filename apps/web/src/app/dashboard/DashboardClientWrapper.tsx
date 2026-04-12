'use client';

import React, { useState, useEffect } from 'react';
import { Brain, Calendar, ImagePlus, Shield, Target, Zap } from 'lucide-react';
import IntelligenceOverlay from './IntelligenceOverlay';
import SettingsModal from './SettingsModal';
import OnboardingView from './OnboardingView';
import AgentChatPanel from './AgentChatPanel';
import { useDashboardState } from './useDashboardState';
import { DashboardProvider, WeeklyPlanItem, DashboardInsights, DashboardGoals, Routine, Goal, ScheduledEmail } from './DashboardContext';
import DynamicViewCanvas from './DynamicViewCanvas';

interface DashboardClientWrapperProps {
  userId: string;
  user: { email: string | undefined; full_name: string; avatar_url?: string };
  initialData: { 
    plan?: WeeklyPlanItem[], 
    insights?: DashboardInsights, 
    goals?: DashboardGoals,
    routines?: Routine[],
    activeGoals?: Goal[],
    emails?: ScheduledEmail[]
  };
  initialSettings: { theme: string; ai_provider: string; ai_api_key: string };
  initialAccessToken: string;
  hasPreferences: boolean;
}

export default function DashboardClientWrapper({ 
  userId, 
  user,
  initialData,
  initialSettings,
  initialAccessToken,
  hasPreferences
}: DashboardClientWrapperProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [showAgentChat, setShowAgentChat] = useState(true); // Open by default
  const [showOnboarding, setShowOnboarding] = useState(!hasPreferences);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const dashboardState = useDashboardState({
    userId,
    accessToken: initialAccessToken,
    ...initialData
  });
  const { activeView, setActiveView } = dashboardState;
  const [theme] = useState(initialSettings.theme);

  useEffect(() => {
    if (!document.cookie.includes('theme=')) {
      document.cookie = `theme=${theme}; path=/; max-age=31536000; SameSite=Lax`;
    }
    document.documentElement.className = theme;
  }, [theme]);

  useEffect(() => {
    const handleStart = () => setIsRegenerating(true);
    const handleEnd = () => setIsRegenerating(false);
    window.addEventListener('regen-start', handleStart);
    window.addEventListener('regen-end', handleEnd);
    return () => {
      window.removeEventListener('regen-start', handleStart);
      window.removeEventListener('regen-end', handleEnd);
    };
  }, []);

  return (
    <DashboardProvider value={{ ...dashboardState, onOpenSettings: () => setShowSettings(true) }}>
      <div className={`h-screen flex flex-col bg-[var(--background)] overflow-hidden ${theme === 'dark' ? 'dark' : ''}`}>
        {/* Unified Layout Container */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
          
          {/* LEFT: Neural Command Workspace (Persistent 40% on Desktop) */}
          <div className={`w-full lg:w-[40%] h-full flex flex-col overflow-hidden transition-all duration-500 ease-in-out border-r border-[var(--card-border)] ${
            showAgentChat ? 'translate-x-0' : 'hidden lg:flex'
          }`}>
             <AgentChatPanel 
               isOpen={showAgentChat} 
               userId={userId} 
               user={user}
             />
          </div>

          {/* RIGHT: Dashboard Hub (60% on Desktop) - Now Dynamic */}
          <div className="lg:w-[60%] flex-1 h-full overflow-y-auto bg-[var(--background)] relative custom-scrollbar">
            {/* Background gradients confined to the content area */}
            <div className="absolute top-0 right-0 w-[60%] h-[40%] bg-indigo-600/[0.05] blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[40%] h-[40%] bg-violet-600/[0.05] blur-[100px] rounded-full pointer-events-none" />
            
            <div className="relative z-10 w-full h-full">
              <DynamicViewCanvas />
              {/* Optional: we could keep {children} for static pieces, but the design calls for a total swap. */}
            </div>

            {/* View Switching Sidebar (Collapsed manual navigation) */}
            <div className="fixed top-1/2 -translate-y-1/2 right-4 z-[100] flex flex-col gap-2 scale-75 opacity-20 hover:opacity-100 transition-opacity">
               {['schedule', 'linkedin_composer', 'routine_dashboard', 'goal_editor', 'knowledge_hub', 'discovery_feed'].map((v) => (
                 <div key={v} className="relative group">
                   <button 
                     onClick={() => setActiveView(v)}
                     className={`w-10 h-10 rounded-xl transition-all duration-500 flex items-center justify-center relative ${
                       activeView === v 
                         ? 'bg-indigo-600 shadow-[0_4px_20px_rgba(79,70,229,0.3)] scale-110 rotate-3' 
                         : 'text-slate-400 dark:text-zinc-600 hover:text-indigo-500 hover:bg-indigo-500/5'
                     }`}
                   >
                     {v === 'schedule' && <Calendar className="w-5 h-5" />}
                     {v === 'linkedin_composer' && <ImagePlus className="w-5 h-5" />}
                     {v === 'routine_dashboard' && <Shield className="w-5 h-5" />}
                     {v === 'goal_editor' && <Target className="w-5 h-5" />}
                     {v === 'knowledge_hub' && <Brain className="w-5 h-5" />}
                     {v === 'discovery_feed' && <Zap className="w-5 h-5" />}
                     
                     {activeView === v && (
                       <span className="absolute -left-1 top-1.5 bottom-1.5 w-0.5 bg-white rounded-full animate-in fade-in zoom-in duration-500" />
                     )}
                   </button>
                   {/* Modern Tooltip */}
                   <span className="absolute left-full ml-4 px-3 py-1.5 bg-slate-900 text-white text-[10px] font-black tracking-widest uppercase rounded-lg opacity-0 group-hover:opacity-100 transition-all pointer-events-none translate-x-[-10px] group-hover:translate-x-0 z-[100] whitespace-nowrap shadow-xl border border-white/10">
                      {v === 'discovery_feed' ? 'Discovery Feed' : v.replace('_', ' ')}
                   </span>
                 </div>
               ))}
            </div>

          </div>
        </div>

        {/* ... mobile toggle, overlay, etc ... */}
        {!showAgentChat && (
          <div className="fixed bottom-6 left-6 z-[155] lg:hidden">
            <button 
              onClick={() => setShowAgentChat(true)}
              className="p-4 bg-indigo-600 text-white rounded-[2rem] shadow-2xl shadow-indigo-600/40"
            >
              <Brain className="w-6 h-6" />
            </button>
          </div>
        )}

        {isRegenerating && <IntelligenceOverlay />}

        {showOnboarding && (
          <OnboardingView 
            userId={userId} 
            onComplete={() => {
              setShowOnboarding(false);
              window.location.reload();
            }} 
          />
        )}

        <SettingsModal 
          userId={userId} 
          isOpen={showSettings} 
          onClose={() => {
            setShowSettings(false);
            window.location.reload(); 
          }} 
        />
      </div>
    </DashboardProvider>
  );
}
