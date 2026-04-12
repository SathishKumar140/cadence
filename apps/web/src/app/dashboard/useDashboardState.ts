'use client';

import { useState, useCallback } from 'react';
import { WeeklyPlanItem, DashboardInsights, DashboardGoals, DashboardMutation, Routine, Goal, ScheduledEmail, TopicListener, PendingAction, KnowledgeItem } from './DashboardContext';

export function useDashboardState(initial: { 
  userId: string,
  accessToken: string,
  plan?: WeeklyPlanItem[], 
  weekly_plan?: WeeklyPlanItem[], 
  insights?: DashboardInsights, 
  goals?: DashboardGoals,
  routines?: Routine[],
  activeGoals?: Goal[],
  emails?: ScheduledEmail[],
  listeners?: TopicListener[],
  pendingActions?: PendingAction[],
  knowledgeItems?: KnowledgeItem[]
}) {
  const [plan, setPlan] = useState<WeeklyPlanItem[]>(initial?.plan || initial?.weekly_plan || []);
  const [insights, setInsights] = useState<DashboardInsights>(initial?.insights || { optimization_score: 0, insight_cards: [] });
  const [goals, setGoals] = useState<DashboardGoals>(initial?.goals || { workout_per_week: 0, learning_hours_per_week: 0, social_events: 0 });
  
  // Dynamic UI State
  const [activeView, setActiveView] = useState<string>('schedule');
  const [viewData, setViewData] = useState<Record<string, unknown> | null>(null);
  
  // Skill Data State
  const [routines, setRoutines] = useState<Routine[]>(initial?.routines || []);
  const [activeGoals, setActiveGoals] = useState<Goal[]>(initial?.activeGoals || []);
  const [emails, setEmails] = useState<ScheduledEmail[]>(initial?.emails || []);
  const [listeners, setListeners] = useState<TopicListener[]>(initial?.listeners || []);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>(initial?.pendingActions || []);
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>(initial?.knowledgeItems || []);
  const [reviewFilters, setReviewFilters] = useState<{ topic: string | null }>({ topic: null });

  const applyMutation = useCallback((mutation: DashboardMutation) => {
    switch (mutation.target) {
      case 'weekly_plan':
        if (mutation.action === 'add') {
          setPlan(prev => [...prev, mutation.data as WeeklyPlanItem]);
        } else if (mutation.action === 'remove') {
          setPlan(prev => prev.filter(i => i.id !== (mutation.data as WeeklyPlanItem).id));
        } else if (mutation.action === 'update') {
          setPlan(prev => prev.map(i => i.id === (mutation.data as WeeklyPlanItem).id ? (mutation.data as WeeklyPlanItem) : i));
        } else if (mutation.action === 'replace') {
          setPlan(mutation.data as WeeklyPlanItem[]);
        }
        break;
      case 'goals':
        if (mutation.action === 'update') {
          setGoals(prev => ({ ...prev, ...(mutation.data as Partial<DashboardGoals>) }));
        }
        break;
      case 'insights':
        if (mutation.action === 'update') {
            setInsights(prev => ({ ...prev, ...(mutation.data as Partial<DashboardInsights>) }));
        }
        break;
      case 'routines':
        if (mutation.action === 'add') {
          setRoutines(prev => [...prev, mutation.data as Routine]);
        } else if (mutation.action === 'update') {
          setRoutines(prev => prev.map(r => r.id === (mutation.data as Routine).id ? { ...r, ...(mutation.data as Partial<Routine>) } : r));
        }
        break;
      case 'emails':
        if (mutation.action === 'add') {
          setEmails(prev => [...prev, mutation.data as ScheduledEmail]);
        }
        break;
      case 'listeners':
        if (mutation.action === 'add') {
          setListeners(prev => [...prev, mutation.data as TopicListener]);
        } else if (mutation.action === 'replace') {
          setListeners(mutation.data as TopicListener[]);
        } else if (mutation.action === 'remove') {
          setListeners(prev => prev.filter(l => l.id !== (mutation.data as { id: string }).id));
        } else if (mutation.action === 'update') {
          setListeners(prev => prev.map(l => l.id === (mutation.data as { id: string }).id ? { ...l, ...(mutation.data as Partial<TopicListener>) } : l));
        }
        break;
      case 'actions':
        if (mutation.action === 'add') {
          setPendingActions(prev => [...prev, mutation.data as PendingAction]);
        } else if (mutation.action === 'remove') {
          setPendingActions(prev => prev.filter(a => a.id !== (mutation.data as { id: string }).id));
        } else if (mutation.action === 'replace') {
          setPendingActions(mutation.data as PendingAction[]);
        }
        break;
      case 'knowledge':
        if (mutation.action === 'add') {
          setKnowledgeItems(prev => [mutation.data as KnowledgeItem, ...prev]);
        } else if (mutation.action === 'replace') {
          setKnowledgeItems(mutation.data as KnowledgeItem[]);
        }
        break;
    }
  }, []);

  return { 
    userId: initial.userId,
    accessToken: initial.accessToken,
    plan, 
    insights, 
    goals, 
    activeView,
    viewData,
    routines,
    activeGoals,
    emails,
    listeners,
    pendingActions,
    knowledgeItems,
    applyMutation, 
    setPlan, 
    setInsights, 
    setGoals,
    setActiveView,
    setViewData,
    setRoutines,
    setActiveGoals,
    setEmails,
    setListeners,
    setPendingActions,
    setKnowledgeItems,
    reviewFilters,
    setReviewFilters
  };
}
