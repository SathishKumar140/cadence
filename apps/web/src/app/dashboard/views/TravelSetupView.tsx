'use client';

import React, { useState, useEffect } from 'react';
import { 
  Sparkles, Clock, Compass, Heart, 
  MapPin, ChevronRight, Zap, Target, 
  Palmtree, Coffee, MoveDown, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDashboard } from '../DashboardContext';

interface TravelSetupViewProps {
  data: {
    destination?: string;
    prefill?: {
      duration_days?: number;
      trip_pace?: string;
      interests?: string[];
    };
  };
}

const INTEREST_OPTIONS = [
  "Museums & Art", "Local Food", "Hiking & Nature", 
  "Tech & Innovation", "Nightlife", "Shopping", 
  "History & Landmarks", "Photography", "Meditation"
];

const PACE_OPTIONS = [
  { id: 'Relaxed', label: 'Relaxed', desc: 'Leisurely strolls and long breaks' },
  { id: 'Balanced', label: 'Balanced', desc: 'Mix of highlights and downtime' },
  { id: 'Fast-paced', label: 'Active', desc: 'High-energy, focused exploration' }
];

export default function TravelSetupView({ data }: TravelSetupViewProps) {
  const { applyMutation, activeView } = useDashboard();
  const [isGenerating, setIsGenerating] = useState(false);
  
  const destination = data?.destination || "Destination";
  const [days, setDays] = useState(data?.prefill?.duration_days || 3);
  const [pace, setPace] = useState(data?.prefill?.trip_pace || 'Balanced');
  const [interests, setInterests] = useState<string[]>(data?.prefill?.interests || []);

  // Reset generating state if view changes
  useEffect(() => {
    setIsGenerating(false);
  }, [activeView]);

  const toggleInterest = (interest: string) => {
    setInterests(prev => 
      prev.includes(interest) 
        ? prev.filter(i => i !== interest) 
        : [...prev, interest]
    );
  };

  const handleGeneratePlan = () => {
    setIsGenerating(true);
    
    // Create the command for the agent
    const prompt = `Generate a personalized travel plan for my trip to ${destination}.
Params:
- Duration: ${days} days
- Pace: ${pace}
- Interests: ${interests.join(', ')}

Please call the scout_travel_plans tool with these details.`;

    // Dispatch custom event that AgentChatPanel listens to
    const event = new CustomEvent('cadence:initiate_travel_plan', {
      detail: { prompt, destination }
    });
    window.dispatchEvent(event);
  };

  return (
    <div className="w-full h-full bg-[var(--background)] flex flex-col items-center justify-center p-6 md:p-20 relative overflow-hidden min-h-screen">
      
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] pointer-events-none">
         <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-500 blur-[120px] rounded-full" />
         <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500 blur-[120px] rounded-full" />
      </div>

      <div className="w-full max-w-3xl space-y-12 relative z-10">
        
        {/* Header Section */}
        <div className="space-y-4 text-center md:text-left">
           <motion.div 
             initial={{ opacity: 0, y: 10 }}
             animate={{ opacity: 1, y: 0 }}
             className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full"
           >
             <Palmtree className="w-3 h-3 text-indigo-500" />
             <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">Planning Phase</span>
           </motion.div>
           
           <div className="space-y-1">
              <h1 className="text-3xl md:text-5xl font-black text-[var(--header-text)] italic tracking-tighter uppercase leading-none">
                Destination: {destination}
              </h1>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">
                Configure your travel preferences
              </p>
           </div>
        </div>

        {/* Form Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          
          {/* Duration & Pace */}
          <div className="space-y-10">
            {/* 1. Duration Selection */}
            <div className="space-y-6">
               <label className="flex items-center gap-3 text-xs font-black text-[var(--header-text)] uppercase tracking-widest">
                 <Clock className="w-4 h-4 text-cyan-500" />
                 Trip Duration
               </label>
               <div className="space-y-4">
                  <div className="flex justify-between items-end">
                     <span className="text-5xl font-black text-indigo-600 italic leading-none">{days}</span>
                     <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Days</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="14" 
                    value={days} 
                    onChange={(e) => setDays(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                  <div className="flex justify-between text-[8px] font-black text-slate-500 uppercase tracking-widest px-1">
                     <span>Stay Day 1</span>
                     <span>Maximum 14</span>
                  </div>
               </div>
            </div>

            {/* 2. Pace Selection */}
            <div className="space-y-6">
               <label className="flex items-center gap-3 text-xs font-black text-[var(--header-text)] uppercase tracking-widest">
                 <Compass className="w-4 h-4 text-indigo-500" />
                 Trip Pace
               </label>
               <div className="grid grid-cols-1 gap-2">
                  {PACE_OPTIONS.map((opt) => (
                    <button 
                      key={opt.id}
                      onClick={() => setPace(opt.id)}
                      className={`group flex items-center justify-between p-4 rounded-2xl border-2 transition-all text-left ${
                        pace === opt.id 
                          ? 'bg-indigo-600 border-indigo-600 shadow-xl shadow-indigo-600/40' 
                          : 'bg-[var(--card-bg)] border-[var(--card-border)] hover:border-indigo-500/30'
                      }`}
                    >
                      <div>
                        <h4 className={`text-xs font-black uppercase tracking-widest ${pace === opt.id ? 'text-white' : 'text-slate-400'}`}>
                          {opt.label}
                        </h4>
                        <p className={`text-[9px] font-bold mt-1 uppercase ${pace === opt.id ? 'text-indigo-100' : 'text-slate-500 opacity-60'}`}>
                          {opt.desc}
                        </p>
                      </div>
                      {pace === opt.id && <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(79,70,229,0.5)]" />}
                    </button>
                  ))}
               </div>
            </div>
          </div>

          {/* Interests Cloud */}
          <div className="space-y-6">
            <label className="flex items-center gap-3 text-xs font-black text-[var(--header-text)] uppercase tracking-widest">
              <Heart className="w-4 h-4 text-emerald-500" />
              Main Interests
            </label>
            <div className="flex flex-wrap gap-2">
               {INTEREST_OPTIONS.map((interest) => (
                 <button 
                   key={interest}
                   onClick={() => toggleInterest(interest)}
                   className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border-2 ${
                     interests.includes(interest)
                      ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/40'
                      : 'bg-[var(--card-bg)] border-[var(--card-border)] text-slate-500 hover:border-emerald-500/30'
                   }`}
                 >
                   {interest}
                 </button>
               ))}
            </div>

            <div className="p-8 rounded-3xl bg-indigo-500/5 border border-indigo-500/10 flex flex-col items-center justify-center text-center space-y-4 mt-8">
               <Coffee className="w-8 h-8 text-indigo-500/40" />
               <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest max-w-[200px] leading-relaxed">
                  The plan will focus on {interests.length || 'general'} highlights for your trip.
               </p>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="pt-10 border-t border-[var(--card-border)] flex flex-col md:flex-row items-center justify-between gap-6">
           <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center border border-[var(--card-border)]">
                 <MoveDown className="w-4 h-4 text-slate-400" />
              </div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Planning your trip to <span className="text-white font-black italic">{destination}</span>
              </p>
           </div>
           
           <motion.button 
             whileHover={{ scale: 1.02 }}
             whileTap={{ scale: 0.98 }}
             onClick={handleGeneratePlan}
             disabled={isGenerating}
             className="w-full md:w-auto flex items-center justify-center gap-3 bg-white text-black px-12 py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:bg-cyan-400 transition-all disabled:opacity-50"
           >
             {isGenerating ? (
               <div className="flex items-center gap-2">
                 <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                 <span>Preparing Plan...</span>
               </div>
             ) : (
               <>
                 Generate Travel Plan
                 <ChevronRight className="w-4 h-4" />
               </>
             )}
           </motion.button>
        </div>

      </div>
    </div>
  );
}
