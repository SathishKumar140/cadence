'use client';

import { useState, useEffect } from 'react';
import { X, Target, Dumbbell, BookOpen, Users, Save, Loader2, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';

interface Goals {
  workout_per_week: number;
  learning_hours_per_week: number;
  social_events: number;
}

const SUGGESTED_INTERESTS = [
  "AI", "Generative AI", "Web3", "Blockchain", "Python", "TypeScript", "React",
  "Product Management", "UI/UX Design", "Figma", "Marketing",
  "Yoga", "Marathons", "Gym", "Swimming", "Basketball", "Tennis",
  "Chess", "Cooking", "Photography", "Jazz", "Reading", "Open Source"
];

interface GoalsModalProps {
  onClose: () => void;
  userId: string;
  initialGoals: Goals;
  initialInterests: string[];
}

export default function GoalsModal({ onClose, userId, initialGoals, initialInterests = [] }: GoalsModalProps) {
  const [goals, setGoals] = useState<Goals>(initialGoals);
  const [selectedTags, setSelectedTags] = useState<string[]>(initialInterests || []);
  const [customInput, setCustomInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const addCustomTag = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTag = customInput.trim();
    if (cleanTag && !selectedTags.includes(cleanTag)) {
      setSelectedTags([...selectedTags, cleanTag]);
      setCustomInput("");
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

    try {
      const res = await fetch(`${apiUrl}/api/user/preferences?user_id=${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goals,
          interests: selectedTags
        })
      });

      if (res.ok) {
        router.refresh();
        onClose();
      } else {
        alert("Failed to save goals. Please try again.");
      }
    } catch (e) {
      console.error("Save error:", e);
      alert("Network error while saving goals.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex justify-center items-start overflow-y-auto p-4 py-8 md:py-20 bg-[var(--overlay-bg)] backdrop-blur-xl transition-all duration-300">
      <div className="w-full max-w-md bg-[var(--background)] border border-[var(--card-border)] rounded-[2.5rem] shadow-[0_0_80px_rgba(0,0,0,0.15)] dark:shadow-[0_0_80px_rgba(0,0,0,0.6)] overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="p-8 border-b border-[var(--card-border)] flex justify-between items-center bg-[var(--card-bg)]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-xl">
              <Target className="w-6 h-6 text-indigo-400" />
            </div>
            <h2 className="text-xl font-bold text-[var(--header-text)] tracking-tight">Adjust Your Goals</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-all active:scale-95">
            <X className="w-6 h-6 text-slate-500" />
          </button>
        </div>

        <div className="p-8 space-y-8">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-[var(--muted-text)] flex items-center gap-2">
                <Dumbbell className="w-4 h-4 text-emerald-400" />
                Workouts per week
              </label>
              <span className="text-lg font-black text-[var(--header-text)]">{goals.workout_per_week}</span>
            </div>
            <input
              type="range"
              min="0"
              max="7"
              value={goals.workout_per_week}
              onChange={(e) => setGoals({ ...goals, workout_per_week: parseInt(e.target.value) })}
              className="w-full h-1.5 bg-[var(--input-bg)] rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-[var(--muted-text)] flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-400" />
                Learning hours per week
              </label>
              <span className="text-lg font-black text-[var(--header-text)]">{goals.learning_hours_per_week}h</span>
            </div>
            <input
              type="range"
              min="0"
              max="20"
              value={goals.learning_hours_per_week}
              onChange={(e) => setGoals({ ...goals, learning_hours_per_week: parseInt(e.target.value) })}
              className="w-full h-1.5 bg-[var(--input-bg)] rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-[var(--muted-text)] flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-400" />
                Social events per week
              </label>
              <span className="text-lg font-black text-[var(--header-text)]">{goals.social_events}</span>
            </div>
            <input
              type="range"
              min="0"
              max="5"
              value={goals.social_events}
              onChange={(e) => setGoals({ ...goals, social_events: parseInt(e.target.value) })}
              className="w-full h-1.5 bg-[var(--input-bg)] rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          <div className="pt-6 border-t border-[var(--card-border)] space-y-5">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-[var(--muted-text)] flex items-center gap-2">
                <Target className="w-4 h-4 text-indigo-400" />
                Interests & Passions
              </label>
              <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 text-[10px] uppercase font-black tracking-widest">
                {selectedTags.length} SELECTED
              </span>
            </div>

            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-1 custom-scrollbar">
              {SUGGESTED_INTERESTS.map(tag => {
                const isActive = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`text-[11px] px-3.5 py-2 rounded-xl border font-medium transition-all duration-200 ${isActive
                        ? 'bg-indigo-500 border-indigo-500 text-white shadow-lg shadow-indigo-500/40'
                        : 'bg-[var(--card-bg)] border-[var(--card-border)] text-[var(--muted-text)] hover:border-slate-500 hover:text-[var(--header-text)]'
                      }`}
                  >
                    {tag}
                  </button>
                );
              })}

              {selectedTags.filter(t => !SUGGESTED_INTERESTS.includes(t)).map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className="text-[11px] px-3.5 py-2 rounded-xl border bg-indigo-500 border-indigo-500 text-white shadow-lg shadow-indigo-500/40"
                >
                  {tag}
                </button>
              ))}
            </div>

            <form onSubmit={addCustomTag} className="relative group">
              <input
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="Add specialized interest..."
                className="w-full bg-[var(--background)] border border-[var(--card-border)] rounded-2xl py-3 px-4 text-xs text-[var(--header-text)] focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all placeholder:text-[var(--muted-text)]"
              />
              <button
                type="submit"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-400 hover:text-indigo-300 transition-colors bg-indigo-500/10 p-1.5 rounded-lg"
              >
                <Zap className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>

        <div className="p-8 bg-[var(--card-bg)] border-t border-[var(--card-border)] space-y-4">
          <p className="text-[10px] text-slate-600 text-center uppercase tracking-[0.2em] font-bold">
            AI will re-calculate patterns after saving
          </p>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition-all shadow-[0_10px_30px_-10px_rgba(79,70,229,0.5)] flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98]"
          >
            {isSaving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            {isSaving ? "OPTIMIZING..." : "SAVE CHANGES"}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
