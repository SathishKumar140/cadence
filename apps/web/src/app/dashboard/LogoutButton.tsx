'use client';

import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';

export default function LogoutButton() {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <button
      onClick={handleLogout}
      className="flex items-center gap-2 p-2 sm:px-4 sm:py-2 text-sm font-medium text-[var(--muted-text)] hover:text-[var(--header-text)] transition-colors border border-[var(--card-border)] rounded-full hover:bg-[var(--card-bg)] backdrop-blur-sm"
      title="Sign Out"
    >
      <LogOut className="w-4 h-4" />
      <span className="hidden sm:inline">Sign Out</span>
    </button>
  );
}
