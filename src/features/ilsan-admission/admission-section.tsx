import type { ReactNode } from 'react';
interface Props { step: number; title: string; description?: ReactNode; children: ReactNode }
export function AdmissionSection({step,title,description,children}:Props) {
  return <fieldset className="min-w-0 overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm">
    <legend className="float-left flex w-full items-center gap-3 border-b border-border bg-muted/50 px-4 py-3.5 sm:px-5">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground" aria-hidden="true">{step}</span>
      <span className="text-base font-semibold">{title}</span>
    </legend>
    <div className="clear-both space-y-5 p-4 sm:p-5">
      {description && <p className="text-sm leading-6 text-muted-foreground">{description}</p>}
      {children}
    </div>
  </fieldset>;
}
