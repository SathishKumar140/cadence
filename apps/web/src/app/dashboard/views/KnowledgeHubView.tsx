'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Search, Clock, ExternalLink, Trash2, Zap } from 'lucide-react';
import { useDashboard } from '../DashboardContext';

export default function KnowledgeHubView() {
  const { knowledgeItems, setKnowledgeItems, userId } = useDashboard();
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const fetchKnowledge = async () => {
      setLoading(true);
      try {
        let apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        if (apiUrl && !apiUrl.startsWith('http')) apiUrl = `https://${apiUrl}`;
        const res = await fetch(`${apiUrl}/api/knowledge?user_id=${userId}`);
        if (res.ok) {
          const items = await res.json();
          setKnowledgeItems(items);
        }
      } catch (e) {
        console.error("Failed to fetch knowledge hub", e);
      } finally {
        setLoading(false);
      }
    };

    if (knowledgeItems && knowledgeItems.length === 0) {
      fetchKnowledge();
    }
  }, [userId, knowledgeItems, setKnowledgeItems]);

  const filteredItems = React.useMemo(() => {
    return (knowledgeItems || []).filter(item => 
      item.title.toLowerCase().includes(search.toLowerCase()) || 
      item.content.toLowerCase().includes(search.toLowerCase())
    );
  }, [knowledgeItems, search]);

  return (
    <div className="w-full max-w-6xl mx-auto py-12 px-6">
      <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center border border-violet-500/20 shadow-[0_0_20px_rgba(139,92,246,0.15)]">
              <Brain className="w-5 h-5 text-violet-500" />
            </div>
            <h1 className="text-3xl font-black text-[var(--header-text)] tracking-tight italic">
              Digital Brain
            </h1>
          </div>
          <p className="text-[var(--muted-text)] text-sm max-w-xl leading-relaxed">
            Your personal knowledge base of discovered trends, research, and professional insights. 
            Promoted from the Review Center.
          </p>
        </div>

        <div className="relative w-full md:w-80">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input 
            type="text"
            placeholder="Search your brain..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-4 pl-12 text-sm text-[var(--header-text)] outline-none focus:ring-2 focus:ring-violet-500/20 shadow-sm"
          />
        </div>
      </header>

      {loading && (
         <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="w-12 h-12 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Accessing Neural Store...</p>
         </div>
      )}

      {!loading && filteredItems.length === 0 ? (
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] border-dashed rounded-[3rem] p-20 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center mb-6">
            <Zap className="w-10 h-10 text-slate-300" />
          </div>
          <h3 className="text-xl font-bold text-[var(--header-text)] mb-2">Workspace Empty</h3>
          <p className="text-sm text-[var(--muted-text)] max-w-md">
            You haven&apos;t promoted any discoveries to your Digital Brain yet. 
            Use the **Discovery Feed** to save high-impact insights here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredItems.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="group bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl p-6 hover:shadow-xl hover:shadow-violet-500/5 transition-all duration-300 flex flex-col h-full"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex gap-2">
                    {(item.tags || ['Knowledge']).map(tag => (
                      <span key={tag} className="px-2 py-1 rounded-lg bg-violet-500/10 text-violet-500 text-[9px] font-black uppercase tracking-wider">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <button className="text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <h3 className="text-lg font-black text-[var(--header-text)] mb-3 leading-tight group-hover:text-violet-500 transition-colors">
                  {item.title}
                </h3>
                
                <p className="text-xs text-[var(--muted-text)] leading-relaxed mb-6 flex-1 line-clamp-4 whitespace-pre-wrap">
                  {item.content}
                </p>

                <div className="pt-6 border-t border-[var(--card-border)] flex items-center justify-between mt-auto">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                      <Clock className="w-3 h-3" />
                      {new Date(item.created_at).toLocaleDateString()}
                    </div>
                    {item.source_url && (
                      <a 
                        href={item.source_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-violet-500 hover:text-white transition-all shadow-sm"
                        title="View Original Source"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Footer / Shortcut Hint */}
      {!loading && (
        <footer className="mt-20 p-8 rounded-[3rem] bg-gradient-to-br from-violet-600 to-indigo-700 text-white relative overflow-hidden shadow-2xl">
           <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2" />
           <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                 <h4 className="text-xl font-black mb-1">Knowledge is your Competitive Edge</h4>
                 <p className="text-sm text-white/70">The items here are indexed for your AI Agent to reference in future planning sessions.</p>
              </div>
              <div className="px-6 py-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 text-xs font-bold">
                 Stored in Primary Memory
              </div>
           </div>
        </footer>
      )}
    </div>
  );
}
