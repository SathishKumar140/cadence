'use client';

import React, { useState } from 'react';
import { 
  Plane, Building, MapPin, Calendar, Sun, 
  Palmtree, ArrowRight, ExternalLink, Sparkles, 
  CheckCircle, Plus, Info, Clock, Map, ChevronRight, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDashboard } from '../DashboardContext';

interface Flight {
  airline: string;
  price: string;
  layovers: string;
  duration: string;
  booking_url?: string;
}

interface Hotel {
  name: string;
  price_per_night: string;
  rating: string;
  area: string;
  image_url?: string;
  booking_url?: string;
}

interface ItineraryDay {
  day: number;
  title: string;
  image_url?: string;
  activities: string[];
}

interface TravelPlannerViewProps {
  data: {
    duration_days: number;
    trip_pace: string;
    interests: string[];
    included_stops?: string[];
    hero_image?: string;
    insights: {
      season?: string;
      festivals?: string[];
      route_logic?: string;
    };
    flights?: Flight[];
    hotels?: Hotel[];
    itinerary?: ItineraryDay[];
  };
}

export default function TravelPlannerView({ data }: TravelPlannerViewProps) {
  const { applyMutation, setActiveView } = useDashboard();
  const [selectedFlight, setSelectedFlight] = useState<number | null>(null);
  const [selectedHotel, setSelectedHotel] = useState<number | null>(null);
  const [activeDay, setActiveDay] = useState<number>(1);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);

  const {
    destination = "Destination",
    origin = "Origin",
    dates = "Upcoming",
    insights = { season: "", festivals: [] },
    flights = [],
    hotels = [],
    itinerary = []
  } = data || {};

  // use dynamic asset from props or fallback
  const heroImage = data?.hero_image || "/travel_hero.png";

  const handleSyncToHub = async () => {
    if (selectedFlight === null && selectedHotel === null) return;
    
    setIsSyncing(true);
    
    try {
      const flight = selectedFlight !== null ? flights[selectedFlight] : null;
      const hotel = selectedHotel !== null ? hotels[selectedHotel] : null;

      if (flight) {
        applyMutation({
          target: 'weekly_plan',
          action: 'add',
          data: {
            id: `flight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title: `Flight: ${flight.airline} to ${destination}`,
            day: "Monday", 
            time: "10:00",
            reason: "Confirmed travel booking",
            location: destination,
            is_discovery: false
          }
        });
      }

      if (hotel) {
        applyMutation({
          target: 'weekly_plan',
          action: 'add',
          data: {
            id: `hotel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title: `Hotel: ${hotel.name}`,
            day: "Tuesday",
            time: "14:00",
            reason: "Elite accommodation selection",
            location: hotel.area,
            is_discovery: false
          }
        });
      }

      setSyncSuccess(true);
      
      // Delay navigation slightly to let the user see the success state
      setTimeout(() => {
        setIsSyncing(false);
        setSyncSuccess(false);
        setSelectedFlight(null);
        setSelectedHotel(null);
        setActiveView('schedule');
      }, 1000);

    } catch (err) {
      console.error("Sync failed:", err);
      setIsSyncing(false);
    }
  };

  return (
    <div className="w-full h-full bg-slate-50 relative min-h-screen pb-24 overflow-x-hidden selection:bg-indigo-500/30 font-sans">
      {/* 0. Global Tactical Overlays */}
      <div className="fixed inset-0 pointer-events-none z-[100] opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />
      
      {/* 1. Cinematic Hero Section (Intelligence Briefing Style) */}
      <section className="relative w-full h-[220px] md:h-[300px] overflow-hidden bg-white">
        <motion.img 
          initial={{ scale: 1.1, filter: 'grayscale(0.5) brightness(0.8)' }}
          animate={{ scale: 1, filter: 'grayscale(0) brightness(1)' }}
          transition={{ duration: 10, ease: "linear" }}
          src={heroImage} 
          className="w-full h-full object-cover"
          alt={destination}
        />
        {/* Elite gradient overlay - Light Dossier Style */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-50 via-transparent to-white/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/40 to-transparent" />
        
        <div className="absolute bottom-6 md:bottom-10 left-6 md:left-12 z-20 space-y-5">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 bg-indigo-500/10 backdrop-blur-xl border border-indigo-500/20 px-3 py-1.5 rounded-sm w-fit"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_8px_rgba(79,70,229,0.8)]" />
            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em]">Intelligence Briefing</span>
          </motion.div>
          
          <div className="space-y-1">
             <h1 className="text-5xl md:text-8xl font-black text-slate-900 italic tracking-tighter uppercase leading-[0.85] drop-shadow-sm">
               {destination}
             </h1>
             <div className="h-1 w-24 bg-indigo-500/50 mt-6 rounded-full" />
             {data.included_stops && data.included_stops.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {data.included_stops.map(stop => (
                    <span key={stop} className="px-2 py-0.5 bg-white/80 backdrop-blur-sm border border-slate-200 rounded text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">
                      Incl. {stop}
                    </span>
                  ))}
                </div>
             )}
              <div className="flex flex-wrap items-center gap-3 text-slate-700 font-bold uppercase tracking-[0.15em] text-[10px] mt-4">
                <span className="flex items-center gap-1.5 bg-white shadow-xl shadow-black/5 px-3 py-1 rounded-md border border-slate-100">
                  <MapPin className="w-3 h-3 text-indigo-600" />
                  From {origin}
                </span>
                {insights.route_logic && (
                  <>
                    <div className="w-1 h-1 rounded-full bg-slate-300" />
                    <span className="flex items-center gap-2 bg-indigo-600 shadow-xl shadow-indigo-600/10 px-4 py-1.5 rounded-lg text-white animate-in slide-in-from-left duration-700">
                      <Zap className="w-3 h-3" />
                      Strategic Route: {insights.route_logic}
                    </span>
                  </>
                )}
              </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 md:px-10 mt-8 relative z-30 space-y-10 pb-20">
        
        {/* 2. Tactical Insights Row */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div 
            whileHover={{ y: -5, borderColor: 'rgba(245,158,11,0.3)' }}
            className="lg:col-span-1 bg-white backdrop-blur-md border border-slate-200 p-8 rounded-xl relative overflow-hidden group transition-all shadow-sm"
          >
            <Sun className="absolute -right-6 -top-6 w-32 h-32 text-amber-500/5 group-hover:text-amber-500/10 transition-colors" />
            <h3 className="flex items-center gap-3 text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] mb-4">
               <Sun className="w-4 h-4" />
               Climatology
            </h3>
            <p className="text-sm font-bold text-slate-600 leading-relaxed italic border-l-2 border-amber-500/30 pl-4">
              {insights.season}
            </p>
          </motion.div>

          <motion.div 
            whileHover={{ y: -5, borderColor: 'rgba(129,140,248,0.3)' }}
            className="lg:col-span-2 bg-white backdrop-blur-md border border-slate-200 p-8 rounded-xl relative overflow-hidden group transition-all shadow-sm"
          >
            <Palmtree className="absolute -right-6 -top-6 w-32 h-32 text-indigo-500/5 group-hover:text-indigo-500/10 transition-colors" />
            <h3 className="flex items-center gap-3 text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-6">
               <Palmtree className="w-4 h-4" />
               Regional Events
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {insights.festivals?.map((fest, idx) => (
                <div key={idx} className="flex items-center gap-3 bg-slate-50 p-4 rounded-lg border border-slate-100 hover:bg-slate-100 transition-colors">
                   <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.4)]" />
                   <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">{fest}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* 3. Interactive Itinerary Section */}
        {itinerary.length > 0 && (
          <section className="space-y-6">
             <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black text-slate-900 italic tracking-tight uppercase flex items-center gap-3">
                  <Map className="w-6 h-6 text-indigo-500" />
                  Trip Itinerary
                </h2>
                <div className="flex gap-2">
                   {itinerary.map(day => (
                     <button 
                       key={day.day}
                       onClick={() => setActiveDay(day.day)}
                       className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                         activeDay === day.day 
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30' 
                          : 'bg-white border-slate-200 text-slate-400 hover:border-slate-400'
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
                 className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm"
               >
                  {itinerary.find(d => d.day === activeDay) && (
                    <div className="space-y-6">
                       <div className="flex flex-col md:flex-row gap-6">
                          {/* Daily Highlight Image */}
                          {itinerary.find(d => d.day === activeDay)?.image_url && (
                            <div className="w-full md:w-1/3 h-[200px] rounded-2xl overflow-hidden shadow-lg border border-slate-100 shrink-0">
                               <img 
                                 src={itinerary.find(d => d.day === activeDay)?.image_url} 
                                 className="w-full h-full object-cover" 
                                 alt={itinerary.find(d => d.day === activeDay)?.title}
                               />
                            </div>
                          )}
                          
                          <div className="flex-1 space-y-4">
                            <div className="flex items-center gap-4">
                               <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-xl font-black shadow-lg shadow-indigo-600/20">
                                 0{activeDay}
                               </div>
                                <div>
                                   <h4 className="text-xl font-black text-indigo-600 uppercase tracking-tight">{itinerary.find(d => d.day === activeDay)?.title}</h4>
                                   <p className="text-[10px] font-bold text-slate-400 tracking-[0.2em] uppercase mt-1">Daily Highlights</p>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 gap-3">
                               {itinerary.find(d => d.day === activeDay)?.activities.map((act, i) => (
                               <div key={i} className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 group hover:border-indigo-500/30 transition-colors">
                                    <Clock className="w-4 h-4 text-indigo-500 opacity-40 shrink-0" />
                                    <span className="text-sm font-bold text-slate-700">{act}</span>
                                 </div>
                               ))}
                            </div>
                          </div>
                       </div>
                    </div>
                  )}
               </motion.div>
             </AnimatePresence>
          </section>
        )}

        <div className="flex flex-col gap-16">
          {/* 4. Flight Intel */}
          <section className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-slate-900 italic tracking-tight uppercase flex items-center gap-3">
                 <Plane className="w-6 h-6 text-indigo-600" />
                 Flight Options
              </h2>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Select to Sync</span>
            </div>
            <div className="flex flex-col gap-4">
              {flights.map((flight, idx) => (
                <motion.div 
                  key={idx}
                  onClick={() => setSelectedFlight(selectedFlight === idx ? null : idx)}
                  whileHover={{ x: 4 }}
                  className={`relative group cursor-pointer border transition-all rounded-sm overflow-hidden flex flex-col md:flex-row items-stretch ${
                    selectedFlight === idx 
                      ? 'border-indigo-600 bg-indigo-50 shadow-[0_0_30px_rgba(79,70,229,0.1)]' 
                      : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                  }`}
                >
                  {/* Visual Accent */}
                  <div className={`w-1 shrink-0 ${selectedFlight === idx ? 'bg-indigo-600' : 'bg-slate-200'}`} />

                  {/* Left Section: Airline Info */}
                  <div className="p-6 flex items-center gap-8 flex-1">
                    <div className="w-14 h-14 bg-slate-50 border border-slate-200 flex items-center justify-center rotate-45 group-hover:rotate-90 transition-transform duration-500">
                      <Plane className="w-6 h-6 text-indigo-600 -rotate-45 group-hover:-rotate-90 transition-transform duration-500" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-black text-2xl text-slate-900 tracking-widest uppercase leading-none">{flight.airline}</h4>
                      <div className="flex items-center gap-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-3">
                        <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-indigo-500/50" /> {flight.duration}</span>
                        <div className="w-1 h-1 rounded-full bg-slate-200" />
                        <span className={flight.layovers.toLowerCase().includes('direct') ? 'text-indigo-600' : 'text-amber-600'}>{flight.layovers}</span>
                      </div>
                    </div>
                  </div>

                  {/* Technical Center Section (Dossier Link) */}
                  <div className="hidden lg:flex items-center px-10 border-x border-slate-100">
                     <div className="w-24 h-[1px] bg-slate-200 relative">
                        <div className="absolute top-1/2 left-0 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-slate-300" />
                        <div className="absolute top-1/2 right-0 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-slate-300" />
                        <motion.div 
                          animate={{ x: [0, 96, 0] }}
                          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                          className="absolute top-1/2 left-0 -translate-y-1/2 w-1 h-1 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(79,70,229,0.4)]" 
                        />
                     </div>
                  </div>

                  {/* Right Section: Price & Portal */}
                  <div className="p-6 md:w-[220px] flex items-center justify-between gap-6 bg-slate-50/50">
                    <div className="text-right">
                       <span className="text-3xl font-black text-slate-900 block leading-none italic">{flight.price}</span>
                       <span className="text-[8px] uppercase tracking-[0.4em] font-black text-slate-400 mt-1 block">ECONOMY ELITE</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                       {flight.booking_url && (
                         <a 
                           href={flight.booking_url} 
                           target="_blank" 
                           rel="noopener noreferrer"
                           onClick={(e) => e.stopPropagation()}
                           className="p-3 bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-500/40 transition-all rounded-lg shadow-sm"
                         >
                           <ExternalLink className="w-4 h-4" />
                         </a>
                       )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          {/* 5. Hotel Intel */}
          <section className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-slate-900 italic tracking-tight uppercase flex items-center gap-3">
                 <Building className="w-6 h-6 text-indigo-600" />
                 Hotel Recommendations
              </h2>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Live Quotes</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {hotels.map((hotel, idx) => (
                <motion.div 
                  key={idx}
                  onClick={() => setSelectedHotel(selectedHotel === idx ? null : idx)}
                  whileHover={{ y: -8 }}
                  className={`relative group cursor-pointer transition-all rounded-xl overflow-hidden flex flex-col ${
                    selectedHotel === idx 
                      ? 'ring-2 ring-indigo-600 bg-indigo-50 border-transparent shadow-xl' 
                      : 'bg-white border border-slate-200 hover:border-slate-300 shadow-sm'
                  }`}
                >
                  {/* Hotel Image Hub */}
                  <div className="relative h-[220px] w-full overflow-hidden">
                    <img 
                      src={hotel.image_url || `https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80`} 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 grayscale-[0.2] group-hover:grayscale-0"
                      alt={hotel.name}
                    />
                    {/* Elite scanline on image */}
                    <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent opacity-95" />
                    <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-colors" />
                    
                    <div className="absolute top-4 right-4">
                       <div className="bg-white/80 backdrop-blur-xl px-3 py-1.5 rounded-sm flex items-center gap-2 border border-slate-200">
                          <Sparkles className="w-3 h-3 text-amber-500" />
                          <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{hotel.rating}</span>
                       </div>
                    </div>

                    <div className="absolute bottom-4 left-5 right-5">
                       <h4 className="font-black text-slate-900 text-2xl uppercase tracking-tighter leading-tight italic">{hotel.name}</h4>
                    </div>
                  </div>

                  <div className="p-6 flex flex-col justify-between flex-1">
                    <div className="space-y-4">
                       <div className="flex items-center gap-2 text-[9px] font-black text-indigo-600 uppercase tracking-[0.3em] opacity-80">
                          <MapPin className="w-3 h-3" />
                          {hotel.area}
                       </div>
                    </div>
                    
                    <div className="flex flex-col gap-4 mt-8 pt-5 border-t border-slate-100">
                       <div className="flex items-center justify-between">
                         <div className="flex flex-col">
                           <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Nightly Intel</span>
                           <span className="text-3xl font-black text-slate-900 italic leading-none">{hotel.price_per_night}</span>
                         </div>
                         
                         <div className="flex items-center gap-2">
                            {hotel.booking_url && (
                               <a 
                                 href={hotel.booking_url} 
                                 target="_blank" 
                                 rel="noopener noreferrer"
                                 onClick={(e) => e.stopPropagation()}
                                 className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest transition-all rounded-sm shadow-xl shadow-indigo-600/10"
                               >
                                 Access
                               </a>
                            )}
                         </div>
                       </div>
                    </div>
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
            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-2xl backdrop-blur-xl">
              <div className="flex items-center gap-6 px-4">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Selections</span>
                  <div className="flex items-center gap-3">
                    <Plane className={`w-5 h-5 ${selectedFlight !== null ? 'text-indigo-600' : 'text-slate-200'}`} />
                    <Building className={`w-5 h-5 ${selectedHotel !== null ? 'text-indigo-600' : 'text-slate-200'}`} />
                  </div>
                </div>
                <div className="h-10 w-[1px] bg-slate-200" />
                <div className="hidden sm:flex flex-col">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Status</span>
                  <span className="text-xs font-black text-emerald-600 uppercase">Ready to Sync</span>
                </div>
              </div>

              <button 
                onClick={handleSyncToHub}
                disabled={isSyncing || syncSuccess}
                className={`flex items-center gap-3 px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
                  syncSuccess 
                    ? 'bg-emerald-600 text-white' 
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 shadow-lg shadow-indigo-600/20'
                }`}
              >
                {isSyncing ? (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    <span>Processing...</span>
                  </div>
                ) : syncSuccess ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Synced Successfully
                  </>
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
