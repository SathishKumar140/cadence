'use client';

import { useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function RegenerateButton({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegenerate = async () => {
    setLoading(true);
    // Notify global wrapper to show Intelligence Overlay
    window.dispatchEvent(new CustomEvent('regen-start'));
    
    try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        // Invalidate cache first
        await fetch(`${apiUrl}/api/dashboard/cache?user_id=${userId}`, {
            method: 'DELETE'
        });
        
        // Refresh the server component
        router.refresh();
    } catch (e) {
        console.error("Regeneration error:", e);
    }
    
    // Extra buffer to ensure overlay stays during analysis
    setTimeout(() => {
        setLoading(false);
        window.dispatchEvent(new CustomEvent('regen-end'));
    }, 4000);
  };

  return (
    <button
      onClick={handleRegenerate}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-200 text-sm font-medium rounded-xl transition-all border border-slate-200 dark:border-slate-700 disabled:opacity-50 group shadow-sm"
    >
      {loading ? (
        <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
      ) : (
        <Sparkles className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
      )}
      {loading ? "Regenerating..." : "Regenerate Plan"}
    </button>
  );
}
