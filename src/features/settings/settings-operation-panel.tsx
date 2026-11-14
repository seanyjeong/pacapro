'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Banknote, Building2, Clock, Home, Info, Link2, User, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface SettingsOperationPanelProps {
  isOwner?: boolean;
}

const links = [
  { id: 'academy-basic', label: '학원 기본 정보', icon: Home },
  { id: 'class-times', label: '수업 시간대', icon: Clock },
  { id: 'tuition', label: '입시반 학원비', icon: Wallet },
  { id: 'adult-tuition', label: '성인반 학원비', icon: Wallet },
  { id: 'salary-settings', label: '급여 설정', icon: Banknote },
  { id: 'branches', label: '지점·반', icon: Building2 },
  { id: 'google-integration', label: '구글 연동', icon: Link2, ownerOnly: true },
  { id: 'my-info', label: '내 정보', icon: User },
  { id: 'system-info', label: '시스템 정보', icon: Info },
  { id: 'danger-zone', label: '위험 작업', icon: AlertTriangle, ownerOnly: true },
];

/** 설정 섹션 목록. PC 에서는 왼쪽에 세로로 붙어 있고, 휴대폰에서는 위에 가로로 넘기는 칩이다. */
export function SettingsOperationPanel({ isOwner = false }: SettingsOperationPanelProps) {
  const items = links.filter((item) => !item.ownerOnly || isOwner);
  const sectionIds = items.map((item) => item.id).join(' ');
  const [activeId, setActiveId] = useState(items[0].id);

  // 화면에 보이는 섹션을 목록에서 표시한다.
  useEffect(() => {
    const sections = sectionIds
      .split(' ')
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => Boolean(element));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible.length > 0) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-96px 0px -60% 0px' }
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [sectionIds]);

  return (
    <nav aria-label="운영 설정 바로가기" className="min-w-0 lg:sticky lg:top-24">
      <div className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:rounded-2xl lg:bg-card lg:p-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active = activeId === item.id;
          return (
            <a
              key={item.id}
              href={`#${item.id}`}
              aria-current={active ? 'location' : undefined}
              className={cn(
                'inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm font-semibold transition-colors',
                'lg:h-11 lg:rounded-xl lg:px-3 lg:text-[15px]',
                active
                  ? 'bg-foreground text-background lg:bg-primary-soft lg:text-primary'
                  : 'bg-card text-secondary-foreground hover:bg-muted hover:text-foreground lg:bg-transparent'
              )}
            >
              <Icon className="hidden h-[18px] w-[18px] shrink-0 lg:block" />
              <span className="truncate">{item.label}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}
