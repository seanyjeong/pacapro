import type { AcademySettings } from './settings-types';
import { getSalaryExampleRows } from './settings-utils';

interface SalaryExamplePanelProps {
  settings: AcademySettings;
}

export function SalaryExamplePanel({ settings }: SalaryExamplePanelProps) {
  return (
    <div className="rounded-xl bg-muted p-4">
      <h3 className="text-sm font-bold text-foreground">급여 정산 예시</h3>
      <ul className="mt-2 space-y-1 text-sm text-secondary-foreground">
        {getSalaryExampleRows(settings).map((row) => (
          <li key={row}>{row}</li>
        ))}
      </ul>
    </div>
  );
}
