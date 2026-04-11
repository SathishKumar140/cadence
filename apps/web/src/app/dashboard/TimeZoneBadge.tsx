'use client';

import { useEffect, useState } from 'react';
import { Globe } from 'lucide-react';

interface TimeZoneBadgeProps {
  userId: string;
  accessToken: string;
}

export default function TimeZoneBadge({ userId, accessToken }: TimeZoneBadgeProps) {
  const [tz, setTz] = useState<string>('');

  useEffect(() => {
    const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTz(detectedTz);
    
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

    // Trigger sync with the detected timezone
    fetch(`${apiUrl}/api/calendar/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: accessToken,
        user_id: userId,
        timezone: detectedTz
      })
    }).catch(e => console.error("FastAPI Sync Error:", e));
  }, [userId, accessToken]);

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--card-bg)] backdrop-blur-md border border-[var(--card-border)] text-xs text-[var(--muted-text)]">
      <Globe className="w-3 h-3 text-indigo-500" />
      <span>Timezone: <span className="text-[var(--header-text)] font-semibold">{tz || 'Detecting...'}</span></span>
    </div>
  );
}
