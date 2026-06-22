import type { AcademySettings } from './settings-types';
import { getSalaryExampleRows } from './settings-utils';

interface SalaryExamplePanelProps {
  settings: AcademySettings;
}

export function SalaryExamplePanel({ settings }: SalaryExamplePanelProps) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <h4 className="text-sm font-semibold text-foreground">급여 정산 예시</h4>
      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
        {getSalaryExampleRows(settings).map((row) => (
          <li key={row}>{row}</li>
        ))}
      </ul>
    </div>
  );
}
