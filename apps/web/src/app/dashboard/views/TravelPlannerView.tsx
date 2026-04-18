'use client';

import React, { useState } from 'react';
import { 
  Plane, Building, MapPin, Calendar, Sun, 
  Palmtree, ArrowRight, ExternalLink, Sparkles, 
  CheckCircle, Plus, Info, Clock, Map, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDashboard } from '../DashboardContext';

interface Flight {
  airline: string;
  price: string;
  layovers: string;
  duration: string;
}

interface Hotel {
  name: string;
  price_per_night: string;
  rating: string;
  area: string;
}

interface ItineraryDay {
  day: number;
  title: string;
  activities: string[];
}

interface TravelPlannerViewProps {
  data: {
    destination?: string;
    origin?: string;
    dates?: string;
    insights?: {
      season?: string;
      festivals?: string[];
    };
    flights?: Flight[];
    hotels?: Hotel[];
    itinerary?: ItineraryDay[];
  };
}

export default function TravelPlannerView({ data }: TravelPlannerViewProps) {
  const { applyMutation } = useDashboard();
  const [selectedFlight, setSelectedFlight] = useState<number | null>(null);
  const [selectedHotel, setSelectedHotel] = useState<number | null>(null);
  const [activeDay, setActiveDay] = useState<number>(1);
  const [isSyncing, setIsSyncing] = useState(false);

  const {
    destination = "Destination",
    origin = "Origin",
    dates = "Upcoming",
    insights = { season: "", festivals: [] },
    flights = [],
    hotels = [],
    itinerary = []
  } = data || {};

  // use global generic asset
  const heroImage = "/travel_hero.png";

  const handleSyncToHub = async () => {
    if (selectedFlight === null && selectedHotel === null) return;
    
    setIsSyncing(true);
    
    // Simulate mutation delay
    setTimeout(() => {
      const flight = flights[selectedFlight!];
      const hotel = hotels[selectedHotel!];
      
      if (flight) {
        applyMutation({
          target: 'weekly_plan',
          action: 'add',
          data: {
            title: `Flight to ${destination} (${flight.airline})`,
            day: "Monday", // simplified
            time: "10:00-18:00",
            reason: "Confirmed travel booking",
            is_discovery: false
          }
        });
      }
      
      if (hotel) {
        applyMutation({
          target: 'weekly_plan',
          action: 'add',
          data: {
            title: `Stay at ${hotel.name}`,
            day: "Tuesday",
            time: "14:00-11:00",
            reason: "Confirmed accommodation",
            is_discovery: false
          }
        });
      }
      
      setIsSyncing(false);
      setSelectedFlight(null);
      setSelectedHotel(null);
    }, 1500);
  };

  return (
    <div className="w-full h-full bg-[var(--background)] relative min-h-screen pb-24 overflow-x-hidden">
      {/* 1. Cinematic Hero Section (Compacted) */}
      <section className="relative w-full h-[180px] md:h-[220px] overflow-hidden">
        <motion.img 
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 10, ease: "linear" }}
          src={heroImage} 
          className="w-full h-full object-cover"
          alt={destination}
        />
        {/* Stronger overlay for clarity */}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)] via-[var(--background)]/70 to-black/40" />
        
        <div className="absolute bottom-6 left-6 md:left-10 z-20 space-y-2">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 bg-black/40 backdrop-blur-md border border-white/20 px-2.5 py-1 rounded-full w-fit shadow-lg shadow-black/20"
          >
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span className="text-[9px] font-black text-white uppercase tracking-[0.2em]">Travel Dossier</span>
          </motion.div>
          
          <div className="space-y-0">
             <h1 className="text-4xl md:text-5xl font-black text-white italic tracking-tighter uppercase leading-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]">
               {destination}
             </h1>
              <div className="flex items-center gap-3 text-white/90 font-bold uppercase tracking-[0.15em] text-[10px] mt-2">
                <span className="flex items-center gap-1.5 bg-black/60 shadow-lg shadow-black/20 px-2 py-0.5 rounded backdrop-blur-sm">
                  <MapPin className="w-3 h-3 text-cyan-400" />
                  From {origin}
                </span>
                <div className="w-1 h-1 rounded-full bg-white/40" />
                <span className="flex items-center gap-1.5 bg-black/60 shadow-lg shadow-black/20 px-2 py-0.5 rounded backdrop-blur-sm">
                  <Calendar className="w-3 h-3 text-cyan-400" />
                  {dates}
                </span>
              </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 md:px-10 mt-8 relative z-30 space-y-10 pb-20">
        
        {/* 2. Tactical Insights Row */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div 
            whileHover={{ y: -5 }}
            className="lg:col-span-1 bg-[var(--card-bg)] border border-[var(--card-border)] p-8 rounded-3xl relative overflow-hidden group"
          >
            <Sun className="absolute -right-6 -top-6 w-32 h-32 text-amber-500/5 group-hover:text-amber-500/10 transition-colors" />
            <h3 className="flex items-center gap-2 text-sm font-black text-amber-500 uppercase tracking-widest mb-4">
               <Sun className="w-4 h-4" />
               Best Season
            </h3>
            <p className="text-sm font-medium text-[var(--muted-text)] leading-relaxed">
              {insights.season}
            </p>
          </motion.div>

          <motion.div 
            whileHover={{ y: -5 }}
            className="lg:col-span-2 bg-[var(--card-bg)] border border-[var(--card-border)] p-8 rounded-3xl relative overflow-hidden group"
          >
            <Palmtree className="absolute -right-6 -top-6 w-32 h-32 text-fuchsia-500/5 group-hover:text-fuchsia-500/10 transition-colors" />
            <h3 className="flex items-center gap-2 text-sm font-black text-fuchsia-500 uppercase tracking-widest mb-6">
               <Palmtree className="w-4 h-4" />
               Local Events
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {insights.festivals?.map((fest, idx) => (
                <div key={idx} className="flex items-center gap-3 bg-[var(--card-border)]/20 p-4 rounded-2xl border border-[var(--card-border)]">
                   <div className="w-2 h-2 rounded-full bg-fuchsia-500 shadow-[0_0_10px_rgba(217,70,239,0.5)]" />
                   <span className="text-xs font-black text-[var(--header-text)] uppercase">{fest}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* 3. Interactive Itinerary Section */}
        {itinerary.length > 0 && (
          <section className="space-y-6">
             <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black text-[var(--header-text)] italic tracking-tight uppercase flex items-center gap-3">
                  <Map className="w-6 h-6 text-indigo-500" />
                  Trip Itinerary
                </h2>
                <div className="flex gap-2">
                   {itinerary.map(day => (
                     <button 
                       key={day.day}
                       onClick={() => setActiveDay(day.day)}
                       className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                         activeDay === day.day 
                          ? 'bg-indigo-600 text-white shadow-lg' 
                          : 'bg-[var(--card-bg)] border border-[var(--card-border)] text-slate-400'
                       }`}
                     >
                       Day {day.day}
                     </button>
                   ))}
                </div>
             </div>

             <AnimatePresence mode="wait">
               <motion.div 
                 key={activeDay}
                 initial={{ opacity: 0, scale: 0.98 }}
                 animate={{ opacity: 1, scale: 1 }}
                 exit={{ opacity: 0, scale: 1.02 }}
                 className="bg-indigo-600/5 border border-indigo-600/20 rounded-3xl p-8"
               >
                 {itinerary.find(d => d.day === activeDay) && (
                   <div className="space-y-6">
                      <div className="flex items-center gap-4">
                         <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-xl font-black">
                           0{activeDay}
                         </div>
                         <div>
                            <h4 className="text-xl font-black text-indigo-600 uppercase tracking-tight">{itinerary.find(d => d.day === activeDay)?.title}</h4>
                            <p className="text-[10px] font-bold text-slate-400 tracking-[0.2em] uppercase mt-1">Daily Highlights</p>
                         </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         {itinerary.find(d => d.day === activeDay)?.activities.map((act, i) => (
                           <div key={i} className="flex items-center gap-4 bg-[var(--background)] p-5 rounded-2xl border border-[var(--card-border)] group hover:border-indigo-500/30 transition-colors">
                              <Clock className="w-5 h-5 text-indigo-500 opacity-40" />
                              <span className="text-sm font-bold text-[var(--header-text)]">{act}</span>
                           </div>
                         ))}
                      </div>
                   </div>
                 )}
               </motion.div>
             </AnimatePresence>
          </section>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
          {/* 4. Flight Intel */}
          <section className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-[var(--header-text)] italic tracking-tight uppercase flex items-center gap-3">
                 <Plane className="w-6 h-6 text-cyan-500" />
                 Flight Options
              </h2>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Select to Sync</span>
            </div>
            <div className="space-y-4">
              {flights.map((flight, idx) => (
                <motion.div 
                  key={idx}
                  onClick={() => setSelectedFlight(selectedFlight === idx ? null : idx)}
                  whileTap={{ scale: 0.98 }}
                  className={`relative group cursor-pointer border-2 transition-all p-6 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-6 ${
                    selectedFlight === idx 
                      ? 'bg-cyan-500/10 border-cyan-500 shadow-xl shadow-cyan-500/10' 
                      : 'bg-[var(--card-bg)] border-[var(--card-border)] hover:border-cyan-500/30'
                  }`}
                >
                  {selectedFlight === idx && (
                    <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-cyan-600 flex items-center justify-center text-white shadow-lg z-20">
                      <CheckCircle className="w-5 h-5" />
                    </div>
                  )}
                  
                  <div className="flex items-center gap-5 w-full">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center border border-[var(--card-border)] shadow-inner">
                      <Plane className="w-7 h-7 text-slate-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-black text-xl text-[var(--header-text)] tracking-tight uppercase leading-none">{flight.airline}</h4>
                      <div className="flex items-center gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-3">
                        <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> {flight.duration}</span>
                        <div className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                        <span className={flight.layovers.toLowerCase().includes('direct') ? 'text-emerald-500' : 'text-amber-500'}>{flight.layovers}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto mt-2 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-0 border-[var(--card-border)]">
                    <span className="text-3xl font-black text-cyan-600">{flight.price}</span>
                    <span className="text-[9px] uppercase tracking-widest font-black text-slate-400 opacity-60">P.P / Total</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          {/* 5. Hotel Intel */}
          <section className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-[var(--header-text)] italic tracking-tight uppercase flex items-center gap-3">
                 <Building className="w-6 h-6 text-indigo-500" />
                 Hotel Recommendations
              </h2>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Live Quotes</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {hotels.map((hotel, idx) => (
                <motion.div 
                  key={idx}
                  onClick={() => setSelectedHotel(selectedHotel === idx ? null : idx)}
                  whileTap={{ scale: 0.98 }}
                  className={`relative group cursor-pointer border-2 transition-all p-6 rounded-3xl flex flex-col justify-between min-h-[220px] ${
                    selectedHotel === idx 
                      ? 'bg-indigo-500/10 border-indigo-500 shadow-xl shadow-indigo-500/10' 
                      : 'bg-[var(--card-bg)] border-[var(--card-border)] hover:border-indigo-500/30'
                  }`}
                >
                  {selectedHotel === idx && (
                    <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white shadow-lg z-20">
                      <CheckCircle className="w-5 h-5" />
                    </div>
                  )}

                  <div className="space-y-4">
                     <div className="flex justify-between items-start">
                        <div className="flex flex-col gap-1">
                          <h4 className="font-black text-[var(--header-text)] leading-none uppercase text-lg tracking-tight">{hotel.name}</h4>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mt-2">
                            <MapPin className="w-3 h-3 text-indigo-500" />
                            {hotel.area}
                          </span>
                        </div>
                     </div>
                     <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                        <Sparkles className="w-3 h-3 text-amber-600" />
                        <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest">{hotel.rating}</span>
                     </div>
                  </div>
                  
                  <div className="flex items-end justify-between border-t border-[var(--card-border)] pt-4 mt-6">
                     <div className="flex flex-col">
                       <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Nightly Rate</span>
                       <span className="text-2xl font-black text-[var(--header-text)]">{hotel.price_per_night}</span>
                     </div>
                     <button className="p-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-500 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                       <ExternalLink className="w-4 h-4" />
                     </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        </div>

      </div>

      {/* 6. Tactical Action Bar (Floating) */}
      <AnimatePresence>
        {(selectedFlight !== null || selectedHotel !== null) && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] w-full max-w-2xl px-4"
          >
            <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 flex items-center justify-between shadow-2xl backdrop-blur-xl">
              <div className="flex items-center gap-6 px-4">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-1">Selections</span>
                  <div className="flex items-center gap-3">
                    {selectedFlight !== null && <Plane className="w-5 h-5 text-cyan-400" />}
                    {selectedHotel !== null && <Building className="w-5 h-5 text-indigo-400" />}
                  </div>
                </div>
                <div className="h-10 w-[1px] bg-white/10" />
                <div className="hidden sm:flex flex-col">
                  <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-1">Status</span>
                  <span className="text-xs font-black text-emerald-400 uppercase">Ready to Sync</span>
                </div>
              </div>

              <button 
                onClick={handleSyncToHub}
                disabled={isSyncing}
                className="flex items-center gap-3 bg-white text-black px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-emerald-400 transition-all disabled:opacity-50"
              >
                {isSyncing ? (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    <span>Syncing...</span>
                  </div>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Sync to Hub
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
