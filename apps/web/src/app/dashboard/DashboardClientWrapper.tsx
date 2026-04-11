'use client';

import { useState, useEffect } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import IntelligenceOverlay from './IntelligenceOverlay';
import SettingsModal from './SettingsModal';
import OnboardingView from './OnboardingView';

interface DashboardClientWrapperProps {
  userId: string;
  initialSettings: { theme: string; ai_provider: string; ai_api_key: string };
  hasPreferences: boolean;
  children: React.ReactNode;
}

export default function DashboardClientWrapper({ 
  userId, 
  initialSettings, 
  hasPreferences, 
  children 
}: DashboardClientWrapperProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(!hasPreferences);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [theme, setTheme] = useState(initialSettings.theme);

  useEffect(() => {
    // Sync cookie on mount if missing
    if (!document.cookie.includes('theme=')) {
      document.cookie = `theme=${theme}; path=/; max-age=31536000; SameSite=Lax`;
    }
    // Apply class to root for tailwind 'dark' selector
    document.documentElement.className = theme;
  }, [theme]);

  // Listen for custom 'regenerate-start' and 'regenerate-end' events
  // that we'll dispatch from the RegenerateButton
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
    <div className={`min-h-screen overflow-x-hidden ${theme === 'dark' ? 'dark' : ''}`}>
      {/* Settings Trigger — desktop only (mobile gets it in the header) */}
        <div className="fixed top-6 right-6 z-50 hidden lg:block">
           <button 
             onClick={() => setShowSettings(true)}
             className="p-3 bg-white/10 hover:bg-white/20 dark:bg-slate-900/50 dark:hover:bg-slate-800 backdrop-blur-xl border border-white/20 dark:border-slate-800 rounded-2xl transition-all shadow-xl group"
           >
             <SettingsIcon className="w-5 h-5 text-slate-700 dark:text-slate-400 group-hover:rotate-90 transition-transform duration-500" />
           </button>
        </div>

        {/* Settings Trigger — mobile inline (rendered via event) */}
        <button 
          id="mobile-settings-trigger"
          onClick={() => setShowSettings(true)}
          className="hidden"
          aria-hidden="true"
        />

        {/* Intelligence Overlay during regeneration */}
        {isRegenerating && <IntelligenceOverlay />}

        {/* Onboarding Wizard for new users */}
        {showOnboarding && (
          <OnboardingView 
            userId={userId} 
            onComplete={() => {
              setShowOnboarding(false);
              // Trigger a refresh to show the newly generated plan
              window.location.reload();
            }} 
          />
        )}

        {/* Settings Modal */}
        <SettingsModal 
          userId={userId} 
          isOpen={showSettings} 
          onClose={() => {
            setShowSettings(false);
            // Refresh settings in case theme changed
            window.location.reload(); 
          }} 
        />

        {/* Main Dashboard Content */}
        <div className="transition-opacity duration-700">
          {children}
        </div>
      </div>
    );
}
