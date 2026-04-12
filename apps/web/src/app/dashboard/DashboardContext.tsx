'use client';

import { createContext, useContext, ReactNode } from 'react';

export interface WeeklyPlanItem {
  id: string;
  title: string;
  day: string;
  time: string;
  reason: string;
  is_discovery?: boolean;
  is_synced?: boolean;
  location?: string;
  discovery_source?: string;
  url?: string;
}

export interface DashboardInsights {
  optimization_score?: number;
  insight_cards?: {
    type: string;
    description: string;
    impact: string;
  }[];
}

export interface DashboardGoals {
  workout_per_week: number;
  learning_hours_per_week: number;
  social_events: number;
}

export interface DashboardMutation {
  target: 'weekly_plan' | 'goals' | 'insights' | 'routines' | 'emails' | 'listeners' | 'actions';
  action: 'add' | 'remove' | 'update' | 'replace';
  data: unknown; 
}

export interface Routine {
  id: string;
  name: string;
  description: string;
  schedule: string;
  alert_time: string | null;
  streak_count: number;
  done_today: boolean;
  last_completed: string | null;
}

export interface Goal {
  id: string;
  title: string;
  target_value: number;
  current_value: number;
  unit: string;
  category: string;
  progress_pct: number;
  deadline: string | null;
}

export interface ScheduledEmail {
  id: string;
  subject: string;
  body: string;
  recipient: string;
  send_at: string;
  status: string;
}

export interface TopicListener {
  id: string;
  topic: string;
  context_instruction: string;
  is_active: boolean;
}

export interface PendingAction {
  id: string;
  title: string;
  description: string;
  source_url: string | null;
  reasoning: string;
  status: string;
  created_at: string;
}

export interface DashboardState {
  userId: string;
  accessToken: string;
  plan: WeeklyPlanItem[];
  insights: DashboardInsights;
  goals: DashboardGoals; // Keeping for compatibility
  activeView: string;
  viewData: any;
  routines: Routine[];
  activeGoals: Goal[];
  emails: ScheduledEmail[];
  listeners: TopicListener[];
  pendingActions: PendingAction[];
  applyMutation: (mutation: DashboardMutation) => void;
  setPlan: (plan: WeeklyPlanItem[]) => void;
  setInsights: (insights: DashboardInsights) => void;
  setGoals: (goals: DashboardGoals) => void;
  setActiveView: (view: string) => void;
  setViewData: (data: any) => void;
  setRoutines: (routines: Routine[]) => void;
  setActiveGoals: (goals: Goal[]) => void;
  setEmails: (emails: ScheduledEmail[]) => void;
  setListeners: (listeners: TopicListener[]) => void;
  setPendingActions: (actions: PendingAction[]) => void;
}

const DashboardContext = createContext<DashboardState | undefined>(undefined);

export function DashboardProvider({ children, value }: { children: ReactNode, value: DashboardState }) {
  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
}
