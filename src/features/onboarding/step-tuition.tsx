import { useState } from 'react';
import { BadgeDollarSign } from 'lucide-react';
import { SESSION_COUNTS } from './onboarding-constants';
import type { OnboardingFormData, UpdateOnboardingField } from './onboarding-types';
import { formatWon, normalizeNumberInput } from './onboarding-utils';

interface StepTuitionProps {
  formData: OnboardingFormData;
  updateFormData: UpdateOnboardingField;
}

type TuitionTab = 'exam' | 'adult';

const TAB_OPTIONS: Array<{ id: TuitionTab; label: string; description: string }> = [
  { id: 'exam', label: '입시반', description: '체대입시 정규반 기준' },
  { id: 'adult', label: '성인반', description: '성인 취미 및 개인 수업 기준' },
];

const INPUT_CLASS =
  'h-10 w-full rounded-md border border-border bg-background pl-3 pr-9 text-right text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-primary/30';

export function StepTuition({ formData, updateFormData }: StepTuitionProps) {
  const [activeTab, setActiveTab] = useState<TuitionTab>('exam');
  const tuitionKey = activeTab === 'exam' ? 'exam_tuition' : 'adult_tuition';
  const activeLabel = activeTab === 'exam' ? '입시반' : '성인반';

  const updateTuition = (sessions: number, value: string) => {
    updateFormData('tuition_settings', {
      ...formData.tuition_settings,
      [tuitionKey]: {
        ...formData.tuition_settings[tuitionKey],
        [String(sessions)]: normalizeNumberInput(value),
      },
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 rounded-md border border-border bg-background p-2 sm:flex-row">
        {TAB_OPTIONS.map((option) => (
          <button
            key={option.id}
            aria-pressed={activeTab === option.id}
            className={[
              'flex-1 rounded-md px-3 py-2 text-left transition',
              activeTab === option.id ? 'bg-slate-900 text-white' : 'text-muted-foreground hover:bg-muted',
            ].join(' ')}
            type="button"
            onClick={() => setActiveTab(option.id)}
          >
            <span className="block text-sm font-semibold">{option.label}</span>
            <span className={activeTab === option.id ? 'text-xs text-slate-200' : 'text-xs text-muted-foreground'}>
              {option.description}
            </span>
          </button>
        ))}
      </div>

      <div className="rounded-md border border-border bg-background p-4">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
            <BadgeDollarSign className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-base font-semibold text-foreground">{activeLabel} 학원비</h3>
            <p className="text-sm text-muted-foreground">주당 횟수별 기본 금액을 입력하세요.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {SESSION_COUNTS.map((sessions) => {
            const id = `${tuitionKey}-${sessions}`;
            const value = formData.tuition_settings[tuitionKey][String(sessions)] ?? 0;

            return (
              <div key={id} className="space-y-1.5">
                <label className="text-sm font-medium text-foreground" htmlFor={id}>
                  주 {sessions}회
                </label>
                <div className="relative">
                  <input
                    id={id}
                    aria-label={`${activeLabel} 주 ${sessions}회 학원비`}
                    className={INPUT_CLASS}
                    inputMode="numeric"
                    type="text"
                    value={formatWon(value)}
                    onChange={(event) => updateTuition(sessions, event.target.value)}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    원
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
