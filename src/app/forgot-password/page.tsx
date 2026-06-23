'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle, Mail } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthPageShell } from '@/features/auth/auth-page-shell';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://chejump.com/paca';
const FORGOT_PASSWORD_ERROR_MESSAGE = '비밀번호 재설정 메일을 보내지 못했습니다. 잠시 후 다시 시도해주세요.';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/forgot-password`, {
        body: JSON.stringify({ email }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });

      if (!response.ok) throw new Error('forgot password request failed');

      setIsSubmitted(true);
    } catch (err) {
      console.warn('비밀번호 재설정 메일 요청에 실패했습니다.', err);
      setError(FORGOT_PASSWORD_ERROR_MESSAGE);
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <AuthPageShell
        icon={<CheckCircle className="h-6 w-6" />}
        title="이메일을 확인해주세요"
        tone="success"
        description={
          <>
            <strong className="font-semibold text-slate-950">{email}</strong>로 비밀번호 재설정 링크를 발송했습니다.
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            메일함과 스팸함을 확인해주세요. 링크는 1시간 동안 유효합니다.
          </div>
          <Link href="/login" className={buttonVariants({ variant: 'outline', className: 'w-full gap-2' })}>
            <ArrowLeft className="h-4 w-4" />
            로그인으로 돌아가기
          </Link>
        </div>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell
      icon={<Mail className="h-6 w-6" />}
      title="비밀번호 찾기"
      description="가입한 이메일 주소를 입력하면 비밀번호 재설정 링크를 보내드립니다."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">이메일</Label>
          <Input
            id="email"
            type="email"
            placeholder="example@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        {error ? (
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? '발송 중...' : '재설정 링크 받기'}
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
