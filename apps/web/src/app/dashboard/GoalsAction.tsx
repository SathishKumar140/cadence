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
        className="text-sm text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
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
