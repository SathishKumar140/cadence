'use client';

import { createContext, useContext, ReactNode } from 'react';

export interface DashboardState {
  plan: any[];
  insights: any;
  goals: any;
  applyMutation: (mutation: any) => void;
  setPlan: (plan: any[]) => void;
  setInsights: (insights: any) => void;
  setGoals: (goals: any) => void;
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
