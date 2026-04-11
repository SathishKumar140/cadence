'use client';

import { useState, useCallback } from 'react';

export function useDashboardState(initial: { plan?: any[], weekly_plan?: any[], insights?: any, goals?: any } = {}) {
  const [plan, setPlan] = useState(initial?.plan || initial?.weekly_plan || []);
  const [insights, setInsights] = useState(initial?.insights || { optimization_score: 0, insight_cards: [] });
  const [goals, setGoals] = useState(initial?.goals || { workout_per_week: 0, learning_hours_per_week: 0, social_events: 0 });

  const applyMutation = useCallback((mutation: any) => {
    switch (mutation.target) {
      case 'weekly_plan':
        if (mutation.action === 'add') {
          setPlan(prev => [...prev, mutation.data]);
        } else if (mutation.action === 'remove') {
          setPlan(prev => prev.filter((i: any) => i.id !== mutation.data.id));
        } else if (mutation.action === 'update') {
          setPlan(prev => prev.map((i: any) => i.id === mutation.data.id ? mutation.data : i));
        } else if (mutation.action === 'replace') {
          setPlan(mutation.data);
        }
        break;
      case 'goals':
        if (mutation.action === 'update') {
          setGoals((prev: any) => ({ ...prev, ...mutation.data }));
        }
        break;
      case 'insights':
        if (mutation.action === 'update') {
            setInsights((prev: any) => ({ ...prev, ...mutation.data }));
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
