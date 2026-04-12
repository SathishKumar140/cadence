'use client';

import React from 'react';
import { Mail, Clock, Send, Calendar, XCircle, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface ScheduledEmail {
  id: string;
  subject: string;
  body: string;
  recipient: string;
  send_at: string;
  status: string;
}

interface EmailSchedulerProps {
  data: {
    emails?: ScheduledEmail[];
    action?: string;
    email_id?: string;
    send_at?: string;
  };
}

export default function EmailSchedulerView({ data }: EmailSchedulerProps) {
  const emails = data.emails || [];

  return (
    <div className="w-full max-w-4xl mx-auto py-8 sm:py-12 px-4 sm:px-6 relative z-10">
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-violet-600/10 flex items-center justify-center text-violet-600 border border-violet-600/20 shadow-sm">
            <Mail className="w-5 h-5" />
          </div>
          <h1 className="text-2xl font-black text-[var(--header-text)]">Email Automation</h1>
        </div>
        <p className="text-[var(--muted-text)] text-sm font-medium">Managing {emails.length} queued notifications.</p>
      </header>

      <div className="space-y-4">
        {emails.map((email, idx) => (
          <motion.div 
            key={email.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-6 transition-all duration-300 hover:bg-[var(--card-hover-bg)] group"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-black text-[var(--header-text)] italic truncate">{email.subject}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${
                    email.status === 'pending' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 
                    email.status === 'sent' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
                    'bg-slate-500/10 text-slate-500 border-slate-500/20'
                  }`}>
                    {email.status}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-[11px] font-bold text-slate-500 uppercase tracking-widest opacity-60">
                  <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> To: {email.recipient}</span>
                  <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {new Date(email.send_at).toLocaleString()}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {email.status === 'pending' && (
                  <button className="p-2.5 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-sm">
                    <XCircle className="w-5 h-5" />
                  </button>
                )}
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-violet-500 transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </div>
              </div>
            </div>
            
            <div className="mt-4 p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/50 border border-[var(--card-border)] text-xs text-slate-500 font-medium italic leading-relaxed">
              &ldquo;{email.body}&rdquo;
            </div>
          </motion.div>
        ))}

        {emails.length === 0 && (
          <div className="p-16 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl flex flex-col items-center justify-center text-center">
            <Clock className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-6" />
            <p className="text-slate-500 font-bold italic mb-2">The outbox is silent.</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">Ask: "Remind me next Monday at 8am to check my targets"</p>
          </div>
        )}
      </div>

      {/* Proactive Footer */}
      <div className="mt-12 bg-gradient-to-r from-violet-600 to-indigo-700 rounded-3xl p-8 text-white shadow-xl shadow-indigo-600/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Send className="w-24 h-24" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-md">
            <h3 className="text-xl font-black italic mb-2">Automated Persistence</h3>
            <p className="text-sm opacity-80 font-medium leading-relaxed">
              I can schedule summaries of your weekly performance to your inbox. Stay on top of your goals without manual oversight.
            </p>
          </div>
          <button className="px-6 py-3 bg-white text-indigo-700 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg hover:scale-105 transition-transform shrink-0">
             Set Weekly Summary
          </button>
        </div>
      </div>
    </div>
  );
}

function ChevronRight(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
