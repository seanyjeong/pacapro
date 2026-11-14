'use client';

import Link from 'next/link';
import { CalendarDays, FileText, UserCheck, UserPlus } from 'lucide-react';
import { StatTile } from '@/components/ui/page';

interface ConsultationCalendarWorkQueueProps {
  confirmedCount: number;
  learningCount: number;
  memoCount: number;
  newInquiryCount: number;
  pendingCount: number;
  totalCount: number;
}

/** 이번 달 상담 요약. 신규·재원생 칸은 각 상담 화면으로 이어진다. */
export function ConsultationCalendarWorkQueue({
  confirmedCount,
  learningCount,
  memoCount,
  newInquiryCount,
  pendingCount,
  totalCount,
}: ConsultationCalendarWorkQueueProps) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="consultation-calendar-work-queue">
      <StatTile
        label="이번 달 상담"
        value={`${totalCount}건`}
        note={`대기 ${pendingCount} · 확정 ${confirmedCount}`}
        tone={pendingCount > 0 ? 'warning' : 'neutral'}
        icon={CalendarDays}
      />
      <Link href="/consultations/new-inquiry" aria-label="신규 상담 보기" className="flex rounded-2xl">
        <StatTile className="w-full transition-colors hover:bg-card/70" label="신규 상담" value={`${newInquiryCount}건`} tone="primary" icon={UserPlus} />
      </Link>
      <Link href="/consultations/enrolled" aria-label="재원생 상담 보기" className="flex rounded-2xl">
        <StatTile className="w-full transition-colors hover:bg-card/70" label="재원생 상담" value={`${learningCount}건`} tone="success" icon={UserCheck} />
      </Link>
      <StatTile label="상담 메모" value={`${memoCount}건`} tone="warning" icon={FileText} />
    </div>
  );
}
