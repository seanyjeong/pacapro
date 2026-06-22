import { Clock3 } from 'lucide-react';
import { TIME_SLOTS } from './onboarding-constants';
import type { OnboardingFormData, UpdateOnboardingField } from './onboarding-types';
import { parseTimeRange, updateTimeRange } from './onboarding-utils';

interface StepClassTimeProps {
  formData: OnboardingFormData;
  updateFormData: UpdateOnboardingField;
}

const TIME_INPUT_CLASS =
  'h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-primary/30';

export function StepClassTime({ formData, updateFormData }: StepClassTimeProps) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      {TIME_SLOTS.map((slot) => {
        const times = parseTimeRange(formData[slot.key]);

        return (
          <section key={slot.key} className="rounded-md border border-border bg-background p-4">
            <div className="mb-4 flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                <Clock3 className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-base font-semibold text-foreground">{slot.label}</h3>
                <p className="text-sm text-muted-foreground">{slot.helper}</p>
              </div>
            </div>

            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
              <TimeInput
                id={`${slot.key}-start`}
                label={`${slot.label} 시작`}
                value={times.start}
                onChange={(value) => updateFormData(slot.key, updateTimeRange(formData[slot.key], 'start', value))}
              />
              <span className="pb-2 text-sm text-muted-foreground">부터</span>
              <TimeInput
                id={`${slot.key}-end`}
                label={`${slot.label} 종료`}
                value={times.end}
                onChange={(value) => updateFormData(slot.key, updateTimeRange(formData[slot.key], 'end', value))}
              />
            </div>
          </section>
        );
      })}
    </div>
  );
}

function TimeInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className={TIME_INPUT_CLASS}
        type="time"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
