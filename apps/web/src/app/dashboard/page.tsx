import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import DashboardClientWrapper from './DashboardClientWrapper';
import { 
  DashboardInsights, 
  WeeklyPlanItem, 
  Routine, 
  Goal, 
  ScheduledEmail, 
  TopicListener, 
  PendingAction 
} from './DashboardContext';

export default async function DashboardPage() {
  const supabase = createClient()
  
  // Hardened identity check
  const { data: { user } } = await supabase.auth.getUser()
  const { data: { session }, error } = await supabase.auth.getSession()

  if (error || !user || !session?.user) {
    redirect('/')
  }

  const accessToken = session.provider_token || '';
  const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '').startsWith('http') 
    ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '')
    : `https://${(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '')}`;

  // 1. Fetch Core Dashboard Data
  const data = {
    insights: { optimization_score: 75, insight_cards: [] } as DashboardInsights,
    weekly_plan: [] as WeeklyPlanItem[],
    calendar_timezone: 'UTC',
    routines: [] as Routine[],
    activeGoals: [] as Goal[],
    emails: [] as ScheduledEmail[],
    listeners: [] as TopicListener[],
    pendingActions: [] as PendingAction[]
  };

  let preferences = {
    goals: { workout_per_week: 3, learning_hours_per_week: 2, social_events: 1 },
    interests: [] as string[]
  };

  let settings = { theme: 'dark', ai_provider: 'openai', ai_api_key: '' };

  let hasPreferences = false;

  try {
    const [insightsRes, prefRes, settingsRes, routinesRes, goalsRes, emailsRes, listenersRes, actionsRes] = await Promise.all([
        fetch(`${apiUrl}/api/dashboard/insights?user_id=${user.id}`, { cache: 'no-store' }),
        fetch(`${apiUrl}/api/user/preferences?user_id=${user.id}`, { cache: 'no-store' }),
        fetch(`${apiUrl}/api/user/settings?user_id=${user.id}`, { cache: 'no-store' }),
        fetch(`${apiUrl}/api/routines?user_id=${user.id}`, { cache: 'no-store' }),
        fetch(`${apiUrl}/api/goals?user_id=${user.id}`, { cache: 'no-store' }),
        fetch(`${apiUrl}/api/emails?user_id=${user.id}`, { cache: 'no-store' }),
        fetch(`${apiUrl}/api/listeners?user_id=${user.id}`, { cache: 'no-store' }),
        fetch(`${apiUrl}/api/actions/pending?user_id=${user.id}`, { cache: 'no-store' })
    ]);

    if (insightsRes.ok) {
        const insightsData = await insightsRes.ok ? await insightsRes.json() : null;
        if (insightsData) {
            data.insights = insightsData.insights;
            data.weekly_plan = insightsData.weekly_plan;
            data.calendar_timezone = insightsData.calendar_timezone;
        }
    }
    if (prefRes.ok) {
        preferences = await prefRes.json();
        if (preferences.interests && preferences.interests.length > 0) {
            hasPreferences = true;
        }
    }
    if (settingsRes.ok) settings = await settingsRes.json();
    if (routinesRes.ok) data.routines = await routinesRes.json();
    if (goalsRes.ok) data.activeGoals = await goalsRes.json();
    if (emailsRes.ok) data.emails = await emailsRes.json();
    if (listenersRes.ok) data.listeners = await listenersRes.json();
    if (actionsRes.ok) data.pendingActions = await actionsRes.json();

  } catch (e) {
    console.error("Failed to fetch dashboard data:", e);
  }

  return (
    <DashboardClientWrapper 
        userId={user.id} 
        user={{ 
          email: user.email, 
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Strategic Partner',
          avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture
        }}
        initialData={data}
        initialSettings={settings} 
        initialAccessToken={accessToken}
        hasPreferences={hasPreferences}
    />
  )
}
