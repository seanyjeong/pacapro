import type { LucideIcon } from 'lucide-react';
import { toneIcon, type Tone } from '@/components/ui/page';
import { cn } from '@/lib/utils/cn';

interface SettingsSectionCardProps {
  title: string;
  description?: string;
  icon: LucideIcon;
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  id?: string;
}

/** 설정 화면의 섹션 하나. 섹션 목록(PC 왼쪽·휴대폰 위)이 id 로 이 카드에 바로 간다. */
export function SettingsSectionCard({
  title,
  description,
  icon: Icon,
  tone = 'primary',
  children,
  className,
  contentClassName,
  id,
}: SettingsSectionCardProps) {
  return (
    <section id={id} className={cn('scroll-mt-24 rounded-2xl bg-card', className)}>
      <div className="flex items-start gap-3 px-5 pt-5 sm:px-6 sm:pt-6">
        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', toneIcon[tone])}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 pt-0.5">
          <h2 className="text-[17px] font-bold tracking-tight text-foreground">{title}</h2>
          {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      <div className={cn('px-5 pb-5 pt-5 sm:px-6 sm:pb-6', contentClassName)}>{children}</div>
    </section>
  );
}
