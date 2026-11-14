import type { ReactNode } from 'react';

type AuthTone = 'default' | 'success' | 'danger' | 'loading';

interface AuthPageShellProps {
  children: ReactNode;
  description: ReactNode;
  icon: ReactNode;
  title: string;
  tone?: AuthTone;
}

const toneClass: Record<AuthTone, string> = {
  danger: 'border-destructive/30 bg-destructive-soft text-destructive',
  default: 'border-primary/30 bg-primary-soft text-primary',
  loading: 'border-border bg-muted text-secondary-foreground',
  success: 'border-success/30 bg-success-soft text-success',
};

export function AuthPageShell({ children, description, icon, title, tone = 'default' }: AuthPageShellProps) {
  return (
    <main className="theme-light min-h-screen bg-muted px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="space-y-5">
          <div>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal text-foreground">체대입시 학원관리</h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-secondary-foreground">학생, 상담, 수납, 출결을 한 곳에서 관리합니다.</p>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card shadow-sm">
          <div className="border-b border-border px-6 py-5">
            <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-md border ${toneClass[tone]}`}>
              {icon}
            </div>
            <h2 className="text-xl font-semibold tracking-normal text-foreground">{title}</h2>
            <div className="mt-2 text-sm leading-6 text-secondary-foreground">{description}</div>
          </div>
          <div className="px-6 py-6">{children}</div>
        </section>
      </div>
    </main>
  );
}
