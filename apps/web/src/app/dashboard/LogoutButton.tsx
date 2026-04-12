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
      className="flex items-center justify-center p-2 rounded-xl text-[var(--muted-text)] hover:text-rose-500 hover:bg-rose-500/5 transition-all duration-300 group"
      title="Sign Out"
    >
      <LogOut className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
    </button>
  );
}
