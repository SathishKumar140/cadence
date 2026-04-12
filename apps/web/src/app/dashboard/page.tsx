import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
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

  // 1. Fetch Core Dashboard Data
  let data = {
    insights: { optimization_score: 75, insight_cards: [] },
    weekly_plan: [],
    calendar_timezone: 'UTC',
    routines: [],
    activeGoals: [],
    emails: [],
    listeners: [],
    pendingActions: []
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
        initialData={data}
        initialSettings={settings} 
        initialAccessToken={accessToken}
        hasPreferences={hasPreferences}
    >
        {/* Children are now handled inside DashboardClientWrapper via DynamicViewCanvas */}
        <div />
    </DashboardClientWrapper>
  )
}
