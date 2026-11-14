'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Hydration 에러 방지
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // 로딩 중 플레이스홀더 (깜빡임 방지)
    return (
      <button
        className="flex h-10 w-10 items-center justify-center rounded-xl"
        aria-label="테마 로딩 중"
      >
        <div className="w-5 h-5" />
      </button>
    );
  }

  const isDark = theme === 'dark';

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={`
        flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-card hover:text-foreground
        ${isDark ? 'text-primary' : ''}
      `}
      aria-label={isDark ? '라이트테마로 전환' : '다크테마로 전환'}
      title={isDark ? '라이트테마' : '다크테마'}
    >
      {isDark ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="w-5 h-5" />
      )}
    </button>
  );
}
