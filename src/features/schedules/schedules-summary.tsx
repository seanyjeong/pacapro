'use client';

import { useRouter } from 'next/navigation';
import { CalendarCheck2, ClipboardCheck, PhoneCall, Users } from 'lucide-react';
import { StatTile } from '@/components/ui/page';
import type { Consultation } from '@/lib/types/consultation';
import type { ClassSchedule } from '@/lib/types/schedule';

interface SchedulesSummaryProps {
  consultations: Record<string, Consultation[]>;
  schedules: ClassSchedule[];
  selectedDate: string | null;
}

export function SchedulesSummary({ consultations, schedules, selectedDate }: SchedulesSummaryProps) {
  const router = useRouter();
  const selectedSchedules = selectedDate
    ? schedules.filter((schedule) => schedule.class_date === selectedDate)
    : [];
  const selectedStudentCount = selectedSchedules.reduce((total, schedule) => total + (schedule.student_count || 0), 0);
  const selectedConsultationCount = selectedDate ? consultations[selectedDate]?.length || 0 : 0;

  return (
    <section
      className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      data-testid="schedules-operations-board"
      aria-label="수업 숫자 요약"
    >
      <StatTile icon={CalendarCheck2} label="이번 달 수업" value={`${schedules.length}건`} />
      <StatTile icon={ClipboardCheck} label="선택일 수업" tone="primary" value={`${selectedSchedules.length}건`} />
      <StatTile icon={Users} label="선택일 학생" tone="success" value={`${selectedStudentCount}명`} />
      <StatTile
        icon={PhoneCall}
        label="선택일 상담"
        note={selectedDate ? '눌러서 상담 일정 보기' : undefined}
        tone="warning"
        value={`${selectedConsultationCount}건`}
        onClick={selectedDate ? () => router.push(`/consultations/calendar?from=schedule&date=${selectedDate}`) : undefined}
      />
    </section>
  );
}
