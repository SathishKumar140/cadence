'use client';

import { useState } from 'react';
import { Target, Zap, Rocket, ArrowRight, Brain, Sparkles, User, Heart, Book, Coffee } from 'lucide-react';

interface OnboardingViewProps {
  userId: string;
  onComplete: (preferences: any) => void;
}

export default function OnboardingView({ userId, onComplete }: OnboardingViewProps) {
  const [step, setStep] = useState(1);
  const [goals, setGoals] = useState({
    workout_per_week: 3,
    learning_hours_per_week: 2,
    social_events: 1
  });
  const [interests, setInterests] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const interestOptions = [
    { id: 'fitness', label: 'Fitness', icon: <Heart className="w-4 h-4" /> },
    { id: 'coding', label: 'Coding', icon: <Zap className="w-4 h-4" /> },
    { id: 'reading', label: 'Learning', icon: <Book className="w-4 h-4" /> },
    { id: 'meditation', label: 'Wellness', icon: <Coffee className="w-4 h-4" /> },
    { id: 'ai', label: 'AI', icon: <Brain className="w-4 h-4" /> },
    { id: 'cooking', label: 'Cooking', icon: <Sparkles className="w-4 h-4" /> },
  ];

  const toggleInterest = (label: string) => {
    if (interests.includes(label)) {
      setInterests(interests.filter(i => i !== label));
    } else {
      setInterests([...interests, label]);
    }
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const res = await fetch(`${apiUrl}/api/user/preferences?user_id=${userId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                goals: goals,
                interests: interests
            })
        });
        if (res.ok) {
            onComplete({ goals, interests });
        }
    } catch (e) {
        console.error("Onboarding failed", e);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] bg-slate-950 flex flex-col items-center justify-center p-6 sm:p-12 overflow-hidden">
      {/* Dynamic Background */}
      <div className="absolute top-0 right-0 w-[60%] h-[60%] bg-indigo-600/10 blur-[150px] rounded-full animate-pulse" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-violet-600/10 blur-[150px] rounded-full" />

      <div className="relative w-full max-w-2xl bg-slate-900/50 backdrop-blur-3xl border border-slate-800 rounded-[3rem] p-8 sm:p-12 shadow-2xl">
        {/* Progress Bar */}
        <div className="flex gap-2 mb-12">
          {[1, 2, 3].map(s => (
            <div key={s} className={`h-2 flex-1 rounded-full transition-all duration-500 ${step >= s ? 'bg-indigo-500' : 'bg-slate-800'}`} />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-500">
            <div className="space-y-2">
              <div className="w-16 h-16 rounded-[2rem] bg-indigo-500/20 flex items-center justify-center text-indigo-400 mb-6">
                <User className="w-8 h-8" />
              </div>
              <h1 className="text-4xl font-black text-white tracking-tight">Welcome to Cadence.</h1>
              <p className="text-xl text-slate-400 font-medium">Let's find your rhythm. What are you passionate about?</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {interestOptions.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => toggleInterest(opt.label)}
                  className={`flex flex-col items-center gap-3 p-6 rounded-3xl border-2 transition-all duration-300 ${interests.includes(opt.label) ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400' : 'border-slate-800 text-slate-500 hover:border-slate-700'}`}
                >
                  <div className="text-xl">{opt.icon}</div>
                  <span className="font-bold text-sm">{opt.label}</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={interests.length === 0}
              className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-3xl font-black text-lg flex items-center justify-center gap-3 transition-all shadow-xl shadow-indigo-500/20"
            >
              Continue <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-500">
            <div className="space-y-2">
              <div className="w-16 h-16 rounded-[2rem] bg-emerald-500/20 flex items-center justify-center text-emerald-400 mb-6">
                <Target className="w-8 h-8" />
              </div>
              <h1 className="text-4xl font-black text-white tracking-tight">Weekly Ambitions</h1>
              <p className="text-xl text-slate-400 font-medium">What targets are we aiming for this week?</p>
            </div>

            <div className="space-y-8">
              <div className="space-y-4">
                <div className="flex justify-between font-bold">
                  <span className="text-slate-300">Workout sessions</span>
                  <span className="text-emerald-400">{goals.workout_per_week} / week</span>
                </div>
                <input 
                  type="range" min="0" max="7" 
                  value={goals.workout_per_week}
                  onChange={(e) => setGoals({...goals, workout_per_week: parseInt(e.target.value)})}
                  className="w-full h-3 bg-slate-800 rounded-full appearance-none accent-emerald-500 cursor-pointer" 
                />
              </div>
              <div className="space-y-4">
                <div className="flex justify-between font-bold">
                  <span className="text-slate-300">Learning hours</span>
                  <span className="text-indigo-400">{goals.learning_hours_per_week} hrs</span>
                </div>
                <input 
                  type="range" min="0" max="10" 
                  value={goals.learning_hours_per_week}
                  onChange={(e) => setGoals({...goals, learning_hours_per_week: parseInt(e.target.value)})}
                  className="w-full h-3 bg-slate-800 rounded-full appearance-none accent-indigo-500 cursor-pointer" 
                />
              </div>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => setStep(1)}
                className="flex-1 py-5 bg-slate-800 text-slate-300 rounded-3xl font-bold"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-[2] py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-3xl font-black text-lg flex items-center justify-center gap-3 transition-all"
              >
                Almost There <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-12 text-center animate-in fade-in slide-in-from-bottom-5 duration-500">
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full" />
              <div className="relative w-32 h-32 mx-auto rounded-[3rem] bg-indigo-600 flex items-center justify-center text-white mb-8 shadow-2xl">
                <Rocket className="w-16 h-16 animate-bounce" />
              </div>
            </div>
            
            <div className="space-y-4">
              <h1 className="text-4xl font-black text-white tracking-tight italic">Initialize Intelligence</h1>
              <p className="text-lg text-slate-400 max-w-sm mx-auto leading-relaxed">
                We're ready to analyze your patterns and scour for opportunities. 
                Buckle up for your first agentic week.
              </p>
            </div>

            <button
              onClick={handleFinish}
              disabled={loading}
              className="w-full py-6 bg-gradient-to-r from-indigo-600 to-violet-600 hover:scale-[1.02] active:scale-95 text-white rounded-3xl font-black text-2xl flex items-center justify-center gap-4 transition-all shadow-2xl shadow-indigo-500/40 relative overflow-hidden group"
            >
              {loading ? (
                <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Launch Dashboard <Sparkles className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
