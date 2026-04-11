'use client';

import { useState, useEffect } from 'react';
import { Brain, Sparkles, Zap, Search, Layout, Rocket } from 'lucide-react';

interface IntelligenceOverlayProps {
  message?: string;
}

export default function IntelligenceOverlay({ message }: IntelligenceOverlayProps) {
  const [step, setStep] = useState(0);
  const steps = [
    { icon: <Search className="w-5 h-5" />, text: "Scouring calendar patterns..." },
    { icon: <Brain className="w-5 h-5" />, text: "Applying neuro-reasoning..." },
    { icon: <Zap className="w-5 h-5" />, text: "Scouting global opportunities..." },
    { icon: <Layout className="w-5 h-5" />, text: "Optimizing your weekly cadence..." },
    { icon: <Rocket className="w-5 h-5" />, text: "Finalizing intelligence stream..." },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((prev) => (prev + 1) % steps.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [steps.length]);

  return (
    <div className="fixed inset-0 z-[200] bg-[var(--overlay-bg)] backdrop-blur-2xl flex flex-col items-center justify-center animate-in fade-in duration-700">
      <div className="relative group">
        {/* Glowing Background */}
        <div className="absolute inset-0 bg-indigo-500/20 blur-[100px] rounded-full animate-pulse" />
        
        {/* Rotating Circular Progress */}
        <div className="relative w-48 h-48 border-4 border-[var(--card-border)] rounded-full flex items-center justify-center p-4">
          <svg className="absolute inset-0 w-full h-full transform -rotate-90">
            <circle
              cx="96"
              cy="96"
              r="92"
              stroke="currentColor"
              strokeWidth="4"
              fill="transparent"
              className="text-indigo-500/10 dark:text-indigo-500/30"
            />
            <circle
              cx="96"
              cy="96"
              r="92"
              stroke="currentColor"
              strokeWidth="4"
              fill="transparent"
              strokeDasharray="578"
              strokeDashoffset="200"
              className="text-indigo-500 animate-[spin_3s_linear_infinite]"
              style={{ strokeLinecap: 'round' }}
            />
          </svg>
          
          <div className="bg-indigo-600 w-24 h-24 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-indigo-500/50 relative z-10 group-hover:scale-110 transition-transform duration-500 border-4 border-white/20">
            <Brain className="w-12 h-12 text-white animate-pulse" />
          </div>
        </div>
      </div>

      <div className="mt-12 text-center space-y-4">
        <h2 className="text-3xl font-black text-[var(--header-text)] italic tracking-tight opacity-90">
          {message || "AI Analysis in Progress"}
        </h2>
        
        <div className="flex items-center justify-center gap-3 bg-[var(--background)] px-6 py-3 rounded-2xl border border-[var(--card-border)] shadow-[0_10px_30px_-5px_rgba(0,0,0,0.05)] dark:shadow-none min-w-[320px] backdrop-blur-md">
          <div className="text-indigo-500 animate-bounce">
            {steps[step].icon}
          </div>
          <span className="text-[var(--header-text)] opacity-70 font-bold text-sm tracking-wide transition-all duration-500">
            {steps[step].text}
          </span>
          <div className="flex gap-1 ml-2">
            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" />
          </div>
        </div>
      </div>

      {/* Background Micro-sparkles */}
      <div className="absolute top-[20%] left-[30%] animate-ping animation-duration-[4s]">
        <Sparkles className="w-4 h-4 text-indigo-400 opacity-20" />
      </div>
      <div className="absolute bottom-[20%] right-[30%] animate-ping animation-duration-[5s]">
        <Sparkles className="w-6 h-6 text-violet-400 opacity-20" />
      </div>
    </div>
  );
}
