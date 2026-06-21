import { Phone, User, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SendMode } from './sms-types';

interface SendModeSelectorProps {
  sendMode: SendMode;
  onChange: (mode: SendMode) => void;
}

const MODE_OPTIONS = [
  { value: 'all', label: '전체 발송', detail: '상태와 학년으로 묶어서 발송', icon: Users },
  { value: 'individual', label: '개별 발송', detail: '학생을 검색해서 한 명에게 발송', icon: User },
  { value: 'custom', label: '직접 입력', detail: '전화번호를 직접 입력해서 발송', icon: Phone },
] satisfies Array<{ value: SendMode; label: string; detail: string; icon: LucideIcon }>;

export function SendModeSelector({ sendMode, onChange }: SendModeSelectorProps) {
  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-sm font-semibold text-foreground">발송 대상</h2>
        <p className="text-xs text-muted-foreground">실제 발송 범위가 바뀌는 첫 단계입니다.</p>
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        {MODE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isSelected = sendMode === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                'rounded-lg border bg-background p-3 text-left transition-colors hover:border-emerald-300 hover:bg-emerald-50/40',
                isSelected ? 'border-emerald-400 bg-emerald-50 text-emerald-950' : 'border-border text-foreground'
              )}
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Icon className={cn('h-4 w-4', isSelected ? 'text-emerald-700' : 'text-muted-foreground')} />
                {option.label}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">{option.detail}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
