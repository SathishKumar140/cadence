import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { Activity, Clock, Zap, Users, BookOpen, Target } from 'lucide-react';
import ScheduleList from './ScheduleList';
import LogoutButton from './LogoutButton';
import TimeZoneBadge from './TimeZoneBadge';
import GoalsAction from './GoalsAction';
import RegenerateButton from './RegenerateButton';
import MobileSettingsButton from './MobileSettingsButton';
import DashboardClientWrapper from './DashboardClientWrapper';

export default async function DashboardPage() {
  const supabase = createClient()
  
  // Hardened identity check
  const { data: { user } } = await supabase.auth.getUser()
  const { data: { session }, error } = await supabase.auth.getSession()

  if (error || !user || !session?.user) {
    redirect('/')
  }

  const accessToken = session.provider_token || '';
  let apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  if (apiUrl && !apiUrl.startsWith('http')) {
    apiUrl = `https://${apiUrl}`;
  }

  // 1. Fetch Dynamic Insights, Preferences & Settings
  let data = {
    insights: { optimization_score: 75, insight_cards: [] },
    weekly_plan: [],
    calendar_timezone: 'UTC'
  };

  let preferences = {
    goals: { workout_per_week: 3, learning_hours_per_week: 2, social_events: 1 },
    interests: [] as string[]
  };

  let settings = { theme: 'dark', ai_provider: 'openai', ai_api_key: '' };

  let hasPreferences = false;

  try {
    const [insightsRes, prefRes, settingsRes] = await Promise.all([
        fetch(`${apiUrl}/api/dashboard/insights?user_id=${user.id}`, { cache: 'no-store' }),
        fetch(`${apiUrl}/api/user/preferences?user_id=${user.id}`, { cache: 'no-store' }),
        fetch(`${apiUrl}/api/user/settings?user_id=${user.id}`, { cache: 'no-store' })
    ]);

    if (insightsRes.ok) data = await insightsRes.json();
    if (prefRes.ok) {
        preferences = await prefRes.json();
        // If the user has explicitly set interests, we consider them "onboarded"
        if (preferences.interests && preferences.interests.length > 0) {
            hasPreferences = true;
        }
    }
    if (settingsRes.ok) settings = await settingsRes.json();
  } catch (e) {
    console.error("Failed to fetch dashboard data:", e);
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'productivity': return <Zap className="w-5 h-5" />;
      case 'wellness': return <Activity className="w-5 h-5" />;
      case 'learning': return <BookOpen className="w-5 h-5" />;
      case 'social': return <Users className="w-5 h-5" />;
      case 'focus': return <Target className="w-5 h-5" />;
      default: return <Clock className="w-5 h-5" />;
    }
  };

  const getColors = (type: string) => {
    switch (type) {
      case 'productivity': return {
        bg: 'bg-blue-500/10',
        text: 'text-blue-500 dark:text-blue-400',
        border: 'border-blue-500/20',
        glow: 'shadow-blue-500/20',
        bar: 'bg-blue-500'
      };
      case 'wellness': return {
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-500 dark:text-emerald-400',
        border: 'border-emerald-500/20',
        glow: 'shadow-emerald-500/20',
        bar: 'bg-emerald-500'
      };
      case 'learning': return {
        bg: 'bg-purple-500/10',
        text: 'text-purple-500 dark:text-purple-400',
        border: 'border-purple-500/20',
        glow: 'shadow-purple-500/20',
        bar: 'bg-purple-500'
      };
      case 'social': return {
        bg: 'bg-orange-500/10',
        text: 'text-orange-500 dark:text-orange-400',
        border: 'border-orange-500/20',
        glow: 'shadow-orange-500/20',
        bar: 'bg-orange-500'
      };
      case 'focus': return {
        bg: 'bg-rose-500/10',
        text: 'text-rose-500 dark:text-rose-400',
        border: 'border-rose-500/20',
        glow: 'shadow-rose-500/20',
        bar: 'bg-rose-500'
      };
      default: return {
        bg: 'bg-slate-500/10',
        text: 'text-slate-500 dark:text-slate-400',
        border: 'border-slate-500/20',
        glow: 'shadow-slate-500/20',
        bar: 'bg-slate-500'
      };
    }
  };

  return (
    <DashboardClientWrapper 
        userId={user.id} 
        initialData={data}
        initialSettings={settings} 
        hasPreferences={hasPreferences}
    >
        <div className="w-full max-w-4xl mx-auto py-8 sm:py-12 px-4 sm:px-6 relative z-10 transition-all duration-500">
            {/* Desktop Header — Re-balanced for 50% width */}
            <header className="hidden lg:flex flex-col border-b border-slate-200 dark:border-slate-800/50 pb-6 mb-8 gap-4">
                <div className="flex-1">
                    <h1 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-[var(--header-text)] to-slate-500 dark:to-slate-400">
                        Hi, {user.user_metadata?.full_name?.split(' ')[0] || 'User'}
                    </h1>
                    <div className="flex items-center gap-3 mt-1">
                        <p className="text-[var(--muted-text)] font-semibold text-[10px] uppercase tracking-widest opacity-60">Status: Optimized</p>
                        <TimeZoneBadge userId={user.id} accessToken={accessToken} />
                    </div>
                </div>
                
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/30">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full border border-indigo-500/30 p-0.5 overflow-hidden ring-4 ring-indigo-500/5 bg-slate-100">
                            <img src={user.user_metadata?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix'} alt="Profile" className="w-full h-full object-cover rounded-full" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-[var(--header-text)] leading-none">{user.user_metadata?.full_name || 'User'}</span>
                            <span className="text-[8px] text-slate-500 font-medium">Weekly Efficiency</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 pr-2">
                        <div className="relative w-10 h-10 flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="3" fill="transparent" className="text-slate-200 dark:text-slate-800" />
                                <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="3" fill="transparent"
                                    strokeDasharray={113} strokeDashoffset={113 - (113 * data.insights.optimization_score) / 100}
                                    strokeLinecap="round" className="text-indigo-500 transition-all duration-1000 ease-out" />
                            </svg>
                            <span className="absolute text-[10px] font-black text-[var(--header-text)]">{data.insights.optimization_score}</span>
                        </div>
                        <LogoutButton />
                    </div>
                </div>
            </header>

            {/* Mobile Header (Fallback) */}
            <header className="lg:hidden flex items-center justify-between border-b border-slate-200 dark:border-slate-800/50 pb-4 mb-4 gap-3">
                <div className="flex-1 min-w-0">
                    <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-[var(--header-text)] to-slate-500 dark:to-slate-400 truncate">
                        {user.user_metadata?.full_name?.split(' ')[0] || 'User'}
                    </h1>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <MobileSettingsButton />
                    <LogoutButton />
                </div>
            </header>

            {/* Action Bar */}
            <div className="flex items-center justify-between mb-8 bg-[var(--card-bg)] backdrop-blur-xl border border-[var(--card-border)] p-3 rounded-2xl relative z-40 shadow-sm">
                <div className="flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-indigo-500" />
                    <h2 className="text-[10px] font-black text-[var(--header-text)] uppercase tracking-widest opacity-60">Control</h2>
                </div>
                <div className="flex items-center gap-2">
                    <RegenerateButton userId={user.id} />
                    <GoalsAction 
                        userId={user.id} 
                        initialGoals={preferences.goals} 
                        initialInterests={preferences.interests || []} 
                    />
                </div>
            </div>

            {/* Insights Section */}
            <section className="mb-12 relative z-0">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-black italic tracking-tight text-[var(--header-text)]">Strategic Insights</h2>
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest hidden sm:block">AI Scout</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {data.insights.insight_cards.map((card: { title: string; description: string; score_type?: string; impact?: number }, idx) => {
                    const styles = getColors(card.score_type || '');
                    return (
                    <div key={idx} className="group relative bg-[var(--card-bg)] border border-[var(--card-border)] p-5 rounded-2xl hover:bg-[var(--card-hover-bg)] transition-all duration-300 overflow-hidden">
                        <div className="relative z-10">
                            <div className="flex items-start gap-4 mb-3">
                                <div className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center ${styles.bg} ${styles.text} border ${styles.border}`}>
                                    {getIcon(card.score_type || '')}
                                </div>
                                <h3 className="text-sm font-bold text-[var(--header-text)] leading-tight">{card.title}</h3>
                            </div>
                            <p className="text-[11px] text-[var(--muted-text)] leading-relaxed mb-4 line-clamp-3">{card.description}</p>
                            <div className="w-full h-1 bg-slate-100 dark:bg-slate-800/50 rounded-full overflow-hidden">
                                <div className={`h-full ${styles.bar}`} style={{ width: `${card.impact || 70}%` }} />
                            </div>
                        </div>
                    </div>
                    );
                })}
                </div>
            </section>

            <section>
                <ScheduleList 
                    accessToken={accessToken} 
                    userId={user.id} 
                    calendarTimezone={data.calendar_timezone || 'UTC'}
                />
            </section>
        </div>
    </DashboardClientWrapper>
  )
}
