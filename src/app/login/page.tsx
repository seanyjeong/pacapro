'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthPageShell } from '@/features/auth/auth-page-shell';
import { authAPI } from '@/lib/api/auth';
import { onboardingAPI } from '@/lib/api/onboarding';

const LOGIN_ERROR_MESSAGE = '이메일 또는 비밀번호가 맞지 않습니다.';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authAPI.login({ email, password }, { suppressErrorToast: true });

      localStorage.setItem('token', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
      document.cookie = `paca_auth=1; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;

      if (response.user.role === 'owner') {
        try {
          const onboardingStatus = await onboardingAPI.getStatus();
          if (!onboardingStatus.onboarding_completed) {
            window.location.href = '/onboarding';
            return;
          }
        } catch {
          // 온보딩 상태 확인 실패 시 대시보드로 이동합니다.
        }
      }

      window.location.href = '/';
    } catch (err: unknown) {
      console.warn('로그인에 실패했습니다.', err);
      setError(LOGIN_ERROR_MESSAGE);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageShell
      icon={<LogIn className="h-6 w-6" />}
      title="로그인"
      description="운영 계정으로 접속합니다."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">이메일</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="owner@example.com"
            autoComplete="email"
            required
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">비밀번호</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호 입력"
            autoComplete="current-password"
            required
            disabled={loading}
          />
        </div>

        {error ? (
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? '로그인 중...' : '로그인'}
        </Button>
      </form>

      <div className="mt-5 grid gap-2 text-center text-sm">
        <Link href="/forgot-password" className="text-muted-foreground transition-colors hover:text-primary">
          비밀번호를 잊으셨나요?
        </Link>
        <p className="text-muted-foreground">
          계정이 없으신가요?{' '}
          <Link href="/register" className="font-medium text-primary hover:underline">
            회원가입
          </Link>
        </p>
      </div>
    </AuthPageShell>
  );
}
