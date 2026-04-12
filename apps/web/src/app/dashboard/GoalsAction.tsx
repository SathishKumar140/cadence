'use client';

import { useState } from 'react';
import GoalsModal from './GoalsModal';

interface GoalsSectionProps {
  userId: string;
  initialGoals: {
    workout_per_week: number;
    learning_hours_per_week: number;
    social_events: number;
  };
  initialInterests: string[];
}

export default function GoalsAction({ userId, initialGoals, initialInterests = [] }: GoalsSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button 
        onClick={() => setIsModalOpen(true)}
        className="px-5 py-2.5 bg-[var(--card-bg)] hover:bg-[var(--card-hover-bg)] text-indigo-400 text-xs font-black tracking-tight uppercase rounded-2xl border border-[var(--card-border)] hover:border-indigo-500/30 transition-all duration-300"
      >
        Adjust Goals
      </button>

      {isModalOpen && (
        <GoalsModal 
          onClose={() => setIsModalOpen(false)} 
          userId={userId}
          initialGoals={initialGoals}
          initialInterests={initialInterests}
        />
      )}
    </>
  );
}
