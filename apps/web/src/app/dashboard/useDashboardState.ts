'use client';

import { useState, useCallback } from 'react';
import { WeeklyPlanItem, DashboardInsights, DashboardGoals, DashboardMutation } from './DashboardContext';

export function useDashboardState(initial: { plan?: WeeklyPlanItem[], weekly_plan?: WeeklyPlanItem[], insights?: DashboardInsights, goals?: DashboardGoals } = {}) {
  const [plan, setPlan] = useState<WeeklyPlanItem[]>(initial?.plan || initial?.weekly_plan || []);
  const [insights, setInsights] = useState<DashboardInsights>(initial?.insights || { optimization_score: 0, insight_cards: [] });
  const [goals, setGoals] = useState<DashboardGoals>(initial?.goals || { workout_per_week: 0, learning_hours_per_week: 0, social_events: 0 });

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
    }
  }, []);

  return { 
    plan, 
    insights, 
    goals, 
    applyMutation, 
    setPlan, 
    setInsights, 
    setGoals 
  };
}
