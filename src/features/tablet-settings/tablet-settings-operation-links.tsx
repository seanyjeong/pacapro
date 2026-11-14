import Link from 'next/link';
import { Bell, CalendarClock, CalendarCog, ChevronRight, MonitorCog, Settings, UsersRound } from 'lucide-react';
import { SectionCard } from '@/components/ui/page';

const links = [
  { href: '/consultations/settings', label: '상담예약 설정', description: '예약 시간, 차단 시간, 신규상담 링크', icon: CalendarClock },
  { href: '/settings', label: '학원 운영 설정', description: '학원비, 수업 시간, 정산 기준', icon: Settings },
  { href: '/students/class-days', label: '수업일관리', description: '학생 요일, 수업 횟수, 일괄 변경', icon: CalendarCog },
  { href: '/settings/notifications', label: '알림 상세 설정', description: '알림톡, 문자, 발송 기록', icon: Bell },
  { href: '/staff', label: '직원 관리', description: '강사와 권한 관리', icon: UsersRound },
  { href: '/', label: 'PC 운영 콘솔', description: '전체 메뉴와 상세 편집', icon: MonitorCog },
];

export function TabletSettingsOperationLinks() {
  return (
    <SectionCard title="운영 바로가기" description="지점 설정과 학생 운영에 자주 쓰는 화면을 모았어요.">
      <nav className="grid gap-2 pt-1 md:grid-cols-2" aria-label="운영 바로가기">
        {links.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group flex min-h-[64px] items-center gap-3 rounded-xl bg-muted px-4 py-3 transition-colors hover:bg-primary-soft focus:outline-none focus-visible:ring-4 focus-visible:ring-ring/20"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold text-foreground">{item.label}</span>
                <span className="mt-0.5 block text-[13px] leading-5 text-muted-foreground">{item.description}</span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground/60" />
            </Link>
          );
        })}
      </nav>
    </SectionCard>
  );
}
