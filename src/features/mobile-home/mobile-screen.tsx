import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronLeft, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page';
import { cn } from '@/lib/utils/cn';

/*
 * 휴대폰 전용 /m 화면 틀 (2026-11 새 디자인).
 * 공개 레이아웃의 가운데 좁은 칸(px-4 py-6) 안에서 가장자리까지 바탕을 채우고,
 * 위에는 뒤로 가기 줄, 그 아래 큰 제목, 필요하면 아래 고정 버튼을 둔다.
 */

/** 흰 카드 안의 회색 채운 칸(네이티브 select·date 용). `Input` 과 같은 모양. */
export const MOBILE_FIELD_CLASS =
  'h-11 w-full min-w-0 rounded-xl border border-transparent bg-muted px-4 text-[15px] text-foreground outline-none transition-colors focus-visible:border-primary focus-visible:bg-card focus-visible:ring-4 focus-visible:ring-primary/10 dark:[color-scheme:dark]';

interface MobileScreenProps {
  title: ReactNode;
  description?: ReactNode;
  /** 뒤로 가기 줄 오른쪽 버튼(새로고침 등) */
  actions?: ReactNode;
  /** 아래 고정 버튼 묶음 */
  footer?: ReactNode;
  /** 큰 제목 아래·본문 위에 붙는 내용(날짜·시간대 고르기 등) */
  children: ReactNode;
  testId?: string;
  /** 아래 고정 버튼 줄(`MobileBottomBar`)을 본문 안에서 따로 띄우는 화면이면 true */
  bottomSpace?: boolean;
  backHref?: string;
  backLabel?: string;
}

export function MobileScreen({
  title,
  description,
  actions,
  footer,
  children,
  testId,
  bottomSpace,
  backHref = '/m',
  backLabel = '모바일 홈으로 이동',
}: MobileScreenProps) {
  return (
    <div className="-mx-4 -my-6 min-h-screen bg-background text-foreground sm:-my-8" data-testid={testId}>
      <div className="sticky top-0 z-20 flex h-14 items-center gap-1 bg-background/95 px-2 backdrop-blur">
        <Link
          href={backHref}
          aria-label={backLabel}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-foreground transition-colors hover:bg-muted"
        >
          <ChevronLeft className="h-6 w-6" />
        </Link>
        <div className="min-w-0 flex-1" />
        {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </div>

      <div className={cn('space-y-4 px-4', footer || bottomSpace ? 'pb-32' : 'pb-10')}>
        <PageHeader title={title} description={description} className="px-1 pt-0" />
        {children}
      </div>

      {footer && <MobileBottomBar>{footer}</MobileBottomBar>}
    </div>
  );
}

/** 아래 고정 버튼 줄. 이 줄을 쓰는 화면은 `MobileScreen` 에 `bottomSpace` 를 켜서 내용이 가려지지 않게 한다. */
export function MobileBottomBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 bg-background/95 backdrop-blur">
      <div className="mx-auto w-full max-w-lg px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3">{children}</div>
    </div>
  );
}

export function MobileIconButton({ label, onClick, disabled, children }: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Button type="button" variant="ghost" size="icon" onClick={onClick} disabled={disabled} aria-label={label} title={label}>
      {children}
    </Button>
  );
}

export function MobileLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <p role="status" className="text-[15px] text-muted-foreground">불러오는 중이에요</p>
    </div>
  );
}

export function MobileErrorCard({ message, onRetry, retryLabel = '다시 불러오기' }: { message: string; onRetry: () => void; retryLabel?: string }) {
  return (
    <div role="alert" className="rounded-2xl bg-destructive-soft p-5 text-destructive">
      <p className="text-[15px] font-semibold">{message}</p>
      <Button variant="outline" className="mt-4 w-full bg-card" onClick={onRetry}>
        {retryLabel}
      </Button>
    </div>
  );
}

export function MobileSkeleton({ count = 3, className, testId }: { count?: number; className?: string; testId?: string }) {
  return (
    <div className="space-y-3" data-testid={testId}>
      {Array.from({ length: count }, (_, key) => (
        <div key={key} className={cn('h-28 animate-pulse rounded-2xl bg-card', className)} />
      ))}
    </div>
  );
}

/** 회색 통 안의 흰 알약(세그먼트). 시간대·범위 고르기에 쓴다. */
export function MobileSegment<T extends string>({ options, value, onChange, label }: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-muted p-1" role="tablist" aria-label={label}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'h-10 rounded-lg text-[15px] font-semibold transition-colors',
              active ? 'bg-card text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * 아래에서 올라오는 시트. 바깥을 누르면 `onOverlayClick`, 오른쪽 위 X 는 `closeLabel` 이 있을 때만 보인다.
 */
export function MobileSheet({ title, description, closeLabel, onClose, onOverlayClick, testId, dialog, children }: {
  title: ReactNode;
  description?: ReactNode;
  closeLabel?: string;
  onClose?: () => void;
  onOverlayClick?: () => void;
  testId?: string;
  /** role="dialog" aria-modal 을 붙인다 */
  dialog?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-[2px]"
      onClick={onOverlayClick}
      role={dialog ? 'dialog' : undefined}
      aria-modal={dialog ? true : undefined}
      data-testid={dialog ? testId : undefined}
    >
      <section
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-card pb-[calc(env(safe-area-inset-bottom)+20px)]"
        onClick={(event) => event.stopPropagation()}
        data-testid={dialog ? undefined : testId}
      >
        <div className="flex justify-center pb-1 pt-3">
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>
        <div className="space-y-5 px-5 pb-1">
          <div className="flex items-start justify-between gap-3 pt-2">
            <div className="min-w-0">
              <h2 className="text-xl font-bold tracking-tight text-foreground">{title}</h2>
              {description && <p className="mt-1 text-[15px] text-muted-foreground">{description}</p>}
            </div>
            {closeLabel && onClose && (
              <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label={closeLabel} className="-mr-2 -mt-1 shrink-0">
                <X className="h-5 w-5" />
              </Button>
            )}
          </div>
          {children}
        </div>
      </section>
    </div>
  );
}

/** 시트·카드 안의 고르기 버튼(사유·학년·결제 방법 등). 고르면 파랑으로 채운다. */
export function mobileChoiceClass(active: boolean) {
  return cn(
    'min-h-11 rounded-xl px-3 text-[15px] font-semibold transition-colors',
    active ? 'bg-primary text-primary-foreground' : 'bg-muted text-secondary-foreground hover:text-foreground'
  );
}
