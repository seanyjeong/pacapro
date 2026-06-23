import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TimeReadinessPanelProps {
  hasWeeklyHours: boolean;
}

export function TimeReadinessPanel({ hasWeeklyHours }: TimeReadinessPanelProps) {
  const Icon = hasWeeklyHours ? CheckCircle2 : AlertTriangle;

  return (
    <section
      className={`rounded-md border px-3 py-3 ${
        hasWeeklyHours
          ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
          : 'border-amber-200 bg-amber-50 text-amber-950'
      }`}
      data-testid="new-inquiry-time-readiness"
    >
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${hasWeeklyHours ? 'text-emerald-700' : 'text-amber-700'}`} />
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold">
            {hasWeeklyHours ? '상담 시간 설정 정상' : '상담 시간 설정 필요'}
          </h4>
          <p className={`mt-1 text-xs leading-5 ${hasWeeklyHours ? 'text-emerald-800' : 'text-amber-800'}`}>
            {hasWeeklyHours
              ? '요일별 상담 시간이 연결되어 있어 날짜 선택 후 시간을 고를 수 있습니다.'
              : '요일별 상담 가능 시간을 먼저 등록해야 합니다.'}
          </p>
        </div>
      </div>
      {!hasWeeklyHours ? (
        <Link href="/consultations/settings">
          <Button className="mt-3 w-full gap-2" size="sm" type="button" variant="outline">
            <Settings className="h-4 w-4" />
            상담 설정 열기
          </Button>
        </Link>
      ) : null}
    </section>
  );
}
