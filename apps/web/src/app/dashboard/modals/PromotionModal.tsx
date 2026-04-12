'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { X, Share2, Brain, Calendar, ArrowRight, CheckCircle2, Loader2, Zap } from 'lucide-react';

interface PromotionModalProps {
  isOpen: boolean;
  onClose: () => void;
  action: {
    id: string;
    title: string;
    description: string;
    reasoning: string;
    source_url: string | null;
  } | null;
  userId: string;
  onSuccess: (id: string, resolution: string) => void;
}

export default function PromotionModal({ isOpen, onClose, action, userId, onSuccess }: PromotionModalProps) {
  const [loading, setLoading] = React.useState<string | null>(null);
  const [complete, setComplete] = React.useState<string | null>(null);
  const [integrations, setIntegrations] = React.useState<Record<string, Record<string, unknown>>>({});

  React.useEffect(() => {
    if (isOpen) {
      const fetchStatus = async () => {
        try {
          let apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
          if (apiUrl && !apiUrl.startsWith('http')) apiUrl = `https://${apiUrl}`;
          const res = await fetch(`${apiUrl}/api/integrations/status?user_id=${userId}`);
          if (res.ok) setIntegrations(await res.json());
        } catch (e) {
          console.error("Failed to fetch integration status", e);
        }
      };
      fetchStatus();
    }
  }, [isOpen, userId]);

  if (!isOpen || !action) return null;

  const handleKnowledgeSave = async () => {
    setLoading('knowledge');
    try {
      let apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      if (apiUrl && !apiUrl.startsWith('http')) apiUrl = `https://${apiUrl}`;

      const res = await fetch(`${apiUrl}/api/knowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          title: action.title,
          content: action.description + "\n\nReasoning: " + action.reasoning,
          source_url: action.source_url,
          tags: ['discovery']
        })
      });

      if (res.ok) {
        setComplete('knowledge');
        setTimeout(() => {
          onSuccess(action.id, 'promoted');
          onClose();
        }, 1000);
      }
    } catch (e) {
      console.error("Failed to save knowledge", e);
    } finally {
      setLoading(null);
    }
  };

  const handleLinkedInAction = async () => {
    setLoading('linkedin');
    
    try {
      let apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      if (apiUrl && !apiUrl.startsWith('http')) apiUrl = `https://${apiUrl}`;

      if (integrations.linkedin) {
          // Direct POST via API
          const res = await fetch(`${apiUrl}/api/social/linkedin/post`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: userId,
              action_id: action.id,
              content: `${action.title}\n\n${action.description}\n\nVia Cadence AI`,
              title: action.title
            })
          });
          
          if (!res.ok) throw new Error("LinkedIn Post failed");
          
          setComplete('linkedin');
          setTimeout(() => {
            onSuccess(action.id, 'promoted');
            onClose();
          }, 1500);
      } else {
          // Fallback/Handoff logic
          await fetch(`${apiUrl}/api/actions/${action.id}/resolve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, resolution: 'promoted' })
          });

          setComplete('linkedin');
          
          // Emit a global event for the agent to pick up
          const event = new CustomEvent('cadence:promote_to_linkedin', { 
            detail: { 
              topic: action.title,
              context: action.description,
              reasoning: action.reasoning
            } 
          });
          window.dispatchEvent(event);

          setTimeout(() => {
            onSuccess(action.id, 'promoted');
            onClose();
          }, 1000);
      }
    } catch (e) {
      console.error("LinkedIn action failed", e);
    } finally {
      setLoading(null);
    }
  };

  const handleSchedule = async () => {
    setLoading('schedule');
    onSuccess(action.id, 'promoted');
    setComplete('schedule');
    setTimeout(() => onClose(), 800);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-xl" 
        onClick={onClose} 
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
      >
        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Promotion Hub</h2>
                <p className="text-xs text-slate-500">Turn this discovery into professional output</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mb-8 p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1 line-clamp-1">{action.title}</h3>
            <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed italic">&quot;{action.description}&quot;</p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {/* LinkedIn Choice */}
            <button 
              onClick={handleLinkedInAction}
              disabled={!!loading || !!complete}
              className={`group flex items-center gap-4 p-5 rounded-3xl border-2 transition-all text-left ${complete === 'linkedin' ? 'border-emerald-500 bg-emerald-500/5' : 'border-slate-100 dark:border-slate-800 hover:border-indigo-500/50 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${complete === 'linkedin' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500'}`}>
                {loading === 'linkedin' ? <Loader2 className="w-6 h-6 animate-spin" /> : complete === 'linkedin' ? <CheckCircle2 className="w-6 h-6" /> : <Share2 className="w-6 h-6" />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-black text-slate-900 dark:text-white lowercase tracking-tight">
                  {integrations.linkedin ? 'Post directly to LinkedIn' : 'Share on LinkedIn'}
                </p>
                <p className="text-[10px] text-slate-500">
                  {integrations.linkedin ? `Posting as ${integrations.linkedin.name}` : 'Draft a professional post for your network'}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
            </button>

            {/* Knowledge Choice */}
            <button 
              onClick={handleKnowledgeSave}
              disabled={!!loading || !!complete}
              className={`group flex items-center gap-4 p-5 rounded-3xl border-2 transition-all text-left ${complete === 'knowledge' ? 'border-emerald-500 bg-emerald-500/5' : 'border-slate-100 dark:border-slate-800 hover:border-violet-500/50 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${complete === 'knowledge' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-violet-500/10 text-violet-500'}`}>
                {loading === 'knowledge' ? <Loader2 className="w-6 h-6 animate-spin" /> : complete === 'knowledge' ? <CheckCircle2 className="w-6 h-6" /> : <Brain className="w-6 h-6" />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-black text-slate-900 dark:text-white lowercase tracking-tight">Save to Digital Brain</p>
                <p className="text-[10px] text-slate-500">Store as a permanent note for future reference</p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-violet-500 group-hover:translate-x-1 transition-all" />
            </button>

            {/* Calendar Choice */}
            <button 
              onClick={handleSchedule}
              disabled={!!loading || !!complete}
              className={`group flex items-center gap-4 p-5 rounded-3xl border-2 transition-all text-left ${complete === 'schedule' ? 'border-emerald-500 bg-emerald-500/5' : 'border-slate-100 dark:border-slate-800 hover:border-emerald-500/50 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${complete === 'schedule' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                {loading === 'schedule' ? <Loader2 className="w-6 h-6 animate-spin" /> : <Calendar className="w-6 h-6" />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-black text-slate-900 dark:text-white lowercase tracking-tight">Add to Weekly Plan</p>
                <p className="text-[10px] text-slate-500">Schedule a time to dive deeper into this</p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
            </button>
          </div>
        </div>

        <div className="px-8 py-5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-center">
           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 text-center">
             Promoting turns insights into outcomes
           </p>
        </div>
      </motion.div>
    </div>
  );
}
