import type { ReactNode } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils/cn';

type AuthTone = 'default' | 'success' | 'danger' | 'loading';

interface AuthPageShellProps {
  children: ReactNode;
  description: ReactNode;
  icon: ReactNode;
  title: string;
  tone?: AuthTone;
}

const toneClass: Record<AuthTone, string> = {
  danger: 'bg-destructive-soft text-destructive',
  default: 'bg-primary-soft text-primary',
  loading: 'bg-muted text-secondary-foreground',
  success: 'bg-success-soft text-success',
};

/** 로그인·가입·비밀번호 화면 틀. 회색 바탕 가운데 로고와 흰 카드 하나. 입력 화면(default)은 아이콘 없이, 결과 화면은 상태 아이콘을 크게 보인다. */
export function AuthPageShell({ children, description, icon, title, tone = 'default' }: AuthPageShellProps) {
  return (
    <main className="theme-light min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-[420px] flex-col justify-center">
        <div className="mb-6 flex items-center gap-3 px-1">
          <Image src="/icons/icon-96x96.png" alt="P-ACA" width={44} height={44} className="shrink-0 rounded-xl" priority />
          <div className="min-w-0">
            <p className="text-xl font-extrabold leading-tight tracking-tight text-foreground">P-ACA</p>
            <p className="text-[13px] font-medium text-muted-foreground">체대입시 학원관리</p>
          </div>
        </div>

        <section className="rounded-2xl bg-card p-6 sm:p-8">
          {tone !== 'default' && (
            <div className={cn('mb-5 flex h-14 w-14 items-center justify-center rounded-full', toneClass[tone])}>
              {icon}
            </div>
          )}
          <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-foreground">{title}</h1>
          <div className="mt-2 text-[15px] leading-6 text-muted-foreground">{description}</div>
          <div className="mt-7">{children}</div>
        </section>

        <p className="mt-6 text-center text-[13px] text-muted-foreground">학생, 상담, 수납, 출결을 한 곳에서 관리해요.</p>
      </div>
    </main>
  );
}

/** 인증 화면 안의 알림 줄(오류·안내). */
export function AuthNotice({ children, tone = 'danger', role }: { children: ReactNode; tone?: 'danger' | 'success' | 'primary'; role?: 'alert' }) {
  const toneText = {
    danger: 'bg-destructive-soft text-destructive',
    primary: 'bg-primary-soft text-primary',
    success: 'bg-success-soft text-success',
  }[tone];
  return <div role={role} className={cn('rounded-xl px-4 py-3 text-sm leading-6', toneText)}>{children}</div>;
}

export const authLabelClass = 'text-sm font-semibold text-secondary-foreground';
export const authInputClass = 'h-12 text-base';
