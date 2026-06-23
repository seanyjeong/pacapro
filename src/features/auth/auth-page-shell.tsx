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
        <section className="space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">P-ACA 계정 보안</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal text-slate-950">운영 계정 복구</h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
              학원 운영 계정은 학생, 수납, 상담 정보와 연결됩니다. 본인 확인 링크를 통해 안전하게 접근을
              복구합니다.
            </p>
          </div>

          <div className="grid gap-2 text-sm text-slate-700">
            <div className="rounded-md border border-slate-200 bg-white px-4 py-3">
              <span className="font-medium text-slate-950">메일 확인</span>
              <span className="ml-2 text-slate-500">재설정 링크는 요청 계정으로만 발송됩니다.</span>
            </div>
            <div className="rounded-md border border-slate-200 bg-white px-4 py-3">
              <span className="font-medium text-slate-950">시간 제한</span>
              <span className="ml-2 text-slate-500">링크는 1시간 동안만 사용할 수 있습니다.</span>
            </div>
            <div className="rounded-md border border-slate-200 bg-white px-4 py-3">
              <span className="font-medium text-slate-950">운영 보호</span>
              <span className="ml-2 text-slate-500">실패 사유는 화면에 기술 정보로 노출하지 않습니다.</span>
            </div>
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
