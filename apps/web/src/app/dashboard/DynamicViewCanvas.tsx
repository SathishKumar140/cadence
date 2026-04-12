'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDashboard } from './DashboardContext';
import ScheduleView from './views/ScheduleView';
import LinkedInComposerView from './views/LinkedInComposerView';
import TimeSlotsView from './views/TimeSlotsView';
import RoutineDashboardView from './views/RoutineDashboardView';
import EmailSchedulerView from './views/EmailSchedulerView';
import GoalEditorView from './views/GoalEditorView';
import DiscoveriesView from './views/DiscoveriesView';
import ReviewCenterView from './views/ReviewCenterView';

export default function DynamicViewCanvas() {
  const { activeView, viewData } = useDashboard();

  const renderView = () => {
    switch (activeView) {
      case 'schedule':
        return <ScheduleView />;
      case 'linkedin_composer':
        return <LinkedInComposerView data={viewData || {}} />;
      case 'time_slots':
        return <TimeSlotsView data={viewData || {}} />;
      case 'routine_dashboard':
        return <RoutineDashboardView data={viewData || {}} />;
      case 'email_scheduler':
        return <EmailSchedulerView data={viewData || {}} />;
      case 'goal_editor':
        return <GoalEditorView data={viewData || {}} />;
      case 'discoveries':
        return <DiscoveriesView data={viewData || {}} />;
      case 'review_center':
        return <ReviewCenterView data={viewData || {}} />;
      default:
        return <ScheduleView />;
    }
  };

  return (
    <div className="relative w-full h-full min-h-screen">
      <AnimatePresence mode="wait">
        <motion.div
          key={activeView}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          className="w-full h-full"
        >
          {renderView()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
