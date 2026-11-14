'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCircle, Eye, EyeOff, Lock, XCircle } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthNotice, AuthPageShell, authInputClass, authLabelClass } from '@/features/auth/auth-page-shell';
import { PACA_API_BASE_URL } from '@/lib/api/base-url';

const API_URL = PACA_API_BASE_URL;
const RESET_PASSWORD_ERROR_MESSAGE = '비밀번호를 변경하지 못했습니다. 잠시 후 다시 시도해주세요.';

function ResetLoadingState({ label }: { label: string }) {
  return (
    <AuthPageShell
      icon={<div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/40 border-t-transparent" />}
      title={label}
      tone="loading"
      description="재설정 링크 상태를 확인하고 있어요."
    >
      <p className="text-sm text-secondary-foreground">잠시만 기다려주세요.</p>
    </AuthPageShell>
  );
}

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setIsValidating(false);
        setIsTokenValid(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/auth/verify-reset-token?token=${token}`);
        const data = await response.json();
        setIsTokenValid(data.valid);
      } catch {
        setIsTokenValid(false);
      } finally {
        setIsValidating(false);
      }
    };

    void validateToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    if (newPassword.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/reset-password`, {
        body: JSON.stringify({ token, newPassword }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });

      if (!response.ok) throw new Error('reset password request failed');

      setIsSuccess(true);
    } catch (err) {
      console.warn('비밀번호 재설정에 실패했습니다.', err);
      setError(RESET_PASSWORD_ERROR_MESSAGE);
    } finally {
      setIsLoading(false);
    }
  };

  if (isValidating) return <ResetLoadingState label="링크 확인 중" />;

  if (!isTokenValid) {
    return (
      <AuthPageShell
        icon={<XCircle className="h-6 w-6" />}
        title="링크가 만료되었습니다"
        tone="danger"
        description="비밀번호 재설정 링크가 유효하지 않거나 만료되었어요. 비밀번호 찾기를 다시 해주세요."
      >
        <div className="grid gap-3">
          <Link href="/forgot-password" className={buttonVariants({ size: 'lg', className: 'w-full' })}>
            비밀번호 찾기
          </Link>
          <Link href="/login" className={buttonVariants({ variant: 'outline', size: 'lg', className: 'w-full' })}>
            <ArrowLeft className="h-4 w-4" />
            로그인으로 돌아가기
          </Link>
        </div>
      </AuthPageShell>
    );
  }

  if (isSuccess) {
    return (
      <AuthPageShell
        icon={<CheckCircle className="h-6 w-6" />}
        title="비밀번호 변경 완료"
        tone="success"
        description="비밀번호가 바뀌었어요. 새 비밀번호로 로그인해주세요."
      >
        <Button size="lg" className="w-full" onClick={() => router.push('/login')}>
          로그인하기
        </Button>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell
      icon={<Lock className="h-6 w-6" />}
      title="새 비밀번호 설정"
      description="새 비밀번호를 8자 이상으로 입력해주세요."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="newPassword" className={authLabelClass}>새 비밀번호</Label>
          <div className="relative">
            <Input
              id="newPassword"
              type={showPassword ? 'text' : 'password'}
              placeholder="8자 이상 입력"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              disabled={isLoading}
              minLength={8}
              className={`${authInputClass} pr-12`}
            />
            <button
              type="button"
              aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
              className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className={authLabelClass}>비밀번호 확인</Label>
          <Input
            id="confirmPassword"
            type={showPassword ? 'text' : 'password'}
            placeholder="비밀번호 다시 입력"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={isLoading}
            minLength={8}
            className={authInputClass}
          />
        </div>

        {error ? (
          <AuthNotice role="alert">{error}</AuthNotice>
        ) : null}

        <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
          {isLoading ? '변경 중...' : '비밀번호 변경'}
        </Button>

        <div className="text-center">
          <Link href="/login" className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-primary">
            <ArrowLeft className="h-4 w-4" />
            로그인으로 돌아가기
          </Link>
        </div>
      </form>
    </AuthPageShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetLoadingState label="로딩 중" />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
