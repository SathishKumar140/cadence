'use client';

import React, { useState } from 'react';
import { Copy, Check, Send, Sparkles, Wand2, Hash } from 'lucide-react';
import { motion } from 'framer-motion';

interface LinkedInComposerProps {
  data: {
    draft?: string;
    topic?: string;
    tone?: string;
  };
}

export default function LinkedInComposerView({ data }: LinkedInComposerProps) {
  const [draft, setDraft] = useState(data.draft || '');
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-8 sm:py-12 px-4 sm:px-6 relative z-10">
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center text-blue-600 border border-blue-600/20 shadow-sm">
            <Send className="w-5 h-5" />
          </div>
          <h1 className="text-2xl font-black text-[var(--header-text)]">LinkedIn Composer</h1>
        </div>
        <p className="text-[var(--muted-text)] text-sm font-medium">Drafting for: <span className="text-blue-500">{data.topic || 'General Activity'}</span></p>
      </header>

      <div className="grid grid-cols-1 gap-6">
        {/* Main Editor */}
        <div className="relative bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between p-4 border-b border-[var(--card-border)] bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex items-center gap-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Draft Preview</span>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 text-[9px] font-bold uppercase border border-blue-500/10">
                  {data.tone || 'Professional'}
                </span>
              </div>
            </div>
            <button 
              onClick={handleCopy}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy to Clipboard'}
            </button>
          </div>

          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full h-[400px] p-6 bg-transparent text-sm leading-relaxed text-[var(--header-text)] focus:outline-none resize-none custom-scrollbar"
            placeholder="AI is drafting your post..."
          />

          <div className="p-4 bg-slate-50/30 dark:bg-slate-900/30 border-t border-[var(--card-border)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-medium text-slate-400">
                {draft.length} characters • {draft.split(/\s+/).filter(Boolean).length} words
              </span>
            </div>
            <div className="flex items-center gap-2 text-blue-500 text-[10px] font-bold italic">
              <Sparkles className="w-3 h-3" />
              AI Enhanced Draft
            </div>
          </div>
        </div>

        {/* Suggestion Card */}
        <div className="bg-gradient-to-br from-indigo-600/[0.03] to-violet-600/[0.03] border border-indigo-500/10 rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
            <Wand2 className="w-12 h-12 text-indigo-500" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <Hash className="w-4 h-4 text-indigo-500" />
              <h3 className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 italic">Smart Suggestions</h3>
            </div>
            <p className="text-[11px] text-slate-500 font-medium mb-4 leading-relaxed">
              Based on your activity, this post could resonate well with your <span className="text-indigo-500 font-bold">#Engineering</span> and <span className="text-indigo-500 font-bold">#AI</span> followers.
              Try adding a question at the end to boost engagement!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
