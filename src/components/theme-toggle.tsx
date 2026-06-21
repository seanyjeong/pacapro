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
        className="p-2 rounded-lg bg-secondary"
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
        p-2 rounded-lg transition-all duration-300
        ${isDark
          ? 'bg-primary/10 hover:bg-primary/20 text-accent'
          : 'bg-secondary hover:bg-muted text-muted-foreground'
        }
      `}
      aria-label={isDark ? '라이트테마로 전환' : '다크테마로 전환'}
      title={isDark ? '라이트테마' : '다크테마'}
    >
      {isDark ? (
        <Sun className="w-5 h-5 text-cyan-400" />
      ) : (
        <Moon className="w-5 h-5" />
      )}
    </button>
  );
}
