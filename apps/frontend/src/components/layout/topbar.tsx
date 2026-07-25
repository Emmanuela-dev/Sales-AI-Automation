'use client';

import { Bell, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { getFollowUps } from '@/lib/api';
import { Badge } from '@/components/ui/badge';

export function TopBar() {
  const { theme, setTheme } = useTheme();

  const { data } = useQuery({
    queryKey: ['follow-ups'],
    queryFn: getFollowUps,
    refetchInterval: 60_000, // refresh every minute
  });

  const pendingCount = data?.follow_ups?.length ?? 0;

  return (
    <header className="flex items-center justify-end gap-2 px-6 py-3 border-b bg-card">
      {/* Follow-up bell */}
      <Button variant="ghost" size="icon" className="relative" aria-label="Follow-up alerts">
        <Bell className="h-4 w-4" />
        {pendingCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-4 w-4 rounded-full p-0 text-[10px] flex items-center justify-center"
          >
            {pendingCount > 9 ? '9+' : pendingCount}
          </Badge>
        )}
      </Button>

      {/* Theme toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        aria-label="Toggle theme"
      >
        <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      </Button>
    </header>
  );
}
