'use client';

import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Brain } from 'lucide-react';
import IntelligenceOverlay from './IntelligenceOverlay';
import SettingsModal from './SettingsModal';
import OnboardingView from './OnboardingView';
import AgentChatPanel from './AgentChatPanel';
import { useDashboardState } from './useDashboardState';
import { DashboardProvider } from './DashboardContext';

interface DashboardClientWrapperProps {
  userId: string;
  initialData: { plan?: any[], insights?: any, goals?: any };
  initialSettings: { theme: string; ai_provider: string; ai_api_key: string };
  hasPreferences: boolean;
  children: React.ReactNode;
}

export default function DashboardClientWrapper({ 
  userId, 
  initialData,
  initialSettings, 
  hasPreferences, 
  children 
}: DashboardClientWrapperProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [showAgentChat, setShowAgentChat] = useState(true); // Open by default
  const [showOnboarding, setShowOnboarding] = useState(!hasPreferences);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const dashboardState = useDashboardState(initialData);
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
    <DashboardProvider value={dashboardState}>
      <div className={`h-screen flex flex-col bg-[var(--background)] overflow-hidden ${theme === 'dark' ? 'dark' : ''}`}>
        {/* Unified Layout Container */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
          
          {/* LEFT: Neural Command Workspace (Persistent 40% on Desktop) */}
          <div className={`w-full lg:w-[40%] h-full flex flex-col overflow-hidden transition-all duration-500 ease-in-out border-r border-[var(--card-border)] ${
            showAgentChat ? 'translate-x-0' : 'hidden lg:flex'
          }`}>
             <AgentChatPanel 
               isOpen={showAgentChat} 
               onClose={() => setShowAgentChat(false)} 
               userId={userId} 
             />
          </div>

          {/* RIGHT: Dashboard Hub (60% on Desktop) */}
          <div className="lg:w-[60%] flex-1 h-full overflow-y-auto bg-[var(--background)] relative custom-scrollbar">
            {/* Background gradients confined to the content area */}
            <div className="absolute top-0 right-0 w-[60%] h-[40%] bg-indigo-600/[0.05] blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[40%] h-[40%] bg-violet-600/[0.05] blur-[100px] rounded-full pointer-events-none" />
            
            <div className="relative z-10">
              {children}
            </div>

            {/* Mobile Settings Trigger */}
            <div className="fixed top-6 right-6 z-[170] hidden lg:block">
               <button 
                 onClick={() => setShowSettings(true)}
                 className="p-3 bg-white/10 hover:bg-white/20 dark:bg-slate-900/50 dark:hover:bg-slate-800 backdrop-blur-xl border border-white/20 dark:border-slate-800 rounded-2xl transition-all shadow-xl group"
               >
                 <SettingsIcon className="w-5 h-5 text-slate-700 dark:text-slate-400 group-hover:rotate-90 transition-transform duration-500" />
               </button>
            </div>
          </div>
        </div>

        {/* Mobile-Only Restoration Toggle */}
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
