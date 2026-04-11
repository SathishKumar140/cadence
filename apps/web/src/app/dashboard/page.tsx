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
        initialSettings={settings} 
        hasPreferences={hasPreferences}
    >
        <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] p-4 sm:p-8 pt-6 sm:pt-12 relative overflow-hidden transition-colors duration-500">
        {/* Background gradients */}
        <div className="absolute top-0 right-0 w-[40%] h-[40%] bg-indigo-600/[0.05] dark:bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none animate-pulse" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-violet-600/[0.05] dark:bg-violet-600/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute top-[30%] left-[20%] w-[20%] h-[20%] bg-indigo-400/[0.02] dark:bg-indigo-400/5 blur-[100px] rounded-full pointer-events-none" />

        <main className="max-w-6xl mx-auto z-10 relative">
            {/* Mobile Header — compact single row */}
            <header className="lg:hidden flex items-center justify-between border-b border-slate-200 dark:border-slate-800/50 pb-4 mb-4 gap-3">
                <div className="flex-1 min-w-0">
                    <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-[var(--header-text)] to-slate-500 dark:to-slate-400 truncate">
                        Hi, {user.user_metadata?.full_name?.split(' ')[0] || 'User'}
                    </h1>
                    <p className="text-[10px] text-[var(--muted-text)] font-medium mt-0.5">Weekly overview</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <div className="relative w-9 h-9 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 56 56">
                            <circle cx="28" cy="28" r="24" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-slate-200 dark:text-slate-800" />
                            <circle cx="28" cy="28" r="24" stroke="currentColor" strokeWidth="4" fill="transparent"
                                strokeDasharray={151} strokeDashoffset={151 - (151 * data.insights.optimization_score) / 100}
                                strokeLinecap="round" className="text-indigo-500" />
                        </svg>
                        <span className="absolute text-[10px] font-bold text-[var(--header-text)]">{data.insights.optimization_score}</span>
                    </div>
                    <div className="w-8 h-8 rounded-full border border-indigo-500/30 p-0.5 overflow-hidden ring-2 ring-indigo-500/5 bg-slate-100">
                        <img src={user.user_metadata?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix'} alt="Profile" className="w-full h-full object-cover rounded-full" />
                    </div>
                    <MobileSettingsButton />
                    <LogoutButton />
                </div>
            </header>

            {/* Desktop Header — spacious layout */}
            <header className="hidden lg:flex items-center justify-between border-b border-slate-200 dark:border-slate-800/50 pb-8 mb-8 gap-6">
                <div className="flex-1">
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[var(--header-text)] to-slate-500 dark:to-slate-400">
                        Welcome back, {user.user_metadata?.full_name?.split(' ')[0] || 'User'}
                    </h1>
                    <div className="flex items-center gap-3 mt-2">
                        <p className="text-[var(--muted-text)] font-medium text-sm">Weekly overview</p>
                        <TimeZoneBadge userId={user.id} accessToken={accessToken} />
                    </div>
                </div>
                <div className="flex items-center gap-8">
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-sm font-semibold text-[var(--muted-text)] opacity-80 uppercase tracking-widest leading-none mb-1">Optimization</p>
                            <p className="text-[10px] text-[var(--muted-text)] opacity-60 font-medium italic">Weekly Efficiency</p>
                        </div>
                        <div className="relative w-14 h-14 flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle cx="28" cy="28" r="24" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-slate-200 dark:text-slate-800" />
                                <circle cx="28" cy="28" r="24" stroke="currentColor" strokeWidth="4" fill="transparent"
                                    strokeDasharray={151} strokeDashoffset={151 - (151 * data.insights.optimization_score) / 100}
                                    strokeLinecap="round" className="text-indigo-500 transition-all duration-1000 ease-out" />
                            </svg>
                            <span className="absolute text-base font-bold text-[var(--header-text)]">{data.insights.optimization_score}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 border-l border-slate-200 dark:border-slate-800 pl-8">
                        <div className="w-10 h-10 rounded-full border border-indigo-500/30 p-0.5 overflow-hidden ring-4 ring-indigo-500/5 bg-slate-100">
                            <img src={user.user_metadata?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix'} alt="Profile" className="w-full h-full object-cover rounded-full" />
                        </div>
                        <LogoutButton />
                    </div>
                </div>
            </header>

            {/* Action Bar */}
            <div className="flex items-center justify-between mb-4 sm:mb-8 bg-[var(--card-bg)] backdrop-blur-xl border border-[var(--card-border)] p-3 sm:p-4 rounded-2xl sm:rounded-[2rem] relative z-40 shadow-sm overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center gap-2 relative z-10">
                <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-500 shrink-0" />
                <h2 className="text-[10px] sm:text-sm font-bold text-[var(--header-text)] uppercase tracking-[0.15em] sm:tracking-[0.2em] opacity-80 hidden xs:block">
                Command
                </h2>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 relative z-10">
                <RegenerateButton userId={user.id} />
                <div className="w-px h-5 bg-slate-200 dark:bg-slate-800 hidden sm:block" />
                <GoalsAction 
                    userId={user.id} 
                    initialGoals={preferences.goals} 
                    initialInterests={preferences.interests || []} 
                />
            </div>
            </div>

            {/* Insights Section */}
            <section className="mb-8 sm:mb-16 relative z-0">
                <div className="flex items-center justify-between mb-4 sm:mb-8">
                <h2 className="text-lg sm:text-2xl font-black flex items-center gap-2 sm:gap-3 italic tracking-tight text-[var(--header-text)]">
                    <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-500" />
                    Strategic Insights
                </h2>
                <span className="text-[8px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] sm:tracking-[0.3em] hidden sm:block">Scouted Opportunities</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {data.insights.insight_cards.map((card: { title: string; description: string; score_type?: string; impact?: number }, idx) => {
                    const styles = getColors(card.score_type || '');
                    return (
                    <div key={idx} className="group relative bg-[var(--card-bg)] backdrop-blur-2xl border border-[var(--card-border)] p-5 rounded-3xl hover:bg-[var(--card-hover-bg)] transition-all duration-500 hover:scale-[1.02] shadow-sm hover:shadow-xl dark:shadow-none overflow-hidden">
                        {/* Glow effect on hover */}
                        <div className={`absolute -top-12 -right-12 w-24 h-24 rounded-full blur-[40px] opacity-0 group-hover:opacity-20 transition-opacity duration-700 ${styles.bg}`} />
                        
                        <div className="relative z-10">
                        <div className="flex items-center gap-4 mb-4">
                            <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6 ${styles.bg} ${styles.text} border ${styles.border} ${styles.glow} shadow-lg shadow-indigo-500/5`}>
                                {getIcon(card.score_type || '')}
                            </div>
                            <h3 className="text-base font-bold text-[var(--header-text)] tracking-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors leading-tight line-clamp-2">{card.title}</h3>
                        </div>
                        
                        <div className="mb-4">
                            <p className="text-xs text-[var(--muted-text)] leading-relaxed font-medium line-clamp-3">{card.description}</p>
                        </div>

                        <div className="pt-4 border-t border-slate-100 dark:border-slate-800/50 flex flex-col gap-2">
                            <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                            <span>Impact</span>
                            <span className={styles.text}>{card.impact || 70}%</span>
                            </div>
                            <div className="w-full h-1 bg-slate-100 dark:bg-slate-800/50 rounded-full overflow-hidden">
                            <div 
                                className={`h-full ${styles.bar} transition-all duration-1000 ease-out delay-300`} 
                                style={{ width: `${card.impact || 70}%` }}
                            />
                            </div>
                        </div>
                        </div>
                    </div>
                    );
                })}
                </div>
            </section>

            {/* Planner Section */}
            <section>
                <ScheduleList 
                    plan={data.weekly_plan} 
                    accessToken={accessToken} 
                    userId={user.id} 
                    calendarTimezone={data.calendar_timezone || 'UTC'}
                />
            </section>

        </main>
        </div>
    </DashboardClientWrapper>
  )
}



