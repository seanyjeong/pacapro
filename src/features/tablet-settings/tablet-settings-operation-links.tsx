import Link from 'next/link';
import { Bell, CalendarClock, CalendarCog, MonitorCog, Settings, UsersRound } from 'lucide-react';

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
    <section className="rounded-md border border-border bg-background p-4" aria-label="운영 바로가기">
      <div>
        <h2 className="text-base font-semibold text-foreground">운영 바로가기</h2>
        <p className="mt-1 text-sm text-muted-foreground">지점 설정과 학생 운영에 자주 쓰는 화면을 모았습니다.</p>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {links.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-md border border-border bg-muted/20 px-3 py-3 transition-colors hover:bg-muted/45 focus:outline-none focus:ring-2 focus:ring-ring/30"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground group-hover:text-foreground">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">{item.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">{item.description}</span>
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
