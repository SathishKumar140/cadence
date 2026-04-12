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
        let apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        if (apiUrl && !apiUrl.startsWith('http')) {
            apiUrl = `https://${apiUrl}`;
        }
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
      className={`relative flex items-center gap-2.5 px-5 py-2.5 rounded-2xl transition-all duration-500 group overflow-hidden ${
        loading 
          ? 'bg-indigo-500/10 border border-indigo-500/20 cursor-wait' 
          : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-500/20 border border-indigo-400/30 active:scale-95'
      }`}
      title="Neural Re-Sync: Generate Optimized Weekly Plan"
    >
      {/* Background Shimmer Effect */}
      {!loading && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite]" />
      )}
      
      <div className="relative z-10 flex items-center gap-2.5">
        {loading ? (
          <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
        ) : (
          <Sparkles className="w-4 h-4 text-white group-hover:scale-110 transition-transform duration-500" />
        )}
        <span className="text-xs font-black tracking-tight uppercase">
          {loading ? "Thinking..." : "Neural Re-Sync"}
        </span>
      </div>
    </button>
  );
}
