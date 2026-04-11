'use client';

import { useState, useEffect, useCallback } from 'react';
import { Settings, X, Moon, Sun, Key, Brain, Save, CheckCircle2, Zap } from 'lucide-react';

interface SettingsModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ userId, isOpen, onClose }: SettingsModalProps) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [provider, setProvider] = useState('openai');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      let apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      if (apiUrl && !apiUrl.startsWith('http')) {
          apiUrl = `https://${apiUrl}`;
      }
      const res = await fetch(`${apiUrl}/api/user/settings?user_id=${userId}`);
      if (res.ok) {
        const data = await res.json();
        setTheme(data.theme || 'dark');
        setProvider(data.ai_provider || 'openai');
        setApiKey(data.ai_api_key || '');
        
        // Apply theme immediately to local UI for preview
        document.documentElement.classList.toggle('dark', data.theme === 'dark');
      }
    } catch (e) {
      console.error("Failed to fetch settings", e);
    }
  }, [userId]);

  useEffect(() => {
    if (isOpen) {
      fetchSettings();
    }
  }, [isOpen, fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      let apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      if (apiUrl && !apiUrl.startsWith('http')) {
          apiUrl = `https://${apiUrl}`;
      }
      const res = await fetch(`${apiUrl}/api/user/settings?user_id=${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          theme,
          ai_provider: provider,
          ai_api_key: apiKey
        })
      });

      if (res.ok) {
        setSaved(true);
        // Set cookie for SSR
        document.cookie = `theme=${theme}; path=/; max-age=31536000; SameSite=Lax`;
        // Apply theme global immediately
        document.documentElement.className = theme;
        
        setTimeout(() => {
          setSaved(false);
          onClose();
        }, 1500);
      }
    } catch (e) {
      console.error("Failed to save settings", e);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div 
        className="absolute inset-0 bg-[var(--overlay-bg)] backdrop-blur-md animate-in fade-in duration-300" 
        onClick={onClose} 
      />
      
      <div className="relative w-full max-w-lg bg-[var(--background)] rounded-[2.5rem] shadow-[0_0_80px_rgba(0,0,0,0.1)] dark:shadow-[0_0_80px_rgba(0,0,0,0.6)] border border-[var(--card-border)] overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="flex items-center justify-between p-8 border-b border-[var(--card-border)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[var(--header-text)]">System Settings</h2>
              <p className="text-sm text-[var(--muted-text)]">Personalize your intelligence experience</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
          {/* Theme Section */}
          <section className="space-y-4">
            <h3 className="text-[10px] font-black text-indigo-500/60 uppercase tracking-[0.2em] flex items-center gap-2">
              <Sun className="w-3.5 h-3.5" /> Appearance
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => setTheme('light')}
                className={`flex items-center justify-center gap-3 p-4 rounded-2xl border-2 transition-all duration-300 ${
                  theme === 'light' 
                    ? 'border-indigo-500 bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 shadow-[0_0_20px_rgba(99,102,241,0.15)]' 
                    : 'border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--muted-text)] hover:text-[var(--header-text)] hover:border-indigo-500/30'
                }`}
              >
                <Sun className={`w-5 h-5 ${theme === 'light' ? 'text-indigo-500' : ''}`} />
                <span className="font-bold">Light</span>
              </button>
              <button 
                onClick={() => setTheme('dark')}
                className={`flex items-center justify-center gap-3 p-4 rounded-2xl border-2 transition-all duration-300 ${
                  theme === 'dark' 
                    ? 'border-indigo-500 bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 shadow-[0_0_20px_rgba(99,102,241,0.15)]' 
                    : 'border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--muted-text)] hover:text-[var(--header-text)] hover:border-indigo-500/30'
                }`}
              >
                <Moon className={`w-5 h-5 ${theme === 'dark' ? 'text-indigo-500' : ''}`} />
                <span className="font-bold">Dark</span>
              </button>
            </div>
          </section>

          {/* AI Config Section */}
          <section className="space-y-6">
            <h3 className="text-[10px] font-black text-indigo-500/60 uppercase tracking-[0.2em] flex items-center gap-2">
              <Brain className="w-3.5 h-3.5" /> Intelligence Engine
            </h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[var(--muted-text)]">AI Provider</label>
                <select 
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full bg-[var(--input-bg)] border border-[var(--card-border)] rounded-2xl p-4 text-[var(--header-text)] outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="openai">OpenAI (GPT-4o)</option>
                  <option value="anthropic">Anthropic (Claude 3.5)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-[var(--muted-text)] flex justify-between">
                  <span>API Key</span>
                  <span className="text-[10px] text-indigo-500 font-bold uppercase tracking-tighter">Bring Your Own Key</span>
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <Key className="w-4 h-4" />
                  </div>
                  <input 
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full bg-[var(--input-bg)] border border-[var(--card-border)] rounded-2xl p-4 pl-12 text-[var(--header-text)] outline-none focus:ring-2 focus:ring-indigo-500/20 placeholder:text-slate-500"
                  />
                </div>
                <p className="text-[10px] text-slate-500 italic px-1">
                  Your key is stored in your private profile and used only for your own dashboard analysis.
                </p>
              </div>
            </div>
          </section>

          {/* Integrations Section */}
          <section className="space-y-6">
            <h3 className="text-[10px] font-black text-indigo-500/60 uppercase tracking-[0.2em] flex items-center gap-2">
              <Zap className="w-3.5 h-3.5" /> Discovery Integrations
            </h3>
            
            <div className="grid grid-cols-1 gap-4">
               <div className="flex items-center justify-between p-4 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl">
                  <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500 text-[10px] font-black">EB</div>
                     <div>
                        <p className="text-sm font-bold text-[var(--header-text)]">Eventbrite</p>
                        <p className="text-[10px] text-slate-500">Official REST API</p>
                     </div>
                  </div>
                  <div className="w-10 h-5 bg-emerald-500/20 rounded-full flex items-center px-1">
                     <div className="w-3 h-3 bg-emerald-500 rounded-full" />
                  </div>
               </div>
               
               <div className="flex items-center justify-between p-4 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl opacity-60">
                  <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-500 text-[10px] font-black">MP</div>
                     <div>
                        <p className="text-sm font-bold text-[var(--header-text)]">Meetup</p>
                        <p className="text-[10px] text-slate-500">Public Scraper</p>
                     </div>
                  </div>
                  <div className="w-10 h-5 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center px-1">
                     <div className="w-3 h-3 bg-slate-400 rounded-full" />
                  </div>
               </div>
            </div>
          </section>
        </div>

        <div className="p-8 border-t border-[var(--card-border)] bg-[var(--card-bg)]">
          <button 
            onClick={handleSave}
            disabled={saving || saved}
            className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-xl ${saved ? 'bg-emerald-500 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20 active:scale-95'}`}
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : saved ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            {saving ? "Saving Changes..." : saved ? "Settings Saved" : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
