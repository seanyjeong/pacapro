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
  'h-12 w-full rounded-xl border border-transparent bg-muted pl-4 pr-10 text-right text-[15px] font-semibold tabular-nums text-foreground outline-none transition-colors focus-visible:border-primary focus-visible:bg-card focus-visible:ring-4 focus-visible:ring-primary/10';

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
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
        {TAB_OPTIONS.map((option) => (
          <button
            key={option.id}
            aria-pressed={activeTab === option.id}
            className={[
              'min-w-0 rounded-lg px-3 py-2 text-left transition-colors',
              activeTab === option.id ? 'bg-card text-foreground' : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
            type="button"
            onClick={() => setActiveTab(option.id)}
          >
            <span className="block text-sm font-semibold">{option.label}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {option.description}
            </span>
          </button>
        ))}
      </div>

      <div>
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-success-soft text-success">
            <BadgeDollarSign className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-base font-bold text-foreground">{activeLabel} 학원비</h3>
            <p className="text-sm text-muted-foreground">주당 횟수별 기본 금액을 입력해 주세요.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SESSION_COUNTS.map((sessions) => {
            const id = `${tuitionKey}-${sessions}`;
            const value = formData.tuition_settings[tuitionKey][String(sessions)] ?? 0;

            return (
              <div key={id} className="space-y-1.5">
                <label className="text-sm font-semibold text-secondary-foreground" htmlFor={id}>
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
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
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
