'use client';

import React from 'react';
import { Sparkles, MapPin, Calendar, ExternalLink, Plus, Search, Users, Check } from 'lucide-react';
import Image from 'next/image';
import { motion } from 'framer-motion';

interface EventDiscovery {
  title: string;
  description: string;
  url: string;
  date?: string;
  end_date?: string;
  start_time?: string; // Fallback for transition
  location?: string;
  image?: string;
  source: string;
  is_scheduled?: boolean;
}

interface DiscoveriesViewProps {
  data: {
    events?: EventDiscovery[];
    location?: string;
    query?: string;
  };
}

export default function DiscoveriesView({ data }: DiscoveriesViewProps) {
  const events = data.events || [];

  const formatDate = (dateStr: string | undefined, endDateStr?: string | undefined) => {
    if (!dateStr) return 'TBA';
    try {
      const parseDate = (s: string) => {
        const d = new Date(s);
        return isNaN(d.getTime()) ? null : d;
      };

      const startDate = parseDate(dateStr);
      if (!startDate) return dateStr + (endDateStr ? ` - ${endDateStr}` : "");

      const formatter = new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      const startFormatted = formatter.format(startDate);
      if (!endDateStr) return startFormatted;

      const endDate = parseDate(endDateStr);
      if (!endDate) return `${startFormatted} - ${endDateStr}`;

      const timeFormatter = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      return `${startFormatted} - ${timeFormatter.format(endDate)}`;
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-8 sm:py-12 px-4 sm:px-6 relative z-10">
      <header className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/10 flex items-center justify-center text-emerald-600 border border-emerald-600/20 shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-black text-[var(--header-text)]">Discovery Engine</h1>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-[var(--card-border)]">
            <MapPin className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-black text-[var(--header-text)] uppercase tracking-widest">{data.location || 'Unknown'}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-slate-500 font-bold italic text-sm">
          <Search className="w-4 h-4" />
          Searching for: <span className="text-emerald-500">{data.query || 'Local Events'}</span>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {events.map((event, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.1 }}
            className="group bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl overflow-hidden hover:bg-[var(--card-hover-bg)] transition-all duration-300 shadow-sm"
          >
            {event.image && (
              <div className="relative h-48 overflow-hidden">
                <Image 
                  src={event.image} 
                  alt={event.title} 
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-4 right-4 px-3 py-1 bg-black/50 backdrop-blur-md rounded-full text-[9px] font-black text-white uppercase tracking-widest border border-white/20">
                  {event.source}
                </div>
              </div>
            )}
            
            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border ${
                  event.source.toLowerCase() === 'meetup' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                  event.source.toLowerCase() === 'luma' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' :
                  'bg-indigo-500/10 text-indigo-500 border-indigo-500/20'
                }`}>
                  {event.source.toLowerCase() === 'meetup' ? <Users className="w-2.5 h-2.5" /> : 
                   event.source.toLowerCase() === 'luma' ? <Calendar className="w-2.5 h-2.5" /> : 
                   <Sparkles className="w-2.5 h-2.5" />}
                  {event.source}
                </div>
              </div>
              
              <div className="flex items-start justify-between mb-3 gap-4">
                <h3 className="font-black text-[var(--header-text)] italic leading-tight group-hover:text-emerald-500 transition-colors uppercase tracking-tight">
                  {event.title}
                </h3>
              </div>
              
              <div className="flex flex-col gap-2 mb-6">
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest opacity-70">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDate(event.date || event.start_time, event.end_date)}
                </div>
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest opacity-70">
                  <MapPin className="w-3.5 h-3.5" />
                  {event.location || 'Local'}
                </div>
              </div>

                <div className="flex items-center gap-2">
                <a 
                  href={event.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-[var(--header-text)] text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all border border-[var(--card-border)]"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View Event
                </a>
                {event.is_scheduled ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-500 text-[9px] font-black uppercase tracking-widest border border-emerald-500/20">
                    <Check className="w-3 h-3" />
                    Already Scheduled
                  </div>
                ) : (
                  <button 
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('cadence:add_to_schedule', {
                        detail: { 
                          title: event.title, 
                          date: event.date || event.start_time,
                          time: event.end_date ? `- ${event.end_date}` : ''
                        }
                      }));
                    }}
                    className="p-3 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 hover:scale-105 active:scale-95 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        ))}

        {events.length === 0 && (
          <div className="col-span-full p-20 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[3rem] flex flex-col items-center justify-center text-center">
            <Search className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-6" />
            <p className="text-slate-500 font-bold italic mb-2">No signals detected in this sector.</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">Try adjusting the query or location</p>
          </div>
        )}
      </div>
    </div>
  );
}
