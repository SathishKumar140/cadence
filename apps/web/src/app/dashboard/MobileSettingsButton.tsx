'use client';

import { Settings } from 'lucide-react';

export default function MobileSettingsButton() {
  return (
    <button
      onClick={() => {
        // Trigger the hidden settings button in DashboardClientWrapper
        const trigger = document.getElementById('mobile-settings-trigger');
        if (trigger) trigger.click();
      }}
      className="p-1.5 text-[var(--muted-text)] hover:text-[var(--header-text)] transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
      title="Settings"
    >
      <Settings className="w-4 h-4" />
    </button>
  );
}
