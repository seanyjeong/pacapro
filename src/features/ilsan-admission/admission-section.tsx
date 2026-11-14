import type { ReactNode } from 'react';
interface Props { step: number; title: string; description?: ReactNode; children: ReactNode }
export function AdmissionSection({step,title,description,children}:Props) {
  return <fieldset className="min-w-0 overflow-hidden rounded-2xl bg-card text-card-foreground">
    <legend className="float-left flex w-full items-center gap-3 px-5 pb-1 pt-5 sm:px-6">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground" aria-hidden="true">{step}</span>
      <span className="text-[17px] font-bold tracking-tight">{title}</span>
    </legend>
    <div className="clear-both space-y-5 px-5 pb-5 pt-3 sm:px-6 sm:pb-6">
      {description && <p className="text-sm leading-6 text-muted-foreground">{description}</p>}
      {children}
    </div>
  </fieldset>;
}
