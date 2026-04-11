'use client';

import { createClient } from '@/utils/supabase/client';
import { motion } from 'framer-motion';
import { Sparkles, Calendar, Activity, Zap } from 'lucide-react';
import { useState } from 'react';

export default function LandingPage() {
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events',
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          prompt: 'consent',
          access_type: 'offline',
        },
      },
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center p-4 selection:bg-indigo-500/30 relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/30 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-violet-600/20 blur-[120px] rounded-full pointer-events-none" />

      <main className="relative max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center z-10">
        
        {/* Left Content / Hero */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="space-y-8"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm font-medium">
            <Sparkles className="w-4 h-4" />
            <span>Meet your personal AI Assistant</span>
          </div>
          
          <h1 className="text-5xl lg:text-7xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            Find your <br/> rhythm with Cadence.
          </h1>
          
          <p className="text-lg text-slate-400 max-w-lg leading-relaxed">
            An intelligent operations system that automates scheduling, discovers relevant events, 
            maintains health routines, and learns from your behavior to optimize your week.
          </p>

          <div className="pt-4">
            <button
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="relative inline-flex items-center justify-center gap-3 px-8 py-4 text-base font-medium text-white transition-all duration-200 bg-indigo-600 border border-transparent rounded-full hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-500/25 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 disabled:opacity-70"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              {isLoading ? 'Connecting...' : 'Continue with Google'}
            </button>
            <p className="mt-4 text-sm text-slate-500">
              By connecting your calendar, you agree to our Terms of Service.
            </p>
          </div>
        </motion.div>

        {/* Right Content / Glassmorphism UI Demo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
          className="relative"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 via-transparent to-violet-500/10 rounded-3xl blur-2xl" />
          <div className="relative bg-slate-900/50 backdrop-blur-xl border border-slate-800/50 p-6 rounded-3xl shadow-2xl flex flex-col gap-4">
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-800/50">
              <div>
                <h3 className="text-lg font-medium text-slate-200">Weekly Optimization</h3>
                <p className="text-sm text-slate-400">Your AI insights for this week</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-xl border border-indigo-500/30">
                85
              </div>
            </div>

            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/50 flex items-center gap-4 hover:bg-slate-800/60 transition-colors cursor-default">
                <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400"><Calendar className="w-5 h-5"/></div>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-slate-200">Smart Scheduling</h4>
                  <p className="text-xs text-slate-400">Found 3 optimal blocks for deep work</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/50 flex items-center gap-4 hover:bg-slate-800/60 transition-colors cursor-default">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400"><Activity className="w-5 h-5"/></div>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-slate-200">Health Routine</h4>
                  <p className="text-xs text-slate-400">Scheduled 3 morning gym sessions</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/50 flex items-center gap-4 hover:bg-slate-800/60 transition-colors cursor-default">
                <div className="p-2 rounded-xl bg-orange-500/20 text-orange-400"><Zap className="w-5 h-5"/></div>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-slate-200">Event Discovery</h4>
                  <p className="text-xs text-slate-400">Found 2 tech meetups matching your setup</p>
                </div>
              </div>
            </div>

          </div>
        </motion.div>

      </main>
    </div>
  );
}
