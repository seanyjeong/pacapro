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
  danger: 'border-red-200 bg-red-50 text-red-700',
  default: 'border-blue-200 bg-blue-50 text-blue-700',
  loading: 'border-slate-200 bg-slate-100 text-slate-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

export function AuthPageShell({ children, description, icon, title, tone = 'default' }: AuthPageShellProps) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">P-ACA</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal text-slate-950">체대입시 학원관리</h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">학생, 상담, 수납, 출결을 한 곳에서 관리합니다.</p>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-md border ${toneClass[tone]}`}>
              {icon}
            </div>
            <h2 className="text-xl font-semibold tracking-normal text-slate-950">{title}</h2>
            <div className="mt-2 text-sm leading-6 text-slate-600">{description}</div>
          </div>
          <div className="px-6 py-6">{children}</div>
        </section>
      </div>
    </main>
  );
}
